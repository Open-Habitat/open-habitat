//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"github.com/maintainer/native-agent-host/internal/transport"
	"golang.org/x/sys/unix"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
)

func workspaceReviewRequest(t *testing.T, cfg transport.Config, input map[string]any) (int, map[string]any) {
	t.Helper()
	b, _ := json.Marshal(input)
	r := httptest.NewRequest("POST", "http://unix/api/v1/workspaces", bytes.NewReader(b))
	r.RequestURI = WorkspacePath
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	WorkspaceHandler(cfg, func(*http.Request) bool { return true }).ServeHTTP(w, r)
	var result map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &result)
	return w.Code, result
}
func TestWorkspaceFirstAnnotationDoesNotCollideAfterNativeRename(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	root := filepath.Join(cfg.Home, "src")
	if e := os.MkdirAll(filepath.Join(root, "alpha"), 0700); e != nil {
		t.Fatal(e)
	}
	entry := Discover(cfg).Entries[0]
	derived := opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
	code, result := workspaceReviewRequest(t, cfg, map[string]any{"action": "settings", "workspace_id": derived, "observation_token": workspaceToken(cfg, entry), "display_name": "Named"})
	if code != 200 {
		t.Fatalf("settings: %d %v", code, result)
	}
	if result["workspace_id"] == derived {
		t.Fatal("persisted derived ID")
	}
	if e := os.Rename(filepath.Join(root, "alpha"), filepath.Join(root, "beta")); e != nil {
		t.Fatal(e)
	}
	if e := os.Mkdir(filepath.Join(root, "alpha"), 0700); e != nil {
		t.Fatal(e)
	}
	seen := map[string]bool{}
	for _, w := range Discover(cfg).Entries {
		id := w.WorkspaceID
		if id == "" {
			id = opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+w.Name)
		}
		if seen[id] {
			t.Fatalf("duplicate ID %s", id)
		}
		seen[id] = true
	}
}
func TestWorkspaceUnrelatedBadEntryDoesNotBlockCleanTarget(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	root := filepath.Join(cfg.Home, "src")
	for _, name := range []string{"clean", "broken"} {
		if e := os.MkdirAll(filepath.Join(root, name), 0700); e != nil {
			t.Fatal(e)
		}
	}
	if e := os.Mkdir(filepath.Join(root, "broken", ".agent-host"), 0700); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(filepath.Join(root, "broken", ".agent-host", "workspace.json"), []byte("bad"), 0600); e != nil {
		t.Fatal(e)
	}
	obs := Discover(cfg)
	if obs.State != "partial" || obs.Error != "" {
		t.Fatalf("expected partial entry with complete listing: %+v", obs)
	}
	for _, w := range obs.Entries {
		if w.Name == "clean" {
			id := opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+w.Name)
			code, _ := workspaceReviewRequest(t, cfg, map[string]any{"action": "settings", "workspace_id": id, "observation_token": workspaceToken(cfg, w), "display_name": "Clean"})
			if code != 200 {
				t.Fatalf("clean target blocked: %d", code)
			}
			return
		}
	}
	t.Fatal("clean workspace missing")
}
func TestWorkspaceSnapshotEnablesLocalWritesAndSourceToken(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	if e := os.MkdirAll(filepath.Join(cfg.Home, "src", "first"), 0700); e != nil {
		t.Fatal(e)
	}
	handler := SnapshotHandler(cfg, func(*http.Request) bool { return true }, Discover)
	r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
	r.RequestURI = SnapshotPath
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("snapshot %d: %s", w.Code, w.Body.String())
	}
	var doc map[string]any
	if e := json.Unmarshal(w.Body.Bytes(), &doc); e != nil {
		t.Fatal(e)
	}
	if doc["write_state"] != "enabled" {
		t.Fatalf("write_state %v", doc["write_state"])
	}
	src, s, e := workspaceSource(cfg)
	if e != nil {
		t.Fatal(e)
	}
	defer unix.Close(src)
	if doc["user_observation_token"] != workspaceUserToken(cfg, s) {
		t.Fatal("source token mismatch")
	}
}

type blockedWorkspaceBody struct {
	once    sync.Once
	started chan struct{}
	release chan struct{}
}

func (b *blockedWorkspaceBody) Read([]byte) (int, error) {
	b.once.Do(func() { close(b.started) })
	<-b.release
	return 0, io.EOF
}
func TestWorkspaceRequestBodyDoesNotHoldWriterLock(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	body := &blockedWorkspaceBody{started: make(chan struct{}), release: make(chan struct{})}
	r := httptest.NewRequest("POST", "http://unix/api/v1/workspaces", body)
	r.RequestURI = WorkspacePath
	r.ContentLength = 10
	r.Header.Set("Content-Type", "application/json")
	done := make(chan struct{})
	go func() {
		defer close(done)
		WorkspaceHandler(cfg, func(*http.Request) bool { return true }).ServeHTTP(httptest.NewRecorder(), r)
	}()
	<-body.started
	if !cloneWriter.TryLock() {
		close(body.release)
		<-done
		t.Fatal("request body holds shared writer lock")
	}
	cloneWriter.Unlock()
	close(body.release)
	<-done
}
func TestWorkspaceStateRejectsFIFOWriteWithoutBlocking(t *testing.T) {
	home := t.TempDir()
	d := filepath.Join(home, ".local", "state", "native-agent-host")
	if e := os.MkdirAll(d, 0700); e != nil {
		t.Fatal(e)
	}
	if e := unix.Mkfifo(filepath.Join(d, "user-state.json"), 0600); e != nil {
		t.Fatal(e)
	}
	_, e := loadVisibility(home)
	if e == nil {
		t.Fatal("accepted FIFO as state")
	}
}
func TestWorkspaceSettingsExcludeExistingGitMetadata(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	root := filepath.Join(cfg.Home, "src", "repo")
	if e := os.MkdirAll(root, 0700); e != nil {
		t.Fatal(e)
	}
	cmd := exec.Command("git", "init", "--quiet", root)
	cmd.Env = []string{"HOME=" + cfg.Home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1"}
	if out, e := cmd.CombinedOutput(); e != nil {
		t.Fatalf("git init %s: %v", out, e)
	}
	w := Discover(cfg).Entries[0]
	if w.Kind != "git_main_worktree" {
		t.Fatalf("kind %s", w.Kind)
	}
	id := opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+w.Name)
	code, result := workspaceReviewRequest(t, cfg, map[string]any{"action": "settings", "workspace_id": id, "observation_token": workspaceToken(cfg, w), "display_name": "Repo"})
	if code != 200 {
		t.Fatalf("settings: %d %v", code, result)
	}
	status := exec.Command("git", "-C", root, "status", "--porcelain", "--untracked-files=all")
	status.Env = cmd.Env
	out, e := status.CombinedOutput()
	if e != nil || len(out) != 0 {
		t.Fatalf("metadata not excluded: %s %v", out, e)
	}
}
func TestWorkspaceGitInitWithEmptyTemplate(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	root := filepath.Join(cfg.Home, "src", "plain")
	if e := os.MkdirAll(root, 0700); e != nil {
		t.Fatal(e)
	}
	template := filepath.Join(cfg.Home, "empty-template")
	if e := os.Mkdir(template, 0700); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(filepath.Join(cfg.Home, ".gitconfig"), []byte("[init]\n\ttemplateDir = "+template+"\n"), 0600); e != nil {
		t.Fatal(e)
	}
	w := Discover(cfg).Entries[0]
	id := opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+w.Name)
	code, result := workspaceReviewRequest(t, cfg, map[string]any{"action": "git_init", "workspace_id": id, "observation_token": workspaceToken(cfg, w)})
	if code != 200 {
		t.Fatalf("git init: %d %v", code, result)
	}
	contents, e := os.ReadFile(filepath.Join(root, ".git", "info", "exclude"))
	if e != nil || !bytes.Contains(contents, []byte(".agent-host/")) {
		t.Fatalf("exclude: %s %v", contents, e)
	}
}
