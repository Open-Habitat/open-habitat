//go:build linux

package daemon

import (
	"encoding/json"
	"time"
)

// The catch-up that process-extension.mjs prepends to the first run after Pi
// is started again is written for the agent, in English, with raw commands.
// The person sees a bounded projection of its details instead; the content
// stays in the agent's context only.
type restartNotice struct {
	Stopped map[string]any `json:"stopped,omitempty"`
	// Habitat woke the agent on its own because what it waited for ended
	// (wake_linux.go): "settled" or "cut_off". Absent: a person's message.
	Woke string `json:"woke,omitempty"`
	// The turn Pi was working on when it stopped never finished.
	InterruptedTurn bool             `json:"interrupted_turn,omitempty"`
	Processes       []restartProcess `json:"processes"`
	Runs            []restartRun     `json:"runs"`
	StillRunning    []restartRun     `json:"still_running"`
}
type restartProcess struct {
	ID   string `json:"process_id"`
	Name string `json:"name"`
}
type restartRun struct {
	ID      string `json:"run_id"`
	Title   string `json:"title"`
	State   string `json:"state,omitempty"`
	Summary string `json:"summary,omitempty"`
	EndedAt string `json:"ended_at,omitempty"`
	Branch  string `json:"branch,omitempty"`
	Round   int    `json:"round,omitempty"`
	Name    string `json:"name,omitempty"`
}

// The stop causes the daemon passes to Pi at launch (rest_linux.go).
var restCauses = map[string]bool{"idle": true, "room": true, "person": true, "crash": true, "restart": true}

var restartStates = map[string]bool{"merged": true, "not_merged": true, "failed": true, "cancelled": true, "awaiting": true, "stalled": true, "round_reported": true}

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
			Stopped *struct {
				Cause string `json:"cause"`
				At    string `json:"at"`
			} `json:"stopped"`
			Woke            string            `json:"woke"`
			InterruptedTurn bool              `json:"interrupted_turn"`
			Processes       []json.RawMessage `json:"processes"`
			Spinoffs        []json.RawMessage `json:"spinoffs"`
			Rearm           []json.RawMessage `json:"rearm"`
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
	if st := m.Details.Stopped; st != nil && restCauses[st.Cause] {
		if at, err := time.Parse(time.RFC3339Nano, st.At); err == nil {
			n.Stopped = restView(restFact{cause: st.Cause, at: at})
		}
	}
	n.InterruptedTurn = n.Stopped != nil && m.Details.InterruptedTurn
	if w := m.Details.Woke; w == "settled" || w == "cut_off" {
		n.Woke = w
	}
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
			ID      string `json:"run_id"`
			State   string `json:"state"`
			Title   string `json:"title"`
			Summary string `json:"summary"`
			EndedAt string `json:"ended_at"`
			Branch  string `json:"branch"`
			Round   int    `json:"round"`
			Name    string `json:"name"`
		}
		if len(n.Runs) < 40 && json.Unmarshal(item, &r) == nil && taskfleetIDPattern.MatchString(r.ID) && restartStates[r.State] {
			run := restartRun{r.ID, prefixBytes(r.Title, 200), r.State, prefixBytes(r.Summary, 2000), nativeTimestamp(r.EndedAt), prefixBytes(r.Branch, 300), 0, ""}
			if r.State == "round_reported" {
				// A round report names its round and worker, or it is left out.
				if r.Round < 1 || r.Round > 100000 || !residentNamePattern.MatchString(r.Name) {
					continue
				}
				run.Round, run.Name = r.Round, r.Name
			}
			n.Runs = append(n.Runs, run)
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
