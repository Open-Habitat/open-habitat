//go:build linux

package gateway

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Reading keys needs a session; creating one also needs the write proof,
// and nothing refused reaches the daemon.
func TestAccountKeysRelayRequiresSessionAndCSRF(t *testing.T) {
	calls := 0
	host, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("Cookie") != "" || r.Header.Get("X-Unix-User") != "" {
			t.Error("forwarded browser authority")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{}`))
	}))
	for _, tc := range []struct {
		method, suffix, csrf, origin, cookie, body string
		status                                     int
	}{
		{"GET", "", "", "", "browser", "", 200},
		{"GET", "", "", "", "", "", 401},
		{"POST", "", "token", "https://host.test", "browser", `{"kind":"ssh"}`, 200},
		{"POST", "", "", "https://host.test", "browser", `{"kind":"ssh"}`, 403},
		{"POST", "", "token", "https://other.test", "browser", `{"kind":"ssh"}`, 403},
		{"POST", "", "token", "https://host.test", "", `{"kind":"ssh"}`, 401},
		{"PUT", "", "token", "https://host.test", "browser", `{"kind":"ssh"}`, 400},
		{"DELETE", "", "token", "https://host.test", "browser", "", 400},
		{"GET", "?home=/root", "", "", "browser", "", 400},
		{"POST", "", "token", "https://host.test", "browser", strings.Repeat("x", 129), 400},
	} {
		r := httptest.NewRequest(tc.method, "https://host.test"+accountKeysPath+tc.suffix, strings.NewReader(tc.body))
		if tc.cookie != "" {
			r.AddCookie(&http.Cookie{Name: cookieName, Value: tc.cookie})
		}
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", tc.origin)
		r.Header.Set("X-Agent-Host-CSRF", tc.csrf)
		r.Header.Set("X-Unix-User", "other")
		w := httptest.NewRecorder()
		host.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatalf("%+v: %d %s", tc, w.Code, w.Body.String())
		}
	}
	if calls != 2 {
		t.Fatalf("refused request reached daemon: %d", calls)
	}
}
