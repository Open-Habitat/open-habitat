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

func TestConversationRecapGatewayAllowlist(t *testing.T) {
	for _, action := range []string{"recap", "close"} {
		path := "/api/v1/conversations/11111111-1111-4111-8111-111111111111/" + action
		match := conversationPath.FindStringSubmatch(path)
		if len(match) != 3 || match[2] != action || conversationPath.MatchString(path+"/extra") {
			t.Fatalf("%s must be a canonical control path", action)
		}
	}
}

func TestConversationGatewaySessionBoundary(t *testing.T) {
	now := time.Now()
	uid := os.Getuid()
	m := Identity{"github", "42", uid, "alice", "/run/open-habitat/users/alice/daemon.sock"}
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
		// Consume the write before replying, as the daemon handlers do. With
		// keep-alives disabled, an early reply can close this Unix connection
		// while Transport is still writing the body and produce EPIPE.
		if _, err := io.Copy(io.Discard, r.Body); err != nil {
			t.Errorf("read daemon request: %v", err)
			w.WriteHeader(400)
			return
		}
		if r.Method == http.MethodPost && (strings.HasSuffix(r.URL.Path, "/stop") || strings.HasSuffix(r.URL.Path, "/continue")) && (r.ContentLength != 0 || len(r.TransferEncoding) != 0) {
			t.Errorf("body-less control was forwarded with framing: CL=%d TE=%v", r.ContentLength, r.TransferEncoding)
			w.WriteHeader(400)
			return
		}
		if r.Host != "unix" || r.Header.Get("Cookie") != "" || r.Header.Get("Origin") != "" || r.Header.Get("X-Agent-Host-CSRF") != "" || r.Header.Get("X-Agent-Host-Identity") != "" || r.Header.Get("X-Agent-Host-Session") != "" {
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
	if w := send("GET", conversationBase, second, "", ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"agent_id":"pi:`+id+`"`) {
		t.Fatalf("same-user list %d %s", w.Code, w.Body.String())
	}
	if w := send("POST", conversationBase, first, create, first); w.Code != 200 {
		t.Fatalf("create %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", conversationBase+"/"+id+"/status", second, "", ""); w.Code != 200 {
		t.Fatalf("second login status %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/send", first, `{"message":"hi","command_id":"`+cmd+`"}`, first); w.Code != 200 {
		t.Fatalf("send %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", conversationBase+"/"+id+"/status", first, "", ""); w.Code != 200 {
		t.Fatalf("status %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", conversationBase+"/"+id+"/status?continuation=true", first, "", ""); w.Code != 200 {
		t.Fatalf("explicit proof route %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", conversationBase+"/"+id+"/status?continuation=false", first, "", ""); w.Code != 400 {
		t.Fatalf("invalid proof flag %d", w.Code)
	}
	for _, hostile := range []string{"host", "tls"} {
		r := httptest.NewRequest("GET", "https://host.test"+conversationBase+"/"+id+"/status", nil)
		r.RequestURI = r.URL.RequestURI()
		r.AddCookie(&http.Cookie{Name: cookieName, Value: first})
		if hostile == "host" {
			r.Host = "other.test"
		} else {
			r.TLS = nil
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 400 {
			t.Fatalf("bare status admitted %s mismatch: %d %s", hostile, w.Code, w.Body.String())
		}
	}

	if w := send("GET", conversationBase+"/"+id+"/receipt?command_id="+cmd, second, "", ""); w.Code != 200 {
		t.Fatalf("second-login receipt %d", w.Code)
	}
	if w := send("GET", conversationBase+"/"+id+"/receipt?command_id="+cmd, first, "", ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"accepted"`) {
		t.Fatalf("receipt %d %s", w.Code, w.Body.String())
	}
	if w := send("GET", conversationBase+"/"+id+"/stream", first, "", ""); w.Code != 400 {
		t.Fatalf("removed stream %d", w.Code)
	}
	if brokerCalls.Load() != 0 {
		t.Fatalf("live conversation requests called broker %d times", brokerCalls.Load())
	}
	question := `{"request_id":"native-a","action":"answer","value":"hello"}`
	if w := send("POST", conversationBase+"/"+id+"/question", second, question, second); w.Code != 200 {
		t.Fatalf("second-login dialog answer %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/question", first, question, "wrong"); w.Code != 403 {
		t.Fatalf("dialog csrf %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/question", first, question, first); w.Code != 200 || !strings.Contains(w.Body.String(), `"uncertain"`) {
		t.Fatalf("dialog answer %d %s", w.Code, w.Body.String())
	}
	if w := send("POST", conversationBase+"/"+id+"/abort", second, `{"command_id":"`+cmd+`"}`, second); w.Code != 200 {
		t.Fatalf("second-login abort %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/abort", first, `{"command_id":"`+cmd+`"}`, "wrong"); w.Code != 403 {
		t.Fatalf("abort csrf %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/abort", first, `{"command_id":"`+cmd+`"}`, first); w.Code != 200 {
		t.Fatalf("abort %d %s", w.Code, w.Body.String())
	}
	if w := send("POST", conversationBase+"/"+id+"/continue", second, "", second); w.Code != 200 {
		t.Fatalf("second-login continuation: %d", w.Code)
	}
	if w := send("POST", conversationBase+"/"+id+"/continue", first, "", first); w.Code != 200 {
		t.Fatalf("continuation: %d %s", w.Code, w.Body.String())
	}
	if w := send("POST", conversationBase+"/"+id+"/stop", second, "", second); w.Code != 200 {
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
	// Expiring one browser login does not revoke another login of the same user.
	a.mu.Lock()
	delete(a.sessions, first)
	a.mu.Unlock()
	if w := send("GET", conversationBase+"/"+id+"/status", first, "", ""); w.Code != 401 {
		t.Fatalf("revoked %d", w.Code)
	}
	if w := send("GET", conversationBase+"/"+id+"/status", second, "", ""); w.Code != 200 {
		t.Fatalf("second login after first expired %d", w.Code)
	}
	// A fresh gateway has no conversation memory; its new login still routes to
	// the surviving daemon. The daemon, not the gateway, decides ownership.
	newLogin := strings.Repeat("C", 43)
	restarted := &Auth{cfg: a.cfg, now: a.now, sessions: map[string]session{newLogin: {identity: m, csrf: newLogin, idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}}, snapshotDial: a.snapshotDial}
	fresh := NewWithAuth("", restarted)
	r := httptest.NewRequest("GET", "https://host.test"+conversationBase+"/"+id+"/status", nil)
	r.AddCookie(&http.Cookie{Name: cookieName, Value: newLogin})
	w := httptest.NewRecorder()
	fresh.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("after gateway restart: %d %s", w.Code, w.Body.String())
	}
	write := httptest.NewRequest("POST", "https://host.test"+conversationBase+"/"+id+"/send", strings.NewReader(`{"message":"again","command_id":"`+cmd+`"}`))
	write.AddCookie(&http.Cookie{Name: cookieName, Value: newLogin})
	write.Header.Set("Origin", "https://host.test")
	write.Header.Set("X-Agent-Host-CSRF", newLogin)
	reply := httptest.NewRecorder()
	fresh.ServeHTTP(reply, write)
	if reply.Code != 200 {
		t.Fatalf("write after restart: %d %s", reply.Code, reply.Body.String())
	}
}

// Routing is derived from the authenticated identity, never from a requested
// conversation ID or browser-supplied socket. Separate mapped daemons cannot
// serve each other's conversation even when their native IDs are known.
func TestConversationRoutesToMappedUserOnly(t *testing.T) {
	const id = "12345678-1234-4123-8123-123456789abc"
	h, a := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == conversationBase+"/"+id+"/status" {
			io.WriteString(w, `{"agent_id":"pi:`+id+`"}`)
		}
	}))
	otherPath := filepath.Join(t.TempDir(), "other.sock")
	ln, err := net.Listen("unix", otherPath)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	other := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == conversationBase+"/"+id+"/status" {
			w.WriteHeader(404)
			io.WriteString(w, `{"code":"resource_not_found"}`)
		}
	})}
	go other.Serve(ln)
	defer other.Close()
	// The dial seam honors the mapped path, as production udssecure.Mapped does.
	a.snapshotDial = func(ctx context.Context, path string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", path)
	}
	a.sessions["other"] = session{identity: Identity{Provider: "github", Subject: "43", UID: os.Getuid(), Username: "bob", Socket: otherPath}, csrf: "other-token", idle: a.now().Add(time.Hour), absolute: a.now().Add(time.Hour)}
	alice := proxyCall(h, "GET", conversationBase+"/"+id+"/status", "")
	if alice.Code != 200 {
		t.Fatalf("alice: %d", alice.Code)
	}
	r := httptest.NewRequest("GET", "https://host.test"+conversationBase+"/"+id+"/status", nil)
	r.AddCookie(&http.Cookie{Name: cookieName, Value: "other"})
	r.Header.Set("X-Agent-Host-Socket", a.sessions["browser"].identity.Socket)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 404 {
		t.Fatalf("foreign user routed to alice: %d %s", w.Code, w.Body.String())
	}
}

func TestProcessGatewayRequiresSessionAndCSRF(t *testing.T) {
	var calls atomic.Int32
	h, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		io.WriteString(w, `{"schema_version":1,"result":"cleared"}`)
	}))
	base := "/api/v1/conversations/11111111-1111-4111-8111-111111111111/processes"
	for _, tc := range []struct{ method, path string }{{"GET", base}, {"GET", base + "/proc_abcd/output?owner_generation=g&process_token=pt_1&tail_lines=20"}, {"POST", base + "/proc_abcd/stop"}, {"POST", base + "/clear-finished"}} {
		if w := proxyCall(h, tc.method, tc.path, `{}`); w.Code != 200 {
			t.Fatalf("valid %s %s: %d %s", tc.method, tc.path, w.Code, w.Body.String())
		}
	}
	before := calls.Load()
	for _, path := range []string{base + "/proc_abcd/stop", base + "/clear-finished"} {
		r := httptest.NewRequest("POST", "https://host.test"+path, strings.NewReader(`{}`))
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
		r.Header.Set("Origin", "https://host.test")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 403 {
			t.Fatalf("missing CSRF %d", w.Code)
		}
	}
	for _, tc := range []struct{ method, path string }{{"GET", base + "/clear-finished"}, {"POST", base}, {"GET", base + "/proc_abcd/output?tail_lines=20"}, {"GET", base + "/proc_abcd/output?owner_generation=x&process_token=y&tail_lines=20&tail_lines=30"}, {"GET", base + "/../processes"}, {"POST", base + "/proc_abcd/stop/extra"}} {
		if w := proxyCall(h, tc.method, tc.path, `{}`); w.Code == 200 {
			t.Fatalf("invalid route forwarded: %s", tc.path)
		}
	}
	if calls.Load() != before {
		t.Fatal("denied process operation reached mapped daemon")
	}
	r := httptest.NewRequest("GET", "https://host.test"+base, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 401 {
		t.Fatal("anonymous inventory exposed")
	}
}
