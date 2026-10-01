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
		case conversationBase + "/" + id + "/receipt":
			reply = `{"schema_version":1,"command_id":"` + cmd + `","state":"accepted"}`
		case conversationBase + "/" + id + "/status":
			reply = `{"schema_version":1,"agent_id":"pi:` + id + `","workspace_id":"` + ws + `","state":"pending","command_id":"` + cmd + `","ack":"pending","event_cursor":0,"events":[],"event_loss":false,"continuation":"unproven","native_history":"missing","native_revision":"","history_query":"/api/v1/agents/pi:` + id + `/history"}`
		case conversationBase + "/" + id + "/stream":
			if r.Header.Get("Last-Event-ID") != "" {
				body := `{"schema_version":1,"error":{"code":"cursor_expired","message":"Request could not be completed","retryable":false,"correlation_id":"req_00000000"}}`
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Content-Length", strconv.Itoa(len(body)))
				w.WriteHeader(409)
				_, _ = io.WriteString(w, body)
				return
			}
			w.Header().Set("Content-Type", "text/event-stream")
			w.(http.Flusher).Flush()
			_, _ = io.WriteString(w, "id: ev1:12345678-1234-4123-8123-123456789abc:1\nevent: status\ndata: {\"schema_version\":1,\"agent_id\":\"pi:"+id+"\",\"workspace_id\":\""+ws+"\",\"state\":\"idle\",\"command_id\":\"\",\"ack\":\"\",\"event_cursor\":0,\"events\":[],\"event_loss\":false,\"continuation\":\"unproven\",\"native_history\":\"missing\",\"native_revision\":\"\",\"history_query\":\"/api/v1/agents/pi:"+id+"/history\"}\n\n")
			return
		case conversationBase + "/" + id + "/question":
			reply = `{"schema_version":1,"request_id":"native-a","state":"uncertain"}`
		case conversationBase + "/" + id + "/abort":
			reply = `{"schema_version":1,"command_id":"` + cmd + `","state":"pending"}`
		case conversationBase + "/" + id + "/continue":
			reply = `{"schema_version":1,"agent_id":"pi:` + id + `","workspace_id":"` + ws + `","state":"idle","prior_outcome":"uncertain"}`
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
	var brokerCalls atomic.Int32
	a.broker.(*fakeBroker).hook = func(BrokerRequest) { brokerCalls.Add(1) }
	a.broker.(*fakeBroker).fail = true
	first, second := strings.Repeat("A", 43), strings.Repeat("B", 43)
	for _, k := range []string{first, second} {
		a.sessions[k] = session{identity: m, csrf: k, idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}
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
	if w := send("GET", conversationBase+"/"+id+"/receipt?command_id="+cmd, second, "", ""); w.Code != 404 {
		t.Fatalf("foreign receipt %d", w.Code)
	}
	if w := send("GET", conversationBase+"/"+id+"/receipt?command_id="+cmd, first, "", ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"accepted"`) {
		t.Fatalf("receipt %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", conversationBase+"/"+id+"/stream", second, "", ""); w.Code != 404 {
		t.Fatalf("foreign stream %d", w.Code)
	}
	if w := send("GET", conversationBase+"/"+id+"/stream", first, "", ""); w.Code != 200 || !strings.Contains(w.Body.String(), "event: status") {
		t.Fatalf("stream %d %s", w.Code, w.Body.String())
	}
	cursorRequest := httptest.NewRequest("GET", "https://host.test"+conversationBase+"/"+id+"/stream", nil)
	cursorRequest.RequestURI = cursorRequest.URL.Path
	cursorRequest.AddCookie(&http.Cookie{Name: cookieName, Value: first})
	cursorRequest.Header.Set("Last-Event-ID", "ev1:12345678-1234-4123-8123-123456789abc:1")
	cursorReply := httptest.NewRecorder()
	h.ServeHTTP(streamRecorder{cursorReply}, cursorRequest)
	if cursorReply.Code != 409 || !strings.Contains(cursorReply.Body.String(), `"cursor_expired"`) {
		t.Fatalf("cursor rejection %d %s", cursorReply.Code, cursorReply.Body.String())
	}
	if brokerCalls.Load() != 0 {
		t.Fatalf("live conversation requests or stream called broker %d times", brokerCalls.Load())
	}
	question := `{"request_id":"native-a","action":"answer","value":"hello"}`
	if w := send("POST", conversationBase+"/"+id+"/question", second, question, second); w.Code != 404 {
		t.Fatalf("foreign dialog answer %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/question", first, question, "wrong"); w.Code != 403 {
		t.Fatalf("dialog csrf %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/question", first, question, first); w.Code != 200 || !strings.Contains(w.Body.String(), `"uncertain"`) {
		t.Fatalf("dialog answer %d %s", w.Code, w.Body.String())
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
	if w := send("POST", conversationBase+"/"+id+"/continue", second, "", second); w.Code != 404 {
		t.Fatalf("foreign continuation: %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/continue", first, "", first); w.Code != 200 {
		t.Fatalf("continuation: %d %s", w.Code, w.Body.String())
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
