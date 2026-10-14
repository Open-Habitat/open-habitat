//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/unix"
)

func TestHomeDirectoryCreationIsConfinedAndInitializesGit(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	t.Setenv("HOME", cfg.Home)
	srcPath := filepath.Join(cfg.Home, "src")
	if err := os.Mkdir(srcPath, 0700); err != nil {
		t.Fatal(err)
	}
	src, observed, err := workspaceSource(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(src)
	token := workspaceUserToken(cfg, observed)
	handler := WorkspaceHandler(cfg, func(*http.Request) bool { return true })
	request := func(name string) int {
		t.Helper()
		b, _ := json.Marshal(map[string]any{"action": "create", "name": name, "git": true, "user_observation_token": token})
		r := httptest.NewRequest(http.MethodPost, "http://unix"+WorkspacePath, bytes.NewReader(b))
		r.RequestURI = WorkspacePath
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w.Code
	}
	for _, name := range []string{"../outside", "a/b", ".", "..", "-git-option", "a\x00b"} {
		if code := request(name); code != 400 {
			t.Fatalf("unsafe name %q: %d", name, code)
		}
	}
	if code := request("fresh"); code != 200 {
		t.Fatalf("create: %d", code)
	}
	if info, err := os.Stat(filepath.Join(srcPath, "fresh", ".git")); err != nil || !info.IsDir() {
		t.Fatalf("git init: %v %v", info, err)
	}
	if _, err := os.Stat(filepath.Join(cfg.Home, "outside")); !os.IsNotExist(err) {
		t.Fatalf("escaped home: %v", err)
	}
	if code := request("fresh"); code != 409 {
		t.Fatalf("duplicate: %d", code)
	}
}
