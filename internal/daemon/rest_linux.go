//go:build linux

package daemon

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"sort"
	"sync"
	"syscall"
	"time"
)

// A conversation rests when its browser Pi is not running and the agent has
// not yet been told what happened meanwhile. Habitat, not the agent, says
// when and why Pi stopped and what settled since, before anything is started
// (Jari's Kortti, 2026-10-27). The first prompt carries the same report to the
// agent (process-extension.mjs catch-up), after which the rest has ended.
//
// The causes are what this daemon itself saw: idle (the idle reaper), room
// (stopped to make room for another conversation), person (a stop, cancel or
// archive), crash (Pi ended without being asked). A conversation without a
// handle in this daemon has rested since the daemon started at the latest:
// restart, which also covers an upgrade.
type restFact struct {
	cause string
	at    time.Time
	// What this daemon saw of a crash (crashDetail): why it ended Pi's
	// input, if it did, and how Pi exited. The agent's catch-up carries it
	// into the native history, so it outlives the service journal.
	detail string
}

// stopFor records why a child is being stopped. The first cause wins: the
// exit watcher calls an unasked end a crash. A person's stop also goes into
// the native branch through Pi's close, so a restart cannot read their
// processes as cut-off waits to wake for (wake_linux.go). Caller holds c.mu.
func stopFor(s *conversation, cause string) {
	if s.stopCause == "" {
		s.stopCause = cause
	}
	if s.stopCause == "person" && s.rpc != nil {
		s.rpc.personStop.Store(true)
	}
	if s.stopCause == "restart" && s.rpc != nil {
		s.rpc.restartStop.Store(true)
	}
}

// restOf is the rest a handle is in, and whether its Pi is up and ready for
// the person's message. Caller holds c.mu.
func (c *ConversationController) restOf(s *conversation) (restFact, bool, bool) {
	if s == nil {
		return restFact{cause: "restart", at: time.UnixMilli(c.started)}, false, true
	}
	// Woken by typing but not yet told: the rest it woke from still holds,
	// also when this Pi stops again unused.
	if !s.told && s.wokeFrom.cause != "" {
		// A Pi up only for a recap has not been woken: the rest still holds.
		return s.wokeFrom, liveChild(s) && !notRunning(s) && s.state != "stopping" && !s.recapOnly, true
	}
	if liveChild(s) {
		return restFact{}, false, false
	}
	if s.owner == nil {
		// A stand-in handle for a conversation never started here.
		return restFact{cause: "restart", at: time.UnixMilli(c.started)}, false, true
	}
	if s.stoppedAt.IsZero() {
		// Reaped, but its exit watcher has not taken the lock yet.
		s.stoppedAt = time.Now()
		stopFor(s, "crash")
	}
	return restFact{cause: s.stopCause, at: s.stoppedAt, detail: s.stopDetail}, false, true
}

// turnCut says the native branch at path ends in a turn Pi never finished:
// a prompt, tool call or tool result the model did not answer (scanBranch).
// Callers ask only for a resting conversation, whose Pi cannot be finishing
// it, so the turn was cut when Pi stopped. The scan is read again only after
// Pi wrote to the file.
func (c *ConversationController) turnCut(path string) bool {
	if c.facts != nil {
		scan, ok := c.facts.sessions.branch(path, c.cfg.UID)
		return ok && scan.turnCut
	}
	scan, ok := scanBranchFile(path, c.cfg.UID)
	return ok && scan.turnCut
}

// restView is the snapshot's and the report's projection of a rest.
func restView(f restFact) map[string]any {
	return map[string]any{"cause": f.cause, "at": f.at.UTC().Format(time.RFC3339Nano)}
}

// restRun is one run in the person's report and in the agent's catch-up.
type restRun struct {
	ID        string `json:"run_id"`
	Title     string `json:"title"`
	State     string `json:"state,omitempty"`
	Summary   string `json:"summary,omitempty"`
	EndedAt   string `json:"ended_at,omitempty"`
	Branch    string `json:"branch,omitempty"`
	CreatedAt string `json:"created_at,omitempty"`
	Waited    *bool  `json:"waited,omitempty"`
	// The named worker's reported round and name (state round_reported).
	Round int    `json:"round,omitempty"`
	Name  string `json:"name,omitempty"`
}

// catchUpState is the companion's spinoffState (process-extension.mjs): the
// agent's word for a run that settled, "" for one that still works. It differs
// from the panel's spinoffState on purpose: these keys are what earlier
// catch-ups recorded as told.
func catchUpState(r nativeSpinoff) string {
	switch {
	case r.Landed:
		return "merged"
	case r.Stalled:
		return "stalled"
	case openRound(r) > 0:
		// A named worker reported a round and waits for the next message.
		return "round_reported"
	case residentBetweenRounds(r):
		// Its round was answered, or it sleeps after idle expiry: no news.
		return ""
	case r.Attention || r.AwaitingInput:
		return "awaiting"
	}
	return map[string]string{"done": "not_merged", "failed": "failed", "cancelled": "cancelled"}[r.Status]
}

// catchUpLive is the companion's liveRun: working on its own, so a default
// `run wait` would not have returned yet.
// A named worker between rounds is not: its round report returns the wait.
func catchUpLive(r nativeSpinoff) bool {
	return (r.Status == "pending" || r.Status == "running") && !r.Attention && !r.AwaitingInput && !r.Stalled && !residentBetweenRounds(r)
}

// unreportedRuns is the companion's readSpinoffs rule, read by the daemon
// while Pi is stopped: this conversation's own runs that settled after the
// branch's last entry (or that a cut-off wait was for, or that Taskfleet calls
// stalled) and that no earlier catch-up reported in that state. It also lists
// the conversation's runs still working, whether a cut-off wait was for them.
// The tests in testdata/catch-up-runs.json hold both readers to one rule.
func unreportedRuns(ctx context.Context, parent nativeSession, since int64, waited, reported map[string]bool, list func(context.Context) ([]nativeSpinoff, bool), show func(context.Context, string) (nativeSpinoff, bool)) (settled, working []restRun, availability string) {
	settled, working = []restRun{}, []restRun{}
	runs, ok := list(ctx)
	if !ok || runs == nil {
		return settled, working, "unavailable"
	}
	availability = "available"
	// A named worker's wait names it; the wait is for its run.
	if len(waited) > 0 {
		names := []string{}
		expanded := map[string]bool{}
		for k := range waited {
			if taskfleetIDPattern.MatchString(k) {
				expanded[k] = true
			} else {
				names = append(names, k)
			}
		}
		for _, run := range resolveWaitOperands(names, runs, parent.id) {
			expanded[run] = true
		}
		waited = expanded
	}
	var mine, others []nativeSpinoff
	for _, r := range runs {
		if !belongsSpinoff(r, parent) {
			continue
		}
		if catchUpLive(r) {
			w := waited[r.ID]
			working = append(working, restRun{ID: r.ID, Title: prefixBytes(r.Title, 200), CreatedAt: nativeTimestamp(r.CreatedAt), Waited: &w})
		}
		if waited[r.ID] {
			mine = append(mine, r)
		} else if !catchUpLive(r) {
			others = append(others, r)
		}
	}
	// A waited-for run is always looked at; the rest only up to a bounded number of reads.
	sort.SliceStable(others, func(i, j int) bool { return others[i].CreatedAt > others[j].CreatedAt })
	if len(others) > 20 {
		others = others[:20]
	}
	candidates := append(mine, others...)
	details := make([]*nativeSpinoff, len(candidates))
	var wg sync.WaitGroup
	slots := make(chan struct{}, 4)
	for i, r := range candidates {
		wg.Add(1)
		go func() {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			if d, ok := show(ctx, r.ID); ok && d.ID == r.ID && belongsSpinoff(d, parent) {
				details[i] = &d
			}
		}()
	}
	wg.Wait()
	for i, r := range candidates {
		d := details[i]
		if d == nil {
			availability = "partial"
			continue
		}
		state := catchUpState(*d)
		if state == "" {
			continue
		}
		// A stall is computed when read and never advances the record's
		// time, and a run a cut-off wait was for is news; others must be
		// newer than the branch.
		// A round report is fresh by its own time: the run itself goes on.
		updated, err := time.Parse(time.RFC3339Nano, d.Manifest.UpdatedAt)
		// Only a round report carries its round: a stall keeps its caveat.
		round := 0
		if state == "round_reported" {
			round = openRound(*d)
		}
		fresh := waited[r.ID] || state == "stalled" || round > 0 && roundReportedAfter(*d, since) || round == 0 && err == nil && updated.UnixMilli() > since
		if !fresh || reported[catchUpKey(r.ID, state, round)] {
			continue
		}
		run := restRun{ID: r.ID, Title: prefixBytes(r.Title, 200), State: state, Summary: runSummary(*d), Round: round}
		if round > 0 {
			// The worker's own words about the round, and the name the
			// parent messages it by.
			v := d.resident()
			run.Summary = prefixBytes(v.LastRound.Summary, 2000)
			run.Name = v.Name
		}
		if s := d.Status; s == "done" || s == "failed" || s == "cancelled" {
			run.EndedAt = nativeTimestamp(d.Manifest.UpdatedAt)
		}
		if state != "merged" {
			for _, p := range d.Preserved {
				if p.Branch != nil && p.BranchPresent {
					run.Branch = prefixBytes(*p.Branch, 300)
					break
				}
			}
		}
		settled = append(settled, run)
	}
	sort.SliceStable(settled, func(i, j int) bool {
		if settled[i].EndedAt == settled[j].EndedAt {
			return settled[i].ID < settled[j].ID
		}
		return settled[i].EndedAt < settled[j].EndedAt
	})
	sort.SliceStable(working, func(i, j int) bool { return working[i].CreatedAt < working[j].CreatedAt })
	if len(working) > 20 {
		working = working[:20]
	}
	if ctx.Err() != nil {
		availability = "partial"
	}
	return settled, working, availability
}

// runSummary is Taskfleet's own report of a run, the worker's words, bounded
// for one line of the card.
func runSummary(d nativeSpinoff) string {
	summary := d.Report.Summary
	if reason := d.Report.Reason; reason != "" && reason != summary {
		if summary != "" {
			summary += "\n\n"
		}
		summary += reason
	}
	return prefixBytes(summary, 2000)
}

// restReport serves GET /api/v1/conversations/<id>/rest: the card a resting
// browser conversation shows before anything is started. Reading it starts
// nothing; Taskfleet and the native branch are read as the mapped user.
func (c *ConversationController) restReport(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	origin, err := peekBrowserOrigin(c.home, id)
	if err != nil {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	var parent *nativeSession
	for i := range sessions {
		if sessions[i].id != id {
			continue
		}
		if parent != nil || sessions[i].cwd != origin.Cwd || sessions[i].state != "readable" {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		parent = &sessions[i]
	}
	if parent == nil {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	c.mu.Lock()
	rest, _, resting := c.restOf(c.sessions[id])
	c.mu.Unlock()
	report := map[string]any{"processes": []any{}, "runs": []restRun{}, "still_running": []restRun{}}
	reply := map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "availability": "available", "report": report}
	if !resting {
		historyJSON(w, reply)
		return
	}
	report["stopped"] = restView(rest)
	var scan branchScan
	ok := false
	if c.facts != nil {
		scan, ok = c.facts.sessions.branch(parent.path, c.cfg.UID)
	}
	if !ok {
		reply["availability"] = "unavailable"
		historyJSON(w, reply)
		return
	}
	// Every process the branch saw start and not end was cut off with Pi.
	cut := interruptedProcesses(scan.open, time.Now().UnixMilli()+1, c.started)
	processes := make([]map[string]string, 0, len(cut))
	for _, p := range cut {
		processes = append(processes, map[string]string{"process_id": p.ID, "name": p.Name})
	}
	report["processes"] = processes
	report["interrupted_turn"] = scan.turnCut
	// The companion's waited set: the waking waits among the newest twenty
	// cut-off processes nobody was told about.
	var unreported []branchProcess
	for _, p := range scan.open {
		if !p.Reported {
			unreported = append(unreported, p)
		}
	}
	waited := map[string]bool{}
	for _, p := range unreported[max(0, len(unreported)-20):] {
		if p.Wakes {
			for _, run := range taskfleetWaitOperands(p.Command) {
				waited[run] = true
			}
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	home := c.home
	settled, working, availability := unreportedRuns(ctx, *parent, scan.last, waited, scan.runs,
		func(ctx context.Context) ([]nativeSpinoff, bool) {
			// Without Taskfleet no run exists to settle: an empty inventory,
			// not an unread one, or every rest on such a host would be news.
			if taskfleetBinary(home) == "" {
				return []nativeSpinoff{}, true
			}
			return listTaskfleetRuns(ctx, home)
		},
		func(ctx context.Context, run string) (nativeSpinoff, bool) {
			return showSpinoff(ctx, home, run, *parent)
		})
	report["runs"], report["still_running"] = settled, working
	reply["availability"] = availability
	historyJSON(w, reply)
}

// restEnv tells the started Pi's companion which rest it wakes from, so the
// agent's catch-up names the same stop as the person's card.
func restEnv(f restFact) []string {
	if f.cause == "" {
		return nil
	}
	env := []string{"OPEN_HABITAT_STOP_CAUSE=" + f.cause, "OPEN_HABITAT_STOPPED_AT=" + f.at.UTC().Format(time.RFC3339)}
	if f.cause == "crash" && f.detail != "" {
		env = append(env, "OPEN_HABITAT_STOP_DETAIL="+f.detail)
	}
	return env
}

// crashDetail is the daemon's own account of an unasked end, built only from
// its fixed wording, an allowlisted request kind and the exit status: no
// native text, which could carry provider output or secrets.
func crashDetail(inputCause string, state *os.ProcessState) string {
	exit := "Pi's exit status is unknown"
	if state != nil {
		if ws, ok := state.Sys().(syscall.WaitStatus); ok && ws.Signaled() {
			exit = "Pi was killed by signal " + ws.Signal().String()
		} else {
			exit = fmt.Sprintf("Pi exited with status %d", state.ExitCode())
		}
	}
	if inputCause == "" {
		return exit + "; Habitat had not closed its input"
	}
	return "Habitat closed Pi's input after " + inputCause + ", which ends Pi; " + exit
}
