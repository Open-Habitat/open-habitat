//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
)

// A conversation whose Pi stopped while it was waiting is woken when what it
// waited for has ended, as a person's message would wake it (Jari,
// 2026-10-30; the issue's option 2). It was waiting when the active branch
// shows a background process that would have woken the agent (pi-processes
// notify "turn") still open: Pi stopped under it, so the process is gone and
// can never wake anyone. A `taskfleet run wait` for this conversation's own
// runs wakes it once those runs settle as the wait would have returned; any
// other cut-off waking process wakes it at once, because what it waited for
// will never be said. Nothing else wakes a stopped conversation: one that
// only created runs was not waiting, and the person's own stop is theirs,
// also after a restart, because the companion records it in the branch
// (personStopType) and an archived conversation is never started.
//
// The facts are native: the branch says what was cut off and what the agent
// was already told (the catch-up), Taskfleet says whether a run settled. The
// wake starts Pi like typing does and asks the companion to give the agent
// its catch-up as a turn of its own (process-extension.mjs, op "wake"); the
// agent decides what to do, and Habitat re-runs nothing.
const (
	wakeCheckInterval = time.Minute
	// A rest older than this, or a branch quiet for longer, is not woken: a
	// day covers a night's work, as for owed recaps.
	wakeHorizon = 24 * time.Hour
	// One automatic wake per conversation in this window, so a Pi that
	// ends again before the agent is told cannot be woken in a loop.
	wakeCooldown = 30 * time.Minute
	// Conversations a restart may have cut off, looked at once.
	maxRestartWaits = 64
)

func (c *ConversationController) watchWaitingRests(ctx context.Context) {
	ticker := time.NewTicker(wakeCheckInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			c.wakeWaitingRests(ctx, now)
		}
	}
}

// waitingRest is one stopped conversation that may have been waiting.
type waitingRest struct {
	id     string
	handle *conversation // nil: not controlled since this daemon started
	path   string
	rest   restFact
}

// wakeWaitingRests looks at every stopped conversation that may have been
// waiting and wakes those whose wait has ended.
func (c *ConversationController) wakeWaitingRests(ctx context.Context, now time.Time) {
	if c.home == "" || c.runtime == nil {
		return
	}
	c.scanRestartWaits(now)
	var runs map[string]nativeSpinoff
	runsRead := false
	for _, w := range c.waitingRests(now) {
		if ctx.Err() != nil {
			return
		}
		waits, ok := c.cutWaits(w, now)
		if !ok {
			continue
		}
		if len(waits) == 0 {
			c.waitSettledFor(w)
			continue
		}
		if !runsRead {
			runsRead = true
			if list, ok := listTaskfleetRuns(ctx, c.home); ok {
				runs = make(map[string]nativeSpinoff, len(list))
				for _, r := range list {
					runs[r.ID] = r
				}
			}
		}
		if reason := waitOutcome(waits, runs, w.id); reason != "" {
			c.wakeRest(ctx, w, reason, now)
		}
	}
}

// waitingRests lists the stopped conversations not yet ruled out. Caller does
// not hold c.mu.
func (c *ConversationController) waitingRests(now time.Time) []waitingRest {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil
	}
	var out []waitingRest
	for id, s := range c.sessions {
		// The person stopped this handle: even a rest kept from an
		// earlier stop (an unused typing wake) is theirs now.
		if s.waitChecked || s.stopCause == "person" || liveChild(s) || s.state != "stopped" || len(s.held) > 0 {
			continue
		}
		if at, ok := c.autoWoke[id]; ok && now.Sub(at) < wakeCooldown {
			continue
		}
		rest, _, resting := c.restOf(s)
		// The person stopped it: waking it would overrule them.
		if !resting || rest.cause == "person" || now.Sub(rest.at) > wakeHorizon {
			s.waitChecked = true
			continue
		}
		out = append(out, waitingRest{id: id, handle: s, path: s.historyPath, rest: rest})
	}
	for id := range c.restartWaits {
		if c.sessions[id] != nil {
			delete(c.restartWaits, id) // its handle speaks for it now
			continue
		}
		out = append(out, waitingRest{id: id, rest: restFact{cause: "restart", at: time.UnixMilli(c.started)}})
	}
	return out
}

// waitSettledFor rules a conversation out until a new handle replaces it.
func (c *ConversationController) waitSettledFor(w waitingRest) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if w.handle != nil {
		if c.sessions[w.id] == w.handle {
			w.handle.waitChecked = true
		}
		return
	}
	delete(c.restartWaits, w.id)
}

// scanRestartWaits finds, once, the browser's own active conversations whose
// branch was cut off with a waking process before this daemon started: the
// restart (an upgrade, for example) stopped every Pi.
func (c *ConversationController) scanRestartWaits(now time.Time) {
	c.mu.Lock()
	scanned := c.restartScanned
	c.restartScanned = true
	c.mu.Unlock()
	if scanned {
		return
	}
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		return
	}
	visibility, visibilityErr := loadVisibility(c.home)
	found := map[string]bool{}
	for _, n := range sessions {
		if len(found) >= maxRestartWaits {
			break
		}
		if n.state != "readable" || archiveFact(visibility, visibilityErr, "pi:"+n.id) != "active" {
			continue
		}
		// Quiet for longer than the horizon: nothing there is still awaited.
		if info, err := os.Lstat(n.path); err != nil || now.Sub(info.ModTime()) > wakeHorizon {
			continue
		}
		if origin, err := peekBrowserOrigin(c.home, n.id); err != nil || origin.Cwd != n.cwd {
			continue
		}
		w := waitingRest{id: n.id, path: n.path, rest: restFact{cause: "restart", at: time.UnixMilli(c.started)}}
		if waits, ok := c.cutWaits(w, now); ok && len(waits) > 0 {
			found[n.id] = true
		}
	}
	c.mu.Lock()
	if c.restartWaits == nil {
		c.restartWaits = map[string]bool{}
	}
	for id := range found {
		if c.sessions[id] == nil {
			c.restartWaits[id] = true
		}
	}
	c.mu.Unlock()
}

// cutWaits are the waking processes the branch saw start and not end that no
// catch-up has told the agent about: the companion's own selection
// (prepareCatchUp), so the wake's catch-up names them. ok is false when the
// branch cannot be read now.
func (c *ConversationController) cutWaits(w waitingRest, now time.Time) ([]branchProcess, bool) {
	path := w.path
	if path == "" {
		sessions, err := nativeSessions(c.nativeCfg())
		if err != nil {
			return nil, false
		}
		for _, n := range sessions {
			if n.id == w.id && n.state == "readable" {
				path = n.path
			}
		}
		if path == "" {
			return nil, true
		}
	}
	var scan branchScan
	ok := false
	if c.facts != nil {
		scan, ok = c.facts.sessions.branch(path, c.cfg.UID)
	} else {
		scan, ok = scanBranchFile(path, c.cfg.UID)
	}
	if !ok {
		return nil, false
	}
	if now.Sub(time.UnixMilli(scan.last)) > wakeHorizon {
		return nil, true
	}
	var unreported []branchProcess
	for _, p := range scan.open {
		if !p.Reported {
			unreported = append(unreported, p)
		}
	}
	var waits []branchProcess
	for _, p := range unreported[max(0, len(unreported)-20):] {
		if p.Wakes && !p.PersonStopped {
			waits = append(waits, p)
		}
	}
	return waits, true
}

// waitOutcome says why a cut-off wait would wake the conversation now:
// "settled" when the conversation's own runs a `taskfleet run wait` was for
// have settled as that wait would have returned (every one, or the first
// with --any; only a terminal status with --terminal), "cut_off" for any
// other waking process, or "" while the runs still work. runs is nil when
// Taskfleet could not be read: nothing is decided about a run wait then.
func waitOutcome(waits []branchProcess, runs map[string]nativeSpinoff, id string) string {
	reason := ""
	for _, p := range waits {
		ids := taskfleetWait(p.Command)
		if len(ids) == 0 {
			return "cut_off"
		}
		if runs == nil {
			continue
		}
		words := strings.FieldsFunc(p.Command, func(r rune) bool { return r == ' ' || r == '\t' })
		anyOne, terminal := false, false
		for _, w := range words {
			anyOne = anyOne || w == "--any"
			terminal = terminal || w == "--terminal"
		}
		own, settled := 0, 0
		for _, run := range ids {
			r, ok := runs[run]
			if !ok || !belongsSpinoff(r, nativeSession{id: id}) {
				continue
			}
			own++
			if terminal && (r.Status == "done" || r.Status == "failed" || r.Status == "cancelled") || !terminal && !catchUpLive(r) {
				settled++
			}
		}
		switch {
		case own == 0:
			// Not this conversation's runs: their settling is not its news
			// (the catch-up reports only its own), so the cut-off wait is.
			return "cut_off"
		case anyOne && settled > 0 || !anyOne && settled == own:
			reason = "settled"
		}
	}
	return reason
}

// wakeRest starts the conversation's Pi as typing does and asks the companion
// to give the agent its catch-up as a turn. A wake that finds the person
// already there, or nothing left to tell, leaves things as they are: a Pi the
// person woke or wrote to is theirs, and one started for nothing is stopped
// again with its rest intact.
func (c *ConversationController) wakeRest(ctx context.Context, w waitingRest, reason string, now time.Time) {
	log := diagnostic.New(os.Stderr, "daemon")
	skip := func(why string) {
		log.Info("conversation_wake", "outcome", "skipped", "reason", why, "trigger", reason, "agent_id", "pi:"+w.id)
	}
	active := func() bool {
		visibility, err := loadVisibility(c.home)
		return archiveFact(visibility, err, "pi:"+w.id) == "active"
	}
	origin, err := c.resumableOrigin(w.id)
	if err != nil {
		c.waitSettledFor(w)
		skip("read_only_history")
		return
	}
	// Archive holds the same permit while it commits: read it under the permit.
	release, ok := c.proofPermit(ctx)
	if !ok {
		skip("source_unavailable")
		return
	}
	if !active() {
		release()
		c.waitSettledFor(w)
		skip("not_active")
		return
	}
	c.mu.Lock()
	old := c.sessions[w.id]
	if c.closed || old != w.handle || old != nil && (liveChild(old) || old.state != "stopped" || len(old.held) > 0) {
		// Someone else started or controls it meanwhile.
		c.mu.Unlock()
		release()
		return
	}
	if old == nil {
		if !c.makeRecordRoom() {
			c.mu.Unlock()
			release()
			skip("session_records_exhausted")
			return
		}
		old = &conversation{id: w.id, workspace: origin.Workspace, cwd: origin.Cwd, rpc: stoppedRPC(), state: "stopped", dead: true, events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool)}
		c.sessions[w.id] = old
		delete(c.restartWaits, w.id)
	}
	c.mu.Unlock()
	s, problem := c.resume(w.id, old, startAutoWake)
	release()
	if problem != "" {
		switch problem {
		case "capacity_exceeded", "session_records_exhausted", "source_unavailable":
			// Busy places or a passing failure: the next check tries again.
		default:
			c.waitSettledFor(waitingRest{id: w.id, handle: old})
		}
		skip(problem)
		return
	}
	started := time.Now()
	c.mu.Lock()
	if c.autoWoke == nil {
		c.autoWoke = map[string]time.Time{}
	}
	c.autoWoke[w.id] = now
	c.mu.Unlock()
	deadline := started.Add(piReadyTimeout + 15*time.Second)
	for {
		c.mu.Lock()
		starting := c.sessions[w.id] == s && s.state == "starting"
		c.mu.Unlock()
		if !starting || time.Now().After(deadline) || ctx.Err() != nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	// From here until the wake's turn begins, a message the person sends is
	// held for after it (sendKind), so the two never race into Pi.
	c.mu.Lock()
	ready := !c.closed && c.sessions[w.id] == s && s.state == "idle" && !s.dead && liveChild(s) && !s.told && heldActivity(s) == ""
	if ready {
		s.waking = true
	}
	c.mu.Unlock()
	if !ready {
		skip("not_ready")
		return
	}
	var outcome struct {
		Woken  bool   `json:"woken"`
		Reason string `json:"reason"`
	}
	err = nil
	if active() {
		askCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
		err = s.rpc.processRequest(askCtx, map[string]any{"op": "wake", "session_id": w.id, "generation": s.rpc.processGeneration, "reason": reason}, &outcome)
		cancel()
	} else {
		outcome.Reason = "not_active"
	}
	if err == nil && outcome.Woken {
		c.mu.Lock()
		s.told = true // the turn carries the catch-up
		s.lastUsed = time.Now()
		c.mu.Unlock()
		log.Info("conversation_wake", "outcome", "woken", "trigger", reason, "agent_id", "pi:"+w.id, "stop_cause", w.rest.cause)
		// The turn begins at Pi's agent_start, which ends the hold; should
		// it never come, the person's messages must not wait for it.
		turnDeadline := time.Now().Add(10 * time.Second)
		for {
			c.mu.Lock()
			waiting := c.sessions[w.id] == s && s.waking
			c.mu.Unlock()
			if !waiting || time.Now().After(turnDeadline) || ctx.Err() != nil {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		c.mu.Lock()
		s.waking = false
		c.mu.Unlock()
		c.deliverHeld(s)
		return
	}
	c.mu.Lock()
	s.waking = false
	var marked []*conversation
	// Declined once, this rest is not tried again: the next is a new handle.
	s.waitChecked = true
	if c.sessions[w.id] == s && !s.told && len(s.held) == 0 && s.presentAt.Before(started) {
		marked = c.stopIdleLocked([]*conversation{s}, "idle")
	}
	c.mu.Unlock()
	c.closeStopping(marked)
	c.deliverHeld(s)
	why := outcome.Reason
	if err != nil || why == "" {
		why = "bridge_unavailable"
	}
	skip(why)
}
