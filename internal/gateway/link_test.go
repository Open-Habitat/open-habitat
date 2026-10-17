package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const iphoneUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

type linkDesk struct {
	h      http.Handler
	a      *Auth
	now    *time.Time
	cookie *http.Cookie
	csrf   string
}

func signedInDesk(t *testing.T) linkDesk {
	t.Helper()
	h, a, _, _, now := fixture(t)
	state, flow := start(t, h)
	cookie := callback(h, state, flow).Result().Cookies()[1]
	return linkDesk{h, a, now, cookie, extractCSRF(t, request(h, "GET", "/auth/session", cookie).Body.String())}
}

// call sends a browser request; cookie and csrf are optional.
func (d linkDesk) call(method, path, body string, cookie *http.Cookie, csrf string, tweak ...func(*http.Request) *http.Request) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "https://host.test"+path, strings.NewReader(body))
	if body == "" {
		r = httptest.NewRequest(method, "https://host.test"+path, nil)
	} else {
		r.Header.Set("Content-Type", "application/json")
	}
	r.Header.Set("Origin", "https://host.test")
	r.Header.Set("User-Agent", iphoneUA)
	if cookie != nil {
		r.AddCookie(cookie)
	}
	if csrf != "" {
		r.Header.Set("X-Agent-Host-CSRF", csrf)
	}
	for _, f := range tweak {
		r = f(r)
	}
	w := httptest.NewRecorder()
	d.h.ServeHTTP(w, r)
	return w
}
func (d linkDesk) mint(t *testing.T) string {
	t.Helper()
	w := d.call("POST", "/auth/link", "", d.cookie, d.csrf)
	var v struct {
		Token   string `json:"token"`
		Expires int    `json:"expires_in_seconds"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil || len(v.Token) != 43 || v.Expires != 60 {
		t.Fatalf("mint %d %s", w.Code, w.Body.String())
	}
	return v.Token
}
func tokenBody(token string) string { return `{"token":"` + token + `"}` }

// redeem returns the phone's session cookie, or nil with the status.
func (d linkDesk) redeem(token string, tweak ...func(*http.Request) *http.Request) (*http.Cookie, int) {
	w := d.call("POST", "/auth/link/redeem", tokenBody(token), nil, "", tweak...)
	for _, c := range w.Result().Cookies() {
		if c.Name == cookieName && c.Value != "" {
			return c, w.Code
		}
	}
	return nil, w.Code
}
func (d linkDesk) status(t *testing.T) map[string]any {
	t.Helper()
	w := d.call("GET", "/auth/link", "", d.cookie, "")
	var v map[string]any
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil {
		t.Fatalf("status %d", w.Code)
	}
	return v
}

func TestDeviceLinkRedeemsOnceIntoOwnSession(t *testing.T) {
	d := signedInDesk(t)
	token := d.mint(t)
	// Describing shows whose account it is without using the code up.
	described := d.call("POST", "/auth/link/describe", tokenBody(token), nil, "")
	if described.Code != 200 || !strings.Contains(described.Body.String(), `"profile"`) {
		t.Fatalf("describe %d %s", described.Code, described.Body.String())
	}
	phone, code := d.redeem(token)
	if phone == nil || code != 204 || phone.Value == d.cookie.Value || !phone.HttpOnly || !phone.Secure {
		t.Fatalf("redeem %d", code)
	}
	if again, code := d.redeem(token); again != nil || code != 403 {
		t.Fatalf("second redemption accepted: %d", code)
	}
	if request(d.h, "GET", "/auth/session", phone).Code != 200 {
		t.Fatal("phone session missing")
	}
	// The desktop sees which device used its code; the code is gone.
	st := d.status(t)
	used, _ := st["session"].(map[string]any)
	if st["state"] != "used" || used["device"] != "iPhone · Safari" || used["device_kind"] != "phone" {
		t.Fatalf("status %v", st)
	}
	// Ending the desktop does not end the phone.
	if d.call("POST", "/auth/logout", "", d.cookie, d.csrf).Code != 204 || request(d.h, "GET", "/auth/session", phone).Code != 200 {
		t.Fatal("phone session tied to parent")
	}
}

func TestDeviceLinkExpiresAfterSixtySeconds(t *testing.T) {
	d := signedInDesk(t)
	token := d.mint(t)
	*d.now = d.now.Add(59 * time.Second)
	if d.call("POST", "/auth/link/describe", tokenBody(token), nil, "").Code != 200 {
		t.Fatal("live code refused")
	}
	*d.now = d.now.Add(time.Second)
	if c, code := d.redeem(token); c != nil || code != 403 {
		t.Fatalf("expired code accepted: %d", code)
	}
	if st := d.status(t); st["state"] != "expired" && st["state"] != "failed" {
		t.Fatalf("status %v", st)
	}
}

// A failed redemption also uses the code up: a later correct attempt fails.
func TestDeviceLinkFailedRedemptionConsumesToken(t *testing.T) {
	d := signedInDesk(t)
	token := d.mint(t)
	withEmail := func(r *http.Request) *http.Request {
		return r.WithContext(context.WithValue(r.Context(), accessContextKey{}, "other@example.invalid"))
	}
	if c, code := d.redeem(token, withEmail); c != nil || code != 403 {
		t.Fatalf("Access email mismatch accepted: %d", code)
	}
	if c, code := d.redeem(token); c != nil || code != 403 {
		t.Fatalf("consumed code accepted: %d", code)
	}
	if st := d.status(t); st["state"] != "failed" {
		t.Fatalf("status %v", st)
	}
}

func TestDeviceLinkOriginAndCSRF(t *testing.T) {
	d := signedInDesk(t)
	if w := d.call("POST", "/auth/link", "", d.cookie, ""); w.Code != 403 {
		t.Fatalf("mint without CSRF: %d", w.Code)
	}
	token := d.mint(t)
	crossSite := func(r *http.Request) *http.Request { r.Header.Set("Origin", "https://evil.test"); return r }
	if c, code := d.redeem(token, crossSite); c != nil || code != 403 {
		t.Fatalf("cross-site redemption: %d", code)
	}
	if w := d.call("POST", "/auth/link/describe", tokenBody(token), nil, "", crossSite); w.Code != 403 {
		t.Fatalf("cross-site describe: %d", w.Code)
	}
	// The Origin check runs before the token is read, so the code still works.
	if c, _ := d.redeem(token); c == nil {
		t.Fatal("same-origin redemption refused")
	}
}

func TestDeviceLinkDiesWithParentAndRevocation(t *testing.T) {
	t.Run("logout", func(t *testing.T) {
		d := signedInDesk(t)
		token := d.mint(t)
		if d.call("POST", "/auth/logout", "", d.cookie, d.csrf).Code != 204 {
			t.Fatal("logout")
		}
		if c, code := d.redeem(token); c != nil || code != 403 {
			t.Fatalf("orphaned code accepted: %d", code)
		}
	})
	t.Run("subject revocation", func(t *testing.T) {
		d := signedInDesk(t)
		token := d.mint(t)
		if err := d.a.RevokeSubject(context.Background(), "42"); err != nil {
			t.Fatal(err)
		}
		if c, code := d.redeem(token); c != nil || code != 403 {
			t.Fatalf("revoked code accepted: %d", code)
		}
	})
	t.Run("minting again", func(t *testing.T) {
		d := signedInDesk(t)
		first := d.mint(t)
		d.mint(t)
		if c, _ := d.redeem(first); c != nil {
			t.Fatal("replaced code accepted")
		}
	})
	t.Run("cancel", func(t *testing.T) {
		d := signedInDesk(t)
		token := d.mint(t)
		if d.call("POST", "/auth/link/cancel", "", d.cookie, d.csrf).Code != 204 {
			t.Fatal("cancel")
		}
		if c, _ := d.redeem(token); c != nil {
			t.Fatal("cancelled code accepted")
		}
	})
	t.Run("broker binding changed", func(t *testing.T) {
		d := signedInDesk(t)
		token := d.mint(t)
		d.a.broker.(*fakeBroker).routes["42"] = BrokerRoute{UID: 1003, Username: "carol", Socket: "/run/open-habitat/users/carol/daemon.sock"}
		if c, _ := d.redeem(token); c != nil {
			t.Fatal("rebound subject accepted")
		}
	})
}

// A QR-made session must not pass native disconnect's "GitHub sign-in within
// five minutes" check, although the session itself is brand new.
func TestDeviceLinkSessionIsNotARecentGitHubSignIn(t *testing.T) {
	d := signedInDesk(t)
	*d.now = d.now.Add(10 * time.Minute)
	phone, _ := d.redeem(d.mint(t))
	if phone == nil {
		t.Fatal("redeem")
	}
	d.a.mu.Lock()
	var linked session
	for _, s := range d.a.sessions {
		if s.method == "link" {
			linked = s
		}
	}
	d.a.mu.Unlock()
	if linked.created != *d.now || recentGitHubSignIn(linked, *d.now) {
		t.Fatalf("link session counted as recent GitHub sign-in: %+v", linked.githubAt)
	}
}

func TestSessionListAndPerSessionSignOut(t *testing.T) {
	d := signedInDesk(t)
	phone, _ := d.redeem(d.mint(t))
	// Bob's session must stay invisible and unreachable to Alice.
	d.a.broker.(*fakeBroker).hook = nil
	bobState, bobFlow := start(t, d.h)
	d.a.provider.(*fakeProvider).id, d.a.provider.(*fakeProvider).login = "43", "bob"
	bob := callback(d.h, bobState, bobFlow).Result().Cookies()[1]
	list := d.call("GET", "/auth/sessions", "", d.cookie, "")
	var v struct {
		Sessions []struct {
			ID, Method, Device string
			Current            bool
		} `json:"sessions"`
	}
	if list.Code != 200 || json.Unmarshal(list.Body.Bytes(), &v) != nil || len(v.Sessions) != 2 {
		t.Fatalf("list %d %s", list.Code, list.Body.String())
	}
	var phoneID string
	for _, s := range v.Sessions {
		if s.Method == "link" && !s.Current {
			phoneID = s.ID
		}
	}
	if phoneID == "" {
		t.Fatalf("list %+v", v.Sessions)
	}
	if strings.Contains(list.Body.String(), d.cookie.Value) || strings.Contains(list.Body.String(), phone.Value) {
		t.Fatal("cookie secret in session list")
	}
	bobCSRF := extractCSRF(t, request(d.h, "GET", "/auth/session", bob).Body.String())
	if w := d.call("POST", "/auth/sessions/end", `{"id":"`+phoneID+`"}`, bob, bobCSRF); w.Code != 404 {
		t.Fatalf("another person ended a session: %d", w.Code)
	}
	if w := d.call("POST", "/auth/sessions/end", `{"id":"`+phoneID+`"}`, d.cookie, ""); w.Code != 403 {
		t.Fatalf("end without CSRF: %d", w.Code)
	}
	if w := d.call("POST", "/auth/sessions/end", `{"id":"`+phoneID+`"}`, d.cookie, d.csrf); w.Code != 204 {
		t.Fatalf("end %d", w.Code)
	}
	if request(d.h, "GET", "/auth/session", phone).Code != 401 || request(d.h, "GET", "/auth/session", d.cookie).Code != 200 || request(d.h, "GET", "/auth/session", bob).Code != 200 {
		t.Fatal("per-session sign-out ended the wrong sessions")
	}
}

// The persisted record keeps the list fields; an older format is discarded.
func TestSessionStoreVersionTwo(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sessions.json")
	if err := os.WriteFile(path, []byte(`{"version":1,"sessions":{}}`), 0600); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 17, 0, 0, 0, 0, time.UTC)
	var logs bytes.Buffer
	opts := AuthOptions{Provider: &fakeProvider{token: "t", id: "42", login: "alice"}, Sink: &fakeSink{}, Broker: newFakeBroker(), Now: func() time.Time { return now }, SessionFile: path, Log: CallbackLogger(&logs)}
	cfg := OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}
	a, err := NewAuth(cfg, opts)
	if err != nil || !strings.Contains(logs.String(), "session_store_discarded") {
		t.Fatalf("version 1 store not discarded: %v %s", err, logs.String())
	}
	h := NewWithAuth("", a)
	state, flow := start(t, h)
	cookie := callback(h, state, flow).Result().Cookies()[1]
	d := linkDesk{h, a, &now, cookie, extractCSRF(t, request(h, "GET", "/auth/session", cookie).Body.String())}
	phone, _ := d.redeem(d.mint(t))
	if phone == nil {
		t.Fatal("redeem")
	}
	restarted, err := NewAuth(cfg, opts)
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range restarted.sessions {
		if s.method == "link" && (s.device != "iPhone · Safari" || !s.githubAt.Before(s.created.Add(time.Nanosecond)) || !validSessionID(s.id)) {
			t.Fatalf("link session fields lost: %+v", s)
		}
	}
	if len(restarted.sessions) != 2 || request(NewWithAuth("", restarted), "GET", "/auth/session", phone).Code != 200 {
		t.Fatal("sessions not restored")
	}
}

func TestDeviceLabelVocabulary(t *testing.T) {
	for ua, want := range map[string]string{
		iphoneUA: "iPhone · Safari",
		"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36":                      "Android · Chrome",
		"Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36": "Android · Samsung Internet",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0":            "macOS · Edge",
		"Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0":                                                                 "Linux · Firefox",
		"<script>alert(1)</script>": "",
	} {
		if got := deviceLabel(ua); got != want || !knownDevice(got) {
			t.Errorf("%q: %q", ua, got)
		}
	}
	if knownDevice("Evil · Browser") {
		t.Fatal("label outside the vocabulary accepted")
	}
}
