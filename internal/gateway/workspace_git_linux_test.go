//go:build linux

package gateway

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Hae etärepo is a write: the gateway forwards it only with the session's
// CSRF and Origin, and never as a GET or with a query.
func TestWorkspaceGitFetchRequiresSessionAndCSRF(t *testing.T) {
	const path = "/api/v1/workspaces/git/fetch"
	calls := 0
	host, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method != "POST" || r.URL.Path != path || r.Header.Get("X-Agent-Host-Identity") != "" {
			t.Errorf("forwarded %s %s", r.Method, r.URL)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	call := func(method, target, body string, csrf bool) int {
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
	body := `{"workspace_id":"ws_example123"}`
	if code := call("POST", path, body, true); code != 200 {
		t.Fatalf("write: %d", code)
	}
	if code := call("POST", path, body, false); code != 403 {
		t.Fatalf("without CSRF: %d", code)
	}
	if code := call("GET", path, "", true); code != 400 {
		t.Fatalf("GET: %d", code)
	}
	if code := call("POST", path+"?remote=x", body, true); code != 400 {
		t.Fatalf("query: %d", code)
	}
	if calls != 1 {
		t.Fatalf("proxied %d requests", calls)
	}
}
