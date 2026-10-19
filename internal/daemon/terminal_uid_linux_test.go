//go:build linux

package daemon

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"github.com/Open-Habitat/open-habitat/internal/wsframe"
)

// The browser shell with actual kernel UIDs, in a disposable rootless
// container (scripts/test-terminal-uids.sh): two mapped people (21001,
// 21002) each with their own daemon and tmux server, and the gateway's UID
// (21003), which reaches a shell only through a person's daemon socket.
const (
	termUIDA, termUIDB, termUIDGateway = 21001, 21002, 21003
)

func TestTerminalDistinctUIDs(t *testing.T) {
	if os.Getenv("TERMINAL_UID_CONTAINER") != "1" {
		t.Skip("requires disposable rootless container with three synthetic UIDs and tmux")
	}
	switch os.Getenv("TERMINAL_ROLE") {
	case "daemon":
		serveTerminalUID(t)
		return
	case "probe":
		probeTerminalUID(t)
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("container coordinator requires namespace root")
	}
	base, err := os.MkdirTemp("/tmp", "terminal-uids-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(base) })
	if err := os.Chmod(base, 0o711); err != nil {
		t.Fatal(err)
	}
	daemons := map[int]*exec.Cmd{}
	for _, uid := range []int{termUIDA, termUIDB} {
		home := filepath.Join(base, fmt.Sprintf("home-%d", uid))
		// The person's private /tmp stands in for the daemon's PrivateTmp.
		for _, dir := range []string{home, filepath.Join(home, "src"), filepath.Join(home, "src", "demo"), filepath.Join(base, fmt.Sprintf("tmp-%d", uid))} {
			if err := os.Mkdir(dir, 0o700); err != nil {
				t.Fatal(err)
			}
			if err := os.Chown(dir, uid, uid); err != nil {
				t.Fatal(err)
			}
		}
		socketDir := filepath.Join(base, fmt.Sprintf("route-%d", uid))
		if err := os.Mkdir(socketDir, 0o710); err != nil {
			t.Fatal(err)
		}
		if err := os.Chown(socketDir, uid, termUIDGateway); err != nil {
			t.Fatal(err)
		}
		path := filepath.Join(socketDir, "daemon.sock")
		cmd := exec.Command(os.Args[0], "-test.run=^TestTerminalDistinctUIDs$")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
		cmd.Env = []string{"TERMINAL_UID_CONTAINER=1", "TERMINAL_ROLE=daemon", "TERMINAL_PATH=" + path, "TERMINAL_HOME=" + home, "TERMINAL_TMP=" + filepath.Join(base, fmt.Sprintf("tmp-%d", uid)), "HOME=" + home, "PATH=/usr/bin:/bin"}
		output := new(strings.Builder)
		cmd.Stdout, cmd.Stderr = output, output
		if err := cmd.Start(); err != nil {
			t.Fatal(err)
		}
		daemons[uid] = cmd
		t.Cleanup(func() {
			_ = cmd.Process.Kill()
			_ = cmd.Wait()
			if t.Failed() && output.Len() > 0 {
				t.Log(output.String())
			}
		})
		for deadline := time.Now().Add(5 * time.Second); ; time.Sleep(10 * time.Millisecond) {
			if _, err := os.Lstat(path); err == nil {
				break
			}
			if time.Now().After(deadline) {
				t.Fatalf("daemon %d socket did not start: %s", uid, output.String())
			}
		}
		if err := os.Chown(path, uid, termUIDGateway); err != nil {
			t.Fatal(err)
		}
		if err := os.Chmod(path, 0o660); err != nil {
			t.Fatal(err)
		}
	}
	probe := func(as, owner int, step string) {
		t.Helper()
		cmd := exec.Command(os.Args[0], "-test.run=^TestTerminalDistinctUIDs$", "-test.v")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(as), Gid: uint32(as)}}
		cmd.Env = []string{"TERMINAL_UID_CONTAINER=1", "TERMINAL_ROLE=probe", "TERMINAL_STEP=" + step, "TERMINAL_BASE=" + base, "TERMINAL_OWNER=" + strconv.Itoa(owner), "PATH=/usr/bin:/bin"}
		if b, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("UID %d → %d %s: %v\n%s", as, owner, step, err, b)
		}
	}
	// The gateway's UID opens a shell in each person's workspace; each runs
	// as its person, and neither reaches the other's home or tmux server.
	probe(termUIDGateway, termUIDA, "shell")
	probe(termUIDGateway, termUIDB, "shell")
	// A person's UID cannot reach another person's daemon at all.
	probe(termUIDB, termUIDA, "foreign")
	probe(termUIDA, termUIDB, "foreign")
	// The coordinator sees who owns the tmux servers: each person, never root
	// or the gateway.
	for _, uid := range []int{termUIDA, termUIDB} {
		socket := filepath.Join(base, fmt.Sprintf("tmp-%d", uid), "open-habitat-tmux-"+strconv.Itoa(uid), "tmux.sock")
		owner := tmuxServerUID(t, socket)
		if owner != uid {
			t.Fatalf("tmux server for %d runs as %d", uid, owner)
		}
	}
	// Shells outlive the browser connection: a second connection finds them.
	probe(termUIDGateway, termUIDA, "reattach")
}

// tmuxServerUID finds the server whose command line names socket and
// returns the UID that owns it.
func tmuxServerUID(t *testing.T, socket string) int {
	t.Helper()
	entries, _ := os.ReadDir("/proc")
	for _, e := range entries {
		pid, err := strconv.Atoi(e.Name())
		if err != nil {
			continue
		}
		cmdline, err := os.ReadFile(fmt.Sprintf("/proc/%d/cmdline", pid))
		if err != nil || !strings.Contains(string(cmdline), socket) {
			continue
		}
		// The server is the process tmux forked for itself; clients are
		// gone once their PTY closed. Any match must be the person's.
		info, err := os.Stat(fmt.Sprintf("/proc/%d", pid))
		if err != nil {
			continue
		}
		return int(info.Sys().(*syscall.Stat_t).Uid)
	}
	t.Fatalf("no tmux server for %s", socket)
	return -1
}

func serveTerminalUID(t *testing.T) {
	uid := os.Geteuid()
	home, path := os.Getenv("TERMINAL_HOME"), os.Getenv("TERMINAL_PATH")
	name := map[int]string{termUIDA: "agent-a", termUIDB: "agent-b"}[uid]
	cfg := transport.Config{GatewayUID: termUIDGateway, UID: uid, Username: name, Home: home, Socket: "/run/open-habitat/users/" + name + "/daemon.sock", Provider: "github", Subject: strconv.Itoa(uid)}
	tmp := os.Getenv("TERMINAL_TMP")
	tmux, err := exec.LookPath("tmux")
	if err != nil {
		t.Fatal("tmux missing in the container image")
	}
	// No lingering here: the server is this daemon's child, as on an
	// account the broker has not made linger.
	h := &terminalHost{cfg: cfg, tmux: tmux, privateDir: filepath.Join(tmp, "open-habitat-tmux-"+strconv.Itoa(uid)), log: slog.New(slog.NewTextHandler(os.Stderr, nil)), ctx: context.Background()}
	ln, err := net.Listen("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	trusted := func(r *http.Request) bool { return r.Context().Value("peer") == termUIDGateway }
	mux := http.NewServeMux()
	mux.Handle(TerminalsPath, h.TerminalsHandler(trusted))
	mux.Handle(TerminalPath, h.TerminalHandler(trusted))
	srv := &http.Server{Handler: mux, ConnContext: func(ctx context.Context, c net.Conn) context.Context {
		if uc, ok := c.(*net.UnixConn); ok {
			if v, e := PeerUID(uc); e == nil {
				return context.WithValue(ctx, "peer", int(v))
			}
		}
		return ctx
	}}
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		t.Fatal(err)
	}
}

func probeTerminalUID(t *testing.T) {
	base := os.Getenv("TERMINAL_BASE")
	owner, _ := strconv.Atoi(os.Getenv("TERMINAL_OWNER"))
	other := termUIDA + termUIDB - owner
	path := filepath.Join(base, fmt.Sprintf("route-%d", owner), "daemon.sock")
	id := opaque("ws_", "github:"+strconv.Itoa(owner)+":demo")
	dial := func(query string) (*wsClient, int) {
		c, err := net.DialTimeout("unix", path, 2*time.Second)
		if err != nil {
			return nil, -1
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
			_, _ = io.Copy(io.Discard, res.Body)
			return nil, res.StatusCode
		}
		return &wsClient{c: c, r: r}, 101
	}
	switch os.Getenv("TERMINAL_STEP") {
	case "foreign":
		if w, code := dial("workspace_id=" + id + "&shell=new"); w != nil || code != -1 {
			t.Fatalf("UID %d reached UID %d's daemon: %d", os.Geteuid(), owner, code)
		}
	case "shell":
		w, code := dial("workspace_id=" + id + "&shell=new")
		if code != 101 {
			t.Fatalf("upgrade %d", code)
		}
		w.resize(t, 120, 30)
		w.waitReady(t)
		otherHome := filepath.Join(base, fmt.Sprintf("home-%d", other))
		otherTmux := filepath.Join(base, fmt.Sprintf("tmp-%d", other), "open-habitat-tmux-"+strconv.Itoa(other), "tmux.sock")
		w.send(t, wsframe.OpBinary, fmt.Sprintf("echo \"uid=$(id -u) pwd=$PWD\"; ls %s >/dev/null 2>&1 || echo home-de''nied; tmux -S %s ls >/dev/null 2>&1 || echo tmux-de''nied\r", otherHome, otherTmux))
		want := fmt.Sprintf("uid=%d pwd=%s", owner, filepath.Join(base, fmt.Sprintf("home-%d", owner), "src", "demo"))
		if !w.until(t, "tmux-denied", 10*time.Second) || !strings.Contains(w.screen.String(), want) || !strings.Contains(w.screen.String(), "home-denied") {
			t.Fatalf("shell output %q, want %q, home-denied and tmux-denied", w.screen.String(), want)
		}
		w.send(t, wsframe.OpBinary, "sleep 600 &\r")
		time.Sleep(300 * time.Millisecond)
	case "reattach":
		w, code := dial("workspace_id=" + id + "&shell=1")
		if code != 101 {
			t.Fatalf("reattach %d", code)
		}
		w.resize(t, 120, 30)
		w.waitReady(t)
		w.send(t, wsframe.OpBinary, "jobs -l | sed s/sl/SL/\r")
		if !w.until(t, "SLeep 600", 10*time.Second) {
			t.Fatalf("reattached shell lost its job: %q", w.screen.String())
		}
	default:
		t.Fatal("unknown step")
	}
}
