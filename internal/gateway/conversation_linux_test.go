//go:build linux

package gateway

import (
	"bufio"
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

type streamRecorder struct{ *httptest.ResponseRecorder }

func (w streamRecorder) SetWriteDeadline(time.Time) error { return nil }
func (w streamRecorder) Flush()                           { w.ResponseRecorder.Flush() }

func TestConversationGatewaySessionBoundary(t *testing.T) {
	now := time.Now()
	uid := os.Getuid()
	m := Identity{"github", "42", uid, "alice", "/run/native-agent-host/users/alice/daemon.sock"}
	socket := filepath.Join(t.TempDir(), "daemon.sock")
	ln, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	const id = "12345678-1234-4123-8123-123456789abc"
	const cmd = "aaaaaaaa-1234-4123-8123-123456789abc"
	const ws = "ws_12345678"
	var calls atomic.Int32
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.Host != "unix" || r.Header.Get("Cookie") != "" || r.Header.Get("Origin") != "" || r.Header.Get("X-Agent-Host-CSRF") != "" || r.Header.Get("X-Agent-Host-Identity") != identityID(m) || r.Header.Get("X-Agent-Host-Session") == strings.Repeat("A", 43) || len(r.Header.Get("X-Agent-Host-Session")) != 43 {
			t.Errorf("unsafe daemon request: %+v", r.Header)
		}
		var reply string
		switch r.URL.Path {
		case conversationBase:
			if r.Method == "POST" {
				reply = `{"schema_version":1,"agent_id":"pi:` + id + `","workspace_id":"` + ws + `","state":"idle"}`
			} else {
				reply = `{"schema_version":1,"sessions":[{"agent_id":"pi:` + id + `","workspace_id":"` + ws + `","state":"idle"}]}`
			}
		case conversationBase + "/" + id + "/send":
			reply = `{"schema_version":1,"command_id":"` + cmd + `","state":"pending"}`
		case conversationBase + "/" + id + "/status":
			reply = `{"schema_version":1,"agent_id":"pi:` + id + `","workspace_id":"` + ws + `","state":"pending","command_id":"` + cmd + `","ack":"pending","event_cursor":0,"events":[],"event_loss":false,"native_history":"missing","native_revision":"","history_query":"/api/v1/agents/pi:` + id + `/history"}`
		case conversationBase + "/" + id + "/stream":
			w.Header().Set("Content-Type", "text/event-stream")
			w.(http.Flusher).Flush()
			_, _ = io.WriteString(w, "id: ev1:12345678-1234-4123-8123-123456789abc:1\nevent: status\ndata: {\"schema_version\":1,\"agent_id\":\"pi:"+id+"\",\"workspace_id\":\""+ws+"\",\"state\":\"idle\",\"command_id\":\"\",\"ack\":\"\",\"event_cursor\":0,\"events\":[],\"event_loss\":false,\"native_history\":\"missing\",\"native_revision\":\"\",\"history_query\":\"/api/v1/agents/pi:"+id+"/history\"}\n\n")
			return
		case conversationBase + "/" + id + "/abort":
			reply = `{"schema_version":1,"command_id":"` + cmd + `","state":"pending"}`
		case conversationBase + "/" + id + "/stop":
			reply = `{"schema_version":1,"state":"termination_unknown"}`
		default:
			t.Errorf("bad path %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(reply)))
		_, _ = io.WriteString(w, reply)
	})}
	go srv.Serve(ln)
	defer srv.Close()
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: newFakeBroker(), now: func() time.Time { return now }, sessions: map[string]session{}}
	a.broker.(*fakeBroker).routes["42"] = BrokerRoute{UID: uint32(uid), Username: "alice", Socket: m.Socket}
	first, second := strings.Repeat("A", 43), strings.Repeat("B", 43)
	for _, k := range []string{first, second} {
		a.sessions[k] = session{identity: m, epoch: 1, generation: 1, csrf: k, idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}
	}
	a.snapshotDial = func(ctx context.Context, p string) (net.Conn, error) {
		if p != m.Socket {
			t.Errorf("socket %s", p)
		}
		return (&net.Dialer{}).DialContext(ctx, "unix", socket)
	}
	h := NewWithAuth("", a)
	send := func(method, path, owner, body, csrf string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, "https://host.test"+path, strings.NewReader(body))
		r.RequestURI = path
		if owner != "" {
			r.AddCookie(&http.Cookie{Name: cookieName, Value: owner})
		}
		if method == "POST" {
			r.Header.Set("Origin", "https://host.test")
			r.Header.Set("X-Agent-Host-CSRF", csrf)
			if body != "" {
				r.Header.Set("Content-Type", "application/json")
			}
		}
		w := httptest.NewRecorder()
		if strings.HasSuffix(path, "/stream") {
			h.ServeHTTP(streamRecorder{w}, r)
		} else {
			h.ServeHTTP(w, r)
		}
		return w
	}
	create := `{"workspace_id":"` + ws + `"}`
	if w := send("POST", conversationBase, "", create, first); w.Code != 401 {
		t.Fatalf("anonymous %d", w.Code)
	}
	if w := send("POST", conversationBase, first, create, "old"); w.Code != 403 {
		t.Fatalf("csrf %d", w.Code)
	}
	if w := send("POST", conversationBase, first, create, second); w.Code != 403 {
		t.Fatalf("other csrf %d", w.Code)
	}
	if w := send("GET", conversationBase, second, "", ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"sessions":[]`) {
		t.Fatalf("other list %d %s", w.Code, w.Body.String())
	}
	if w := send("POST", conversationBase, first, create, first); w.Code != 200 {
		t.Fatalf("create %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", conversationBase+"/"+id+"/status", second, "", ""); w.Code != 404 {
		t.Fatalf("other status %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/send", first, `{"message":"hi","command_id":"`+cmd+`"}`, first); w.Code != 200 {
		t.Fatalf("send %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", conversationBase+"/"+id+"/status", first, "", ""); w.Code != 200 {
		t.Fatalf("status %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", conversationBase+"/"+id+"/stream", second, "", ""); w.Code != 404 {
		t.Fatalf("foreign stream %d", w.Code)
	}
	if w := send("GET", conversationBase+"/"+id+"/stream", first, "", ""); w.Code != 200 || !strings.Contains(w.Body.String(), "event: status") {
		t.Fatalf("stream %d %s", w.Code, w.Body.String())
	}
	if w := send("POST", conversationBase+"/"+id+"/abort", second, `{"command_id":"`+cmd+`"}`, second); w.Code != 404 {
		t.Fatalf("foreign abort %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/abort", first, `{"command_id":"`+cmd+`"}`, "wrong"); w.Code != 403 {
		t.Fatalf("abort csrf %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/abort", first, `{"command_id":"`+cmd+`"}`, first); w.Code != 200 {
		t.Fatalf("abort %d %s", w.Code, w.Body.String())
	}
	if w := send("POST", conversationBase+"/"+id+"/stop", first, "", first); w.Code != 200 {
		t.Fatalf("stop %d %s", w.Code, w.Body.String())
	}
	before := calls.Load()
	for _, path := range []string{conversationBase + "/", conversationBase + "?foo=x", conversationBase + "/" + id + "/status?x=1", conversationBase + "/" + id + "/send/extra", conversationBase + "/%31"} {
		if w := send("GET", path, first, "", ""); w.Code == 200 {
			t.Fatalf("accepted %s", path)
		}
	}
	if calls.Load() != before {
		t.Fatal("invalid request reached daemon")
	}
	// Revoking a browser session does not grant its successor the old lease.
	a.mu.Lock()
	delete(a.sessions, first)
	a.mu.Unlock()
	if w := send("GET", conversationBase+"/"+id+"/status", first, "", ""); w.Code != 401 {
		t.Fatalf("revoked %d", w.Code)
	}
	if w := send("GET", conversationBase+"/"+id+"/status", second, "", ""); w.Code != 404 {
		t.Fatalf("successor %d", w.Code)
	}
}

func TestStreamHeaderBudgetLeavesBodyReadable(t *testing.T) {
	for _, tc := range []struct {
		name, headers string
		ok            bool
	}{
		{"ordinary", "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n\r\n", true},
		{"oversized", "HTTP/1.1 200 OK\r\nX-Padding: " + strings.Repeat("a", 8192) + "\r\n\r\n", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reader := bufio.NewReader(&streamHeaderReader{source: strings.NewReader(tc.headers + strings.Repeat("b", 1<<20))})
			res, err := http.ReadResponse(reader, nil)
			if !tc.ok {
				if err == nil {
					res.Body.Close()
					t.Fatal("oversized headers accepted")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			body, err := io.ReadAll(res.Body)
			if err != nil || len(body) != 1<<20 {
				t.Fatalf("body truncated: %d %v", len(body), err)
			}
		})
	}
}

func TestConversationReplyValidation(t *testing.T) {
	id := "12345678-1234-4123-8123-123456789abc"
	for _, raw := range []string{`{"schema_version":1,"agent_id":"pi:` + id + `","workspace_id":"ws_12345678","state":"idle","secret":"oops"}`, `{"schema_version":1,"agent_id":"pi:bad","workspace_id":"ws_12345678","state":"idle"}`, `{"schema_version":1,"sessions":[{"agent_id":"pi:bad","workspace_id":"ws_12345678","state":"idle"}]}`} {
		kind := "create"
		if strings.Contains(raw, "sessions") {
			kind = "list"
		}
		if _, _, ok := validatedConversationReply(kind, []byte(raw), ""); ok {
			t.Fatalf("accepted %s", raw)
		}
	}
	if validConversationInput("send", []byte(`{"message":"hi","command_id":"bad"}`)) {
		t.Fatal("invalid command")
	}
}

func TestConversationLostAckAndPeerDenial(t *testing.T) {
	now := time.Now()
	uid := os.Getuid()
	m := Identity{"github", "42", uid, "alice", "/run/native-agent-host/users/alice/daemon.sock"}
	socket := filepath.Join(t.TempDir(), "daemon.sock")
	ln, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	var calls atomic.Int32
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.Method == "POST" { // accept an ambiguous command, then lose the acknowledgement
			if conn, _, err := w.(http.Hijacker).Hijack(); err == nil {
				_ = conn.Close()
			}
			return
		}
		raw := `{"schema_version":1,"sessions":[]}`
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(raw)))
		_, _ = io.WriteString(w, raw)
	})}
	go srv.Serve(ln)
	defer srv.Close()
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: newFakeBroker(), now: func() time.Time { return now }, sessions: map[string]session{}}
	a.broker.(*fakeBroker).routes["42"] = BrokerRoute{UID: uint32(uid), Username: "alice", Socket: m.Socket}
	token := strings.Repeat("A", 43)
	a.sessions[token] = session{identity: m, epoch: 1, generation: 1, csrf: "csrf", idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}
	a.snapshotDial = func(ctx context.Context, p string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", socket)
	}
	h := NewWithAuth("", a)
	request := func() *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "https://host.test"+conversationBase, strings.NewReader(`{"workspace_id":"ws_12345678"}`))
		r.RequestURI = conversationBase
		r.AddCookie(&http.Cookie{Name: cookieName, Value: token})
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("X-Agent-Host-CSRF", "csrf")
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	a.snapshotPeerUID = func(*net.UnixConn) int { return uid + 1 }
	if w := request(); w.Code != 503 || calls.Load() != 0 {
		t.Fatalf("wrong peer %d calls=%d", w.Code, calls.Load())
	}
	a.snapshotPeerUID = func(*net.UnixConn) int { return uid }
	if w := request(); w.Code != 503 || !strings.Contains(w.Body.String(), "control_uncertain") || calls.Load() != 1 {
		t.Fatalf("lost ack %d %s calls=%d", w.Code, w.Body.String(), calls.Load())
	}
	// The gateway must not automatically replay the request or claim a foreign
	// daemon handle after it has lost the create acknowledgement.
	r := httptest.NewRequest("GET", "https://host.test"+conversationBase, nil)
	r.RequestURI = conversationBase
	r.AddCookie(&http.Cookie{Name: cookieName, Value: token})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"sessions":[]`) || calls.Load() != 2 {
		t.Fatalf("list after ambiguity %d %s calls=%d", w.Code, w.Body.String(), calls.Load())
	}
}

func TestConversationRejectsExpiredSessionAfterSlowBody(t *testing.T) {
	now := time.Now()
	uid := os.Getuid()
	m := Identity{"github", "42", uid, "alice", "/run/native-agent-host/users/alice/daemon.sock"}
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: newFakeBroker(), now: func() time.Time { return now }, sessions: map[string]session{}}
	a.broker.(*fakeBroker).routes["42"] = BrokerRoute{UID: uint32(uid), Username: "alice", Socket: m.Socket}
	token := strings.Repeat("A", 43)
	a.sessions[token] = session{identity: m, epoch: 1, generation: 1, csrf: "csrf", idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}
	var dialed atomic.Bool
	a.snapshotDial = func(context.Context, string) (net.Conn, error) { dialed.Store(true); return nil, io.EOF }
	reader, writer := io.Pipe()
	payload := `{"workspace_id":"ws_12345678"}`
	r := httptest.NewRequest("POST", "https://host.test"+conversationBase, reader)
	r.RequestURI = conversationBase
	r.ContentLength = int64(len(payload))
	r.AddCookie(&http.Cookie{Name: cookieName, Value: token})
	r.Header.Set("Origin", "https://host.test")
	r.Header.Set("X-Agent-Host-CSRF", "csrf")
	r.Header.Set("Content-Type", "application/json")
	result := make(chan *httptest.ResponseRecorder, 1)
	go func() { w := httptest.NewRecorder(); NewWithAuth("", a).ServeHTTP(w, r); result <- w }()
	a.mu.Lock()
	delete(a.sessions, token)
	a.mu.Unlock()
	go func() { _, _ = io.WriteString(writer, payload); _ = writer.Close() }()
	var w *httptest.ResponseRecorder
	select {
	case w = <-result:
	case <-time.After(2 * time.Second):
		_ = reader.Close()
		t.Fatal("slow body did not settle")
	}
	if w.Code != 401 || dialed.Load() {
		t.Fatalf("revoked slow body forwarded: %d dial=%v", w.Code, dialed.Load())
	}
}

func TestConversationRejectsAmbiguousDaemonErrors(t *testing.T) {
	for _, tc := range []struct {
		status int
		body   string
		valid  bool
	}{
		{503, `{"schema_version":1,"error":{"code":"daemon_unavailable","message":"unavailable","retryable":false,"correlation_id":"req_00000000"}}`, true},
		{503, `{"schema_version":1,"error":{"code":"secret_leak","message":"token","retryable":false,"correlation_id":"req_00000000"}}`, false},
		{409, `{"schema_version":1,"error":{"code":"control_uncertain","message":"unknown","retryable":false,"correlation_id":"req_00000000"},"foreign":"data"}`, false},
		{404, `{"schema_version":1,"error":{"code":"resource_not_found","message":"missing","retryable":false,"correlation_id":"req_00000000"}}`, true},
	} {
		if got := validConversationError([]byte(tc.body), tc.status); got != tc.valid {
			t.Fatalf("status %d body %s: %v", tc.status, tc.body, got)
		}
	}
	for _, raw := range []string{`{"workspace_id":"ws_12345678","workspace_id":"ws_87654321"}`, `{"workspace_id":"ws_12345678","subject":"other"}`} {
		if validConversationInput("create", []byte(raw)) {
			t.Fatalf("accepted %s", raw)
		}
	}
}
