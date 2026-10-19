//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/core"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// The workspace editor is the person's own code-server, started on demand by
// this daemon as the person and stopped by code-server's own idle timeout.
// It listens only on a 0600 Unix socket in a 0700 directory, with code-server's
// authentication off: the socket's permissions and this daemon's relay, which
// only the gateway can reach, are its authentication. Nothing about the editor
// is stored here; code-server keeps its own data directory in the home.
const (
	EditorPath          = "/api/v1/editor"
	EditorStartPath     = "/api/v1/editor/start"
	EditorWorkspacePath = "/api/v1/editor/workspace"
	EditorOpenPath      = "/api/v1/editor/open"
	// EditorRelayPrefix carries every other request of the editor origin;
	// the rest of the path is code-server's.
	EditorRelayPrefix = "/editor-relay/"

	// EditorConfigPath names the operator's pinned code-server. It names no
	// person, so every user may read it; only root may write it.
	EditorConfigPath = "/opt/open-habitat/editor.json"

	editorUnit        = "open-habitat-editor"
	editorDefaultIdle = 30 * 60
	editorStartTime   = 30 * time.Second
	editorOpenTime    = 5 * time.Second
	editorOpenWait    = 10 * time.Second
)

//go:embed editor-extension/package.json editor-extension/extension.js
var editorExtension embed.FS

// EditorConfig is the operator's editor configuration.
type EditorConfig struct {
	// CodeServer is the absolute path of the pinned code-server launcher,
	// <release>/bin/code-server; its built-in extensions are found beside it.
	CodeServer string `json:"code_server"`
	// IdleTimeoutSeconds stops an editor nobody has used; the default is
	// half an hour.
	IdleTimeoutSeconds int `json:"idle_timeout_seconds,omitempty"`
}

// LoadEditorConfig reads EditorConfigPath. A missing file means the editor is
// not offered on this server; an untrusted or malformed one is reported and
// then treated the same way.
func LoadEditorConfig() (EditorConfig, error) { return loadEditorConfig(EditorConfigPath) }

func loadEditorConfig(path string) (EditorConfig, error) {
	data, err := core.ReadOperatorFile(path, 4096)
	if errors.Is(err, core.ErrOperatorFileMissing) {
		return EditorConfig{}, nil
	}
	if err != nil {
		return EditorConfig{}, err
	}
	var cfg EditorConfig
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if dec.Decode(&cfg) != nil || dec.Decode(new(any)) != io.EOF || !filepath.IsAbs(cfg.CodeServer) || filepath.Clean(cfg.CodeServer) != cfg.CodeServer || cfg.IdleTimeoutSeconds < 0 || cfg.IdleTimeoutSeconds > 7*24*3600 || cfg.IdleTimeoutSeconds > 0 && cfg.IdleTimeoutSeconds < 60 {
		return EditorConfig{}, errors.New("invalid editor configuration")
	}
	return cfg, nil
}

// trustedOperatorExecutable accepts a root-owned regular executable in
// root-owned directories nobody else can write, as the integrations do.
func trustedOperatorExecutable(path string) bool {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return false
	}
	var st unix.Stat_t
	if unix.Stat(path, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0111 == 0 || st.Uid != 0 || st.Mode&0022 != 0 {
		return false
	}
	for dir := filepath.Dir(path); ; dir = filepath.Dir(dir) {
		var d unix.Stat_t
		if unix.Stat(dir, &d) != nil || d.Uid != 0 || d.Mode&0022 != 0 {
			return false
		}
		if dir == "/" {
			return true
		}
	}
}

// editorHost is the person's editor: where its sockets live and how it is
// started. The zero values of the seams are production.
type editorHost struct {
	cfg    transport.Config
	binary string
	idle   int
	// runtimeDir is /run/user/<uid>. With lingering and a running user
	// manager the editor is a user service there and outlives the daemon.
	runtimeDir string
	lingerDir  string
	// privateDir is used otherwise: the daemon's PrivateTmp, so the editor
	// is the daemon's child and ends with it.
	privateDir string
	systemdRun string
	log        *slog.Logger
	ctx        context.Context
	// start, when set, starts the editor instead (the synthetic host). It
	// receives the directory whose code-server.sock it must serve.
	start func(dir string) error

	mu sync.Mutex
}

func newEditorHost(ctx context.Context, cfg transport.Config, log *slog.Logger) *editorHost {
	h := &editorHost{cfg: cfg, ctx: ctx, log: log,
		runtimeDir: "/run/user/" + strconv.Itoa(cfg.UID),
		lingerDir:  "/var/lib/systemd/linger",
		privateDir: filepath.Join(os.TempDir(), "open-habitat-editor-"+strconv.Itoa(cfg.UID)),
	}
	h.systemdRun, _ = exec.LookPath("systemd-run")
	operator, err := LoadEditorConfig()
	if err != nil {
		log.Warn("editor_config", "outcome", "ignored", "reason", "untrusted_configuration")
		return h
	}
	if operator.CodeServer == "" {
		return h
	}
	if !trustedOperatorExecutable(operator.CodeServer) {
		log.Warn("editor_config", "outcome", "ignored", "reason", "untrusted_executable")
		return h
	}
	h.binary, h.idle = operator.CodeServer, operator.IdleTimeoutSeconds
	if h.idle == 0 {
		h.idle = editorDefaultIdle
	}
	return h
}

func (h *editorHost) available() bool { return h.binary != "" || h.start != nil }

// survives reports whether the editor outlives a daemon restart: only when
// the person lingers and their user manager runs, as for the browser shell.
func (h *editorHost) survives() bool {
	if h.start != nil || h.runtimeDir == "" || h.systemdRun == "" {
		return false
	}
	if _, err := os.Stat(filepath.Join(h.lingerDir, h.cfg.Username)); err != nil {
		return false
	}
	info, err := os.Stat(filepath.Join(h.runtimeDir, "bus"))
	return err == nil && info.Mode()&os.ModeSocket != 0
}

func (h *editorHost) dir() string {
	if h.survives() {
		return filepath.Join(h.runtimeDir, "open-habitat", "editor")
	}
	return h.privateDir
}

func (h *editorHost) socket() string { return filepath.Join(h.dir(), "code-server.sock") }

// running asks code-server's own health route; a socket left behind by an
// editor that has exited refuses the connection.
func (h *editorHost) running(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "http://unix/healthz", nil)
	res, err := editorTransport(h.socket()).RoundTrip(req)
	if err != nil {
		return false
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 4096))
	res.Body.Close()
	return res.StatusCode == http.StatusOK
}

func editorTransport(socket string) *http.Transport {
	return &http.Transport{
		DisableKeepAlives:      true,
		MaxResponseHeaderBytes: 64 << 10,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, "unix", socket)
		},
	}
}

// env is the whole environment of code-server and what it starts: nothing of
// the daemon's own environment is passed on. Accounts may have a nologin
// login shell, so the integrated terminal's shell is named explicitly.
func (h *editorHost) env(dir string) []string {
	lang := os.Getenv("LANG")
	if lang == "" {
		lang = "C.UTF-8"
	}
	path := os.Getenv("PATH")
	if path == "" {
		path = "/usr/local/bin:/usr/bin:/bin"
	}
	env := []string{"HOME=" + h.cfg.Home, "USER=" + h.cfg.Username, "LOGNAME=" + h.cfg.Username, "SHELL=/bin/bash", "PATH=" + path, "LANG=" + lang, "OPEN_HABITAT_EDITOR_OPEN_DIR=" + filepath.Join(dir, "open")}
	if info, err := os.Stat(h.runtimeDir); err == nil && info.IsDir() {
		env = append(env, "XDG_RUNTIME_DIR="+h.runtimeDir)
	}
	return env
}

// prepare makes the editor's private directory: the open sockets of the
// extension and the built-in extensions, which are code-server's own linked
// beside Open Habitat's.
func (h *editorHost) prepare(dir string) error {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	var st unix.Stat_t
	if unix.Lstat(dir, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFDIR || int(st.Uid) != h.cfg.UID || st.Mode&0o077 != 0 {
		return errors.New("unsafe editor directory")
	}
	if err := os.MkdirAll(filepath.Join(dir, "open"), 0o700); err != nil {
		return err
	}
	if h.binary == "" {
		return nil
	}
	builtin := filepath.Join(dir, "builtin")
	if err := os.RemoveAll(builtin); err != nil {
		return err
	}
	if err := os.Mkdir(builtin, 0o700); err != nil {
		return err
	}
	own := filepath.Join(filepath.Dir(filepath.Dir(h.binary)), "lib", "vscode", "extensions")
	entries, err := os.ReadDir(own)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if e.Name() == "open-habitat-editor" {
			continue
		}
		if err := os.Symlink(filepath.Join(own, e.Name()), filepath.Join(builtin, e.Name())); err != nil {
			return err
		}
	}
	ext := filepath.Join(builtin, "open-habitat-editor")
	if err := os.Mkdir(ext, 0o700); err != nil {
		return err
	}
	return fs.WalkDir(editorExtension, "editor-extension", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		data, err := editorExtension.ReadFile(p)
		if err != nil {
			return err
		}
		return os.WriteFile(filepath.Join(ext, filepath.Base(p)), data, 0o600)
	})
}

func (h *editorHost) args(dir string) []string {
	return []string{"--auth", "none", "--socket", filepath.Join(dir, "code-server.sock"), "--socket-mode", "600",
		"--config", "/dev/null", "--disable-telemetry", "--disable-update-check", "--disable-getting-started-override",
		"--idle-timeout-seconds", strconv.Itoa(h.idle),
		"--vscode-option", "builtin-extensions-dir=" + filepath.Join(dir, "builtin")}
}

// ensure starts the editor if it is not running and waits until code-server
// answers. Reading the editor's state never calls this.
func (h *editorHost) ensure(ctx context.Context) (bool, error) {
	if !h.available() {
		return false, errEditorUnavailable
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.running(ctx) {
		return h.survives(), nil
	}
	survives := h.survives()
	dir := h.dir()
	if err := h.prepare(dir); err != nil {
		return false, err
	}
	// A socket left by an editor that exited would make code-server refuse
	// to start; it is inside the private directory, so it is ours to remove.
	_ = os.Remove(filepath.Join(dir, "code-server.sock"))
	switch {
	case h.start != nil:
		if err := h.start(dir); err != nil {
			return false, err
		}
	case survives:
		args := []string{"--user", "--quiet", "--collect", "--unit=" + editorUnit, "--description=Open Habitat workspace editor", "-p", "WorkingDirectory=" + h.cfg.Home}
		for _, kv := range h.env(dir) {
			args = append(args, "--setenv="+kv)
		}
		args = append(append(args, "--", h.binary), h.args(dir)...)
		cctx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		cmd := exec.CommandContext(cctx, h.systemdRun, args...)
		cmd.Env = append(h.env(dir), "DBUS_SESSION_BUS_ADDRESS=unix:path="+filepath.Join(h.runtimeDir, "bus"))
		cmd.Dir = h.cfg.Home
		// A unit of the same name that is still starting or stopping makes
		// this fail; only code-server's answer below says whether it runs.
		_ = cmd.Run()
	default:
		cmd := exec.Command(h.binary, h.args(dir)...)
		cmd.Env, cmd.Dir = h.env(dir), h.cfg.Home
		cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGKILL}
		if err := cmd.Start(); err != nil {
			return false, err
		}
		// code-server runs its server in a child of its own, which the
		// parent-death signal does not reach; the daemon's stop ends the
		// whole process group (systemd's KillMode=mixed also would).
		exited := make(chan struct{})
		go func() { _ = cmd.Wait(); close(exited) }()
		go func() {
			select {
			case <-h.ctx.Done():
				_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
			case <-exited:
			}
		}()
	}
	deadline := time.Now().Add(editorStartTime)
	for time.Now().Before(deadline) {
		if h.running(ctx) {
			h.log.Info("editor_start", "outcome", "accepted", "reason", map[bool]string{true: "user_service", false: "daemon_child"}[survives])
			return survives, nil
		}
		select {
		case <-ctx.Done():
			return false, ctx.Err()
		case <-time.After(100 * time.Millisecond):
		}
	}
	h.log.Warn("editor_start", "outcome", "failed", "reason", "not_ready")
	return false, errors.New("editor did not start")
}

var errEditorUnavailable = errors.New("editor unavailable")

// open asks the running windows' extension hosts, the most recently focused
// first, to show the file. It returns false when no window took it.
func (h *editorHost) open(ctx context.Context, file string, line, end int) bool {
	dir := filepath.Join(h.dir(), "open")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	type candidate struct {
		path string
		at   time.Time
	}
	var sockets []candidate
	for _, e := range entries {
		if !strings.HasPrefix(e.Name(), "open-") || !strings.HasSuffix(e.Name(), ".sock") {
			continue
		}
		info, err := e.Info()
		if err != nil || info.Mode()&os.ModeSocket == 0 {
			continue
		}
		sockets = append(sockets, candidate{filepath.Join(dir, e.Name()), info.ModTime()})
	}
	sort.Slice(sockets, func(i, j int) bool { return sockets[i].at.After(sockets[j].at) })
	request, _ := json.Marshal(map[string]any{"path": file, "line": line, "end_line": end})
	for _, s := range sockets {
		if askOpen(ctx, s.path, request) {
			return true
		}
	}
	return false
}

func askOpen(ctx context.Context, socket string, request []byte) bool {
	ctx, cancel := context.WithTimeout(ctx, editorOpenTime)
	defer cancel()
	conn, err := (&net.Dialer{}).DialContext(ctx, "unix", socket)
	if err != nil {
		return false
	}
	defer conn.Close()
	deadline, _ := ctx.Deadline()
	_ = conn.SetDeadline(deadline)
	if _, err := conn.Write(append(request, '\n')); err != nil {
		return false
	}
	reply, err := bufio.NewReaderSize(io.LimitReader(conn, 256), 256).ReadBytes('\n')
	if err != nil {
		return false
	}
	var answer struct {
		Opened bool `json:"opened"`
	}
	return json.Unmarshal(reply, &answer) == nil && answer.Opened
}

// workspaceDir is the checkout of a freshly discovered workspace or worktree
// place with this opaque ID. The browser never names the path; it reaches the
// editor origin only as code-server's own folder parameter.
func editorWorkspaceDir(cfg transport.Config, id string) (string, bool) {
	discovery := Discover(cfg)
	found := ""
	for _, entry := range discovery.Entries {
		if workspaceIDOf(cfg, entry) != id || entry.Error != "" || entry.Metadata == "error" {
			continue
		}
		if found != "" {
			return "", false
		}
		found = filepath.Join(cfg.Home, "src", entry.Name)
	}
	if found != "" {
		return found, true
	}
	if p, ok := findPlace(cfg, cfg.Home, discovery, id); ok {
		return p.Path, true
	}
	return "", false
}

// editorFile resolves a workspace-relative path from a conversation link to a
// regular file inside the workspace, refusing anything that leaves it,
// including through a symbolic link.
func editorFile(root, rel string) (string, bool) {
	if rel == "" || len(rel) > 1024 || filepath.IsAbs(rel) || strings.ContainsAny(rel, "\x00\\") {
		return "", false
	}
	clean := filepath.Clean(rel)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", false
	}
	base, err := unix.Open(root, unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return "", false
	}
	defer unix.Close(base)
	fd, err := unix.Openat2(base, clean, &unix.OpenHow{Flags: unix.O_PATH | unix.O_CLOEXEC, Resolve: unix.RESOLVE_BENEATH | unix.RESOLVE_NO_MAGICLINKS | unix.RESOLVE_NO_XDEV})
	if err != nil {
		return "", false
	}
	defer unix.Close(fd)
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG {
		return "", false
	}
	return filepath.Join(root, clean), true
}

// EditorHandler serves the editor's routes to the gateway: its state, its
// start, the folder redirect, file links and the relay to code-server.
func EditorHandler(ctx context.Context, cfg transport.Config, trusted func(*http.Request) bool, log *slog.Logger) http.Handler {
	return newEditorHost(ctx, cfg, log).handler(trusted)
}

// MountEditorFixture serves the editor routes in the synthetic browser host
// with a stand-in code-server that start serves on dir/code-server.sock.
func MountEditorFixture(ctx context.Context, mux *http.ServeMux, cfg transport.Config, trusted func(*http.Request) bool, dir, codeServer string, start func(dir string) error, log *slog.Logger) {
	h := &editorHost{cfg: cfg, ctx: ctx, log: log, privateDir: dir, start: start}
	if codeServer != "" {
		h.binary, h.idle, h.start = codeServer, editorDefaultIdle, nil
	}
	handler := h.handler(trusted)
	for _, p := range []string{EditorPath, EditorStartPath, EditorWorkspacePath, EditorOpenPath, EditorRelayPrefix} {
		mux.Handle(p, handler)
	}
}

func (h *editorHost) handler(trusted func(*http.Request) bool) http.Handler {
	relay := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.Out.URL = &url.URL{Scheme: "http", Host: "unix", Path: strings.TrimPrefix(pr.In.URL.Path, strings.TrimSuffix(EditorRelayPrefix, "/")), RawQuery: pr.In.URL.RawQuery}
			pr.Out.Host = "unix"
			// The gateway checked the editor origin exactly before relaying;
			// code-server's own check would compare it with this socket's
			// placeholder host.
			pr.Out.Header.Del("Origin")
		},
		Transport:     &dynamicEditorTransport{h: h},
		FlushInterval: -1,
		ErrorHandler: func(w http.ResponseWriter, _ *http.Request, _ error) {
			snapshotError(w, 503, "editor_not_running")
		},
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(h.cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		switch {
		case strings.HasPrefix(r.URL.Path, EditorRelayPrefix):
			if !h.available() {
				snapshotError(w, 404, "editor_unavailable")
				return
			}
			// The relay carries code-server's long-lived connections; the
			// daemon's own five-second deadlines are for its API.
			rc := http.NewResponseController(w)
			_ = rc.SetReadDeadline(time.Time{})
			_ = rc.SetWriteDeadline(time.Time{})
			relay.ServeHTTP(w, r)
		case r.URL.Path == EditorPath && r.Method == http.MethodGet && r.URL.RawQuery == "":
			state := "stopped"
			if !h.available() {
				state = "unavailable"
			} else if h.running(r.Context()) {
				state = "running"
			}
			editorJSON(w, map[string]any{"schema_version": 1, "state": state, "survives_restart": h.survives()})
		case r.URL.Path == EditorStartPath && r.Method == http.MethodPost && r.URL.RawQuery == "" && r.ContentLength <= 0:
			rc := http.NewResponseController(w)
			_ = rc.SetWriteDeadline(time.Now().Add(editorStartTime + 5*time.Second))
			ctx, cancel := context.WithTimeout(r.Context(), editorStartTime)
			defer cancel()
			survives, err := h.ensure(ctx)
			if errors.Is(err, errEditorUnavailable) {
				snapshotError(w, 404, "editor_unavailable")
				return
			}
			if err != nil {
				snapshotError(w, 503, "editor_start_failed")
				return
			}
			editorJSON(w, map[string]any{"schema_version": 1, "state": "running", "survives_restart": survives})
		case r.URL.Path == EditorWorkspacePath && r.Method == http.MethodGet:
			q := r.URL.Query()
			id := q.Get("workspace_id")
			if len(q) != 1 || !idPattern.MatchString(id) || r.URL.RawQuery != "workspace_id="+id {
				snapshotError(w, 400, "invalid_request")
				return
			}
			dir, ok := editorWorkspaceDir(h.cfg, id)
			if !ok {
				snapshotError(w, 404, "workspace_unavailable")
				return
			}
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("Location", "/?"+url.Values{"folder": {dir}}.Encode())
			w.WriteHeader(http.StatusSeeOther)
		case r.URL.Path == EditorOpenPath && r.Method == http.MethodPost && r.URL.RawQuery == "":
			var body struct {
				WorkspaceID string `json:"workspace_id"`
				Path        string `json:"path"`
				Line        int    `json:"line,omitempty"`
				EndLine     int    `json:"end_line,omitempty"`
			}
			if r.Header.Get("Content-Type") != "application/json" || r.ContentLength < 2 || r.ContentLength > 2048 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
			dec.DisallowUnknownFields()
			if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || !idPattern.MatchString(body.WorkspaceID) || body.Line < 0 || body.Line > 10_000_000 || body.EndLine < 0 || body.EndLine > 10_000_000 || body.EndLine != 0 && body.EndLine < body.Line {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if !h.available() {
				snapshotError(w, 404, "editor_unavailable")
				return
			}
			root, ok := editorWorkspaceDir(h.cfg, body.WorkspaceID)
			if !ok {
				snapshotError(w, 404, "workspace_unavailable")
				return
			}
			file, ok := editorFile(root, body.Path)
			if !ok {
				snapshotError(w, 404, "file_unavailable")
				return
			}
			if !h.running(r.Context()) {
				snapshotError(w, 409, "editor_not_running")
				return
			}
			// A window that has just loaded activates the extension a few
			// seconds later; a link pressed meanwhile waits for it.
			_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(editorOpenWait + 2*editorOpenTime))
			opened := false
			for deadline := time.Now().Add(editorOpenWait); !opened; {
				if opened = h.open(r.Context(), file, body.Line, body.EndLine); opened || time.Now().After(deadline) || r.Context().Err() != nil {
					break
				}
				time.Sleep(250 * time.Millisecond)
			}
			if !opened {
				snapshotError(w, 409, "editor_not_running")
				return
			}
			editorJSON(w, map[string]any{"schema_version": 1, "opened": true})
		default:
			snapshotError(w, 400, "invalid_request")
		}
	})
}

// dynamicEditorTransport dials the socket of wherever the editor runs now: a
// lingering person's editor may have been started by an earlier daemon.
type dynamicEditorTransport struct{ h *editorHost }

func (t *dynamicEditorTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	return editorTransport(t.h.socket()).RoundTrip(r)
}

func editorJSON(w http.ResponseWriter, body any) {
	b, _ := json.Marshal(body)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(b)
}
