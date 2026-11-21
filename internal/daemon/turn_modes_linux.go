//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
)

// Participant messages and the owner's release of a waiting request (ADR
// 0038 sections 3–5). A participant's message never reaches Pi as a user
// message: the daemon holds it until Pi is idle and hands it to the
// companion (process-extension.mjs op participant_message), which writes it
// as an oh-participant-message custom message from the record's fields and
// starts its run text-only, or with tools for a full-rights participant.
// The companion enforces the mode in tool_call; the daemon decides only who
// is speaking (the record, rechecked when the message is delivered, not when
// it was sent) and when Pi is free to hear it.
//
// The queue lives in this daemon incarnation only, like the owner's held
// messages: after a restart its outcome is unknown and nothing is resent.

const (
	// The companion's bridge request line is 32 KiB; one message, joined
	// with the same person's consecutive ones, stays well inside it.
	maxParticipantText = 16000
)

// guestHeld is one item waiting for an idle Pi in the conversation's shared
// order: a participant's message, or the owner's release of a waiting
// request (a Habitat line the companion writes).
type guestHeld struct {
	seq         uint64
	kind        string // "participant" or "release"
	id          string // message ID, or the release line's ID
	subject     string // the participant (the request's author for a release)
	displayName string
	text        string
	at          string
	// A release: the request it names and the mode it continues in.
	request, action string
}

// nextHeldSeq orders owner and participant held items as they arrived.
// Caller holds c.mu.
func (s *conversation) nextHeldSeq() uint64 {
	s.heldSeq++
	return s.heldSeq
}

// participantFirst reports whether the oldest held item is a participant's
// or a release, so the owner's held text waits behind it. Caller holds c.mu.
func participantFirst(s *conversation) bool {
	if len(s.guestHeld) == 0 {
		return false
	}
	return len(s.held) == 0 || s.guestHeld[0].seq < s.held[0].seq
}

func validParticipantText(text string) bool {
	return utf8.ValidString(text) && strings.TrimSpace(text) != "" && len(text) <= maxParticipantText && !strings.ContainsRune(text, 0)
}

// holdParticipantMessage admits a participant's message. The guest send
// route (ADR section 6) calls it with the participant the gateway named; the
// record decides whether they may write. It answers like a guest refusal
// (resource_not_found) for anyone the record does not admit.
func (c *ConversationController) holdParticipantMessage(id string, p guestParticipant, text string) (map[string]any, int, string) {
	if !validParticipantText(text) {
		return nil, 400, "invalid_request"
	}
	if _, ok := c.authorizeGuest(id, p, false); !ok {
		return nil, 404, "resource_not_found"
	}
	messageID, ok := uuid()
	if !ok {
		return nil, 503, "control_uncertain"
	}
	item := guestHeld{kind: "participant", id: messageID, subject: p.Subject, displayName: p.DisplayName, text: text, at: time.Now().UTC().Format(time.RFC3339Nano)}
	if status, code := c.enqueueGuest(id, item); status != 0 {
		return nil, status, code
	}
	return map[string]any{"schema_version": 1, "message_id": messageID, "state": "held"}, 0, ""
}

// cancelParticipantMessage takes a participant's own held message back
// before Pi has it. A message already delivered is not returned.
func (c *ConversationController) cancelParticipantMessage(id string, p guestParticipant, messageID string) (map[string]any, int, string) {
	if _, ok := c.authorizeGuest(id, p, false); !ok || !sessionIDPattern.MatchString(messageID) {
		return nil, 404, "resource_not_found"
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	s := c.sessions[id]
	if s == nil {
		return nil, 404, "resource_not_found"
	}
	for i, h := range s.guestHeld {
		if h.kind == "participant" && h.id == messageID && h.subject == p.Subject {
			s.guestHeld = append(s.guestHeld[:i:i], s.guestHeld[i+1:]...)
			if c.journal != nil {
				c.journal.appendInvalidation("pi:" + id)
			}
			return map[string]any{"schema_version": 1, "message_id": messageID, "state": "cancelled", "text": h.text}, 0, ""
		}
	}
	return nil, 409, "not_held"
}

// enqueueGuest puts an item in the conversation's held order and starts Pi
// or delivers it when Pi is free.
func (c *ConversationController) enqueueGuest(id string, item guestHeld) (int, string) {
	var origin *browserOrigin
	c.mu.Lock()
	missing := c.sessions[id] == nil
	c.mu.Unlock()
	if missing {
		if o, err := c.resumableOrigin(id); err == nil {
			origin = &o
		}
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil && origin != nil && !c.closed {
		if !c.makeRecordRoom() {
			c.mu.Unlock()
			return 429, "session_records_exhausted"
		}
		s = &conversation{id: id, workspace: origin.Workspace, cwd: origin.Cwd, rpc: stoppedRPC(), state: "stopped", dead: true, events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool)}
		c.sessions[id] = s
	}
	if s == nil {
		c.mu.Unlock()
		return 409, "read_only_history"
	}
	if c.closed || c.runtime == nil || s.state == "stopping" || len(s.held)+len(s.guestHeld) >= maxHeldMessages {
		c.mu.Unlock()
		return 409, "control_uncertain"
	}
	item.seq = s.nextHeldSeq()
	s.guestHeld = append(s.guestHeld, item)
	start := (s.state == "stopped" || s.state == "start_failed" || s.dead && s.state != "starting") && !s.waking && !s.compacting
	if start {
		s.state = "starting"
		s.startProblem = ""
		s.lazy = true
	}
	deliver := !start && !notRunning(s)
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
	c.mu.Unlock()
	if start {
		go c.startHeld(s)
	} else if deliver {
		go c.deliverGuest(s)
	}
	return 0, ""
}

// releaseControl is the owner's answer on a waiting request's card.
type releaseControl struct {
	Request string `json:"request"`
	Subject string `json:"subject"`
	Action  string `json:"action"` // allow_all, approve_each, decline
}

// releaseRequest serves POST /api/v1/conversations/<id>/requests on the
// owner's daemon.sock: Salli kaikki, Hyväksy yksitellen or Älä salli. The
// companion writes the release as a Habitat line and checks against the
// branch that the request is still waiting.
func (c *ConversationController) releaseRequest(w http.ResponseWriter, r *http.Request, id string) {
	if !multiplayerEnabled(c.cfg.Home) {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	var in releaseControl
	if decodeControl(r, &in, 1024) != nil || !sessionIDPattern.MatchString(in.Request) || !memberSubjectPattern.MatchString(in.Subject) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	switch in.Action {
	case "allow_all", "approve_each", "decline":
	default:
		snapshotError(w, 400, "invalid_request")
		return
	}
	if _, archived, err := c.shareableConversation(id); err != nil || archived {
		if err != nil {
			memberSourceError(w, err)
		} else {
			snapshotError(w, 409, "conversation_archived")
		}
		return
	}
	// The line names the requester as the record names them; someone
	// removed since is named by their subject.
	name := in.Subject
	c.memberMu.Lock()
	if record, err := loadMembership(c.home); err == nil {
		if conv := record.Conversations["pi:"+id]; conv != nil {
			if at := conv.member(in.Subject); at >= 0 {
				name = conv.Members[at].DisplayName
			}
		}
	}
	c.memberMu.Unlock()
	lineID, ok := uuid()
	if !ok {
		snapshotError(w, 503, "control_uncertain")
		return
	}
	item := guestHeld{kind: "release", id: lineID, subject: in.Subject, displayName: name, at: time.Now().UTC().Format(time.RFC3339Nano), request: in.Request, action: in.Action}
	if status, code := c.enqueueGuest(id, item); status != 0 {
		snapshotError(w, status, code)
		return
	}
	historyJSON(w, map[string]any{"schema_version": 1, "line_id": lineID, "request": in.Request, "state": "held"})
}

// deliverGuest hands the oldest held participant message or release to an
// idle Pi. Like a scheduled wake it holds the owner's sends (s.waking) until
// the run it starts begins, so the two never race into Pi.
func (c *ConversationController) deliverGuest(s *conversation) {
	c.guestMu.Lock()
	defer c.guestMu.Unlock()
	c.mu.Lock()
	if c.closed || c.sessions[s.id] != s || s.dead || !liveChild(s) || notRunning(s) || s.state == "stopping" || s.waking || s.compacting || s.rewinding || s.aborting || s.runActive || s.questionID != "" || (s.state != "idle" && s.state != "rejected") || !participantFirst(s) {
		c.mu.Unlock()
		return
	}
	head := s.guestHeld[0]
	batch := []string{head.id}
	text := head.text
	if head.kind == "participant" {
		// One person's consecutive held messages are one run; never joined
		// with the owner's held text or another person's.
		for _, next := range s.guestHeld[1:] {
			if next.kind != "participant" || next.subject != head.subject || (len(s.held) > 0 && s.held[0].seq < next.seq) || len(text)+2+len(next.text) > maxParticipantText {
				break
			}
			text += "\n\n" + next.text
			batch = append(batch, next.id)
		}
	}
	s.waking = true
	generation := s.rpc.processGeneration
	c.mu.Unlock()
	release := func(drop bool) {
		c.mu.Lock()
		s.waking = false
		if drop {
			kept := s.guestHeld[:0]
			for _, h := range s.guestHeld {
				if !containsString(batch, h.id) {
					kept = append(kept, h)
				}
			}
			s.guestHeld = kept
		}
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + s.id)
		}
		c.mu.Unlock()
	}
	var request map[string]any
	if head.kind == "participant" {
		// Checked against the record as it is now, not as it was sent.
		member, ok := c.authorizeGuest(s.id, guestParticipant{Subject: head.subject, DisplayName: head.displayName}, false)
		if !ok {
			release(true)
			diagnostic.New(os.Stderr, "daemon").Info("participant_message", "outcome", "dropped", "reason", "not_member", "agent_id", "pi:"+s.id)
			go c.deliverHeld(s)
			return
		}
		request = map[string]any{"op": "participant_message", "session_id": s.id, "generation": generation, "message": map[string]any{
			"message_id": head.id, "subject": member.Subject, "display_name": member.DisplayName, "role": member.Role, "generation": member.Generation, "text": text, "at": head.at,
		}}
	} else {
		line := map[string]any{"line_id": head.id, "kind": "continue", "request": head.request, "subject": head.subject, "display_name": head.displayName, "at": head.at}
		switch head.action {
		case "allow_all":
			line["mode"] = "tools"
		case "approve_each":
			line["mode"] = "approve_each"
		default:
			line["kind"] = "declined"
		}
		request = map[string]any{"op": "release", "session_id": s.id, "generation": generation, "line": line}
	}
	var outcome struct {
		Delivered bool   `json:"delivered"`
		Reason    string `json:"reason"`
	}
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	err := s.rpc.processRequest(ctx, request, &outcome)
	cancel()
	if err != nil || !outcome.Delivered {
		// A request the branch no longer has waiting is answered already;
		// a busy Pi gets the item again at its next settle.
		drop := err == nil && (outcome.Reason == "not_waiting" || outcome.Reason == "conversation_mismatch")
		release(drop)
		if drop {
			diagnostic.New(os.Stderr, "daemon").Info("participant_message", "outcome", "dropped", "reason", outcome.Reason, "kind", head.kind, "agent_id", "pi:"+s.id)
			go c.deliverHeld(s)
		}
		return
	}
	c.mu.Lock()
	kept := s.guestHeld[:0]
	for _, h := range s.guestHeld {
		if !containsString(batch, h.id) {
			kept = append(kept, h)
		}
	}
	s.guestHeld = kept
	s.lastUsed = time.Now()
	declined := head.kind == "release" && head.action == "decline"
	c.mu.Unlock()
	if declined {
		// A decline starts no run: the next item may go at once.
		release(false)
		go c.deliverHeld(s)
		return
	}
	// The run begins at Pi's agent_start, which ends the hold; should it
	// never come, the owner's messages must not wait for it.
	deadline := time.Now().Add(10 * time.Second)
	for {
		c.mu.Lock()
		waiting := c.sessions[s.id] == s && s.waking
		c.mu.Unlock()
		if !waiting || time.Now().After(deadline) {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	release(false)
}

func containsString(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}
