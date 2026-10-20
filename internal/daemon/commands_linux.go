//go:build linux

package daemon

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"syscall"
	"time"
)

// The composer's `/` list is Pi's own `get_commands`: extension commands,
// prompt templates and skills, already filtered by Pi's project trust. A
// running Pi answers it. Without one, a short-lived list-only Pi
// (`--no-session`) is started in the workspace as the person, asked once and
// ended: it starts no conversation and writes no session, so reading still
// never starts a conversation's Pi (Jari, 2026-10-19). Nothing is cached.

const WorkspaceCommandsPath = "/api/v1/workspaces/commands"

// commandHelperTimeout bounds one list-only Pi, start included. Pi's own
// start takes about a second.
const commandHelperTimeout = 15 * time.Second

// commandHelpers bounds concurrent list-only Pi processes per daemon.
var commandHelpers = make(chan struct{}, 2)

// Pi's llama manager explicitly refuses RPC mode. MCP, in contrast, has RPC
// status/subcommands using the dialogs and notifications we already relay.
// Keep the native inventory intact; the composer hides terminal-only entries.
var terminalOnlyCommands = map[string]bool{"llama": true}

func commandListView(source string, commands []piCommand) map[string]any {
	list := make([]map[string]any, 0, len(commands))
	for _, command := range commands {
		if command.Name == "oh-conversation-recap" && command.Source == "extension" {
			continue // the daemon's own recap command is not the person's
		}
		if len(list) >= maxPiCommands {
			break
		}
		list = append(list, map[string]any{"name": command.Name, "description": command.Description, "source": command.Source, "scope": command.Scope, "terminal_only": command.Source == "extension" && terminalOnlyCommands[command.Name]})
	}
	return map[string]any{"schema_version": 1, "answered_by": source, "commands": list}
}

// conversationCommands answers from the conversation's running Pi, or from a
// list-only Pi in its working directory when none runs.
func (c *ConversationController) conversationCommands(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[id]
	running := s != nil && !notRunning(s) && s.state != "stopping" && s.state != "uncertain" && !s.rpc.overflow.Load()
	workspace := ""
	if s != nil {
		workspace = s.workspace
	}
	c.mu.Unlock()
	if running {
		reply, err := s.rpc.requestQueue("get_commands", "", 4*time.Second)
		if err != nil || !reply.Accepted {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		historyJSON(w, commandListView("running", reply.Commands))
		return
	}
	if s == nil {
		origin, err := peekBrowserOrigin(c.home, id)
		if err != nil {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		workspace = origin.Workspace
	}
	c.helperCommands(w, r, workspace)
}

// WorkspaceCommands answers a new conversation's `/` list, before it has a Pi.
func (c *ConversationController) WorkspaceCommands() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(c.cfg, c.trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		q := r.URL.Query()
		id := q.Get("workspace_id")
		if r.Method != http.MethodGet || r.URL.Path != WorkspaceCommandsPath || r.URL.EscapedPath() != WorkspaceCommandsPath || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || len(q) != 1 || len(q["workspace_id"]) != 1 || !idPattern.MatchString(id) || r.URL.RawQuery != "workspace_id="+id {
			snapshotError(w, 400, "invalid_request")
			return
		}
		c.helperCommands(w, r, id)
	})
}

func (c *ConversationController) helperCommands(w http.ResponseWriter, r *http.Request, workspaceID string) {
	if c.runtime == nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	select {
	case commandHelpers <- struct{}{}:
		defer func() { <-commandHelpers }()
	default:
		snapshotError(w, 429, "capacity_exceeded")
		return
	}
	ws, _, err := c.workspaceFD(workspaceID)
	if err != nil {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	defer ws.Close()
	c.mu.Lock()
	prefix, err := c.piArgs()
	c.mu.Unlock()
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(commandHelperTimeout + 5*time.Second))
	ctx, cancel := context.WithTimeout(r.Context(), commandHelperTimeout)
	defer cancel()
	commands, ok := listOnlyPi(ctx, c.runtime.Node, prefix, c.home, ws, []string{agentPath(c.home), "USER=" + c.cfg.Username})
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	historyJSON(w, commandListView("helper", commands))
}

// listOnlyPi runs `pi --mode rpc --no-session` in the held workspace
// directory, asks `get_commands` and ends the process group. Pi's stderr goes
// to the null device; only the correlated reply is read.
func listOnlyPi(ctx context.Context, node string, prefix []string, home string, workspace *os.File, env []string) ([]piCommand, bool) {
	args := append(append([]string{}, prefix...), "--mode", "rpc", "--no-session")
	cmd := exec.Command(node, args...)
	cmd.ExtraFiles = []*os.File{workspace}
	cmd.Dir = fmt.Sprintf("/proc/%d/fd/%d", os.Getpid(), workspace.Fd())
	cmd.Env = append(append([]string(nil), env...), "HOME="+home)
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGKILL, Setpgid: true}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, false
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, false
	}
	if cmd.Start() != nil {
		return nil, false
	}
	pid := cmd.Process.Pid
	exited := make(chan struct{})
	go func() { _ = cmd.Wait(); close(exited) }()
	defer func() {
		_ = stdin.Close()
		_ = syscall.Kill(-pid, syscall.SIGTERM)
		select {
		case <-exited:
		case <-time.After(2 * time.Second):
			_ = syscall.Kill(-pid, syscall.SIGKILL)
			<-exited
		}
	}()
	type result struct {
		commands []piCommand
		ok       bool
	}
	done := make(chan result, 1)
	go func() {
		if _, err := stdin.Write([]byte(`{"id":"oh-list","type":"get_commands"}` + "\n")); err != nil {
			done <- result{}
			return
		}
		scanner := bufio.NewScanner(stdout)
		scanner.Buffer(make([]byte, 4096), 1<<20)
		for scanner.Scan() {
			var response struct {
				ID      string          `json:"id"`
				Type    string          `json:"type"`
				Command string          `json:"command"`
				Success bool            `json:"success"`
				Data    json.RawMessage `json:"data"`
			}
			if json.Unmarshal(scanner.Bytes(), &response) != nil || response.Type != "response" || response.ID != "oh-list" {
				continue // Pi's own events before the reply
			}
			if !response.Success || response.Command != "get_commands" {
				done <- result{}
				return
			}
			commands, ok := parsePiCommands(response.Data)
			done <- result{commands, ok}
			return
		}
		done <- result{}
	}()
	select {
	case got := <-done:
		return got.commands, got.ok
	case <-ctx.Done():
		return nil, false
	case <-exited:
		select {
		case got := <-done:
			return got.commands, got.ok
		case <-time.After(500 * time.Millisecond):
			return nil, false
		}
	}
}
