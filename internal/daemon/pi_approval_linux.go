//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"
)

// The approval question (ADR 0038 section 5): in a run the owner releases
// one call at a time, the companion's tool_call guard asks before each call
// (process-extension.mjs approveCall). Pi carries it as one extension UI
// select whose title is this prefix and the call's JSON: its ID, tool and
// complete arguments. The daemon turns exactly that into the typed browser
// question (event.schema.json $defs/question, question_kind "approval"),
// keeping the arguments whole rather than the shortened prompt, so the owner
// approves the call that runs. Pi's request ID binds the answer to that one
// call; the answer is one of the select's fixed choices.
//
// The question is the owner's: a participant's view never carries it, only
// that the owner is being asked (guestFrame, guestState). The call's
// arguments are part of the conversation's tool rows, which a participant
// reads as the owner's history read gives them (ADR 0038 section 6).
const approvalPrefix = "oh-approval:"

// The companion asks only about arguments it can show whole.
const maxApprovalArguments = 32768

var approvalChoices = []string{"allow", "deny", "allow_all"}

type approvalView struct {
	CallID       string `json:"call_id"`
	Tool         string `json:"tool"`
	Arguments    string `json:"arguments"`
	ParentCallID string `json:"parent_call_id,omitempty"`
	Request      string `json:"request,omitempty"`
}

// approvalRequest reports whether a native UI request is an approval
// question and, when it is well formed, its checked parts. A malformed one
// is still an approval question: it is cancelled, never shown as a generic
// select, so the guard blocks its call.
func approvalRequest(method, title string, options []string) (bool, *approvalView) {
	if method != "select" || !strings.HasPrefix(title, approvalPrefix) {
		return false, nil
	}
	raw := strings.TrimPrefix(title, approvalPrefix)
	if len(raw) > 4*maxApprovalArguments+4096 || !utf8.ValidString(raw) || len(options) != len(approvalChoices) {
		return true, nil
	}
	for i, o := range options {
		if o != approvalChoices[i] {
			return true, nil
		}
	}
	decoder := json.NewDecoder(bytes.NewReader([]byte(raw)))
	decoder.DisallowUnknownFields()
	var view approvalView
	var rest json.RawMessage
	if decoder.Decode(&view) != nil || decoder.Decode(&rest) != io.EOF {
		return true, nil
	}
	ok := approvalID(view.CallID) && permissionLine(view.Tool, 120) && utf8.RuneCountInString(view.Arguments) <= maxApprovalArguments &&
		(view.ParentCallID == "" || approvalID(view.ParentCallID)) && (view.Request == "" || sessionIDPattern.MatchString(view.Request))
	for _, r := range view.Arguments {
		if (unicode.IsControl(r) && r != '\n' && r != '\t') || r == ' ' || r == ' ' {
			ok = false
		}
	}
	if !ok {
		return true, nil
	}
	return true, &view
}

// A provider's tool call ID, or Pi's `<parent>/<n>` for a nested call.
func approvalID(s string) bool {
	if s == "" || len(s) > 200 || !utf8.ValidString(s) {
		return false
	}
	for _, r := range s {
		if unicode.IsControl(r) || unicode.IsSpace(r) {
			return false
		}
	}
	return true
}

func (v *approvalView) wire() map[string]any {
	out := map[string]any{"call_id": v.CallID, "tool": v.Tool, "arguments": v.Arguments}
	if v.ParentCallID != "" {
		out["parent_call_id"] = v.ParentCallID
	}
	if v.Request != "" {
		out["request"] = v.Request
	}
	return out
}
