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
)

func TestWorkspaceManagement(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	if e := os.Mkdir(filepath.Join(cfg.Home, "src"), 0700); e != nil {
		t.Fatal(e)
	}
	handler := WorkspaceHandler(cfg, func(*http.Request) bool { return true })
	request := func(input any) int {
		t.Helper()
		b, _ := json.Marshal(input)
		r := httptest.NewRequest("POST", "http://unix/api/v1/workspaces", bytes.NewReader(b))
		r.RequestURI = WorkspacePath
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w.Code
	}
	unauthorized := WorkspaceHandler(cfg, func(*http.Request) bool { return false })
	body := []byte(`{"action":"create","name":"nope","git":false}`)
	req := httptest.NewRequest("POST", "http://unix/api/v1/workspaces", bytes.NewReader(body))
	req.RequestURI = WorkspacePath
	req.Header.Set("Content-Type", "application/json")
	denied := httptest.NewRecorder()
	unauthorized.ServeHTTP(denied, req)
	if denied.Code != 403 {
		t.Fatalf("untrusted peer: %d", denied.Code)
	}
	if got := request(map[string]any{"action": "create", "name": "alpha", "git": false}); got != 200 {
		t.Fatalf("create: %d", got)
	}
	if got := request(map[string]any{"action": "create", "name": "ALPHA", "git": false}); got != 409 {
		t.Fatalf("case collision: %d", got)
	}
	obs := Discover(cfg)
	if len(obs.Entries) != 1 {
		t.Fatalf("discovery: %+v", obs)
	}
	entry := obs.Entries[0]
	id := entry.WorkspaceID
	token := workspaceToken(cfg, entry)
	if got := request(map[string]any{"action": "settings", "workspace_id": id, "observation_token": "stale", "display_name": "New"}); got != 409 {
		t.Fatalf("stale: %d", got)
	}
	if got := request(map[string]any{"action": "settings", "workspace_id": id, "observation_token": token, "display_name": "New"}); got != 200 {
		t.Fatalf("settings: %d", got)
	}
	if got := request(map[string]any{"action": "visibility", "workspace_id": id, "observation_token": token, "hidden": true}); got != 200 {
		t.Fatalf("hide: %d", got)
	}
	state, e := loadVisibility(cfg.Home)
	if e != nil || !state.Workspaces[id].Hidden {
		t.Fatalf("state: %+v %v", state, e)
	}
	if got := request(map[string]any{"action": "git_init", "workspace_id": id, "observation_token": token}); got != 200 {
		t.Fatalf("git init: %d", got)
	}
	if _, e := os.Stat(filepath.Join(cfg.Home, "src", "alpha", ".git")); e != nil {
		t.Fatal(e)
	}
	if got := request(map[string]any{"action": "delete", "workspace_id": id, "observation_token": token}); got != 400 {
		t.Fatalf("delete allowed: %d", got)
	}
	if e := os.WriteFile(filepath.Join(cfg.Home, ".local", "state", "native-agent-host", "user-state.json"), []byte("invalid"), 0600); e != nil {
		t.Fatal(e)
	}
	if got := request(map[string]any{"action": "visibility", "workspace_id": id, "observation_token": token, "hidden": false}); got != 409 {
		t.Fatalf("corrupt overwritten: %d", got)
	}
}
