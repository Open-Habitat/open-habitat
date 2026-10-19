//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"github.com/Open-Habitat/open-habitat/internal/wsframe"
)

// The browser shell (implement-browser-shell, research-shell-editor). A shell
// is a tmux session on the product's own tmux server, run as this person in a
// workspace directory; tmux, not the daemon, is what keeps it alive when the
// browser goes away, so the daemon stores nothing about shells. A browser tab
// is one tmux session, so `exit` ends the tab and two devices attached to the
// same shell see the same screen, as two tmux clients would.
const (
	TerminalsPath     = "/api/v1/workspaces/terminals"
	TerminalClosePath = "/api/v1/workspaces/terminals/close"
	TerminalPath      = "/api/v1/workspaces/terminal"
)

const (
	terminalFrameLimit  = 64 << 10
	terminalShellLimit  = 16
	terminalConnLimit   = 16
	terminalPing        = 25 * time.Second
	terminalIdle        = 75 * time.Second
	terminalFirstResize = 10 * time.Second
	terminalCommandTime = 4 * time.Second
	terminalShell       = "/bin/bash"
	terminalUnit        = "open-habitat-tmux"
)

var (
	terminalShellParam = regexp.MustCompile(`^[1-9][0-9]{0,2}$`)
	// A Taskfleet window is named by its server's socket hash and tmux window
	// number, never by a socket path or session name from the browser.
	terminalTaskfleetParam = regexp.MustCompile(`^([0-9a-f]{8,64})-([0-9]{1,6})$`)
	taskfleetSocketName    = regexp.MustCompile(`^tmux-([0-9a-f]{8,64})\.sock$`)
	terminalSlugUnsafe     = regexp.MustCompile(`[^A-Za-z0-9_-]+`)
)

// terminalHost is the person's shells: where the product tmux server lives
// and how it is started. The zero values of the seams are production.
type terminalHost struct {
	cfg  transport.Config
	tmux string
	// runtimeDir is /run/user/<uid>; with lingering and a running user
	// manager, the tmux server is a user service there and outlives the daemon.
	runtimeDir string
	lingerDir  string
	// privateDir holds the socket of a tmux server that is the daemon's own
	// child (no lingering): the daemon's PrivateTmp, gone with the daemon.
	privateDir string
	systemdRun string
	log        *slog.Logger
	// startServer, when set, starts the server instead (the synthetic host).
	startServer func(socket string) error

	mu    sync.Mutex
	conns int
	ctx   context.Context
}

func newTerminalHost(ctx context.Context, cfg transport.Config, log *slog.Logger) *terminalHost {
	tmux, _ := exec.LookPath("tmux")
	run, _ := exec.LookPath("systemd-run")
	return &terminalHost{
		cfg: cfg, tmux: tmux, systemdRun: run, log: log, ctx: ctx,
		runtimeDir: "/run/user/" + strconv.Itoa(cfg.UID),
		lingerDir:  "/var/lib/systemd/linger",
		privateDir: filepath.Join(os.TempDir(), "open-habitat-tmux-"+strconv.Itoa(cfg.UID)),
	}
}

// survives reports whether shells outlive a daemon restart: only when the
// person lingers and their user manager is running, so systemd-run --user
// can hold the tmux server outside the daemon's cgroup and PrivateTmp.
func (h *terminalHost) survives() bool {
	if h.runtimeDir == "" || h.lingerDir == "" || h.systemdRun == "" {
		return false
	}
	if _, err := os.Stat(filepath.Join(h.lingerDir, h.cfg.Username)); err != nil {
		return false
	}
	info, err := os.Stat(filepath.Join(h.runtimeDir, "bus"))
	return err == nil && info.Mode()&os.ModeSocket != 0
}

func (h *terminalHost) socket(survives bool) string {
	if survives {
		return filepath.Join(h.runtimeDir, "open-habitat", "tmux.sock")
	}
	return filepath.Join(h.privateDir, "tmux.sock")
}

// env is the whole environment of tmux and the shells it starts: nothing of
// the daemon's own environment is passed on. Accounts may have a nologin
// login shell, so the shell is named explicitly.
func (h *terminalHost) env() []string {
	lang := os.Getenv("LANG")
	if lang == "" {
		lang = "C.UTF-8"
	}
	path := os.Getenv("PATH")
	if path == "" {
		path = "/usr/local/bin:/usr/bin:/bin"
	}
	env := []string{"HOME=" + h.cfg.Home, "USER=" + h.cfg.Username, "LOGNAME=" + h.cfg.Username, "SHELL=" + terminalShell, "PATH=" + path, "LANG=" + lang, "TERM=xterm-256color"}
	if h.runtimeDir != "" {
		if info, err := os.Stat(h.runtimeDir); err == nil && info.IsDir() {
			env = append(env, "XDG_RUNTIME_DIR="+h.runtimeDir)
		}
	}
	return env
}

// Targets: "=name" (exact session name) is accepted only where tmux expects
// a session; commands chained after new-session act on the new session
// without one.
func (h *terminalHost) command(ctx context.Context, socket string, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, h.tmux, append([]string{"-S", socket}, args...)...)
	cmd.Env = h.env()
	cmd.Dir = h.cfg.Home
	return cmd
}

// run returns tmux's stdout, bounded; its stderr is native text and is never
// passed on.
func (h *terminalHost) run(ctx context.Context, socket string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, terminalCommandTime)
	defer cancel()
	cmd := h.command(ctx, socket, args...)
	var out limitedBuffer
	out.limit = 256 << 10
	cmd.Stdout = &out
	err := cmd.Run()
	if out.over {
		return nil, errors.New("tmux output too large")
	}
	return out.Bytes(), err
}

type limitedBuffer struct {
	bytes.Buffer
	limit int
	over  bool
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
	if b.Len()+len(p) > b.limit {
		b.over = true
		return len(p), nil
	}
	return b.Buffer.Write(p)
}

func alive(socket string) bool {
	c, err := net.DialTimeout("unix", socket, time.Second)
	if err != nil {
		return false
	}
	c.Close()
	return true
}

// ensureServer starts the product tmux server if it is not running. Reading
// never calls this: listing shells starts nothing.
func (h *terminalHost) ensureServer(ctx context.Context) (string, bool, error) {
	survives := h.survives()
	socket := h.socket(survives)
	h.mu.Lock()
	defer h.mu.Unlock()
	if alive(socket) {
		return socket, survives, nil
	}
	if err := os.MkdirAll(filepath.Dir(socket), 0o700); err != nil {
		return "", false, err
	}
	if h.startServer != nil {
		if err := h.startServer(socket); err != nil {
			return "", false, err
		}
		return socket, survives, waitAlive(socket)
	}
	if !survives {
		// tmux starts its own server for the first session; it stays in the
		// daemon's cgroup and private /tmp and ends with the daemon.
		return socket, false, nil
	}
	args := []string{"--user", "--quiet", "--collect", "--unit=" + terminalUnit, "--description=Open Habitat browser shells", "-p", "WorkingDirectory=" + h.cfg.Home}
	for _, kv := range h.env() {
		if !strings.HasPrefix(kv, "TERM=") {
			args = append(args, "--setenv="+kv)
		}
	}
	args = append(args, "--", h.tmux, "-D", "-S", socket)
	cctx, cancel := context.WithTimeout(ctx, terminalCommandTime)
	defer cancel()
	cmd := exec.CommandContext(cctx, h.systemdRun, args...)
	cmd.Env = append(h.env(), "DBUS_SESSION_BUS_ADDRESS=unix:path="+filepath.Join(h.runtimeDir, "bus"))
	cmd.Dir = h.cfg.Home
	// A unit of the same name that already runs is the server starting; only
	// its socket says whether it is ready.
	_ = cmd.Run()
	return socket, true, waitAlive(socket)
}

func waitAlive(socket string) error {
	for deadline := time.Now().Add(3 * time.Second); time.Now().Before(deadline); time.Sleep(50 * time.Millisecond) {
		if alive(socket) {
			return nil
		}
	}
	return errors.New("tmux server did not start")
}

// MountTerminalFixture serves the shell routes in the synthetic browser
// host. Its tmux server is the host's own child on a socket under dir, so it
// ends with the host; lingering is never detected there.
func MountTerminalFixture(ctx context.Context, mux *http.ServeMux, cfg transport.Config, trusted func(*http.Request) bool, dir string, log *slog.Logger) {
	tmux, _ := exec.LookPath("tmux")
	h := &terminalHost{cfg: cfg, tmux: tmux, ctx: ctx, privateDir: dir, log: log}
	h.startServer = func(socket string) error {
		cmd := exec.Command(tmux, "-D", "-S", socket)
		cmd.Env, cmd.Dir = h.env(), cfg.Home
		cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true, Pdeathsig: syscall.SIGKILL}
		if err := cmd.Start(); err != nil {
			return err
		}
		go func() { _ = cmd.Wait() }()
		return nil
	}
	mux.Handle(TerminalsPath, h.TerminalsHandler(trusted))
	mux.Handle(TerminalClosePath, h.TerminalCloseHandler(trusted))
	mux.Handle(TerminalPath, h.TerminalHandler(trusted))
}

// terminalWorkspace resolves an opaque workspace ID to its directory against
// a fresh discovery: a workspace under ~/src or a worktree place of one.
func terminalWorkspace(cfg transport.Config, id string) (dir, slug string, ok bool) {
	discovery := Discover(cfg)
	found := 0
	for _, entry := range discovery.Entries {
		if workspaceIDOf(cfg, entry) == id && entry.Error == "" && entry.Kind != "unknown" && entry.Metadata != "error" {
			dir, slug = filepath.Join(cfg.Home, "src", entry.Name), entry.Name
			found++
		}
	}
	if found > 1 {
		return "", "", false
	}
	if found == 0 {
		p, ok := findPlace(cfg, cfg.Home, discovery, id)
		if !ok {
			return "", "", false
		}
		dir, slug = p.Path, filepath.Base(p.Path)
	}
	slug = strings.Trim(terminalSlugUnsafe.ReplaceAllString(slug, "_"), "_")
	if len(slug) > 32 {
		slug = slug[:32]
	}
	if slug == "" {
		slug = "workspace"
	}
	// The ID suffix keeps two workspaces with the same directory name apart.
	return dir, slug + "-" + id[3:9], true
}

type terminalShellRow struct {
	Shell   string `json:"shell"`
	Name    string `json:"name"`
	Busy    bool   `json:"busy"`
	Command string `json:"command,omitempty"`
}
type terminalTaskfleetRow struct {
	Token   string `json:"token"`
	Name    string `json:"name"`
	Session string `json:"session"`
	Busy    bool   `json:"busy"`
	Command string `json:"command,omitempty"`
}
type terminalList struct {
	SchemaVersion   int                    `json:"schema_version"`
	WorkspaceID     string                 `json:"workspace_id"`
	SurvivesRestart bool                   `json:"survives_restart"`
	Shells          []terminalShellRow     `json:"shells"`
	Taskfleet       []terminalTaskfleetRow `json:"taskfleet"`
}

const sep = "\x1f"

// tmuxText keeps a tmux-reported name to printable UTF-8 of bounded length.
func tmuxText(s string, max int) string {
	s = strings.ToValidUTF8(s, "")
	s = strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return -1
		}
		return r
	}, s)
	for len(s) > max {
		_, n := utf8.DecodeLastRuneInString(s)
		s = s[:len(s)-n]
	}
	return s
}

var interactiveShells = map[string]bool{"bash": true, "sh": true, "dash": true, "zsh": true, "fish": true, "ksh": true}

func busyCommand(cmd string) (bool, string) {
	cmd = tmuxText(cmd, 64)
	if cmd == "" || interactiveShells[strings.TrimPrefix(cmd, "-")] {
		return false, ""
	}
	return true, cmd
}

// shells lists the workspace's shells on the product server. No server means
// no shells; listing never starts one.
func (h *terminalHost) shells(ctx context.Context, socket, base string) ([]terminalShellRow, error) {
	rows := []terminalShellRow{}
	if !alive(socket) {
		return rows, nil
	}
	out, err := h.run(ctx, socket, "list-sessions", "-F", "#{session_name}"+sep+"#{window_name}"+sep+"#{pane_current_command}")
	if err != nil {
		// A server with no sessions left exits; between the dial and the
		// list it is the same as none.
		if !alive(socket) {
			return rows, nil
		}
		return nil, err
	}
	for _, line := range strings.Split(string(out), "\n") {
		f := strings.Split(line, sep)
		if len(f) != 3 || !strings.HasPrefix(f[0], base+"-") || !terminalShellParam.MatchString(strings.TrimPrefix(f[0], base+"-")) {
			continue
		}
		busy, cmd := busyCommand(f[2])
		rows = append(rows, terminalShellRow{Shell: strings.TrimPrefix(f[0], base+"-"), Name: tmuxText(f[1], 128), Busy: busy, Command: cmd})
	}
	sort.Slice(rows, func(i, j int) bool {
		a, _ := strconv.Atoi(rows[i].Shell)
		b, _ := strconv.Atoi(rows[j].Shell)
		return a < b
	})
	return rows, nil
}

type taskfleetWindow struct {
	terminalTaskfleetRow
	socket string
	window string
}

// taskfleetWindows lists the windows on Taskfleet's tmux servers whose pane
// works in this workspace or its worktrees. Taskfleet owns them; the browser
// may only watch them (read-only attach).
func (h *terminalHost) taskfleetWindows(ctx context.Context, dir string) []taskfleetWindow {
	rows := []taskfleetWindow{}
	if h.runtimeDir == "" {
		return rows
	}
	root := filepath.Join(h.runtimeDir, "taskfleet")
	entries, err := os.ReadDir(root)
	if err != nil {
		return rows
	}
	seen := map[string]bool{}
	for _, e := range entries {
		m := taskfleetSocketName.FindStringSubmatch(e.Name())
		if m == nil || e.Type()&os.ModeSocket == 0 {
			continue
		}
		socket := filepath.Join(root, e.Name())
		if !alive(socket) {
			continue
		}
		out, err := h.run(ctx, socket, "list-windows", "-a", "-F", "#{session_name}"+sep+"#{window_id}"+sep+"#{window_name}"+sep+"#{pane_current_path}"+sep+"#{pane_current_command}")
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(out), "\n") {
			f := strings.Split(line, sep)
			if len(f) != 5 || strings.HasPrefix(f[0], "oh-ro-") || !strings.HasPrefix(f[1], "@") {
				continue
			}
			path := filepath.Clean(f[3])
			if path != dir && !strings.HasPrefix(path, dir+"/") && !strings.HasPrefix(path, dir+"__worktrees/") {
				continue
			}
			token := m[1] + "-" + strings.TrimPrefix(f[1], "@")
			if !terminalTaskfleetParam.MatchString(token) || seen[token] {
				continue
			}
			if len(rows) >= 200 {
				break
			}
			seen[token] = true
			busy, cmd := busyCommand(f[4])
			rows = append(rows, taskfleetWindow{terminalTaskfleetRow{Token: token, Name: tmuxText(f[2], 128), Session: tmuxText(f[0], 64), Busy: busy, Command: cmd}, socket, f[1]})
		}
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Token < rows[j].Token })
	return rows
}

func terminalJSON(w http.ResponseWriter, body any) {
	b, err := json.Marshal(body)
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	w.WriteHeader(200)
	_, _ = w.Write(b)
}

// TerminalsHandler lists a workspace's shells and the Taskfleet windows
// working in it. It reads tmux and starts nothing.
func (h *terminalHost) TerminalsHandler(trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(h.cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		q := r.URL.Query()
		id := q.Get("workspace_id")
		if r.Method != http.MethodGet || r.URL.Path != TerminalsPath || r.URL.EscapedPath() != TerminalsPath || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || len(q) != 1 || len(q["workspace_id"]) != 1 || !idPattern.MatchString(id) || r.URL.RawQuery != "workspace_id="+id {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if h.tmux == "" {
			snapshotError(w, 503, "terminal_unavailable")
			return
		}
		dir, base, ok := terminalWorkspace(h.cfg, id)
		if !ok {
			snapshotError(w, 404, "workspace_unavailable")
			return
		}
		survives := h.survives()
		shells, err := h.shells(r.Context(), h.socket(survives), base)
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		list := terminalList{SchemaVersion: 1, WorkspaceID: id, SurvivesRestart: survives, Shells: shells, Taskfleet: []terminalTaskfleetRow{}}
		for _, t := range h.taskfleetWindows(r.Context(), dir) {
			list.Taskfleet = append(list.Taskfleet, t.terminalTaskfleetRow)
		}
		terminalJSON(w, list)
	})
}

// TerminalCloseHandler ends one shell: its tmux session and everything in it.
// Taskfleet windows cannot be closed from here.
func (h *terminalHost) TerminalCloseHandler(trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(h.cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodPost || r.URL.Path != TerminalClosePath || r.URL.RawQuery != "" || r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 256 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var body struct {
			WorkspaceID string `json:"workspace_id"`
			Shell       string `json:"shell"`
		}
		dec := json.NewDecoder(io.LimitReader(r.Body, 256))
		dec.DisallowUnknownFields()
		if dec.Decode(&body) != nil || dec.More() || !idPattern.MatchString(body.WorkspaceID) || !terminalShellParam.MatchString(body.Shell) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if h.tmux == "" {
			snapshotError(w, 503, "terminal_unavailable")
			return
		}
		_, base, ok := terminalWorkspace(h.cfg, body.WorkspaceID)
		if !ok {
			snapshotError(w, 404, "workspace_unavailable")
			return
		}
		socket := h.socket(h.survives())
		name := base + "-" + body.Shell
		if !alive(socket) {
			snapshotError(w, 404, "shell_ended")
			return
		}
		if _, err := h.run(r.Context(), socket, "has-session", "-t", "="+name); err != nil {
			snapshotError(w, 404, "shell_ended")
			return
		}
		if _, err := h.run(r.Context(), socket, "kill-session", "-t", "="+name); err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		h.log.Info("terminal_close", "outcome", "closed", "workspace", body.WorkspaceID, "kind", "shell", "reason", "closed_by_person")
		terminalJSON(w, map[string]any{"schema_version": 1, "workspace_id": body.WorkspaceID, "shell": body.Shell, "closed": true})
	})
}

// terminalTarget is what one connection attaches to.
type terminalTarget struct {
	workspace string
	dir, base string
	shell     string // "new" or a number
	taskfleet *taskfleetWindow
}

func (h *terminalHost) reserve() bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.conns >= terminalConnLimit {
		return false
	}
	h.conns++
	return true
}

func (h *terminalHost) release() {
	h.mu.Lock()
	h.conns--
	h.mu.Unlock()
}

// TerminalHandler upgrades to a WebSocket and attaches a PTY to a shell or,
// read-only, to a Taskfleet window. The gateway has already checked Origin,
// the session and its CSRF proof; the daemon trusts only the gateway peer.
func (h *terminalHost) TerminalHandler(trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(h.cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		q := r.URL.Query()
		id := q.Get("workspace_id")
		shell, tf := q.Get("shell"), q.Get("taskfleet")
		valid := r.URL.Path == TerminalPath && r.URL.EscapedPath() == TerminalPath && wsframe.IsUpgrade(r) && len(q["workspace_id"]) == 1 && idPattern.MatchString(id)
		switch {
		case len(q) == 2 && len(q["shell"]) == 1 && (shell == "new" || terminalShellParam.MatchString(shell)):
			valid = valid && r.URL.RawQuery == "workspace_id="+id+"&shell="+shell
		case len(q) == 2 && len(q["taskfleet"]) == 1 && terminalTaskfleetParam.MatchString(tf):
			valid = valid && r.URL.RawQuery == "workspace_id="+id+"&taskfleet="+tf
		default:
			valid = false
		}
		if !valid {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if h.tmux == "" {
			snapshotError(w, 503, "terminal_unavailable")
			return
		}
		dir, base, ok := terminalWorkspace(h.cfg, id)
		if !ok {
			snapshotError(w, 404, "workspace_unavailable")
			return
		}
		target := terminalTarget{workspace: id, dir: dir, base: base, shell: shell}
		if tf != "" {
			for _, t := range h.taskfleetWindows(r.Context(), dir) {
				if t.Token == tf {
					t := t
					target.taskfleet = &t
				}
			}
			if target.taskfleet == nil {
				snapshotError(w, 404, "shell_ended")
				return
			}
		} else if shell != "new" {
			socket := h.socket(h.survives())
			if !alive(socket) {
				snapshotError(w, 404, "shell_ended")
				return
			}
			if _, err := h.run(r.Context(), socket, "has-session", "-t", "="+base+"-"+shell); err != nil {
				snapshotError(w, 404, "shell_ended")
				return
			}
		}
		if !h.reserve() {
			snapshotError(w, 503, "terminal_limit")
			return
		}
		defer h.release()
		conn, rw, err := http.NewResponseController(w).Hijack()
		if err != nil {
			return
		}
		defer conn.Close()
		// The server's request deadlines do not apply to the upgraded stream.
		_ = conn.SetDeadline(time.Time{})
		if _, err := conn.Write(wsframe.SwitchingProtocols(r.Header.Get("Sec-WebSocket-Key"))); err != nil {
			return
		}
		ws := &terminalConn{c: conn, r: rw.Reader}
		h.serve(ws, target)
	})
}

// terminalConn is the daemon end of one browser terminal connection.
type terminalConn struct {
	c   net.Conn
	r   *bufio.Reader
	wmu sync.Mutex
}

func (t *terminalConn) write(op byte, payload []byte) error {
	t.wmu.Lock()
	defer t.wmu.Unlock()
	_ = t.c.SetWriteDeadline(time.Now().Add(10 * time.Second))
	_, err := t.c.Write(wsframe.AppendFrame(nil, op, payload, false))
	return err
}

func (t *terminalConn) control(v any) error {
	b, _ := json.Marshal(v)
	return t.write(wsframe.OpText, b)
}

func (t *terminalConn) close(code uint16, reason string) {
	_ = t.write(wsframe.OpClose, wsframe.ClosePayload(code, reason))
}

// next returns the next data message, answering pings and assembling
// fragments; a close frame or protocol error ends the connection.
func (t *terminalConn) next() (byte, []byte, error) {
	var op byte
	var data []byte
	for {
		_ = t.c.SetReadDeadline(time.Now().Add(terminalIdle))
		f, err := wsframe.ReadFrame(t.r, terminalFrameLimit, true)
		if err != nil {
			return 0, nil, err
		}
		switch f.Op {
		case wsframe.OpPing:
			if err := t.write(wsframe.OpPong, f.Payload); err != nil {
				return 0, nil, err
			}
			continue
		case wsframe.OpPong:
			continue
		case wsframe.OpClose:
			t.close(1000, "")
			return 0, nil, io.EOF
		case wsframe.OpContinuation:
			if op == 0 || len(data)+len(f.Payload) > terminalFrameLimit {
				return 0, nil, wsframe.ErrProtocol
			}
			data = append(data, f.Payload...)
		default:
			if op != 0 {
				return 0, nil, wsframe.ErrProtocol
			}
			op, data = f.Op, f.Payload
		}
		if f.Fin {
			return op, data, nil
		}
	}
}

type terminalResize struct {
	Type string `json:"type"`
	Cols int    `json:"cols"`
	Rows int    `json:"rows"`
}

func parseResize(b []byte) (terminalResize, bool) {
	var m terminalResize
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	if dec.Decode(&m) != nil || dec.More() || m.Type != "resize" || m.Cols < 2 || m.Cols > 500 || m.Rows < 1 || m.Rows > 300 {
		return m, false
	}
	return m, true
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// serve runs one connection: the first message sizes the terminal, then
// bytes flow both ways until either side ends.
func (h *terminalHost) serve(ws *terminalConn, target terminalTarget) {
	kind := "shell"
	if target.taskfleet != nil {
		kind = "taskfleet"
	}
	logClose := func(outcome, reason string) {
		h.log.Info("terminal_close", "outcome", outcome, "workspace", target.workspace, "kind", kind, "reason", reason)
	}
	_ = ws.c.SetReadDeadline(time.Now().Add(terminalFirstResize))
	f, err := wsframe.ReadFrame(ws.r, 256, true)
	size, ok := parseResize(f.Payload)
	if err != nil || f.Op != wsframe.OpText || !f.Fin || !ok {
		ws.close(4400, "invalid_request")
		logClose("refused", "invalid_first_message")
		return
	}
	ctx, cancel := context.WithCancel(h.ctx)
	defer cancel()
	var cmd *exec.Cmd
	var socket, name, cleanup string
	var survives, readOnly bool
	switch {
	case target.taskfleet != nil:
		readOnly = true
		socket, name = target.taskfleet.socket, target.taskfleet.Name
		cleanup = "oh-ro-" + randomHex(4)
		// A view of its own in Taskfleet's session group, so the window shown
		// here never changes what Taskfleet's own clients show; ignore-size
		// keeps this client from resizing the agent's pane. The hook detaches
		// the view when its window goes away instead of showing another.
		_, err = h.run(ctx, socket, "new-session", "-d", "-t", "="+target.taskfleet.Session, "-s", cleanup, ";", "set-option", "status", "off", ";", "select-window", "-t", ":"+target.taskfleet.window)
		if err == nil {
			_, err = h.run(ctx, socket, "set-hook", "-t", cleanup, "session-window-changed", "detach-client")
		}
		if err != nil {
			_, _ = h.run(context.Background(), socket, "kill-session", "-t", "="+cleanup)
			ws.close(4404, "shell_ended")
			logClose("refused", "taskfleet_window_unavailable")
			return
		}
		// tmux honours ignore-size only while another client that does not
		// ignore it is attached. With nobody else watching, this client
		// would size the agent's window, so it takes the window's own size
		// and the browser adapts to it instead.
		out, err := h.run(ctx, socket, "display-message", "-p", "-t", cleanup+":", "#{window_width} #{window_height}")
		var cols, rows int
		if n, _ := fmt.Sscanf(strings.TrimSpace(string(out)), "%d %d", &cols, &rows); err != nil || n != 2 || cols < 2 || cols > 1000 || rows < 1 || rows > 1000 {
			ws.close(4404, "shell_ended")
			logClose("refused", "taskfleet_window_unavailable")
			return
		}
		size.Cols, size.Rows = cols, rows
		// The view is removed by the deferred kill-session below, never with
		// destroy-unattached: tmux 3.6 lost the whole server (every agent in
		// it) in about one run in five when that option met the detach hook.
		cmd = h.command(ctx, socket, "attach-session", "-t", "="+cleanup, "-f", "read-only,ignore-size")
	default:
		socket, survives, err = h.ensureServer(ctx)
		if err != nil {
			ws.close(4503, "terminal_unavailable")
			logClose("failed", "server_unavailable")
			return
		}
		shell := target.shell
		if shell == "new" {
			existing, err := h.shells(ctx, socket, target.base)
			if err != nil {
				ws.close(4503, "terminal_unavailable")
				logClose("failed", "list_failed")
				return
			}
			if len(existing) >= terminalShellLimit {
				ws.close(4409, "shell_limit")
				logClose("refused", "shell_limit")
				return
			}
			n := 1
			for _, s := range existing {
				if v, _ := strconv.Atoi(s.Shell); v >= n {
					n = v + 1
				}
			}
			shell = strconv.Itoa(n)
			sess := target.base + "-" + shell
			// The status line would cost a row and show tmux's own tabs
			// beside the panel's; mouse mode makes the wheel scroll tmux's
			// history. Both apply to this session only.
			if _, err := h.run(ctx, socket, "new-session", "-d", "-s", sess, "-c", target.dir, "-x", strconv.Itoa(size.Cols), "-y", strconv.Itoa(size.Rows), ";",
				"set-option", "status", "off", ";", "set-option", "mouse", "on"); err != nil {
				ws.close(4503, "terminal_unavailable")
				logClose("failed", "create_failed")
				return
			}
		}
		target.shell = shell
		name = target.base + "-" + shell
		cmd = h.command(ctx, socket, "attach-session", "-t", "="+name)
	}
	if cleanup != "" {
		defer func() { _, _ = h.run(context.Background(), socket, "kill-session", "-t", "="+cleanup) }()
	}
	pty, err := startOnPTY(cmd, size.Cols, size.Rows)
	if err != nil {
		ws.close(4503, "terminal_unavailable")
		logClose("failed", "pty_unavailable")
		return
	}
	waited := make(chan struct{})
	go func() { _ = cmd.Wait(); close(waited) }()
	defer func() {
		pty.Close()
		select {
		case <-waited:
		case <-time.After(2 * time.Second):
			_ = cmd.Process.Kill()
			<-waited
		}
	}()
	h.log.Info("terminal_open", "outcome", "opened", "workspace", target.workspace, "kind", kind, "survives_restart", survives)
	ready := map[string]any{"type": "ready", "read_only": readOnly, "survives_restart": survives}
	if target.taskfleet != nil {
		ready["taskfleet"] = target.taskfleet.Token
		ready["name"] = target.taskfleet.Name
		ready["cols"], ready["rows"] = size.Cols, size.Rows
	} else {
		ready["shell"] = target.shell
		if out, err := h.run(ctx, socket, "display-message", "-p", "-t", name+":", "#{window_name}"); err == nil {
			ready["name"] = tmuxText(strings.TrimSpace(string(out)), 128)
		}
	}
	if err := ws.control(ready); err != nil {
		logClose("closed", "browser_gone")
		return
	}

	done := make(chan string, 3)
	// PTY → browser.
	go func() {
		buf := make([]byte, 32<<10)
		for {
			n, err := pty.Read(buf)
			if n > 0 {
				if ws.write(wsframe.OpBinary, buf[:n]) != nil {
					done <- "browser_gone"
					return
				}
			}
			if err != nil {
				done <- "terminal_ended"
				return
			}
		}
	}()
	// Browser → PTY. A read-only view never writes to the terminal.
	go func() {
		for {
			op, data, err := ws.next()
			if err != nil {
				done <- "browser_gone"
				return
			}
			switch op {
			case wsframe.OpBinary:
				if !readOnly {
					if _, err := pty.Write(data); err != nil {
						done <- "terminal_ended"
						return
					}
				}
			case wsframe.OpText:
				if m, ok := parseResize(data); ok && !readOnly {
					_ = resizePTY(pty, m.Cols, m.Rows)
				}
			}
		}
	}()
	ping := time.NewTicker(terminalPing)
	defer ping.Stop()
	for {
		select {
		case reason := <-done:
			if reason == "terminal_ended" {
				// Whether the shell itself ended or someone detached this
				// client is tmux's to say, not the browser's to guess.
				ended := true
				if target.taskfleet == nil {
					if _, err := h.run(context.Background(), socket, "has-session", "-t", "="+name); err == nil {
						ended = false
					}
				}
				state := "detached"
				if ended {
					state = "ended"
				}
				_ = ws.control(map[string]any{"type": "exit", "state": state})
				ws.close(1000, state)
			} else {
				ws.close(1001, "")
			}
			logClose("closed", reason)
			return
		case <-ping.C:
			if ws.write(wsframe.OpPing, nil) != nil {
				logClose("closed", "browser_gone")
				return
			}
		case <-h.ctx.Done():
			ws.close(1001, "daemon_stopping")
			logClose("closed", "daemon_stopping")
			return
		}
	}
}
