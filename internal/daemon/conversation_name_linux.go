//go:build linux

package daemon

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
)

// nameByHand gives a conversation the person's own name. Pi writes it as its
// session_info, the same native name a generated title or Pi's own /name
// writes, so it shows wherever a title does. It wins over automatic titles
// because those never replace a name this handle did not generate
// (nameConversation); no record says who chose a name.
//
// A running Pi is told directly; one still starting writes it the moment it
// is ready; a settled history uses Pi's SessionManager without starting an agent.
func (c *ConversationController) nameByHand(w http.ResponseWriter, r *http.Request, id string) {
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(45 * time.Second))
	var in struct {
		WorkspaceID string `json:"workspace_id"`
		Name        string `json:"name"`
	}
	if decodeControl(r, &in, 1024) != nil || !idPattern.MatchString(in.WorkspaceID) || !validTitle(in.Name) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[id]
	live := false
	if s != nil && s.rpc != nil {
		select {
		case <-s.rpc.exited:
		default:
			live = true
		}
	}
	if !live {
		c.mu.Unlock()
		c.nameHistory(w, r, id, in.WorkspaceID, in.Name)
		return
	}
	switch {
	case c.closed || s.dead || s.state == "stopping" || s.startupCancelled:
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	case s.state == "starting":
		// awaitReady takes it in the critical section that makes Pi ready.
		s.pendingName = in.Name
		s.automaticName = ""
		c.mu.Unlock()
		historyJSON(w, map[string]any{"schema_version": 1, "state": "held"})
		return
	}
	c.mu.Unlock()
	failure, cursor := c.nameLive(s, in.Name)
	if failure != "" {
		diagnostic.New(os.Stderr, "daemon").Warn("conversation_title", "outcome", "failed", "operation", "given", "reason", string(failure))
		historyJSON(w, map[string]any{"schema_version": 1, "state": "failed", "reason": failure})
		return
	}
	historyJSON(w, map[string]any{"schema_version": 1, "state": "done", "event_cursor": cursor})
}

// writePendingName gives a just-ready Pi the name held while it started. It
// takes the name under nameMu, so a rename that lands after readiness either
// finds nothing left to supersede it or is written after it.
func (c *ConversationController) writePendingName(s *conversation) {
	c.nameMu.Lock()
	defer c.nameMu.Unlock()
	c.mu.Lock()
	name := s.pendingName
	s.pendingName = ""
	c.mu.Unlock()
	if name == "" {
		return
	}
	if failure, _ := c.writeGivenName(s, name); failure != "" {
		diagnostic.New(os.Stderr, "daemon").Warn("conversation_title", "outcome", "failed", "operation", "given", "reason", string(failure))
	}
}

// nameLive writes a given name through the handle's running Pi. Before Pi
// has a session file the name lives in Pi's memory, and Pi writes it with
// the first message; until then givenName lets the rail and header show it.
func (c *ConversationController) nameLive(s *conversation, name string) (titleFailure, string) {
	c.nameMu.Lock()
	defer c.nameMu.Unlock()
	return c.writeGivenName(s, name)
}

// The caller holds nameMu.
func (c *ConversationController) writeGivenName(s *conversation, name string) (titleFailure, string) {
	c.mu.Lock()
	live := !c.closed && c.sessions[s.id] == s && !s.dead && !s.rpc.overflow.Load()
	c.mu.Unlock()
	if !live {
		return titleControllerUnavailable, ""
	}
	accepted, err := s.rpc.request("set_session_name", name, 4*time.Second)
	if err != nil || !accepted {
		return titleNameWriteFailed, ""
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.sessions[s.id] == s {
		s.automaticName = ""
		s.givenName = name
		s.pendingName = "" // superseded by this one
	}
	var cursor string
	if c.journal != nil {
		cursor = c.journal.appendInvalidation("pi:" + s.id)
	}
	return "", cursor
}

//go:embed session_name_helper.mjs
var sessionNameHelper string

// The owner descriptor survives daemon loss until the native writer exits.
// Cancellation is deliberately independent of the HTTP connection: a lost
// response is not permission to repeat a write.
func (c *ConversationController) nameSettled(path, id, cwd, name string, owner *piOwnership, ws *os.File) error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, c.runtime.Node, "--input-type=module", "--eval", sessionNameHelper, c.runtime.Entry, c.runtime.Manifest, path, id, cwd)
	cmd.Env = []string{"HOME=" + c.home, "PI_OFFLINE=1", agentPath(c.home)}
	cmd.Dir = fmt.Sprintf("/proc/%d/fd/%d", os.Getpid(), ws.Fd())
	cmd.ExtraFiles = []*os.File{owner.file, ws}
	b, _ := json.Marshal(name)
	cmd.Stdin = bytes.NewReader(b)
	cmd.WaitDelay = time.Second
	return cmd.Run()
}
