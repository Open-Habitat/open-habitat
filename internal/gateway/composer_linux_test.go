//go:build linux

package gateway

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The composer's reads and the `!` command routes reach the session's daemon
// only in their exact shape; the `!` write needs the CSRF proof like a send.
func TestComposerRoutesRelayExactShapes(t *testing.T) {
	var forwarded []string
	host, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		forwarded = append(forwarded, r.Method+" "+r.URL.RequestURI())
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	call := func(method, target string, csrf bool) int {
		body := ""
		if method == "POST" {
			body = `{"command":"ls","command_id":"4f6c2a9e-1d3b-4c8a-9e7f-0a1b2c3d4e5f"}`
		}
		r := httptest.NewRequest(method, "https://host.test"+target, strings.NewReader(body))
		r.RequestURI = target
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
		r.Header.Set("Origin", "https://host.test")
		if method == "POST" {
			r.Header.Set("Content-Type", "application/json")
		}
		if csrf {
			r.Header.Set("X-Agent-Host-CSRF", "token")
		}
		w := httptest.NewRecorder()
		host.ServeHTTP(w, r)
		return w.Code
	}
	const conversation = "/api/v1/conversations/4f6c2a9e-1d3b-4c8a-9e7f-0a1b2c3d4e5f"
	for _, ok := range []struct{ method, target string }{
		{"GET", "/api/v1/workspaces/commands?workspace_id=ws_example123"},
		{"GET", "/api/v1/workspaces/start_page?workspace_id=ws_example123"},
		{"GET", "/api/v1/workspaces/files?workspace_id=ws_example123"},
		{"GET", "/api/v1/workspaces/files?workspace_id=ws_example123&query=status"},
		{"GET", "/api/v1/workspaces/file_preview?workspace_id=ws_example123&path=docs%2Fa.md"},
		{"GET", conversation + "/commands"},
		{"POST", conversation + "/bash"},
		{"POST", conversation + "/abort_bash"},
	} {
		if code := call(ok.method, ok.target, true); code != 200 {
			t.Fatalf("%s %s: %d", ok.method, ok.target, code)
		}
	}
	for _, bad := range []struct{ method, target string }{
		{"GET", "/api/v1/workspaces/start_page"},
		{"GET", "/api/v1/workspaces/start_page?workspace_id=ws_example123&path=x"},
		{"POST", "/api/v1/workspaces/start_page?workspace_id=ws_example123"},
		{"GET", "/api/v1/workspaces/commands"},
		{"GET", "/api/v1/workspaces/commands?workspace_id=ws_example123&cwd=%2F"},
		{"GET", "/api/v1/workspaces/files?workspace_id=..%2Fx"},
		{"GET", "/api/v1/workspaces/files?workspace_id=ws_example123&path=x"},
		{"GET", "/api/v1/workspaces/file_preview?workspace_id=ws_example123"},
		{"POST", "/api/v1/workspaces/files?workspace_id=ws_example123"},
		{"POST", conversation + "/commands"},
		{"GET", conversation + "/bash"},
		{"POST", conversation + "/bash?cwd=x"},
	} {
		if code := call(bad.method, bad.target, true); code != 400 {
			t.Fatalf("%s %s: %d, want 400", bad.method, bad.target, code)
		}
	}
	if code := call("POST", conversation+"/bash", false); code != 403 {
		t.Fatalf("bash without CSRF: %d", code)
	}
	if len(forwarded) != 8 {
		t.Fatalf("forwarded %d: %q", len(forwarded), forwarded)
	}
}
