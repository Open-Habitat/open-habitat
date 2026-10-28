package gateway

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestRoutesDoNotFallbackAPIToUI(t *testing.T) {
	static := t.TempDir()
	if err := os.Mkdir(filepath.Join(static, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	for path, content := range map[string]string{"index.html": "shell", "assets/app.js": "asset", "robots.txt": "User-agent: *\nDisallow: /\n"} {
		if err := os.WriteFile(filepath.Join(static, path), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	h := New(static)
	for _, tc := range []struct {
		path   string
		want   int
		body   string
		header bool
	}{{"/healthz", 200, "", false}, {"/api/v1/snapshot", 501, "", false}, {"/auth/session", 404, "", false}, {"/events", 404, "", false}, {"/not-a-route", 404, "", true}, {"/", 200, "shell", true}, {"/settings", 200, "shell", true}, {"/settings/agent-data", 200, "shell", true}, {"/settings/users", 200, "shell", true}, {"/workspaces/ws_abcdefgh", 200, "shell", true}, {"/assets/app.js", 200, "asset", true}, {"/robots.txt", 200, "User-agent: *\nDisallow: /\n", true}} {
		r := httptest.NewRequest(http.MethodGet, tc.path, nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Header().Get("Content-Security-Policy") != "frame-ancestors 'none'" || w.Header().Get("X-Frame-Options") != "DENY" {
			t.Errorf("%s: missing frame protection", tc.path)
		}
		if w.Code != tc.want {
			t.Errorf("%s: got %d want %d", tc.path, w.Code, tc.want)
		}
		if tc.body != "" && w.Body.String() != tc.body {
			t.Errorf("%s: got body %q want %q", tc.path, w.Body.String(), tc.body)
		}
		wantTag := ""
		if tc.header {
			wantTag = "noindex, nofollow, noarchive"
		}
		if got := w.Header().Get("X-Robots-Tag"); got != wantTag {
			t.Errorf("%s: X-Robots-Tag = %q, want %q", tc.path, got, wantTag)
		}
		wantCache := ""
		if tc.body == "shell" {
			wantCache = "no-store"
		}
		if got := w.Header().Get("Cache-Control"); got != wantCache {
			t.Errorf("%s: Cache-Control = %q, want %q", tc.path, got, wantCache)
		}
	}
	// HEAD returns the same static headers without content.
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodHead, "/workspaces/ws_abcdefgh", nil))
	if w.Code != http.StatusOK || w.Header().Get("X-Robots-Tag") != "noindex, nofollow, noarchive" || w.Body.Len() != 0 {
		t.Errorf("HEAD UI: status %d, tag %q, body %q", w.Code, w.Header().Get("X-Robots-Tag"), w.Body.String())
	}
}

func TestAuthenticatedFrameProtection(t *testing.T) {
	_, a, _, _, _ := fixture(t)
	a.access = &accessVerifier{}
	denied := httptest.NewRecorder()
	NewWithAuth("", a).ServeHTTP(denied, httptest.NewRequest("GET", "https://host.test/auth/session", nil))
	const noFrames = "frame-ancestors 'none'; frame-src 'none'"
	if denied.Code != 403 || denied.Header().Get("Content-Security-Policy") != noFrames || denied.Header().Get("X-Frame-Options") != "DENY" {
		t.Fatal("Access denial missing protection")
	}
	a.access = nil
	h := NewWithAuth("", a)
	for _, tc := range []struct{ method, path string }{
		{"GET", "/auth/session"}, {"POST", "/auth/logout"}, {"GET", "/auth/github/start"},
		{"GET", "/api/v1/snapshot"}, {"GET", "/missing"}, {"POST", "/healthz"}, {"GET", "/api//v1/snapshot"},
	} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(tc.method, "https://host.test"+tc.path, nil))
		if w.Header().Get("Content-Security-Policy") != noFrames || w.Header().Get("X-Frame-Options") != "DENY" {
			t.Errorf("%s %s: missing protection (%d)", tc.method, tc.path, w.Code)
		}
	}
}

// The app may frame only the view and editor namespaces, as narrowly as CSP's
// whole-label wildcard can name them, so a view cannot take its frame elsewhere.
func TestAppFramePolicy(t *testing.T) {
	for _, tc := range []struct{ view, editor, want string }{
		{"", "", "frame-ancestors 'none'; frame-src 'none'"},
		{"https://oh-view-*.example.org", "", "frame-ancestors 'none'; frame-src https://*.example.org"},
		{"https://*.views.example.org", "", "frame-ancestors 'none'; frame-src https://*.views.example.org"},
		{"", "https://code.example.org", "frame-ancestors 'none'; frame-src https://*.code.example.org"},
		{"https://oh-view-*.example.org", "https://oh-code-*.example.org", "frame-ancestors 'none'; frame-src https://*.example.org"},
		{"https://oh-view-*.example.org", "https://code.example.org", "frame-ancestors 'none'; frame-src https://*.example.org https://*.code.example.org"},
	} {
		_, a, _, _, _ := fixture(t)
		a.cfg.ViewOrigin, a.cfg.EditorOrigin = tc.view, tc.editor
		w := httptest.NewRecorder()
		NewWithAuth(t.TempDir(), a).ServeHTTP(w, httptest.NewRequest("GET", "https://host.test/", nil))
		if got := w.Header().Get("Content-Security-Policy"); got != tc.want || w.Header().Get("X-Frame-Options") != "DENY" {
			t.Errorf("view %q editor %q: CSP %q, want %q", tc.view, tc.editor, got, tc.want)
		}
	}
}
