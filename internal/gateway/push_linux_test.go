//go:build linux

package gateway

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The phone-notification routes reach only the session's own daemon, writes
// need the session's CSRF proof, and nothing beyond each route's small body
// is forwarded.
func TestPushRoutesFenceWrites(t *testing.T) {
	var paths []string
	host, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.Method+" "+r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"schema_version":1}`))
	}))
	for _, tc := range []struct {
		method, path, body string
		status             int
	}{
		{"GET", "/api/v1/notifications/push", "", 200},
		{"POST", "/api/v1/notifications/push/key", "", 200},
		{"POST", "/api/v1/notifications/presence", "", 200},
		{"POST", "/api/v1/notifications/push/devices", `{"endpoint":"x"}`, 200},
		{"POST", "/api/v1/notifications/push/remove", `{"device_id":"pd_x"}`, 200},
		{"POST", "/api/v1/notifications/push/test", `{"device_id":"pd_x"}`, 200},
		{"POST", "/api/v1/notifications/push", "", 400},
		{"GET", "/api/v1/notifications/push/key", "", 400},
		{"GET", "/api/v1/notifications/push?uid=1", "", 400},
		{"POST", "/api/v1/notifications/presence", `{"x":1}`, 400},
		{"POST", "/api/v1/notifications/push/remove", `{"device_id":"` + strings.Repeat("a", 200) + `"}`, 400},
		{"POST", "/api/v1/notifications/push/devices", `{"endpoint":"` + strings.Repeat("a", 2100) + `"}`, 400},
	} {
		if w := proxyCall(host, tc.method, tc.path, tc.body); w.Code != tc.status {
			t.Errorf("%s %s: %d", tc.method, tc.path, w.Code)
		}
	}
	if w := proxyCall(host, "POST", "/api/v1/notifications/push/other", `{}`); w.Code == 200 {
		t.Error("unknown push route answered")
	}
	if len(paths) != 6 {
		t.Fatalf("proxied %v", paths)
	}
	r := httptest.NewRequest("POST", "https://host.test/api/v1/notifications/push/test", strings.NewReader(`{"device_id":"pd_x"}`))
	r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	host.ServeHTTP(w, r)
	if w.Code != 403 || len(paths) != 6 {
		t.Fatalf("write without CSRF: %d", w.Code)
	}
	r = httptest.NewRequest("GET", "https://host.test/api/v1/notifications/push", nil)
	w = httptest.NewRecorder()
	host.ServeHTTP(w, r)
	if w.Code != 401 {
		t.Fatalf("read without a session: %d", w.Code)
	}
}
