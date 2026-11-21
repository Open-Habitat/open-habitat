//go:build linux

package gateway

import (
	"bufio"
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// The participant operations of ADR 0038 section 6 cross the gateway only
// as the gateway rebuilt them: the fixed guest path of the share's
// conversation, a query and body read against each operation's grammar, and
// the participant named from the session. Anything else is refused before
// the owner's daemon sees it, the same as a missing share.
func TestGuestOperationsCrossOnlyAsRebuilt(t *testing.T) {
	f := newShareFixture(t, "")
	f.invite(t, "invite", "github:43")
	share := f.shares(t, "b")[0].ShareID
	base := sharedPrefix + share + "/"
	f.daemon.guest = func(w http.ResponseWriter, r *http.Request, _ []byte) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"schema_version":1,"echo":"ok"}`)
	}
	missing := f.send("b", "POST", sharedPrefix+"saaaaaaaaaaaaaaaaaaaaaaaaaa/send", `{"text":"hi"}`)
	for name, w := range map[string]*httptest.ResponseRecorder{
		"unknown query key":     f.send("b", "GET", base+"history?evil=1", ""),
		"doubled query key":     f.send("b", "GET", base+"history?limit=1&limit=2", ""),
		"bad entry key":         f.send("b", "GET", base+"history?before=../x", ""),
		"state with query":      f.send("b", "GET", base+"state?x=1", ""),
		"blocks without tail":   f.send("b", "GET", base+"blocks?revision=r&offset=0&limit_bytes=1", ""),
		"blocks bad tail":       f.send("b", "GET", base+"blocks/key/1/2?revision=r&offset=0&limit_bytes=1", ""),
		"blocks missing query":  f.send("b", "GET", base+"blocks/key/1?offset=0", ""),
		"events without cursor": f.send("b", "GET", base+"events", ""),
		"send unknown field":    f.send("b", "POST", base+"send", `{"text":"hi","role":"full_rights"}`),
		"send duplicate field":  f.send("b", "POST", base+"send", `{"text":"hi","text":"ho"}`),
		"send empty":            f.send("b", "POST", base+"send", `{"text":""}`),
		"send too long":         f.send("b", "POST", base+"send", `{"text":"`+strings.Repeat("a", 16001)+`"}`),
		"cancel bad id":         f.send("b", "POST", base+"cancel", `{"message_id":"x"}`),
		"presence bad state":    f.send("b", "POST", base+"presence", `{"state":"owner"}`),
		"abort with body":       f.send("b", "POST", base+"abort", `{}`),
		"owner-only stop":       f.send("b", "POST", base+"stop", ""),
		"owner-only question":   f.send("b", "POST", base+"question", `{}`),
		"foreign session":       f.send("c", "GET", base+"state", ""),
	} {
		if w.Code != 404 || w.Body.String() != missing.Body.String() {
			t.Fatalf("%s: %d %s", name, w.Code, w.Body.String())
		}
	}
	f.daemon.mu.Lock()
	if len(f.daemon.guests) != 0 {
		t.Fatalf("refused requests reached the guest socket: %d", len(f.daemon.guests))
	}
	f.daemon.mu.Unlock()

	for _, c := range []struct{ method, path, body, wantURI, wantBody string }{
		{"GET", base + "state", "", "/guest/v1/conversations/" + membersConv + "/state", ""},
		{"GET", base + "invite", "", "/guest/v1/conversations/" + membersConv + "/invite", ""},
		{"GET", base + "history?messages=40&before=e_1", "", "/guest/v1/conversations/" + membersConv + "/history?before=e_1&messages=40", ""},
		{"GET", base + "blocks/e_1/3?revision=rev-1&offset=0&limit_bytes=4096", "", "/guest/v1/conversations/" + membersConv + "/blocks/e_1/3?limit_bytes=4096&offset=0&revision=rev-1", ""},
		{"POST", base + "send", `{ "text" : "Hello there" }`, "/guest/v1/conversations/" + membersConv + "/send", `{"text":"Hello there"}`},
		{"POST", base + "cancel", `{"message_id":"00000000-0000-4000-8000-000000000011"}`, "/guest/v1/conversations/" + membersConv + "/cancel", `{"message_id":"00000000-0000-4000-8000-000000000011"}`},
		{"POST", base + "presence", `{"state":"typing"}`, "/guest/v1/conversations/" + membersConv + "/presence", `{"state":"typing"}`},
		{"POST", base + "abort", "", "/guest/v1/conversations/" + membersConv + "/abort", ""},
	} {
		w := f.send("b", c.method, c.path, c.body)
		if w.Code != 200 || w.Body.String() != `{"schema_version":1,"echo":"ok"}` || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("%s %s: %d %s", c.method, c.path, w.Code, w.Body.String())
		}
		f.daemon.mu.Lock()
		got, body, header := f.daemon.guests[len(f.daemon.guests)-1], f.daemon.bodies[len(f.daemon.bodies)-1], f.daemon.headers[len(f.daemon.headers)-1]
		f.daemon.mu.Unlock()
		if got.Method != c.method || got.URL.RequestURI() != c.wantURI || body != c.wantBody || header == "" || got.Header.Get("Cookie") != "" {
			t.Fatalf("%s %s crossed as %s %s %q", c.method, c.path, got.Method, got.URL.RequestURI(), body)
		}
	}

	// A refusal of the owner's daemon passes through as its code; a reply
	// that is not JSON does not.
	f.daemon.guest = func(w http.ResponseWriter, r *http.Request, _ []byte) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(409)
		io.WriteString(w, `{"schema_version":1,"error":{"code":"not_running"}}`)
	}
	if w := f.send("b", "POST", base+"abort", ""); w.Code != 409 || !strings.Contains(w.Body.String(), "not_running") {
		t.Fatal("refusal", w.Code, w.Body.String())
	}
	f.daemon.guest = func(w http.ResponseWriter, r *http.Request, _ []byte) {
		w.Header().Set("Content-Type", "text/html")
		io.WriteString(w, `<p>`)
	}
	if w := f.send("b", "GET", base+"state", ""); w.Code != 503 {
		t.Fatal("non-JSON reply relayed", w.Code)
	}
}

// The participant's stream is relayed from the owner's guest socket and is
// tied to the share: removing the participant ends it.
func TestGuestStreamIsRelayedAndEndsWithTheShare(t *testing.T) {
	f := newShareFixture(t, "")
	f.invite(t, "invite", "github:43")
	share := f.shares(t, "b")[0].ShareID
	opened := make(chan *http.Request, 1)
	f.daemon.guest = func(w http.ResponseWriter, r *http.Request, _ []byte) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(200)
		io.WriteString(w, ": open\n\nid: ev1:x:1\nevent: assistant.delta\ndata: {}\n\n")
		w.(http.Flusher).Flush()
		opened <- r
		<-r.Context().Done()
	}
	srv := httptest.NewUnstartedServer(f.h)
	srv.EnableHTTP2 = false
	srv.StartTLS()
	defer srv.Close()
	client := srv.Client()
	client.Transport.(*http.Transport).TLSClientConfig.ServerName = "example.com"
	client.Transport.(*http.Transport).DialContext = func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, network, srv.Listener.Addr().String())
	}
	cursor := "ev1:00000000-0000-4000-8000-000000000099:7"
	req, _ := http.NewRequest("GET", "https://host.test"+sharedPrefix+share+"/events?after="+cursor, nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: "b"})
	req.Header.Set("Origin", "https://host.test")
	req.Header.Set("Last-Event-ID", "ev1:00000000-0000-4000-8000-000000000099:8")
	res, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 || res.Header.Get("Content-Type") != "text/event-stream" {
		t.Fatal("stream", res.StatusCode, res.Header)
	}
	r := <-opened
	if r.URL.Query().Get("after") != cursor || r.Header.Get("Last-Event-ID") != "ev1:00000000-0000-4000-8000-000000000099:8" {
		t.Fatal("cursor not passed", r.URL, r.Header)
	}
	reader := bufio.NewReader(res.Body)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			t.Fatal("stream ended before the frame", err)
		}
		if strings.HasPrefix(line, "event: assistant.delta") {
			break
		}
	}
	f.invite(t, "remove", "github:43")
	done := make(chan error, 1)
	go func() { _, err := io.ReadAll(reader); done <- err }()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("removal left the participant's stream open")
	}
}

// The owner reads a shared conversation's facts on their own session by GET
// only.
func TestOwnerSharedFactsRouteIsReadOnly(t *testing.T) {
	f := newShareFixture(t, "")
	path := "/api/v1/conversations/" + membersConv + "/shared"
	if w := f.send("a", "POST", path, ""); w.Code != 400 {
		t.Fatal("POST shared", w.Code, w.Body.String())
	}
	f.daemon.mu.Lock()
	before := len(f.daemon.dials)
	f.daemon.mu.Unlock()
	f.send("a", "GET", path, "")
	f.daemon.mu.Lock()
	defer f.daemon.mu.Unlock()
	if len(f.daemon.dials) != before+1 || f.daemon.dials[len(f.daemon.dials)-1] != "/run/open-habitat/users/alice/daemon.sock" {
		t.Fatal("GET shared did not reach the owner's own daemon", f.daemon.dials)
	}
}
