//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"time"
)

// bashRun is a conversation's one `!` command as the browser typed it. Like
// held messages and receipts it is control state of this daemon incarnation
// only: the command's output and result are Pi's `bashExecution` entry in its
// own history, which the history reader already renders.
//
// One command at a time per conversation, as in Pi's TUI. A command typed
// while Pi is not running waits for the Pi it starts (held); a start that
// fails or is cancelled leaves it not_started, never queued for a retry.
type bashRun struct {
	commandID, command string
	excludeFromContext bool
	state              string // held, running, finished, cancelled, failed, not_started, uncertain
	exitCode           *int
	truncated          bool
	started            time.Time
	aborting           bool
	// writing is set by the one runBash that writes the request; wrote closes
	// once that write has returned. A Stop before the write keeps the command
	// from running; a Stop during it waits, so abort_bash cannot overtake it.
	writing bool
	wrote   chan struct{}
}

// active is a command still to come or under way. A nil run is not active.
func (b *bashRun) active() bool {
	return b != nil && (b.state == "held" || b.state == "running")
}

// view is the status field. Caller holds c.mu.
func (b *bashRun) view() map[string]any {
	if b == nil {
		return nil
	}
	v := map[string]any{"command_id": b.commandID, "command": b.command, "exclude_from_context": b.excludeFromContext, "state": b.state, "truncated": b.truncated}
	if b.exitCode != nil {
		v["exit_code"] = *b.exitCode
	}
	if !b.started.IsZero() {
		v["started_at"] = b.started.UTC().Format(time.RFC3339Nano)
	}
	return v
}

// startCommand relays a typed `!command` (or `!!command`) to the
// conversation's Pi as RPC `bash`. It runs as the person, in the
// conversation's working directory, with the authority Pi's own bash tool
// has. Like a send it starts a stopped conversation's Pi after the same
// ownership proof; reading never does.
func (c *ConversationController) startCommand(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		Command            string `json:"command"`
		CommandID          string `json:"command_id"`
		ExcludeFromContext bool   `json:"exclude_from_context"`
	}
	if decodeControl(r, &body, maxBashCommand+512) != nil || !validBashCommand(body.Command) || !sessionIDPattern.MatchString(body.CommandID) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	missing := c.sessions[id] == nil
	c.mu.Unlock()
	var origin *browserOrigin
	if missing {
		if o, err := c.resumableOrigin(id); err == nil {
			origin = &o
		}
	}
	archiveState := "active"
	if c.home != "" {
		annotations, annotationErr := loadVisibility(c.home)
		archiveState = archiveFact(annotations, annotationErr, "pi:"+id)
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil && origin != nil && !c.closed && len(c.sessions) < 128 {
		s = &conversation{id: id, workspace: origin.Workspace, cwd: origin.Cwd, rpc: stoppedRPC(), state: "stopped", dead: true, events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool)}
		c.sessions[id] = s
	}
	if s == nil {
		c.mu.Unlock()
		snapshotError(w, 409, "read_only_history")
		return
	}
	if s.bash.active() {
		c.mu.Unlock()
		snapshotError(w, 409, "command_running")
		return
	}
	// A reaped child's stream always ends in a read error, so a lost frame
	// only blocks a command for a Pi that still runs.
	if archiveState != "active" || c.closed || c.runtime == nil || s.state == "stopping" || s.state == "uncertain" || (!notRunning(s) && s.rpc.overflow.Load()) || s.commands[body.CommandID] || len(s.commands) >= maxConversationCommands {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	s.commands[body.CommandID] = true
	run := &bashRun{commandID: body.CommandID, command: body.Command, excludeFromContext: body.ExcludeFromContext, state: "held", wrote: make(chan struct{})}
	s.bash = run
	s.lastUsed = time.Now()
	// Decide here, under the lock: once it is released a held command may
	// already be dispatched by awaitReady.
	start, dispatch := false, false
	if notRunning(s) {
		if s.state != "starting" {
			s.state = "starting"
			s.startProblem = ""
			s.lazy = true
			start = true
		}
	} else {
		run.state = "running"
		run.started = time.Now()
		dispatch = true
	}
	c.invalidateLocked(s)
	c.mu.Unlock()
	if start {
		go c.startHeld(s)
	}
	if dispatch {
		go c.runBash(s, run)
	}
	historyJSON(w, map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": map[bool]string{true: "running", false: "held"}[dispatch]})
}

// runBash writes the request and waits for Pi's reply, which comes when the
// command ends. A lost write or a Pi that ends first leaves the outcome
// uncertain; nothing is repeated.
func (c *ConversationController) runBash(s *conversation, run *bashRun) {
	c.mu.Lock()
	if s.bash != run || run.state != "running" || run.writing {
		c.mu.Unlock()
		return // taken back before the write, or already written
	}
	run.writing = true
	c.mu.Unlock()
	reply, err := s.rpc.startBash(run.command, run.excludeFromContext)
	close(run.wrote)
	if err != nil {
		c.mu.Lock()
		if s.bash == run {
			run.state = "uncertain"
		}
		c.invalidateLocked(s)
		c.mu.Unlock()
		return
	}
	var outcome bashOutcome
	ok := false
	select {
	case frame := <-reply:
		outcome, ok = parseBashReply(frame)
	case <-s.rpc.done:
		// EOF may precede consumption of the ordered event queue. Let drain
		// deliver any queued completion before declaring the result unknown.
		if s.rpc.eventsDrained != nil {
			<-s.rpc.eventsDrained
		}
		select {
		case frame := <-reply:
			outcome, ok = parseBashReply(frame)
		default:
		}
	}
	if ok && (outcome.State == "finished" || outcome.State == "cancelled") {
		// Idle Pi saves bashExecution before replying. Publish it through the
		// native-entry path so live output is retired in both the event stream
		// and the snapshot tail. During a turn Pi defers it until agent_end,
		// whose existing publication handles that case.
		c.publishNativeCommands(s)
	}
	c.mu.Lock()
	if s.bash == run {
		run.aborting = false
		if ok {
			run.state, run.exitCode, run.truncated = outcome.State, outcome.ExitCode, outcome.Truncated
		} else {
			run.state = "uncertain"
		}
	}
	c.invalidateLocked(s)
	c.mu.Unlock()
}

// abortCommand stops the conversation's `!` command: a held one is simply
// not run, a running one gets Pi's `abort_bash`. It never touches Pi's turn.
func (c *ConversationController) abortCommand(w http.ResponseWriter, r *http.Request, id string) {
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
	run := s.bash
	if c.closed || !run.active() || run.aborting || s.commands[body.CommandID] || len(s.commands) >= maxConversationCommands {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	s.commands[body.CommandID] = true
	if run.state == "held" {
		run.state = "not_started"
		// A Pi started only for this command has nothing left to do.
		stopChild := s.state == "starting" && s.lazy && len(s.held) == 0 && !s.dead
		if stopChild {
			s.startupCancelled = true
			s.state = "stopping"
		}
		c.invalidateLocked(s)
		c.mu.Unlock()
		if stopChild {
			go c.closeUnneeded(s)
		}
		historyJSON(w, map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": "accepted"})
		return
	}
	if !run.writing {
		// Dispatched but not yet written: it never reaches Pi.
		run.state = "not_started"
		c.invalidateLocked(s)
		c.mu.Unlock()
		historyJSON(w, map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": "accepted"})
		return
	}
	run.aborting = true
	c.invalidateLocked(s)
	c.mu.Unlock()
	// Pi's abort_bash cancels only commands it already runs.
	select {
	case <-run.wrote:
	case <-time.After(5 * time.Second):
	}
	accepted, err := s.rpc.request("abort_bash", "", 4*time.Second)
	c.mu.Lock()
	if s.bash == run && run.state == "running" && (err != nil || !accepted) {
		run.aborting = false
	}
	c.invalidateLocked(s)
	c.mu.Unlock()
	switch {
	case err != nil:
		snapshotError(w, 503, "control_uncertain")
	case !accepted:
		snapshotError(w, 409, "control_uncertain")
	default:
		// Pi answers abort_bash once the cancellation is signalled; the bash
		// reply then reports the command as cancelled.
		historyJSON(w, map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": "accepted"})
	}
}

// invalidateLocked tells the browser to read the conversation's status again.
// Caller holds c.mu.
func (c *ConversationController) invalidateLocked(s *conversation) {
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
}
