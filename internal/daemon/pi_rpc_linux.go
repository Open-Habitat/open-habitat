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

// helpersContext is the helper recipe, given only to a conversation whose
// person turned helpers on: without the switch nothing shows a helper, and
// the recipe would only invite runs the browser keeps quiet about.
//
//go:embed helpers-context.md
var helpersContext string

// launchContext is the Open Habitat prompt section for a launch. Only a
// conversation launch (create, resume, held) gets the helper recipe; the
// switch is read when Pi starts, so turning it on reaches the next launch.
func launchContext(home, launchWorkspace string) string {
	if launchWorkspace == "" {
		return hostContext
	}
	if p, err := readPreferences(home); err == nil && p.Experimental[HelpersFeature] {
		return hostContext + helpersContext
	}
	return hostContext
}

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
	// The person asked for this stop; the companion records it in the
	// native branch so no later wake overrules it (wake_linux.go).
	personStop atomic.Bool
	// The daemon stops this Pi because the daemon itself is stopping: a turn
	// Pi aborts on the way down was cut by the restart, not by the person, and
	// the companion records so in the native branch (scanBranch).
	restartStop atomic.Bool
	launched    int64 // Unix ms before Pi started: earlier process starts belong to an earlier Pi
	poisoned    bool  // guarded by mu
	// A `bash` reply arrives only when its command ends, long after other
	// correlated requests. Its ID is registered here before the write, and the
	// reader routes that one response through the event drain, past the
	// ordinary request queue (bashMu), so publication cannot overtake output.
	bashMu      sync.Mutex
	bashReplies map[string]chan json.RawMessage
	// A `compact` reply arrives when Pi's summary is written; it goes
	// straight to its waiter (compaction_linux.go), also guarded by bashMu.
	compactReplies map[string]chan json.RawMessage
	eventsDrained  chan struct{} // controller consumed all queued native events
	// The recap extension's last reported outcome (recap-extension.mjs). Pi
	// writes it before the prompt's response, and read is sequential, so the
	// requester sees it once that response arrives.
	recapMu   sync.Mutex
	recapNote *recapExtensionOutcome
	// The rewind extension's answer (rewind-extension.mjs), the same way.
	rewindNote *rewindOutcome
	// Why this daemon itself ended Pi's input, if it did: closing stdin
	// makes Pi shut down, which the exit watcher otherwise only sees as an
	// unasked end. The first cause wins (endInput).
	endMu             sync.Mutex
	endCause          string
	stderrDiagnostics *piDiagnostics
}

// A full event queue makes the reader wait for the controller, and Pi waits
// for its stdout in turn (rpc-mode backpressure). Only a controller that has
// stopped consuming for this long poisons the channel.
var piEventStall = 30 * time.Second

// endInput closes Pi's stdin, which ends Pi, and records why. The cause is
// daemon-authored, never native text: it reaches the service log and the
// agent's catch-up (restEnv).
func (p *piRPC) endInput(cause string) {
	p.endMu.Lock()
	if p.endCause == "" {
		p.endCause = cause
	}
	p.endMu.Unlock()
	_ = p.in.Close()
}

func (p *piRPC) inputEndCause() string {
	p.endMu.Lock()
	defer p.endMu.Unlock()
	return p.endCause
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
	return launchPiRPCCommand(binary, nil, home, cwd, env, owner, nil, "")
}

// launchPiRPCCommand only creates a fresh session. The generated ID is passed
// to Pi's --session-id (not --session, which can reopen an existing writer).
func launchPiRPCCommand(binary string, prefix []string, home, cwd string, env []string, owner *piOwnership, workspace *os.File, launchWorkspace string) (*piRPC, error) {
	return launchPiRPCSession(binary, prefix, home, cwd, env, owner, workspace, "", launchWorkspace)
}

// Only the reconciled continuation path supplies a native session file.
func launchPiRPCSession(binary string, prefix []string, home, cwd string, env []string, owner *piOwnership, workspace *os.File, sessionFile, launchWorkspace string) (*piRPC, error) {
	args := append(append([]string{}, prefix...), "--mode", "rpc")
	// A conversation's own launch, not an auxiliary title worker.
	if launchWorkspace != "" {
		args = append(args, projectTrustArgs(home, cwd, workspace)...)
	}
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
	cmd.Env = make([]string, 0, len(env)+4)
	for _, entry := range env {
		key, _, _ := strings.Cut(entry, "=")
		if key == "OPEN_HABITAT_CONVERSATION_ID" || key == "OPEN_HABITAT_WORKSPACE_ID" || key == "OPEN_HABITAT_LAUNCH_GENERATION" {
			continue
		}
		cmd.Env = append(cmd.Env, entry)
	}
	cmd.Env = append(cmd.Env, "HOME="+home)
	// Broker-created accounts have no login shell, and Pi's children inherit
	// this environment: tmux, as Taskfleet starts it for its workers, takes
	// its pane shell from SHELL before the account's nologin. The browser
	// terminal and editor set the same shell.
	cmd.Env = append(cmd.Env, "SHELL="+terminalShell)
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
	contextJSON, err := json.Marshal(launchContext(home, launchWorkspace))
	if err != nil {
		return nil, err
	}
	contextPath := filepath.Join(processDir, "host-context.mjs")
	contextExtension := "export default function(pi) { pi.on('before_agent_start', (event) => { event.systemPromptOptions.sections.open_habitat = " + string(contextJSON) + "; }); }\n"
	if err := os.WriteFile(contextPath, []byte(contextExtension), 0400); err != nil {
		return nil, err
	}
	cmd.Args = append(cmd.Args, "--extension", contextPath)
	processSocket := filepath.Join(processDir, "bridge.sock")
	generation, ok := uuid()
	if !ok {
		return nil, errors.New("process generation unavailable")
	}
	// Auxiliary native title workers hold ownership but are not controller
	// launches. Only create/resume/held supply an explicit workspace context.
	if launchWorkspace != "" {
		if owner == nil || workspace == nil || !idPattern.MatchString(launchWorkspace) {
			return nil, errors.New("launch context unavailable")
		}
		cmd.Env = append(cmd.Env, "OPEN_HABITAT_CONVERSATION_ID=pi:"+owner.id,
			"OPEN_HABITAT_WORKSPACE_ID="+launchWorkspace, "OPEN_HABITAT_LAUNCH_GENERATION="+generation)
	}

	cmd.Env = append(cmd.Env, "OH_PROCESS_SOCKET="+processSocket)
	for i, arg := range prefix {
		if i > 0 && prefix[i-1] == "--extension" && strings.HasSuffix(arg, "/@aliou/pi-processes/extensions/processes/index.ts") {
			cmd.Env = append(cmd.Env, "OH_PROCESS_PACKAGE="+filepath.Clean(filepath.Join(filepath.Dir(arg), "../../package.json")))
		}
	}
	stderrR, stderrW, stderrDone, stderrDiagnostics, err := piDiagnosticPipe()
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
	p := &piRPC{stderrDiagnostics: stderrDiagnostics, launched: time.Now().UnixMilli(), processWorkspace: cwd, processSocket: processSocket, processDir: processDir, processGeneration: generation, cmd: cmd, in: inW, out: outR, frames: make(chan json.RawMessage, 8), events: make(chan json.RawMessage, 128), eventsDrained: make(chan struct{}), done: make(chan struct{}), exited: make(chan struct{})}
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
		stderrDiagnostics.markReaped()
		stderrR.Close()
		close(p.exited)
	}()
	go p.read()
	return p, nil
}

// Pi echoes the prompt's image payload in user message events before the
// bounded notification reduction. Leave room for base64, text and framing.
const piFrameLimit = (promptAttachmentLimit+2)/3*4 + 4<<20
const maxPiRequestTimeout = 7 * time.Minute

// promptRequestTimeout bounds one prompt's write and acknowledgement. Pi's
// pinned stdin reader (modes/rpc/jsonl.js) appends each 64 KiB chunk to one
// string and searches the whole of it for the newline again, so taking in a
// frame costs time that grows with the square of its size: a 100 MiB image
// batch (a 140 MB frame) took 27 s on the larger ARM host and more than two minutes on the
// smaller test server, whose two-minute deadline cut every such send off
// (Jari 9.11.2026). The budget grows the same way, to about six minutes for
// the largest admitted batch; Pi still answers small prompts within 15 s.
func promptRequestTimeout(images []piAttachmentImage) time.Duration {
	var imageBytes int
	for _, image := range images {
		imageBytes += len(image.Data)
	}
	scale := float64(imageBytes) / float64(7<<20)
	return min(15*time.Second+time.Duration(scale*scale*float64(time.Second)), maxPiRequestTimeout)
}

// read never waits for inherited stdout EOF to reap Pi. Closing the read FD
// breaks a blocked read even when a detached native tool retained its writer.
func (p *piRPC) read() {
	defer close(p.done)
	defer close(p.frames)
	defer close(p.events)
	reader := bufio.NewReaderSize(p.out, 64<<10)
	for {
		line, err := readPiFrame(reader, piFrameLimit)
		if err != nil {
			if err != io.EOF {
				p.overflow.Store(true)
				// A closed descriptor is this daemon's own cleanup, not a frame.
				if !errors.Is(err, os.ErrClosed) {
					p.endInput("an unreadable or oversized frame from Pi")
				}
			}
			break
		}
		line = bytes.TrimSuffix(line, []byte{'\r'})
		if !json.Valid(line) {
			p.overflow.Store(true)
			p.endInput("a malformed frame from Pi")
			break
		}
		if len(line) > 1<<20 {
			bounded, ok := boundedPiFrame(line)
			if !ok {
				p.overflow.Store(true)
				p.endInput("an oversized frame from Pi that must arrive whole")
				return
			}
			line = bounded
		}
		frame := append(json.RawMessage(nil), line...)
		var envelope struct {
			Type string `json:"type"`
		}
		if json.Unmarshal(frame, &envelope) != nil || envelope.Type == "" {
			p.overflow.Store(true)
			p.endInput("a frame from Pi without a type")
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
		if envelope.Type == "extension_ui_request" && (p.noteRecapOutcome(frame) || p.noteRewindOutcome(frame)) {
			continue
		}
		queue := p.events
		if envelope.Type == "response" {
			if reply := p.takeCompactReply(frame); reply != nil {
				reply <- frame // buffered for its one reply
				continue
			}
			queue = p.frames
			if p.isBashReply(frame) || isClearReply(frame) {
				// Completion follows its output through the same ordered queue.
				// Otherwise runBash can publish history before drain consumes
				// the last delta, resurrecting an already-saved live card. A
				// clear is reconciled at its place among Pi's queue events.
				queue = p.events
			}
		}
		select {
		case queue <- frame:
			continue
		default:
		}
		// The claude bridge releases a whole tool call's argument deltas at
		// once, thousands of frames within a second, faster than the
		// controller publishes them. Wait for it rather than drop or poison:
		// Pi waits for its stdout in turn. Dropping a frame could lose the
		// only evidence of prompt acceptance or settlement, so a controller
		// that stops consuming still poisons the channel.
		stall := time.NewTimer(piEventStall)
		select {
		case queue <- frame:
			stall.Stop()
		case <-stall.C:
			p.overflow.Store(true)
			p.endInput(fmt.Sprintf("Habitat stopped reading Pi's events for %s", piEventStall))
			return
		}
	}
	// Even a clean EOF is not proof of a completed prompt. A concurrent request
	// sees a closed channel and reports uncertainty. Pi closed its output
	// itself here, so closing its input causes nothing.
	_ = p.in.Close()
}

// boundedPiFrame reduces a notification frame over 1 MiB to what the
// controller reads from it: its type and the identity of its message, tool
// call or stream event. A frame can legitimately grow that large: an
// image-bearing steer, a long tool result, a large tool call's arguments in
// toolcall_end, message_end and tool_execution_start, or an aggregate end
// event. The content stays in Pi's native history, which the browser reloads.
// A response, UI request or queue update is needed whole, so it fails closed.
func boundedPiFrame(line []byte) ([]byte, bool) {
	var echo struct {
		Type    string `json:"type"`
		Message *struct {
			Role       string          `json:"role"`
			ToolCallID string          `json:"toolCallId"`
			ToolName   string          `json:"toolName"`
			IsError    bool            `json:"isError"`
			StopReason string          `json:"stopReason"`
			CustomType string          `json:"customType"`
			Content    json.RawMessage `json:"content"`
		} `json:"message"`
		ToolCallID string `json:"toolCallId"`
		ToolName   string `json:"toolName"`
		IsError    bool   `json:"isError"`
		Assistant  *struct {
			Type         string `json:"type"`
			ContentIndex int    `json:"contentIndex"`
			ID           string `json:"id"`
			ToolName     string `json:"toolName"`
			ToolCall     *struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"toolCall"`
		} `json:"assistantMessageEvent"`
	}
	if json.Unmarshal(line, &echo) != nil || !safeNativeType(echo.Type) {
		return nil, false
	}
	switch echo.Type {
	case "response", "extension_ui_request", "queue_update":
		return nil, false
	case "agent_end", "turn_end":
		out, _ := json.Marshal(map[string]string{"type": echo.Type})
		return out, true
	}
	out := map[string]any{"type": echo.Type}
	set := func(m map[string]any, key, value string) {
		if value != "" {
			m[key] = value
		}
	}
	if m := echo.Message; m != nil {
		message := map[string]any{}
		set(message, "role", m.Role)
		set(message, "toolCallId", m.ToolCallID)
		set(message, "toolName", m.ToolName)
		set(message, "stopReason", m.StopReason)
		set(message, "customType", m.CustomType)
		if m.Role == "toolResult" {
			message["isError"] = m.IsError
		}
		out["message"] = message
		if echo.Type == "message_start" && m.Role == "user" {
			// An image-bearing steer: its text still tells which queued
			// message Pi delivered (pi_unanswered_linux.go).
			if text, ok := piUserText(m.Content); ok {
				message["content"] = []map[string]string{{"type": "text", "text": text}}
			}
		}
	}
	set(out, "toolCallId", echo.ToolCallID)
	set(out, "toolName", echo.ToolName)
	if echo.Type == "tool_execution_end" || echo.Type == "tool_execution_update" {
		out["isError"] = echo.IsError
	}
	if a := echo.Assistant; a != nil {
		event := map[string]any{"type": a.Type, "contentIndex": a.ContentIndex}
		set(event, "id", a.ID)
		set(event, "toolName", a.ToolName)
		if a.ToolCall != nil {
			event["toolCall"] = map[string]string{"id": a.ToolCall.ID, "name": a.ToolCall.Name}
		}
		out["assistantMessageEvent"] = event
	}
	bounded, _ := json.Marshal(out)
	if len(bounded) > 1<<20 {
		if m, ok := out["message"].(map[string]any); ok {
			delete(m, "content")
		}
		bounded, _ = json.Marshal(out)
	}
	if len(bounded) > 1<<20 {
		bounded, _ = json.Marshal(map[string]string{"type": echo.Type})
	}
	return bounded, true
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
	if timeout <= 0 || timeout > maxPiRequestTimeout {
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
		if json.Unmarshal([]byte(message), &choice) != nil || choice.Model == "" || !piConversationProvider(choice.Provider) {
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
		p.endInput("a failed write of " + kind + " to Pi")
		// The frame is one JSON object followed by its newline, so every
		// shorter prefix than the object itself is invalid JSON: Pi can
		// neither frame nor parse it, even as the last line at end of input.
		if n < len(b)-1 {
			return piReply{}, errPiNotReceived
		}
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
				p.endInput("an unexpected reply from Pi to " + kind)
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
				if json.Unmarshal(response.Data, &data) == nil && data.Model != nil && len(data.Model.ID) > 0 && len(data.Model.ID) <= 160 && piConversationProvider(data.Model.Provider) && validThinking(data.Thinking) {
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
				p.endInput(fmt.Sprintf("no reply from Pi to %s within %s", kind, timeout))
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
		_ = p.processRequest(ctx, map[string]any{"op": "shutdown", "person": p.personStop.Load(), "restart": p.restartStop.Load()}, nil)
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
// errPiNotReceived is a request that never reached Pi whole: Pi did not
// receive it, and the child is ending.
var errPiNotReceived = errors.New("Pi did not receive the request: incomplete write")

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
