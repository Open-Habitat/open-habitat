//go:build linux

package daemon

import (
	"encoding/json"
	"strings"
	"unicode/utf8"
)

// What a shared conversation's native history says (ADR 0038 sections 3–5
// and 8). The companion writes participant messages and Habitat lines as
// custom messages, and its turn-mode decisions and per-call approvals as
// hidden custom entries (process-extension.mjs). The daemon reads them here
// so that browsers are told who wrote what, in which mode a run went and
// which requests wait, and never have to infer it. The rules are the
// companion's (turnModeFromBranch, waitingRequests); this is their reading
// for views, not a second enforcement.

const (
	participantMessageType = "oh-participant-message"
	conversationLineType   = "oh-conversation-line"
	turnModeType           = "oh-turn-mode"
	approvalType           = "oh-approval"
)

// participantMessageFact is the author of an oh-participant-message, from
// the details the companion wrote from the daemon's record. Text is the
// participant's own words, without Habitat's opening lines.
type participantMessageFact struct {
	MessageID   string `json:"message_id"`
	Subject     string `json:"subject"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	Text        string `json:"text"`
}

// conversationLineFact is what a Habitat line says: a membership change, the
// owner's release (continue) or decline of a waiting request, or the owner's
// stop of a process the agent started for the person's request.
type conversationLineFact struct {
	LineID      string `json:"line_id"`
	Kind        string `json:"kind"`
	Event       string `json:"event,omitempty"`
	Mode        string `json:"mode,omitempty"`
	Request     string `json:"request,omitempty"`
	Command     string `json:"command,omitempty"`
	Subject     string `json:"subject"`
	DisplayName string `json:"display_name"`
}

// turnModeMark is one oh-turn-mode decision; covers marks a run's start and
// steer the attribution of a delivered steer or follow-up.
type turnModeMark struct {
	Mode    string
	By      string
	Subject string
	Request string
	Covers  int
	Steer   bool
}

type approvalMark struct {
	CallID  string
	Tool    string
	Answer  string
	Request string
}

var turnModeBy = map[string]bool{"owner": true, "participant": true, "continue": true, "kept": true, "revoked": true, "approved_all": true}

// sharedProjection adds the typed facts of a shared conversation's entries.
// Malformed details give no fact: the entry stays a plain extension message
// (or stays hidden), never a guessed author.
func sharedProjection(e nativeEntry, out *historyEntry) {
	switch e.Type {
	case "custom":
		var c struct {
			CustomType string          `json:"customType"`
			Data       json.RawMessage `json:"data"`
		}
		if json.Unmarshal(e.Raw, &c) != nil {
			return
		}
		switch c.CustomType {
		case turnModeType:
			var d struct {
				Mode    string `json:"mode"`
				By      string `json:"by"`
				Covers  *int   `json:"covers"`
				Steer   *bool  `json:"steer"`
				Subject string `json:"subject"`
				Request string `json:"request"`
			}
			if json.Unmarshal(c.Data, &d) != nil || !validTurnMode(d.Mode) || !turnModeBy[d.By] || d.Covers == nil || (*d.Covers != 0 && *d.Covers != 1) || (d.Steer != nil && !*d.Steer) || (d.Subject != "" && !memberSubjectPattern.MatchString(d.Subject)) || (d.Request != "" && !sessionIDPattern.MatchString(d.Request)) {
				return
			}
			out.turnMark = &turnModeMark{Mode: d.Mode, By: d.By, Subject: d.Subject, Request: d.Request, Covers: *d.Covers, Steer: d.Steer != nil}
		case approvalType:
			var d struct {
				CallID  string `json:"call_id"`
				Tool    string `json:"tool"`
				Answer  string `json:"answer"`
				Request string `json:"request"`
			}
			if json.Unmarshal(c.Data, &d) != nil || d.CallID == "" || len(d.CallID) > 200 || d.Tool == "" || len(d.Tool) > 120 || !utf8.ValidString(d.CallID+d.Tool) || (d.Request != "" && !sessionIDPattern.MatchString(d.Request)) {
				return
			}
			switch d.Answer {
			case "allowed", "denied", "allow_all", "cancelled":
			default:
				return
			}
			out.approvalMark = &approvalMark{CallID: d.CallID, Tool: d.Tool, Answer: d.Answer, Request: d.Request}
		}
	case "custom_message", "message":
		if out.Kind == "" {
			return // not displayed: not part of the conversation anyone reads
		}
		source := e.Raw
		if e.Type == "message" {
			source = e.Message
		}
		var c struct {
			Role       string          `json:"role"`
			CustomType string          `json:"customType"`
			Content    json.RawMessage `json:"content"`
			Details    json.RawMessage `json:"details"`
		}
		if json.Unmarshal(source, &c) != nil || (e.Type == "message" && c.Role != "custom") {
			return
		}
		switch c.CustomType {
		case participantMessageType:
			var d struct {
				MessageID   string `json:"message_id"`
				Subject     string `json:"subject"`
				DisplayName string `json:"display_name"`
				Role        string `json:"role"`
			}
			if json.Unmarshal(c.Details, &d) != nil || !sessionIDPattern.MatchString(d.MessageID) || !memberSubjectPattern.MatchString(d.Subject) || !validMemberName(d.DisplayName) || (d.Role != roleParticipant && d.Role != roleFullRights) {
				return
			}
			text, ok := participantWords(c.Content)
			if !ok {
				return
			}
			out.ParticipantMessage = &participantMessageFact{MessageID: d.MessageID, Subject: d.Subject, DisplayName: d.DisplayName, Role: d.Role, Text: text}
		case conversationLineType:
			var d struct {
				LineID      string `json:"line_id"`
				Kind        string `json:"kind"`
				Event       string `json:"event"`
				Mode        string `json:"mode"`
				Request     string `json:"request"`
				Command     string `json:"command"`
				Subject     string `json:"subject"`
				DisplayName string `json:"display_name"`
			}
			if json.Unmarshal(c.Details, &d) != nil || !sessionIDPattern.MatchString(d.LineID) || !memberSubjectPattern.MatchString(d.Subject) || !validMemberName(d.DisplayName) {
				return
			}
			switch {
			case d.Kind == "membership" && memberLineEvent(d.Event) && d.Mode == "" && d.Request == "" && d.Command == "":
			case d.Kind == "continue" && (d.Mode == "tools" || d.Mode == "approve_each") && sessionIDPattern.MatchString(d.Request) && d.Event == "" && d.Command == "":
			case d.Kind == "declined" && d.Mode == "" && sessionIDPattern.MatchString(d.Request) && d.Event == "" && d.Command == "":
			case d.Kind == "process_stopped" && validLineCommand(d.Command) && d.Event == "" && d.Mode == "" && d.Request == "":
			default:
				return
			}
			out.ConversationLine = &conversationLineFact{LineID: d.LineID, Kind: d.Kind, Event: d.Event, Mode: d.Mode, Request: d.Request, Command: d.Command, Subject: d.Subject, DisplayName: d.DisplayName}
		}
	}
}

func validTurnMode(m string) bool {
	return m == "tools" || m == "text_only" || m == "approve_each"
}

// participantWords is the participant's own text: the companion opens the
// message with Habitat's head and rule lines (participantMessage) and a
// blank line, and neither of them holds a blank line.
func participantWords(content json.RawMessage) (string, bool) {
	var text string
	if json.Unmarshal(content, &text) != nil {
		var blocks []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		}
		if json.Unmarshal(content, &blocks) != nil {
			return "", false
		}
		for _, b := range blocks {
			if b.Type == "text" {
				text += b.Text
			}
		}
	}
	_, words, ok := strings.Cut(text, "\n\n")
	if !ok || !strings.HasPrefix(text, "[Open Habitat] ") || strings.TrimSpace(words) == "" || len(words) > maxParticipantText || !utf8.ValidString(words) {
		return "", false
	}
	return words, true
}

// sharedTurn is the latest run decision the branch records: its mode, who
// started it (owner, participant, continue for a release, kept for a
// daemon- or extension-started run that kept the mode, revoked, or
// approved_all for Salli kaikki in the middle of a run), and the request:
// the participant's message, or the one a release continues.
type sharedTurn struct {
	Mode        string `json:"mode"`
	By          string `json:"by"`
	Subject     string `json:"subject,omitempty"`
	DisplayName string `json:"display_name,omitempty"`
	Request     string `json:"request,omitempty"`
}

type waitingRequest struct {
	Request     string `json:"request"`
	Subject     string `json:"subject"`
	DisplayName string `json:"display_name"`
	EntryKey    string `json:"entry_key"`
}

type approvalRow struct {
	CallID string `json:"call_id"`
	Tool   string `json:"tool"`
	Answer string `json:"answer"`
}

// sharedRelease is the newest release line and the per-call answers given in
// the run it started, so the owner's card and the participant's strip can be
// read back from history.
type sharedRelease struct {
	Request     string        `json:"request"`
	Subject     string        `json:"subject"`
	DisplayName string        `json:"display_name"`
	Kind        string        `json:"kind"`
	Mode        string        `json:"mode,omitempty"`
	Approvals   []approvalRow `json:"approvals"`
}

type sharedFacts struct {
	Turn    *sharedTurn      `json:"turn"`
	Waiting []waitingRequest `json:"waiting_requests"`
	Release *sharedRelease   `json:"release"`
}

// A release run asks at most one question per call; a card shows the newest.
const maxApprovalRows = 200

// keepSharedEntry keeps what sharedFactsOf reads of a branch: user messages
// and the companion's entries.
func keepSharedEntry(_ string, project func() historyEntry) (historyEntry, bool) {
	e := project()
	keep := e.Kind == "user" || e.turnMark != nil || e.approvalMark != nil || e.ParticipantMessage != nil || e.ConversationLine != nil
	if keep {
		// Only the facts are read; the text and blocks are not held.
		e.Blocks, e.full, e.Content = nil, "", historyContent{}
	}
	return e, keep
}

// sharedFactsOf reads the active branch in order, as the companion's
// ownerInputs, turnModeFromBranch and waitingRequests read Pi's branch.
func sharedFactsOf(entries []historyEntry) sharedFacts {
	facts := sharedFacts{Waiting: []waitingRequest{}}
	owner := map[int]bool{}
	var slot string
	for i, e := range entries {
		if e.turnMark != nil {
			if e.turnMark.Covers == 1 {
				slot = e.turnMark.By
			}
			continue
		}
		if e.Kind != "user" || e.ParticipantMessage != nil || e.ConversationLine != nil {
			continue
		}
		by := slot
		if by == "" {
			by = "owner"
		}
		slot = ""
		if i+1 < len(entries) && entries[i+1].turnMark != nil && entries[i+1].turnMark.Steer {
			by = entries[i+1].turnMark.By
		}
		if by == "owner" {
			owner[i] = true
		}
	}
	names := map[string]string{}
	for i, e := range entries {
		switch {
		case e.turnMark != nil:
			m := e.turnMark
			facts.Turn = &sharedTurn{Mode: m.Mode, By: m.By, Subject: m.Subject, Request: m.Request}
		case e.ParticipantMessage != nil:
			p := e.ParticipantMessage
			names[p.Subject] = p.DisplayName
			mode := "text_only"
			if p.Role == roleFullRights {
				mode = "tools"
			}
			// The companion's own decision for this message (its request is
			// the message ID) says the mode; without one, the role does.
			if facts.Turn == nil || facts.Turn.By != "participant" || facts.Turn.Request != p.MessageID {
				facts.Turn = &sharedTurn{Mode: mode, By: "participant", Subject: p.Subject, Request: p.MessageID}
			}
			if p.Role == roleParticipant {
				facts.Waiting = append(facts.Waiting, waitingRequest{Request: p.MessageID, Subject: p.Subject, DisplayName: p.DisplayName, EntryKey: e.Key})
			}
		case e.ConversationLine != nil:
			l := e.ConversationLine
			if l.Kind != "continue" && l.Kind != "declined" {
				continue
			}
			for j := range facts.Waiting {
				if facts.Waiting[j].Request == l.Request {
					facts.Waiting = append(facts.Waiting[:j], facts.Waiting[j+1:]...)
					break
				}
			}
			facts.Release = &sharedRelease{Request: l.Request, Subject: l.Subject, DisplayName: l.DisplayName, Kind: l.Kind, Mode: l.Mode, Approvals: []approvalRow{}}
			if l.Kind == "continue" && (facts.Turn == nil || facts.Turn.By != "continue" || facts.Turn.Request != l.Request) {
				facts.Turn = &sharedTurn{Mode: l.Mode, By: "continue", Request: l.Request}
			}
		case e.approvalMark != nil:
			a := e.approvalMark
			if facts.Release != nil && facts.Release.Kind == "continue" && a.Request == facts.Release.Request {
				facts.Release.Approvals = append(facts.Release.Approvals, approvalRow{CallID: a.CallID, Tool: a.Tool, Answer: a.Answer})
				if len(facts.Release.Approvals) > maxApprovalRows {
					facts.Release.Approvals = facts.Release.Approvals[1:]
				}
			}
		case owner[i]:
			if len(facts.Waiting) > 0 {
				facts.Waiting = facts.Waiting[:len(facts.Waiting)-1]
			}
			if facts.Turn == nil || facts.Turn.By != "owner" {
				facts.Turn = &sharedTurn{Mode: "tools", By: "owner"}
			}
		}
	}
	if facts.Turn != nil && facts.Turn.Subject != "" {
		facts.Turn.DisplayName = names[facts.Turn.Subject]
	}
	return facts
}

// readSharedFacts reads one conversation's facts from its native history.
// It reads the whole active branch, because a waiting request may be old;
// only shared conversations are read this way.
func readSharedFacts(path string, uid int) (sharedFacts, bool) {
	s := readNativeRetaining(path, uid, keepSharedEntry)
	if s.id == "" || s.state != "readable" {
		return sharedFacts{}, false
	}
	return sharedFactsOf(s.entries), true
}
