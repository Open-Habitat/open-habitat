//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"io"
	"strconv"
	"time"
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
	// The person stopped Pi while it ran (the companion's personStopType
	// entry): it was cut off by their choice, which no wake overrules.
	PersonStopped bool
}

// The companion appends this custom entry when the person stops Pi.
const personStopType = "oh-person-stop"

// The companion appends this custom entry when the daemon stops a Pi whose
// turn runs because the daemon itself is stopping (a restart or an upgrade).
// Pi then saves the turn as aborted, which without the mark reads as the
// person's stop.
const restartStopType = "oh-restart-stop"

type interruptedProcess struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Preview string   `json:"command_preview"`
	Start   int64    `json:"started_at"`
	Reason  string   `json:"reason"`
	Wakes   bool     `json:"wakes_agent"`
	RunIDs  []string `json:"run_ids"`
}

// branchScan is what the active branch says about Pi's processes and about
// what the agent has already been told: the same facts process-extension.mjs
// (branchFacts) reads from Pi's own branch when Pi starts.
type branchScan struct {
	open []branchProcess
	// runs holds the `run_id:state` keys of the Taskfleet runs earlier
	// catch-ups reported.
	runs map[string]bool
	// last is the newest entry time on the branch, Unix ms; 0 when none.
	last int64
	// turnCut says the branch's last message leaves a turn unfinished: a
	// prompt, a tool call or a tool result the model never answered. Pi
	// stopped in the middle of that work.
	turnCut bool
	// turnError says the branch's last message is a reply that ended in an
	// error: the provider failed the turn and Pi gave up on it.
	turnError bool
	// reply is the entry ID of the branch's last message when that message
	// is the model's finished answer, so the turn ended and waits for the
	// person; replyAt is its time, Unix ms. Empty after an error, an abort
	// or unfinished work.
	reply   string
	replyAt int64
	// turnAt is when the person began the branch's latest turn, Unix ms: the
	// time of the newest person message that follows a finished turn (or
	// opens the branch). A steer into an open turn does not begin one, and an
	// agent wake-up is not the person's message. 0 when none.
	turnAt int64
	// refused and works say, per AI provider, when the branch last met a
	// provider refusing the sign-in and when a reply last came from it,
	// Unix ms. The snapshot weighs them against each other and against the
	// provider's credential store to tell whether a sign-in is refused now.
	refused map[string]int64
	works   map[string]int64
}

func scanBranchProcesses(b []byte) []branchProcess {
	return scanBranch(b).open
}

// scanBranch reads only process lifecycle and catch-up facts from the current
// leaf's ancestry. Commands stay daemon-side; callers project a preview.
func scanBranch(b []byte) branchScan {
	return scanBranchStream(bytes.NewReader(b))
}

// scanBranchFile scans one stable pass over a native session file.
func scanBranchFile(path string, uid int) (branchScan, bool) {
	var scan branchScan
	_, ok := readNativeStream(path, uid, func(r io.Reader) { scan = scanBranchStream(r) })
	return scan, ok
}

func scanBranchStream(r io.Reader) branchScan {
	type fact struct {
		id, parent   string
		start        *branchProcess
		ended        string
		reported     []string
		runs         []string
		replaceStart string
		at           int64
		personStop   bool
		restartStop  bool
		catchUp      bool // Habitat's catch-up, which opens a woken run
		message      bool // a conversation message, which ends (or not) a turn
		open         bool // that message leaves its turn unfinished
		person       bool // that message is the person's (role user)
		failed       bool // that message is a reply the provider failed
		answer       bool // that message is the model's finished answer
		halted       bool // that message is a reply Pi aborted or failed
		provider     string
		refused      bool // the provider refused the sign-in
		works        bool // the provider answered (an answer or a tool call)
	}
	facts := []fact{}
	parents := map[string]string{}
	leaf := ""
	visit := func(line []byte) bool {
		var e struct {
			ID         string          `json:"id"`
			Type       string          `json:"type"`
			Timestamp  string          `json:"timestamp"`
			ParentID   *string         `json:"parentId"`
			CustomType string          `json:"customType"`
			Details    json.RawMessage `json:"details"`
			Message    *struct {
				Role         string          `json:"role"`
				ToolName     string          `json:"toolName"`
				Provider     string          `json:"provider"`
				StopReason   string          `json:"stopReason"`
				ErrorMessage string          `json:"errorMessage"`
				CustomType   string          `json:"customType"`
				Details      json.RawMessage `json:"details"`
			} `json:"message"`
		}
		if json.Unmarshal(line, &e) != nil || e.Type == "session" || !entryIDPattern.MatchString(e.ID) {
			return true
		}
		f := fact{id: e.ID}
		if t, err := time.Parse(time.RFC3339Nano, e.Timestamp); err == nil {
			f.at = t.UnixMilli()
		}
		if e.ParentID != nil {
			f.parent = *e.ParentID
		}
		parents[e.ID] = f.parent
		leaf = e.ID
		customType, details := e.CustomType, e.Details
		if e.Type == "message" && e.Message != nil {
			customType, details = e.Message.CustomType, e.Message.Details
			// Only the turn's own messages decide; the person's `!command`
			// and Habitat's custom messages are not the agent's answer.
			switch e.Message.Role {
			case "user", "toolResult":
				f.message, f.open = true, true
				f.person = e.Message.Role == "user"
			case "assistant":
				f.message, f.open = true, e.Message.StopReason == "toolUse"
				// A stop while a tool runs is saved as an error; it is the
				// person's abort, not a failure.
				stop := piStopReason(e.Message.StopReason, e.Message.ErrorMessage)
				f.failed = stop == "error"
				f.halted = stop == "error" || stop == "aborted"
				f.answer = !f.open && stop != "error" && stop != "aborted"
				if aiProviders[e.Message.Provider] {
					f.provider = e.Message.Provider
					f.refused = f.failed && modelAuthFailure(e.Message.ErrorMessage)
					f.works = stop != "error" && stop != "aborted"
				}
			}
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
					OK   bool `json:"ok"`
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
			} else if d.Action == "stop" && d.Result.OK && processIDPattern.MatchString(d.Result.Info.ID) {
				// A failed stop (timeout, error) leaves the process live.
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
		case e.Type == "custom" && e.CustomType == personStopType:
			f.personStop = true
		case e.Type == "custom" && e.CustomType == restartStopType:
			f.restartStop = true
		case e.Type == "custom_message" && customType == catchUpMessageType:
			f.catchUp = true
			var d struct {
				Processes []struct {
					ID    string `json:"id"`
					Start int64  `json:"startTime"`
				} `json:"processes"`
				Spinoffs []struct {
					ID    string `json:"run_id"`
					State string `json:"state"`
					Round int    `json:"round"`
				} `json:"spinoffs"`
			}
			if json.Unmarshal(details, &d) == nil {
				for _, p := range d.Processes {
					f.reported = append(f.reported, p.ID+":"+strconv.FormatInt(p.Start, 10))
				}
				for _, r := range d.Spinoffs {
					f.runs = append(f.runs, catchUpKey(r.ID, r.State, r.Round))
				}
			}
		}
		facts = append(facts, f)
		return true
	}
	// As a line scanner would, read up to an unreadable record and also try
	// a final record without its newline.
	if tail, err := eachNativeLine(r, visit); err == nil && len(tail) > 0 {
		visit(tail)
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
	scan := branchScan{runs: map[string]bool{}, refused: map[string]int64{}, works: map[string]int64{}}
	// The daemon's restart mark is ahead of the reply Pi aborted on its way
	// down, within the run it cut; the first such reply uses it up.
	restarted := false
	for _, f := range facts {
		if !active[f.id] {
			continue
		}
		if f.restartStop {
			restarted = true
		}
		// An automatic wake opens its run with Habitat's catch-up, not with
		// the person's message: the mark belongs to the run before it.
		if f.catchUp {
			restarted = false
		}
		scan.last = max(scan.last, f.at)
		if f.refused {
			scan.refused[f.provider] = max(scan.refused[f.provider], f.at)
		}
		if f.works {
			scan.works[f.provider] = max(scan.works[f.provider], f.at)
		}
		if f.message {
			if f.person && !scan.turnCut {
				scan.turnAt = f.at
			}
			if f.person {
				restarted = false
			}
			// A reply the restart aborted or failed leaves its turn cut, not
			// stopped by the person nor failed by the provider.
			cut := restarted && f.halted
			if cut {
				restarted = false
			}
			scan.turnCut, scan.turnError = f.open || cut, f.failed && !cut
			scan.reply, scan.replyAt = "", 0
			if f.answer {
				scan.reply, scan.replyAt = f.id, f.at
			}
		}
		for _, key := range f.runs {
			scan.runs[key] = true
		}
		if f.personStop {
			for _, p := range open {
				p.PersonStopped = true
			}
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
	scan.open = []branchProcess{}
	for _, p := range order {
		if open[p.ID] == p {
			p.Reported = reported[p.ID+":"+strconv.FormatInt(p.Start, 10)]
			scan.open = append(scan.open, *p)
		}
	}
	return scan
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
