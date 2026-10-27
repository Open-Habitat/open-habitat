//go:build linux

package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func proxyFixture(t *testing.T, handler http.Handler) (http.Handler, *Auth) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "daemon.sock")
	ln, err := net.Listen("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	// The daemon reads a request's body before it answers. A fake that
	// answers first lets the server close the connection under the gateway's
	// body write, which the proxy reports as 503, so read it here for every
	// fake handler.
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("fake daemon read: %v", err)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		handler.ServeHTTP(w, r)
	})}
	go srv.Serve(ln)
	t.Cleanup(func() { srv.Close(); ln.Close() })
	m := Identity{"github", "42", os.Getuid(), "alice", path}
	now := time.Now()
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, now: func() time.Time { return now }, sessions: map[string]session{"browser": {identity: m, csrf: "token", idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}}}
	a.snapshotDial = func(ctx context.Context, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", path)
	}
	return NewWithAuth("", a), a
}
func proxyCall(h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "https://host.test"+path, strings.NewReader(body))
	r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
	if method == "POST" {
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("X-Agent-Host-CSRF", "token")
		r.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	if strings.HasPrefix(path, "/api/v1/events?") {
		h.ServeHTTP(streamRecorder{w}, r)
	} else {
		h.ServeHTTP(w, r)
	}
	return w
}

func TestProxyCancellationDoesNotBlameDaemon(t *testing.T) {
	for _, tc := range []struct {
		name, body string
	}{
		{"before_headers", ""},
		{"during_finite_body", "partial"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			started := make(chan struct{})
			h, a := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tc.body != "" {
					_, _ = io.WriteString(w, tc.body)
					w.(http.Flusher).Flush()
				}
				close(started)
				<-r.Context().Done()
			}))
			var log bytes.Buffer
			a.log = CallbackLogger(&log)
			ctx, cancel := context.WithCancel(context.Background())
			r := httptest.NewRequest("GET", "https://host.test/api/v1/snapshot", nil).WithContext(ctx)
			r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
			done := make(chan struct{})
			go func() { h.ServeHTTP(httptest.NewRecorder(), r); close(done) }()
			select {
			case <-started:
			case <-time.After(3 * time.Second):
				t.Fatal("upstream not reached")
			}
			cancel()
			select {
			case <-done:
			case <-time.After(3 * time.Second):
				t.Fatal("proxy did not release canceled request")
			}
			if log.Len() != 0 {
				t.Fatalf("client cancellation blamed on daemon: %s", log.String())
			}
		})
	}
}

func TestProxyFailureDiagnosticUsesVerifiedRoute(t *testing.T) {
	h, a := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "synthetic-secret-content"+strings.Repeat("x", int(proxyBodyLimit)))
	}))
	var log bytes.Buffer
	a.log = CallbackLogger(&log)
	w := proxyCall(h, "GET", "/api/v1/snapshot", "")
	if w.Code != 503 {
		t.Fatalf("response: %d", w.Code)
	}
	var event map[string]any
	if err := json.Unmarshal(log.Bytes(), &event); err != nil {
		t.Fatal(err)
	}
	if event["event"] != "daemon_route" || event["user"] != "alice" || event["operation"] != "snapshot" || event["reason"] != "daemon_response_unavailable" || strings.Contains(log.String(), "synthetic-secret-content") {
		t.Fatalf("unsafe or missing classification: %s", log.String())
	}
}

func TestProxyOperationClassifiesTitleWithoutSessionID(t *testing.T) {
	if got := proxyOperation("/api/v1/conversations/7e85a75e-e6d5-432c-bdf0-d7e4afa640b1/regenerate_title"); got != "conversation_title" {
		t.Fatalf("title route classification: %q", got)
	}
	if got := proxyOperation("/api/v1/conversations/not-an-id/regenerate_title"); got != "daemon_request" {
		t.Fatalf("unverified route classification: %q", got)
	}
}

func TestProxyForwardsUninterpretedRepliesAndBody(t *testing.T) {
	h, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/conversations" && r.Method == "POST" {
			data, _ := io.ReadAll(r.Body)
			if string(data) != `{"workspace_id":"ws_12345678","extension":true}` || r.Header.Get("Cookie") != "" || r.Header.Get("X-Agent-Host-CSRF") != "" {
				t.Errorf("request leaked/changed: %s %v", data, r.Header)
			}
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Write([]byte(`{"agent_id":"pi:12345678-1234-4123-8123-123456789abc","new_field":42}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(418)
		w.Write([]byte(`{"new_code":"future","new_field":42}`))
	}))
	create := proxyCall(h, "POST", conversationBase, `{"workspace_id":"ws_12345678","extension":true}`)
	if create.Code != 200 || create.Header().Get("Content-Type") != "application/json; charset=utf-8" || !strings.Contains(create.Body.String(), `"new_field":42`) {
		t.Fatalf("create: %d %s", create.Code, create.Body.String())
	}
	for _, path := range []string{"/api/v1/snapshot", "/api/v1/onboarding/pi/status", "/api/v1/onboarding/pi/attempt", "/api/v1/agents/pi:12345678-1234-4123-8123-123456789abc/history", conversationBase + "/12345678-1234-4123-8123-123456789abc/status"} {
		w := proxyCall(h, "GET", path, "")
		if w.Code != 418 || w.Body.String() != `{"new_code":"future","new_field":42}` {
			t.Fatalf("%s: %d %s", path, w.Code, w.Body.String())
		}
	}
}

func TestProxyFiniteLimitAndStreamBeyondIt(t *testing.T) {
	payload := strings.Repeat("x", int(proxyBodyLimit)+1)
	h, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/v1/events" {
			w.Header().Set("Content-Type", "text/event-stream")
			w.(http.Flusher).Flush()
			_, _ = io.WriteString(w, payload)
			return
		}
		_, _ = io.WriteString(w, payload)
	}))
	if w := proxyCall(h, "GET", "/api/v1/snapshot", ""); w.Code != 503 || strings.Contains(w.Body.String(), "xxx") {
		t.Fatalf("finite: %d", w.Code)
	}
	w := proxyCall(h, "GET", "/api/v1/events?after=ev1:12345678-1234-4123-8123-123456789abc:1", "")
	if w.Code != 200 || w.Body.Len() != len(payload) || !w.Flushed {
		t.Fatalf("stream: %d %d flushed=%v", w.Code, w.Body.Len(), w.Flushed)
	}
}

func TestProxyStreamCancellationClosesDaemonConnection(t *testing.T) {
	closed := make(chan struct{})
	started := make(chan struct{})
	h, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.(http.Flusher).Flush()
		_, _ = io.WriteString(w, ": heartbeat\n\n")
		w.(http.Flusher).Flush()
		close(started)
		<-r.Context().Done()
		close(closed)
	}))
	ctx, cancel := context.WithCancel(context.Background())
	r := httptest.NewRequest("GET", "https://host.test/api/v1/events?after=ev1:12345678-1234-4123-8123-123456789abc:1", nil).WithContext(ctx)
	r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
	done := make(chan struct{})
	go func() { h.ServeHTTP(streamRecorder{httptest.NewRecorder()}, r); close(done) }()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("not started")
	}
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("gateway retained stream")
	}
	select {
	case <-closed:
	case <-time.After(time.Second):
		t.Fatal("daemon retained connection")
	}
}

// On HTTP/2 a stream write deadline left armed resets the idle stream when it
// passes, so a quiet daemon between heartbeats must not end the browser's
// stream (Birch's browsers reconnected every few seconds).
func TestProxyStreamSurvivesQuietDaemonOverHTTP2(t *testing.T) {
	old := streamWriteTimeout
	streamWriteTimeout = 100 * time.Millisecond
	t.Cleanup(func() { streamWriteTimeout = old })
	h, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, ": open\n\n")
		w.(http.Flusher).Flush()
		time.Sleep(4 * streamWriteTimeout)
		_, _ = io.WriteString(w, ": heartbeat\n\n")
		w.(http.Flusher).Flush()
	}))
	srv := httptest.NewUnstartedServer(h)
	srv.EnableHTTP2 = true
	srv.StartTLS()
	t.Cleanup(srv.Close)
	r, _ := http.NewRequest("GET", srv.URL+"/api/v1/events?after=ev1:12345678-1234-4123-8123-123456789abc:1", nil)
	r.Host = "host.test"
	r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
	res, err := srv.Client().Do(r)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if res.ProtoMajor != 2 || res.StatusCode != 200 || err != nil || string(body) != ": open\n\n: heartbeat\n\n" {
		t.Fatalf("%s %d %q %v", res.Proto, res.StatusCode, body, err)
	}
}

// The gateway and daemon records of one proxied request share a gateway-made
// ID; a browser cannot choose it, because only selected headers are forwarded.
func TestProxyJoinsGatewayAndDaemonRecords(t *testing.T) {
	seen := make(chan string, 1)
	_, a := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen <- r.Header.Get("X-Agent-Host-Request-Id")
		w.WriteHeader(http.StatusNoContent)
	}))
	var log bytes.Buffer
	a.log = CallbackLogger(&log)
	h := NewWithAuth("", a)
	r := httptest.NewRequest("POST", "https://host.test/api/v1/workspaces", strings.NewReader(`{}`))
	r.RequestURI = "/api/v1/workspaces"
	r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
	r.Header.Set("Origin", "https://host.test")
	r.Header.Set("X-Agent-Host-CSRF", "token")
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("X-Agent-Host-Request-Id", "BrowserChosenIdX")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusNoContent {
		t.Fatalf("status %d", w.Code)
	}
	id := <-seen
	var event map[string]any
	if err := json.Unmarshal(log.Bytes(), &event); err != nil {
		t.Fatalf("%v: %s", err, log.String())
	}
	if id == "" || id == "BrowserChosenIdX" || event["request_id"] != id || event["event"] != "http_request" || event["user"] != "alice" || event["route"] != "/api/v1/workspaces" || event["status"] != float64(204) {
		t.Fatalf("forwarded %q, gateway record %s", id, log.String())
	}
}
