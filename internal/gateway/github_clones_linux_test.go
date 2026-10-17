//go:build linux

package gateway

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

// Clone-job writes need a session, origin and CSRF; reads and subscriptions
// need a session. Only the mapped daemon is reached, and no browser identity,
// cookie or credential crosses to it.
func TestGatewayCloneJobsAdmissionAndMappedDaemon(t *testing.T) {
	uid := os.Getuid()
	now := time.Now()
	id := Identity{"github", "42", uid, "alice", "/run/open-habitat/users/alice/daemon.sock"}
	socket := filepath.Join(t.TempDir(), "daemon.sock")
	ln, e := net.Listen("unix", socket)
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	var seen []string
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		seen = append(seen, r.Method+" "+r.RequestURI+" "+string(body))
		if r.Header.Get("X-Agent-Host-Identity") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("Cookie") != "" || r.Header.Get("X-Agent-Host-CSRF") != "" {
			t.Error("browser identity forwarded")
		}
		if r.URL.Path == githubCloneEventsPath {
			w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
			fmt.Fprint(w, "event: terminal\ndata: {\"schema_version\":1,\"sequence\":1,\"job_id\":\"0123456789abcdef0123456789abcdef\",\"kind\":\"terminal\",\"outcome\":\"confirmed\"}\n\n")
			return
		}
		b := `{"schema_version":1,"jobs":[],"interrupted":[],"interrupted_complete":true}`
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(b)))
		fmt.Fprint(w, b)
	})}
	go srv.Serve(ln)
	defer srv.Close()
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: newFakeBroker(), now: func() time.Time { return now }, sessions: map[string]session{"one": {identity: id, csrf: "secret", idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}}}
	a.broker.(*fakeBroker).routes["42"] = BrokerRoute{UID: uint32(uid), Username: "alice", Socket: id.Socket}
	a.snapshotDial = func(ctx context.Context, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", socket)
	}
	h := NewWithAuth("", a)
	send := func(method, path, body, csrf, typ string, auth bool) *httptest.ResponseRecorder {
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
		if auth {
			r.AddCookie(&http.Cookie{Name: cookieName, Value: "one"})
		}
		r.Header.Set("Authorization", "Bearer foreign")
		r.Header.Set("X-Agent-Host-Identity", "wid_forged")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	start := `{"action":"start","full_name":"org/repo","mode":"blobless"}`
	events := githubCloneEventsPath + "?job_id=0123456789abcdef0123456789abcdef"
	for _, c := range []struct {
		method, path, body, csrf, typ string
		auth                          bool
		code                          int
	}{
		{"POST", githubClonesPath, start, "secret", "application/json", false, 401},
		{"POST", githubClonesPath, start, "bad", "application/json", true, 403},
		{"POST", githubClonesPath, start, "secret", "text/plain", true, 400},
		{"POST", githubClonesPath + "?x=1", start, "secret", "application/json", true, 400},
		{"GET", githubClonesPath, "", "", "", false, 401},
		{"GET", events, "", "", "", false, 401},
		{"GET", githubCloneEventsPath + "?job_id=../x", "", "", "", true, 400},
		{"GET", events + "&x=1", "", "", "", true, 400},
		{"GET", githubLookupPath + "?full_name=org%2F..", "", "", "", true, 400},
		{"GET", githubLookupPath + "?full_name=org%2Frepo", "", "", "", false, 401},
	} {
		if w := send(c.method, c.path, c.body, c.csrf, c.typ, c.auth); w.Code != c.code {
			t.Fatalf("%s %s: %d want %d", c.method, c.path, w.Code, c.code)
		}
	}
	if len(seen) != 0 {
		t.Fatalf("refused requests reached the daemon: %q", seen)
	}
	if w := send("POST", githubClonesPath, start, "secret", "application/json", true); w.Code != 200 {
		t.Fatalf("start: %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", githubClonesPath, "", "", "", true); w.Code != 200 || !strings.Contains(w.Body.String(), `"interrupted_complete":true`) {
		t.Fatalf("list: %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", events, "", "", "", true); w.Code != 200 || !strings.Contains(w.Body.String(), `"outcome":"confirmed"`) {
		t.Fatalf("events: %d %s", w.Code, w.Body.String())
	}
	want := []string{"POST " + githubClonesPath + " " + start, "GET " + githubClonesPath + " ", "GET " + events + " "}
	if strings.Join(seen, "\n") != strings.Join(want, "\n") {
		t.Fatalf("forwarded %q", seen)
	}
}
