//go:build linux

package daemon

import (
	"net/http"
	"os"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"time"
)

// Retitle a settled native history without granting terminal sessions browser
// control. Pi alone appends the name; this temporary RPC child is never exposed
// as a controllable conversation.
func (c *ConversationController) historyTitle(w http.ResponseWriter, r *http.Request, id string) {
	// Model generation and the temporary Pi child can exceed the ordinary
	// transport deadline; losing this reply would hide the native outcome.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(45 * time.Second))
	var in struct {
		WorkspaceID string `json:"workspace_id"`
	}
	if decodeControl(r, &in, 256) != nil || !idPattern.MatchString(in.WorkspaceID) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	// The browser picks this operation from the state it last saw, which can
	// lag the daemon's own: a Pi this daemon runs or is starting for the
	// conversation is the writer, so it is asked directly, as nameByHand does.
	c.mu.Lock()
	s := c.sessions[id]
	own := s != nil && (liveChild(s) || s.state == "starting" || s.state == "stopping")
	c.mu.Unlock()
	if own {
		c.titleLive(w, id)
		return
	}
	c.nameHistory(w, r, id, in.WorkspaceID, "")
}

// nameHistory proves a settled history has no writer before naming it. A
// manual name needs only Pi's session writer; generation keeps its RPC path.
func (c *ConversationController) nameHistory(w http.ResponseWriter, r *http.Request, id, workspaceID, given string) {
	operation := "history"
	if given != "" {
		operation = "given"
	}
	c.mu.Lock()
	available := !c.closed && c.runtime != nil
	c.mu.Unlock()
	if !available {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	ws, cwd, err := c.workspaceFD(workspaceID)
	if err != nil {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	defer ws.Close()
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	var native *nativeSession
	for i := range sessions {
		s := &sessions[i]
		if s.id == id {
			if native != nil || s.cwd != cwd || s.state != "readable" {
				snapshotError(w, 409, "control_uncertain")
				return
			}
			native = s
		}
	}
	if native == nil {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	path := native.path
	revision, err := reconciledNativeHistory(path, c.cfg.UID, id, cwd)
	if err != nil {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	c.mu.Lock()
	old := c.sessions[id]
	live := false
	if old != nil && old.rpc != nil {
		select {
		case <-old.rpc.exited:
		default:
			live = true
		}
	}
	c.mu.Unlock()
	if live {
		snapshotError(w, 409, "writer_conflict")
		return
	}
	switch c.piWriter(path, cwd) {
	case "writer_present":
		snapshotError(w, 409, "writer_conflict")
		return
	case "not_observed":
	default:
		snapshotError(w, 409, "control_uncertain")
		return
	}
	nameBefore, valid := nativeNameExact(*native, c.cfg.UID)
	if !valid {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	name := given
	if name == "" {
		text := latestNativeUserPrompt(path, c.cfg.UID, id, cwd)
		if text == "" {
			snapshotError(w, 409, "control_uncertain")
			return
		}
		model := latestNativeModel(path, c.cfg.UID, id, cwd)
		generate := func(text string) (string, error) { return c.generateTitle(text, model) }
		if c.fixture {
			if c.titleGenerator != nil {
				generate = c.titleGenerator
			} else {
				generate = func(string) (string, error) { return "Synteettinen otsikko", nil }
			}
		}
		// Model generation does not write native state. Do it outside the global
		// admission permit, then re-establish every precondition before Pi starts.
		generated, err := generate(text)
		if err != nil || !validTitle(generated) {
			reason := titleModelInvalid
			if err != nil {
				reason = titleReason(err)
			}
			diagnostic.New(os.Stderr, "daemon").Warn("conversation_title", "outcome", "failed", "operation", operation, "reason", string(reason))
			historyJSON(w, map[string]any{"schema_version": 1, "state": "failed", "reason": reason})
			return
		}
		name = generated
	}
	release, ok := c.proofPermit(r.Context())
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	defer release()
	c.mu.Lock()
	if c.closed || c.runtime == nil {
		c.mu.Unlock()
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	if old := c.sessions[id]; old != nil && old.rpc != nil {
		select {
		case <-old.rpc.exited:
			if old.owner != nil {
				_ = old.owner.release()
			}
		default:
		}
	}
	c.mu.Unlock()
	owner, err := acquirePiOwnership(c.home, id)
	if err != nil {
		snapshotError(w, 409, "writer_conflict")
		return
	}
	defer owner.release()
	if c.piWriter(path, cwd) != "not_observed" {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	current, valid := nativeNameExact(*native, c.cfg.UID)
	freshRevision, freshErr := reconciledNativeHistory(path, c.cfg.UID, id, cwd)
	writer := c.piWriter(path, cwd)
	if writer == "writer_present" {
		snapshotError(w, 409, "writer_conflict")
		return
	}
	if !valid || current != nameBefore || freshErr != nil || freshRevision != revision || writer != "not_observed" {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	var prefix []string
	if given == "" || c.fixture {
		prefix, err = c.piArgs()
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
	}
	// A deletion may have fenced or moved the workspace during generation.
	c.mu.Lock()
	if !c.admits(ws, cwd) {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	if given != "" && !c.fixture {
		c.mu.Unlock()
		if err := c.nameSettled(path, id, cwd, name, owner, ws); err != nil {
			diagnostic.New(os.Stderr, "daemon").Warn("conversation_title", "outcome", "failed", "operation", "given", "reason", "name_write_failed")
			historyJSON(w, map[string]any{"schema_version": 1, "state": "failed", "reason": "name_write_failed"})
			return
		}
		var cursor string
		if c.journal != nil {
			cursor = c.journal.appendInvalidation("pi:" + id)
		}
		historyJSON(w, map[string]any{"schema_version": 1, "state": "done", "event_cursor": cursor})
		return
	}
	p, err := launchPiRPCSession(c.runtime.Node, prefix, c.home, cwd, []string{agentPath(c.home), "USER=" + c.cfg.Username}, owner, ws, path, "")
	c.mu.Unlock()
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	// This is a cold Pi, unlike a live controller's already-ready RPC child.
	// Native extension loading alone can exceed four seconds; include startup
	// in the acknowledgement budget, without retrying an uncertain write.
	accepted, err := p.request("set_session_name", name, 15*time.Second)
	_ = p.close() // Reap the temporary child before publishing an idle result.
	select {
	case <-p.exited:
	default:
		historyJSON(w, map[string]any{"schema_version": 1, "state": "failed", "reason": "name_write_failed"})
		return
	}
	if err != nil || !accepted {
		historyJSON(w, map[string]any{"schema_version": 1, "state": "failed", "reason": "name_write_failed"})
		return
	}
	var cursor string
	if c.journal != nil {
		cursor = c.journal.appendInvalidation("pi:" + id)
	}
	historyJSON(w, map[string]any{"schema_version": 1, "state": "done", "event_cursor": cursor})
}
