//go:build linux

package gateway

import (
	"context"

	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestSnapshotTwoMappedUnixListeners(t *testing.T) {
	uid := os.Getuid()
	now := time.Now()
	mappings := []Identity{{"github", "42", uid, "alice", "/run/native-agent-host/users/alice/daemon.sock"}, {"github", "43", uid, "bob", "/run/native-agent-host/users/bob/daemon.sock"}}
	// Same real UID is an intentional test seam: production NewAuth rejects UID
	// reuse; the separate two-UID systemd proof belongs to phase 2C.
	listeners := map[string]string{}
	servers := []*http.Server{}
	var foreign atomic.Bool
	for i, m := range mappings {
		dir, e := os.MkdirTemp("/tmp", "nah-snap-")
		if e != nil {
			t.Fatal(e)
		}
		t.Cleanup(func() { _ = os.RemoveAll(dir) })
		p := filepath.Join(dir, "daemon.sock")
		ln, e := net.Listen("unix", p)
		if e != nil {
			t.Fatal(e)
		}
		listeners[m.Socket] = p
		want := m
		label := strconv.Itoa(i)
		srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != "GET" || r.URL.RequestURI() != "/api/v1/snapshot" || r.Host != "unix" || r.Header.Get("X-Agent-Host-Identity") != identityID(want) || r.Header.Get("X-Agent-Host-Display-Name") != "GitHub user "+want.Subject || r.Header.Get("X-Agent-Host-Socket") != "" || r.Header.Get("X-Agent-Host-CSRF") != "" || r.Header.Get("Cookie") != "" || r.Header.Get("X-Forwarded-For") != "" {
				w.WriteHeader(403)
				return
			}
			account := want.Subject
			if foreign.Load() {
				account = "99"
			}
			b := `{"identity":{"web_identity_id":"` + identityID(want) + `"},"auth":{"provider":"github","provider_account_id":"` + account + `"},"workspace":"` + label + `"}`
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Content-Length", strconv.Itoa(len(b)))
			_, _ = io.WriteString(w, b)
		})}
		servers = append(servers, srv)
		go srv.Serve(ln)
		t.Cleanup(func() { srv.Close(); ln.Close() })
	}
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: newFakeBroker(), now: func() time.Time { return now }, sessions: map[string]session{}}
	b := a.broker.(*fakeBroker)
	b.routes["42"] = BrokerRoute{UID: uint32(uid), Username: "alice", Socket: mappings[0].Socket}
	b.routes["43"] = BrokerRoute{UID: uint32(uid), Username: "bob", Socket: mappings[1].Socket}
	a.snapshotDial = func(ctx context.Context, path string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", listeners[path])
	}
	for i, m := range mappings {
		a.sessions[strconv.Itoa(i)] = session{identity: m, epoch: 1, generation: 1, idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}
	}
	h := NewWithAuth("", a)
	send := func(id, path string, headers map[string]string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "https://host.test"+path, nil)
		r.AddCookie(&http.Cookie{Name: cookieName, Value: id})
		for k, v := range headers {
			r.Header.Set(k, v)
		}
		r.RequestURI = r.URL.RequestURI()
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	for i := range mappings {
		id := strconv.Itoa(i)
		w := send(id, "/api/v1/snapshot", map[string]string{"X-Agent-Host-Identity": identityID(mappings[1-i]), "X-Agent-Host-Socket": "/tmp/attacker", "X-Agent-Host-CSRF": "sentinel-token", "X-Forwarded-For": "attacker"})
		if w.Code != 200 || !strings.Contains(w.Body.String(), `"workspace":"`+id+`"`) || !strings.Contains(w.Body.String(), `"provider_account_id":"`+mappings[i].Subject+`"`) {
			t.Fatalf("route %s: %d %s", id, w.Code, w.Body.String())
		}
	}
	foreign.Store(true)
	if w := send("1", "/api/v1/snapshot", nil); w.Code != 503 || strings.Contains(w.Body.String(), "99") {
		t.Fatalf("foreign identity: %d %s", w.Code, w.Body.String())
	}
	foreign.Store(false)
	if w := send("unknown", "/api/v1/snapshot", nil); w.Code != 401 {
		t.Fatal(w.Code)
	}
	a.mu.Lock()
	s := a.sessions["0"]
	s.absolute = now.Add(-time.Second)
	a.sessions["0"] = s
	a.mu.Unlock()
	if w := send("0", "/api/v1/snapshot", nil); w.Code != 401 {
		t.Fatal(w.Code)
	}
	for _, path := range []string{"/api/v1/snapshot?uid=1", "/api/v1/snapshot/"} {
		if w := send("1", path, nil); w.Code == 200 {
			t.Fatal(path)
		}
	}
	// Socket B is reachable but its kernel UID does not match this synthetic mapping.
	a.mu.Lock()
	s = a.sessions["1"]
	s.identity.UID = uid + 1
	a.sessions["1"] = s

	a.mu.Unlock()
	if w := send("1", "/api/v1/snapshot", nil); w.Code == 200 || strings.Contains(w.Body.String(), listeners[mappings[1].Socket]) {
		t.Fatal(w.Code, w.Body.String())
	}

}
