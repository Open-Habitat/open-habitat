//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// The release binary is the root-owned, read-only source: no persistent
// per-user prompt copy or settings mutation can drift from the product.
//
//go:embed host-context.md
var hostContext string

//go:embed local-files.mjs
var localFilesExtension string

// piRPC is a private, bounded native-protocol transport. The daemon's fresh
// browser-owned controller uses it; it does not fence a terminal TUI.
// A caller must not expose it as an agent capability until that fence exists.
type piRPC struct {
	processParentID, processWorkspace            string
	processSocket, processDir, processGeneration string
	cmd                                          *exec.Cmd
	in, out                                      *os.File
	mu                                           sync.Mutex           // serializes requests; does not guard close
	frames                                       chan json.RawMessage // correlated responses only
	events                                       chan json.RawMessage // bounded native events, consumed separately
	overflow                                     atomic.Bool          // an event was lost: never report acceptance as certain
	done                                         chan struct{}        // reader done, NOT process exit proof
	exited                                       chan struct{}        // direct child reaped independently of pipe EOF
	closing                                      atomic.Bool
	launched                                     int64 // Unix ms before Pi started: earlier process starts belong to an earlier Pi
	poisoned                                     bool  // guarded by mu
	// A `bash` reply arrives only when its command ends, long after other
	// correlated requests. Its ID is registered here before the write, and the
	// reader routes that one response through the event drain, past the
	// ordinary request queue (bashMu), so publication cannot overtake output.
	bashMu        sync.Mutex
	bashReplies   map[string]chan json.RawMessage
	eventsDrained chan struct{} // controller consumed all queued native events
}

// launchPiRPC is a fixture bridge. The production controller requires a fresh
// ownership ID and workspace descriptor. Resume is refused entirely.
func launchPiRPC(binary, home, cwd, sessionFile string, env []string) (*piRPC, error) {
	return launchPiRPCWithOwnership(binary, home, cwd, sessionFile, env, nil)
}

// launchPiRPCWithOwnership is an internal fixture-level bridge. Production
// uses launchPiRPCCommand with a checked workspace descriptor.
func launchPiRPCWithOwnership(binary, home, cwd, sessionFile string, env []string, owner *piOwnership) (*piRPC, error) {
	if home == "" || cwd == "" || binary == "" || !filepath.IsAbs(binary) || !filepath.IsAbs(home) || !filepath.IsAbs(cwd) || os.Geteuid() == 0 {
		return nil, errors.New("invalid Pi launch context or UID")
	}
	if sessionFile != "" {
		return nil, errors.New("resume requires native owner reconciliation")
	}
	return launchPiRPCCommand(binary, nil, home, cwd, env, owner, nil)
}

// launchPiRPCCommand only creates a fresh session. The generated ID is passed
// to Pi's --session-id (not --session, which can reopen an existing writer).
func launchPiRPCCommand(binary string, prefix []string, home, cwd string, env []string, owner *piOwnership, workspace *os.File) (*piRPC, error) {
	return launchPiRPCSession(binary, prefix, home, cwd, env, owner, workspace, "")
}

// Only the reconciled continuation path supplies a native session file.
func launchPiRPCSession(binary string, prefix []string, home, cwd string, env []string, owner *piOwnership, workspace *os.File, sessionFile string) (*piRPC, error) {
	args := append(append([]string{}, prefix...), "--mode", "rpc")
	if owner != nil {
		if owner.file == nil || !sessionIDPattern.MatchString(owner.id) {
			return nil, errors.New("Pi owner unavailable")
		}
		if sessionFile != "" {
			args = append(args, "--session", sessionFile)
		} else {
			args = append(args, "--session-id", owner.id)
		}
	}
	cmd := exec.Command(binary, args...)
	if workspace != nil {
		if owner == nil {
			return nil, errors.New("workspace requires ownership")
		}
		cmd.ExtraFiles = []*os.File{owner.file, workspace}
		// os/exec chdirs before installing ExtraFiles in the child. Resolve
		// the parent's held descriptor while Start is in progress instead.
		cmd.Dir = fmt.Sprintf("/proc/%d/fd/%d", os.Getpid(), workspace.Fd())
	} else {
		cmd.Dir = cwd
	}
	if owner != nil && workspace == nil {
		if owner.file == nil {
			return nil, errors.New("Pi owner lock unavailable")
		}
		// ExtraFiles preserves the lock across daemon crash for the child lifetime.
		cmd.ExtraFiles = []*os.File{owner.file}
	}
	cmd.Env = append(append([]string(nil), env...), "HOME="+home)
	if owner != nil && taskfleetCreatorSessionIDPattern.MatchString(owner.id) {
		cmd.Env = append(cmd.Env, "TASKFLEET_CREATOR_SESSION=pi:"+owner.id)
	}
	processDir, err := os.MkdirTemp("", "oh-process-")
	if err != nil {
		return nil, err
	}
	cleanupProcessDir := true
	defer func() {
		if cleanupProcessDir {
			_ = os.RemoveAll(processDir)
		}
	}()
	// Use Pi's native prompt-section hook. --append-system-prompt would
	// suppress the person's discovered APPEND_SYSTEM.md. This child-lifetime
	// artifact always comes from the release, never from a home/settings copy.
	contextJSON, err := json.Marshal(hostContext)
	if err != nil {
		return nil, err
	}
	contextPath := filepath.Join(processDir, "host-context.mjs")
	socketJSON, _ := json.Marshal(filepath.Join(processDir, "local-files.sock"))
	contextExtension := "const localFilesSocket = " + string(socketJSON) + ";\n" + localFilesExtension + "\nexport default function(pi) { registerLocalFiles(pi); pi.on('before_agent_start', (event) => { event.systemPromptOptions.sections.open_habitat = " + string(contextJSON) + "; }); }\n"
	if err := os.WriteFile(contextPath, []byte(contextExtension), 0400); err != nil {
		return nil, err
	}
	cmd.Args = append(cmd.Args, "--extension", contextPath)
	processSocket := filepath.Join(processDir, "bridge.sock")
	generation, ok := uuid()
	if !ok {
		return nil, errors.New("process generation unavailable")
	}
	cmd.Env = append(cmd.Env, "OH_PROCESS_SOCKET="+processSocket)
	for i, arg := range prefix {
		if i > 0 && prefix[i-1] == "--extension" && strings.HasSuffix(arg, "/@aliou/pi-processes/extensions/processes/index.ts") {
			cmd.Env = append(cmd.Env, "OH_PROCESS_PACKAGE="+filepath.Clean(filepath.Join(filepath.Dir(arg), "../../package.json")))
		}
	}
	stderrR, stderrW, stderrDone, err := storageDiagnosticPipe("pi_runtime")
	if err != nil {
		return nil, err
	}
	defer stderrW.Close()
	started := false
	defer func() {
		if !started {
			stderrR.Close()
		}
	}()
	cmd.Stderr = stderrW
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGKILL, Setpgid: true}
	outR, outW, err := os.Pipe()
	if err != nil {
		return nil, err
	}
	inR, inW, err := os.Pipe()
	if err != nil {
		outR.Close()
		outW.Close()
		return nil, err
	}
	cmd.Stdout, cmd.Stdin = outW, inR
	p := &piRPC{launched: time.Now().UnixMilli(), processWorkspace: cwd, processSocket: processSocket, processDir: processDir, processGeneration: generation, cmd: cmd, in: inW, out: outR, frames: make(chan json.RawMessage, 8), events: make(chan json.RawMessage, 128), eventsDrained: make(chan struct{}), done: make(chan struct{}), exited: make(chan struct{})}
	if owner != nil {
		p.processParentID = owner.id
	}
	if err = cmd.Start(); err != nil {
		inR.Close()
		inW.Close()
		outR.Close()
		outW.Close()
		return nil, err
	}
	cleanupProcessDir = false
	inR.Close()
	outW.Close()
	started = true
	go func() {
		_ = cmd.Wait()
		// Drain final diagnostics, but never wait on a detached inheritor's EOF.
		_ = stderrR.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
		<-stderrDone
		stderrR.Close()
		close(p.exited)
	}()
	go p.read()
	return p, nil
}

// read never waits for inherited stdout EOF to reap Pi. Closing the read FD
// breaks a blocked read even when a detached native tool retained its writer.
func (p *piRPC) read() {
	defer close(p.done)
	defer close(p.frames)
	defer close(p.events)
	reader := bufio.NewReaderSize(p.out, 64<<10)
	for {
		line, err := readPiFrame(reader, 32<<20)
		if err != nil {
			if err != io.EOF {
				p.overflow.Store(true)
			}
			break
		}
		line = bytes.TrimSuffix(line, []byte{'\r'})
		if !json.Valid(line) {
			p.overflow.Store(true)
			break
		}
		if len(line) > 1<<20 {
			var echo struct {
				Type    string `json:"type"`
				Message struct {
					Role       string `json:"role"`
					ToolCallID string `json:"toolCallId"`
					ToolName   string `json:"toolName"`
					IsError    bool   `json:"isError"`
				} `json:"message"`
				ToolCallID string `json:"toolCallId"`
				ToolName   string `json:"toolName"`
				IsError    bool   `json:"isError"`
			}
			if json.Unmarshal(line, &echo) != nil {
				p.overflow.Store(true)
				break
			}
			switch {
			case (echo.Type == "message_start" || echo.Type == "message_end") && (echo.Message.Role == "user" || echo.Message.Role == "toolResult"):
				line, _ = json.Marshal(map[string]any{"type": echo.Type, "message": map[string]any{"role": echo.Message.Role, "toolCallId": echo.Message.ToolCallID, "toolName": echo.Message.ToolName, "isError": echo.Message.IsError}})
			case echo.Type == "tool_execution_end" || echo.Type == "tool_execution_update":
				line, _ = json.Marshal(map[string]any{"type": echo.Type, "toolCallId": echo.ToolCallID, "toolName": echo.ToolName, "isError": echo.IsError})
			case echo.Type == "agent_end" || echo.Type == "turn_end":
				line, _ = json.Marshal(map[string]string{"type": echo.Type})
			default:
				p.overflow.Store(true)
				_ = p.in.Close()
				return
			}
		}
		frame := append(json.RawMessage(nil), line...)
		var envelope struct {
			Type string `json:"type"`
		}
		if json.Unmarshal(frame, &envelope) != nil || envelope.Type == "" {
			p.overflow.Store(true)
			break
		}
		var failure struct {
			Type    string `json:"type"`
			Error   string `json:"error"`
			Success *bool  `json:"success"`
			Message struct {
				Role         string `json:"role"`
				StopReason   string `json:"stopReason"`
				ErrorMessage string `json:"errorMessage"`
			} `json:"message"`
		}
		if json.Unmarshal(frame, &failure) == nil {
			if failure.Type == "response" && failure.Success != nil && !*failure.Success {
				_, _ = (&storageDiagnostics{operation: "pi_response"}).Write([]byte(failure.Error))
			}
			if failure.Type == "message_end" && failure.Message.Role == "assistant" && failure.Message.StopReason == "error" {
				_, _ = (&storageDiagnostics{operation: "pi_message_persistence"}).Write([]byte(failure.Message.ErrorMessage))
			}
		}
		queue := p.events
		if envelope.Type == "response" {
			queue = p.frames
			if p.isBashReply(frame) {
				// Completion follows its output through the same ordered queue.
				// Otherwise runBash can publish history before drain consumes
				// the last delta, resurrecting an already-saved live card.
				queue = p.events
			}
		}
		select {
		case queue <- frame:
		default:
			// Dropping a frame may lose the only evidence of prompt acceptance
			// or settlement. Poison the channel rather than claiming success.
			p.overflow.Store(true)
			_ = p.in.Close()
			return
		}
	}
	// Even a clean EOF is not proof of a completed prompt. A concurrent request
	// sees a closed channel and reports uncertainty.
	_ = p.in.Close()
}

// Native aggregate end events contain all messages from a run, including
// several image-bearing steers. Drain those echoes without retaining an
// unbounded line. Pi serializes the event type first; other oversized frames
// still poison the channel rather than silently losing receipt evidence.
func readPiFrame(reader *bufio.Reader, limit int) ([]byte, error) {
	var line []byte
	discardKind := ""
	for {
		part, err := reader.ReadSlice('\n')
		if discardKind == "" {
			if len(line)+len(part) <= limit {
				line = append(line, part...)
			} else {
				prefix := line
				if len(prefix) == 0 {
					prefix = part
				}
				decoder := json.NewDecoder(bytes.NewReader(prefix))
				opening, _ := decoder.Token()
				key, _ := decoder.Token()
				var kind string
				if opening != json.Delim('{') || key != "type" || decoder.Decode(&kind) != nil || (kind != "agent_end" && kind != "turn_end") {
					return nil, errors.New("oversized native frame")
				}
				discardKind, line = kind, nil
			}
		}
		if err == bufio.ErrBufferFull {
			continue
		}
		if err != nil {
			return nil, err
		}
		if discardKind != "" {
			return json.Marshal(map[string]string{"type": discardKind})
		}
		return bytes.TrimSuffix(line, []byte{'\n'}), nil
	}
}

type piReply struct {
	Choice       *piStartupChoice
	Accepted     bool
	RecapCommand bool
	Commands     []piCommand
	Steering     []string
	FollowUp     []string
}

// request serializes writes and waits for Pi's correlated acknowledgement.
// A timeout or broken pipe is uncertain, not a rejection: callers must never
// retry the prompt automatically. The controller drains native events from a
// separate bounded queue; overflow poisons the transport.
func (p *piRPC) requestQueue(kind, message string, timeout time.Duration, images ...piAttachmentImage) (piReply, error) {
	if kind != "get_state" && kind != "prompt" && kind != "steer" && kind != "follow_up" && kind != "clear_queue" && kind != "abort" && kind != "abort_bash" && kind != "set_session_name" && kind != "get_commands" && kind != "set_model" && kind != "set_thinking_level" {
		return piReply{}, errors.New("unsupported Pi RPC request")
	}
	if ((kind == "prompt" || kind == "steer" || kind == "follow_up") && (message == "" || len(message) > 65536)) || (kind == "set_session_name" && (message == "" || len(message) > 200)) {
		return piReply{}, errors.New("invalid prompt")
	}
	if timeout <= 0 || timeout > 30*time.Second {
		return piReply{}, errors.New("invalid timeout")
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.poisoned || p.closing.Load() || p.overflow.Load() {
		return piReply{}, errors.New("Pi acceptance uncertain: channel closed")
	}
	id, ok := uuid()
	if !ok {
		return piReply{}, errors.New("request ID unavailable")
	}
	wire := map[string]any{"id": id, "type": kind}
	if len(images) > 0 {
		wire["images"] = images
	}
	if kind == "prompt" || kind == "steer" || kind == "follow_up" {
		wire["message"] = message
	}
	if kind == "set_session_name" {
		wire["name"] = message
	}
	if kind == "set_model" {
		var choice piStartupChoice
		if json.Unmarshal([]byte(message), &choice) != nil || choice.Model == "" || (choice.Provider != "openai-codex" && choice.Provider != "openai" && choice.Provider != "claude-bridge") {
			return piReply{}, errors.New("invalid model choice")
		}
		wire["provider"], wire["modelId"] = choice.Provider, choice.Model
	}
	if kind == "set_thinking_level" {
		if !validThinking(message) {
			return piReply{}, errors.New("invalid thinking level")
		}
		wire["level"] = message
	}
	b, _ := json.Marshal(wire)
	b = append(b, '\n')
	deadline := time.Now().Add(timeout) // includes write AND acknowledgement
	if err := p.in.SetWriteDeadline(deadline); err != nil {
		p.poisoned = true
		return piReply{}, errors.New("Pi acceptance uncertain: write deadline unavailable")
	}
	select {
	case <-p.done:
		p.poisoned = true
		return piReply{}, errors.New("Pi acceptance uncertain: output closed")
	default:
	}
	n, err := p.in.Write(b)
	if err != nil || n != len(b) || p.closing.Load() {
		p.poisoned = true
		_ = p.in.Close()
		return piReply{}, errors.New("Pi acceptance uncertain: incomplete write")
	}
	timer := time.NewTimer(time.Until(deadline))
	defer timer.Stop()
	for {
		select {
		case frame, open := <-p.frames:
			if !open {
				p.poisoned = true
				return piReply{}, errors.New("Pi acceptance uncertain: output closed")
			}
			var response struct {
				ID      string          `json:"id"`
				Type    string          `json:"type"`
				Command string          `json:"command"`
				Success *bool           `json:"success"`
				Data    json.RawMessage `json:"data"`
			}
			if json.Unmarshal(frame, &response) != nil || response.Type != "response" || response.ID != id || response.Command != kind || response.Success == nil || p.closing.Load() || p.overflow.Load() {
				p.poisoned = true
				_ = p.in.Close()
				return piReply{}, errors.New("Pi acceptance uncertain: unexpected frame")
			}
			if !*response.Success {
				return piReply{}, nil
			}
			result := piReply{Accepted: true}
			if kind == "get_state" {
				var data struct {
					Model *struct {
						ID       string `json:"id"`
						Provider string `json:"provider"`
					} `json:"model"`
					Thinking string `json:"thinkingLevel"`
				}
				if json.Unmarshal(response.Data, &data) == nil && data.Model != nil && len(data.Model.ID) > 0 && len(data.Model.ID) <= 160 && (data.Model.Provider == "openai-codex" || data.Model.Provider == "openai" || data.Model.Provider == "claude-bridge") && validThinking(data.Thinking) {
					result.Choice = &piStartupChoice{Provider: data.Model.Provider, Model: data.Model.ID, Thinking: data.Thinking}
				}
			}
			if kind == "get_commands" {
				commands, ok := parsePiCommands(response.Data)
				if !ok {
					return piReply{}, errors.New("Pi command list unavailable")
				}
				for _, command := range commands {
					if command.Name == "oh-conversation-recap" && command.Source == "extension" {
						result.RecapCommand = true
					}
				}
				result.Commands = commands
			}
			if kind == "clear_queue" {
				var data struct {
					Steering []string `json:"steering"`
					FollowUp []string `json:"followUp"`
				}
				if json.Unmarshal(response.Data, &data) != nil || data.Steering == nil || data.FollowUp == nil || len(data.Steering)+len(data.FollowUp) > 128 {
					p.poisoned = true
					return piReply{}, errors.New("Pi clear result uncertain: invalid queue")
				}
				for _, text := range append(append([]string{}, data.Steering...), data.FollowUp...) {
					if len(text) > 65536 {
						p.poisoned = true
						return piReply{}, errors.New("Pi clear result uncertain: oversized text")
					}
				}
				result.Steering, result.FollowUp = data.Steering, data.FollowUp
			}
			return result, nil
		case <-timer.C:
			p.poisoned = true
			// Pi's abort receipt follows waitForIdle. A slow tool can outlive
			// this deadline: stop issuing commands but leave stdin open so
			// Pi may finish its native history instead of shutting down on EOF.
			// Close still owns eventual process cleanup on service shutdown.
			if kind != "abort" {
				_ = p.in.Close()
			}
			return piReply{}, errors.New("Pi acceptance uncertain: timeout")
		}
	}
}

// close is bounded even if a detached tool inherited stdout. It does not
// claim that the tool stopped, nor that Pi settled its native history. The
// service's cgroup cleanup handles remaining processes on daemon stop/crash.
func (p *piRPC) close() error {
	// Stop detached groups through their native owner before closing RPC.
	if !p.closing.Load() && p.processSocket != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = p.processRequest(ctx, map[string]string{"op": "shutdown"}, nil)
		cancel()
	}
	p.closing.Store(true)
	defer os.RemoveAll(p.processDir)
	_ = p.in.Close()
	_ = p.out.Close()
	// A negative PID could name a recycled, unrelated group once Pi has
	// been reaped. Signal only the identity-safe direct child handle.
	if p.cmd != nil && p.cmd.Process != nil {
		_ = p.cmd.Process.Signal(syscall.SIGTERM)
	}
	select {
	case <-p.exited:
	case <-time.After(4 * time.Second):
		if p.cmd != nil && p.cmd.Process != nil {
			_ = p.cmd.Process.Kill()
		}
		select {
		case <-p.exited:
		case <-time.After(100 * time.Millisecond):
			return errors.New("Pi termination unknown: direct child not reaped")
		}
	}
	select {
	case <-p.done:
	case <-time.After(100 * time.Millisecond):
		return errors.New("Pi termination unknown: output reader not stopped")
	}
	return errors.New("Pi termination unknown: native tools and history not reconciled")
}

// request preserves the original prompt/get_state caller interface.
func (p *piRPC) request(kind, message string, timeout time.Duration, images ...piAttachmentImage) (bool, error) {
	reply, err := p.requestQueue(kind, message, timeout, images...)
	return reply.Accepted, err
}

// respondUI writes a Pi extension reply without a correlated acknowledgement.
// It shares the request writer lock; even a complete write is not delivery proof.
func (p *piRPC) respondUI(id, kind string, value any, cancel bool) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.poisoned || p.closing.Load() || p.overflow.Load() {
		return errors.New("Pi UI response uncertain")
	}
	wire := map[string]any{"type": "extension_ui_response", "id": id}
	if cancel {
		wire["cancelled"] = true
	} else if kind == "confirm" {
		wire["confirmed"] = value
	} else {
		wire["value"] = value
	}
	b, _ := json.Marshal(wire)
	b = append(b, '\n')
	if err := p.in.SetWriteDeadline(time.Now().Add(4 * time.Second)); err != nil {
		p.poisoned = true
		return err
	}
	n, err := p.in.Write(b)
	if err != nil || n != len(b) || p.closing.Load() || p.overflow.Load() {
		p.poisoned = true
		return errors.New("Pi UI response uncertain")
	}
	return nil
}
