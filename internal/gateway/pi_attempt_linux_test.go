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
	"testing"
	"time"
)

func TestPiAttemptAuthenticatedMappedSocket(t *testing.T) {
	now := time.Now()
	uid := os.Getuid()
	m := Identity{"github", "42", uid, "alice", "/run/native-agent-host/users/alice/daemon.sock"}
	dir := t.TempDir()
	socket := filepath.Join(dir, "daemon.sock")
	ln, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	seen := make(chan string, 10)
	reply := `{"schema_version":1,"attempt":{"state":"device_code","pi_state":"missing","verification_uri":"https://auth.openai.com/codex/device","user_code":"ABCD-1234"}}`
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen <- r.Header.Get("X-Agent-Host-Session")
		if r.ContentLength != 0 || len(r.TransferEncoding) != 0 {
			t.Errorf("body-less attempt was forwarded with framing: CL=%d TE=%v", r.ContentLength, r.TransferEncoding)
			w.WriteHeader(403)
			return
		}
		if r.Host != "unix" || r.URL.Path != piAttemptPath || r.Header.Get("X-Agent-Host-Identity") != "" || r.Header.Get("X-Agent-Host-Socket") != "" || r.Header.Get("Cookie") != "" || r.Header.Get("Origin") != "" || r.Header.Get("X-Agent-Host-CSRF") != "" {
			w.WriteHeader(403)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(reply)))
		_, _ = io.WriteString(w, reply)
	})}
	go srv.Serve(ln)
	defer srv.Close()
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: newFakeBroker(), now: func() time.Time { return now }, sessions: map[string]session{}}
	a.broker.(*fakeBroker).routes["42"] = BrokerRoute{UID: uint32(uid), Username: "alice", Socket: m.Socket}
	token := strings.Repeat("A", 43)
	a.sessions[token] = session{identity: m, csrf: "csrf-secret", idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}
	a.snapshotDial = func(ctx context.Context, p string) (net.Conn, error) {
		if p != m.Socket {
			t.Errorf("wrong socket %q", p)
		}
		return (&net.Dialer{}).DialContext(ctx, "unix", socket)
	}
	h := NewWithAuth("", a)
	send := func(method, id string, headers map[string]string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "https://host.test"+piAttemptPath, nil)
		r.RequestURI = piAttemptPath
		if id != "" {
			r.AddCookie(&http.Cookie{Name: cookieName, Value: id})
		}
		for k, v := range headers {
			r.Header.Set(k, v)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := send("POST", token, nil); w.Code != 403 {
		t.Fatalf("missing origin: %d", w.Code)
	}
	if w := send("POST", token, map[string]string{"Origin": "https://host.test"}); w.Code != 403 {
		t.Fatalf("missing csrf: %d", w.Code)
	}
	if w := send("GET", "", nil); w.Code != 401 {
		t.Fatalf("anonymous: %d", w.Code)
	}
	if w := send("POST", token, map[string]string{"Origin": "https://host.test", "X-Agent-Host-CSRF": "csrf-secret", "X-Agent-Host-Socket": "/tmp/foreign", "X-Agent-Host-Session": strings.Repeat("B", 43)}); w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("start: %d %s", w.Code, w.Body.String())
	}
	select {
	case v := <-seen:
		if v == token || v == strings.Repeat("B", 43) || len(v) != 43 {
			t.Fatalf("unsafe session correlation: %q", v)
		}
	default:
		t.Fatal("daemon not called")
	}
	a.mu.Lock()
	delete(a.sessions, token)
	a.mu.Unlock()
	if w := send("GET", token, nil); w.Code != 401 {
		t.Fatalf("stale tab: %d", w.Code)
	}
}
