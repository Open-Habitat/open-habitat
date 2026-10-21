//go:build linux

package daemon

import (
	"context"
	"encoding/binary"
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

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// This is kernel-UID evidence, not the same-UID browser fixture or installed
// host/systemd evidence. Only invented users/files in the disposable container.
func TestEditorFilesDistinctUIDs(t *testing.T) {
	if os.Getenv("EDITOR_UID_CONTAINER") != "1" {
		t.Skip("requires scripts/test-editor-files-uids.sh disposable container")
	}
	switch os.Getenv("EDITOR_UID_ROLE") {
	case "daemon":
		serveEditorFileUID(t)
		return
	case "probe":
		probeEditorFileUID(t)
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("container coordinator requires namespace root")
	}
	base, e := os.MkdirTemp("/var/tmp", "editor-uids-")
	if e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll(base)
	os.Chmod(base, 0711)
	for _, uid := range []int{21001, 21002} {
		home := filepath.Join(base, fmt.Sprint(uid))
		route := filepath.Join(base, fmt.Sprintf("route-%d", uid))
		for _, p := range []string{home, filepath.Join(home, "src"), filepath.Join(home, "src", "demo"), route} {
			if e := os.Mkdir(p, 0700); e != nil {
				t.Fatal(e)
			}
			os.Chown(p, uid, uid)
		}
		os.Chown(route, uid, 21003)
		os.Chmod(route, 0710)
		name := filepath.Join(home, "src", "demo", "text")
		os.WriteFile(name, []byte(fmt.Sprint(uid)), 0600)
		os.Chown(name, uid, uid)
		foreign := filepath.Join(home, "src", "demo", "foreign")
		os.WriteFile(foreign, []byte("foreign"), 0644)
		os.Chown(foreign, 42003-uid, 42003-uid)
		cmd := exec.Command(os.Args[0], "-test.run=^TestEditorFilesDistinctUIDs$", "-test.v")
		cmd.Env = []string{"EDITOR_UID_CONTAINER=1", "EDITOR_UID_ROLE=daemon", "EDITOR_UID_BASE=" + base, "HOME=" + home, "PATH=/usr/bin:/bin"}
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
		var log strings.Builder
		cmd.Stdout = &log
		cmd.Stderr = &log
		if e := cmd.Start(); e != nil {
			t.Fatal(e)
		}
		t.Cleanup(func() {
			cmd.Process.Kill()
			cmd.Wait()
			if t.Failed() {
				t.Log(log.String())
			}
		})
		socket := filepath.Join(route, "daemon.sock")
		for until := time.Now().Add(5 * time.Second); ; time.Sleep(10 * time.Millisecond) {
			if _, e := os.Stat(socket); e == nil {
				if err := os.Chown(socket, uid, 21003); err != nil {
					t.Fatal(err)
				}
				if err := os.Chmod(socket, 0660); err != nil {
					t.Fatal(err)
				}
				break
			}
			if time.Now().After(until) {
				t.Fatal("daemon not ready", log.String())
			}
		}
	}
	for _, as := range []int{21001, 21002, 21003} {
		cmd := exec.Command(os.Args[0], "-test.run=^TestEditorFilesDistinctUIDs$", "-test.v")
		cmd.Env = []string{"EDITOR_UID_CONTAINER=1", "EDITOR_UID_ROLE=probe", "EDITOR_UID_BASE=" + base, "PATH=/usr/bin:/bin"}
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(as), Gid: uint32(as)}}
		out, e := cmd.CombinedOutput()
		if e != nil {
			t.Fatalf("UID %d: %v\n%s", as, e, out)
		}
		t.Logf("UID %d: %s", as, out)
	}
}
func serveEditorFileUID(t *testing.T) {
	uid := os.Geteuid()
	home := os.Getenv("HOME")
	base := os.Getenv("EDITOR_UID_BASE")
	cfg := transport.Config{UID: uid, GatewayUID: 21003, Home: home, Provider: "github", Subject: strconv.Itoa(uid)}
	trusted := func(r *http.Request) bool { return r.Context().Value("peer") == 21003 }
	c := &ConversationController{cfg: cfg, home: home, discover: Discover, trusted: trusted, sessions: map[string]*conversation{}}
	socket := filepath.Join(base, fmt.Sprintf("route-%d", uid), "daemon.sock")
	ln, e := net.Listen("unix", socket)
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	os.Chmod(socket, 0660)
	srv := http.Server{Handler: c.EditorFiles(), ConnContext: func(ctx context.Context, conn net.Conn) context.Context {
		peer, e := PeerUID(conn.(*net.UnixConn))
		if e != nil {
			return ctx
		}
		return context.WithValue(ctx, "peer", int(peer))
	}}
	if e := srv.Serve(ln); e != nil && e != http.ErrServerClosed {
		t.Fatal(e)
	}
}
func probeEditorFileUID(t *testing.T) {
	base := os.Getenv("EDITOR_UID_BASE")
	as := os.Geteuid()
	for _, owner := range []int{21001, 21002} {
		socket := filepath.Join(base, fmt.Sprintf("route-%d", owner), "daemon.sock")
		client := &http.Client{Timeout: 5 * time.Second, Transport: &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", socket)
		}}}
		own := opaque("ws_", "github:"+strconv.Itoa(owner)+":demo")
		res, e := client.Get("http://unix" + EditorFilesPrefix + "file?workspace_id=" + own + "&path=text")
		if as != 21003 {
			if e == nil {
				res.Body.Close()
				if res.StatusCode != 403 {
					t.Fatal("non-gateway peer admitted", as, owner, res.StatusCode)
				}
			}
			continue
		}
		if e != nil {
			t.Fatal(e)
		}
		raw, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode != 200 {
			t.Fatal("own read", res.StatusCode, string(raw))
		}
		var doc map[string]any
		json.Unmarshal(raw, &doc)
		if doc["content"] != fmt.Sprint(owner) {
			t.Fatal("wrong UID content")
		}
		body := saveInput(own, "text", doc["version"].(string), "saved by mapped daemon", false, "none")
		req, _ := http.NewRequest("PUT", "http://unix"+EditorFilesPrefix+"file", strings.NewReader(string(body)))
		req.Header.Set("Content-Type", "application/json")
		saved, e := client.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		saved.Body.Close()
		if saved.StatusCode != 200 {
			t.Fatal("own write", saved.StatusCode)
		}
		other := opaque("ws_", "github:"+strconv.Itoa(42003-owner)+":demo")
		for _, target := range []string{"file?workspace_id=" + other + "&path=text", "file?workspace_id=" + own + "&path=foreign", "file?workspace_id=" + own + "&path=..%2F..%2F21002%2Fsrc%2Fdemo%2Ftext"} {
			res, e := client.Get("http://unix" + EditorFilesPrefix + target)
			if e != nil {
				t.Fatal(e)
			}
			raw, _ := io.ReadAll(res.Body)
			res.Body.Close()
			if res.StatusCode < 400 || strings.Contains(string(raw), "saved by mapped daemon") {
				t.Fatal("foreign target admitted", target, res.StatusCode)
			}
		}
		client.CloseIdleConnections()
	}
}

func TestEditorFilesMountRefused(t *testing.T) {
	if os.Getenv("EDITOR_UID_CONTAINER") != "1" {
		t.Skip("requires disposable mount namespace")
	}
	_, id, p, h := editorFixture(t)
	target := filepath.Join(p, "mounted")
	if e := os.Mkdir(target, 0700); e != nil {
		t.Fatal(e)
	}
	source := t.TempDir()
	os.WriteFile(filepath.Join(source, "text"), []byte("mounted content"), 0600)
	if e := unix.Mount(source, target, "", unix.MS_BIND, ""); e != nil {
		t.Fatal("mount fixture unavailable", e)
	}
	defer unix.Unmount(target, 0)
	status, _ := editorCall(h, "GET", "file", id, "mounted/text", nil)
	if status == 200 {
		t.Fatal("crossed bind mount")
	}
}

func TestEditorFilesCapabilityMetadataRefused(t *testing.T) {
	if os.Getenv("EDITOR_UID_CONTAINER") != "1" {
		t.Skip("requires disposable namespace root with CAP_SETFCAP")
	}
	_, id, p, h := editorFixture(t)
	file := filepath.Join(p, "capability")
	os.WriteFile(file, []byte("readable"), 0600)
	capability := make([]byte, 20)
	binary.LittleEndian.PutUint32(capability, 0x02000001) // revision 2 + effective
	binary.LittleEndian.PutUint32(capability[4:], 1<<10)  // CAP_NET_BIND_SERVICE
	if e := unix.Setxattr(file, "security.capability", capability, 0); e != nil {
		t.Fatal("capability fixture", e)
	}
	status, doc := editorCall(h, "GET", "file", id, "capability", nil)
	if status != 200 {
		t.Fatal("read", status)
	}
	status, _ = editorCall(h, "PUT", "file", id, "", saveInput(id, "capability", doc["version"].(string), "changed", false, "none"))
	if status != 415 {
		t.Fatal("capability replacement accepted", status)
	}
}
