//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// piRPC is a private, bounded native-protocol probe. It is not yet a web
// controller: in particular its in-process ownership does not fence a TUI.
// A caller must not expose it as an agent capability until that fence exists.
type piRPC struct {
	cmd      *exec.Cmd
	in, out  *os.File
	mu       sync.Mutex // serializes requests; does not guard close
	frames   chan json.RawMessage
	done     chan struct{} // reader done, NOT process exit proof
	exited   chan struct{} // direct child reaped independently of pipe EOF
	closing  atomic.Bool
	poisoned bool // guarded by mu
}

// launchPiRPC is private: no caller may expose it before a known-owner fence
// and native-history reconciliation exist. Resume is refused entirely; a
// native path alone never establishes old-writer absence or settlement.
func launchPiRPC(binary, home, cwd, sessionFile string, env []string) (*piRPC, error) {
	return launchPiRPCWithOwnership(binary, home, cwd, sessionFile, env, nil)
}

// launchPiRPCWithOwnership is an internal fixture-level bridge. The caller
// must bind the lock's session ID to the native session before using it for
// control. No production caller does so yet; this is not restart resume.
func launchPiRPCWithOwnership(binary, home, cwd, sessionFile string, env []string, owner *piOwnership) (*piRPC, error) {
	if home == "" || cwd == "" || binary == "" || !filepath.IsAbs(binary) || !filepath.IsAbs(home) || !filepath.IsAbs(cwd) || os.Geteuid() == 0 {
		return nil, errors.New("invalid Pi launch context or UID")
	}
	if sessionFile != "" {
		return nil, errors.New("resume requires native owner reconciliation")
	}
	args := []string{"--mode", "rpc"}
	cmd := exec.Command(binary, args...)
	cmd.Dir = cwd
	if owner != nil {
		if owner.file == nil {
			return nil, errors.New("Pi owner lock unavailable")
		}
		// ExtraFiles preserves the lock across daemon crash for the child lifetime.
		cmd.ExtraFiles = []*os.File{owner.file}
	}
	cmd.Env = append(append([]string(nil), env...), "HOME="+home)
	// nil stderr sends Pi output to the null device without an os/exec
	// copy goroutine that detached tools could keep open indefinitely.
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
	p := &piRPC{cmd: cmd, in: inW, out: outR, frames: make(chan json.RawMessage, 128), done: make(chan struct{}), exited: make(chan struct{})}
	if err = cmd.Start(); err != nil {
		inR.Close()
		inW.Close()
		outR.Close()
		outW.Close()
		return nil, err
	}
	inR.Close()
	outW.Close()
	go func() { _ = cmd.Wait(); close(p.exited) }()
	go p.read()
	return p, nil
}

// read never waits for inherited stdout EOF to reap Pi. Closing the read FD
// breaks a blocked read even when a detached native tool retained its writer.
func (p *piRPC) read() {
	defer close(p.done)
	defer close(p.frames)
	scanner := bufio.NewScanner(p.out)
	scanner.Buffer(make([]byte, 4096), 1<<20)
	for scanner.Scan() {
		line := bytes.TrimSuffix(scanner.Bytes(), []byte{'\r'})
		if !json.Valid(line) {
			break
		}
		frame := append(json.RawMessage(nil), line...)
		select {
		case p.frames <- frame:
		default:
			return
		}
	}
	// Even a clean EOF is not proof of a completed prompt. A concurrent request
	// sees a closed channel and reports uncertainty.
	_ = p.in.Close()
}

// request serializes writes and waits for Pi's correlated acknowledgement.
// A timeout or broken pipe is uncertain, not a rejection: callers must never
// retry the prompt automatically. Frames other than this response remain on
// the bounded channel for a future event consumer; this probe deliberately
// refuses a request if an event appears while waiting instead of discarding it.
func (p *piRPC) request(kind, message string, timeout time.Duration) (bool, error) {
	if kind != "get_state" && kind != "prompt" {
		return false, errors.New("unsupported Pi RPC request")
	}
	if kind == "prompt" && (message == "" || len(message) > 65536) {
		return false, errors.New("invalid prompt")
	}
	if timeout <= 0 || timeout > 30*time.Second {
		return false, errors.New("invalid timeout")
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.poisoned || p.closing.Load() {
		return false, errors.New("Pi acceptance uncertain: channel closed")
	}
	id, ok := uuid()
	if !ok {
		return false, errors.New("request ID unavailable")
	}
	wire := map[string]string{"id": id, "type": kind}
	if kind == "prompt" {
		wire["message"] = message
	}
	b, _ := json.Marshal(wire)
	b = append(b, '\n')
	deadline := time.Now().Add(timeout) // includes write AND acknowledgement
	if err := p.in.SetWriteDeadline(deadline); err != nil {
		p.poisoned = true
		return false, errors.New("Pi acceptance uncertain: write deadline unavailable")
	}
	select {
	case <-p.done:
		p.poisoned = true
		return false, errors.New("Pi acceptance uncertain: output closed")
	default:
	}
	n, err := p.in.Write(b)
	if err != nil || n != len(b) || p.closing.Load() {
		p.poisoned = true
		_ = p.in.Close()
		return false, errors.New("Pi acceptance uncertain: incomplete write")
	}
	timer := time.NewTimer(time.Until(deadline))
	defer timer.Stop()
	for {
		select {
		case frame, open := <-p.frames:
			if !open {
				p.poisoned = true
				return false, errors.New("Pi acceptance uncertain: output closed")
			}
			var response struct {
				ID      string `json:"id"`
				Type    string `json:"type"`
				Command string `json:"command"`
				Success *bool  `json:"success"`
			}
			if json.Unmarshal(frame, &response) != nil || response.Type != "response" || response.ID != id || response.Command != kind || response.Success == nil || p.closing.Load() {
				p.poisoned = true
				_ = p.in.Close()
				return false, errors.New("Pi acceptance uncertain: unexpected frame")
			}
			return *response.Success, nil
		case <-timer.C:
			p.poisoned = true
			_ = p.in.Close()
			return false, errors.New("Pi acceptance uncertain: timeout")
		}
	}
}

// close is bounded even if a detached tool inherited stdout. It does not
// claim that the tool stopped, nor that Pi settled its native history. The
// service's cgroup cleanup handles remaining processes on daemon stop/crash.
func (p *piRPC) close() error {
	p.closing.Store(true)
	_ = p.in.Close()
	_ = p.out.Close()
	// A negative PID could name a recycled, unrelated group once Pi has
	// been reaped. Signal only the identity-safe direct child handle.
	if p.cmd.Process != nil {
		_ = p.cmd.Process.Signal(syscall.SIGTERM)
	}
	select {
	case <-p.exited:
	case <-time.After(100 * time.Millisecond):
		if p.cmd.Process != nil {
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
