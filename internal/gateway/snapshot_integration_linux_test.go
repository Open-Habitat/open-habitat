//go:build linux

package gateway_test

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/daemon"
	"github.com/open-habitat/open-habitat/internal/gateway"

	"github.com/open-habitat/open-habitat/internal/transport"
)

type routeProvider struct{}

func (routeProvider) AuthorizationURL(state, _ string, _ []string) string {
	return "https://provider.invalid/?state=" + url.QueryEscape(state)
}
func (routeProvider) Exchange(_ context.Context, code, _ string) (string, string, string, error) {
	login := "alice"
	if code == "43" {
		login = "bob"
	}
	return "fixture-token", code, login, nil
}

type routeSink struct{}

func (routeSink) Deliver(context.Context, gateway.Identity, string, string) (gateway.Handoff, error) {
	return gateway.HandoffInUse, nil
}

func TestAuthenticatedGatewayToTwoDaemonSnapshotHandlers(t *testing.T) {
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	uid, e := strconv.Atoi(u.Uid)
	if e != nil {
		t.Fatal(e)
	}
	identities := []gateway.Identity{{Provider: "github", Subject: "42", UID: 1001, Username: "alice", Socket: "/run/open-habitat/users/alice/daemon.sock"}, {Provider: "github", Subject: "43", UID: 1002, Username: "bob", Socket: "/run/open-habitat/users/bob/daemon.sock"}}
	bare := filepath.Join(t.TempDir(), "bare.git")
	if out, e := exec.Command("/usr/bin/git", "init", "--bare", bare).CombinedOutput(); e != nil {
		t.Fatalf("bare: %s %v", out, e)
	}
	work := t.TempDir()
	for _, args := range [][]string{{"init", "-q", work}, {"-C", work, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-m", "fixture"}, {"-C", work, "push", bare, "HEAD:refs/heads/main"}, {"--git-dir", bare, "symbolic-ref", "HEAD", "refs/heads/main"}} {
		if out, err := exec.Command("/usr/bin/git", args...).CombinedOutput(); err != nil {
			t.Fatalf("seed bare: %v %s", err, out)
		}
	}
	paths := map[string]string{}
	peers := map[string]int{}
	for i, m := range identities {
		dir, e := os.MkdirTemp("/var/tmp", "nr-")
		if e != nil {
			t.Fatal(e)
		}
		t.Cleanup(func() { _ = os.RemoveAll(dir) })
		path := filepath.Join(dir, "daemon.sock")
		ln, e := net.Listen("unix", path)
		if e != nil {
			t.Fatal(e)
		}
		paths[m.Socket] = path
		peers[path] = m.UID
		cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: m.Subject}
		label := strconv.Itoa(i)
		snapshot := daemon.SnapshotHandlerWithNativeRoot(cfg, func(r *http.Request) bool {
			// Synthetic listener still checks the real connecting process's kernel UID.
			return r.Context().Value("peer") == uid
		}, func(transport.Config) daemon.Discovery {
			return daemon.Discovery{State: "present", Entries: []daemon.Workspace{{Name: "isolation-" + label, Kind: "directory", Metadata: "absent"}}}
		}, dir)
		fixtureHome := t.TempDir()
		if err := os.WriteFile(filepath.Join(fixtureHome, "fixture-id"), []byte(m.Subject), 0600); err != nil {
			t.Fatal(err)
		}
		gh := filepath.Join(fixtureHome, "gh")
		script := `#!/bin/sh
[ "$GH_PROMPT_DISABLED" = 1 ] && [ -z "$GH_TOKEN" ] || exit 9
id=$(cat "$HOME/fixture-id") || exit 9
case "$4" in
/user) printf '{"id":%s}\n' "$id" ;;
/repos/fixture/repo*) printf '{"name":"repo%s","full_name":"fixture/repo%s","owner":{"login":"fixture"},"clone_url":"https://github.com/fixture/repo%s.git"}\n' "$id" "$id" "$id" ;;
/user/repos?*) printf '[{"name":"repo%s","full_name":"fixture/repo%s","html_url":"https://github.com/fixture/repo%s","private":true,"pushed_at":null,"description":null,"size":12,"default_branch":"main","owner":{"login":"fixture","type":"Organization"}}]\n' "$id" "$id" "$id" ;;
*) exit 9 ;;
esac
`
		if err := os.WriteFile(gh, []byte(script), 0700); err != nil {
			t.Fatal(err)
		}
		gitFixture := filepath.Join(fixtureHome, "git")
		scriptGit := "#!/bin/sh\nif [ \"$1\" = clone ]; then\n /usr/bin/git clone -- '" + bare + "' . || exit 1\n exec /usr/bin/git remote set-url origin https://github.com/fixture/repo" + m.Subject + ".git\nfi\nexec /usr/bin/git \"$@\"\n"
		if err := os.WriteFile(gitFixture, []byte(scriptGit), 0700); err != nil {
			t.Fatal(err)
		}
		cloneHome := t.TempDir()
		if err := os.WriteFile(filepath.Join(cloneHome, "fixture-id"), []byte(m.Subject), 0600); err != nil {
			t.Fatal(err)
		}
		jobsCtx, stopJobs := context.WithCancel(context.Background())
		t.Cleanup(stopJobs)
		jobs := daemon.NewCloneJobsWithFixturePrograms(jobsCtx, cfg, func(r *http.Request) bool { return r.Context().Value("peer") == uid }, cloneHome, gh, gitFixture)
		mux := http.NewServeMux()
		mux.Handle(daemon.SnapshotPath, snapshot)
		mux.Handle(daemon.RepoCatalogPath, daemon.RepoCatalogHandlerWithFixtureGH(cfg, func(r *http.Request) bool { return r.Context().Value("peer") == uid }, gh, fixtureHome))
		mux.Handle(daemon.RepoClonesPath, jobs.Handler())
		srv := &http.Server{Handler: mux, ConnContext: func(ctx context.Context, c net.Conn) context.Context {
			unixConn, ok := c.(*net.UnixConn)
			if !ok {
				return ctx
			}
			got, err := daemon.PeerUID(unixConn)
			if err != nil {
				return ctx
			}
			return context.WithValue(ctx, "peer", int(got))
		}}
		go srv.Serve(ln)
		t.Cleanup(func() { _ = srv.Close(); _ = ln.Close() })
	}
	a, e := gateway.NewAuth(gateway.OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, gateway.AuthOptions{Provider: routeProvider{}, Sink: routeSink{}, Broker: routeBroker{identities}, SnapshotDial: func(ctx context.Context, p string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", paths[p])
	}, SnapshotPeerUID: func(c *net.UnixConn) int { return peers[c.RemoteAddr().String()] }})
	if e != nil {
		t.Fatal(e)
	}
	h := gateway.NewWithAuth("", a)
	send := func(path string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "https://host.test"+path, nil)
		r.RequestURI = r.URL.RequestURI()
		if cookie != nil {
			r.AddCookie(cookie)
		}
		r.Header.Set("X-Agent-Host-Identity", "wid_attacker0000")
		r.Header.Set("X-Agent-Host-Display-Name", "attacker")
		r.Header.Set("X-Agent-Host-Socket", "/tmp/attacker")
		r.Header.Set("X-Forwarded-For", "sentinel-token")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	for i, m := range identities {
		started := send("/auth/github/start", nil)
		if started.Code != 302 {
			t.Fatal(started.Code, started.Body.String())
		}
		loc, e := url.Parse(started.Header().Get("Location"))
		if e != nil {
			t.Fatal(e)
		}
		flow := started.Result().Cookies()[0]
		cb := send("/auth/github/callback?state="+loc.Query().Get("state")+"&code="+m.Subject, flow)
		if cb.Code != 303 {
			t.Fatal(cb.Code, cb.Body.String())
		}
		cookie := cb.Result().Cookies()[1]
		got := send("/api/v1/snapshot", cookie)
		if got.Code != 200 || !strings.Contains(got.Body.String(), "isolation-"+strconv.Itoa(i)) || strings.Contains(got.Body.String(), "isolation-"+strconv.Itoa(1-i)) || strings.Contains(got.Body.String(), "sentinel-token") || strings.Contains(got.Body.String(), paths[m.Socket]) || strings.Contains(got.Body.String(), u.HomeDir) {
			t.Fatalf("snapshot %d: %d %s", i, got.Code, got.Body.String())
		}
		catalog := send("/api/v1/onboarding/github/repos", cookie)
		if catalog.Code != 200 || !strings.Contains(catalog.Body.String(), "fixture/repo"+m.Subject) || strings.Contains(catalog.Body.String(), "fixture/repo"+identities[1-i].Subject) || catalog.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("catalog %d: %d %s", i, catalog.Code, catalog.Body.String())
		}
		session := send("/auth/session", cookie)
		var auth struct {
			CSRF string `json:"csrf"`
		}
		if session.Code != 200 || json.Unmarshal(session.Body.Bytes(), &auth) != nil || auth.CSRF == "" {
			t.Fatalf("session: %d %s", session.Code, session.Body.String())
		}
		post := func(csrf string) *httptest.ResponseRecorder {
			r := httptest.NewRequest("POST", "https://host.test/api/v1/onboarding/github/clones", strings.NewReader(`{"action":"start","full_name":"fixture/repo`+m.Subject+`","mode":"full"}`))
			r.RequestURI = r.URL.RequestURI()
			r.AddCookie(cookie)
			r.Header.Set("Origin", "https://host.test")
			r.Header.Set("X-Agent-Host-CSRF", csrf)
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("Authorization", "Bearer forged")
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			return w
		}
		if w := post("invalid"); w.Code != 403 {
			t.Fatalf("csrf: %d", w.Code)
		}
		if w := post(auth.CSRF); w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"running"`) {
			t.Fatalf("import %d: %d %s", i, w.Code, w.Body.String())
		}
		// The job outlives its request; its own user's list reports it.
		for deadline := time.Now().Add(20 * time.Second); ; {
			list := send("/api/v1/onboarding/github/clones", cookie)
			if list.Code == 200 && strings.Contains(list.Body.String(), `"state":"confirmed"`) {
				if strings.Contains(list.Body.String(), "fixture/repo"+identities[1-i].Subject) {
					t.Fatalf("another user's job listed: %s", list.Body.String())
				}
				break
			}
			if time.Now().After(deadline) {
				t.Fatalf("job %d did not confirm: %d %s", i, list.Code, list.Body.String())
			}
			time.Sleep(50 * time.Millisecond)
		}
		if w := post(auth.CSRF); w.Code != 409 || !strings.Contains(w.Body.String(), "checkout_exists") {
			t.Fatalf("repeat %d: %d %s", i, w.Code, w.Body.String())
		}
		// The daemon, not the gateway, constructs the v1 observation.
		if !strings.Contains(got.Body.String(), `"write_state":"read_only"`) {
			t.Fatal(got.Body.String())
		}
	}
	if w := send("/api/v1/snapshot", nil); w.Code != 401 {
		t.Fatal(w.Code)
	}
}

type routeBroker struct{ identities []gateway.Identity }

func (b routeBroker) Exchange(_ context.Context, r gateway.BrokerRequest) (gateway.BrokerReply, error) {
	for _, m := range b.identities {
		if m.Subject == r.ID {
			return gateway.BrokerReply{Route: &gateway.BrokerRoute{UID: uint32(m.UID), Username: m.Username, Socket: m.Socket}, Epoch: 1, Generation: 1}, nil
		}
	}
	return gateway.BrokerReply{}, nil
}
