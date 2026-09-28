package gateway

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestAccessIngress(t *testing.T) {
	h, a, provider, sink, now := fixture(t)
	_ = h
	private, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	issuer := "https://team.cloudflareaccess.com"
	a.access, err = newAccessVerifier(&AccessConfig{Issuer: issuer, Audience: "app-audience"}, a.now)
	if err != nil {
		t.Fatal(err)
	}
	certs, _ := json.Marshal(map[string]any{"keys": []any{map[string]string{"kid": "synthetic", "kty": "RSA", "alg": "RS256", "n": base64.RawURLEncoding.EncodeToString(private.N.Bytes()), "e": base64.RawURLEncoding.EncodeToString([]byte{1, 0, 1})}}})
	calls := 0
	// Bounded synthetic JWKS response, not a live identity.
	a.access.client = &http.Client{Transport: accessRoundTrip(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.URL.String() != issuer+"/cdn-cgi/access/certs" {
			t.Errorf("wrong cert endpoint: %s", r.URL)
		}
		return &http.Response{StatusCode: 200, Body: ioNopCloser{strings.NewReader(string(certs))}, Header: http.Header{}}, nil
	})}
	handler := NewWithAuth("", a)
	sign := func(claims map[string]any, key *rsa.PrivateKey) string {
		t.Helper()
		header, _ := json.Marshal(map[string]string{"alg": "RS256", "kid": "synthetic"})
		body, _ := json.Marshal(claims)
		payload := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(body)
		hash := sha256.Sum256([]byte(payload))
		sig, e := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
		if e != nil {
			t.Fatal(e)
		}
		return payload + "." + base64.RawURLEncoding.EncodeToString(sig)
	}
	valid := func() map[string]any {
		return map[string]any{"iss": issuer, "aud": "app-audience", "exp": now.Add(time.Hour).Unix(), "email": "alice@example.invalid"}
	}
	send := func(path, token string, cookie *http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest("GET", "https://host.test"+path, nil)
		r.Header.Set("Cf-Access-Authenticated-User-Email", "alice@example.invalid")
		if token != "" {
			r.Header.Set("Cf-Access-Jwt-Assertion", token)
		}
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	if send("/auth/github/start", "", nil).Code != 403 || provider.authorization != "" {
		t.Fatal("spoofed email opened OAuth")
	}
	if send("/api/v1/snapshot", "", nil).Code != 403 || send("/workspaces", "", nil).Code != 403 {
		t.Fatal("unasserted route bypassed ingress")
	}
	if send("/healthz", "", nil).Code != 200 {
		t.Fatal("health probe gated")
	}
	for _, tc := range []struct {
		name     string
		mutate   func(map[string]any)
		wrongKey bool
	}{
		{"expired", func(c map[string]any) { c["exp"] = now.Add(-time.Second).Unix() }, false},
		{"issuer", func(c map[string]any) { c["iss"] = "https://other.cloudflareaccess.com" }, false},
		{"audience", func(c map[string]any) { c["aud"] = "other" }, false},
		{"email", func(c map[string]any) { delete(c, "email") }, false},
		{"invalid signature", func(map[string]any) {}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := valid()
			tc.mutate(c)
			key := private
			if tc.wrongKey {
				key, _ = rsa.GenerateKey(rand.Reader, 2048)
			}
			if send("/auth/github/start", sign(c, key), nil).Code != 403 {
				t.Fatal("admitted invalid assertion")
			}
		})
	}
	token := sign(valid(), private)
	started := send("/auth/github/start", token, nil)
	if started.Code != 302 {
		t.Fatalf("valid start: %d", started.Code)
	}
	location, _ := url.Parse(started.Header().Get("Location"))
	flow := started.Result().Cookies()[0]
	other := valid()
	other["email"] = "mallory@example.invalid"
	if send("/auth/github/callback?state="+location.Query().Get("state")+"&code=synthetic-code", sign(other, private), flow).Code == 303 || provider.calls != 0 {
		t.Fatal("Access identity switched during OAuth")
	}
	started = send("/auth/github/start", token, nil)
	location, _ = url.Parse(started.Header().Get("Location"))
	flow = started.Result().Cookies()[0]
	cb := send("/auth/github/callback?state="+location.Query().Get("state")+"&code=synthetic-code", token, flow)
	if cb.Code != 303 || sink.calls != 1 {
		t.Fatalf("valid callback: %d", cb.Code)
	}
	sessionCookie := cb.Result().Cookies()[1]
	if send("/auth/session", token, sessionCookie).Code != 200 {
		t.Fatal("valid session denied")
	}
	if send("/auth/session", "", sessionCookie).Code != 403 {
		t.Fatal("missing assertion admitted session")
	}
	if send("/auth/session", sign(other, private), sessionCookie).Code != 401 {
		t.Fatal("Access account switched session")
	}
	if calls != 1 {
		t.Fatalf("cert cache: %d fetches", calls)
	}
	*now = now.Add(2 * time.Hour)
	if send("/auth/session", token, sessionCookie).Code != 403 {
		t.Fatal("expired assertion admitted session")
	}
}

type accessRoundTrip func(*http.Request) (*http.Response, error)

func (f accessRoundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type ioNopCloser struct{ *strings.Reader }

func (ioNopCloser) Close() error { return nil }
