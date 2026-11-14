//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"os"
	"time"
)

// proofPermit serializes temporary probes and continuation admission, including
// the period after proof returns while the caller still owns its fence. Waiting
// is bounded; saturation yields unproven/unavailable, never a false writer.
func (c *ConversationController) proofPermit(ctx context.Context) (func(), bool) {
	c.mu.Lock()
	if c.proofGate == nil {
		c.proofGate = make(chan struct{}, 1)
	}
	gate := c.proofGate
	c.mu.Unlock()
	timer := time.NewTimer(2 * time.Second)
	defer timer.Stop()
	select {
	case gate <- struct{}{}:
		return func() { <-gate }, true
	case <-ctx.Done():
		return nil, false
	case <-timer.C:
		return nil, false
	}
}

// continuationProof is the single admission proof used by status and continue.
// The returned owner fence stays held through admission, or is released by the
// status caller. The probe does no work past a failed non-blocking lock check.
func (c *ConversationController) continuationProof(id string) (*piOwnership, browserOrigin, *os.File, string, string, *conversation, string) {
	var zero browserOrigin
	c.mu.Lock()
	old := c.sessions[id]
	if c.closed || c.runtime == nil {
		c.mu.Unlock()
		return nil, zero, nil, "", "", old, "source_unavailable"
	}
	if old != nil {
		select {
		case <-old.rpc.exited:
			// Reaped is positive evidence; release our copy of the child's lock.
			_ = old.owner.release()
		default:
			c.mu.Unlock()
			return nil, zero, nil, "", "", old, "writer_present"
		}
	}
	owner, err := acquirePiOwnership(c.home, id)
	c.mu.Unlock()
	if err != nil {
		return nil, zero, nil, "", "", old, "writer_present"
	}
	fail := func(kind string) (*piOwnership, browserOrigin, *os.File, string, string, *conversation, string) {
		_ = owner.release()
		return nil, zero, nil, "", "", old, kind
	}
	origin, err := owner.browserOrigin()
	if err != nil {
		return fail("read_only_history")
	}
	if old != nil && (old.workspace != origin.Workspace || old.cwd != origin.Cwd) {
		return fail("unproven")
	}
	ws, cwd, err := c.workspaceFD(origin.Workspace)
	if err != nil || cwd != origin.Cwd {
		if ws != nil {
			_ = ws.Close()
		}
		return fail("unproven")
	}
	histories, err := nativeSessions(c.nativeCfg())
	if err != nil {
		_ = ws.Close()
		return fail("source_unavailable")
	}
	path := ""
	for _, h := range histories {
		if h.id == id {
			if path != "" || h.cwd != cwd || h.state != "readable" {
				_ = ws.Close()
				return fail("unproven")
			}
			path = h.path
		}
	}
	if path == "" {
		_ = ws.Close()
		return fail("unproven")
	}
	// A stable cut-off tail is eligible: resume removes it before Pi starts
	// (readyNativeTail). Damage elsewhere is said, never skipped.
	_, err = reconciledNativeTail(path, c.cfg.UID, id, cwd)
	if err != nil && !errors.Is(err, errHistoryDamaged) {
		_ = ws.Close()
		return fail("unproven")
	}
	// The advisory lock only covers browser children. Terminal Pi writers do
	// not take it; an undecidable process census must not admit another Pi.
	switch c.piWriter(path, cwd) {
	case "writer_present":
		_ = ws.Close()
		return fail("writer_present")
	case "not_observed":
		if err != nil {
			_ = ws.Close()
			return fail("history_damaged")
		}
		return owner, origin, ws, cwd, path, old, "eligible"
	default:
		_ = ws.Close()
		return fail("unproven")
	}
}

// continueEnded wakes a browser conversation: it starts Pi without a turn, as
// the person begins to type into a resting conversation, or retries a failed
// start. Waking is idempotent (ADR 0020 as amended 2026-10-27): a Pi that is
// already running or starting is the answer, not a conflict, so a repeated or
// racing wake never starts a second child or a turn. The daemon requires its
// native ownership lock and browser-origin marker; a terminal history alone
// cannot grant control.
func (c *ConversationController) continueEnded(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength != 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if c.awake(w, id) {
		return
	}
	// Retrying a failed start takes the same path as the send that started it,
	// so a fresh conversation without native history can be started again.
	c.mu.Lock()
	if old := c.sessions[id]; old != nil && old.state == "start_failed" && !c.closed {
		old.state = "starting"
		old.startProblem = ""
		// A failed wake has nothing to deliver; its retry is a wake again.
		old.lazy = len(old.held) > 0 || old.bash != nil && old.bash.state == "held"
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + id)
		}
		c.mu.Unlock()
		go c.startHeld(old)
		historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": old.workspace, "state": "starting", "prior_outcome": "uncertain"})
		return
	}
	c.mu.Unlock()
	releasePermit, ok := c.proofPermit(r.Context())
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	// A racing wake may have started Pi while this one waited for the permit.
	if c.awake(w, id) {
		releasePermit()
		return
	}
	c.mu.Lock()
	old := c.sessions[id]
	c.mu.Unlock()
	s, problem := c.resume(id, old, startWake)
	releasePermit()
	if problem != "" {
		switch problem {
		case "writer_present":
			snapshotError(w, 409, "writer_conflict")
		case "read_only_history":
			snapshotError(w, 409, "read_only_history")
		case "source_unavailable":
			snapshotError(w, 503, "native_source_unavailable")
		case "capacity_exceeded", "session_records_exhausted":
			snapshotError(w, 429, problem)
		case "history_damaged":
			snapshotError(w, 409, "history_damaged")
		case "quota_full", "storage_full":
			snapshotError(w, 507, problem)
		default:
			snapshotError(w, 409, "control_uncertain")
		}
		return
	}
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": s.workspace, "state": "starting", "prior_outcome": "uncertain"})
}

// awake answers a wake with this daemon's Pi when one already runs or starts.
func (c *ConversationController) awake(w http.ResponseWriter, id string) bool {
	c.mu.Lock()
	old := c.sessions[id]
	if old == nil || c.closed || !(old.state == "starting" || liveChild(old) && old.state != "stopping" && old.state != "uncertain") {
		c.mu.Unlock()
		return false
	}
	// The person is typing into it: a Pi started for a recap, by Habitat's
	// own wake or only to deliver held messages is theirs now, and stays up
	// when those messages are taken back. The wake and the send that started
	// Pi race in either order from the browser; both orders keep it up.
	old.recapOnly, old.autoWake, old.lazy = false, false, false
	old.presentAt = time.Now()
	state := "idle"
	switch {
	case old.state == "starting":
		state = "starting"
	case heldActivity(old) != "":
		state = "running"
	}
	workspace := old.workspace
	c.mu.Unlock()
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": workspace, "state": state, "prior_outcome": "uncertain"})
	return true
}

// Why resume starts Pi: to deliver what is held, because the person woke
// it, or only to make an owed recap (recap_resting_linux.go).
type startKind int

const (
	startHeldSend startKind = iota
	startWake
	startRecap
	startAutoWake // Habitat's own wake (wake_linux.go)
)

// resume proves that the browser may own this native session again and starts
// a Pi child on it. Caller holds the proof permit. The new handle replaces old
// and inherits its spent IDs, receipts and held messages, so nothing sent
// before the start is lost or can be sent twice. It is ready once Pi answers.
// A wake keeps the child running without anything to deliver.
func (c *ConversationController) resume(id string, old *conversation, kind startKind) (*conversation, string) {
	owner, origin, ws, cwd, path, proved, eligibility := c.continuationProof(id)
	if eligibility != "eligible" {
		return nil, eligibility
	}
	c.mu.Lock()
	// A record-pressure eviction is not a competing writer. The native proof
	// still owns the lock; only inherit the old facts for that same origin.
	evicted := old != nil && old.recordEvicted && proved == nil && old.workspace == origin.Workspace && old.cwd == origin.Cwd
	c.mu.Unlock()
	if proved != old && !evicted {
		_ = ws.Close()
		_ = owner.release()
		return nil, "unproven"
	}
	defer func() {
		if owner != nil {
			_ = owner.release()
		}
	}()
	defer ws.Close()
	// The owner fence is held and no other writer was observed: only now
	// may a cut-off tail be quarantined, or Pi would append onto it.
	if problem := c.readyNativeTail(path, id, cwd); problem != "" {
		return nil, problem
	}
	// The owner fence is still held. Establish the pre-existing native keys
	// before starting Pi so the first settlement emits only this turn's new
	// entries, not the entire continued session into the shared replay ring.
	published, err := existingHistoryKeys(path, c.cfg.UID, id, cwd)
	if err != nil {
		return nil, "unproven"
	}
	// A recap the person did not ask for never stops another Pi for room:
	// it takes the reserved background place (background_linux.go).
	if kind != startRecap {
		c.makeRoom(context.Background())
	}
	c.mu.Lock()
	// Another create or continuation may have run while history was read.
	// The owner fence still excludes another native writer for this ID.
	if c.closed || (c.sessions[id] != old && !(c.sessions[id] == nil && old != nil && old.recordEvicted)) {
		c.mu.Unlock()
		return nil, "unproven"
	}
	// A message or command the person sent while history was read starts
	// their own Pi; a recap start must not take it over.
	if kind == startRecap && old != nil && (old.state != "stopped" || len(old.held) > 0 || old.bash.active()) {
		c.mu.Unlock()
		return nil, "controlled"
	}
	if kind == startRecap && !c.backgroundSlotFree() || kind != startRecap && c.liveCount() >= c.liveLimit() {
		c.mu.Unlock()
		return nil, "capacity_exceeded"
	}
	if c.sessions[id] == nil && !c.makeRecordRoom() {
		c.mu.Unlock()
		return nil, "session_records_exhausted"
	}
	if !c.admits(ws, cwd) {
		c.mu.Unlock()
		return nil, "unproven"
	}
	prefix, err := c.piArgs()
	if err != nil {
		c.mu.Unlock()
		return nil, "source_unavailable"
	}
	// The rest this start ends, for the agent's catch-up. A start that
	// follows a turn told in this daemon ends no rest.
	woke, _, resting := c.restOf(old)
	if !resting {
		woke = restFact{}
	}
	env := append([]string{agentPath(c.home), "USER=" + c.cfg.Username}, restEnv(woke)...)
	p, err := launchPiRPCSession(c.runtime.Node, prefix, c.home, cwd, env, owner, ws, path, origin.Workspace)
	if err != nil {
		c.mu.Unlock()
		return nil, "source_unavailable"
	}
	// Continuation is not a new conversation: seed a bounded native excerpt for
	// explicit regeneration, but never restart the first/third auto schedule.
	s := &conversation{id: id, workspace: origin.Workspace, cwd: cwd, rpc: p, owner: owner, state: "starting", ack: "uncertain", lastUsed: time.Now(), events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool), publishedHistory: published, historyPath: path, acceptedMessages: 4, firstText: firstPrompt(readNativeHeader(path, c.cfg.UID), c.cfg.UID)}
	if old != nil {
		s.commands = old.commands
		s.receipts = old.receipts
		s.command = old.command
		s.held, s.heldChoice, s.lazy, s.interrupted = old.held, old.heldChoice, old.lazy, old.interrupted
		s.bash = old.bash
		old.held, old.heldChoice, old.bash = nil, nil, nil
	}
	s.wokeFrom = woke
	if kind != startHeldSend {
		s.lazy = false
	}
	delete(c.recapRecoveryFailures, id)
	s.recapOnly = kind == startRecap
	s.backgroundSlot = kind == startRecap
	s.autoWake = kind == startAutoWake
	c.sessions[id] = s
	if c.journal != nil {
		c.journal.reset("pi:"+id, "idle")
		c.journal.appendInvalidation("pi:" + id)
	}
	owner = nil // the child and watcher now own this lock
	c.mu.Unlock()
	go c.watch(s)
	go c.drain(s)
	go c.watchProcesses(s)
	go c.awaitReady(s)
	return s, ""
}

// A continuation has already fenced and reconciled this native file. Seed
// only its existing active-branch entries; the next settlement must not
// flood the per-user event ring with old history.
func existingHistoryKeys(path string, uid int, id, cwd string) (map[string]bool, error) {
	// Every key of the branch, without projecting: a key the browser never
	// shows is never published either, so marking it is harmless.
	native := readNativeRetaining(path, uid, func(id string, _ func() historyEntry) (historyEntry, bool) { return historyEntry{Key: id}, true })
	if native.cutOff || native.state != "readable" || native.id != id || native.cwd != cwd {
		return nil, errors.New("native history changed before continuation")
	}
	keys := make(map[string]bool, len(native.entries))
	for _, entry := range native.entries {
		keys[entry.Key] = true
	}
	return keys, nil
}

// Pi's settlement notification carries no persistent entry identity. Read the
// mapped UID's checked JSONL instead; never turn an RPC message into history.
// A failed/unstable read invalidates the view rather than claiming settlement.
func (c *ConversationController) publishNativeHistory(s *conversation) string {
	c.mu.Lock()
	turn := s.turnGeneration
	c.mu.Unlock()
	return c.publishNativeHistoryForTurn(s, turn)
}
func (c *ConversationController) publishNativeCommands(s *conversation) {
	c.mu.Lock()
	turn := s.turnGeneration
	c.mu.Unlock()
	c.publishNativeHistoryForTurnKind(s, turn, "bash")
}

func (c *ConversationController) publishNativeHistoryForTurn(s *conversation, turn uint64) string {
	return c.publishNativeHistoryForTurnKind(s, turn, "")
}

func (c *ConversationController) publishNativeHistoryForTurnKind(s *conversation, turn uint64, kind string) string {
	projectionCtx, cancelProjection := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancelProjection()
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + s.id)
		}
		return ""
	}
	for _, header := range sessions {
		if header.id != s.id || header.cwd != s.cwd || header.state != "readable" {
			continue
		}
		// Only what is not yet published is kept; the check under the lock
		// below still decides, since a racing publication may add keys.
		c.mu.Lock()
		published := maps.Clone(s.publishedHistory)
		c.mu.Unlock()
		native := readNativeRetaining(header.path, c.cfg.UID, func(id string, project func() historyEntry) (historyEntry, bool) {
			if published[id] {
				return historyEntry{}, false
			}
			e := project()
			return e, e.Kind != "" && (kind == "" || e.Kind == kind)
		})
		if native.state != "readable" || native.id != s.id || native.cwd != s.cwd {
			break
		}
		c.mu.Lock()
		if c.sessions[s.id] != s || c.closed || s.turnGeneration != turn {
			c.mu.Unlock()
			return ""
		}
		if s.publishedHistory == nil {
			s.publishedHistory = make(map[string]bool)
		}
		fresh := make([]historyEntry, 0)
		for _, entry := range native.entries {
			// A bash reply during an assistant turn must not publish or mark
			// that turn's entries: settlement still owns their publication.
			if kind != "" && entry.Kind != kind {
				continue
			}
			if s.publishedHistory[entry.Key] {
				continue
			}
			fresh = append(fresh, entry)
		}
		c.mu.Unlock()
		lastKey := ""
		for _, entry := range fresh {
			if entry.Kind == "assistant" {
				lastKey = entry.Key
			}
			inline(&native, &entry)
			enrichProcessEntry(projectionCtx, c.home, native, &entry)
			entry.NativeRevision = native.revision
			// Continuation can replace a reaped handle while native reads
			// complete. Never publish a superseded controller's tail.
			c.mu.Lock()
			if c.sessions[s.id] != s || c.closed || s.turnGeneration != turn {
				c.mu.Unlock()
				return ""
			}
			s.publishedHistory[entry.Key] = true
			if c.journal != nil {
				c.journal.nativeEntry("pi:"+s.id, entry)
			}
			c.mu.Unlock()
		}
		return lastKey
	}
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
	return ""
}
