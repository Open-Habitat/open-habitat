//go:build linux

package daemon

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/browserhost"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"github.com/Open-Habitat/open-habitat/internal/wsframe"
	"golang.org/x/sys/unix"
)

// The person's server browser (experimental): one per person, started on
// demand by this daemon as the person, like the editor, and stopped by the
// browser host itself after a day nobody used it. The host and its sockets
// are in browserhost; this file starts and stops it, answers the browser
// app's reads and requests by asking the host's control socket, relays the
// person's viewer to the display's VNC socket, and gives the person's agents
// the browser's state, its start and a way to ask the person for a window.
// Nothing about the browser is stored here.
const (
	BrowserPath        = "/api/v1/browser"
	BrowserStartPath   = "/api/v1/browser/start"
	BrowserStopPath    = "/api/v1/browser/stop"
	BrowserControlPath = "/api/v1/browser/control"
	BrowserWindowPath  = "/api/v1/browser/window"
	BrowserViewPath    = "/api/v1/browser/view"

	AgentBrowserPath        = "/agent/v1/browser"
	AgentBrowserStartPath   = "/agent/v1/browser/start"
	AgentBrowserRequestPath = "/agent/v1/browser/request"

	// BrowserFeature is the experimental switch in the person's preferences.
	BrowserFeature = "remote-browser"

	// The operator installs these as Ubuntu and Google packages; their
	// presence is what offers the browser on a server.
	browserXvnc   = "/usr/bin/Xtigervnc"
	browserChrome = "/opt/google/chrome/google-chrome"

	browserUnit      = "open-habitat-browser"
	browserStartTime = 40 * time.Second
	browserStopTime  = 20 * time.Second
	browserIdle      = 24 * time.Hour
	browserImageMax  = 4 << 20
	browserViewFrame = 1 << 20
	browserViewPing  = 25 * time.Second
	browserViewTouch = 5 * time.Minute
)

//go:embed browser-skill/SKILL.md
var browserSkill []byte

var errBrowserUnavailable = errors.New("browser unavailable")

type browserHost struct {
	cfg        transport.Config
	ctx        context.Context
	log        *slog.Logger
	runtimeDir string
	lingerDir  string
	privateDir string
	systemdRun string
	// self is this binary's launch path, which follows upgrades.
	self         string
	xvnc, chrome string
	trusted      func(string) bool
	feature      func() bool
	extraArgs    []string
	start        func(dir string) error

	mu    sync.Mutex
	child *exec.Cmd
}

func newBrowserHost(ctx context.Context, cfg transport.Config, log *slog.Logger) *browserHost {
	h := &browserHost{cfg: cfg, ctx: ctx, log: log,
		runtimeDir: "/run/user/" + strconv.Itoa(cfg.UID),
		lingerDir:  "/var/lib/systemd/linger",
		privateDir: filepath.Join(os.TempDir(), "open-habitat-browser-"+strconv.Itoa(cfg.UID)),
		xvnc:       browserXvnc, chrome: browserChrome, trusted: trustedOperatorExecutable,
	}
	h.systemdRun, _ = exec.LookPath("systemd-run")
	if exe, err := os.Executable(); err == nil {
		h.self = launchedExecutable(exe, os.Args[0])
	}
	h.feature = func() bool {
		p, err := readPreferences(cfg.Home)
		return err == nil && p.Experimental[BrowserFeature]
	}
	return h
}

// BrowserFixture is the synthetic host's browser: Start serves a host on
// Dir in-process, a stand-in or the real one.
type BrowserFixture struct {
	Dir   string
	Start func(dir string) error
}

// MountBrowserFixture serves the browser routes in the synthetic browser
// host and returns its agent routes.
func MountBrowserFixture(ctx context.Context, mux *http.ServeMux, cfg transport.Config, trusted func(*http.Request) bool, f BrowserFixture, log *slog.Logger) map[string]http.Handler {
	h := &browserHost{cfg: cfg, ctx: ctx, log: log, privateDir: f.Dir, start: f.Start, trusted: func(string) bool { return false }, feature: func() bool { return true }}
	h.mount(mux, trusted)
	return h.agentRoutes()
}

func (h *browserHost) mount(mux *http.ServeMux, trusted func(*http.Request) bool) {
	handler := h.handler(trusted)
	for _, p := range []string{BrowserPath, BrowserStartPath, BrowserStopPath, BrowserControlPath, BrowserWindowPath, BrowserViewPath} {
		mux.Handle(p, handler)
	}
}

func (h *browserHost) available() bool {
	if h.start != nil {
		return true
	}
	return h.self != "" && h.trusted(h.xvnc) && h.trusted(h.chrome)
}

// survives is the editor's rule: a user service only when the person
// lingers and their user manager runs.
func (h *browserHost) survives() bool {
	if h.start != nil || h.runtimeDir == "" || h.systemdRun == "" {
		return false
	}
	if _, err := os.Stat(filepath.Join(h.lingerDir, h.cfg.Username)); err != nil {
		return false
	}
	info, err := os.Stat(filepath.Join(h.runtimeDir, "bus"))
	return err == nil && info.Mode()&os.ModeSocket != 0
}

func (h *browserHost) dir() string {
	if h.survives() {
		return filepath.Join(h.runtimeDir, "open-habitat", "browser")
	}
	return h.privateDir
}

func (h *browserHost) control() *http.Client { return browserhost.ControlClient(h.dir()) }

// hostStatus asks the host; an error means it does not answer.
func (h *browserHost) hostStatus(ctx context.Context) (browserhost.Status, error) {
	var st browserhost.Status
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "http://browser"+browserhost.StatusPath, nil)
	res, err := h.control().Do(req)
	if err != nil {
		return st, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return st, errors.New("browser status failed")
	}
	dec := json.NewDecoder(io.LimitReader(res.Body, 256<<10))
	if err := dec.Decode(&st); err != nil {
		return st, err
	}
	return st, nil
}

// hostPost sends one request to the host and decodes its status reply.
func (h *browserHost) hostPost(ctx context.Context, path string, body any) (browserhost.Status, int, error) {
	var st browserhost.Status
	b, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "http://browser"+path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	res, err := h.control().Do(req)
	if err != nil {
		return st, 0, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return st, res.StatusCode, errors.New("browser refused")
	}
	return st, 200, json.NewDecoder(io.LimitReader(res.Body, 256<<10)).Decode(&st)
}

func (h *browserHost) running(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	_, err := h.hostStatus(ctx)
	return err == nil
}

func (h *browserHost) env() []string {
	lang := os.Getenv("LANG")
	if lang == "" {
		lang = "C.UTF-8"
	}
	env := []string{"HOME=" + h.cfg.Home, "USER=" + h.cfg.Username, "LOGNAME=" + h.cfg.Username, "LANG=" + lang, "PATH=/usr/local/bin:/usr/bin:/bin"}
	if info, err := os.Stat(h.runtimeDir); err == nil && info.IsDir() {
		env = append(env, "XDG_RUNTIME_DIR="+h.runtimeDir)
	}
	return env
}

func (h *browserHost) args(dir string) []string {
	args := []string{"daemon", "browser-host", "--dir", dir, "--xvnc", h.xvnc, "--chrome", h.chrome,
		"--profile", filepath.Join(h.cfg.Home, ".local", "share", "open-habitat", "browser", "profile"),
		"--cache", filepath.Join(h.cfg.Home, ".cache", "open-habitat", "browser"),
		"--idle-seconds", strconv.Itoa(int(browserIdle / time.Second))}
	return args
}

// ensure starts the browser if it is not running and waits until its host
// answers. Reading the browser's state never calls this.
func (h *browserHost) ensure(ctx context.Context) error {
	startedAt := time.Now()
	h.mu.Lock()
	defer h.mu.Unlock()
	if !h.available() {
		return errBrowserUnavailable
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if h.running(ctx) {
		return nil
	}
	// A host that answers slowly still holds the browser; only one that is
	// gone may be replaced.
	if !h.gone() {
		return errors.New("browser state unknown")
	}
	if h.child != nil {
		return errors.New("browser starting or stopping")
	}
	survives := h.survives()
	dir := h.dir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	var st unix.Stat_t
	if unix.Lstat(dir, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFDIR || int(st.Uid) != os.Getuid() || st.Mode&0o077 != 0 {
		return errors.New("unsafe browser directory")
	}
	switch {
	case h.start != nil:
		if err := h.start(dir); err != nil {
			return err
		}
	case survives:
		// One renderer's OOM kill must not stop the whole browser.
		args := []string{"--user", "--quiet", "--collect", "--unit=" + browserUnit, "--description=Open Habitat server browser", "-p", "WorkingDirectory=" + h.cfg.Home, "-p", "OOMPolicy=continue"}
		for _, kv := range h.env() {
			args = append(args, "--setenv="+kv)
		}
		args = append(append(args, "--", h.self), h.args(dir)...)
		cctx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		cmd := exec.CommandContext(cctx, h.systemdRun, args...)
		cmd.Env = append(h.env(), "DBUS_SESSION_BUS_ADDRESS=unix:path="+filepath.Join(h.runtimeDir, "bus"))
		cmd.Dir = h.cfg.Home
		_ = cmd.Run()
	default:
		cmd := exec.Command(h.self, h.args(dir)...)
		cmd.Env, cmd.Dir = h.env(), h.cfg.Home
		cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGTERM}
		if err := cmd.Start(); err != nil {
			return err
		}
		h.child = cmd
		go func() {
			_ = cmd.Wait()
			h.mu.Lock()
			if h.child == cmd {
				h.child = nil
			}
			h.mu.Unlock()
		}()
		go func() {
			<-h.ctx.Done()
			_ = cmd.Process.Signal(syscall.SIGTERM)
		}()
	}
	deadline := time.Now().Add(browserStartTime)
	for time.Now().Before(deadline) {
		if h.running(ctx) {
			h.log.Info("browser_start", "outcome", "accepted", "reason", map[bool]string{true: "user_service", false: "daemon_child"}[survives], "duration_ms", time.Since(startedAt).Milliseconds())
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(200 * time.Millisecond):
		}
	}
	h.log.Warn("browser_start", "outcome", "failed", "reason", "not_ready")
	return errors.New("browser did not start")
}

// gone reports whether nobody listens on the host's control socket: only
// that proves the host has ended. A slow answer says nothing.
func (h *browserHost) gone() bool {
	c, err := net.DialTimeout("unix", filepath.Join(h.dir(), browserhost.ControlSocket), time.Second)
	if err == nil {
		c.Close()
		return false
	}
	return errors.Is(err, syscall.ECONNREFUSED) || errors.Is(err, syscall.ENOENT)
}

// stop asks the host to close Chrome, which saves the session it restores;
// the host keeps its control socket until Chrome and the display have
// gone. A host that has not ended in time is stopped through its unit or
// as the child.
func (h *browserHost) stop(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, browserStopTime)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "http://browser"+browserhost.StopPath, nil)
	if res, err := h.control().Do(req); err == nil {
		res.Body.Close()
	}
	for !h.gone() {
		select {
		case <-ctx.Done():
			h.mu.Lock()
			child := h.child
			h.mu.Unlock()
			if h.survives() {
				cmd := exec.Command("systemctl", "--user", "stop", browserUnit+".service")
				cmd.Env = append(h.env(), "DBUS_SESSION_BUS_ADDRESS=unix:path="+filepath.Join(h.runtimeDir, "bus"))
				_ = cmd.Run()
			} else if child != nil {
				_ = syscall.Kill(-child.Process.Pid, syscall.SIGKILL)
			}
			for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(200 * time.Millisecond) {
				if h.gone() {
					return nil
				}
			}
			return errors.New("browser stop not confirmed")
		case <-time.After(200 * time.Millisecond):
		}
	}
	return nil
}

// browserView is the contract's status: the host's answer re-encoded here,
// so only known fields of known shape reach the app.
type browserView struct {
	SchemaVersion   int                  `json:"schema_version"`
	State           string               `json:"state"`
	SurvivesRestart bool                 `json:"survives_restart"`
	Control         string               `json:"control,omitempty"`
	AgentConnected  bool                 `json:"agent_connected"`
	Windows         []browserWindow      `json:"windows"`
	Pointer         *browserhost.Pointer `json:"pointer,omitempty"`
	Request         *browserhost.Request `json:"request,omitempty"`
}

type browserWindow struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Origin string `json:"origin"`
	Agent  bool   `json:"agent"`
}

func clipRunes(s string, n int) string {
	s = strings.ToValidUTF8(s, "")
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

func (h *browserHost) view(ctx context.Context) browserView {
	v := browserView{SchemaVersion: 1, State: "stopped", SurvivesRestart: h.survives(), Windows: []browserWindow{}}
	if !h.available() {
		v.State = "unavailable"
		return v
	}
	cctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()
	st, err := h.hostStatus(cctx)
	if err != nil {
		return v
	}
	return h.fromHost(st, v.SurvivesRestart)
}

func (h *browserHost) fromHost(st browserhost.Status, survives bool) browserView {
	v := browserView{SchemaVersion: 1, State: "running", SurvivesRestart: survives, Control: "agent", AgentConnected: st.Agent, Windows: []browserWindow{}}
	if st.Control == "person" {
		v.Control = "person"
	}
	ids := map[string]bool{}
	for _, w := range st.Windows {
		if !browserhost.TargetPattern.MatchString(w.ID) || ids[w.ID] || len(v.Windows) >= 24 {
			continue
		}
		ids[w.ID] = true
		origin := w.Origin
		if !strings.HasPrefix(origin, "https://") && !strings.HasPrefix(origin, "http://") {
			origin = ""
		}
		v.Windows = append(v.Windows, browserWindow{ID: w.ID, Title: clipRunes(w.Title, 200), Origin: clipRunes(origin, 200), Agent: w.Agent})
	}
	unit := func(f float64) bool { return f >= 0 && f <= 1 }
	if p := st.Pointer; p != nil && ids[p.Window] && unit(p.X) && unit(p.Y) && p.AgeMS >= 0 {
		ptr := &browserhost.Pointer{Window: p.Window, X: p.X, Y: p.Y, AgeMS: p.AgeMS, Clicks: []browserhost.Click{}}
		for _, c := range p.Clicks {
			if unit(c.X) && unit(c.Y) && c.AgeMS >= 0 && len(ptr.Clicks) < 5 {
				ptr.Clicks = append(ptr.Clicks, c)
			}
		}
		v.Pointer = ptr
	}
	if r := st.Request; r != nil && ids[r.Window] && r.AgeMS >= 0 {
		if text := clipRunes(r.Text, 300); strings.TrimSpace(text) != "" {
			v.Request = &browserhost.Request{Window: r.Window, Text: text, AgeMS: r.AgeMS}
		}
	}
	return v
}

func browserBodyless(r *http.Request) bool {
	return r.URL.RawQuery == "" && r.ContentLength <= 0 && len(r.TransferEncoding) == 0
}

func (h *browserHost) handler(trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(h.cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		switch {
		case r.URL.Path == BrowserPath && r.Method == http.MethodGet && browserBodyless(r):
			historyJSON(w, h.view(r.Context()))
		case r.URL.Path == BrowserStartPath && r.Method == http.MethodPost && browserBodyless(r):
			_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(browserStartTime + 10*time.Second))
			ctx, cancel := context.WithTimeout(r.Context(), browserStartTime+5*time.Second)
			defer cancel()
			if err := h.ensure(ctx); err != nil {
				if errors.Is(err, errBrowserUnavailable) {
					snapshotError(w, 404, "browser_unavailable")
					return
				}
				snapshotError(w, 503, "browser_start_failed")
				return
			}
			historyJSON(w, h.view(r.Context()))
		case r.URL.Path == BrowserStopPath && r.Method == http.MethodPost && browserBodyless(r):
			_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(browserStopTime + 10*time.Second))
			if err := h.stop(r.Context()); err != nil {
				snapshotError(w, 503, "browser_stop_failed")
				return
			}
			historyJSON(w, h.view(r.Context()))
		case r.URL.Path == BrowserControlPath && r.Method == http.MethodPost && r.URL.RawQuery == "":
			var body struct {
				Control string `json:"control"`
				Window  string `json:"window,omitempty"`
			}
			if r.Header.Get("Content-Type") != "application/json" || r.ContentLength < 2 || r.ContentLength > 128 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 128))
			dec.DisallowUnknownFields()
			if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || (body.Control != "person" && body.Control != "agent") || (body.Window != "" && (body.Control != "person" || !browserhost.TargetPattern.MatchString(body.Window))) {
				snapshotError(w, 400, "invalid_request")
				return
			}
			ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
			defer cancel()
			st, _, err := h.hostPost(ctx, browserhost.ControlPath, body)
			if err != nil {
				snapshotError(w, 409, "browser_not_running")
				return
			}
			historyJSON(w, h.fromHost(st, h.survives()))
		case r.URL.Path == BrowserWindowPath && r.Method == http.MethodGet:
			id := r.URL.Query().Get("id")
			if r.URL.RawQuery != "id="+id || !browserhost.TargetPattern.MatchString(id) || r.ContentLength > 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			h.picture(w, r, id)
		case r.URL.Path == BrowserViewPath:
			h.serveView(w, r)
		default:
			snapshotError(w, 400, "invalid_request")
		}
	})
}

// picture relays one window's JPEG from the host, checked to be one.
func (h *browserHost) picture(w http.ResponseWriter, r *http.Request, id string) {
	ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "http://browser"+browserhost.WindowPath+"?id="+id, nil)
	res, err := h.control().Do(req)
	if err != nil {
		snapshotError(w, 409, "browser_not_running")
		return
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		snapshotError(w, 404, "window_unavailable")
		return
	}
	img, err := io.ReadAll(io.LimitReader(res.Body, browserImageMax+1))
	if err != nil || len(img) > browserImageMax || !bytes.HasPrefix(img, []byte{0xff, 0xd8, 0xff}) {
		snapshotError(w, 404, "window_unavailable")
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Length", strconv.Itoa(len(img)))
	w.WriteHeader(200)
	_, _ = w.Write(img)
}

// serveView relays one viewer to the display's VNC socket: binary frames
// from the app become RFB bytes and back. The gateway has checked the
// session, Origin and CSRF before this connection exists. The viewer's own
// view-only mode keeps a look from taking control; nothing here parses RFB.
func (h *browserHost) serveView(w http.ResponseWriter, r *http.Request) {
	if r.URL.RawQuery != "" || r.URL.EscapedPath() != BrowserViewPath || !wsframe.IsUpgrade(r) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	vnc, err := net.DialTimeout("unix", filepath.Join(h.dir(), browserhost.VNCSocket), 3*time.Second)
	if err != nil {
		snapshotError(w, 409, "browser_not_running")
		return
	}
	defer vnc.Close()
	conn, brw, err := http.NewResponseController(w).Hijack()
	if err != nil {
		return
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Time{})
	_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if _, err := conn.Write(wsframe.SwitchingProtocols(r.Header.Get("Sec-WebSocket-Key"))); err != nil {
		return
	}
	h.log.Info("browser_view", "outcome", "opened", "reason", "relaying")
	touch := func() {
		ctx, cancel := context.WithTimeout(h.ctx, 2*time.Second)
		defer cancel()
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "http://browser"+browserhost.ViewerPath, nil)
		if res, err := h.control().Do(req); err == nil {
			res.Body.Close()
		}
	}
	touch()
	var wmu sync.Mutex
	write := func(op byte, p []byte) error {
		wmu.Lock()
		defer wmu.Unlock()
		_ = conn.SetWriteDeadline(time.Now().Add(15 * time.Second))
		_, err := conn.Write(wsframe.AppendFrame(nil, op, p, false))
		return err
	}
	done := make(chan string, 3)
	stop := make(chan struct{})
	go func() {
		buf := make([]byte, 64<<10)
		for {
			n, err := vnc.Read(buf)
			if n > 0 && write(wsframe.OpBinary, buf[:n]) != nil {
				done <- "browser_write_failed"
				return
			}
			if err != nil {
				done <- "display_closed"
				return
			}
		}
	}()
	go func() {
		rd := brw.Reader
		for {
			_ = conn.SetReadDeadline(time.Now().Add(90 * time.Second))
			f, err := wsframe.ReadFrame(rd, browserViewFrame, true)
			if err != nil {
				done <- "browser_closed"
				return
			}
			switch f.Op {
			case wsframe.OpBinary, wsframe.OpContinuation:
				_ = vnc.SetWriteDeadline(time.Now().Add(15 * time.Second))
				if _, err := vnc.Write(f.Payload); err != nil {
					done <- "display_write_failed"
					return
				}
			case wsframe.OpPing:
				_ = write(wsframe.OpPong, f.Payload)
			case wsframe.OpClose:
				_ = write(wsframe.OpClose, wsframe.ClosePayload(1000, ""))
				done <- "browser_closed"
				return
			case wsframe.OpPong, wsframe.OpText:
			}
		}
	}()
	go func() {
		ping := time.NewTicker(browserViewPing)
		defer ping.Stop()
		last := time.Now()
		for {
			select {
			case <-stop:
				return
			case <-ping.C:
				if write(wsframe.OpPing, nil) != nil {
					done <- "browser_write_failed"
					return
				}
				if time.Since(last) > browserViewTouch {
					touch()
					last = time.Now()
				}
			}
		}
	}()
	reason := <-done
	close(stop)
	conn.Close()
	vnc.Close()
	h.log.Info("browser_view", "outcome", "closed", "reason", reason)
}

// agentRoutes are the agent listener's browser routes. The agent learns the
// DevTools address and may start the browser or ask the person for a
// window; it never reaches the viewer, control or the pictures.
func (h *browserHost) agentRoutes() map[string]http.Handler {
	status := func(w http.ResponseWriter, r *http.Request) {
		v := h.view(r.Context())
		out := map[string]any{"schema_version": 1, "state": v.State, "agent_connected": v.AgentConnected, "windows": v.Windows}
		if v.State == "running" {
			out["control"] = v.Control
			out["cdp_endpoint"] = "ws+unix://" + filepath.Join(h.dir(), browserhost.CDPSocket) + ":/devtools/browser"
			if v.Request != nil {
				out["request"] = v.Request
			}
		}
		historyJSON(w, out)
	}
	return map[string]http.Handler{
		AgentBrowserPath: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet || !browserBodyless(r) {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			status(w, r)
		}),
		AgentBrowserStartPath: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost || r.URL.RawQuery != "" || r.ContentLength > 16 {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			if !h.feature() {
				snapshotError(w, 409, "browser_feature_off")
				return
			}
			ctx, cancel := context.WithTimeout(r.Context(), browserStartTime+5*time.Second)
			defer cancel()
			if err := h.ensure(ctx); err != nil {
				if errors.Is(err, errBrowserUnavailable) {
					snapshotError(w, 404, "browser_unavailable")
					return
				}
				snapshotError(w, 503, "browser_start_failed")
				return
			}
			status(w, r)
		}),
		AgentBrowserRequestPath: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var body struct {
				Window string `json:"window,omitempty"`
				Text   string `json:"text,omitempty"`
				Clear  bool   `json:"clear,omitempty"`
			}
			if r.Method != http.MethodPost || r.URL.RawQuery != "" || r.ContentLength < 2 || r.ContentLength > 2048 {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
			dec.DisallowUnknownFields()
			if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || (body.Window != "" && !browserhost.TargetPattern.MatchString(body.Window)) || (body.Clear && (body.Text != "" || body.Window != "")) || (!body.Clear && (strings.TrimSpace(body.Text) == "" || len([]rune(body.Text)) > 300)) {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
			defer cancel()
			_, code, err := h.hostPost(ctx, browserhost.RequestPath, body)
			switch {
			case code == 404:
				snapshotError(w, 404, "window_unavailable")
				return
			case code == 400:
				snapshotError(w, 400, "invalid_arguments")
				return
			case err != nil:
				snapshotError(w, 409, "browser_not_running")
				return
			}
			status(w, r)
		}),
	}
}

// installBrowserSkill writes the agent's browser skill when the browser is
// offered and the person turned the experiment on.
func (h *browserHost) installSkill(dir string) (string, bool) {
	if h == nil || !h.available() || !h.feature() {
		return "", false
	}
	path := filepath.Join(dir, "open-habitat-browser", "SKILL.md")
	if os.MkdirAll(filepath.Dir(path), 0o700) != nil || os.WriteFile(path, browserSkill, 0o600) != nil {
		return "", false
	}
	return path, true
}
