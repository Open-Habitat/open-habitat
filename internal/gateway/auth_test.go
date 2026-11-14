package gateway

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"

	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"
)

type fakeProvider struct {
	calls            int
	code, verifier   string
	token, id, login string
	err              error
	authorization    string
}

func (f *fakeProvider) AuthorizationURL(state, challenge string, extraScopes []string) string {
	f.authorization = "https://github.com/login/oauth/authorize?" + url.Values{"state": {state}, "code_challenge": {challenge}, "code_challenge_method": {"S256"}}.Encode()
	return f.authorization
}
func (f *fakeProvider) Exchange(_ context.Context, code, verifier string) (string, string, string, error) {
	f.calls++
	f.code = code
	f.verifier = verifier
	return f.token, f.id, f.login, f.err
}

type fakeSink struct {
	calls     int
	identity  Identity
	id, token string
	err       error
	// handoff is the daemon's answer; empty answers in use.
	handoff Handoff
}

func (f *fakeSink) Deliver(_ context.Context, m Identity, id, token string) (Handoff, error) {
	f.calls++
	f.identity = m
	f.id = id
	f.token = token
	if f.err != nil {
		return "", f.err
	}
	if f.handoff == "" {
		return HandoffInUse, nil
	}
	return f.handoff, nil
}
func fixture(t *testing.T) (http.Handler, *Auth, *fakeProvider, *fakeSink, *time.Time) {
	t.Helper()
	now := time.Date(2026, 9, 23, 0, 0, 0, 0, time.UTC)
	p := &fakeProvider{token: strings.Repeat("Z", 64), id: "42", login: "alice"}
	s := &fakeSink{}
	a, e := NewAuth(OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: p, Sink: s, Broker: newFakeBroker(), Now: func() time.Time { return now }})
	if e != nil {
		t.Fatal(e)
	}
	return NewWithAuth("", a), a, p, s, &now
}
func request(h http.Handler, method, path string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "https://host.test"+path, nil)
	for _, c := range cookies {
		r.AddCookie(c)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}
func start(t *testing.T, h http.Handler) (string, *http.Cookie) {
	t.Helper()
	w := request(h, "GET", "/auth/github/start")
	if w.Code != 302 {
		t.Fatalf("start: %d", w.Code)
	}
	u, e := url.Parse(w.Header().Get("Location"))
	if e != nil {
		t.Fatal(e)
	}
	return u.Query().Get("state"), w.Result().Cookies()[0]
}
func callback(h http.Handler, state string, c *http.Cookie) *httptest.ResponseRecorder {
	return request(h, "GET", "/auth/github/callback?state="+url.QueryEscape(state)+"&code=synthetic-code", c)
}
func TestOAuthSession(t *testing.T) {
	t.Run("PKCE, mapping, rotation, logout and redaction", func(t *testing.T) {
		h, _, p, s, now := fixture(t)
		state, flow := start(t, h)
		u, _ := url.Parse(p.authorization)
		if len(state) < 40 || u.Query().Get("code_challenge_method") != "S256" {
			t.Fatal("PKCE/state absent")
		}
		w := callback(h, state, flow)
		if w.Code != 303 || s.calls != 1 || s.identity.UID != 1001 || s.id != "42" || p.code != "synthetic-code" {
			t.Fatalf("callback %d calls %d", w.Code, s.calls)
		}
		sum := sha256.Sum256([]byte(p.verifier))
		if u.Query().Get("code_challenge") != base64.RawURLEncoding.EncodeToString(sum[:]) {
			t.Fatal("PKCE mismatch")
		}
		sessionCookie := w.Result().Cookies()[1]
		if sessionCookie.Name != cookieName || !sessionCookie.Secure || !sessionCookie.HttpOnly || sessionCookie.SameSite != http.SameSiteLaxMode || sessionCookie.Path != "/" || sessionCookie.Value == s.token {
			t.Fatal("cookie policy")
		}
		for _, body := range []string{w.Body.String(), w.Header().Get("Location"), sessionCookie.Value} {
			if strings.Contains(body, s.token) {
				t.Fatal("token leaked")
			}
		}
		if callback(h, state, flow).Code == 303 || s.calls != 1 {
			t.Fatal("state replay")
		}
		info := request(h, "GET", "/auth/session", sessionCookie)
		if info.Code != 200 {
			t.Fatal("session missing")
		}
		csrf := info.Body.String()
		if strings.Contains(csrf, s.token) || strings.Contains(csrf, s.identity.Socket) {
			t.Fatal("session leaked")
		}
		// The browser pairs this read with a snapshot by the identity the
		// proxy also presents to the daemon.
		var shown struct {
			WebIdentityID string `json:"web_identity_id"`
		}
		if json.Unmarshal(info.Body.Bytes(), &shown) != nil || shown.WebIdentityID != identityID(s.identity) || !strings.HasPrefix(shown.WebIdentityID, "wid_") {
			t.Fatal("session identity")
		}
		r := httptest.NewRequest("POST", "https://host.test/auth/logout", nil)
		r.AddCookie(sessionCookie)
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("X-Agent-Host-CSRF", extractCSRF(t, csrf))
		logout := httptest.NewRecorder()
		h.ServeHTTP(logout, r)
		if logout.Code != 204 || request(h, "GET", "/auth/session", sessionCookie).Code != 401 {
			t.Fatal("logout failed")
		}
		_ = now
	})
	t.Run("single use mismatch expiry provider error unknown mapping and partial handoff", func(t *testing.T) {
		for _, tc := range []string{"wrong-browser", "expired", "provider-error", "unknown", "handoff-error", "error-parameter", "duplicate-code"} {
			t.Run(tc, func(t *testing.T) {
				h, _, p, s, now := fixture(t)
				state, c := start(t, h)
				switch tc {
				case "wrong-browser":
					c.Value = "attacker"
				case "expired":
					*now = now.Add(6 * time.Minute)
				case "provider-error":
					p.err = errors.New(strings.Repeat("Z", 64))
				case "unknown":
					p.id = "44"
				case "handoff-error":
					s.err = errors.New(strings.Repeat("Z", 64))
				}
				var w *httptest.ResponseRecorder
				if tc == "error-parameter" {
					w = request(h, "GET", "/auth/github/callback?state="+state+"&error=denied", c)
				} else if tc == "duplicate-code" {
					w = request(h, "GET", "/auth/github/callback?state="+state+"&code=x&code=y", c)
				} else {
					w = callback(h, state, c)
				}
				if w.Code == 303 || request(h, "GET", "/auth/session", w.Result().Cookies()...).Code == 200 || strings.Contains(w.Body.String(), strings.Repeat("Z", 64)) {
					t.Fatal("fail open or secret leaked")
				}
				if callback(h, state, c).Code == 303 || s.calls > 1 {
					t.Fatal("retried after failure")
				}
				if tc == "wrong-browser" || tc == "expired" || tc == "error-parameter" || tc == "duplicate-code" {
					if p.calls != 0 {
						t.Fatal("exchange after invalid callback")
					}
				}
			})
		}
	})
	t.Run("cross mapping hints ignored", func(t *testing.T) {
		h, _, _, s, _ := fixture(t)
		state, c := start(t, h)
		w := request(h, "GET", "/auth/github/callback?state="+state+"&code=x&uid=1002", c)
		if w.Code == 303 || s.calls != 0 {
			t.Fatal("accepted browser UID")
		}
	})
	t.Run("csrf origin and expiry", func(t *testing.T) {
		h, a, _, _, now := fixture(t)
		state, c := start(t, h)
		w := callback(h, state, c)
		sid := w.Result().Cookies()[1]
		sess := request(h, "GET", "/auth/session", sid)
		csrf := extractCSRF(t, sess.Body.String())
		for _, tc := range []struct {
			origin, csrf string
			want         int
		}{{"", csrf, 403}, {"https://evil.test", csrf, 403}, {"https://host.test", "wrong", 403}, {"https://host.test", csrf, 204}} {
			r := httptest.NewRequest("POST", "https://host.test/auth/logout", nil)
			r.AddCookie(sid)
			if tc.origin != "" {
				r.Header.Set("Origin", tc.origin)
			}
			r.Header.Set("X-Agent-Host-CSRF", tc.csrf)
			out := httptest.NewRecorder()
			h.ServeHTTP(out, r)
			if out.Code != tc.want {
				t.Fatalf("logout %d want %d", out.Code, tc.want)
			}
		}
		state, c = start(t, h)
		w = callback(h, state, c)
		sid = w.Result().Cookies()[1]
		*now = now.Add(sessionIdle)
		if request(h, "GET", "/auth/session", sid).Code != 401 {
			t.Fatal("idle expiry")
		}
		_ = a
	})
	t.Run("no optional provider request without selection", func(t *testing.T) {
		h, _, p, _, _ := fixture(t)
		w := request(h, "GET", "/auth/google/start")
		if w.Code != 404 || p.calls != 0 || p.authorization != "" {
			t.Fatal("implicit provider contact")
		}
	})
}

// The issuer-bearing GitHub callback must traverse the same PKCE, broker,
// token handoff and session path as the original issuer-less callback.
func TestGitHubIssuerCallbackProgression(t *testing.T) {
	h, a, p, sink, _ := fixture(t)
	broker := newFakeBroker()
	var operations []string
	broker.hook = func(r BrokerRequest) { operations = append(operations, r.Operation) }
	a.broker = broker
	state, flow := start(t, h)
	startURL, err := url.Parse(p.authorization)
	if err != nil {
		t.Fatal(err)
	}
	w := request(h, "GET", "/auth/github/callback?"+url.Values{
		"state": {state}, "code": {"synthetic-code"}, "iss": {githubOAuthIssuer},
	}.Encode(), flow)
	if w.Code != http.StatusSeeOther || p.calls != 1 || p.code != "synthetic-code" ||
		!reflect.DeepEqual(operations, []string{"ensure", "authorize"}) || sink.calls != 1 ||
		sink.id != "42" || sink.token != p.token || sink.identity.UID != 1001 {
		t.Fatalf("issuer callback did not complete: status=%d provider=%d broker=%v sink=%d", w.Code, p.calls, operations, sink.calls)
	}
	sum := sha256.Sum256([]byte(p.verifier))
	if startURL.Query().Get("code_challenge_method") != "S256" || startURL.Query().Get("code_challenge") != base64.RawURLEncoding.EncodeToString(sum[:]) {
		t.Fatal("issuer callback lost PKCE binding")
	}
	cookies := w.Result().Cookies()
	if len(cookies) != 2 || cookies[1].Name != cookieName || request(h, "GET", "/auth/session", cookies[1]).Code != 200 {
		t.Fatal("issuer callback did not create session")
	}
	if request(h, "GET", "/auth/github/callback?"+url.Values{"state": {state}, "code": {"synthetic-code"}, "iss": {githubOAuthIssuer}}.Encode(), flow).Code == 303 || p.calls != 1 || sink.calls != 1 {
		t.Fatal("issuer callback replay reached provider")
	}
}
func extractCSRF(t *testing.T, body string) string {
	t.Helper()
	var v struct {
		CSRF string `json:"csrf"`
	}
	if e := json.Unmarshal([]byte(body), &v); e != nil || v.CSRF == "" {
		t.Fatal("no csrf")
	}
	return v.CSRF
}

type fakeBroker struct {
	mu                sync.Mutex
	routes            map[string]BrokerRoute
	epoch, generation uint64
	fail              bool
	hook              func(BrokerRequest)
	// unbound subjects get created once, by their first ensure, as the
	// broker reports it.
	unbound map[string]bool
}

func newFakeBroker() *fakeBroker {
	return &fakeBroker{routes: map[string]BrokerRoute{"42": {UID: 1001, Username: "alice", Socket: "/run/open-habitat/users/alice/daemon.sock"}, "43": {UID: 1002, Username: "bob", Socket: "/run/open-habitat/users/bob/daemon.sock"}}, epoch: 1, generation: 1}
}
func (b *fakeBroker) Exchange(_ context.Context, r BrokerRequest) (BrokerReply, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.hook != nil {
		b.hook(r)
	}
	if b.fail {
		return BrokerReply{}, errors.New("broker down")
	}
	route, ok := b.routes[r.ID]
	if !ok {
		return BrokerReply{}, nil
	}
	created := r.Operation == "ensure" && b.unbound[r.ID]
	if created {
		delete(b.unbound, r.ID)
	}
	return BrokerReply{Route: &route, Epoch: b.epoch, Generation: b.generation, Created: created}, nil
}
