//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// Messages sent before Pi runs are held by the daemon, in order, under the
// browser's command IDs. When Pi is ready it receives their joined text as one
// prompt. Stop before that returns exactly the held texts. A failed start keeps
// them for a retry. Like receipts, they exist only in this daemon incarnation:
// after a restart their outcome is unknown and they are never resent.
const (
	maxHeldMessages = 32
	// The joined text is one native prompt, so it shares the prompt limit.
	maxHeldBytes = 65536
	// Pi's own start includes extension and catalog initialization. Nothing waits
	// on this synchronously; it only bounds how long held messages wait. It is
	// the RPC layer's longest correlated wait.
	piReadyTimeout = 30 * time.Second
)

// notRunning reports a handle without a ready Pi child. Caller holds c.mu.
func notRunning(s *conversation) bool {
	return s.dead || s.state == "starting" || s.state == "start_failed" || s.state == "stopped"
}

// stoppedState names a closed handle: stopped once its direct child is reaped,
// uncertain while it might still run.
func stoppedState(s *conversation) string {
	select {
	case <-s.rpc.exited:
		return "stopped"
	default:
		return "uncertain"
	}
}

// stoppedRPC stands in for a child that has not been launched in this daemon
// incarnation. It is already reaped, so every control path treats it as ended.
func stoppedRPC() *piRPC {
	p := &piRPC{exited: make(chan struct{}), done: make(chan struct{}), frames: make(chan json.RawMessage), events: make(chan json.RawMessage)}
	close(p.exited)
	close(p.done)
	return p
}

func heldView(held []heldMessage) []map[string]string {
	view := make([]map[string]string, 0, len(held))
	for _, h := range held {
		view = append(view, map[string]string{"command_id": h.id, "text": h.text})
	}
	return view
}

// heldFailed tells the event stream that the start failed while the messages
// are still held. Caller holds c.mu.
func (c *ConversationController) heldFailed(s *conversation) {
	if c.journal == nil {
		return
	}
	for _, h := range s.held {
		c.journal.appendEvent("command.changed", "pi:"+s.id, map[string]string{"client_command_id": h.id, "acceptance": "pending", "execution": "failed", "error_code": "pi_start_failed"})
	}
	c.journal.appendInvalidation("pi:" + s.id)
}

// holdLocked admits one message into the held queue and starts Pi when nothing
// is starting it yet. Caller holds c.mu; holdLocked releases it.
func (c *ConversationController) holdLocked(w http.ResponseWriter, s *conversation, message, commandID string, choice *piStartupChoice) {
	size := len(message)
	for _, h := range s.held {
		size += len(h.text) + 2
	}
	if c.closed || c.runtime == nil || s.state == "stopping" || s.commands[commandID] || len(s.commands) >= maxConversationCommands || len(s.held) >= maxHeldMessages || size > maxHeldBytes {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	// The first-message model intent belongs only to a fresh, still-empty child.
	if choice != nil && (!s.created || s.acceptedMessages != 0 || len(s.commands) != 0 || len(s.held) != 0) {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	s.commands[commandID] = true
	s.held = append(s.held, heldMessage{id: commandID, text: message})
	if choice != nil {
		s.heldChoice = choice
	}
	c.receipt(s, commandID, "held")
	start := s.state != "starting"
	if start {
		s.state = "starting"
		s.startProblem = ""
		s.lazy = true
	}
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
	c.mu.Unlock()
	if start {
		go c.startHeld(s)
	}
	historyJSON(w, map[string]any{"schema_version": 1, "command_id": commandID, "state": "held"})
}

// startHeld starts Pi for a handle without a running child. A conversation
// with native history must pass the same ownership proof as continuation; a
// conversation created in this incarnation that has no native file yet is
// started fresh under its own ID.
func (c *ConversationController) startHeld(s *conversation) {
	problem := ""
	if s.created && !c.nativeFileExists(s.id) {
		problem = c.relaunchFresh(s)
	} else if release, ok := c.proofPermit(context.Background()); !ok {
		problem = "source_unavailable"
	} else {
		_, problem = c.resume(s.id, s)
		release()
	}
	if problem == "" {
		return
	}
	c.mu.Lock()
	if c.sessions[s.id] == s && s.state == "starting" {
		s.state = "start_failed"
		s.startProblem = problem
		c.heldFailed(s)
	}
	c.mu.Unlock()
}

func (c *ConversationController) nativeFileExists(id string) bool {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		return true // unknown: take the path that requires a native proof
	}
	for _, n := range sessions {
		if n.id == id {
			return true
		}
	}
	return false
}

// relaunchFresh starts a new child for a conversation created in this daemon
// incarnation whose earlier child ended before Pi wrote any history.
func (c *ConversationController) relaunchFresh(old *conversation) string {
	ws, cwd, err := c.workspaceFD(old.workspace)
	if err != nil {
		return "unproven"
	}
	defer ws.Close()
	if cwd != old.cwd {
		return "unproven"
	}
	select {
	case <-old.rpc.exited:
		_ = old.owner.release()
	default:
		return "writer_present"
	}
	owner, err := acquirePiOwnership(c.home, old.id)
	if err != nil {
		return "writer_present"
	}
	releaseOwner := true
	defer func() {
		if releaseOwner {
			_ = owner.release()
		}
	}()
	if err := owner.markBrowser(old.workspace, cwd); err != nil {
		return "source_unavailable"
	}
	c.makeRoom(context.Background())
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed || c.sessions[old.id] != old || old.state != "starting" {
		return "unproven"
	}
	if c.liveCount() >= maxLiveConversations {
		return "capacity_exceeded"
	}
	if !c.admits(ws, cwd) {
		return "unproven"
	}
	prefix, err := c.piArgs()
	if err != nil {
		return "source_unavailable"
	}
	if old.launchChoice != nil {
		prefix = append(prefix, "--provider", old.launchChoice.Provider, "--model", old.launchChoice.Model)
		if old.launchChoice.Thinking != "" {
			prefix = append(prefix, "--thinking", old.launchChoice.Thinking)
		}
	}
	p, err := launchPiRPCCommand(c.runtime.Node, prefix, c.home, cwd, []string{agentPath(c.home), "USER=" + c.cfg.Username}, owner, ws)
	if err != nil {
		return "source_unavailable"
	}
	s := &conversation{id: old.id, workspace: old.workspace, cwd: cwd, rpc: p, owner: owner, state: "starting", created: true, lazy: old.lazy, lastUsed: time.Now(), launchChoice: old.launchChoice, startupChoice: old.launchChoice, events: make([]json.RawMessage, 0, 64), commands: old.commands, receipts: old.receipts, command: old.command, held: old.held, heldChoice: old.heldChoice}
	old.held, old.heldChoice = nil, nil
	c.sessions[old.id] = s
	releaseOwner = false
	if c.journal != nil {
		c.journal.reset("pi:"+s.id, "idle")
		c.journal.appendInvalidation("pi:" + s.id)
	}
	go c.watch(s)
	go c.drain(s)
	go c.watchProcesses(s)
	go c.awaitReady(s)
	return ""
}

// awaitReady observes the new child's native state, then delivers what was
// held meanwhile. A lazily started Pi with nothing left to deliver (its
// messages were taken back) is closed again: Stop before Pi runs leaves no Pi.
func (c *ConversationController) awaitReady(s *conversation) {
	initial, err := s.rpc.requestQueue("get_state", "", piReadyTimeout)
	c.mu.Lock()
	if c.sessions[s.id] != s || s.state != "starting" || s.startupCancelled {
		c.mu.Unlock()
		return
	}
	if err != nil || !initial.Accepted || s.dead {
		// EOF is not a reap: publishing failure first lets an immediate retry
		// race the old child (and its writer lock). Finish bounded cleanup
		// before making the held messages available for another start.
		c.mu.Unlock()
		_ = s.rpc.close()
		c.mu.Lock()
		if c.sessions[s.id] == s && s.state == "starting" && !s.startupCancelled {
			s.state = "start_failed"
			s.startProblem = "pi_start_failed"
			c.heldFailed(s)
		}
		c.mu.Unlock()
		return
	}
	if initial.Choice != nil {
		s.startupChoice = initial.Choice
	}
	s.state = "idle"
	if s.runActive {
		s.state = "accepted"
	}
	unneeded := s.lazy && len(s.held) == 0 && s.state == "idle"
	if unneeded {
		s.state = "stopping"
	}
	// Take the held batch in the same critical section that makes the child
	// ready, so no direct send can be admitted ahead of it.
	batch, ok := c.takeHeldLocked(s)
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
	c.mu.Unlock()
	if unneeded {
		c.closeUnneeded(s)
		return
	}
	if ok {
		c.finishPrompt(s, "send", batch.ids, batch.text, batch.choice, batch.oldState, batch.wasSettled)
	}
}

type heldBatch struct {
	ids            []string
	text, oldState string
	choice         *piStartupChoice
	wasSettled     bool
}

func (c *ConversationController) closeUnneeded(s *conversation) {
	_ = s.rpc.close()
	c.mu.Lock()
	if s.state == "stopping" {
		s.state = stoppedState(s)
	}
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
	c.mu.Unlock()
}

// takeHeldLocked moves every held message into one pending native prompt.
// Their command IDs share that prompt's correlated receipt. Caller holds c.mu
// and calls finishPrompt after unlocking when ok.
func (c *ConversationController) takeHeldLocked(s *conversation) (heldBatch, bool) {
	if c.sessions[s.id] != s || c.closed || len(s.held) == 0 || (s.state != "idle" && s.state != "rejected") || s.aborting || s.dead || s.rpc.overflow.Load() {
		return heldBatch{}, false
	}
	b := heldBatch{choice: s.heldChoice, oldState: s.state, wasSettled: s.settled}
	texts := make([]string, 0, len(s.held))
	for _, h := range s.held {
		b.ids = append(b.ids, h.id)
		texts = append(texts, h.text)
	}
	b.text = strings.Join(texts, "\n\n")
	s.held, s.heldChoice, s.lazy = nil, nil, false
	c.beginPrompt(s, "send", b.ids)
	return b, true
}

// deliverHeld sends what is still held once Pi is idle again.
func (c *ConversationController) deliverHeld(s *conversation) {
	c.mu.Lock()
	b, ok := c.takeHeldLocked(s)
	c.mu.Unlock()
	if ok {
		c.finishPrompt(s, "send", b.ids, b.text, b.choice, b.oldState, b.wasSettled)
	}
}

// cancelHeld removes every held message and returns exactly those texts, in
// order. Messages Pi has already taken are not returned: their receipts say so.
// A Pi started only to deliver them is stopped; a new conversation's own start
// continues.
func (c *ConversationController) cancelHeld(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		CommandID string `json:"command_id"`
	}
	if decodeControl(r, &body, 1024) != nil || !sessionIDPattern.MatchString(body.CommandID) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil {
		c.mu.Unlock()
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if c.closed || s.commands[body.CommandID] || len(s.commands) >= maxConversationCommands {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	s.commands[body.CommandID] = true
	returned := heldView(s.held)
	for _, h := range s.held {
		c.receipt(s, h.id, "cancelled")
	}
	s.held, s.heldChoice = nil, nil
	stopChild := false
	switch {
	case s.state == "start_failed" || s.state == "starting" && s.dead:
		s.startupCancelled = true
		s.state = "stopped"
		s.startProblem = ""
	case s.state == "starting" && s.lazy && !s.dead:
		s.startupCancelled = true
		s.state = "stopping"
		stopChild = true
	}
	// A lazy start still proving ownership has no child yet; awaitReady closes
	// the child it launches because nothing is left to deliver.
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + id)
	}
	c.mu.Unlock()
	if stopChild {
		go c.closeUnneeded(s)
	}
	historyJSON(w, map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": "accepted", "returned": returned})
}

// resumableOrigin reads the browser-origin marker of a conversation without
// taking its lock and checks that its workspace is still the same directory.
// It decides only what the browser may offer; a start repeats the full proof.
func (c *ConversationController) resumableOrigin(id string) (browserOrigin, error) {
	origin, err := peekBrowserOrigin(c.home, id)
	if err != nil {
		return origin, err
	}
	ws, cwd, err := c.workspaceFD(origin.Workspace)
	if err != nil {
		return origin, err
	}
	_ = ws.Close()
	if cwd != origin.Cwd {
		return origin, errors.New("workspace changed")
	}
	return origin, nil
}

// peekBrowserOrigin reads the origin marker that a browser-started Pi child's
// lock file carries, without locking it. A terminal Pi never writes one.
func peekBrowserOrigin(home, id string) (browserOrigin, error) {
	var origin browserOrigin
	if !sessionIDPattern.MatchString(id) || !filepath.IsAbs(home) {
		return origin, errors.New("invalid origin context")
	}
	dir := filepath.Join(home, "pi-owners")
	info, err := os.Lstat(dir)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return origin, errors.New("no browser origin")
	}
	if uid, ok := fileOwner(info); !ok || uid != os.Geteuid() {
		return origin, errors.New("origin directory mismatch")
	}
	fd, err := unix.Open(filepath.Join(dir, id+".lock"), unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_CLOEXEC|unix.O_NONBLOCK, 0)
	if err != nil {
		return origin, errors.New("no browser origin")
	}
	f := os.NewFile(uintptr(fd), "origin")
	defer f.Close()
	fi, err := f.Stat()
	if err != nil || !fi.Mode().IsRegular() {
		return origin, errors.New("no browser origin")
	}
	if uid, ok := fileOwner(fi); !ok || uid != os.Geteuid() {
		return origin, errors.New("origin owner mismatch")
	}
	b, err := io.ReadAll(io.LimitReader(f, 1025))
	if err != nil || len(b) > 1024 || json.Unmarshal(b, &origin) != nil || !idPattern.MatchString(origin.Workspace) || !filepath.IsAbs(origin.Cwd) {
		return browserOrigin{}, errors.New("no browser origin")
	}
	return origin, nil
}

// stoppedStatus describes a browser-started conversation without a Pi child in
// this daemon incarnation: readable native history and a composer that will
// start Pi on send. Reading it never starts or reserves anything.
func (c *ConversationController) stoppedStatus(w http.ResponseWriter, id string) {
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
	path := ""
	for _, n := range sessions {
		if n.id != id {
			continue
		}
		if path != "" || n.cwd != origin.Cwd || n.state != "readable" {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		path = n.path
	}
	if path == "" {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	history, revision := "unavailable", ""
	if info, err := os.Lstat(path); err == nil && info.Mode().IsRegular() && info.Size() <= maxHistoryFile {
		if owner, ok := fileOwner(info); ok && owner == c.cfg.UID {
			history = "present"
			revision = opaque("rev_", fmt.Sprintf("%d:%d:%d", info.Size(), info.ModTime().UnixNano(), info.Mode()))
		}
	}
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": origin.Workspace, "state": "stopped", "run_active": false, "startup_choice": nil, "continuation": "unproven", "command_id": "", "ack": "", "send_receipt": "", "turn_settled": nil, "auth_error": "", "pending_question": nil, "event_cursor": 0, "events": []json.RawMessage{}, "event_loss": false, "native_history": history, "native_revision": revision, "history_query": "/api/v1/agents/pi:" + id + "/history", "queue": map[string]any{"revision": 0, "steering": []string{}, "follow_up": []string{}}, "held": []map[string]string{}, "start_problem": ""})
}
