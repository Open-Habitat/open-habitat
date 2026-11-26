//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// A participant's operations on the guest socket (ADR 0038 sections 6 and
// 8). Each handler checks the membership record itself, through
// authorizeGuest or admitGuestStream, on every request: the gateway's
// statement of who speaks is identity, never permission. A refusal looks
// like an unknown conversation (resource_not_found), so a guest learns
// nothing about what else exists.
//
// What a participant reads is this one conversation's native history, as
// the owner's history read gives it, without the owner's `!!` commands
// (kept out of the agent's context, so out of the conversation) and without
// the owner's process-run details. The workspace is named by its display
// name only. The owner's queue texts, held texts, question details and
// controls never reach this table.

type guestOperation func(w http.ResponseWriter, r *http.Request, id, tail string, p guestParticipant)

// guestRoute admits one guest operation by method; tail is what follows
// the operation in the path, and only blocks has one.
func guestRoute(identify func(*http.Request) (guestParticipant, bool), method string, withTail bool, op guestOperation) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rest := strings.TrimPrefix(r.URL.Path, guestPrefix)
		id, after, _ := strings.Cut(rest, "/")
		_, tail, _ := strings.Cut(after, "/")
		p, ok := identify(r)
		if !ok || r.Method != method || (tail != "") != withTail {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		if method == http.MethodGet && (r.ContentLength > 0 || len(r.TransferEncoding) != 0) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		op(w, r, id, tail, p)
	})
}

func guestNoQuery(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.RawQuery != "" {
		snapshotError(w, 400, "invalid_request")
		return false
	}
	return true
}

// guestInvite serves GET .../invite: what the invitation card shows before
// joining, the conversation's title. It is the one read an invited person
// may make (ADR section 7: the owner's name, the title and whose agent this
// is; nothing of the conversation itself).
func (c *ConversationController) guestInvite(w http.ResponseWriter, r *http.Request, id, _ string, p guestParticipant) {
	member, ok := c.authorizeGuest(id, p, true)
	if !ok {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if !guestNoQuery(w, r) {
		return
	}
	source, err := c.noticeSource(id)
	if err != nil || source == nil {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	// Only the conversation's name: an untitled conversation's fallback is
	// its first message, and nothing of the conversation shows before
	// joining.
	_, name := c.titleParts(*source)
	historyJSON(w, map[string]any{"schema_version": 1, "title": name, "role": member.Role, "state": member.State})
}

func (c *ConversationController) titleParts(s nativeSession) (string, string) {
	if c.facts != nil {
		return c.facts.sessions.title(s, c.cfg.UID)
	}
	return firstPrompt(s, c.cfg.UID), nativeNameDisplay(s, c.cfg.UID)
}

// workspaceDisplayName names the conversation's workspace as the owner's
// rail does, without its path: its display name, else its directory name.
func (c *ConversationController) workspaceDisplayName(cwd string) string {
	rel, ok := strings.CutPrefix(cwd, c.home+"/src/")
	if !ok || c.discover == nil {
		return ""
	}
	name, _, _ := strings.Cut(rel, "/")
	name = strings.TrimSuffix(name, "__worktrees")
	for _, w := range c.discover(c.nativeCfg()).Entries {
		if w.Name == name {
			if w.DisplayName != "" {
				return w.DisplayName
			}
			return w.Name
		}
	}
	return ""
}

// guestState serves GET .../state: the facts a participant's view needs,
// reported by the daemon so the browser infers none of them (ADR section
// 8). journal_cursor and live_tail are taken together, so the stream opened
// at that cursor continues exactly where the tail ends.
func (c *ConversationController) guestState(w http.ResponseWriter, r *http.Request, id, _ string, p guestParticipant) {
	member, ok := c.authorizeGuest(id, p, false)
	if !ok {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if !guestNoQuery(w, r) {
		return
	}
	// The facts are read from the whole branch, which may take longer than
	// the socket's write deadline, as a long history read does.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(historyReadWait))
	source, err := c.noticeSource(id)
	if err != nil || source == nil {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	agent := "pi:" + id
	cursor := ""
	tail := []json.RawMessage{}
	if c.journal != nil {
		var views map[string]turnTail
		cursor, _, _, views = c.journal.turnView()
		for _, frame := range views[agent].frames {
			if b := guestFrame(agent, frame); b != nil {
				tail = append(tail, b)
			}
		}
	}
	facts, ok := readSharedFacts(source.path, c.cfg.UID)
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	title, _ := sessionTitle(c.titleParts(*source))
	run := map[string]any{"state": "stopped", "aborting": false}
	held := []map[string]any{}
	var question any
	c.mu.Lock()
	if s := c.sessions[id]; s != nil {
		state := "idle"
		switch {
		case s.dead || s.state == "stopped" || s.state == "start_failed":
			state = "stopped"
		case s.state == "starting":
			state = "starting"
		case s.state == "stopping":
			state = "stopping"
		case s.runActive || s.state == "accepted":
			state = "running"
		}
		run = map[string]any{"state": state, "aborting": s.aborting}
		for _, h := range s.guestHeld {
			if h.kind == "participant" && h.subject == p.Subject {
				st := "held"
				if h.delivering {
					st = "delivering"
				}
				held = append(held, map[string]any{"message_id": h.id, "text": h.text, "at": h.at, "state": st})
			}
		}
		if s.questionID != "" {
			// A participant sees that the owner is being asked, never what.
			question = map[string]any{"question_kind": s.questionKind}
		}
	}
	c.mu.Unlock()
	members := []map[string]any{}
	c.memberMu.Lock()
	if record, err := loadMembership(c.home); err == nil {
		if conv := record.Conversations[agent]; conv != nil {
			for _, x := range conv.Members {
				if x.State == stateJoined {
					members = append(members, map[string]any{"subject": x.Subject, "display_name": x.DisplayName, "role": x.Role})
				}
			}
		}
	}
	c.memberMu.Unlock()
	historyJSON(w, map[string]any{
		"schema_version":   1,
		"agent_id":         agent,
		"title":            title,
		"workspace_name":   c.workspaceDisplayName(source.cwd),
		"you":              map[string]any{"subject": member.Subject, "role": member.Role},
		"run":              run,
		"turn":             facts.Turn,
		"waiting_requests": facts.Waiting,
		"release":          facts.Release,
		"pending_question": question,
		"held":             held,
		"members":          members,
		"present":          c.presentIn(id),
		"journal_cursor":   cursor,
		"live_tail":        tail,
	})
}

// guestHistory serves GET .../history with the owner's history query
// grammar (messages, before, after, limit), for this conversation only.
func (c *ConversationController) guestHistory(w http.ResponseWriter, r *http.Request, id, _ string, p guestParticipant) {
	if _, ok := c.authorizeGuest(id, p, false); !ok {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	c.serveGuestRead(w, r, "/api/v1/agents/pi:"+id+"/history")
}

var guestBlockTail = regexp.MustCompile(`^([A-Za-z0-9_-]{1,128})/([0-9]{1,3})$`)

// guestBlocks serves GET .../blocks/<entry>/<index>: one bounded block read
// of an entry of this conversation, as the owner's block read gives it.
func (c *ConversationController) guestBlocks(w http.ResponseWriter, r *http.Request, id, tail string, p guestParticipant) {
	m := guestBlockTail.FindStringSubmatch(tail)
	if m == nil {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if _, ok := c.authorizeGuest(id, p, false); !ok {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	c.serveGuestRead(w, r, "/api/v1/agents/pi:"+id+"/entries/"+m[1]+"/blocks/"+m[2])
}

// serveGuestRead runs the owner's history reader in its guest mode on a
// request the daemon builds itself: the path names only the conversation
// the record admitted, and only the query crosses.
func (c *ConversationController) serveGuestRead(w http.ResponseWriter, r *http.Request, path string) {
	read := historyHandlerFor(c.nativeCfg(), func(*http.Request) bool { return true }, func(transport.Config) ([]nativeSession, error) { return nativeSessions(c.nativeCfg()) }, historyPageBudget, historyBlockBudget, true)
	inner := r.Clone(r.Context())
	inner.URL.Path, inner.URL.RawPath = path, ""
	inner.RequestURI = inner.URL.RequestURI()
	inner.Host = "unix"
	read.ServeHTTP(w, inner)
}

// guestEvents serves GET .../events?after=<cursor>: the owner's journal
// through this conversation's allowlist (guestFrame). The stream is
// admitted under the lock that removal and archiving take, so either ends
// it, and it rechecks the record at every heartbeat.
func (c *ConversationController) guestEvents(w http.ResponseWriter, r *http.Request, id, _ string, p guestParticipant) {
	if c.journal == nil {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	ctx, release, ok := c.admitGuestStream(r.Context(), id, p)
	if !ok {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	defer release()
	agent := "pi:" + id
	c.journal.serve(w, r.WithContext(ctx), func() bool { return true }, func(b []byte) []byte { return guestFrame(agent, b) }, func() bool {
		_, ok := c.authorizeGuest(id, p, false)
		return ok
	})
}

// guestSend serves POST .../send {text}: the daemon holds the message until
// Pi is idle and hands it to the companion (turn_modes_linux.go).
func (c *ConversationController) guestSend(w http.ResponseWriter, r *http.Request, id, _ string, p guestParticipant) {
	var in struct {
		Text string `json:"text"`
	}
	// Anyone the record does not admit gets the unknown-conversation answer
	// before their input is read.
	if _, ok := c.authorizeGuest(id, p, false); !ok {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	// Go's encoder may escape each byte of the longest message six times.
	if !guestNoQuery(w, r) || decodeControl(r, &in, 6*maxParticipantText+64) != nil {
		snapshotError(w, 400, "invalid_request")
		return
	}
	reply, status, code := c.holdParticipantMessage(id, p, in.Text)
	if status != 0 {
		snapshotError(w, status, code)
		return
	}
	historyJSON(w, reply)
}

// guestCancel serves POST .../cancel {message_id}: a participant takes their
// own held message back before Pi has it.
func (c *ConversationController) guestCancel(w http.ResponseWriter, r *http.Request, id, _ string, p guestParticipant) {
	var in struct {
		MessageID string `json:"message_id"`
	}
	if _, ok := c.authorizeGuest(id, p, false); !ok {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if !guestNoQuery(w, r) || decodeControl(r, &in, 256) != nil || !sessionIDPattern.MatchString(in.MessageID) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	reply, status, code := c.cancelParticipantMessage(id, p, in.MessageID)
	if status != 0 {
		snapshotError(w, status, code)
		return
	}
	historyJSON(w, reply)
}

// guestAbort serves POST .../abort: anyone in the conversation may stop the
// running turn, whoever started it (Jari 21.11.). Pi's abort also ends an
// open approval question: the companion asks with the run's signal. It
// touches none of the owner's command receipts, and stopping the Pi process
// stays the owner's.
func (c *ConversationController) guestAbort(w http.ResponseWriter, r *http.Request, id, _ string, p guestParticipant) {
	if _, ok := c.authorizeGuest(id, p, false); !ok {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if !guestNoQuery(w, r) || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil || c.closed || s.dead || s.state != "accepted" || s.settled || s.aborting || s.rpc.overflow.Load() {
		c.mu.Unlock()
		snapshotError(w, 409, "not_running")
		return
	}
	s.aborting = true
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + id)
	}
	c.mu.Unlock()
	go func() {
		accepted, err := s.rpc.request("abort", "", 30*time.Second)
		c.mu.Lock()
		defer c.mu.Unlock()
		s.aborting = false
		if err != nil && !c.closed && s.state != "stopping" {
			s.state = "uncertain"
		}
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + id)
		}
		outcome := "accepted"
		if err != nil {
			outcome = "uncertain"
		} else if !accepted {
			outcome = "rejected"
		}
		diagnostic.New(os.Stderr, "daemon").Info("participant_abort", "outcome", outcome, "agent_id", "pi:"+id)
	}()
	historyJSON(w, map[string]any{"schema_version": 1, "state": "pending"})
}

// Presence (ADR section 8) lives only in this daemon's memory and is lost on
// restart. A participant's browser says present or typing again within the
// time to live, and leaving ends it at once.
const (
	presenceLife = 60 * time.Second
	typingLife   = 8 * time.Second
)

type presenceEntry struct {
	displayName, avatarURL string
	until, typingUntil     time.Time
}

// guestPresence serves POST .../presence {state: present|typing|left}.
func (c *ConversationController) guestPresence(w http.ResponseWriter, r *http.Request, id, _ string, p guestParticipant) {
	var in struct {
		State string `json:"state"`
	}
	if _, ok := c.authorizeGuest(id, p, false); !ok {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if !guestNoQuery(w, r) || decodeControl(r, &in, 128) != nil || (in.State != "present" && in.State != "typing" && in.State != "left") {
		snapshotError(w, 400, "invalid_request")
		return
	}
	// Under memberMu: a removal in between cannot leave presence behind.
	c.memberMu.Lock()
	if _, ok := c.authorizeGuestLocked(id, p, false); !ok {
		c.memberMu.Unlock()
		snapshotError(w, 404, "resource_not_found")
		return
	}
	now := time.Now()
	c.presenceMu.Lock()
	before := c.presenceViewLocked(id, now)
	if in.State == "left" {
		delete(c.presence[id], p.Subject)
	} else {
		if c.presence == nil {
			c.presence = map[string]map[string]*presenceEntry{}
		}
		if c.presence[id] == nil {
			c.presence[id] = map[string]*presenceEntry{}
		}
		e := c.presence[id][p.Subject]
		if e == nil {
			e = &presenceEntry{}
			c.presence[id][p.Subject] = e
		}
		e.displayName, e.avatarURL, e.until = p.DisplayName, p.AvatarURL, now.Add(presenceLife)
		if in.State == "typing" {
			e.typingUntil = now.Add(typingLife)
		} else {
			e.typingUntil = time.Time{}
		}
	}
	c.publishPresenceLocked(id, before, now)
	c.presenceMu.Unlock()
	c.memberMu.Unlock()
	historyJSON(w, map[string]any{"schema_version": 1, "state": in.State})
}

// presenceViewLocked prunes expired entries and gives the visible list,
// sorted by subject. Caller holds presenceMu.
func (c *ConversationController) presenceViewLocked(id string, now time.Time) []map[string]any {
	list := []map[string]any{}
	for subject, e := range c.presence[id] {
		if !now.Before(e.until) {
			delete(c.presence[id], subject)
			continue
		}
		list = append(list, map[string]any{"subject": subject, "display_name": e.displayName, "avatar_url": e.avatarURL, "typing": now.Before(e.typingUntil)})
	}
	if len(c.presence[id]) == 0 {
		delete(c.presence, id)
	}
	sort.Slice(list, func(i, j int) bool { return list[i]["subject"].(string) < list[j]["subject"].(string) })
	return list
}

func (c *ConversationController) presentIn(id string) []map[string]any {
	c.presenceMu.Lock()
	defer c.presenceMu.Unlock()
	return c.presenceViewLocked(id, time.Now())
}

// publishPresenceLocked tells the conversation's browsers when the visible
// list changed, and arms a timer for the next expiry so that someone who
// closed their browser without leaving goes away on time. Caller holds
// presenceMu.
func (c *ConversationController) publishPresenceLocked(id string, before []map[string]any, now time.Time) {
	after := c.presenceViewLocked(id, now)
	a, _ := json.Marshal(before)
	b, _ := json.Marshal(after)
	if !bytes.Equal(a, b) && c.journal != nil {
		c.journal.appendEvent("presence.changed", "pi:"+id, map[string]any{"present": after})
	}
	next := time.Time{}
	for _, e := range c.presence[id] {
		for _, t := range []time.Time{e.until, e.typingUntil} {
			if t.After(now) && (next.IsZero() || t.Before(next)) {
				next = t
			}
		}
	}
	if c.presenceTimers == nil {
		c.presenceTimers = map[string]*time.Timer{}
	}
	if t := c.presenceTimers[id]; t != nil {
		t.Stop()
		delete(c.presenceTimers, id)
	}
	if next.IsZero() {
		return
	}
	c.presenceTimers[id] = time.AfterFunc(time.Until(next)+10*time.Millisecond, func() {
		c.presenceMu.Lock()
		defer c.presenceMu.Unlock()
		c.publishPresenceLocked(id, after, time.Now())
	})
}

// dropPresence forgets a removed person's presence, or everyone's in a
// conversation whose memberships ended (subject empty).
func (c *ConversationController) dropPresence(id, subject string) {
	c.presenceMu.Lock()
	defer c.presenceMu.Unlock()
	now := time.Now()
	before := c.presenceViewLocked(id, now)
	if subject == "" {
		delete(c.presence, id)
	} else {
		delete(c.presence[id], subject)
	}
	c.publishPresenceLocked(id, before, now)
}

// guestPassKinds are the journal kinds a participant may see of this
// conversation, unchanged: the message stream, thinking, tool rows, run
// state and Pi's markers, settles, presence and invalidations. Any other
// kind is dropped, so a new journal kind stays private until it is put
// here. Left out on purpose: queue.changed and command.changed (the owner's
// queue texts and receipts), bash.output (the owner's `!` commands, which
// arrive as history once done, and never for `!!`), process.* (the owner's
// processes), extension.visible, notice.created and workspace events.
var guestPassKinds = map[string]bool{
	"snapshot.invalidated":     true,
	"history.entry":            true,
	"assistant.delta":          true,
	"assistant.thinking.delta": true,
	"assistant.toolcall.delta": true,
	"assistant.toolcall.end":   true,
	"tool.started":             true,
	"tool.updated":             true,
	"tool.finished":            true,
	"turn.settled":             true,
	"pi.lifecycle":             true,
	"pi.marker":                true,
	"pi.retry":                 true,
	"presence.changed":         true,
}

// guestFrame is what a participant sees of one journal frame of the owner's
// daemon: nil for anything outside this conversation or off the allowlist.
// A question is told only as a change (the state read says its kind), never
// with the owner's prompt or the approval detail; a history entry loses the
// owner's process-run details, and a `!!` command is not shown at all.
func guestFrame(agent string, b []byte) []byte {
	var frame map[string]json.RawMessage
	if json.Unmarshal(b, &frame) != nil {
		return nil
	}
	var kind string
	var resource map[string]string
	if json.Unmarshal(frame["kind"], &kind) != nil || json.Unmarshal(frame["resource"], &resource) != nil {
		return nil
	}
	if len(resource) != 1 || resource["agent_id"] != agent {
		// The owner's whole-daemon invalidations say only that something
		// changed, as a gap in the cursor already does.
		if kind == "snapshot.invalidated" && len(resource) == 1 && resource["scope"] == "user" {
			return b
		}
		return nil
	}
	switch kind {
	case "question.requested":
		frame["kind"], _ = json.Marshal("snapshot.invalidated")
		frame["payload"], _ = json.Marshal(map[string]string{"reason": "source_changed"})
		out, err := json.Marshal(frame)
		if err != nil {
			return nil
		}
		return out
	case "history.entry":
		dec := json.NewDecoder(bytes.NewReader(frame["payload"]))
		dec.UseNumber()
		var payload map[string]any
		if dec.Decode(&payload) != nil {
			return nil
		}
		if hidden, _ := payload["exclude_from_context"].(bool); hidden {
			return nil
		}
		changed := false
		if blocks, ok := payload["blocks"].([]any); ok {
			for _, block := range blocks {
				if m, ok := block.(map[string]any); ok {
					if event, ok := m["process_event"].(map[string]any); ok {
						if _, has := event["spinoff"]; has {
							delete(event, "spinoff")
							changed = true
						}
					}
				}
			}
		}
		if guestAgentMessagePayload(payload) {
			changed = true
		}
		if !changed {
			return b
		}
		raw, err := json.Marshal(payload)
		if err != nil {
			return nil
		}
		frame["payload"] = raw
		out, err := json.Marshal(frame)
		if err != nil {
			return nil
		}
		return out
	}
	if (kind == "tool.updated" || kind == "tool.finished") && bytes.Contains(frame["payload"], []byte("agent_message_sent")) {
		// The result of an agent message names the owner's other
		// conversation (guestAgentMessage): the participant sees the row,
		// not the output.
		var payload map[string]any
		if json.Unmarshal(frame["payload"], &payload) != nil {
			return nil
		}
		delete(payload, "text")
		raw, err := json.Marshal(payload)
		if err != nil {
			return nil
		}
		frame["payload"] = raw
		out, err := json.Marshal(frame)
		if err != nil {
			return nil
		}
		return out
	}
	if guestPassKinds[kind] {
		return b
	}
	return nil
}
