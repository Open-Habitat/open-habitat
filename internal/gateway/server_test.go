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
	for path, content := range map[string]string{"index.html": "shell", "assets/app.js": "asset"} {
		if err := os.WriteFile(filepath.Join(static, path), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	h := New(static)
	for _, tc := range []struct {
		path string
		want int
		body string
	}{{"/healthz", 200, ""}, {"/api/v1/snapshot", 501, ""}, {"/events", 404, ""}, {"/not-a-route", 404, ""}, {"/workspaces", 200, "shell"}, {"/assets/app.js", 200, "asset"}} {
		r := httptest.NewRequest(http.MethodGet, tc.path, nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Errorf("%s: got %d want %d", tc.path, w.Code, tc.want)
		}
		if tc.body != "" && w.Body.String() != tc.body {
			t.Errorf("%s: got body %q want %q", tc.path, w.Body.String(), tc.body)
		}
	}
}
