//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"github.com/Open-Habitat/open-habitat/internal/wsframe"
)

type terminalFixture struct {
	host   *terminalHost
	cfg    transport.Config
	id     string
	dir    string
	socket string // the daemon's Unix socket
	tmp    string
}

// Socket paths are limited to 108 bytes, so tmux sockets live under a short
// directory rather than t.TempDir().
func shortDir(t *testing.T) string {
	t.Helper()
	d, err := os.MkdirTemp("", "oht")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(d) })
	return d
}

func newTerminalFixture(t *testing.T, trusted bool) *terminalFixture {
	t.Helper()
	tmux, err := exec.LookPath("tmux")
	if err != nil {
		t.Skip("tmux not installed")
	}
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	dir := filepath.Join(cfg.Home, "src", "demo.repo")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	entries := Discover(cfg).Entries
	if len(entries) != 1 {
		t.Fatalf("entries %+v", entries)
	}
	tmp := shortDir(t)
	ctx, cancel := context.WithCancel(context.Background())
	h := &terminalHost{cfg: cfg, tmux: tmux, runtimeDir: filepath.Join(tmp, "run"), lingerDir: filepath.Join(tmp, "linger"), privateDir: filepath.Join(tmp, "p"), log: slog.New(slog.NewTextHandler(testLogWriter{t}, nil)), ctx: ctx}
	if err := os.MkdirAll(h.runtimeDir, 0o700); err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	trust := func(*http.Request) bool { return trusted }
	mux.Handle(TerminalsPath, h.TerminalsHandler(trust))
	mux.Handle(TerminalClosePath, h.TerminalCloseHandler(trust))
	mux.Handle(TerminalPath, h.TerminalHandler(trust))
	sock := filepath.Join(tmp, "d.sock")
	ln, err := net.Listen("unix", sock)
	if err != nil {
		t.Fatal(err)
	}
	srv := &http.Server{Handler: mux}
	go srv.Serve(ln)
	t.Cleanup(func() {
		cancel()
		srv.Close()
		for _, s := range []string{h.socket(false), h.socket(true)} {
			_ = exec.Command(tmux, "-S", s, "kill-server").Run()
		}
	})
	return &terminalFixture{host: h, cfg: cfg, id: workspaceIDOf(cfg, entries[0]), dir: dir, socket: sock, tmp: tmp}
}

func (f *terminalFixture) client() *http.Client {
	return &http.Client{Transport: &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", f.socket)
	}}}
}

func (f *terminalFixture) list(t *testing.T) terminalList {
	t.Helper()
	res, err := f.client().Get("http://unix" + TerminalsPath + "?workspace_id=" + f.id)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var l terminalList
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&l) != nil {
		t.Fatalf("list: %d", res.StatusCode)
	}
	return l
}

// wsClient is a minimal browser stand-in: it masks what it sends and reads
// unmasked frames.
type wsClient struct {
	c      net.Conn
	r      *bufio.Reader
	screen bytes.Buffer
	ready  map[string]any
	exit   map[string]any
	closed uint16
}

func (f *terminalFixture) dial(t *testing.T, query string) (*wsClient, int) {
	t.Helper()
	c, err := net.Dial("unix", f.socket)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { c.Close() })
	key, _ := wsframe.NewKey()
	fmt.Fprintf(c, "GET %s?%s HTTP/1.1\r\nHost: unix\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: %s\r\n\r\n", TerminalPath, query, key)
	r := bufio.NewReader(c)
	res, err := http.ReadResponse(r, nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 101 {
		return nil, res.StatusCode
	}
	if !wsframe.ValidResponse(res, key) {
		t.Fatal("bad handshake reply")
	}
	return &wsClient{c: c, r: r}, 101
}

func (w *wsClient) send(t *testing.T, op byte, payload string) {
	t.Helper()
	if _, err := w.c.Write(wsframe.AppendFrame(nil, op, []byte(payload), true)); err != nil {
		t.Fatal(err)
	}
}

func (w *wsClient) resize(t *testing.T, cols, rows int) {
	w.send(t, wsframe.OpText, fmt.Sprintf(`{"type":"resize","cols":%d,"rows":%d}`, cols, rows))
}

// until reads frames until the screen output contains want or the
// connection closes; it reports whether want was seen.
func (w *wsClient) until(t *testing.T, want string, wait time.Duration) bool {
	t.Helper()
	deadline := time.Now().Add(wait)
	for !strings.Contains(w.screen.String(), want) {
		_ = w.c.SetReadDeadline(deadline)
		f, err := wsframe.ReadFrame(w.r, 1<<20, false)
		if err != nil {
			return false
		}
		switch f.Op {
		case wsframe.OpBinary:
			w.screen.Write(f.Payload)
		case wsframe.OpText:
			var m map[string]any
			_ = json.Unmarshal(f.Payload, &m)
			if m["type"] == "ready" {
				w.ready = m
			} else if m["type"] == "exit" {
				w.exit = m
			}
		case wsframe.OpClose:
			if len(f.Payload) >= 2 {
				w.closed = uint16(f.Payload[0])<<8 | uint16(f.Payload[1])
			}
			return strings.Contains(w.screen.String(), want)
		}
	}
	return true
}

func (w *wsClient) waitReady(t *testing.T) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for w.ready == nil && w.closed == 0 && time.Now().Before(deadline) {
		w.until(t, "\x00never", 200*time.Millisecond)
	}
	if w.ready == nil {
		t.Fatalf("no ready message (closed %d)", w.closed)
	}
}

func TestTerminalShellRunsAsPersonInWorkspaceAndSurvivesBrowser(t *testing.T) {
	f := newTerminalFixture(t, true)
	if l := f.list(t); len(l.Shells) != 0 || l.SurvivesRestart {
		t.Fatalf("fresh list %+v", l)
	}
	if alive(f.host.socket(false)) {
		t.Fatal("listing started a tmux server")
	}
	w, code := f.dial(t, "workspace_id="+f.id+"&shell=new")
	if code != 101 {
		t.Fatalf("upgrade: %d", code)
	}
	w.resize(t, 90, 30)
	w.waitReady(t)
	if w.ready["shell"] != "1" || w.ready["read_only"] != false || w.ready["survives_restart"] != false {
		t.Fatalf("ready %+v", w.ready)
	}
	panes := f.host.productPanes(context.Background(), f.id)
	if len(panes) != 1 {
		t.Fatalf("product panes: %+v", panes)
	}
	processes, _, _ := scanWorkspaceProcesses("/proc", f.dir, os.Geteuid(), nil)
	products := identifyProductProcesses("/proc", os.Geteuid(), processes, panes, nil)
	found := false
	for _, p := range products {
		found = found || p.Product == "terminal" && p.Shell == "1"
	}
	if !found {
		t.Fatalf("native shell not identified: %+v", products)
	}
	if got := f.host.productPanes(context.Background(), "ws_missing000"); len(got) != 0 {
		t.Fatalf("other workspace's panes: %+v", got)
	}
	w.send(t, wsframe.OpBinary, "echo \"uid=$(id -u) dir=$PWD size=$(stty size)\"\r")
	want := fmt.Sprintf("uid=%d dir=%s size=30 90", os.Getuid(), f.dir)
	if !w.until(t, want, 5*time.Second) {
		t.Fatalf("shell output %q, want %q", w.screen.String(), want)
	}
	w.resize(t, 120, 40)
	time.Sleep(200 * time.Millisecond)
	w.send(t, wsframe.OpBinary, "echo \"now=$(stty size)\"\r")
	if !w.until(t, "now=40 120", 5*time.Second) {
		t.Fatalf("resize not applied: %q", w.screen.String())
	}
	// A background job keeps running after the browser goes away.
	w.send(t, wsframe.OpBinary, "sleep 300 & echo started-$!\r")
	if !w.until(t, "started-", 5*time.Second) {
		t.Fatal("job not started")
	}
	w.c.Close()
	time.Sleep(300 * time.Millisecond)
	l := f.list(t)
	if len(l.Shells) != 1 || l.Shells[0].Shell != "1" || l.Shells[0].Busy {
		t.Fatalf("shell did not survive the browser: %+v", l)
	}
	w2, code := f.dial(t, "workspace_id="+f.id+"&shell=1")
	if code != 101 {
		t.Fatalf("reattach: %d", code)
	}
	w2.resize(t, 90, 30)
	w2.waitReady(t)
	w2.send(t, wsframe.OpBinary, "jobs; echo jobs-done\r")
	if !w2.until(t, "sleep 300", 5*time.Second) {
		t.Fatalf("reattached to a different shell: %q", w2.screen.String())
	}
	w2.send(t, wsframe.OpBinary, "kill %1; exit\r")
	w2.until(t, "\x00never", 5*time.Second)
	if w2.exit["state"] != "ended" || w2.closed != 1000 {
		t.Fatalf("exit %+v close %d", w2.exit, w2.closed)
	}
	if l := f.list(t); len(l.Shells) != 0 {
		t.Fatalf("ended shell still listed: %+v", l)
	}
}

func TestTerminalBusyShellAndClose(t *testing.T) {
	f := newTerminalFixture(t, true)
	w, _ := f.dial(t, "workspace_id="+f.id+"&shell=new")
	w.resize(t, 80, 24)
	w.waitReady(t)
	w.send(t, wsframe.OpBinary, "sleep 300\r")
	var l terminalList
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(100 * time.Millisecond) {
		if l = f.list(t); len(l.Shells) == 1 && l.Shells[0].Busy {
			break
		}
	}
	if len(l.Shells) != 1 || !l.Shells[0].Busy || l.Shells[0].Command != "sleep" {
		t.Fatalf("busy not reported: %+v", l)
	}
	post := func() int {
		res, err := f.client().Post("http://unix"+TerminalClosePath, "application/json", strings.NewReader(`{"workspace_id":"`+f.id+`","shell":"1"}`))
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res.StatusCode
	}
	if code := post(); code != 200 {
		t.Fatalf("close: %d", code)
	}
	w.until(t, "\x00never", 5*time.Second)
	if w.exit["state"] != "ended" {
		t.Fatalf("attached browser not told: %+v", w.exit)
	}
	if code := post(); code != 404 {
		t.Fatalf("second close: %d", code)
	}
}

// A Taskfleet window is watched, never typed into or resized, and the view
// leaves Taskfleet's own session as it was.
func TestTerminalTaskfleetAttachIsReadOnly(t *testing.T) {
	f := newTerminalFixture(t, true)
	tf := filepath.Join(f.host.runtimeDir, "taskfleet")
	if err := os.MkdirAll(tf, 0o700); err != nil {
		t.Fatal(err)
	}
	sock := filepath.Join(tf, "tmux-77f5c84c2248fcc06660.sock")
	tmux := func(args ...string) string {
		t.Helper()
		cmd := exec.Command(f.host.tmux, append([]string{"-f", "/dev/null", "-S", sock}, args...)...)
		cmd.Env = append(os.Environ(), "SHELL=/bin/bash", "TMUX=")
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("tmux %v: %s", args, out)
		}
		return strings.TrimSpace(string(out))
	}
	t.Cleanup(func() { _ = exec.Command(f.host.tmux, "-S", sock, "kill-server").Run() })
	tmux("new-session", "-d", "-s", "agents", "-x", "100", "-y", "30", "-c", f.host.cfg.Home)
	worker := filepath.Join(f.dir+"__worktrees", "wt-1")
	if err := os.MkdirAll(worker, 0o700); err != nil {
		t.Fatal(err)
	}
	win := tmux("new-window", "-d", "-P", "-F", "#{window_id}", "-t", "agents:", "-n", "worker", "-c", worker)
	marker := filepath.Join(f.tmp, "typed")
	// The pane reports its directory once its shell has started.
	l := f.list(t)
	for deadline := time.Now().Add(3 * time.Second); len(l.Taskfleet) == 0 && time.Now().Before(deadline); time.Sleep(50 * time.Millisecond) {
		l = f.list(t)
	}
	if len(l.Taskfleet) != 1 || l.Taskfleet[0].Name != "worker" || l.Taskfleet[0].Session != "agents" {
		t.Fatalf("taskfleet windows %+v", l.Taskfleet)
	}
	token := l.Taskfleet[0].Token
	if token != "77f5c84c2248fcc06660-"+strings.TrimPrefix(win, "@") {
		t.Fatalf("token %q", token)
	}
	w, code := f.dial(t, "workspace_id="+f.id+"&taskfleet="+token)
	if code != 101 {
		t.Fatalf("upgrade %d", code)
	}
	w.resize(t, 60, 15)
	w.waitReady(t)
	before := tmux("display-message", "-p", "-t", win, "#{window_width} #{window_height}")
	if w.ready["read_only"] != true || w.ready["name"] != "worker" || fmt.Sprintf("%v %v", w.ready["cols"], w.ready["rows"]) != before {
		t.Fatalf("ready %+v", w.ready)
	}
	w.send(t, wsframe.OpBinary, "touch "+marker+"\r")
	time.Sleep(500 * time.Millisecond)
	if _, err := os.Stat(marker); err == nil {
		t.Fatal("read-only view typed into the Taskfleet window")
	}
	w.resize(t, 50, 10)
	time.Sleep(200 * time.Millisecond)
	if got := tmux("display-message", "-p", "-t", win, "#{window_width} #{window_height}"); got != before {
		t.Fatalf("view resized the agent's window: %s", got)
	}
	if got := tmux("display-message", "-p", "-t", "=agents:", "#{window_id}"); got == win {
		t.Fatal("view changed Taskfleet's current window")
	}
	// Watching attaches no tmux client to Taskfleet's server at all, so no
	// client of ours can take part in sizing its windows.
	if got := tmux("list-clients", "-F", "#{client_name}"); got != "" {
		t.Fatalf("view attached a client to Taskfleet's server: %q", got)
	}
	// When the window's size changes, the view follows it.
	tmux("resize-window", "-t", win, "-x", "90", "-y", "20")
	w.ready = nil
	w.waitReady(t)
	if w.ready["cols"] != float64(90) || w.ready["rows"] != float64(20) {
		t.Fatalf("view did not follow the window's size: %+v", w.ready)
	}
	// The window closing ends the view rather than showing another window.
	tmux("kill-window", "-t", win)
	w.until(t, "\x00never", 5*time.Second)
	if w.exit["state"] != "ended" {
		t.Fatalf("view did not end with its window: %+v", w.exit)
	}
	time.Sleep(200 * time.Millisecond)
	if got := tmux("list-sessions", "-F", "#{session_name}"); got != "agents" {
		t.Fatalf("view session left behind: %q", got)
	}
}

func TestTerminalRefusals(t *testing.T) {
	f := newTerminalFixture(t, true)
	for name, q := range map[string]string{
		"no target":     "workspace_id=" + f.id,
		"both targets":  "workspace_id=" + f.id + "&shell=new&taskfleet=77f5c84c-1",
		"path shell":    "workspace_id=" + f.id + "&shell=..%2Fx",
		"zero shell":    "workspace_id=" + f.id + "&shell=0",
		"socket token":  "workspace_id=" + f.id + "&taskfleet=%2Frun%2Fx",
		"bad workspace": "workspace_id=..&shell=new",
	} {
		if _, code := f.dial(t, q); code != 400 {
			t.Errorf("%s: %d", name, code)
		}
	}
	if _, code := f.dial(t, "workspace_id=ws_AAAAAAAAAAAAAAAAAAAAAAAA&shell=new"); code != 404 {
		t.Errorf("unknown workspace: %d", code)
	}
	if _, code := f.dial(t, "workspace_id="+f.id+"&shell=7"); code != 404 {
		t.Errorf("missing shell: %d", code)
	}
	res, err := f.client().Get("http://unix" + TerminalPath + "?workspace_id=" + f.id + "&shell=new")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 400 {
		t.Errorf("plain GET: %d", res.StatusCode)
	}
	// Nothing runs before the first message sizes the terminal.
	w, _ := f.dial(t, "workspace_id="+f.id+"&shell=new")
	w.send(t, wsframe.OpBinary, "echo hi\r")
	w.until(t, "\x00never", 3*time.Second)
	if w.closed != 4400 || alive(f.host.socket(false)) {
		t.Fatalf("first message not enforced: close %d", w.closed)
	}
	for deadline := time.Now().Add(3 * time.Second); ; time.Sleep(20 * time.Millisecond) {
		f.host.mu.Lock()
		idle := f.host.conns == 0
		if idle {
			f.host.conns = terminalConnLimit
		}
		f.host.mu.Unlock()
		if idle || time.Now().After(deadline) {
			break
		}
	}
	if _, code := f.dial(t, "workspace_id="+f.id+"&shell=new"); code != 503 {
		t.Errorf("over connection limit: %d", code)
	}
	f.host.conns = 0

	untrusted := newTerminalFixture(t, false)
	if _, code := untrusted.dial(t, "workspace_id="+untrusted.id+"&shell=new"); code != 403 {
		t.Errorf("untrusted peer: %d", code)
	}
}

// With lingering and a user bus, the server is started through systemd-run
// --user; a stand-in records the call and starts the server detached.
func TestTerminalLingeringStartsServerAsUserService(t *testing.T) {
	f := newTerminalFixture(t, true)
	if err := os.MkdirAll(f.host.lingerDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(f.host.lingerDir, f.cfg.Username), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	bus, err := net.Listen("unix", filepath.Join(f.host.runtimeDir, "bus"))
	if err != nil {
		t.Fatal(err)
	}
	defer bus.Close()
	// This is only a lingering/bus-presence fixture, not a D-Bus server.
	// systemd-enabled tmux also connects here to scope new panes. Reject
	// those connections promptly instead of hanging its authentication.
	go func() {
		for {
			c, err := bus.Accept()
			if err != nil {
				return
			}
			c.Close()
		}
	}()
	record := filepath.Join(f.tmp, "args")
	script := filepath.Join(f.tmp, "systemd-run")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nprintf '%s\\n' \"$@\" > "+record+"\nwhile [ \"$1\" != -- ]; do shift; done; shift\nsetsid \"$@\" </dev/null >/dev/null 2>&1 &\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	f.host.systemdRun = script
	if !f.host.survives() {
		t.Fatal("lingering not detected")
	}
	w, _ := f.dial(t, "workspace_id="+f.id+"&shell=new")
	w.resize(t, 80, 24)
	w.waitReady(t)
	if w.ready["survives_restart"] != true {
		t.Fatalf("ready %+v", w.ready)
	}
	args, _ := os.ReadFile(record)
	for _, want := range []string{"--user", "--unit=" + terminalUnit, "--setenv=SHELL=/bin/bash", "-D", f.host.socket(true)} {
		if !strings.Contains(string(args), want+"\n") {
			t.Fatalf("systemd-run args missing %q:\n%s", want, args)
		}
	}
	if l := f.list(t); !l.SurvivesRestart || len(l.Shells) != 1 {
		t.Fatalf("list %+v", l)
	}
}

type testLogWriter struct{ t *testing.T }

func (w testLogWriter) Write(p []byte) (int, error) {
	w.t.Log(strings.TrimSpace(string(p)))
	return len(p), nil
}

func TestTerminalNewShellFindsInstalledToolWithOldServerPath(t *testing.T) {
	f := newTerminalFixture(t, true)
	w, _ := f.dial(t, "workspace_id="+f.id+"&shell=new")
	w.resize(t, 90, 30)
	w.waitReady(t)
	// Model a tmux server that survived an older daemon release.
	if _, err := f.host.run(context.Background(), f.host.socket(false), "set-environment", "-g", "PATH", "/usr/bin:/bin"); err != nil {
		t.Fatal(err)
	}
	bin := filepath.Join(f.cfg.Home, ".local", "bin")
	if err := os.MkdirAll(bin, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(bin, "installed-shell-probe"), []byte("#!/bin/sh\nprintf 'local-tool-%s\\n' works\n"), 0700); err != nil {
		t.Fatal(err)
	}
	next, _ := f.dial(t, "workspace_id="+f.id+"&shell=new")
	next.resize(t, 90, 30)
	next.waitReady(t)
	next.send(t, wsframe.OpBinary, "installed-shell-probe\r")
	if !next.until(t, "local-tool-works", 5*time.Second) {
		t.Fatalf("new shell did not find tool: %q", next.screen.String())
	}
}

func TestTerminalCreateFailureDiagnostic(t *testing.T) {
	for _, tc := range []struct{ stderr, want string }{
		{"duplicate session: private-workspace-1", "duplicate session: [redacted]"},
		{"create window failed: fork failed: Resource temporarily unavailable", "create window failed: [redacted]: Resource temporarily unavailable"},
		{"error connecting to /private/tmux.sock (Permission denied)", "error connecting to [redacted]: Permission denied"},
		{"error creating /private/tmux.sock (No space left on device)", "error creating [redacted]: No space left on device"},
		{"no server running on /private/tmux.sock", "no server running on [redacted]"},
		{"/private/.tmux.conf:1: secret-token", "unrecognized (redacted)"},
		{"server exited unexpectedly\n", "server exited unexpectedly"},
		{"", "empty"},
	} {
		if got := terminalCreateDiagnostic(tc.stderr); got != tc.want {
			t.Errorf("diagnostic(%q) = %q, want %q", tc.stderr, got, tc.want)
		}
	}
	home := t.TempDir()
	fake := filepath.Join(home, "tmux")
	if err := os.WriteFile(fake, []byte("#!/bin/sh\nprintf 'duplicate session: secret-workspace\\n' >&2\nexit 1\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	var logs bytes.Buffer
	h := &terminalHost{cfg: transport.Config{Home: home}, tmux: fake, log: slog.New(slog.NewJSONHandler(&logs, nil))}
	if _, err := h.run(context.Background(), "unused", "new-session"); err == nil {
		t.Fatal("native failure must remain a failure")
	}
	if !strings.Contains(logs.String(), "duplicate session: [redacted]") || strings.Contains(logs.String(), "secret-workspace") {
		t.Fatalf("missing safe tmux diagnostic: %s", &logs)
	}
}

// Exercise the real native formatter, including its version-specific printing
// layer. User options retain control bytes which rename-window itself may quote.
func TestTerminalInventoryFormat(t *testing.T) {
	f := newTerminalFixture(t, true)
	version, err := exec.Command(f.host.tmux, "-V").Output()
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("native %s", strings.TrimSpace(string(version)))
	socket := f.host.socket(false)
	if err := os.MkdirAll(filepath.Dir(socket), 0700); err != nil {
		t.Fatal(err)
	}
	run := func(args ...string) string {
		t.Helper()
		out, err := f.host.run(context.Background(), socket, args...)
		if err != nil {
			t.Fatalf("tmux %v: %v", args, err)
		}
		return string(out)
	}
	run("-f", "/dev/null", "new-session", "-d", "-s", "demo-1", "-c", f.dir)
	for _, value := range []string{"space name", `literal\037text`, "utf8-ä", "tab\tfield", "newline\ndemo-2\tfake\tbash", "control\x1ffield"} {
		run("set-option", "-g", "@field", value)
		out := run("list-sessions", "-F", terminalFormat("session_name", "@field", "pane_current_command"))
		if strings.ContainsAny(value, "\t\n\x1f") {
			if out != "\n" {
				t.Fatalf("control field manufactured output: %q", out)
			}
		} else {
			fields := strings.Split(strings.TrimSuffix(out, "\n"), "\t")
			if len(fields) != 3 || fields[0] != "demo-1" || fields[1] != value {
				t.Fatalf("field %q: %q", value, out)
			}
		}
	}
}

func TestTerminalInventoryIdentityBoundaries(t *testing.T) {
	f := newTerminalFixture(t, true)
	tf := filepath.Join(f.host.runtimeDir, "taskfleet")
	if err := os.MkdirAll(tf, 0700); err != nil {
		t.Fatal(err)
	}
	socket := filepath.Join(tf, "tmux-0123456789abcdef.sock")
	run := func(args ...string) string {
		t.Helper()
		out, err := f.host.run(context.Background(), socket, args...)
		if err != nil {
			t.Fatalf("tmux %v: %v", args, err)
		}
		return strings.TrimSuffix(string(out), "\n")
	}
	t.Cleanup(func() { _ = exec.Command(f.host.tmux, "-S", socket, "kill-server").Run() })
	run("-f", "/dev/null", "new-session", "-d", "-s", "agents", "-c", f.cfg.Home)
	// A literal old delimiter in a name remains text, not another identity.
	name := `literal\037@999\037not-another-window`
	win := run("new-window", "-d", "-P", "-F", "#{window_id}", "-t", "agents:", "-n", name, "-c", f.dir)
	// Both a sibling prefix and injected row/field material must stay outside
	// this workspace. Pane paths are raw native data, unlike window names.
	for _, path := range []string{f.dir + "-other", f.dir + `\037bash`, f.dir + "\tother", f.dir + "\nforged\t@999\tfake\t" + f.dir} {
		if err := os.MkdirAll(path, 0700); err != nil {
			t.Fatal(err)
		}
		run("new-window", "-d", "-t", "agents:", "-c", path)
	}
	rows := f.host.taskfleetWindows(context.Background(), f.dir)
	if len(rows) != 1 || rows[0].window != win || rows[0].Name != name {
		t.Fatalf("workspace identity confused: %+v", rows)
	}
}
