//go:build linux

package gateway

import (
	"io"
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

// Icon suggestions spend the person's model credentials: the gateway relays
// them only as a write with the session's CSRF proof and Origin, never as a
// GET or with a query.
func TestWorkspaceIconSuggestionsRequireCSRF(t *testing.T) {
	body := `{"schema_version":1,"workspace_id":"ws_example123","wish":"","history":[]}`
	calls := 0
	host, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		forwarded, err := io.ReadAll(r.Body)
		if err != nil || r.Method != "POST" || r.URL.Path != workspaceIconSuggestionsPath || string(forwarded) != body {
			t.Errorf("forwarded %s %s %q %v", r.Method, r.URL, forwarded, err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	call := func(method, target string, csrf bool) int {
		r := httptest.NewRequest(method, "https://host.test"+target, strings.NewReader(body))
		r.RequestURI = target
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("Content-Type", "application/json")
		if csrf {
			r.Header.Set("X-Agent-Host-CSRF", "token")
		}
		w := httptest.NewRecorder()
		host.ServeHTTP(w, r)
		return w.Code
	}
	if code := call("POST", workspaceIconSuggestionsPath, true); code != 200 {
		t.Fatalf("write: %d", code)
	}
	if code := call("POST", workspaceIconSuggestionsPath, false); code != 403 {
		t.Fatalf("without CSRF: %d", code)
	}
	for _, bad := range []struct{ method, target string }{{"GET", workspaceIconSuggestionsPath}, {"POST", workspaceIconSuggestionsPath + "?x=1"}} {
		if code := call(bad.method, bad.target, true); code != 400 {
			t.Fatalf("%s %s: %d", bad.method, bad.target, code)
		}
	}
	if calls != 1 {
		t.Fatalf("proxied %d requests", calls)
	}
	// The proxy must preserve the entire route budget; the daemon owns JSON
	// validation. Whitespace pads a valid request without changing its shape.
	body += strings.Repeat(" ", 98304-len(body))
	if code := call("POST", workspaceIconSuggestionsPath, true); code != 200 {
		t.Fatalf("maximum body: %d", code)
	}
	body += " "
	if code := call("POST", workspaceIconSuggestionsPath, true); code != 400 || calls != 2 {
		t.Fatalf("oversized body: %d, calls %d", code, calls)
	}
}
