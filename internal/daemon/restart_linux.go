//go:build linux

package daemon

import "encoding/json"

// The catch-up that process-extension.mjs prepends to the first run after Pi
// is started again is written for the agent, in English, with raw commands.
// The person sees a bounded projection of its details instead; the content
// stays in the agent's context only.
type restartNotice struct {
	Processes    []restartProcess `json:"processes"`
	Runs         []restartRun     `json:"runs"`
	StillRunning []restartRun     `json:"still_running"`
}
type restartProcess struct {
	ID   string `json:"process_id"`
	Name string `json:"name"`
}
type restartRun struct {
	ID    string `json:"run_id"`
	Title string `json:"title"`
	State string `json:"state,omitempty"`
}

var restartStates = map[string]bool{"merged": true, "not_merged": true, "failed": true, "cancelled": true, "awaiting": true, "stalled": true}

func nativeRestart(e nativeEntry) (historyEntry, bool) {
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
			Processes []json.RawMessage `json:"processes"`
			Spinoffs  []json.RawMessage `json:"spinoffs"`
			Rearm     []json.RawMessage `json:"rearm"`
		} `json:"details"`
	}
	if json.Unmarshal(raw, &m) != nil || m.CustomType != catchUpMessageType || e.Type == "message" && m.Role != "custom" {
		return historyEntry{}, false
	}
	out := historyEntry{Key: e.ID, Timestamp: nativeTimestamp(e.Timestamp)}
	if !m.Display {
		return out, true
	}
	n := restartNotice{Processes: []restartProcess{}, Runs: []restartRun{}, StillRunning: []restartRun{}}
	// Each item stands alone: a malformed one is left out, not the notice.
	for _, item := range m.Details.Processes {
		var p struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}
		if len(n.Processes) < 20 && json.Unmarshal(item, &p) == nil && processIDPattern.MatchString(p.ID) {
			n.Processes = append(n.Processes, restartProcess{p.ID, prefixBytes(p.Name, 200)})
		}
	}
	for _, item := range m.Details.Spinoffs {
		var r struct {
			ID    string `json:"run_id"`
			State string `json:"state"`
			Title string `json:"title"`
		}
		if len(n.Runs) < 40 && json.Unmarshal(item, &r) == nil && taskfleetIDPattern.MatchString(r.ID) && restartStates[r.State] {
			n.Runs = append(n.Runs, restartRun{r.ID, prefixBytes(r.Title, 200), r.State})
		}
	}
	for _, item := range m.Details.Rearm {
		var r struct {
			ID    string `json:"run_id"`
			Title string `json:"title"`
		}
		if json.Unmarshal(item, &r) != nil {
			r.Title = ""
			_ = json.Unmarshal(item, &r.ID) // an earlier extension recorded bare run ids
		}
		if len(n.StillRunning) < 20 && taskfleetIDPattern.MatchString(r.ID) {
			n.StillRunning = append(n.StillRunning, restartRun{ID: r.ID, Title: prefixBytes(r.Title, 200)})
		}
	}
	out.Kind = "unknown"
	out.Content = historyContent{MediaType: "text/plain", Text: "", Complete: true}
	out.Restart = &n
	return out, true
}
