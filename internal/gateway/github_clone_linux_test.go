//go:build linux

package gateway

import (
	"context"
	"fmt"
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

func TestGatewayCloneCSRFAndMappedDaemon(t *testing.T) {
	uid := os.Getuid()
	now := time.Now()
	id := Identity{"github", "42", uid, "alice", "/run/native-agent-host/users/alice/daemon.sock"}
	socket := filepath.Join(t.TempDir(), "daemon.sock")
	ln, e := net.Listen("unix", socket)
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	calls := 0
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method != "POST" || r.Header.Get("X-Agent-Host-Identity") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("Cookie") != "" || r.ContentLength != int64(len(`{"full_name":"org/repo"}`)) {
			w.WriteHeader(403)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		b := `{"schema_version":1,"full_name":"org/repo","state":"cloned"}`
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
	send := func(body, csrf string, auth bool) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "https://host.test"+githubClonePath, strings.NewReader(body))
		r.RequestURI = r.URL.RequestURI()
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", "https://host.test")
		if csrf != "" {
			r.Header.Set("X-Agent-Host-CSRF", csrf)
		}
		if auth {
			r.AddCookie(&http.Cookie{Name: cookieName, Value: "one"})
		}
		r.Header.Set("Authorization", "Bearer foreign")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := send(`{"full_name":"org/repo"}`, "secret", false); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if w := send(`{"full_name":"org/repo"}`, "bad", true); w.Code != 403 {
		t.Fatal(w.Code)
	}
	if w := send(`{"full_name":"org/repo","url":"https://evil"}`, "secret", true); w.Code != 400 {
		t.Fatal(w.Code)
	}
	if calls != 0 {
		t.Fatal(calls)
	}
	w := send(`{"full_name":"org/repo"}`, "secret", true)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"cloned"`) || calls != 1 {
		t.Fatalf("%d %s calls=%d", w.Code, w.Body.String(), calls)
	}
}

func TestGatewayCloneStreamAdmissionAndNoIdentityForwarding(t *testing.T) {
	now := time.Now()
	uid := os.Getuid()
	id := Identity{"github", "42", uid, "alice", "/run/native-agent-host/users/alice/daemon.sock"}
	socket := filepath.Join(t.TempDir(), "daemon.sock")
	ln, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	var calls int
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("X-Agent-Host-Identity") != "" {
			t.Error("browser identity forwarded")
		}
		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		fmt.Fprint(w, "event: terminal\ndata: {\"schema_version\":1,\"sequence\":1,\"kind\":\"terminal\",\"outcome\":\"confirmed\"}\n\n")
	})}
	go srv.Serve(ln)
	defer srv.Close()
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: newFakeBroker(), now: func() time.Time { return now }, sessions: map[string]session{"one": {identity: id, csrf: "secret", idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}}}
	a.snapshotDial = func(ctx context.Context, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", socket)
	}
	h := NewWithAuth("", a)
	send := func(csrf string, login bool) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "https://host.test"+githubCloneStreamPath, strings.NewReader(`{"full_name":"org/repo"}`))
		r.RequestURI = r.URL.RequestURI()
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("X-Agent-Host-CSRF", csrf)
		if login {
			r.AddCookie(&http.Cookie{Name: cookieName, Value: "one"})
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := send("secret", false); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if w := send("wrong", true); w.Code != 403 {
		t.Fatal(w.Code)
	}
	if calls != 0 {
		t.Fatal("unauthorized upstream request")
	}
	if w := send("secret", true); w.Code != 200 || !strings.Contains(w.Body.String(), `"outcome":"confirmed"`) || calls != 1 {
		t.Fatalf("stream: %d %s %d", w.Code, w.Body.String(), calls)
	}
}
