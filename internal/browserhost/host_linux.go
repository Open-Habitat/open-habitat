//go:build linux

// Package browserhost is the person's own server browser: a virtual display
// (TigerVNC's Xvnc) and Google Chrome, run as the person and reachable only
// through 0600 Unix sockets in a 0700 directory of theirs.
//
//   - vnc.sock is Xvnc's own RFB socket. The daemon relays the person's
//     viewer to it; there is no TCP listener and no abstract X socket, and
//     the X display itself takes a fresh MIT cookie on every start, because
//     its socket in /tmp is the one place another local user could reach.
//   - cdp.sock is the DevTools WebSocket for the person's agents. Chrome
//     runs with --remote-debugging-pipe, so it opens no debugging port;
//     this host owns the pipe and shares it (cdp_linux.go).
//   - control.sock is what the daemon reads and asks: the windows, their
//     pictures, the agent's pointer, a request for the person, and whether
//     the person or the agent has control.
//
// The host holds no authority of its own. It trusts nothing it is told
// except over its own sockets, which only the same Unix user can reach, and
// it never logs a URL or page content: they can carry credentials.
package browserhost

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
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

	"github.com/Open-Habitat/open-habitat/internal/wsframe"
	"golang.org/x/sys/unix"
)

// Socket and file names inside the host's directory. The daemon and the
// agent CLI find them by these names.
const (
	VNCSocket     = "vnc.sock"
	CDPSocket     = "cdp.sock"
	ControlSocket = "control.sock"
	lockFile      = "host.lock"
	cookieFile    = "xauthority"
)

// Config is one browser's start. Every path is absolute and chosen by the
// daemon that starts the host.
type Config struct {
	// Dir is the 0700 directory of the sockets.
	Dir string
	// Xvnc is TigerVNC's X server; Chrome is Google Chrome's launcher.
	Xvnc, Chrome string
	// Profile and Cache are Chrome's data in the person's home.
	Profile, Cache string
	// Idle stops a browser nobody has used.
	Idle          time.Duration
	Width, Height int
	// Env is the base environment of Xvnc and Chrome.
	Env []string
	// ChromeArgs are extra arguments, used only by tests that run a
	// stand-in browser.
	ChromeArgs []string
	Log        *slog.Logger
}

// Run starts the display and the browser and serves the sockets until the
// browser exits, ctx ends, the control socket asks it to stop or nobody has
// used it for cfg.Idle.
func Run(ctx context.Context, cfg Config) error {
	log := cfg.Log
	if log == nil {
		log = slog.New(slog.NewTextHandler(os.Stderr, nil))
	}
	if err := ownDir(cfg.Dir); err != nil {
		return err
	}
	lock, err := os.OpenFile(filepath.Join(cfg.Dir, lockFile), os.O_RDWR|os.O_CREATE|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0o600)
	if err != nil {
		return err
	}
	defer lock.Close()
	if unix.Flock(int(lock.Fd()), unix.LOCK_EX|unix.LOCK_NB) != nil {
		return errors.New("browser already running")
	}
	for _, name := range []string{VNCSocket, CDPSocket, ControlSocket} {
		_ = os.Remove(filepath.Join(cfg.Dir, name))
	}
	for _, d := range []string{cfg.Profile, cfg.Cache} {
		if err := os.MkdirAll(d, 0o700); err != nil {
			return err
		}
	}
	if err := firstPreferences(cfg.Profile); err != nil {
		log.Warn("browser_profile", "outcome", "ignored", "reason", "preferences_unwritable")
	}
	cookie := filepath.Join(cfg.Dir, cookieFile)
	if err := writeCookie(cookie); err != nil {
		return err
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	display, xvnc, err := startXvnc(ctx, cfg, cookie)
	if err != nil {
		log.Warn("browser_start", "outcome", "failed", "reason", "display_failed")
		return err
	}
	defer func() { stopProcess(xvnc) }()

	toChrome, chromeIn, err := os.Pipe()
	if err != nil {
		return err
	}
	chromeOut, fromChrome, err := os.Pipe()
	if err != nil {
		return err
	}
	chrome := exec.Command(cfg.Chrome, chromeArgs(cfg)...)
	chrome.Env = append(append([]string{}, cfg.Env...), "DISPLAY=:"+display, "XAUTHORITY="+cookie)
	chrome.Dir = filepath.Dir(cfg.Profile)
	// Chrome reads commands from fd 3 and writes to fd 4.
	chrome.ExtraFiles = []*os.File{toChrome, fromChrome}
	chrome.SysProcAttr = &syscall.SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGKILL}
	if err := chrome.Start(); err != nil {
		log.Warn("browser_start", "outcome", "failed", "reason", "chrome_failed")
		return err
	}
	toChrome.Close()
	fromChrome.Close()
	chromeDone := make(chan error, 1)
	go func() { chromeDone <- chrome.Wait() }()

	m := newCDPMux(chromeIn, log, time.Now)
	go func() { _ = m.readChrome(chromeOut) }()

	h := &host{cfg: cfg, mux: m, log: log, stop: cancel, images: map[string]*image{}, metrics: map[string]viewport{}, failed: map[string]time.Time{}}
	cdp, err := listenOwn(filepath.Join(cfg.Dir, CDPSocket))
	if err != nil {
		return err
	}
	control, err := listenOwn(filepath.Join(cfg.Dir, ControlSocket))
	if err != nil {
		return err
	}
	cdpServer := &http.Server{Handler: http.HandlerFunc(h.serveCDP), ReadHeaderTimeout: 10 * time.Second}
	controlServer := &http.Server{Handler: h.controlHandler(), ReadHeaderTimeout: 10 * time.Second}
	go func() { _ = cdpServer.Serve(personListener{cdp}) }()
	go func() { _ = controlServer.Serve(personListener{control}) }()
	log.Info("browser_start", "outcome", "accepted", "reason", "running")

	idle := time.NewTicker(time.Minute)
	defer idle.Stop()
	reason := "stopped"
loop:
	for {
		select {
		case <-ctx.Done():
			break loop
		case <-chromeDone:
			reason = "chrome_exited"
			chrome = nil
			break loop
		case <-idle.C:
			if since := m.idleSince(); cfg.Idle > 0 && !since.IsZero() && time.Since(since) > cfg.Idle {
				reason = "idle"
				break loop
			}
		}
	}
	// The control socket answers until Chrome has gone, so the daemon sees
	// the browser stopped only when a new one can start.
	_ = cdpServer.Close()
	if chrome != nil {
		// Browser.close lets Chrome save the session it restores next time.
		// It is sent aside: a Chrome that no longer reads its pipe would
		// block the write, and the kill below must still come.
		go func() {
			cctx, ccancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer ccancel()
			_, _ = m.call(cctx, "Browser.close", map[string]any{}, "")
		}()
		select {
		case <-chromeDone:
		case <-time.After(10 * time.Second):
			_ = syscall.Kill(-chrome.Process.Pid, syscall.SIGKILL)
			<-chromeDone
		}
	}
	m.shutdown()
	stopProcess(xvnc)
	xvnc = nil
	_ = unix.Flock(int(lock.Fd()), unix.LOCK_UN)
	_ = controlServer.Close()
	log.Info("browser_stop", "outcome", "closed", "reason", reason)
	return nil
}

func chromeArgs(cfg Config) []string {
	args := []string{
		"--remote-debugging-pipe",
		"--user-data-dir=" + cfg.Profile,
		"--disk-cache-dir=" + cfg.Cache,
		"--disk-cache-size=268435456",
		// Without a desktop keyring Chrome would wait for one; the profile
		// is protected by the home's permissions, like gh's and Pi's tokens.
		"--password-store=basic",
		"--no-first-run",
		"--no-default-browser-check",
		"--window-position=0,0",
		fmt.Sprintf("--window-size=%d,%d", cfg.Width, cfg.Height),
	}
	return append(args, cfg.ChromeArgs...)
}

// firstPreferences turns session restore on in a new profile, so a browser
// stopped for idleness comes back with its windows and session cookies.
func firstPreferences(profile string) error {
	dir := filepath.Join(profile, "Default")
	path := filepath.Join(dir, "Preferences")
	if _, err := os.Lstat(path); err == nil {
		return nil
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(`{"session":{"restore_on_startup":1},"browser":{"has_seen_welcome_page":true}}`), 0o600)
}

// ownDir accepts only the person's own 0700 directory.
func ownDir(dir string) error {
	if !filepath.IsAbs(dir) || filepath.Clean(dir) != dir {
		return errors.New("browser directory must be absolute")
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	var st unix.Stat_t
	if unix.Lstat(dir, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFDIR || int(st.Uid) != os.Getuid() || st.Mode&0o077 != 0 {
		return errors.New("unsafe browser directory")
	}
	return nil
}

// writeCookie writes a fresh MIT-MAGIC-COOKIE-1 in Xauthority format. The
// one entry is for any address and display: the server reads every entry
// regardless, and the display number is known only once Xvnc has chosen it.
func writeCookie(path string) error {
	var secret [16]byte
	if _, err := rand.Read(secret[:]); err != nil {
		return err
	}
	var b []byte
	b = binary.BigEndian.AppendUint16(b, 0xffff)
	b = binary.BigEndian.AppendUint16(b, 0)
	b = binary.BigEndian.AppendUint16(b, 0)
	name := "MIT-MAGIC-COOKIE-1"
	b = binary.BigEndian.AppendUint16(b, uint16(len(name)))
	b = append(b, name...)
	b = binary.BigEndian.AppendUint16(b, uint16(len(secret)))
	b = append(b, secret[:]...)
	_ = os.Remove(path)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0o600)
	if err != nil {
		return err
	}
	if _, err := f.Write(b); err != nil {
		f.Close()
		return err
	}
	return f.Close()
}

// startXvnc starts the display and returns the number Xvnc chose.
func startXvnc(ctx context.Context, cfg Config, cookie string) (string, *exec.Cmd, error) {
	r, w, err := os.Pipe()
	if err != nil {
		return "", nil, err
	}
	defer r.Close()
	args := []string{
		"-displayfd", "3",
		"-rfbport", "-1",
		"-rfbunixpath", filepath.Join(cfg.Dir, VNCSocket),
		"-rfbunixmode", "0600",
		// The socket's permissions are the authentication; the daemon relays
		// only the person's own viewer to it.
		"-SecurityTypes", "None",
		"-nolisten", "tcp",
		"-nolisten", "local",
		"-auth", cookie,
		"-geometry", fmt.Sprintf("%dx%d", cfg.Width, cfg.Height),
		"-depth", "24",
		"-AlwaysShared",
		"-desktop", "Open Habitat",
	}
	cmd := exec.Command(cfg.Xvnc, args...)
	cmd.Env = cfg.Env
	cmd.Dir = cfg.Dir
	cmd.ExtraFiles = []*os.File{w}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGKILL}
	if err := cmd.Start(); err != nil {
		w.Close()
		return "", nil, err
	}
	w.Close()
	type answer struct {
		line string
		err  error
	}
	got := make(chan answer, 1)
	go func() {
		line, err := bufio.NewReader(r).ReadString('\n')
		got <- answer{strings.TrimSpace(line), err}
	}()
	select {
	case a := <-got:
		if _, err := strconv.Atoi(a.line); err != nil || a.err != nil {
			stopProcess(cmd)
			return "", nil, errors.New("display did not start")
		}
		// Xvnc names its display before its RFB socket is listening.
		deadline := time.Now().Add(10 * time.Second)
		for time.Now().Before(deadline) {
			if c, err := net.Dial("unix", filepath.Join(cfg.Dir, VNCSocket)); err == nil {
				c.Close()
				return a.line, cmd, nil
			}
			time.Sleep(50 * time.Millisecond)
		}
		stopProcess(cmd)
		return "", nil, errors.New("display socket did not appear")
	case <-time.After(15 * time.Second):
		stopProcess(cmd)
		return "", nil, errors.New("display did not start")
	case <-ctx.Done():
		stopProcess(cmd)
		return "", nil, ctx.Err()
	}
}

func stopProcess(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
	done := make(chan struct{})
	go func() { _ = cmd.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		<-done
	}
}

// listenOwn listens on a 0600 socket. The umask makes it so from the start.
func listenOwn(path string) (*net.UnixListener, error) {
	old := unix.Umask(0o177)
	l, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	unix.Umask(old)
	if err != nil {
		return nil, err
	}
	if err := os.Chmod(path, 0o600); err != nil {
		l.Close()
		return nil, err
	}
	return l, nil
}

// samePerson refuses a connection from any other Unix user. The directory's
// permissions already do; this keeps a mistaken mode from widening it.
func samePerson(c net.Conn) bool {
	uc, ok := c.(*net.UnixConn)
	if !ok {
		return false
	}
	raw, err := uc.SyscallConn()
	if err != nil {
		return false
	}
	same := false
	_ = raw.Control(func(fd uintptr) {
		cred, err := unix.GetsockoptUcred(int(fd), unix.SOL_SOCKET, unix.SO_PEERCRED)
		same = err == nil && int(cred.Uid) == os.Getuid()
	})
	return same
}

// personListener drops connections from any other Unix user.
type personListener struct{ *net.UnixListener }

func (l personListener) Accept() (net.Conn, error) {
	for {
		c, err := l.UnixListener.Accept()
		if err != nil || samePerson(c) {
			return c, err
		}
		c.Close()
	}
}

type viewport struct{ w, h float64 }

type image struct {
	jpeg []byte
	at   time.Time
}

type host struct {
	cfg  Config
	mux  *cdpMux
	log  *slog.Logger
	stop func()

	mu      sync.Mutex
	images  map[string]*image
	metrics map[string]viewport
	failed  map[string]time.Time
	shot    sync.Mutex
	windows []window
	listed  time.Time
}

// serveCDP accepts one agent's DevTools WebSocket on any path, as Chrome's
// own endpoint does, so ordinary CDP clients connect to
// ws+unix://<dir>/cdp.sock:/devtools/browser.
func (h *host) serveCDP(w http.ResponseWriter, r *http.Request) {
	if !wsframe.IsUpgrade(r) {
		if r.URL.Path == "/json/version" && r.Method == http.MethodGet {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"Browser": "Open Habitat", "webSocketDebuggerUrl": "ws://localhost/devtools/browser"})
			return
		}
		http.Error(w, "websocket only", http.StatusBadRequest)
		return
	}
	conn, brw, err := http.NewResponseController(w).Hijack()
	if err != nil {
		return
	}
	ws := &wsConn{c: conn, r: brw.Reader}
	a, err := h.mux.connect(ws)
	if err != nil {
		code, text := "409 Conflict", "another agent is using the browser; try again when it has finished"
		if !errors.Is(err, errAgentBusy) {
			code, text = "503 Service Unavailable", "the browser is closing"
		}
		_, _ = conn.Write([]byte("HTTP/1.1 " + code + "\r\nContent-Type: text/plain\r\nContent-Length: " + strconv.Itoa(len(text)) + "\r\nConnection: close\r\n\r\n" + text))
		conn.Close()
		h.log.Info("browser_agent", "outcome", "refused", "reason", map[bool]string{true: "busy", false: "closing"}[errors.Is(err, errAgentBusy)])
		return
	}
	if _, err := conn.Write(wsframe.SwitchingProtocols(r.Header.Get("Sec-WebSocket-Key"))); err != nil {
		a.disconnect(1011, "")
		return
	}
	h.log.Info("browser_agent", "outcome", "opened", "reason", "connected")
	for {
		msg, err := ws.next()
		if err != nil {
			a.disconnect(1000, "")
			return
		}
		if err := h.mux.fromAgent(a, msg); err != nil {
			a.disconnect(1008, "refused")
			return
		}
	}
}
