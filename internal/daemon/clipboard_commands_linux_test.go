//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// The core runtime's pbcopy and pbpaste (runtime/core/agent-bin) against a
// real tmux: the browser terminal's route (an attached xterm-256color client
// receiving OSC 52), a session nobody is attached to, and no tmux at all, as
// in a browser-started conversation or a worker.
func TestClipboardCommands(t *testing.T) {
	tmux, err := exec.LookPath("tmux")
	if err != nil {
		t.Skip("tmux not installed")
	}
	bin, err := filepath.Abs(filepath.Join("..", "..", "runtime", "core", "agent-bin"))
	if err != nil {
		t.Fatal(err)
	}
	// tmux socket paths are limited to about 100 bytes.
	dir, err := os.MkdirTemp("", "pb")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	socket := filepath.Join(dir, "s")
	base := []string{"HOME=" + dir, "PATH=" + filepath.Dir(tmux) + ":/usr/bin:/bin", "TERM=xterm-256color", "LANG=C.UTF-8"}
	tm := func(args ...string) string {
		t.Helper()
		cmd := exec.Command(tmux, append([]string{"-S", socket, "-f", "/dev/null"}, args...)...)
		cmd.Env, cmd.Dir = base, dir
		out, err := cmd.Output()
		if err != nil {
			t.Fatalf("tmux %v: %v", args, err)
		}
		return strings.TrimSpace(string(out))
	}
	tm("new-session", "-d", "-s", "s", "-x", "80", "-y", "24")
	t.Cleanup(func() {
		cmd := exec.Command(tmux, "-S", socket, "kill-server")
		cmd.Env = base
		_ = cmd.Run()
	})
	pane := tm("display-message", "-p", "-t", "s:", "#{pane_id}")
	inTerminal := append(append([]string{}, base...), "TMUX="+socket+",1,0", "TMUX_PANE="+pane)

	type result struct {
		out, err string
		code     int
	}
	run := func(env []string, name, stdin string, args ...string) result {
		t.Helper()
		// No case may wait: a command that cannot reach a clipboard fails.
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, filepath.Join(bin, name), args...)
		cmd.Env, cmd.Dir = env, dir
		cmd.Stdin = strings.NewReader(stdin)
		var out, stderr bytes.Buffer
		cmd.Stdout, cmd.Stderr = &out, &stderr
		err := cmd.Run()
		if ctx.Err() != nil {
			t.Fatalf("%s %v hung", name, args)
		}
		code := 0
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			code = exit.ExitCode()
		} else if err != nil {
			t.Fatal(err)
		}
		return result{out.String(), stderr.String(), code}
	}
	expect := func(r result, code int, stderr string) {
		t.Helper()
		if r.code != code || !strings.Contains(r.err, stderr) {
			t.Fatalf("exit %d stderr %q, want %d containing %q", r.code, r.err, code, stderr)
		}
	}

	// Usage and help.
	for _, name := range []string{"pbcopy", "pbpaste"} {
		r := run(base, name, "", "--help")
		if r.code != 0 || !strings.Contains(r.out, "Usage: "+name) || !strings.Contains(r.out, "tmux paste buffer") {
			t.Fatalf("%s --help: %+v", name, r)
		}
		expect(run(inTerminal, name, "", "-pboard"), 2, "unexpected argument")
	}
	if r := run(base, "pbpaste", "", "--help"); !strings.Contains(r.out, "does not read the browser's") {
		t.Fatalf("pbpaste --help must say it reads no browser clipboard: %s", r.out)
	}

	// No tmux: a browser-started conversation, a worker, cron.
	expect(run(base, "pbcopy", "secret\n"), 3, "not in a Habitat terminal")
	expect(run(base, "pbpaste", ""), 3, "not in a Habitat terminal")

	// tmux with no buffer yet, and no terminal attached to the session.
	expect(run(inTerminal, "pbpaste", ""), 1, "no paste buffer")
	expect(run(inTerminal, "pbcopy", "unseen\n"), 3, "no terminal that accepts clipboard writes")
	expect(run(inTerminal, "pbpaste", ""), 1, "no paste buffer")

	// The browser terminal: a client attached through a PTY, as the daemon
	// attaches it, whose output is what the browser's xterm.js parses.
	attach := exec.Command(tmux, "-S", socket, "attach-session", "-t", "=s")
	attach.Env, attach.Dir = base, dir
	pty, err := startOnPTY(attach, 80, 24)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pty.Close()
		_ = attach.Process.Kill()
		_ = attach.Wait()
	})
	var mu sync.Mutex
	var screen bytes.Buffer
	go func() {
		buf := make([]byte, 32<<10)
		for {
			n, err := pty.Read(buf)
			mu.Lock()
			screen.Write(buf[:n])
			mu.Unlock()
			if err != nil {
				return
			}
		}
	}()
	seen := func(want string) bool {
		for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(20 * time.Millisecond) {
			mu.Lock()
			ok := strings.Contains(screen.String(), want)
			mu.Unlock()
			if ok {
				return true
			}
		}
		return false
	}
	for deadline := time.Now().Add(5 * time.Second); tm("display-message", "-p", "-t", "s:", "#{session_attached}") != "1"; time.Sleep(20 * time.Millisecond) {
		if time.Now().After(deadline) {
			t.Fatal("client did not attach")
		}
	}

	text := "hello\nwörld \x1b[31m\n"
	r := run(inTerminal, "pbcopy", text)
	expect(r, 0, "on the clipboard once Copy is pressed")
	if r.out != "" {
		t.Fatalf("pbcopy wrote to stdout: %q", r.out)
	}
	if !seen("\x1b]52;;" + base64.StdEncoding.EncodeToString([]byte(text)) + "\a") {
		t.Fatal("no OSC 52 clipboard write reached the attached terminal")
	}
	if r := run(inTerminal, "pbpaste", ""); r.code != 0 || r.out != text {
		t.Fatalf("pbpaste = %+v, want the copied text exactly", r)
	}
	if names := tm("list-buffers", "-F", "#{buffer_name}"); strings.Contains(names, "pbcopy-") {
		t.Fatalf("measuring buffer left behind: %s", names)
	}

	// Over the terminal's limit and empty input copy nothing and leave the
	// newest buffer as it was.
	expect(run(inTerminal, "pbcopy", strings.Repeat("x", 1<<20+1)), 1, "over 1 MiB")
	expect(run(inTerminal, "pbcopy", ""), 1, "input is empty")
	if r := run(inTerminal, "pbpaste", ""); r.out != text {
		t.Fatalf("pbpaste after refused copies = %q", r.out)
	}
	// Exactly the limit is accepted.
	full := strings.Repeat("y", 1<<20)
	expect(run(inTerminal, "pbcopy", full), 0, "sent 1048576 bytes")
	if r := run(inTerminal, "pbpaste", ""); r.out != full {
		t.Fatalf("pbpaste after a full copy returned %d bytes", len(r.out))
	}
	if names := tm("list-buffers", "-F", "#{buffer_name}"); strings.Contains(names, "pbcopy-") {
		t.Fatalf("measuring buffer left behind: %s", names)
	}
}
