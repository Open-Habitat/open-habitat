//go:build linux

package gateway_test

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/maintainer/native-agent-host/internal/daemon"
	"github.com/maintainer/native-agent-host/internal/gateway"
	"github.com/maintainer/native-agent-host/internal/transport"
)

type routeProvider struct{}

func (routeProvider) AuthorizationURL(state, _ string) string {
	return "https://provider.invalid/?state=" + url.QueryEscape(state)
}
func (routeProvider) Exchange(_ context.Context, code, _ string) (string, string, error) {
	return "fixture-token", code, nil
}

type routeSink struct{}

func (routeSink) Deliver(context.Context, gateway.Identity, string, string) error { return nil }

func TestAuthenticatedGatewayToTwoDaemonSnapshotHandlers(t *testing.T) {
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	uid, e := strconv.Atoi(u.Uid)
	if e != nil {
		t.Fatal(e)
	}
	identities := []gateway.Identity{{Provider: "github", Subject: "42", UID: 1001, Username: "alice", Socket: "/run/native-agent-host/users/alice/daemon.sock"}, {Provider: "github", Subject: "43", UID: 1002, Username: "bob", Socket: "/run/native-agent-host/users/bob/daemon.sock"}}
	paths := map[string]string{}
	peers := map[string]int{}
	for i, m := range identities {
		dir, e := os.MkdirTemp("/tmp", "nah-route-")
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
		cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: m.Subject}
		label := strconv.Itoa(i)
		snapshot := daemon.SnapshotHandler(cfg, func(r *http.Request) bool {
			// Synthetic listener still checks the real connecting process's kernel UID.
			return r.Context().Value("peer") == uid
		}, func(transport.Config) daemon.Discovery {
			return daemon.Discovery{State: "present", Entries: []daemon.Workspace{{Name: "isolation-" + label, Kind: "directory", Metadata: "absent"}}}
		})
		mux := http.NewServeMux()
		mux.Handle(daemon.SnapshotPath, snapshot)
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
	a, e := gateway.NewAuth(gateway.OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback", Identities: identities}, gateway.AuthOptions{Provider: routeProvider{}, Sink: routeSink{}, SnapshotDial: func(ctx context.Context, p string) (net.Conn, error) {
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
		// The daemon, not the gateway, constructs the v1 observation.
		if !strings.Contains(got.Body.String(), `"write_state":"read_only"`) {
			t.Fatal(got.Body.String())
		}
	}
	if w := send("/api/v1/snapshot", nil); w.Code != 401 {
		t.Fatal(w.Code)
	}
}
