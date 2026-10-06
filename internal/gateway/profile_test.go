package gateway

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAccountProfileSessionFallbackCannotChangeBinding(t *testing.T) {
	h, a, _, _, now := fixture(t)
	one := Identity{Provider: "github", Subject: "42", UID: 1001, Username: "alice", Socket: "/run/open-habitat/users/alice/daemon.sock"}
	two := Identity{Provider: "github", Subject: "43", UID: 1002, Username: "bob", Socket: "/run/open-habitat/users/bob/daemon.sock"}
	a.mu.Lock()
	a.sessions["one"] = session{identity: one, csrf: "csrf-one", profile: AccountProfile{AvatarURL: "https://avatars.githubusercontent.com/u/42"}, idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}
	a.sessions["two"] = session{identity: two, csrf: "csrf-two", profile: AccountProfile{Name: "Bob", Email: "bob@example.invalid"}, idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}
	a.mu.Unlock()
	call := func(cookie, csrf, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "https://host.test/auth/profile", strings.NewReader(body))
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("X-Agent-Host-CSRF", csrf)
		r.Header.Set("Content-Type", "application/json")
		r.AddCookie(&http.Cookie{Name: cookieName, Value: cookie})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := call("one", "csrf-two", `{"name":"Alice","email":"alice@example.invalid"}`); w.Code != 403 {
		t.Fatalf("cross-session csrf: %d", w.Code)
	}
	if w := call("one", "csrf-one", `{"name":"Alice","email":"alice@example.invalid","identity":"43"}`); w.Code != 400 {
		t.Fatalf("unexpected identity field: %d", w.Code)
	}
	if w := call("one", "csrf-one", `{"name":"Alice Example","email":"alice@example.invalid"}`); w.Code != 204 {
		t.Fatalf("fallback: %d %s", w.Code, w.Body)
	}
	if w := call("two", "csrf-two", `{"name":"Mallory","email":"bob@example.invalid"}`); w.Code != 400 {
		t.Fatalf("overwrote GitHub name: %d", w.Code)
	}
	req := httptest.NewRequest("GET", "https://host.test/auth/session", nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: "one"})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	var got struct {
		Profile AccountProfile `json:"profile"`
	}
	if json.Unmarshal(w.Body.Bytes(), &got) != nil || got.Profile.Name != "Alice Example" || got.Profile.Email != "alice@example.invalid" {
		t.Fatalf("session profile: %s", w.Body)
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.sessions["one"].identity != one || a.sessions["two"].identity != two || a.sessions["two"].profile.Name != "Bob" {
		t.Fatal("display update changed identity or other session")
	}
}
func TestNormalizeAccountProfile(t *testing.T) {
	p := normalizeProfile(AccountProfile{Name: " Ada Lovelace ", Email: "ada@example.invalid", AvatarURL: "https://evil.example/u/1"})
	if p.Name != "Ada Lovelace" || p.Email != "ada@example.invalid" || p.AvatarURL != "" {
		t.Fatalf("profile: %+v", p)
	}
	if p := normalizeProfile(AccountProfile{AvatarURL: "https://avatars.githubusercontent.com?v=4"}); p.AvatarURL != "" {
		t.Fatalf("avatar URL without path escaped: %+v", p)
	}
}
