//go:build linux

package daemon

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// fakeCodeServer is an executable that behaves as code-server does where the
// daemon depends on it: it records its arguments and environment, and its
// server runs in a forked child (as code-server's does) on the --socket path,
// answering /healthz and echoing request paths and headers.
const fakeCodeServer = `#!/usr/bin/env python3
import json, os, socket, sys, http.server, socketserver
args = sys.argv[1:]
record = os.environ["FAKE_RECORD"] if "FAKE_RECORD" in os.environ else os.path.join(os.path.dirname(args[args.index("--socket") + 1]), "record.json")
sock = args[args.index("--socket") + 1]
pid = os.fork()
if pid:
    with open(record + ".tmp", "w") as f:
        json.dump({"args": args, "env": dict(os.environ), "parent": os.getpid(), "child": pid}, f)
    os.rename(record + ".tmp", record)
    os.waitpid(pid, 0)
    sys.exit(0)
class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def do_GET(self):
        body = json.dumps({"path": self.path, "headers": dict(self.headers)}).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *a): pass
class S(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    def get_request(self):
        r, _ = self.socket.accept()
        return r, ("unix", 0)
S(sock, H).serve_forever()
`

func editorTestHost(t *testing.T) (*editorHost, transport.Config) {
	t.Helper()
	if _, err := exec.LookPath("python3"); err != nil {
		t.Skip("python3 is needed for the fake code-server")
	}
	root := t.TempDir()
	bin := filepath.Join(root, "code-server", "bin")
	ext := filepath.Join(root, "code-server", "lib", "vscode", "extensions", "git")
	for _, d := range []string{bin, ext} {
		if err := os.MkdirAll(d, 0o700); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(ext, "package.json"), []byte(`{"name":"git"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(bin, "code-server"), []byte(fakeCodeServer), 0o700); err != nil {
		t.Fatal(err)
	}
	home := filepath.Join(root, "home")
	if err := os.MkdirAll(filepath.Join(home, "src"), 0o700); err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{UID: os.Geteuid(), Username: "alice", Home: home}
	h := &editorHost{cfg: cfg, binary: filepath.Join(bin, "code-server"), idle: 600, privateDir: filepath.Join(root, "e"), log: slog.New(slog.NewTextHandler(io.Discard, nil)), ctx: context.Background()}
	return h, cfg
}

type fakeRecord struct {
	Args          []string          `json:"args"`
	Env           map[string]string `json:"env"`
	Parent, Child int
}

func readRecord(t *testing.T, path string) fakeRecord {
	t.Helper()
	var rec fakeRecord
	for i := 0; i < 100; i++ {
		data, err := os.ReadFile(path)
		if err == nil && json.Unmarshal(data, &rec) == nil {
			return rec
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("fake code-server left no record")
	return rec
}

func alivePID(pid int) bool { return syscall.Kill(pid, 0) == nil }

// The daemon's own child: started once, with authentication off on a private
// 0600 socket, the operator's idle stop, Open Habitat's built-in extension
// beside code-server's own, none of the daemon's environment, and the whole
// process group ended with the daemon, the forked server included.
func TestEditorStartsOnceAsChildAndStopsWithDaemon(t *testing.T) {
	h, _ := editorTestHost(t)
	ctx, stop := context.WithCancel(context.Background())
	defer stop()
	h.ctx = ctx
	t.Setenv("OPEN_HABITAT_DAEMON_SECRET", "must-not-leak")
	if h.running(ctx) {
		t.Fatal("running before start")
	}
	if survives, err := h.ensure(ctx); err != nil || survives {
		t.Fatalf("ensure: %v survives=%v", err, survives)
	}
	rec := readRecord(t, filepath.Join(h.privateDir, "record.json"))
	joined := strings.Join(rec.Args, " ")
	for _, want := range []string{"--auth none", "--socket " + filepath.Join(h.privateDir, "code-server.sock"), "--socket-mode 600", "--idle-timeout-seconds 600", "--reconnection-grace-time 600", "--config /dev/null", "builtin-extensions-dir=" + filepath.Join(h.privateDir, "builtin")} {
		if !strings.Contains(joined, want) {
			t.Errorf("argument %q missing from %q", want, joined)
		}
	}
	if _, leaked := rec.Env["OPEN_HABITAT_DAEMON_SECRET"]; leaked {
		t.Error("daemon environment reached code-server")
	}
	if rec.Env["SHELL"] != "/bin/bash" || rec.Env["HOME"] != h.cfg.Home || rec.Env["OPEN_HABITAT_EDITOR_OPEN_DIR"] != filepath.Join(h.privateDir, "open") {
		t.Errorf("environment: %v", rec.Env)
	}
	info, err := os.Stat(filepath.Join(h.privateDir, "code-server.sock"))
	if err != nil || info.Mode().Perm()&0o077 != 0 {
		t.Fatalf("socket mode: %v %v", info, err)
	}
	if dir, _ := os.Stat(h.privateDir); dir.Mode().Perm() != 0o700 {
		t.Fatalf("editor directory mode %v", dir.Mode())
	}
	for _, p := range []string{"builtin/git/package.json", "builtin/open-habitat-editor/extension.js", "builtin/open-habitat-editor/package.json"} {
		if _, err := os.Stat(filepath.Join(h.privateDir, p)); err != nil {
			t.Errorf("built-in extension %s: %v", p, err)
		}
	}
	if _, err := h.ensure(ctx); err != nil {
		t.Fatal(err)
	}
	if again := readRecord(t, filepath.Join(h.privateDir, "record.json")); again.Parent != rec.Parent {
		t.Fatal("a running editor was started again")
	}
	// A caller that went away while waiting, or an editor that does not
	// answer in time, says nothing about whether it runs: its socket stays.
	sock := filepath.Join(h.privateDir, "code-server.sock")
	before, _ := os.Stat(sock)
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := h.ensure(cancelled); err == nil {
		t.Fatal("a cancelled start reported success")
	}
	// A stopped server accepts connections (the kernel queues them) but
	// never answers: the probe times out.
	if err := syscall.Kill(rec.Child, syscall.SIGSTOP); err != nil {
		t.Fatal(err)
	}
	defer syscall.Kill(rec.Child, syscall.SIGCONT)
	if _, err := h.ensure(ctx); err == nil {
		t.Fatal("an editor that does not answer was reported running")
	}
	syscall.Kill(rec.Child, syscall.SIGCONT)
	after, err := os.Stat(sock)
	if err != nil || !os.SameFile(before, after) || readRecord(t, filepath.Join(h.privateDir, "record.json")).Parent != rec.Parent {
		t.Fatal("a live editor's socket was replaced")
	}
	stop()
	for deadline := time.Now().Add(5 * time.Second); alivePID(rec.Child) || alivePID(rec.Parent); {
		if time.Now().After(deadline) {
			t.Fatalf("editor outlived the daemon: parent %v child %v", alivePID(rec.Parent), alivePID(rec.Child))
		}
		time.Sleep(50 * time.Millisecond)
	}
}

// With lingering and a running user manager the editor is a transient user
// service, so it outlives a daemon restart; its socket is in the runtime
// directory, not the daemon's private /tmp.
func TestEditorStartsAsUserServiceWhenLingering(t *testing.T) {
	h, cfg := editorTestHost(t)
	// Unix socket paths are short; a test's own temporary directory is not.
	short, err := os.MkdirTemp("", "r")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(short) })
	runtime := filepath.Join(short, "run")
	linger := filepath.Join(t.TempDir(), "linger")
	for _, d := range []string{runtime, linger} {
		if err := os.MkdirAll(d, 0o700); err != nil {
			t.Fatal(err)
		}
	}
	bus, err := net.Listen("unix", filepath.Join(runtime, "bus"))
	if err != nil {
		t.Fatal(err)
	}
	defer bus.Close()
	if err := os.WriteFile(filepath.Join(linger, cfg.Username), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	// systemd-run stand-in: records its own arguments and runs the command
	// after "--" detached, as the user manager would.
	argv := filepath.Join(t.TempDir(), "systemd-run.args")
	run := filepath.Join(t.TempDir(), "systemd-run")
	if err := os.WriteFile(run, []byte("#!/bin/sh\nprintf '%s\\n' \"$@\" > "+argv+"\nwhile [ \"$1\" != -- ]; do shift; done; shift\nsetsid \"$@\" >/dev/null 2>&1 &\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	h.runtimeDir, h.lingerDir, h.systemdRun = runtime, linger, run
	survives, err := h.ensure(context.Background())
	if err != nil || !survives {
		t.Fatalf("ensure: %v survives=%v", err, survives)
	}
	dir := filepath.Join(runtime, "open-habitat", "editor")
	rec := readRecord(t, filepath.Join(dir, "record.json"))
	defer syscall.Kill(rec.Child, syscall.SIGKILL)
	defer syscall.Kill(rec.Parent, syscall.SIGKILL)
	data, _ := os.ReadFile(argv)
	args := strings.Split(strings.TrimSpace(string(data)), "\n")
	joined := strings.Join(args, " ")
	for _, want := range []string{"--user", "--collect", "--unit=" + editorUnit, "--setenv=OPEN_HABITAT_EDITOR_OPEN_DIR=" + filepath.Join(dir, "open"), "-- " + h.binary + " --auth none --socket " + filepath.Join(dir, "code-server.sock")} {
		if !strings.Contains(joined, want) {
			t.Errorf("systemd-run argument %q missing from %q", want, joined)
		}
	}
	if !h.running(context.Background()) {
		t.Fatal("editor not answering on the runtime socket")
	}
}

func TestEditorRelayStripsPrefixAndOrigin(t *testing.T) {
	h, _ := editorTestHost(t)
	ctx, stop := context.WithCancel(context.Background())
	defer stop()
	h.ctx = ctx
	trusted := func(*http.Request) bool { return true }
	handler := h.handler(trusted)
	// Not yet running: the relay says so rather than starting it.
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "http://unix/editor-relay/stable/static/x.js?v=1", nil)
	r.Host = "unix"
	handler.ServeHTTP(w, r)
	if w.Code != 503 || !strings.Contains(w.Body.String(), "editor_not_running") || h.running(ctx) {
		t.Fatalf("relay before start: %d %s", w.Code, w.Body)
	}
	if _, err := h.ensure(ctx); err != nil {
		t.Fatal(err)
	}
	w = httptest.NewRecorder()
	r = httptest.NewRequest("GET", "http://unix/editor-relay/stable/static/x.js?v=1", nil)
	r.Host = "unix"
	r.Header.Set("Origin", "https://code.example")
	r.Header.Set("Accept", "text/javascript")
	handler.ServeHTTP(w, r)
	var seen struct {
		Path    string            `json:"path"`
		Headers map[string]string `json:"headers"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &seen) != nil {
		t.Fatalf("relay: %d %s", w.Code, w.Body)
	}
	if seen.Path != "/stable/static/x.js?v=1" || seen.Headers["Origin"] != "" || seen.Headers["Accept"] != "text/javascript" {
		t.Fatalf("code-server saw %+v", seen)
	}
	// Only the gateway's peer reaches the relay.
	w = httptest.NewRecorder()
	r = httptest.NewRequest("GET", "http://unix/editor-relay/", nil)
	r.Host = "unix"
	h.handler(func(*http.Request) bool { return false }).ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatalf("untrusted peer: %d", w.Code)
	}
}

// The relay keeps an upgraded connection open past the daemon's own request
// deadlines, in both directions.
func TestEditorRelayUpgrade(t *testing.T) {
	dir := t.TempDir()
	ln, err := net.Listen("unix", filepath.Join(dir, "code-server.sock"))
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	go func() {
		c, err := ln.Accept()
		if err != nil {
			return
		}
		defer c.Close()
		br := bufio.NewReader(c)
		req, err := http.ReadRequest(br)
		if err != nil || req.Header.Get("Upgrade") != "echo" {
			return
		}
		io.WriteString(c, "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: echo\r\n\r\n")
		line, _ := br.ReadString('\n')
		io.WriteString(c, "echo:"+line)
	}()
	h := &editorHost{privateDir: dir, start: func(string) error { return nil }, log: slog.New(slog.NewTextHandler(io.Discard, nil)), ctx: context.Background()}
	srv := httptest.NewUnstartedServer(h.handler(func(*http.Request) bool { return true }))
	srv.Config.ReadTimeout, srv.Config.WriteTimeout = 200*time.Millisecond, 200*time.Millisecond
	srv.Start()
	defer srv.Close()
	c, err := net.Dial("tcp", srv.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	io.WriteString(c, "GET /editor-relay/ws HTTP/1.1\r\nHost: unix\r\nConnection: Upgrade\r\nUpgrade: echo\r\n\r\n")
	br := bufio.NewReader(c)
	res, err := http.ReadResponse(br, nil)
	if err != nil || res.StatusCode != 101 {
		t.Fatalf("upgrade: %v %v", res, err)
	}
	time.Sleep(400 * time.Millisecond) // past the server's own deadlines
	io.WriteString(c, "hello\n")
	_ = c.SetReadDeadline(time.Now().Add(2 * time.Second))
	if line, err := br.ReadString('\n'); err != nil || line != "echo:hello\n" {
		t.Fatalf("relayed upgrade: %q %v", line, err)
	}
}

func TestEditorFileStaysInsideWorkspace(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.MkdirAll(filepath.Join(root, "cmd"), 0o700))
	must(os.WriteFile(filepath.Join(root, "cmd", "main.go"), []byte("package main\n"), 0o600))
	must(os.WriteFile(filepath.Join(outside, "secret"), []byte("x"), 0o600))
	must(os.Symlink(filepath.Join(outside, "secret"), filepath.Join(root, "escape")))
	must(os.Symlink(outside, filepath.Join(root, "outdir")))
	must(os.Symlink("cmd/main.go", filepath.Join(root, "inside")))
	if p, ok := editorFile(root, "cmd/main.go"); !ok || p != filepath.Join(root, "cmd", "main.go") {
		t.Fatalf("workspace file: %q %v", p, ok)
	}
	if _, ok := editorFile(root, "inside"); !ok {
		t.Fatal("a link inside the workspace is still the workspace's file")
	}
	for _, rel := range []string{"../" + filepath.Base(outside) + "/secret", filepath.Join(outside, "secret"), "escape", "outdir/secret", "cmd", "missing.go", "", "cmd/../../x", "a\x00b"} {
		if p, ok := editorFile(root, rel); ok {
			t.Errorf("%q resolved to %q", rel, p)
		}
	}
}

// A file link reaches the most recently focused window that answers; a stale
// socket from a closed window is passed over.
func TestEditorOpenTriesFocusedWindowFirst(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "open"), 0o700); err != nil {
		t.Fatal(err)
	}
	got := make(chan string, 4)
	serve := func(name string, answer bool) string {
		path := filepath.Join(dir, "open", name)
		ln, err := net.Listen("unix", path)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { ln.Close() })
		go func() {
			for {
				c, err := ln.Accept()
				if err != nil {
					return
				}
				line, _ := bufio.NewReader(c).ReadString('\n')
				got <- name + " " + strings.TrimSpace(line)
				if answer {
					io.WriteString(c, `{"opened":true}`+"\n")
				}
				c.Close()
			}
		}()
		return path
	}
	older := serve("open-1.sock", true)
	newer := serve("open-2.sock", false)
	stale := filepath.Join(dir, "open", "open-3.sock")
	if ln, err := net.Listen("unix", stale); err == nil {
		ln.(*net.UnixListener).SetUnlinkOnClose(false)
		ln.Close()
	}
	now := time.Now()
	os.Chtimes(older, now.Add(-time.Minute), now.Add(-time.Minute))
	os.Chtimes(newer, now.Add(-time.Second), now.Add(-time.Second))
	os.Chtimes(stale, now, now)
	// A frame that started after every window activated is waiting for its
	// own window: the older windows are not asked.
	h := &editorHost{privateDir: dir, start: func(string) error { return nil }, framed: now.Add(time.Minute)}
	if h.open(context.Background(), "/w/cmd/main.go", 3, 4) || len(got) != 0 {
		t.Fatal("a window older than the latest frame took the file")
	}
	h.framed = now.Add(-2 * time.Minute)
	if !h.open(context.Background(), "/w/cmd/main.go", 3, 4) {
		t.Fatal("no window took the file")
	}
	first, second := <-got, <-got
	if !strings.HasPrefix(first, "open-2.sock ") || !strings.HasPrefix(second, "open-1.sock ") {
		t.Fatalf("order: %q, %q", first, second)
	}
	var req map[string]any
	if json.Unmarshal([]byte(strings.TrimPrefix(second, "open-1.sock ")), &req) != nil || req["path"] != "/w/cmd/main.go" || req["line"] != float64(3) || req["end_line"] != float64(4) {
		t.Fatalf("request: %s", second)
	}
}

// The open route refuses paths outside the workspace before any window is
// asked, and an editor that has stopped is reported as such.
func TestEditorOpenRoute(t *testing.T) {
	h, cfg := editorTestHost(t)
	ws := filepath.Join(cfg.Home, "src", "proj")
	if err := os.MkdirAll(ws, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(ws, "a.go"), []byte("package a\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	id := ""
	for _, e := range Discover(cfg).Entries {
		if e.Name == "proj" {
			id = workspaceIDOf(cfg, e)
		}
	}
	if id == "" {
		t.Fatal("fixture workspace not discovered")
	}
	handler := h.handler(func(*http.Request) bool { return true })
	call := func(body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "http://unix"+EditorOpenPath, strings.NewReader(body))
		r.Host = "unix"
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	for body, code := range map[string]string{
		`{"workspace_id":"` + id + `","path":"../../etc/passwd"}`:           "file_unavailable",
		`{"workspace_id":"` + id + `","path":"/etc/passwd"}`:                "file_unavailable",
		`{"workspace_id":"ws_missing123","path":"a.go"}`:                    "workspace_unavailable",
		`{"workspace_id":"` + id + `","path":"a.go","folder":"/"}`:          "invalid_request",
		`{"workspace_id":"` + id + `","path":"a.go","line":5,"end_line":2}`: "invalid_request",
		`{"workspace_id":"` + id + `","path":"a.go","line":1}`:              "editor_not_running",
	} {
		if w := call(body); !strings.Contains(w.Body.String(), `"`+code+`"`) {
			t.Errorf("%s: %d %s", body, w.Code, w.Body)
		}
	}
	// The folder redirect names the checkout only on the editor origin.
	r := httptest.NewRequest("GET", "http://unix"+EditorWorkspacePath+"?workspace_id="+id, nil)
	r.Host = "unix"
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != http.StatusSeeOther || w.Header().Get("Location") != "/?folder="+strings.ReplaceAll(strings.ReplaceAll(ws, "/", "%2F"), " ", "+") {
		t.Fatalf("folder redirect: %d %q", w.Code, w.Header().Get("Location"))
	}
}

func TestEditorUnavailableWithoutOperatorConfig(t *testing.T) {
	h := &editorHost{cfg: transport.Config{UID: os.Geteuid()}, privateDir: t.TempDir(), log: slog.New(slog.NewTextHandler(io.Discard, nil)), ctx: context.Background()}
	r := httptest.NewRequest("GET", "http://unix"+EditorPath, nil)
	r.Host = "unix"
	w := httptest.NewRecorder()
	h.handler(func(*http.Request) bool { return true }).ServeHTTP(w, r)
	if !strings.Contains(w.Body.String(), `"state":"unavailable"`) {
		t.Fatalf("status: %s", w.Body)
	}
	r = httptest.NewRequest("POST", "http://unix"+EditorStartPath, nil)
	r.Host = "unix"
	w = httptest.NewRecorder()
	h.handler(func(*http.Request) bool { return true }).ServeHTTP(w, r)
	if w.Code != 404 {
		t.Fatalf("start without an editor: %d", w.Code)
	}
}

// A single handler must observe installation changes without restarting the
// person's daemon; reads still must not start code-server.
func TestEditorDiscoversOperatorChanges(t *testing.T) {
	h, cfg := editorTestHost(t)
	operator := EditorConfig{}
	var loadErr error
	h.loadConfig = func() (EditorConfig, error) { return operator, loadErr }
	handler := h.handler(func(*http.Request) bool { return true })
	status := func(want string) {
		t.Helper()
		r := httptest.NewRequest("GET", "http://unix"+EditorPath, nil)
		r.Host = "unix"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"`+want+`"`) {
			t.Fatalf("status: %d %s", w.Code, w.Body)
		}
		if _, err := os.Stat(h.dir()); !os.IsNotExist(err) {
			t.Fatalf("status created editor directory: %v", err)
		}
	}
	status("unavailable")
	operator = EditorConfig{CodeServer: "/usr/bin/true"}
	if !trustedOperatorExecutable(operator.CodeServer) {
		t.Fatal("test requires a trusted /usr/bin/true")
	}
	status("stopped")
	// A replacement must pass the same executable trust check as at startup.
	operator.CodeServer = filepath.Join(cfg.Home, "untrusted-code-server")
	if err := os.WriteFile(operator.CodeServer, []byte("#!/bin/sh\n"), 0o777); err != nil {
		t.Fatal(err)
	}
	status("unavailable")
	operator.CodeServer = "/usr/bin/true"
	loadErr = io.ErrUnexpectedEOF
	status("unavailable")
	if _, err := h.ensure(context.Background()); err != errEditorUnavailable {
		t.Fatalf("start with rejected config: %v", err)
	}
	loadErr = nil
	status("stopped")
	operator = EditorConfig{}
	status("unavailable")
}

func TestEditorStopEndsTheNativeServerAndItsChild(t *testing.T) {
	h, _ := editorTestHost(t)
	ctx, cancel := context.WithCancel(context.Background())
	h.ctx = ctx
	t.Cleanup(cancel)
	if _, err := h.ensure(context.Background()); err != nil {
		t.Fatal(err)
	}
	rec := readRecord(t, filepath.Join(h.privateDir, "record.json"))
	request := func(body string, trusted bool) int {
		t.Helper()
		r := httptest.NewRequest("POST", "http://unix"+EditorStopPath, strings.NewReader(body))
		w := httptest.NewRecorder()
		h.handler(func(*http.Request) bool { return trusted }).ServeHTTP(w, r)
		return w.Code
	}
	if code := request("", false); code != 403 {
		t.Fatalf("untrusted stop: %d", code)
	}
	if code := request(`{"pid":1}`, true); code != 400 {
		t.Fatalf("body accepted: %d", code)
	}
	if !h.running(context.Background()) {
		t.Fatal("refused request stopped editor")
	}
	if code := request("", true); code != 200 {
		t.Fatalf("stop: %d", code)
	}
	if h.probe(context.Background()) != editorGone {
		t.Fatalf("editor child %d still serving after stop reply", rec.Child)
	}
	if code := request("", true); code != 200 && code != 409 {
		// A reaper briefly owning the lifecycle lock may refuse a second stop.
		t.Fatalf("repeat stop: %d", code)
	}
}

func TestEditorCancelledStartupKeepsChildOwnership(t *testing.T) {
	h, _ := editorTestHost(t)
	lifetime, cancel := context.WithCancel(context.Background())
	h.ctx = lifetime
	t.Cleanup(cancel)
	slow := strings.Replace(fakeCodeServer, "pid = os.fork()", "import time\nwhile not os.path.exists(os.path.join(os.path.dirname(sock), 'release')): time.sleep(0.01)\npid = os.fork()", 1)
	if err := os.WriteFile(h.binary, []byte(slow), 0700); err != nil {
		t.Fatal(err)
	}
	ctx, end := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer end()
	if _, err := h.ensure(ctx); err == nil {
		t.Fatal("slow startup unexpectedly completed")
	}
	h.mu.Lock()
	child := h.child
	h.mu.Unlock()
	if child == nil {
		t.Fatal("cancelled startup lost its child")
	}
	if _, err := h.ensure(context.Background()); err == nil {
		t.Fatal("replaced an editor still starting")
	}
	h.mu.Lock()
	same := h.child == child
	h.mu.Unlock()
	if !same {
		t.Fatal("retry replaced the existing child")
	}
	if err := os.WriteFile(filepath.Join(h.privateDir, "release"), nil, 0600); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(3 * time.Second)
	for !h.running(context.Background()) && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}
	if !h.running(context.Background()) {
		t.Fatal("original editor did not start")
	}
	if err := h.stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	if h.probe(context.Background()) != editorGone {
		t.Fatal("original editor survived stop")
	}
}

func TestEditorStopRefusesRatherThanQueuesBehindStartup(t *testing.T) {
	h, _ := editorTestHost(t)
	h.mu.Lock()
	result := make(chan error, 1)
	go func() { result <- h.stop(context.Background()) }()
	select {
	case err := <-result:
		h.mu.Unlock()
		if err != errEditorBusy {
			t.Fatalf("contended stop: %v", err)
		}
	case <-time.After(time.Second):
		h.mu.Unlock()
		<-result
		t.Fatal("stop waited behind startup instead of refusing")
	}
}
