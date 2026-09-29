//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
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

	"github.com/maintainer/native-agent-host/internal/transport"
)

// Run through scripts/test-repo-catalog-uids.sh: three real kernel UIDs in a
// disposable networkless namespace. No host gh, home, or credential is used.
func TestRepoCatalogDistinctUIDs(t *testing.T) {
	if os.Getenv("REPO_UID_CONTAINER") != "1" {
		t.Skip("requires disposable rootless container")
	}
	if os.Getenv("REPO_ROLE") == "server" {
		serveCatalogUID(t)
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("namespace root required")
	}
	base, e := os.MkdirTemp("/var/tmp", "catalog-uids-")
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { _ = os.RemoveAll(base) })
	if e = os.Chmod(base, 0711); e != nil {
		t.Fatal(e)
	}
	for i, uid := range []int{21001, 21002} {
		subject := strconv.Itoa(42 + i)
		home := map[int]string{21001: "/var/tmp/catalog-agent-a", 21002: "/var/tmp/catalog-agent-b"}[uid]
		t.Cleanup(func() { _ = os.RemoveAll(home) })
		if e = os.Mkdir(home, 0700); e != nil {
			t.Fatal(e)
		}
		if e = os.WriteFile(filepath.Join(home, "fixture-id"), []byte(subject), 0600); e != nil {
			t.Fatal(e)
		}
		script := `#!/bin/sh
[ "$GH_PROMPT_DISABLED" = 1 ] || exit 9
[ -z "$GH_TOKEN" ] || exit 9
id=$(cat "$HOME/fixture-id") || exit 9
case "$4" in
/user) printf '{"id":%s}\n' "$id" ;;
/repos/fixture/repo*) printf '{"owner":{"login":"fixture"},"name":"repo%s","full_name":"fixture/repo%s","clone_url":"https://github.com/fixture/repo%s.git"}\n' "$id" "$id" "$id" ;;
/user/repos?*) printf '[{"owner":{"login":"fixture"},"name":"repo%s","full_name":"fixture/repo%s","html_url":"https://github.com/fixture/repo%s","private":true,"pushed_at":null,"description":null}]\n' "$id" "$id" "$id" ;;
*) exit 9 ;;
esac
`
		if e = os.WriteFile(filepath.Join(home, "gh"), []byte(script), 0700); e != nil {
			t.Fatal(e)
		}
		gitScript := `#!/bin/sh
if [ "$1" = -c ]; then shift 2; fi
case "$1" in
clone) [ "$2" = -- ] && [ "$3" = "https://github.com/fixture/repo$(cat "$HOME/fixture-id").git" ] && [ "$4" = . ] || exit 9
 mkdir .git || exit 9 ;;
rev-parse) printf 'true\n' ;;
remote|config) printf 'https://github.com/fixture/repo%s.git\n' "$(cat "$HOME/fixture-id")" ;;
status) : ;;
*) exit 9 ;;
esac
`
		if e = os.WriteFile(filepath.Join(home, "git"), []byte(gitScript), 0700); e != nil {
			t.Fatal(e)
		}
		for _, file := range []string{"gh", "git", "fixture-id"} {
			if e = os.Chown(filepath.Join(home, file), uid, uid); e != nil {
				t.Fatal(e)
			}
		}
		if e = os.Chown(home, uid, uid); e != nil {
			t.Fatal(e)
		}
		dir := filepath.Join(base, subject)
		if e = os.Mkdir(dir, 0710); e != nil {
			t.Fatal(e)
		}
		if e = os.Chown(dir, uid, 21003); e != nil {
			t.Fatal(e)
		}
		socket := filepath.Join(dir, "daemon.sock")
		cmd := exec.Command(os.Args[0], "-test.run=^TestRepoCatalogDistinctUIDs$")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
		cmd.Env = append(os.Environ(), "REPO_ROLE=server", "REPO_SOCKET="+socket, "REPO_HOME="+home, "REPO_SUBJECT="+subject)
		var output strings.Builder
		cmd.Stdout = &output
		cmd.Stderr = &output
		if e = cmd.Start(); e != nil {
			t.Fatal(e)
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
			if _, e = os.Lstat(socket); e == nil {
				break
			}
			if time.Now().After(deadline) {
				t.Fatalf("socket unavailable: %s", output.String())
			}
			time.Sleep(10 * time.Millisecond)
		}
		if e = os.Chown(socket, uid, 21003); e != nil {
			t.Fatal(e)
		}
		if e = os.Chmod(socket, 0660); e != nil {
			t.Fatal(e)
		}
	}
	for _, subject := range []string{"42", "43"} {
		socket := filepath.Join(base, subject, "daemon.sock")
		// Only the gateway UID can connect. A second daemon UID cannot traverse.
		probe := func(uid int, identity string) (int, string, error) {
			cmd := exec.Command(os.Args[0], "-test.run=^TestRepoCatalogUIDProbe$")
			cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
			cmd.Env = append(os.Environ(), "REPO_UID_PROBE=1", "REPO_SOCKET="+socket, "REPO_SUBJECT="+identity)
			b, e := cmd.CombinedOutput()
			if e != nil {
				return 0, string(b), e
			}
			var status int
			var body string
			if _, e = fmt.Sscanf(string(b), "%d %s", &status, &body); e != nil {
				return 0, string(b), e
			}
			return status, body, nil
		}
		status, body, e := probe(21003, subject)
		if e != nil || status != 200 || !strings.Contains(body, "repo"+subject) {
			t.Fatalf("UID %s: %d %s %v", subject, status, body, e)
		}
		foreign := "42"
		if subject == "42" {
			foreign = "43"
		}
		status, body, e = probe(21003, foreign)
		if e != nil || status != 403 || strings.Contains(body, "repo") {
			t.Fatalf("forged UID %s: %d %s %v", subject, status, body, e)
		}
		foreignUID := 21001
		if subject == "42" {
			foreignUID = 21002
		}
		// The same gateway UID may request a clone only from the mapped daemon.
		cloneProbe := func(identity string) (int, string, error) {
			cmd := exec.Command(os.Args[0], "-test.run=^TestRepoCatalogUIDProbe$")
			cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 21003, Gid: 21003}}
			cmd.Env = append(os.Environ(), "REPO_UID_PROBE=1", "REPO_CLONE=1", "REPO_EXPECTED="+subject, "REPO_SOCKET="+socket, "REPO_SUBJECT="+identity)
			b, err := cmd.CombinedOutput()
			if err != nil {
				return 0, string(b), err
			}
			var status int
			var body string
			_, err = fmt.Sscanf(string(b), "%d %s", &status, &body)
			return status, body, err
		}
		observeProbe := func(identity string) (int, string, error) {
			cmd := exec.Command(os.Args[0], "-test.run=^TestRepoCatalogUIDProbe$")
			cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 21003, Gid: 21003}}
			cmd.Env = append(os.Environ(), "REPO_UID_PROBE=1", "REPO_OBSERVE=1", "REPO_EXPECTED="+subject, "REPO_SOCKET="+socket, "REPO_SUBJECT="+identity)
			b, err := cmd.CombinedOutput()
			if err != nil {
				return 0, string(b), err
			}
			var status int
			var body string
			_, err = fmt.Sscanf(string(b), "%d %s", &status, &body)
			return status, body, err
		}
		status, body, e = observeProbe(foreign)
		if e != nil || status != 403 || strings.Contains(body, "repo") {
			t.Fatalf("forged observation %s: %d %s %v", subject, status, body, e)
		}
		status, body, e = observeProbe(subject)
		if e != nil || status != 200 || !strings.Contains(body, "absent") {
			t.Fatalf("observation before clone %s: %d %s %v", subject, status, body, e)
		}
		status, body, e = cloneProbe(foreign)
		if e != nil || status != 403 {
			t.Fatalf("forged clone %s: %d %s %v", subject, status, body, e)
		}
		status, body, e = cloneProbe(subject)
		if e != nil || status != 200 || !strings.Contains(body, "cloned") {
			t.Fatalf("clone %s: %d %s %v", subject, status, body, e)
		}
		status, body, e = observeProbe(subject)
		if e != nil || status != 200 || !strings.Contains(body, "confirmed") {
			t.Fatalf("observation after clone %s: %d %s %v", subject, status, body, e)
		}
		status, body, e = cloneProbe(subject)
		if e != nil || status != 409 || !strings.Contains(body, "checkout_exists") {
			t.Fatalf("repeat %s: %d %s %v", subject, status, body, e)
		}
		_, _, e = probe(foreignUID, subject)
		if e == nil {
			t.Fatal("foreign daemon UID connected to mapped socket")
		}
	}
}
func serveCatalogUID(t *testing.T) {
	uid := os.Geteuid()
	home := os.Getenv("REPO_HOME")
	subject := os.Getenv("REPO_SUBJECT")
	name := map[int]string{21001: "agent-a", 21002: "agent-b"}[uid]
	cfg := transport.Config{GatewayUID: 21003, UID: uid, Username: name, Home: home, Socket: "/run/native-agent-host/users/" + name + "/daemon.sock", Provider: "github", Subject: subject}
	ln, e := net.Listen("unix", os.Getenv("REPO_SOCKET"))
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	trusted := func(r *http.Request) bool { return r.Context().Value("peer") == 21003 }
	run := func(ctx context.Context, args ...string) ([]byte, error) {
		return runRepoGHProgram(ctx, home, filepath.Join(home, "gh"), args...)
	}
	mux := http.NewServeMux()
	mux.Handle(RepoCatalogPath, repoCatalogHandler(cfg, trusted, run))
	mux.Handle(RepoClonePath, RepoCloneHandlerWithFixturePrograms(cfg, trusted, home, home, filepath.Join(home, "gh"), filepath.Join(home, "git")))
	mux.Handle(RepoObservePath, RepoObserveHandlerWithFixtureGit(cfg, trusted, home, filepath.Join(home, "git")))
	srv := &http.Server{Handler: mux, ConnContext: func(ctx context.Context, c net.Conn) context.Context {
		if uc, ok := c.(*net.UnixConn); ok {
			v, e := PeerUID(uc)
			if e == nil {
				return context.WithValue(ctx, "peer", int(v))
			}
		}
		return ctx
	}}
	if e = srv.Serve(ln); e != nil && e != http.ErrServerClosed {
		t.Fatal(e)
	}
}
func TestRepoCatalogUIDProbe(t *testing.T) {
	if os.Getenv("REPO_UID_PROBE") != "1" {
		t.Skip("helper")
	}
	conn, e := net.DialTimeout("unix", os.Getenv("REPO_SOCKET"), 2*time.Second)
	if e != nil {
		t.Fatal(e)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
	subject := os.Getenv("REPO_SUBJECT")
	method, path := "GET", RepoCatalogPath+"?page=1&limit=2"
	var bodyReader io.Reader
	if os.Getenv("REPO_CLONE") == "1" {
		method, path = "POST", RepoClonePath
		bodyReader = bytes.NewBufferString(`{"full_name":"fixture/repo` + os.Getenv("REPO_EXPECTED") + `"}`)
	} else if os.Getenv("REPO_OBSERVE") == "1" {
		path = RepoObservePath + "?full_name=fixture%2Frepo" + os.Getenv("REPO_EXPECTED")
	}
	req, e := http.NewRequest(method, "http://unix"+path, bodyReader)
	if e != nil {
		t.Fatal(e)
	}
	req.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:"+subject))
	req.Header.Set("X-Agent-Host-Display-Name", "GitHub user "+subject)
	req.Close = true
	if e = req.Write(conn); e != nil {
		t.Fatal(e)
	}
	res, e := http.ReadResponse(bufio.NewReader(conn), req)
	if e != nil {
		t.Fatal(e)
	}
	defer res.Body.Close()
	b, e := io.ReadAll(io.LimitReader(res.Body, 4096))
	if e != nil {
		t.Fatal(e)
	}
	fmt.Printf("%d %s\n", res.StatusCode, strings.TrimSpace(string(b)))
}
