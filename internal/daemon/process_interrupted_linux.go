//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"encoding/json"
	"strconv"
)

// The companion's resume message (process-extension.mjs) and its details are
// the only record that the agent was told about a cut-off process.
const catchUpMessageType = "oh-resume-catch-up"

// branchProcess is a process the active Pi branch saw start and never saw end.
// pi-processes records every end it would wake or inform the agent about; a
// stop the agent made is its own tool result. Graceful Pi shutdown kills
// processes as intentional stops, which leave no record, so a process like
// this from an earlier Pi was cut off when that Pi stopped. A browser stop is
// also intentional and indistinguishable here (result.md, decisions).
type branchProcess struct {
	ID, Name, Command string
	Start             int64
	Wakes, Reported   bool
}

type interruptedProcess struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Preview string   `json:"command_preview"`
	Start   int64    `json:"started_at"`
	Reason  string   `json:"reason"`
	Wakes   bool     `json:"wakes_agent"`
	RunIDs  []string `json:"run_ids"`
}

// scanBranchProcesses reads only process lifecycle facts from the current
// leaf's ancestry. Commands stay daemon-side; callers project a preview.
func scanBranchProcesses(b []byte) []branchProcess {
	type fact struct {
		id, parent   string
		start        *branchProcess
		ended        string
		reported     []string
		replaceStart string
	}
	facts := []fact{}
	parents := map[string]string{}
	scanner := bufio.NewScanner(bytes.NewReader(b))
	scanner.Buffer(make([]byte, 4096), maxLegacyHistoryFile+1)
	leaf := ""
	for scanner.Scan() {
		var e struct {
			ID         string          `json:"id"`
			Type       string          `json:"type"`
			ParentID   *string         `json:"parentId"`
			CustomType string          `json:"customType"`
			Details    json.RawMessage `json:"details"`
			Message    *struct {
				Role       string          `json:"role"`
				ToolName   string          `json:"toolName"`
				CustomType string          `json:"customType"`
				Details    json.RawMessage `json:"details"`
			} `json:"message"`
		}
		if json.Unmarshal(scanner.Bytes(), &e) != nil || e.Type == "session" || !entryIDPattern.MatchString(e.ID) {
			continue
		}
		f := fact{id: e.ID}
		if e.ParentID != nil {
			f.parent = *e.ParentID
		}
		parents[e.ID] = f.parent
		leaf = e.ID
		customType, details := e.CustomType, e.Details
		if e.Type == "message" && e.Message != nil {
			customType, details = e.Message.CustomType, e.Message.Details
		}
		switch {
		case e.Type == "message" && e.Message != nil && e.Message.Role == "toolResult" && e.Message.ToolName == "process":
			var d struct {
				Action  string        `json:"action"`
				Process nativeProcess `json:"process"`
				Notify  struct {
					OnSuccess string `json:"onSuccess"`
					OnFailure string `json:"onFailure"`
				} `json:"notify"`
				Result struct {
					Info struct {
						ID string `json:"id"`
					} `json:"info"`
				} `json:"result"`
			}
			if json.Unmarshal(details, &d) != nil {
				break
			}
			if d.Action == "start" && processIDPattern.MatchString(d.Process.ID) && d.Process.Start > 0 {
				// A silent success leaves no record, so its absence proves nothing.
				if d.Notify.OnSuccess == "ignore" {
					f.replaceStart = d.Process.ID
				} else {
					f.start = &branchProcess{ID: d.Process.ID, Name: d.Process.Name, Command: d.Process.Command, Start: d.Process.Start, Wakes: d.Notify.OnSuccess == "turn" || d.Notify.OnFailure == "turn"}
				}
			} else if d.Action == "stop" && processIDPattern.MatchString(d.Result.Info.ID) {
				f.ended = d.Result.Info.ID
			}
		case customType == "ad-process:notification":
			var d struct {
				Kind string `json:"kind"`
				ID   string `json:"processId"`
			}
			if json.Unmarshal(details, &d) == nil && (d.Kind == "success" || d.Kind == "failure" || d.Kind == "crash" || d.Kind == "killed") {
				f.ended = d.ID
			}
		case e.Type == "custom_message" && customType == catchUpMessageType:
			var d struct {
				Processes []struct {
					ID    string `json:"id"`
					Start int64  `json:"startTime"`
				} `json:"processes"`
			}
			if json.Unmarshal(details, &d) == nil {
				for _, p := range d.Processes {
					f.reported = append(f.reported, p.ID+":"+strconv.FormatInt(p.Start, 10))
				}
			}
		}
		facts = append(facts, f)
	}
	active := map[string]bool{}
	for node := leaf; node != "" && !active[node]; node = parents[node] {
		active[node] = true
	}
	// IDs are unique among one Pi's live processes and pi-processes may reuse
	// an ended one, so an end closes the latest open start of that ID.
	open := map[string]*branchProcess{}
	order := []*branchProcess{}
	reported := map[string]bool{}
	for _, f := range facts {
		if !active[f.id] {
			continue
		}
		switch {
		case f.start != nil:
			open[f.start.ID] = f.start
			order = append(order, f.start)
		case f.replaceStart != "":
			delete(open, f.replaceStart)
		case f.ended != "":
			delete(open, f.ended)
		}
		for _, key := range f.reported {
			reported[key] = true
		}
	}
	result := []branchProcess{}
	for _, p := range order {
		if open[p.ID] == p {
			p.Reported = reported[p.ID+":"+strconv.FormatInt(p.Start, 10)]
			result = append(result, *p)
		}
	}
	return result
}

// interruptedProcesses projects the cut-off processes the agent has not yet
// been told about. Only starts before the current Pi launched are certainly
// dead: Pi's processes end with it (pi-processes on shutdown, systemd's cgroup
// on a daemon stop). Starts before this daemon started were cut off by its
// restart; later ones by a Pi stop within this daemon's lifetime.
func interruptedProcesses(open []branchProcess, before, daemonStarted int64) []interruptedProcess {
	result := []interruptedProcess{}
	for i := len(open) - 1; i >= 0 && len(result) < 20; i-- {
		p := open[i]
		if p.Reported || p.Start >= before || p.Name == "" {
			continue
		}
		reason := "pi_stopped"
		if p.Start < daemonStarted {
			reason = "server_restart"
		}
		ids := taskfleetWait(p.Command)
		if ids == nil {
			ids = []string{}
		}
		result = append(result, interruptedProcess{p.ID, prefixBytes(p.Name, 200), commandPreview(p.Command), p.Start, reason, p.Wakes, ids})
	}
	return result
}
