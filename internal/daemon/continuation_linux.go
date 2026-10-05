//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
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
	if _, err := reconciledNativeHistory(path, c.cfg.UID, id, cwd); err != nil {
		_ = ws.Close()
		return fail("unproven")
	}
	return owner, origin, ws, cwd, path, old, "eligible"
}

// continueEnded is explicit. The daemon requires its native ownership lock and
// browser-origin marker; a terminal history alone cannot grant control.
func (c *ConversationController) continueEnded(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength != 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	releasePermit, ok := c.proofPermit(r.Context())
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	defer releasePermit()
	owner, origin, ws, cwd, path, old, eligibility := c.continuationProof(id)
	if eligibility != "eligible" {
		switch eligibility {
		case "writer_present":
			snapshotError(w, 409, "writer_conflict")
		case "read_only_history":
			snapshotError(w, 409, "read_only_history")
		case "source_unavailable":
			snapshotError(w, 503, "native_source_unavailable")
		default:
			snapshotError(w, 409, "control_uncertain")
		}
		return
	}
	defer func() {
		if owner != nil {
			_ = owner.release()
		}
	}()
	defer ws.Close()
	// The owner fence is still held. Establish the pre-existing native keys
	// before starting Pi so the first settlement emits only this turn's new
	// entries, not the entire continued session into the shared replay ring.
	published, err := existingHistoryKeys(path, c.cfg.UID, id, cwd)
	if err != nil {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	c.mu.Lock()
	// Another create or continuation may have run while history was read.
	// The owner fence still excludes another native writer for this ID.
	active := 0
	for _, session := range c.sessions {
		select {
		case <-session.rpc.exited:
		default:
			active++
		}
	}
	if c.closed || c.sessions[id] != old {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	if active >= 4 || (old == nil && len(c.sessions) >= 128) {
		c.mu.Unlock()
		snapshotError(w, 429, "capacity_exceeded")
		return
	}
	p, err := launchPiRPCSession(c.runtime.Node, []string{filepath.Join(filepath.Dir(c.runtime.Entry), "bundle", "cli.js")}, c.home, cwd, []string{"PATH=/usr/bin:/bin", "USER=" + c.cfg.Username}, owner, ws, path)
	if err != nil {
		c.mu.Unlock()
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	// Continuation is not a new conversation: seed a bounded native excerpt for
	// explicit regeneration, but never restart the first/third auto schedule.
	s := &conversation{id: id, workspace: origin.Workspace, cwd: cwd, rpc: p, owner: owner, state: "idle", ack: "uncertain", events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool), publishedHistory: published, historyPath: path, acceptedMessages: 4, firstText: firstPrompt(readNativeHeader(path, c.cfg.UID), c.cfg.UID)}

	if old != nil {
		s.commands = old.commands
		s.receipts = old.receipts
		s.command = old.command
	}
	c.sessions[id] = s
	if c.journal != nil {
		c.journal.reset("pi:"+id, "idle")
		c.journal.appendInvalidation("pi:" + id)
	}
	owner = nil // the child and watcher now own this lock
	c.mu.Unlock()
	go c.watch(s)
	go c.drain(s)
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": origin.Workspace, "state": "idle", "prior_outcome": "uncertain"})
}

// A continuation has already fenced and reconciled this native file. Seed
// only its existing active-branch entries; the next settlement must not
// flood the per-user event ring with old history.
func existingHistoryKeys(path string, uid int, id, cwd string) (map[string]bool, error) {
	native := readNativeSettled(path, uid)
	if native.state != "readable" || native.id != id || native.cwd != cwd {
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
func (c *ConversationController) publishNativeHistoryForTurn(s *conversation, turn uint64) string {
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
		native := readNativeSettled(header.path, c.cfg.UID)
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
