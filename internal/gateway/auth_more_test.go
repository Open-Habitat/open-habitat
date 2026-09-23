package gateway

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestOAuthSessionAdmissionAndSweep(t *testing.T) {
	h, a, _, _, clock := fixture(t)
	for i := 0; i < 16; i++ {
		if request(h, "GET", "/auth/github/start").Code != 302 {
			t.Fatal("early admission failure")
		}
	}
	if request(h, "GET", "/auth/github/start").Code != 429 {
		t.Fatal("peer can exhaust global state")
	}
	*clock = clock.Add(time.Minute)
	if request(h, "GET", "/auth/github/start").Code != 302 {
		t.Fatal("bucket not refilled")
	}
	*clock = clock.Add(6 * time.Minute)
	state, c := start(t, h)
	if callback(h, state, c).Code != 303 {
		t.Fatal("login")
	}
	*clock = clock.Add(25 * time.Hour)
	state, c = start(t, h)
	if callback(h, state, c).Code != 303 {
		t.Fatal("second login")
	}
	a.mu.Lock()
	n := len(a.sessions)
	a.mu.Unlock()
	if n != 1 {
		t.Fatalf("abandoned session retained: %d", n)
	}
}
func TestOAuthSessionRejectsUnsafeMapping(t *testing.T) {
	_, _, p, s, _ := fixture(t)
	base := OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback", Identities: []Identity{{"github", "42", 1001, "alice", "/run/native-agent-host/alice.sock"}}}
	for _, m := range []Identity{{"github", "042", 1002, "bob", "/run/native-agent-host/bob.sock"}, {"github", "43", 1001, "bob", "/run/native-agent-host/bob.sock"}, {"github", "42", 1002, "bob", "/run/native-agent-host/bob.sock"}, {"github", "43", 1002, "bob", "/run/native-agent-host/../alice.sock"}, {"github", "43", 1002, "bob", "/tmp/bob.sock"}} {
		cfg := base
		cfg.Identities = append([]Identity{}, base.Identities...)
		cfg.Identities = append(cfg.Identities, m)
		if _, e := NewAuth(cfg, AuthOptions{Provider: p, Sink: s}); e == nil {
			t.Fatalf("accepted invalid mapping: %+v", m)
		}
	}
}
func TestOAuthSessionPlainTransportDenied(t *testing.T) {
	h, _, _, _, _ := fixture(t)
	r := httptest.NewRequest("GET", "http://host.test/auth/github/start", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 400 || !strings.Contains(w.Body.String(), "invalid_request") {
		t.Fatal("plain transport accepted")
	}
	if len(w.Result().Cookies()) != 0 {
		t.Fatal("insecure cookie")
	}
}
