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

// The permission question: a tool_call hook asks the person before a call
// runs, through the companion's API (process-extension.mjs askPermission).
// Pi carries it as one extension UI confirm whose title is this prefix and
// the question's JSON. The daemon turns exactly that into the typed browser
// question (event.schema.json $defs/question, question_kind "permission") and
// answers it as a confirmation; the browser never reads meaning out of text.
//
// Whoever can make this Pi emit a confirm can make it look like a permission
// question, which is any extension the person loaded. That grants nothing:
// the answer goes back only to the confirm that asked, as a generic confirm's
// does, and the hook that guards a call decides on that answer alone.
const permissionPrefix = "oh-permission:"

type permissionAccount struct {
	Provider string `json:"provider"`
	Address  string `json:"address"`
}

type permissionCall struct {
	Area      string  `json:"area"`
	Tool      string  `json:"tool"`
	Arguments *string `json:"arguments"` // required, may be empty
}

type permissionView struct {
	Action      string             `json:"action"`
	Consequence string             `json:"consequence"`
	Account     *permissionAccount `json:"account,omitempty"`
	Call        permissionCall     `json:"call"`
}

// permissionRequest reports whether a native UI request is a permission
// question and, when it is well formed, its checked parts. A malformed one is
// still a permission question: it is cancelled, never shown as a generic
// confirm, so the hook that asked blocks its call.
func permissionRequest(method, title string) (bool, *permissionView) {
	if method != "confirm" || !strings.HasPrefix(title, permissionPrefix) {
		return false, nil
	}
	raw := strings.TrimPrefix(title, permissionPrefix)
	if len(raw) > 16384 || !utf8.ValidString(raw) {
		return true, nil
	}
	decoder := json.NewDecoder(bytes.NewReader([]byte(raw)))
	decoder.DisallowUnknownFields()
	var view permissionView
	var rest json.RawMessage
	if decoder.Decode(&view) != nil || decoder.Decode(&rest) != io.EOF || view.Call.Arguments == nil {
		return true, nil
	}
	ok := permissionLine(view.Action, 300) && permissionLine(view.Consequence, 600) &&
		permissionLine(view.Call.Area, 80) && permissionLine(view.Call.Tool, 120) &&
		permissionArguments(*view.Call.Arguments)
	if view.Account != nil {
		ok = ok && permissionLine(view.Account.Provider, 60) && permissionLine(view.Account.Address, 320)
	}
	if !ok {
		return true, nil
	}
	return true, &view
}

// One line of plain text, bounded in code points as the schema counts them.
func permissionLine(s string, max int) bool {
	n := utf8.RuneCountInString(s)
	if n < 1 || n > max || strings.TrimSpace(s) == "" {
		return false
	}
	for _, r := range s {
		if unicode.IsControl(r) || r == ' ' || r == ' ' {
			return false
		}
	}
	return true
}

// The arguments are shown verbatim and never interpreted; tabs and line
// breaks may stay, other control characters may not.
func permissionArguments(s string) bool {
	if utf8.RuneCountInString(s) > 2000 {
		return false
	}
	for _, r := range s {
		if (unicode.IsControl(r) && r != '\n' && r != '\t') || r == ' ' || r == ' ' {
			return false
		}
	}
	return true
}

func (v *permissionView) wire() map[string]any {
	out := map[string]any{
		"action":      v.Action,
		"consequence": v.Consequence,
		"call":        map[string]any{"area": v.Call.Area, "tool": v.Call.Tool, "arguments": *v.Call.Arguments},
	}
	if v.Account != nil {
		out["account"] = map[string]any{"provider": v.Account.Provider, "address": v.Account.Address}
	}
	return out
}
