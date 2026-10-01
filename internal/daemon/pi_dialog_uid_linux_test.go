//go:build linux

package daemon

import (
	"bufio"
	"context"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
)

// The coordinator, daemon and gateway probes are separate real kernel UIDs in
// the disposable container used by scripts/test-pi-attempt-uids.sh.
func TestPiDialogDistinctUIDs(t *testing.T) {
	if os.Getenv("PI_UID_CONTAINER") != "1" {
		t.Skip("requires disposable UID fixture")
	}
	switch os.Getenv("PI_DIALOG_ROLE") {
	case "daemon":
		dialogUIDDaemon(t)
		return
	case "probe":
		dialogUIDProbe(t)
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("coordinator needs namespace root")
	}
	base, err := os.MkdirTemp("/tmp", "pi-dialog-uids-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(base)
	if err := os.Chmod(base, 0711); err != nil {
		t.Fatal(err)
	}
	home := "/tmp/agent-a"
	if err := os.Mkdir(home, 0700); err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(home)
	script := filepath.Join(home, "fake-pi")
	code := `#!/bin/sh
while IFS= read -r line; do
 case "$line" in
  *'"type":"prompt"'*)
   id=$(printf '%s\n' "$line" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
   printf '{"type":"response","id":"%s","command":"prompt","success":true}\n' "$id"
   printf '%s\n' '{"type":"extension_ui_request","id":"native-a","method":"input","title":"Answer"}' '{"type":"extension_ui_request","id":"native-b","method":"confirm","title":"Cancel"}'
   ;;
  *'"type":"extension_ui_response"'*) printf '%s\n' "$line" >> /tmp/agent-a/dialog-responses ;;
 esac
done
`
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Chown(script, 21001, 21001); err != nil {
		t.Fatal(err)
	}
	if err := os.Chown(home, 21001, 21001); err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(base, "route")
	if err := os.Mkdir(dir, 0710); err != nil {
		t.Fatal(err)
	}
	if err := os.Chown(dir, 21001, 21003); err != nil {
		t.Fatal(err)
	}
	socket := filepath.Join(dir, "daemon.sock")
	daemon := exec.Command(os.Args[0], "-test.run=^TestPiDialogDistinctUIDs$")
	daemon.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 21001, Gid: 21001}}
	daemon.Env = append(os.Environ(), "PI_DIALOG_ROLE=daemon", "PI_DIALOG_SOCKET="+socket, "HOME="+home)
	output := new(strings.Builder)
	daemon.Stdout, daemon.Stderr = output, output
	if err := daemon.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() {
		_ = daemon.Process.Kill()
		_ = daemon.Wait()
		if output.Len() > 0 {
			t.Log(output.String())
		}
	}()
	end := time.Now().Add(5 * time.Second)
	for {
		if _, err := os.Lstat(socket); err == nil {
			break
		}
		if time.Now().After(end) {
			t.Fatalf("socket unavailable: %s", output.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
	if err := os.Chown(socket, 21001, 21003); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(socket, 0660); err != nil {
		t.Fatal(err)
	}
	probe := func(uid int, mode string) {
		t.Helper()
		cmd := exec.Command(os.Args[0], "-test.run=^TestPiDialogDistinctUIDs$")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
		cmd.Env = append(os.Environ(), "PI_DIALOG_ROLE=probe", "PI_DIALOG_SOCKET="+socket, "PI_DIALOG_MODE="+mode)
		if b, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("probe %s uid %d: %v %s", mode, uid, err, b)
		}
	}
	probe(21002, "foreign")
	probe(21003, "answer")
	probe(21003, "cancel")
	raw, err := os.ReadFile(filepath.Join(home, "dialog-responses"))
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(string(raw)), "\n")
	if len(lines) != 2 || !strings.Contains(lines[0], `"value":"hello"`) || !strings.Contains(lines[1], `"cancelled":true`) {
		t.Fatalf("native replies: %q", raw)
	}
}

func dialogUIDDaemon(t *testing.T) {
	home := "/tmp/agent-a"
	script := filepath.Join(home, "fake-pi")
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	id := ownershipTestID
	s := &conversation{id: id, rpc: p, state: "idle", commands: map[string]bool{}}
	cfg := transport.Config{GatewayUID: 21003, UID: 21001, Username: "agent-a", Home: home, Socket: "/run/native-agent-host/users/agent-a/daemon.sock", Provider: "github", Subject: "42"}
	trusted := func(r *http.Request) bool { return r.Context().Value("peer") == 21003 }
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c := newConversationController(ctx, cfg, nil, trusted, func(context.Context) string { return "usable" })
	c.mu.Lock()
	c.sessions[id] = s
	c.mu.Unlock()
	go c.drain(s)
	if accepted, err := p.request("prompt", "start", time.Second); err != nil || !accepted {
		t.Fatalf("prompt %v %v", accepted, err)
	}
	ln, err := net.Listen("unix", os.Getenv("PI_DIALOG_SOCKET"))
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	srv := &http.Server{Handler: c, ConnContext: func(ctx context.Context, conn net.Conn) context.Context {
		if uc, ok := conn.(*net.UnixConn); ok {
			if uid, e := PeerUID(uc); e == nil {
				return context.WithValue(ctx, "peer", int(uid))
			}
		}
		return ctx
	}}
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		t.Fatal(err)
	}
}

func dialogUIDProbe(t *testing.T) {
	socket := os.Getenv("PI_DIALOG_SOCKET")
	if os.Getenv("PI_DIALOG_MODE") == "foreign" {
		conn, err := net.DialTimeout("unix", socket, time.Second)
		if err == nil {
			conn.Close()
			t.Fatal("foreign UID connected")
		}
		return
	}
	id := ownershipTestID
	request := func(body string) (int, string) {
		t.Helper()
		conn, err := net.DialTimeout("unix", socket, time.Second)
		if err != nil {
			t.Fatal(err)
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(2 * time.Second))
		req, err := http.NewRequest("POST", "http://unix/api/v1/conversations/"+id+"/question", strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
		req.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
		if err := req.Write(conn); err != nil {
			t.Fatal(err)
		}
		res, err := http.ReadResponse(bufio.NewReader(conn), req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		b, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		return res.StatusCode, string(b)
	}
	mode := os.Getenv("PI_DIALOG_MODE")
	if mode == "answer" {
		if status, _ := request(`{"request_id":"wrong","action":"answer","value":"hello"}`); status != 409 {
			t.Fatalf("stale %d", status)
		}
		body := `{"request_id":"native-a","action":"answer","value":"hello"}`
		end := time.Now().Add(time.Second)
		for {
			status, _ := request(body)
			if status == 200 {
				break
			}
			if time.Now().After(end) {
				t.Fatalf("answer %d", status)
			}
			time.Sleep(10 * time.Millisecond)
		}
		if status, _ := request(body); status != 409 {
			t.Fatalf("replayed answer %d", status)
		}
	} else {
		body := `{"request_id":"native-b","action":"cancel"}`
		end := time.Now().Add(time.Second)
		for {
			status, _ := request(body)
			if status == 200 {
				break
			}
			if time.Now().After(end) {
				t.Fatalf("cancel %d", status)
			}
			time.Sleep(10 * time.Millisecond)
		}
		if status, _ := request(body); status != 409 {
			t.Fatalf("replayed cancel %d", status)
		}
	}
}
