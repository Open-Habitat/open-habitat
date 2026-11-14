//go:build linux

package gateway

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Reading keys or own machines needs a session; a write also needs the
// write proof, and nothing refused reaches the daemon.
func TestAccountKeysRelayRequiresSessionAndCSRF(t *testing.T) {
	// Short subtest names: the daemon socket lives in the test's directory.
	t.Run("k", func(t *testing.T) { personalRelayRequiresSessionAndCSRF(t, accountKeysPath, `{"kind":"ssh"}`) })
	t.Run("m", func(t *testing.T) { personalRelayRequiresSessionAndCSRF(t, ownMachinesPath, `{"action":"connect"}`) })
	t.Run("s", func(t *testing.T) { personalRelayRequiresSessionAndCSRF(t, storageBreakdownPath, `{"measure":true}`) })
}

func personalRelayRequiresSessionAndCSRF(t *testing.T, path, body string) {
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
		{"POST", "", "token", "https://host.test", "browser", body, 200},
		{"POST", "", "", "https://host.test", "browser", body, 403},
		{"POST", "", "token", "https://other.test", "browser", body, 403},
		{"POST", "", "token", "https://host.test", "", body, 401},
		{"PUT", "", "token", "https://host.test", "browser", body, 400},
		{"DELETE", "", "token", "https://host.test", "browser", "", 400},
		{"GET", "?home=/root", "", "", "browser", "", 400},
		{"POST", "", "token", "https://host.test", "browser", strings.Repeat("x", 513), 400},
	} {
		r := httptest.NewRequest(tc.method, "https://host.test"+path+tc.suffix, strings.NewReader(tc.body))
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
