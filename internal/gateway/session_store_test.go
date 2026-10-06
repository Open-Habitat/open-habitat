package gateway

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestPersistentSessions(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	path := filepath.Join(t.TempDir(), "sessions.json")
	cfg := OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}
	p := &fakeProvider{id: "42", login: "alice", token: "synthetic-token"}
	opts := AuthOptions{Provider: p, Sink: &fakeSink{}, Broker: newFakeBroker(), SessionFile: path, Now: func() time.Time { return now }}
	makeAuth := func() (*Auth, http.Handler) {
		t.Helper()
		a, e := NewAuth(cfg, opts)
		if e != nil {
			t.Fatal(e)
		}
		return a, NewWithAuth("", a)
	}
	_, h := makeAuth()
	state, flow := start(t, h)
	w := callback(h, state, flow)
	if w.Code != 303 {
		t.Fatalf("login: %d", w.Code)
	}
	cookie := w.Result().Cookies()[1]
	if cookie.Expires.IsZero() || !cookie.Expires.Equal(now.Add(sessionAbsolute)) {
		t.Fatal("persistent cookie absolute deadline")
	}
	b, e := os.ReadFile(path)
	if e != nil {
		t.Fatal(e)
	}
	if strings.Contains(string(b), cookie.Value) || strings.Contains(string(b), "synthetic-token") {
		t.Fatal("bearer or token on disk")
	}
	_, h = makeAuth()
	if request(h, "GET", "/auth/session", cookie).Code != 200 {
		t.Fatal("restart lost session")
	}
	old := b
	now = now.Add(2 * time.Hour)
	if request(h, "GET", "/auth/session", cookie).Code != 200 {
		t.Fatal("session denied")
	}
	b, _ = os.ReadFile(path)
	if string(b) != string(old) {
		t.Fatal("wrote on every request")
	}
	now = now.Add(25 * time.Hour)
	if request(h, "GET", "/auth/session", cookie).Code != 200 {
		t.Fatal("renewal denied")
	}
	b, _ = os.ReadFile(path)
	if string(b) == string(old) {
		t.Fatal("idle not renewed")
	}
	a, h := makeAuth()
	if request(h, "GET", "/auth/session", cookie).Code != 200 {
		t.Fatal("renewal not durable")
	}
	if err := a.RevokeSubject(context.Background(), "42"); err != nil {
		t.Fatal(err)
	}
	_, h = makeAuth()
	if request(h, "GET", "/auth/session", cookie).Code != 401 {
		t.Fatal("revocation not durable")
	}
	state, flow = start(t, h)
	w = callback(h, state, flow)
	cookie = w.Result().Cookies()[1]
	info := request(h, "GET", "/auth/session", cookie)
	csrf := extractCSRF(t, info.Body.String())
	r := httptest.NewRequest("POST", "https://host.test/auth/logout", nil)
	r.AddCookie(cookie)
	r.Header.Set("Origin", cfg.Origin)
	r.Header.Set("X-Agent-Host-CSRF", csrf)
	out := httptest.NewRecorder()
	h.ServeHTTP(out, r)
	if out.Code != 204 {
		t.Fatalf("logout: %d", out.Code)
	}
	_, h = makeAuth()
	if request(h, "GET", "/auth/session", cookie).Code != 401 {
		t.Fatal("logout not durable")
	}

}

func TestSessionStoreFailClosed(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sessions.json")
	cfg := OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}
	opts := AuthOptions{Provider: &fakeProvider{}, Sink: &fakeSink{}, Broker: newFakeBroker(), SessionFile: path}
	if _, e := NewAuth(cfg, opts); e != nil {
		t.Fatal(e)
	} // missing store means empty, never accepts cookie
	if e := os.WriteFile(path, []byte(`{"version":1,"sessions":{}}`), 0600); e != nil {
		t.Fatal(e)
	}
	if e := os.Chmod(path, 0644); e != nil {
		t.Fatal(e)
	}
	if _, e := NewAuth(cfg, opts); e == nil {
		t.Fatal("insecure store accepted")
	}
	if e := os.Chmod(path, 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := NewAuth(cfg, opts); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(path, []byte(`{"version":1,"sessions":{"invalid":{}}}`), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := NewAuth(cfg, opts); e == nil {
		t.Fatal("invalid records accepted")
	}
}

func TestPersistentExpiryAndMissingStore(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	path := filepath.Join(t.TempDir(), "sessions.json")
	cfg := OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}
	opts := AuthOptions{Provider: &fakeProvider{id: "42", login: "alice", token: "token"}, Sink: &fakeSink{}, Broker: newFakeBroker(), SessionFile: path, Now: func() time.Time { return now }}
	newHandler := func() http.Handler {
		t.Helper()
		a, e := NewAuth(cfg, opts)
		if e != nil {
			t.Fatal(e)
		}
		return NewWithAuth("", a)
	}
	h := newHandler()
	state, flow := start(t, h)
	w := callback(h, state, flow)
	cookie := w.Result().Cookies()[1]
	now = now.Add(sessionIdle)
	if request(h, "GET", "/auth/session", cookie).Code != 401 {
		t.Fatal("idle expiry not enforced")
	}
	h = newHandler()
	if request(h, "GET", "/auth/session", cookie).Code != 401 {
		t.Fatal("idle expiry revived")
	}
	state, flow = start(t, h)
	w = callback(h, state, flow)
	cookie = w.Result().Cookies()[1]
	for elapsed := 60 * 24 * time.Hour; elapsed < sessionAbsolute; elapsed += 60 * 24 * time.Hour {
		now = now.Add(60 * 24 * time.Hour)
		if request(h, "GET", "/auth/session", cookie).Code != 200 {
			t.Fatal("active session expired early")
		}
	}
	now = now.Add(sessionAbsolute - 6*60*24*time.Hour - time.Hour)
	if request(h, "GET", "/auth/session", cookie).Code != 200 {
		t.Fatal("pre-absolute denied")
	}
	before, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if request(h, "GET", "/auth/session", cookie).Code != 200 {
		t.Fatal("pre-absolute repeat denied")
	}
	after, err := os.Stat(path)
	if err != nil || !os.SameFile(before, after) {
		t.Fatal("rewrote capped idle deadline on every request", err)
	}
	now = now.Add(time.Hour)
	if request(h, "GET", "/auth/session", cookie).Code != 401 {
		t.Fatal("absolute expiry not enforced")
	}
	h = newHandler()
	state, flow = start(t, h)
	w = callback(h, state, flow)
	cookie = w.Result().Cookies()[1]
	if e := os.Remove(path); e != nil {
		t.Fatal(e)
	}
	// A fresh login must not republish the old memory snapshot after file loss.
	state, flow = start(t, h)
	if callback(h, state, flow).Code != 303 {
		t.Fatal("new login after file loss failed")
	}
	if request(h, "GET", "/auth/session", cookie).Code != 401 {
		t.Fatal("missing live store accepted")
	}
	h = newHandler()
	if request(h, "GET", "/auth/session", cookie).Code != 401 {
		t.Fatal("missing restart store accepted")
	}
}

type heldProfileBody struct {
	entered chan struct{}
	release chan struct{}
	reader  *strings.Reader
	once    sync.Once
}

func (b *heldProfileBody) Read(p []byte) (int, error) {
	b.once.Do(func() { close(b.entered) })
	<-b.release
	return b.reader.Read(p)
}

func TestProfileCannotRepublishLostSession(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sessions.json")
	cfg := OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}
	opts := AuthOptions{Provider: &fakeProvider{id: "42", login: "alice", token: "token"}, Sink: &fakeSink{}, Broker: newFakeBroker(), SessionFile: path}
	a, e := NewAuth(cfg, opts)
	if e != nil {
		t.Fatal(e)
	}
	h := NewWithAuth("", a)
	state, flow := start(t, h)
	login := callback(h, state, flow)
	cookie := login.Result().Cookies()[1]
	info := request(h, "GET", "/auth/session", cookie)
	csrf := extractCSRF(t, info.Body.String())
	bodyText := `{"name":"Alice","email":"alice@example.invalid"}`
	body := &heldProfileBody{entered: make(chan struct{}), release: make(chan struct{}), reader: strings.NewReader(bodyText)}
	r := httptest.NewRequest("POST", "https://host.test/auth/profile", body)
	r.ContentLength = int64(len(bodyText))
	r.AddCookie(cookie)
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Origin", cfg.Origin)
	r.Header.Set("X-Agent-Host-CSRF", csrf)
	result := make(chan int, 1)
	go func() { w := httptest.NewRecorder(); h.ServeHTTP(w, r); result <- w.Code }()
	<-body.entered
	if e := os.Remove(path); e != nil {
		t.Fatal(e)
	}
	close(body.release)
	if code := <-result; code != 401 {
		t.Fatalf("profile republished lost session: %d", code)
	}
	a, e = NewAuth(cfg, opts)
	if e != nil {
		t.Fatal(e)
	}
	if request(NewWithAuth("", a), "GET", "/auth/session", cookie).Code != 401 {
		t.Fatal("old cookie revived after restart")
	}
}
