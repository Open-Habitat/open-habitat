//go:build linux

package gateway

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

// A Gitea write reaches only the session's own daemon, with the token in
// the body unread: the gateway checks the session, CSRF and framing, caps
// request and reply, never logs the body, and never contacts Gitea itself.
func TestGatewayGiteaRoutesBoundAndRouteToTheSessionsDaemon(t *testing.T) {
	uid := os.Getuid()
	now := time.Now()
	alice := Identity{"github", "42", uid, "alice", "/run/open-habitat/users/alice/daemon.sock"}
	bob := Identity{"github", "43", uid, "bob", "/run/open-habitat/users/bob/daemon.sock"}
	var mu sync.Mutex
	var seen []string
	reply := map[string]string{}
	sockets := map[string]string{}
	for _, id := range []Identity{alice, bob} {
		socket := filepath.Join(t.TempDir(), "daemon.sock")
		sockets[id.Socket] = socket
		ln, err := net.Listen("unix", socket)
		if err != nil {
			t.Fatal(err)
		}
		name := id.Username
		srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, _ := io.ReadAll(r.Body)
			mu.Lock()
			seen = append(seen, name+" "+r.Method+" "+r.RequestURI+" "+string(body))
			b := reply[r.URL.Path]
			mu.Unlock()
			for _, h := range []string{"Cookie", "X-Agent-Host-CSRF", "Authorization", "X-Agent-Host-Identity", "Origin"} {
				if r.Header.Get(h) != "" {
					t.Errorf("%s forwarded to the daemon", h)
				}
			}
			if b == "drop" {
				panic(http.ErrAbortHandler)
			}
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Content-Length", strconv.Itoa(len(b)))
			fmt.Fprint(w, b)
		})}
		go srv.Serve(ln)
		t.Cleanup(func() { srv.Close() })
	}
	var logs bytes.Buffer
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: newFakeBroker(), now: func() time.Time { return now }, log: slog.New(slog.NewJSONHandler(&logs, nil)), sessions: map[string]session{
		"one": {identity: alice, csrf: "secret-one", idle: now.Add(time.Hour), absolute: now.Add(time.Hour)},
		"two": {identity: bob, csrf: "secret-two", idle: now.Add(time.Hour), absolute: now.Add(time.Hour)},
	}}
	a.broker.(*fakeBroker).routes["42"] = BrokerRoute{UID: uint32(uid), Username: "alice", Socket: alice.Socket}
	a.broker.(*fakeBroker).routes["43"] = BrokerRoute{UID: uint32(uid), Username: "bob", Socket: bob.Socket}
	a.snapshotDial = func(ctx context.Context, path string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", sockets[path])
	}
	h := NewWithAuth("", a)
	send := func(method, path, body, cookie, csrf, typ string) *httptest.ResponseRecorder {
		var reader io.Reader
		if body != "" {
			reader = strings.NewReader(body)
		}
		r := httptest.NewRequest(method, "https://host.test"+path, reader)
		r.RequestURI = r.URL.RequestURI()
		if typ != "" {
			r.Header.Set("Content-Type", typ)
		}
		r.Header.Set("Origin", "https://host.test")
		if csrf != "" {
			r.Header.Set("X-Agent-Host-CSRF", csrf)
		}
		if cookie != "" {
			r.AddCookie(&http.Cookie{Name: cookieName, Value: cookie})
		}
		r.Header.Set("Authorization", "Bearer foreign")
		r.Header.Set("X-Agent-Host-Identity", "wid_forged")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	const token = "gitea-pat-must-not-leak"
	connect := `{"action":"connect","base_url":"https://git.example.test","token":"` + token + `"}`
	json := "application/json"
	for _, c := range []struct {
		method, path, body, cookie, csrf, typ string
		code                                  int
	}{
		{"POST", integrationGiteaPath, connect, "", "secret-one", json, 401},
		{"POST", integrationGiteaPath, connect, "one", "", json, 403},
		// A previous person's CSRF never authorizes the next session.
		{"POST", integrationGiteaPath, connect, "two", "secret-one", json, 403},
		{"POST", integrationGiteaPath, connect, "one", "secret-one", "text/plain", 400},
		{"POST", integrationGiteaPath + "?x=1", connect, "one", "secret-one", json, 400},
		{"POST", integrationGiteaPath, `{"action":"connect","token":"` + strings.Repeat("x", giteaRequestLimit) + `"}`, "one", "secret-one", json, 400},
		{"PUT", integrationGiteaPath, connect, "one", "secret-one", json, 400},
		{"GET", integrationGiteaPath, "", "one", "", "", 400},
		{"POST", integrationGiteaRepos, connect, "one", "secret-one", json, 400},
		{"GET", integrationGiteaRepos, "", "", "", "", 401},
		{"GET", integrationGiteaRepos + "?connection=x", "", "one", "", "", 400},
	} {
		if w := send(c.method, c.path, c.body, c.cookie, c.csrf, c.typ); w.Code != c.code {
			t.Fatalf("%s %s (%s): %d want %d", c.method, c.path, c.cookie, w.Code, c.code)
		}
	}
	if len(seen) != 0 {
		t.Fatalf("refused requests reached a daemon: %q", seen)
	}

	change := `{"schema_version":1,"outcome":"written","api":"ok","connection":{"id":"gitea_0123456789abcdef01234567","kind":"pat","owned":true,"ambiguous":false,"git":"registered"}}`
	reply[integrationGiteaPath] = change
	reply[integrationGiteaRepos] = `{"schema_version":1,"sources":[]}`
	if w := send("POST", integrationGiteaPath, connect, "one", "secret-one", json); w.Code != 200 || w.Body.String() != change {
		t.Fatalf("connect: %d %s", w.Code, w.Body.String())
	}
	disconnect := `{"action":"disconnect","connection_id":"gitea_0123456789abcdef01234567"}`
	if w := send("DELETE", integrationGiteaPath, disconnect, "two", "secret-two", json); w.Code != 200 {
		t.Fatalf("disconnect: %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", integrationGiteaRepos, "", "two", "", ""); w.Code != 200 {
		t.Fatalf("repos: %d", w.Code)
	}
	want := []string{"alice POST " + integrationGiteaPath + " " + connect, "bob DELETE " + integrationGiteaPath + " " + disconnect, "bob GET " + integrationGiteaRepos + " "}
	if strings.Join(seen, "\n") != strings.Join(want, "\n") {
		t.Fatalf("forwarded:\n%s", strings.Join(seen, "\n"))
	}

	// Replies beyond their caps never reach the browser as a truncated
	// success, and a lost exchange is logged without the body.
	reply[integrationGiteaPath] = `{"schema_version":1,"outcome":"written","pad":"` + strings.Repeat("x", giteaChangeLimit) + `"}`
	if w := send("POST", integrationGiteaPath, connect, "one", "secret-one", json); w.Code != 503 {
		t.Fatalf("oversized change: %d", w.Code)
	}
	reply[integrationGiteaRepos] = `{"schema_version":1,"sources":[],"pad":"` + strings.Repeat("x", giteaReposLimit) + `"}`
	if w := send("GET", integrationGiteaRepos, "", "one", "", ""); w.Code != 503 {
		t.Fatalf("oversized repos: %d", w.Code)
	}
	reply[integrationGiteaPath] = "drop"
	if w := send("POST", integrationGiteaPath, connect, "one", "secret-one", json); w.Code != 503 {
		t.Fatalf("lost exchange: %d", w.Code)
	}
	if strings.Contains(logs.String(), token) || !strings.Contains(logs.String(), "integrations_gitea") {
		t.Fatalf("gateway log: %s", logs.String())
	}
}
