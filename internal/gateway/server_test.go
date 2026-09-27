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
	}{{"/healthz", 200, "", false}, {"/api/v1/snapshot", 501, "", false}, {"/auth/session", 404, "", false}, {"/events", 404, "", false}, {"/not-a-route", 404, "", true}, {"/", 200, "shell", true}, {"/workspaces/ws_abcdefgh", 200, "shell", true}, {"/assets/app.js", 200, "asset", true}, {"/robots.txt", 200, "User-agent: *\nDisallow: /\n", true}} {
		r := httptest.NewRequest(http.MethodGet, tc.path, nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
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
	}
	// HEAD returns the same static headers without content.
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodHead, "/workspaces/ws_abcdefgh", nil))
	if w.Code != http.StatusOK || w.Header().Get("X-Robots-Tag") != "noindex, nofollow, noarchive" || w.Body.Len() != 0 {
		t.Errorf("HEAD UI: status %d, tag %q, body %q", w.Code, w.Header().Get("X-Robots-Tag"), w.Body.String())
	}
}
