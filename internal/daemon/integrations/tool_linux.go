//go:build linux

package integrations

import (
	"bufio"
	"context"
	"io"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

// command builds a tool process as the person with a minimal environment:
// nothing from the daemon's own environment reaches a tool. It gets its own
// process group so that cancelling also stops what it started, and SIGKILL
// follows SIGTERM after two seconds, because the prototype saw a waiting
// device-code login ignore SIGTERM.
func (env Env) command(ctx context.Context, c Command) *exec.Cmd {
	cmd := exec.CommandContext(ctx, c.Path, c.Args...)
	cmd.Dir = env.Home
	cmd.Env = append(append([]string{"HOME=" + env.Home, "PATH=/usr/bin:/bin", "LANG=C.UTF-8"}, c.Env...), extraToolEnv...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGTERM}
	cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM) }
	cmd.WaitDelay = 2 * time.Second
	return cmd
}

// extraToolEnv lets a test trust its synthetic CA; the product leaves it empty.
var extraToolEnv []string

// killGroup removes whatever the tool left in its process group.
func killGroup(cmd *exec.Cmd) {
	if cmd.Process != nil {
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
}

// boundedOutput keeps at most limit bytes and remembers an overflow, so a
// tool cannot make the daemon buffer arbitrary output.
type boundedOutput struct {
	limit    int
	data     []byte
	overflow bool
}

func (b *boundedOutput) Write(p []byte) (int, error) {
	if len(b.data)+len(p) > b.limit {
		b.overflow = true
		return len(p), nil
	}
	b.data = append(b.data, p...)
	return len(p), nil
}

// run executes a tool to completion and returns its bounded stdout. Stderr is
// discarded: native error text never leaves the daemon.
func (env Env) run(ctx context.Context, c Command, stdin io.Reader) ([]byte, error) {
	cmd := env.command(ctx, c)
	out := &boundedOutput{limit: 64 << 10}
	cmd.Stdin, cmd.Stdout, cmd.Stderr = stdin, out, io.Discard
	err := cmd.Run()
	killGroup(cmd)
	if out.overflow {
		return nil, ToolFailed
	}
	return out.data, err
}

// LineTool is a long-running tool whose output lines a login reads, such as
// a device-code login printing its code and then waiting for the person.
type LineTool struct {
	cmd    *exec.Cmd
	cancel context.CancelFunc
	lines  chan string
	done   chan struct{}
	err    error
	stdin  io.WriteCloser
	once   sync.Once
}

// StartLineTool starts c and delivers its stdout and stderr lines, each cut
// at 4 KiB and at most 256 of them, so a tool cannot flood the daemon.
func (env Env) StartLineTool(ctx context.Context, c Command) (*LineTool, error) {
	ctx, cancel := context.WithCancel(ctx)
	cmd := env.command(ctx, c)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return nil, err
	}
	pr, pw := io.Pipe()
	cmd.Stdout, cmd.Stderr = pw, pw
	if err := cmd.Start(); err != nil {
		cancel()
		return nil, err
	}
	t := &LineTool{cmd: cmd, cancel: cancel, lines: make(chan string, 256), done: make(chan struct{}), stdin: stdin}
	go func() {
		scanner := bufio.NewScanner(pr)
		scanner.Buffer(make([]byte, 4096), 4096)
		n := 0
		for scanner.Scan() {
			if n++; n > 256 {
				break
			}
			select {
			case t.lines <- scanner.Text():
			default:
			}
		}
		close(t.lines)
		// Keep draining so the tool never blocks on a full pipe.
		_, _ = io.Copy(io.Discard, pr)
	}()
	go func() {
		t.err = cmd.Wait()
		killGroup(cmd)
		pw.Close()
		cancel()
		close(t.done)
	}()
	return t, nil
}

// Lines delivers output lines until the tool ends.
func (t *LineTool) Lines() <-chan string { return t.lines }

// Done is closed when the tool has exited.
func (t *LineTool) Done() <-chan struct{} { return t.done }

// Err is the tool's exit error once Done is closed.
func (t *LineTool) Err() error { <-t.done; return t.err }

// Write sends one line to the tool's standard input.
func (t *LineTool) Write(line string) error {
	_, err := io.WriteString(t.stdin, line+"\n")
	return err
}

// Stop cancels the tool and waits for it to exit.
func (t *LineTool) Stop() {
	t.once.Do(func() {
		t.cancel()
		_ = t.stdin.Close()
	})
	<-t.done
}
