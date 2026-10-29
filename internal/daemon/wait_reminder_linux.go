//go:build linux

package daemon

import "encoding/json"

// process-extension.mjs (waitReminder) appends this at the end of a turn that
// leaves the conversation's own Taskfleet runs working with nothing waiting
// for them. Its text is the agent's, in English, with the wait command; the
// person sees which runs it named, as restart_linux.go does for the catch-up.
const waitReminderMessageType = "oh-wait-reminder"

type waitReminder struct {
	Runs []restartRun `json:"runs"`
	// More counts the runs named beyond the twenty listed.
	More int `json:"more,omitempty"`
}

func nativeWaitReminder(e nativeEntry) (historyEntry, bool) {
	raw := e.Raw
	if e.Type == "message" {
		raw = e.Message
	} else if e.Type != "custom_message" {
		return historyEntry{}, false
	}
	var m struct {
		Role       string `json:"role"`
		CustomType string `json:"customType"`
		Display    bool   `json:"display"`
		Details    struct {
			Runs   []json.RawMessage `json:"runs"`
			Titles []json.RawMessage `json:"titles"`
		} `json:"details"`
	}
	if json.Unmarshal(raw, &m) != nil || m.CustomType != waitReminderMessageType || e.Type == "message" && m.Role != "custom" {
		return historyEntry{}, false
	}
	out := historyEntry{Key: e.ID, Timestamp: nativeTimestamp(e.Timestamp)}
	if !m.Display {
		return out, true
	}
	n := waitReminder{Runs: []restartRun{}}
	for i, item := range m.Details.Runs {
		var id, title string
		if json.Unmarshal(item, &id) != nil || !taskfleetIDPattern.MatchString(id) {
			continue
		}
		if len(n.Runs) == 20 {
			n.More++
			continue
		}
		if i < len(m.Details.Titles) && json.Unmarshal(m.Details.Titles[i], &title) != nil {
			title = ""
		}
		n.Runs = append(n.Runs, restartRun{ID: id, Title: prefixBytes(title, 200)})
	}
	if len(n.Runs) == 0 {
		return out, true
	}
	out.Kind = "unknown"
	out.Content = historyContent{MediaType: "text/plain", Text: "", Complete: true}
	out.WaitReminder = &n
	return out, true
}
