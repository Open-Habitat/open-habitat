//go:build linux

package daemon_test

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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

	"github.com/Open-Habitat/open-habitat/internal/daemon/integrations"
)

// TestIntegrationsDistinctUIDs runs only inside scripts/test-pi-attempt-uids.sh's
// disposable, networkless rootless container, with the fake himalaya mounted
// at /opt/himalaya. Two daemons and the gateway are three actual kernel UIDs:
// an account connected through one person's daemon lands in that person's
// home only, private to them, and the other daemon neither lists it nor can
// read it.
func TestIntegrationsDistinctUIDs(t *testing.T) {
	if os.Getenv("PI_UID_CONTAINER") != "1" {
		t.Skip("requires disposable rootless container with three synthetic UIDs")
	}
	switch os.Getenv("IG_ROLE") {
	case "daemon":
		serveIntegrationsUID(t)
		return
	case "probe":
		probeIntegrationsUID(t)
		return
	case "read":
		if _, err := os.ReadFile(os.Getenv("IG_PATH")); err == nil {
			t.Fatal("another UID read the tool's store")
		}
		return
	}
	base, err := os.MkdirTemp("/tmp", "integrations-uids-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(base) })
	if err := os.Chmod(base, 0711); err != nil {
		t.Fatal(err)
	}
	homes := map[int]string{21001: "/tmp/ig-agent-a", 21002: "/tmp/ig-agent-b"}
	for _, uid := range []int{21001, 21002} {
		home := homes[uid]
		t.Cleanup(func() { _ = os.RemoveAll(home) })
		if err := os.Mkdir(home, 0700); err != nil || os.Chown(home, uid, uid) != nil {
			t.Fatal(err)
		}
		socketDir := filepath.Join(base, fmt.Sprintf("route-%d", uid))
		if err := os.Mkdir(socketDir, 0710); err != nil || os.Chown(socketDir, uid, 21003) != nil {
			t.Fatal(err)
		}
		path := filepath.Join(socketDir, "daemon.sock")
		cmd := exec.Command(os.Args[0], "-test.run=^TestIntegrationsDistinctUIDs$")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
		cmd.Env = append(os.Environ(), "IG_ROLE=daemon", "IG_PATH="+path, "IG_HOME="+home, "HOME="+home)
		output := new(strings.Builder)
		cmd.Stdout, cmd.Stderr = output, output
		if err := cmd.Start(); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			_ = cmd.Process.Kill()
			_ = cmd.Wait()
			if output.Len() > 0 {
				t.Log(output.String())
			}
		})
		deadline := time.Now().Add(5 * time.Second)
		for {
			if _, err := os.Lstat(path); err == nil {
				break
			}
			if time.Now().After(deadline) {
				t.Fatalf("daemon socket did not start: %s", output.String())
			}
			time.Sleep(10 * time.Millisecond)
		}
		if os.Chown(path, uid, 21003) != nil || os.Chmod(path, 0660) != nil {
			t.Fatal("socket ownership")
		}
	}
	run := func(uid int, env ...string) {
		t.Helper()
		cmd := exec.Command(os.Args[0], "-test.run=^TestIntegrationsDistinctUIDs$")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
		cmd.Env = append(os.Environ(), env...)
		if b, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("UID %d %v: %v %s", uid, env, err, b)
		}
	}
	socket := func(uid int) string { return "IG_PATH=" + filepath.Join(base, fmt.Sprintf("route-%d", uid), "daemon.sock") }
	connect := `{"action":"connect","provider":"imap","address":"agent-a@example.test","server":"imap.example.test","port":993,"security":"tls","username":"agent-a","password":"synthetic-uid-secret"}`
	run(21003, "IG_ROLE=probe", socket(21001), "IG_METHOD=POST", "IG_BODY="+connect, "IG_EXPECT=200", "IG_ACCOUNTS=-1")
	run(21003, "IG_ROLE=probe", socket(21001), "IG_METHOD=GET", "IG_EXPECT=200", "IG_ACCOUNTS=1")
	// The other person's daemon reads the other home.
	run(21003, "IG_ROLE=probe", socket(21002), "IG_METHOD=GET", "IG_EXPECT=200", "IG_ACCOUNTS=0")
	// The other UID cannot reach agent-a's daemon, nor read the tool's store
	// or the skill in agent-a's home.
	run(21002, "IG_ROLE=probe", socket(21001), "IG_METHOD=GET", "IG_EXPECT=-1")
	store := filepath.Join(homes[21001], ".config/himalaya/open-habitat/agent-a@example.test.toml")
	skill := filepath.Join(homes[21001], integrations.SkillDir, "SKILL.md")
	for _, path := range []string{store, skill} {
		st, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if owner := st.Sys().(*syscall.Stat_t).Uid; owner != 21001 || st.Mode().Perm() != 0o600 {
			t.Fatalf("%s: owner %d mode %o", path, owner, st.Mode().Perm())
		}
		run(21002, "IG_ROLE=read", "IG_PATH="+path)
	}
	if b, _ := os.ReadFile(skill); bytes.Contains(b, []byte("synthetic-uid-secret")) {
		t.Fatal("the skill carries the password")
	}
}

func serveIntegrationsUID(t *testing.T) {
	home := os.Getenv("IG_HOME")
	ln, err := net.Listen("unix", os.Getenv("IG_PATH"))
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	catalog := integrations.New(integrations.Env{Home: home, Config: integrations.Config{Tools: map[string]string{"himalaya": "/opt/himalaya"}}, FixtureTools: true}, integrations.Production(), nil)
	catalog.Start(context.Background())
	trusted := catalog.Handler(func(r *http.Request) bool { return r.Context().Value("peer") == 21003 && r.Host == "unix" })
	srv := &http.Server{Handler: trusted, ConnContext: func(ctx context.Context, c net.Conn) context.Context {
		if uc, ok := c.(*net.UnixConn); ok {
			if cred, e := peerUID(uc); e == nil {
				return context.WithValue(ctx, "peer", cred)
			}
		}
		return ctx
	}}
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		t.Fatal(err)
	}
}

func peerUID(c *net.UnixConn) (int, error) {
	raw, err := c.SyscallConn()
	if err != nil {
		return 0, err
	}
	var uid int
	var inner error
	if err := raw.Control(func(fd uintptr) {
		cred, e := syscall.GetsockoptUcred(int(fd), syscall.SOL_SOCKET, syscall.SO_PEERCRED)
		if e != nil {
			inner = e
			return
		}
		uid = int(cred.Uid)
	}); err != nil {
		return 0, err
	}
	return uid, inner
}

func probeIntegrationsUID(t *testing.T) {
	expected, _ := strconv.Atoi(os.Getenv("IG_EXPECT"))
	conn, err := net.DialTimeout("unix", os.Getenv("IG_PATH"), 2*time.Second)
	if expected == -1 {
		if err == nil {
			conn.Close()
			t.Fatal("foreign UID connected")
		}
		return
	}
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(20 * time.Second))
	path := integrations.ListPath
	var body io.Reader
	if b := os.Getenv("IG_BODY"); b != "" {
		path, body = integrations.AccountsPath, strings.NewReader(b)
	}
	req, err := http.NewRequest(os.Getenv("IG_METHOD"), "http://unix"+path, body)
	if err != nil {
		t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Close = true
	if err = req.Write(conn); err != nil {
		t.Fatal(err)
	}
	res, err := http.ReadResponse(bufio.NewReader(conn), req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	if res.StatusCode != expected || bytes.Contains(data, []byte("synthetic-uid-secret")) {
		t.Fatalf("response %d %s, expected %d", res.StatusCode, data, expected)
	}
	if want, _ := strconv.Atoi(os.Getenv("IG_ACCOUNTS")); want >= 0 {
		var list struct {
			Accounts []json.RawMessage `json:"accounts"`
		}
		if json.Unmarshal(data, &list) != nil || len(list.Accounts) != want {
			t.Fatalf("listed %s, want %d accounts", data, want)
		}
	}
}
