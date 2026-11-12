//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/open-habitat/open-habitat/internal/nativegh"
	"github.com/open-habitat/open-habitat/internal/testpython"
	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"testing"
)

func TestSnapshotNativeStatusOnlyAfterTrust(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, _ := strconv.Atoi(u.Uid)
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42", Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock"}
	calls := 0
	status := "connected"
	h := snapshotHandlerWithStatus(cfg, func(*http.Request) bool { return true }, func(transport.Config) Discovery { return Discovery{State: "empty"} }, func(transport.Config) ([]nativeSession, error) { return nil, nil }, t.TempDir(), func(context.Context) nativegh.Observation {
		calls++
		// The handler, not only the adapter, names a login only beside a
		// state gh works with.
		return nativegh.Observation{State: status, Login: "alice", Reason: nativegh.ReasonTimeout}
	})
	request := func(id string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
		r.RequestURI = SnapshotPath
		r.Header.Set("X-Agent-Host-Identity", id)
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := request(opaque("wid_", "github:99")); w.Code != 200 || calls != 1 {
		t.Fatalf("untrusted probe: %d calls=%d", w.Code, calls)
	}
	deniedHandler := snapshotHandlerWithStatus(cfg, func(*http.Request) bool { return false }, func(transport.Config) Discovery { t.Fatal("untrusted peer reached discovery"); return Discovery{} }, func(transport.Config) ([]nativeSession, error) { return nil, nil }, t.TempDir(), func(context.Context) nativegh.Observation {
		t.Fatal("untrusted peer reached native status")
		return nativegh.Observation{}
	})
	denied := httptest.NewRecorder()
	untrusted := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
	untrusted.RequestURI = SnapshotPath
	deniedHandler.ServeHTTP(denied, untrusted)
	if denied.Code != 403 {
		t.Fatalf("peer accepted: %d", denied.Code)
	}
	for _, state := range []string{"connected", "disconnected", "expired", "partial", "unknown", "invalid"} {
		status = state
		w := request(opaque("wid_", "github:42"))
		if w.Code != 200 {
			t.Fatalf("%s: %d", state, w.Code)
		}
		var doc struct {
			Auth struct {
				NativeGitHub struct {
					State  string `json:"state"`
					Login  string `json:"login"`
					Reason string `json:"reason"`
				} `json:"native_github"`
			} `json:"auth"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &doc); err != nil {
			t.Fatal(err)
		}
		want := state
		if state == "invalid" {
			want = "unknown"
		}
		wantLogin := map[string]string{"connected": "alice", "partial": "alice"}[state]
		// The cause of an unknown state is named only beside it.
		wantReason := map[string]string{"unknown": nativegh.ReasonTimeout}[want]
		if doc.Auth.NativeGitHub.State != want || doc.Auth.NativeGitHub.Login != wantLogin || doc.Auth.NativeGitHub.Reason != wantReason || bytes.Contains(w.Body.Bytes(), []byte("oauth_token")) {
			t.Fatalf("state=%s body=%s", state, w.Body.String())
		}
	}
	if calls != 7 {
		t.Fatal(calls)
	}
}

func TestSnapshotDiscoveryAndSchema(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, _ := strconv.Atoi(u.Uid)
	home := t.TempDir()
	if err := os.Mkdir(filepath.Join(home, "src"), 0700); err != nil {
		t.Fatal(err)
	}
	src := filepath.Join(home, "src")
	for _, name := range []string{"ordinary", "repository", "annotated"} {
		if err := os.Mkdir(filepath.Join(src, name), 0700); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Mkdir(filepath.Join(src, "repository", ".git"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(src, "annotated", ".agent-host"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(src, "annotated", ".agent-host", "workspace.json"), []byte(`{"schema_version":1,"workspace_id":"ws_known123","display_name":"Named"}`), 0600); err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42"}
	cfg.Socket = "/run/open-habitat/users/" + u.Username + "/daemon.sock"
	// The discovery seam uses a disposable root; production always calls Discover(cfg).
	state := func(_ transport.Config) Discovery { return scan(home, uid, unix.Openat2, false) }
	h := SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, state, home)
	request := func() *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
		r.RequestURI = SnapshotPath
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	check := func(w *httptest.ResponseRecorder, want int) map[string]any {
		t.Helper()
		if w.Code != want {
			t.Fatalf("status %d: %s", w.Code, w.Body.String())
		}
		if bytes.Contains(w.Body.Bytes(), []byte(u.HomeDir)) {
			t.Fatal("real home path leaked")
		}
		if want != 200 {
			return nil
		}
		python := testpython.Validator(t)
		cmd := exec.Command(python, "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); m['Draft202012Validator'](m['schemas']['snapshot.schema.json'],registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`)
		cmd.Stdin = bytes.NewReader(w.Body.Bytes())
		if out, e := cmd.CombinedOutput(); e != nil {
			t.Fatalf("schema: %s: %v", out, e)
		}
		var doc map[string]any
		if e := json.Unmarshal(w.Body.Bytes(), &doc); e != nil {
			t.Fatal(e)
		}
		return doc
	}
	doc := check(request(), 200)
	fixtureCfg := cfg
	fixtureCfg.Home = home
	sourceFD, sourceStat, err := workspaceSource(fixtureCfg)
	if err != nil {
		t.Fatal(err)
	}
	unix.Close(sourceFD)
	if doc["user_observation_token"] != workspaceUserToken(fixtureCfg, sourceStat) {
		t.Fatal("snapshot workspace token did not come from the disposable native root")
	}
	ws := doc["workspaces"].([]any)
	if len(ws) != 3 {
		t.Fatal(ws)
	}
	if ws[0].(map[string]any)["workspace_id"] != "ws_known123" || ws[0].(map[string]any)["path"] != filepath.Join(src, "annotated") || ws[1].(map[string]any)["kind"] != "directory" || ws[2].(map[string]any)["kind"] != "git_main_worktree" {
		t.Fatal(ws)
	}
	if doc["write_state"] != "enabled" {
		t.Fatal(doc)
	}
	if request().Body.String() == "" {
		t.Fatal("empty")
	}
	state = func(_ transport.Config) Discovery {
		return Discovery{State: "partial", Entries: []Workspace{{Name: "ordinary", Kind: "unknown", Metadata: "error"}}}
	}
	h = SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, state, home)
	partial := check(request(), 200)
	if partial["sources"].([]any)[0].(map[string]any)["state"] != "unknown" || partial["workspaces"].([]any)[0].(map[string]any)["kind"] != "unknown" {
		t.Fatal(partial)
	}
	state = func(_ transport.Config) Discovery { return scan(home, uid, unix.Openat2, false) }
	h = SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, state, home)
	for _, name := range []string{"ordinary", "repository", "annotated"} {
		if err := os.RemoveAll(filepath.Join(src, name)); err != nil {
			t.Fatal(err)
		}
	}
	if d := check(request(), 200); len(d["workspaces"].([]any)) != 0 || d["sources"].([]any)[0].(map[string]any)["state"] != "confirmed" {
		t.Fatal(d)
	}
	if err := os.Remove(src); err != nil {
		t.Fatal(err)
	}
	if d := check(request(), 200); d["sources"].([]any)[0].(map[string]any)["state"] != "absent" {
		t.Fatal(d)
	}
	state = func(transport.Config) Discovery { return Discovery{State: "error"} }
	// Closure replacement requires a fresh handler, never a request field.
	h = SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, state, home)
	check(request(), 503)
}

func TestSnapshotMissingArchivedHistoryIsNotEmptyArchive(t *testing.T) {
	cfg, home := cloneFixture(t)
	if err := os.Mkdir(filepath.Join(home, "src"), 0700); err != nil {
		t.Fatal(err)
	}
	state, err := loadVisibility(home)
	if err != nil {
		t.Fatal(err)
	}
	state.Conversations["pi:12345678-1234-4123-8123-123456789abc"] = json.RawMessage(`{"archived_at":"2026-10-06T12:00:00Z"}`)
	if err := saveVisibility(home, state); err != nil {
		t.Fatal(err)
	}
	h := SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, func(transport.Config) Discovery { return DiscoverFixtureRoot(home, os.Geteuid()) }, home)
	r := httptest.NewRequest("GET", "http://unix"+SnapshotPath, nil)
	r.RequestURI = SnapshotPath
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("snapshot: %d %s", w.Code, w.Body.String())
	}
	var view struct {
		Sources []struct{ Source, State string }
		Agents  []any
	}
	if err := json.Unmarshal(w.Body.Bytes(), &view); err != nil {
		t.Fatal(err)
	}
	if len(view.Agents) != 0 {
		t.Fatal("invented missing history", view.Agents)
	}
	for _, fact := range view.Sources {
		if fact.Source == "pi_history" {
			if fact.State != "unknown" {
				t.Fatalf("missing archived history presented as %s", fact.State)
			}
			return
		}
	}
	t.Fatal("missing history source fact")
}

func TestSnapshotLargeBatchedCollection(t *testing.T) {
	cfg, home := cloneFixture(t)
	src := filepath.Join(home, "src")
	if err := os.Mkdir(src, 0700); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2500; i++ {
		name := "project-" + strconv.Itoa(i)
		if err := os.Mkdir(filepath.Join(src, name), 0700); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 20; i++ {
		if err := os.WriteFile(filepath.Join(src, "file-"+strconv.Itoa(i)), nil, 0600); err != nil {
			t.Fatal(err)
		}
	}
	h := SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, func(transport.Config) Discovery { return DiscoverFixtureRoot(home, os.Geteuid()) }, home)
	r := httptest.NewRequest("GET", "http://unix"+SnapshotPath, nil)
	r.RequestURI = SnapshotPath
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("snapshot: %d %s", w.Code, w.Body.String())
	}
	var doc struct {
		Sources    []struct{ Source, State string }
		Workspaces []struct{ Name string }
	}
	if err := json.Unmarshal(w.Body.Bytes(), &doc); err != nil {
		t.Fatal(err)
	}
	if len(doc.Workspaces) != 2500 || doc.Sources[0].State != "confirmed" || w.Body.Len() <= 1<<20 {
		t.Fatalf("incomplete snapshot: count=%d state=%s", len(doc.Workspaces), doc.Sources[0].State)
	}
}

// Pi keeps histories outside the workspace. Moving the workspace to Trash
// changes catalog membership, not the readability of its archived history.
func TestSnapshotArchiveCompletenessAcrossWorkspaceTrashAndRestore(t *testing.T) {
	cfg, home := cloneFixture(t)
	cwd := filepath.Join(home, "src", "project")
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(home, "src", "other"), 0700); err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(home, ".pi", "agent", "sessions")
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	const id = "12345678-1234-4123-8123-123456789abc"
	path := filepath.Join(root, "history.jsonl")
	header := []byte(fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, cwd))
	if err := os.WriteFile(path, header, 0600); err != nil {
		t.Fatal(err)
	}
	visibility, err := loadVisibility(home)
	if err != nil {
		t.Fatal(err)
	}
	visibility.Conversations["pi:"+id] = json.RawMessage(`{"archived_at":"2026-10-06T12:00:00Z"}`)
	if err := saveVisibility(home, visibility); err != nil {
		t.Fatal(err)
	}
	h := SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, func(transport.Config) Discovery { return DiscoverFixtureRoot(home, os.Geteuid()) }, home)
	check := func(wantState string, wantArchived bool) {
		t.Helper()
		w := httptest.NewRecorder()
		r := httptest.NewRequest("GET", "http://unix"+SnapshotPath, nil)
		r.RequestURI = SnapshotPath
		h.ServeHTTP(w, r)
		if w.Code != 200 {
			t.Fatalf("snapshot: %d %s", w.Code, w.Body.String())
		}
		var view struct {
			Sources []struct{ Source, State string }
			Agents  []struct {
				ID         string `json:"agent_id"`
				Archive    string
				ArchivedAt string `json:"archived_at"`
			}
		}
		if err := json.Unmarshal(w.Body.Bytes(), &view); err != nil {
			t.Fatal(err)
		}
		state, archived := "", false
		for _, f := range view.Sources {
			if f.Source == "pi_history" {
				state = f.State
			}
		}
		for _, a := range view.Agents {
			if a.ID == "pi:"+id && a.Archive == "archived" {
				archived = true
				// The archive list orders and dates rows by the mark's own time.
				if a.ArchivedAt != "2026-10-06T12:00:00Z" {
					t.Fatalf("archived_at = %q", a.ArchivedAt)
				}
			}
		}
		if state != wantState || archived != wantArchived {
			t.Fatalf("history=%s archived=%v; want %s %v", state, archived, wantState, wantArchived)
		}
	}
	check("confirmed", true)
	trash, err := openTrash(home, true)
	if err != nil {
		t.Fatal(err)
	}
	defer trash.close()
	if err := os.WriteFile(filepath.Join(home, ".local/share/Trash/info/project.trashinfo"), []byte("[Trash Info]\nPath="+trashURLPath(cwd)+"\nDeletionDate=2026-10-19T12:00:00\n"), 0600); err != nil {
		t.Fatal(err)
	}
	trashed := filepath.Join(home, ".local/share/Trash/files/project")
	if err := os.Rename(cwd, trashed); err != nil {
		t.Fatal(err)
	}
	check("confirmed", false)
	if err := os.Rename(trashed, cwd); err != nil {
		t.Fatal(err)
	}
	check("confirmed", true)
	// A broken header is genuinely unreadable, unlike a readable session
	// whose cwd currently has no workspace in the catalog.
	if err := os.WriteFile(path, []byte("not a Pi header\n"), 0600); err != nil {
		t.Fatal(err)
	}
	check("unknown", false)
}
