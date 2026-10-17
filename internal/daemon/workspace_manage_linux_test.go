//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"golang.org/x/sys/unix"
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
	src, source, e := workspaceSource(cfg)
	if e != nil {
		t.Fatal(e)
	}
	defer unix.Close(src)
	request := func(input any) int {
		t.Helper()
		if m, ok := input.(map[string]any); ok && m["action"] == "create" {
			if _, present := m["user_observation_token"]; !present {
				m["user_observation_token"] = workspaceUserToken(cfg, source)
			}
		}
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
	if got := request(map[string]any{"action": "create", "name": "stale", "git": false, "user_observation_token": "obs_stale123"}); got != 409 {
		t.Fatalf("stale source token: %d", got)
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
	if e := os.WriteFile(filepath.Join(cfg.Home, ".local", "state", "open-habitat", "user-state.json"), []byte("invalid"), 0600); e != nil {
		t.Fatal(e)
	}
	if got := request(map[string]any{"action": "visibility", "workspace_id": id, "observation_token": token, "hidden": false}); got != 409 {
		t.Fatalf("corrupt overwritten: %d", got)
	}
}

// A settings or visibility write answers with the facts it changed and
// publishes them as workspace.changed with the browser's command id, so the
// browser needs no snapshot to confirm it.
func TestWorkspaceChangeReplyAndEvent(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	if e := os.MkdirAll(filepath.Join(cfg.Home, "src", "alpha"), 0700); e != nil {
		t.Fatal(e)
	}
	controller := &ConversationController{journal: newEventJournal()}
	handler := workspaceHandler(cfg, func(*http.Request) bool { return true }, controller)
	post := func(input map[string]any) (int, map[string]any) {
		t.Helper()
		b, _ := json.Marshal(input)
		r := httptest.NewRequest("POST", "http://unix/api/v1/workspaces", bytes.NewReader(b))
		r.RequestURI = WorkspacePath
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		var out map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w.Code, out
	}
	entry := Discover(cfg).Entries[0]
	opaqueID := opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
	token := workspaceToken(cfg, entry)
	const command = "11111111-2222-4333-8444-555555555555"
	if code, _ := post(map[string]any{"action": "visibility", "workspace_id": opaqueID, "observation_token": token, "hidden": true, "client_command_id": "not-a-uuid"}); code != 400 {
		t.Fatalf("malformed command id accepted: %d", code)
	}
	code, out := post(map[string]any{"action": "visibility", "workspace_id": opaqueID, "observation_token": token, "hidden": true, "client_command_id": command})
	if code != 200 || out["client_command_id"] != command {
		t.Fatalf("hide: %d %v", code, out)
	}
	change, _ := out["workspace"].(map[string]any)
	if change["visibility"] != "hidden" || change["workspace_id"] != opaqueID || change["display_name"] != "alpha" || change["observation_token"] != token {
		t.Fatalf("hide change: %v", out)
	}
	cursor, _ := out["event_cursor"].(string)
	if cursor == "" || cursor != controller.journal.cursor(controller.journal.seq) {
		t.Fatalf("event cursor: %v", out)
	}
	var frame map[string]any
	_ = json.Unmarshal(controller.journal.frames[len(controller.journal.frames)-1], &frame)
	resource, _ := frame["resource"].(map[string]any)
	if frame["kind"] != "workspace.changed" || resource["workspace_id"] != opaqueID || resource["client_command_id"] != command || frame["cursor"] != cursor {
		t.Fatalf("event: %v", frame)
	}
	// The first rename gives the workspace a durable ID; the hidden state
	// moves with it and the change names the ID it replaced.
	code, out = post(map[string]any{"action": "settings", "workspace_id": opaqueID, "observation_token": token, "display_name": "Alpha"})
	change, _ = out["workspace"].(map[string]any)
	if code != 200 || change["previous_workspace_id"] != opaqueID || change["workspace_id"] == opaqueID || change["display_name"] != "Alpha" || change["visibility"] != "hidden" || out["workspace_id"] != change["workspace_id"] {
		t.Fatalf("rename: %d %v", code, out)
	}
	state, e := loadVisibility(cfg.Home)
	if e != nil || !state.Workspaces[change["workspace_id"].(string)].Hidden {
		t.Fatalf("hidden state did not follow the new ID: %+v %v", state, e)
	}
	// An unreadable annotation file does not undo a rename; the reply then
	// carries no change, and nothing is published.
	if e := os.WriteFile(filepath.Join(cfg.Home, ".local", "state", "open-habitat", "user-state.json"), []byte("invalid"), 0600); e != nil {
		t.Fatal(e)
	}
	before := controller.journal.seq
	code, out = post(map[string]any{"action": "settings", "workspace_id": change["workspace_id"], "observation_token": token, "display_name": "Beta"})
	if code != 200 || out["workspace"] != nil || controller.journal.seq != before {
		t.Fatalf("rename with unreadable annotations: %d %v", code, out)
	}
}
