//go:build linux

package gateway

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// A search needs a session, carries only q, and reaches the person's own
// daemon with the query unchanged; nothing refused reaches a daemon.
func TestSearchRelay(t *testing.T) {
	calls := 0
	var seen string
	host, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		seen = r.URL.RawQuery
		if r.URL.Path != searchPath || r.Header.Get("Cookie") != "" || r.Header.Get("X-Unix-User") != "" {
			t.Errorf("forwarded %s with browser authority", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{}`))
	}))
	q := "q=" + url.QueryEscape("kartan välimuisti")
	for _, tc := range []struct {
		method, target, cookie string
		status                 int
	}{
		{"GET", "https://host.test/api/v1/search?" + q, "browser", 200},
		{"GET", "https://host.test/api/v1/search?" + q, "", 401},
		{"POST", "https://host.test/api/v1/search?" + q, "browser", 400},
		{"GET", "https://host.test/api/v1/search", "browser", 400},
		{"GET", "https://host.test/api/v1/search?q=a&q=b", "browser", 400},
		{"GET", "https://host.test/api/v1/search?" + q + "&user=other", "browser", 400},
		{"GET", "https://host.test/api/v1/search?q=" + strings.Repeat("a", 201), "browser", 400},
		{"GET", "https://host.test/api/v1/search/x?" + q, "browser", 501},
		{"GET", "https://other.test/api/v1/search?" + q, "browser", 421},
	} {
		r := httptest.NewRequest(tc.method, tc.target, nil)
		if tc.cookie != "" {
			r.AddCookie(&http.Cookie{Name: cookieName, Value: tc.cookie})
		}
		r.Header.Set("X-Unix-User", "other")
		w := httptest.NewRecorder()
		host.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatalf("%+v: %d %s", tc, w.Code, w.Body.String())
		}
	}
	if calls != 1 || seen != q {
		t.Fatalf("daemon calls = %d, query %q", calls, seen)
	}
}
