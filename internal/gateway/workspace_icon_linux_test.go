//go:build linux

package gateway

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The icon route relays only its exact shape, and every answer carries the
// sandbox policy and nosniff whatever the daemon sent.
func TestWorkspaceIconRelaysExactShapeAsInertImage(t *testing.T) {
	var forwarded []string
	host, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		forwarded = append(forwarded, r.URL.RequestURI())
		w.Header().Set("Content-Type", "image/svg+xml")
		_, _ = w.Write([]byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`))
	}))
	call := func(method, target string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "https://host.test"+target, nil)
		r.RequestURI = target
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
		w := httptest.NewRecorder()
		host.ServeHTTP(w, r)
		return w
	}
	for _, ok := range []string{
		"/api/v1/workspaces/icon?workspace_id=ws_example123",
		"/api/v1/workspaces/icon?workspace_id=ws_example123&v=0123456789abcdef",
		"/api/v1/workspaces/icon?workspace_id=ws_example123&v=0123456789abcdef&logo=1",
	} {
		w := call("GET", ok)
		if w.Code != 200 || w.Header().Get("Content-Type") != "image/svg+xml" || w.Header().Get("X-Content-Type-Options") != "nosniff" {
			t.Fatalf("%s: %d %v", ok, w.Code, w.Header())
		}
		policies := strings.Join(w.Header().Values("Content-Security-Policy"), "\n")
		if !strings.Contains(policies, "sandbox; default-src 'none'") || strings.Contains(policies, "script-src") {
			t.Fatalf("%s: policy %q", ok, policies)
		}
	}
	for _, bad := range []struct{ method, target string }{
		{"GET", "/api/v1/workspaces/icon"},
		{"GET", "/api/v1/workspaces/icon?workspace_id=..%2Fx"},
		{"GET", "/api/v1/workspaces/icon?workspace_id=ws_example123&path=logo.svg"},
		{"GET", "/api/v1/workspaces/icon?workspace_id=ws_example123&v=" + strings.Repeat("a", 65)},
		{"GET", "/api/v1/workspaces/icon?workspace_id=ws_example123&logo=0"},
		{"GET", "/api/v1/workspaces/icon?workspace_id=ws_example123&logo=1&logo=1"},
		{"POST", "/api/v1/workspaces/icon?workspace_id=ws_example123"},
	} {
		if w := call(bad.method, bad.target); w.Code != 400 {
			t.Fatalf("%s %s: %d, want 400", bad.method, bad.target, w.Code)
		}
	}
	if len(forwarded) != 3 {
		t.Fatalf("forwarded %d: %q", len(forwarded), forwarded)
	}
}
