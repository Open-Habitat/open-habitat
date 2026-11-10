//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/user"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestModelAuthFailureIsFixedAndNativeReadsDoNotProbeStatus(t *testing.T) {
	for _, tc := range []struct {
		text string
		auth bool
	}{
		{"401 Unauthorized token=private", true}, {"403 Forbidden", true},
		{"invalid_api_key credential private", true}, {"rate limit 429", false}, {"network timeout", false},
		{"Failed to authenticate: OAuth session expired and could not be refreshed", true}, {"Invalid API key · Fix external API key", true},
		{`529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}`, false},
	} {
		if got := modelAuthFailure(tc.text); got != tc.auth {
			t.Fatalf("classification %q: %v", tc.text, got)
		}
	}
	if !modelUnsupported("The model gpt-example is not supported with this ChatGPT account") ||
		modelUnsupported("401 Unauthorized") || modelUnsupported("model request timeout") {
		t.Fatal("unsupported model must not be mistaken for failed login or transient errors")
	}
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, err := strconv.Atoi(u.Uid)
	if err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{UID: uid, GatewayUID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42", Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock"}
	checks := 0
	c := newConversationController(context.Background(), cfg, nil, func(*http.Request) bool { return true }, func(context.Context) string { checks++; return "missing" })
	defer c.shutdown()
	r := httptest.NewRequest("GET", "http://unix/api/v1/conversations", nil)
	r.RequestURI = "/api/v1/conversations"
	r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
	r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
	w := httptest.NewRecorder()
	c.ServeHTTP(w, r)
	if w.Code != 200 || checks != 0 || !strings.Contains(w.Body.String(), `"sessions":[]`) {
		t.Fatalf("native list: %d checks=%d", w.Code, checks)
	}
}

func TestPiAuthErrorScrubsNativeFrame(t *testing.T) {
	const id = "12345678-1234-4123-8123-123456789abc"
	rpc := &piRPC{events: make(chan json.RawMessage, 2)}
	s := &conversation{id: id, rpc: rpc, state: "idle", events: []json.RawMessage{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, journal: newEventJournal()}
	rpc.events <- []byte(`{"type":"message_end","message":{"role":"assistant","stopReason":"error","errorMessage":"401 Unauthorized token=synthetic-secret"}}`)
	close(rpc.events)
	c.drain(s)
	if s.authError != "pi_auth_failed" || len(s.events) != 1 || strings.Contains(string(s.events[0]), "synthetic-secret") {
		t.Fatalf("model failure leaked native error or lost fixed code: %q", s.authError)
	}
}

func TestUnsupportedModelHasFixedStatusWithoutNativeErrorInEvents(t *testing.T) {
	const id = "12345678-1234-4123-8123-123456789abc"
	rpc := &piRPC{events: make(chan json.RawMessage, 2)}
	s := &conversation{id: id, rpc: rpc, state: "idle", events: []json.RawMessage{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, journal: newEventJournal()}
	rpc.events <- []byte(`{"type":"message_end","message":{"role":"assistant","stopReason":"error","errorMessage":"The model gpt-example is not supported with this ChatGPT account secret=private"}}`)
	close(rpc.events)
	c.drain(s)
	if s.authError != "pi_model_unsupported" || len(s.events) != 1 || strings.Contains(string(s.events[0]), "private") {
		t.Fatalf("unsupported model leaked native error or lost fixed code: %q", s.authError)
	}
}

func TestDeviceLoginClearsOnlyAuthFailures(t *testing.T) {
	c := &ConversationController{sessions: map[string]*conversation{
		"auth":  {authError: "pi_auth_failed"},
		"model": {authError: "pi_model_unsupported"},
	}}
	c.ClearPiAuthFailures()
	if c.sessions["auth"].authError != "" || c.sessions["model"].authError != "pi_model_unsupported" {
		t.Fatal("successful device login must clear only authentication failures")
	}
}

// A dead RPC output stream need not mean the child has exited yet. Without an
// event, a browser relying on the journal would retain its old control state.
func TestDrainEndInvalidatesConversationBeforeChildExit(t *testing.T) {
	const id = "12345678-1234-4123-8123-123456789abc"
	rpc := &piRPC{events: make(chan json.RawMessage), exited: make(chan struct{})}
	close(rpc.events)
	s := &conversation{id: id, rpc: rpc, state: "accepted", events: []json.RawMessage{}}
	j := newEventJournal()
	c := &ConversationController{sessions: map[string]*conversation{id: s}, journal: j}
	c.drain(s)
	if s.state != "uncertain" || len(j.frames) != 1 || !strings.Contains(string(j.frames[0]), `"kind":"snapshot.invalidated"`) {
		t.Fatalf("drain end not published: state=%s frames=%q", s.state, j.frames)
	}
}

func TestFixtureSnapshotAndEventsDoNotProbePi(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, err := strconv.Atoi(u.Uid)
	if err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{UID: uid, GatewayUID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42", Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock"}
	var checks atomic.Int32
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c := ConversationHandlerWithFixtureRuntime(ctx, cfg, func(*http.Request) bool { return true }, func(context.Context) string { checks.Add(1); return "missing" }, t.TempDir(), nil)
	snap := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
	snap.RequestURI = "/api/v1/snapshot"
	snap.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
	snap.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
	w := httptest.NewRecorder()
	c.FixtureSnapshot().ServeHTTP(w, snap)
	if w.Code != 200 || checks.Load() != 0 {
		t.Fatalf("snapshot checked Pi: %d checks=%d", w.Code, checks.Load())
	}
	server := httptest.NewServer(c.FixtureEvents())
	defer server.Close()
	request, err := http.NewRequest("GET", server.URL+"/api/v1/events?after="+c.journal.cursor(0), nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Host = "unix"
	request.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
	request.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 200 || checks.Load() != 0 {
		t.Fatalf("events checked Pi: %d checks=%d", response.StatusCode, checks.Load())
	}
}
