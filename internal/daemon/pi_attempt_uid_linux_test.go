//go:build linux

package daemon_test

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/base64"
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

	"github.com/Open-Habitat/open-habitat/internal/daemon"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// TestPiAttemptDistinctUIDs runs only inside scripts/test-pi-attempt-uids.sh's
// disposable, networkless rootless container. The two listeners and the caller
// are three actual kernel UIDs; no host home or provider is available there.
func TestPiAttemptDistinctUIDs(t *testing.T) {
	if os.Getenv("PI_UID_CONTAINER") != "1" {
		t.Skip("requires disposable rootless container with three synthetic UIDs")
	}
	switch os.Getenv("PI_ROLE") {
	case "daemon":
		servePiUID(t)
		return
	case "probe":
		probePiUID(t)
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("container coordinator requires namespace root")
	}
	base, err := os.MkdirTemp("/tmp", "pi-attempt-uids-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(base) })
	// os.TempDir is inside the container. The only shared traversal is this
	// disposable root-owned directory; each socket itself is owner:gateway 0660.
	if err := os.Chmod(base, 0711); err != nil {
		t.Fatal(err)
	}
	for i, uid := range []int{21001, 21002} {
		home := map[int]string{21001: "/tmp/agent-a", 21002: "/tmp/agent-b"}[uid]
		t.Cleanup(func() { _ = os.RemoveAll(home) })
		if err := os.Mkdir(home, 0700); err != nil {
			t.Fatal(err)
		}
		node := filepath.Join(home, "fake-node")
		script := `#!/bin/sh
case "$6" in
 status) printf '%s\n' '{"type":"status","state":"missing"}' ;;
 login) printf '%s\n' '{"type":"device_code","verificationUri":"https://auth.openai.com/codex/device","userCode":"ABCD-1234"}'; sleep 4; printf '%s\n' '{"type":"unknown"}' ;;
esac
`
		if err := os.WriteFile(node, []byte(script), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.Chown(node, uid, uid); err != nil {
			t.Fatal(err)
		}
		if err := os.Chown(home, uid, uid); err != nil {
			t.Fatal(err)
		}
		socketDir := filepath.Join(base, fmt.Sprintf("route-%d", uid))
		if err := os.Mkdir(socketDir, 0710); err != nil {
			t.Fatal(err)
		}
		if err := os.Chown(socketDir, uid, 21003); err != nil {
			t.Fatal(err)
		}
		path := filepath.Join(socketDir, "daemon.sock")
		cmd := exec.Command(os.Args[0], "-test.run=^TestPiAttemptDistinctUIDs$")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
		cmd.Env = append(os.Environ(), "PI_ROLE=daemon", "PI_PATH="+path, "PI_HOME="+home, "PI_SUBJECT="+strconv.Itoa(42+i), "HOME="+home)
		output := new(strings.Builder)
		cmd.Stdout = output
		cmd.Stderr = output
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
		if err := os.Chown(path, uid, 21003); err != nil {
			t.Fatal(err)
		}
		if err := os.Chmod(path, 0660); err != nil {
			t.Fatal(err)
		}
	}
	probe := func(uid int, socket, subject, method, token string, expected int) {
		t.Helper()
		cmd := exec.Command(os.Args[0], "-test.run=^TestPiAttemptDistinctUIDs$")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
		cmd.Env = append(os.Environ(), "PI_ROLE=probe", "PI_PATH="+filepath.Join(base, "route-"+socket, "daemon.sock"), "PI_SUBJECT="+subject, "PI_METHOD="+method, "PI_TOKEN="+token, "PI_EXPECT="+strconv.Itoa(expected))
		if b, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("UID %d socket %s %s: %v %s", uid, socket, method, err, b)
		}
	}
	a, b := strings.Repeat("A", 43), strings.Repeat("B", 43)
	probe(21003, "21001", "42", "GET", a, 404)
	probe(21003, "21001", "42", "POST", a, 200)
	probe(21003, "21001", "42", "GET", b, 404)
	probe(21003, "21001", "42", "DELETE", b, 404)
	probe(21003, "21001", "42", "GET", a, 200)
	probe(21003, "21002", "43", "GET", a, 404) // same session digest cannot cross socket
	probe(21002, "21001", "42", "GET", a, -1)  // wrong UID cannot connect at all
	probe(21001, "21002", "43", "DELETE", a, -1)
	probe(21003, "21001", "42", "NATIVE", a, 200) // mapped peer retains access to its own native data
	probe(21003, "21002", "43", "NATIVE", a, 200)
}
func servePiUID(t *testing.T) {
	uid := os.Geteuid()
	home := os.Getenv("PI_HOME")
	path := os.Getenv("PI_PATH")
	subject := os.Getenv("PI_SUBJECT")
	name := map[int]string{21001: "agent-a", 21002: "agent-b"}[uid]
	cfg := transport.Config{GatewayUID: 21003, UID: uid, Username: name, Home: home, Socket: "/run/open-habitat/users/" + name + "/daemon.sock", Provider: "github", Subject: subject}
	ln, err := net.Listen("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	trusted := func(r *http.Request) bool { return r.Context().Value("peer") == 21003 }
	device := &daemon.PiDevice{Home: home, Node: filepath.Join(home, "fake-node"), Entry: "/synthetic/entry", Manifest: "/synthetic/manifest"}
	mux := http.NewServeMux()
	mux.Handle("/api/v1/onboarding/pi/attempt", daemon.PiAttemptHandler(cfg, trusted, device))
	mux.Handle("/api/v1/snapshot", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !trusted(r) {
			w.WriteHeader(403)
			return
		}
		fmt.Fprint(w, "NATIVE-SECRET")
	}))
	srv := &http.Server{Handler: mux, ConnContext: func(ctx context.Context, c net.Conn) context.Context {
		if uc, ok := c.(*net.UnixConn); ok {
			v, e := daemon.PeerUID(uc)
			if e == nil {
				return context.WithValue(ctx, "peer", int(v))
			}
		}
		return ctx
	}}
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		t.Fatal(err)
	}
}
func probePiUID(t *testing.T) {
	path := os.Getenv("PI_PATH")
	conn, err := net.DialTimeout("unix", path, 2*time.Second)
	expected, _ := strconv.Atoi(os.Getenv("PI_EXPECT"))
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
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
	subject := os.Getenv("PI_SUBJECT")
	hash := sha256.Sum256([]byte("github:" + subject))
	method := os.Getenv("PI_METHOD")
	endpoint := "/api/v1/onboarding/pi/attempt"
	if method == "NATIVE" {
		method = "GET"
		endpoint = "/api/v1/snapshot"
	}
	req, err := http.NewRequest(method, "http://unix"+endpoint, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("X-Agent-Host-Identity", "wid_"+base64.RawURLEncoding.EncodeToString(hash[:18]))
	req.Header.Set("X-Agent-Host-Display-Name", "GitHub user "+subject)
	req.Header.Set("X-Agent-Host-Session", os.Getenv("PI_TOKEN"))
	req.Close = true
	if err = req.Write(conn); err != nil {
		t.Fatal(err)
	}
	res, err := http.ReadResponse(bufio.NewReader(conn), req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 4096))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != expected || strings.Contains(string(body), "NATIVE-SECRET") || strings.Contains(string(body), "ABCD-1234") && expected != 200 {
		t.Fatalf("response %d, expected %d", res.StatusCode, expected)
	}
}
