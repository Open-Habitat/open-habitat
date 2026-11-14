//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/gateway"
	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// The site's default repositories under distinct kernel UIDs (ADR 0030):
// a gateway process as its own UID checks each default with each person's
// sign-in token and hands the readable ones, with the token, over the real
// transport to each person's daemon process, which runs as that person and
// accepts only the gateway's kernel peer. agent-a can read both defaults,
// agent-b only the shared one. The unreadable name must never reach agent-b:
// not the handoff, the daemon's gh, the home, the daemon's process, nor any
// reply the gateway gives agent-b's browser. Run only by
// scripts/test-onboarding-defaults-uids.sh in a disposable container.

const (
	defaultsShared  = "site-org/team-workspace"
	defaultsSecret  = "site-org/management-workspace"
	defaultsGateway = 21003
)

var defaultsPeople = []struct {
	name, subject, token string
	uid                  int
}{
	{"agent-a", "42", "fixture-token-agent-a-0001", 21001},
	{"agent-b", "43", "fixture-token-agent-b-0002", 21002},
}

func TestOnboardingDefaultsDistinctUIDs(t *testing.T) {
	if os.Getenv("DEFAULTS_UID_CONTAINER") != "1" {
		t.Skip("requires disposable rootless container")
	}
	switch os.Getenv("DEFAULTS_ROLE") {
	case "daemon":
		serveDefaultsDaemon(t)
		return
	case "gateway":
		runDefaultsGateway(t)
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("namespace root required")
	}
	run := func(uid int, env ...string) *exec.Cmd {
		cmd := exec.Command(os.Args[0], "-test.run=^TestOnboardingDefaultsDistinctUIDs$")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
		cmd.Env = append(os.Environ(), env...)
		return cmd
	}
	must := func(e error) {
		t.Helper()
		if e != nil {
			t.Fatal(e)
		}
	}
	runtime := "/run/open-habitat/users"
	must(os.MkdirAll(runtime, 0711))
	daemons := map[string]*exec.Cmd{}
	for _, p := range defaultsPeople {
		home := "/home/" + p.name
		must(os.MkdirAll(filepath.Join(home, "src"), 0700))
		must(os.WriteFile(filepath.Join(home, "fixture-id"), []byte(p.subject), 0600))
		must(os.WriteFile(filepath.Join(home, "gh"), []byte(defaultsGH), 0700))
		must(os.WriteFile(filepath.Join(home, "git"), []byte(defaultsGit), 0700))
		must(exec.Command("chown", "-R", fmt.Sprintf("%d:%d", p.uid, p.uid), home).Run())
		must(os.Chmod(home, 0700))
		dir := filepath.Join(runtime, p.name)
		must(os.Mkdir(dir, 0710))
		must(os.Chown(dir, p.uid, defaultsGateway))
		cmd := run(p.uid, "DEFAULTS_ROLE=daemon", "DEFAULTS_NAME="+p.name, "DEFAULTS_SUBJECT="+p.subject)
		var out bytes.Buffer
		cmd.Stdout, cmd.Stderr = &out, &out
		must(cmd.Start())
		daemons[p.name] = cmd
		t.Cleanup(func() {
			_ = cmd.Process.Kill()
			_ = cmd.Wait()
			if t.Failed() {
				t.Log(p.name, out.String())
			}
		})
		socket := filepath.Join(dir, "daemon.sock")
		for deadline := time.Now().Add(10 * time.Second); ; time.Sleep(20 * time.Millisecond) {
			if st, e := os.Lstat(socket); e == nil && st.Mode().Perm() == 0660 {
				break
			}
			if time.Now().After(deadline) {
				t.Fatal("daemon socket unavailable", out.String())
			}
		}
		// The group lets only the gateway connect, as the socket unit does.
		must(os.Chown(socket, p.uid, defaultsGateway))
	}
	state := "/var/lib/oh-defaults-gateway"
	must(os.MkdirAll(state, 0700))
	admin, _ := json.Marshal(map[string]any{"version": 1, "name": "Fixture", "administrators": []string{}, "default_limit_bytes": 64 << 20,
		"onboarding": map[string]any{"version": 1, "repositories": map[string]any{"mode": "auto", "defaults": []string{defaultsShared, defaultsSecret}}, "integrations": []any{}, "ai_account": map[string]any{"offer": "all"}}})
	must(os.WriteFile(filepath.Join(state, "administration.json"), admin, 0600))
	must(exec.Command("chown", "-R", fmt.Sprintf("%d:%d", defaultsGateway, defaultsGateway), state).Run())

	gw := run(defaultsGateway, "DEFAULTS_ROLE=gateway", "DEFAULTS_STATE="+state)
	var gwErr bytes.Buffer
	gw.Stderr = &gwErr
	report, err := gw.Output()
	if err != nil {
		t.Fatal("gateway role failed", err, gwErr.String(), string(report))
	}
	var replies map[string]map[string]string
	_, line, _ := bytes.Cut(report, []byte("DEFAULTS_REPORT="))
	line, _, _ = bytes.Cut(line, []byte("\n"))
	if e := json.Unmarshal(line, &replies); e != nil {
		t.Fatal("gateway report", e, string(report))
	}
	secretRepo := strings.Split(defaultsSecret, "/")[1]
	// agent-a, who can read both, is the positive control: the name did
	// travel for the person allowed to see it.
	a, b := replies["agent-a"], replies["agent-b"]
	for _, path := range []string{"site", "repos", "clones"} {
		if !strings.Contains(a[path], defaultsSecret) {
			t.Fatalf("agent-a %s lacks the readable default: %s", path, a[path])
		}
		if !strings.Contains(b[path], defaultsShared) {
			t.Fatalf("agent-b %s lacks the shared default: %s", path, b[path])
		}
		if strings.Contains(b[path], secretRepo) {
			t.Fatalf("agent-b %s names the unreadable default: %s", path, b[path])
		}
	}
	if !strings.Contains(b["repos"], `"default":"locked"`) {
		t.Fatal("agent-b's shared default is not a locked row", b["repos"])
	}
	// Under agent-b's UID nothing ever held the name: its daemon's gh calls,
	// every file in its home, the daemon's argv and environment.
	argvA, _ := os.ReadFile("/home/agent-a/gh-argv.log")
	if !bytes.Contains(argvA, []byte(secretRepo)) {
		t.Fatal("agent-a's daemon never asked its gh for the readable default", string(argvA))
	}
	_ = filepath.WalkDir("/home/agent-b", func(path string, d os.DirEntry, e error) error {
		if e != nil || d.IsDir() {
			return nil
		}
		if b, err := os.ReadFile(path); err == nil && bytes.Contains(b, []byte(secretRepo)) {
			t.Errorf("agent-b home file %s names the unreadable default", path)
		}
		return nil
	})
	pid := daemons["agent-b"].Process.Pid
	// Its environment is this test's plus fixed role names; the rootless
	// container's root may not read another UID's environ.
	for _, f := range []string{"cmdline"} {
		if b, e := os.ReadFile(fmt.Sprintf("/proc/%d/%s", pid, f)); e != nil || bytes.Contains(b, []byte(secretRepo)) {
			t.Fatal("agent-b daemon process", f, e)
		}
	}
	// The tokens stayed transient: no home, the gateway's state nor any
	// reply holds one.
	for _, p := range defaultsPeople {
		for _, root := range []string{"/home/agent-a", "/home/agent-b", state} {
			_ = filepath.WalkDir(root, func(path string, d os.DirEntry, e error) error {
				if e == nil && !d.IsDir() {
					if b, err := os.ReadFile(path); err == nil && bytes.Contains(b, []byte(p.token)) {
						t.Errorf("token of %s persisted in %s", p.name, path)
					}
				}
				return nil
			})
		}
		for _, reply := range replies {
			for _, body := range reply {
				if strings.Contains(body, p.token) {
					t.Errorf("token of %s returned", p.name)
				}
			}
		}
	}
	if bytes.Contains(gwErr.Bytes(), []byte("fixture-token")) || bytes.Contains(gwErr.Bytes(), []byte(secretRepo)) {
		t.Fatal("gateway logged a token or a default name")
	}
	// Distinct UIDs, not a same-UID mock: agent-b cannot read agent-a's home.
	probe := run(defaultsPeople[1].uid, "DEFAULTS_ROLE=none")
	probe.Args = []string{"/bin/ls", "/home/agent-a"}
	probe.Path = "/bin/ls"
	if out, e := probe.CombinedOutput(); e == nil {
		t.Fatal("agent-b read agent-a's home", string(out))
	}
}

const defaultsGH = `#!/bin/sh
printf '%s\n' "$*" >> "$HOME/gh-argv.log"
id=$(cat "$HOME/fixture-id") || exit 9
repo() { printf '{"name":"%s","full_name":"site-org/%s","private":true,"description":null,"pushed_at":null,"html_url":"https://github.com/site-org/%s","size":1,"default_branch":"main","owner":{"login":"site-org","type":"Organization"},"clone_url":"https://github.com/site-org/%s.git"}' "$1" "$1" "$1" "$1"; }
if [ "$2" = --include ]; then
  case "$5" in
  /repos/site-org/*) printf 'HTTP/2.0 200 OK\r\n\r\n'; repo "${5##*/}"; printf '\n' ;;
  *) printf 'HTTP/2.0 404 Not Found\r\n\r\n{}\n'; exit 1 ;;
  esac
  exit 0
fi
case "$4" in
/user) printf '{"id":%s,"login":"person%s"}\n' "$id" "$id" ;;
/user/repos?*) printf '[]\n' ;;
/repos/site-org/*) repo "${4##*/}"; printf '\n' ;;
*) exit 9 ;;
esac
`

const defaultsGit = `#!/bin/sh
if [ "$1" = -c ]; then shift 2; fi
case "$1" in
clone) [ "$2" = --progress ] && [ "$3" = -- ] && [ "$5" = . ] || exit 9
  mkdir .git && printf '%s\n' "$4" > .git/origin-url || exit 9 ;;
rev-parse) if [ "$2" = --verify ]; then printf '0123456789abcdef0123456789abcdef01234567\n'; else printf 'true\n'; fi ;;
remote|config) cat .git/origin-url ;;
status) : ;;
*) exit 9 ;;
esac
`

// serveDefaultsDaemon is the person's daemon, run as that person: the real
// handoff server with the real plan consumer, clone jobs and catalog, on a
// socket it bound itself, accepting only the gateway's kernel peer.
func serveDefaultsDaemon(t *testing.T) {
	name, subject := os.Getenv("DEFAULTS_NAME"), os.Getenv("DEFAULTS_SUBJECT")
	home := "/home/" + name
	cfg := transport.Config{GatewayUID: defaultsGateway, UID: os.Geteuid(), Username: name, Home: home, Socket: "/run/open-habitat/users/" + name + "/daemon.sock", Provider: "github", Subject: subject}
	server, err := transport.NewServer(cfg, func(context.Context, string, bool) (bool, error) { return false, nil })
	if err != nil {
		t.Fatal("handoff server", err)
	}
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: cfg.Socket, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	if err = os.Chmod(cfg.Socket, 0660); err != nil {
		t.Fatal(err)
	}
	gh, git := filepath.Join(home, "gh"), filepath.Join(home, "git")
	ctx := context.Background()
	clones := NewCloneJobsWithFixturePrograms(ctx, cfg, server.TrustedPeer, home, gh, git)
	server.SetPlanConsumer(clones.Plan)
	mux := http.NewServeMux()
	mux.Handle(RepoCatalogPath, RepoCatalogHandlerWithFixtureGH(cfg, server.TrustedPeer, gh, home))
	mux.Handle(RepoClonesPath, clones.Handler())
	if err = server.ServeMux(ctx, ln, mux); err != nil {
		t.Fatal("serve", err)
	}
}

type defaultsProvider struct{}

func (defaultsProvider) AuthorizationURL(state, challenge string, _ []string) string {
	return "https://github.com/login/oauth/authorize?" + url.Values{"state": {state}}.Encode()
}
func (defaultsProvider) Exchange(_ context.Context, code, _ string) (string, string, string, error) {
	for _, p := range defaultsPeople {
		if code == p.subject {
			return p.token, p.subject, p.name, nil
		}
	}
	return "", "", "", errors.New("unknown")
}

// CheckRepository is GitHub's answer per token: only agent-a can read the
// management workspace.
func (defaultsProvider) CheckRepository(_ context.Context, token, name string) string {
	if name == defaultsShared || name == defaultsSecret && token == defaultsPeople[0].token {
		return "readable"
	}
	return "no_access"
}

type defaultsBroker struct{ created map[string]bool }

func (b *defaultsBroker) Exchange(_ context.Context, r gateway.BrokerRequest) (gateway.BrokerReply, error) {
	for _, p := range defaultsPeople {
		if p.subject == r.ID {
			created := r.Operation == "ensure" && !b.created[p.subject]
			if created {
				b.created[p.subject] = true
			}
			return gateway.BrokerReply{Route: &gateway.BrokerRoute{UID: uint32(p.uid), Username: p.name, Socket: "/run/open-habitat/users/" + p.name + "/daemon.sock"}, Epoch: 1, Generation: 1, Created: created}, nil
		}
	}
	return gateway.BrokerReply{}, errors.New("not admitted")
}

// runDefaultsGateway is the gateway, run as its own UID: each person's first
// sign-in, then that person's own reads, printed as one JSON line.
func runDefaultsGateway(t *testing.T) {
	peer := func(c *net.UnixConn) int {
		raw, err := c.SyscallConn()
		if err != nil {
			return -1
		}
		var u *unix.Ucred
		var e error
		if raw.Control(func(fd uintptr) { u, e = unix.GetsockoptUcred(int(fd), unix.SOL_SOCKET, unix.SO_PEERCRED) }) != nil || e != nil || u == nil {
			return -1
		}
		return int(u.Uid)
	}
	auth, err := gateway.NewAuth(gateway.OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, gateway.AuthOptions{
		Provider: defaultsProvider{}, Sink: transport.NewFixtureSink(), Broker: &defaultsBroker{created: map[string]bool{}},
		AdminFile: filepath.Join(os.Getenv("DEFAULTS_STATE"), "administration.json"), Log: gateway.CallbackLogger(os.Stderr),
		SnapshotDial: func(ctx context.Context, p string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", p)
		},
		SnapshotPeerUID: peer,
	})
	if err != nil {
		t.Fatal(err)
	}
	h := gateway.NewWithAuth("", auth)
	send := func(path string, cookies []*http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "https://host.test"+path, nil)
		r.RequestURI = r.URL.RequestURI()
		for _, c := range cookies {
			r.AddCookie(c)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	out := map[string]map[string]string{}
	for _, p := range defaultsPeople {
		start := send("/auth/github/start", nil)
		loc, _ := url.Parse(start.Header().Get("Location"))
		cb := send("/auth/github/callback?state="+url.QueryEscape(loc.Query().Get("state"))+"&code="+p.subject, start.Result().Cookies())
		if cb.Code != 303 {
			t.Fatal("first sign-in", p.name, cb.Code, cb.Body.String())
		}
		var session []*http.Cookie
		for _, c := range cb.Result().Cookies() {
			if c.Value != "" {
				session = append(session, c)
			}
		}
		reply := map[string]string{"site": send("/api/v1/onboarding/site", session).Body.String(), "repos": send("/api/v1/onboarding/github/repos", session).Body.String()}
		// Wait until the daemon has started the person's shared default.
		for deadline := time.Now().Add(20 * time.Second); ; time.Sleep(100 * time.Millisecond) {
			body := send("/api/v1/onboarding/github/clones", session).Body.String()
			reply["clones"] = body
			var list struct {
				Jobs []struct {
					FullName string `json:"full_name"`
					State    string `json:"state"`
				} `json:"jobs"`
			}
			done := false
			if json.Unmarshal([]byte(body), &list) == nil {
				for _, j := range list.Jobs {
					done = done || j.FullName == defaultsShared && j.State == "confirmed"
				}
			}
			if done {
				break
			}
			if time.Now().After(deadline) {
				t.Fatal("shared default never fetched for", p.name, body)
			}
		}
		out[p.name] = reply
	}
	b, _ := json.Marshal(out)
	_, _ = io.WriteString(os.Stdout, "\nDEFAULTS_REPORT="+string(b)+"\n")
}
