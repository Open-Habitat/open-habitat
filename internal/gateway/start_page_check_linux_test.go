//go:build linux

package gateway

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestStartPageCheckSessionForwarding(t *testing.T) {
	body := `{"schema_version":1,"workspace_id":"ws_example123","content":"draft"}`
	calls := 0
	host, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		got, err := io.ReadAll(r.Body)
		if err != nil || string(got) != body || r.URL.Path != workspaceStartPageCheckPath {
			t.Errorf("forwarding mismatch")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
	}))
	call := func(method, target string, cookie, csrf bool) int {
		r := httptest.NewRequest(method, "https://host.test"+target, strings.NewReader(body))
		r.RequestURI = target
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("Content-Type", "application/json")
		if cookie {
			r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
		}
		if csrf {
			r.Header.Set("X-Agent-Host-CSRF", "token")
		}
		w := httptest.NewRecorder()
		host.ServeHTTP(w, r)
		return w.Code
	}
	for _, tc := range []struct {
		method, target string
		cookie, csrf   bool
		code           int
	}{
		{"POST", workspaceStartPageCheckPath, true, true, 200},
		{"POST", workspaceStartPageCheckPath, true, false, 403},
		{"POST", workspaceStartPageCheckPath, false, true, 401},
		{"POST", workspaceStartPageCheckPath + "?path=x", true, true, 400},
		{"GET", workspaceStartPageCheckPath, true, true, 400},
	} {
		if got := call(tc.method, tc.target, tc.cookie, tc.csrf); got != tc.code {
			t.Fatalf("%s: %d want %d", tc.target, got, tc.code)
		}
	}
	body += strings.Repeat(" ", 6*32*1024+1024-len(body))
	if got := call("POST", workspaceStartPageCheckPath, true, true); got != 200 {
		t.Fatalf("full envelope: %d", got)
	}
	body += " "
	if got := call("POST", workspaceStartPageCheckPath, true, true); got != 400 || calls != 2 {
		t.Fatalf("limit: %d calls %d", got, calls)
	}
}
