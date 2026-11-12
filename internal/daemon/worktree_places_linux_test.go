//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/testpython"
)

func (f *worktreeFixture) createPlace(hint string) (string, error) {
	f.t.Helper()
	return createWorktreePlace(context.Background(), f.cfg, f.cfg.Home, Discover(f.cfg), f.id, hint)
}

func (f *worktreeFixture) snapshot() map[string]any {
	f.t.Helper()
	h := SnapshotHandlerWithNativeRoot(f.cfg, func(*http.Request) bool { return true }, Discover, f.cfg.Home)
	r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
	r.RequestURI = SnapshotPath
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		f.t.Fatalf("snapshot %d: %s", w.Code, w.Body.String())
	}
	cmd := exec.Command(testpython.Validator(f.t), "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); m['Draft202012Validator'](m['schemas']['snapshot.schema.json'],registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`)
	cmd.Stdin = bytes.NewReader(w.Body.Bytes())
	if out, e := cmd.CombinedOutput(); e != nil {
		f.t.Fatalf("schema: %s: %v", out, e)
	}
	var doc map[string]any
	if e := json.Unmarshal(w.Body.Bytes(), &doc); e != nil {
		f.t.Fatal(e)
	}
	return doc
}

// The first message of a worktree agent makes a branch from the
// workspace's current branch and a sibling worktree for it, with the base
// recorded where the top bar and the cleanup list read it.
func TestWorktreeAgentCreatesBranchAndPlace(t *testing.T) {
	f := newWorktreeFixture(t)
	f.git(f.src("app"), "checkout", "-q", "-b", "kehitys")
	write(t, filepath.Join(f.src("app"), "uncommitted.txt"), "stays in the workspace\n")
	id, err := f.createPlace("tilarivit")
	if err != nil {
		t.Fatal(err)
	}
	if !exists(filepath.Join(f.wt("tilarivit"), "README")) || exists(filepath.Join(f.wt("tilarivit"), "uncommitted.txt")) {
		t.Fatal("the worktree is not a clean checkout of the base")
	}
	if got := f.git(f.wt("tilarivit"), "symbolic-ref", "--short", "HEAD"); got != "wt/tilarivit" {
		t.Fatalf("branch %q", got)
	}
	if got := f.git(f.src("app"), "config", "branch.wt/tilarivit.workmux-base"); got != "kehitys" {
		t.Fatalf("recorded base %q", got)
	}
	place, ok := findPlace(f.cfg, f.cfg.Home, Discover(f.cfg), id)
	if !ok || place.Path != f.wt("tilarivit") || place.WorkspaceID != f.id || place.Branch != "wt/tilarivit" {
		t.Fatalf("place %+v %v", place, ok)
	}

	// A taken name gets a suffix rather than reusing a branch or directory.
	f.git(f.src("app"), "branch", "toinen")
	f.git(f.src("app"), "branch", "wt/toinen")
	second, err := f.createPlace("toinen")
	if err != nil || second == id {
		t.Fatal(second, err)
	}
	if !exists(f.wt("toinen-2")) || f.git(f.wt("toinen-2"), "symbolic-ref", "--short", "HEAD") != "wt/toinen-2" {
		t.Fatal("the free name was not chosen")
	}

	// A conversation resolves the place like a workspace, and a cleanup's
	// fence on the checkout refuses a start there.
	f.c.discover = Discover
	ws, cwd, err := f.c.workspaceFD(id)
	if err != nil || cwd != f.wt("tilarivit") {
		t.Fatal(cwd, err)
	}
	s, _ := stat(int(ws.Fd()))
	ws.Close()
	_, release := f.c.fenceWorkspace(context.Background(), cwd, inodeOf(s))
	if _, _, err := f.c.workspaceFD(id); err == nil {
		t.Fatal("a fenced worktree admitted a start")
	}
	release()

	// Without a branch to start from there is no worktree agent.
	f.git(f.src("app"), "checkout", "-q", "--detach")
	if _, err := f.createPlace("irti"); err == nil || err.Error() != "worktree_base_unavailable" {
		t.Fatal(err)
	}
	if _, err := f.createPlace("../ulos"); err == nil || err.Error() != "invalid_request" {
		t.Fatal(err)
	}
}

// The snapshot shows a worktree under its workspace: the container is not a
// workspace, a conversation there belongs to the workspace with the place's
// ID, and the place's Git summary follows commits and the merge.
func TestSnapshotListsWorktreePlaces(t *testing.T) {
	f := newWorktreeFixture(t)
	id, err := f.createPlace("tilarivit")
	if err != nil {
		t.Fatal(err)
	}
	f.add("agentin", false) // made by an agent with git worktree add
	writeSession(t, f.cfg.Home, "11111111-1111-4111-8111-111111111111", f.wt("tilarivit"))
	writeSession(t, f.cfg.Home, "22222222-2222-4222-8222-222222222222", f.src("app"))

	place := func(doc map[string]any) (map[string]any, []any) {
		t.Helper()
		// The fixture's other workspace is "toinen"; the worktree container
		// is never a workspace of its own.
		var app map[string]any
		for _, w := range doc["workspaces"].([]any) {
			switch w.(map[string]any)["name"] {
			case "app":
				app = w.(map[string]any)
			case "app__worktrees":
				t.Fatalf("container listed as a workspace: %v", w)
			}
		}
		if app == nil {
			t.Fatalf("workspaces %v", doc["workspaces"])
		}
		places := app["worktrees"].([]any)
		for _, p := range places {
			if p.(map[string]any)["worktree_id"] == id {
				return p.(map[string]any), places
			}
		}
		t.Fatalf("place missing: %v", places)
		return nil, nil
	}
	doc := f.snapshot()
	p, places := place(doc)
	if len(places) != 2 || p["branch"] != "wt/tilarivit" || p["path"] != f.wt("tilarivit") || p["entry"] != "tilarivit" {
		t.Fatal(places)
	}
	agents := map[string]map[string]any{}
	for _, a := range doc["agents"].([]any) {
		agents[a.(map[string]any)["agent_id"].(string)] = a.(map[string]any)
	}
	inPlace, inMain := agents["pi:11111111-1111-4111-8111-111111111111"], agents["pi:22222222-2222-4222-8222-222222222222"]
	if inPlace["workspace_id"] != f.id || inPlace["worktree_id"] != id || inMain["workspace_id"] != f.id || inMain["worktree_id"] != nil {
		t.Fatal(inPlace, inMain)
	}
	base := func(p map[string]any) map[string]any {
		t.Helper()
		summary, _ := p["git_summary"].(map[string]any)
		b, _ := summary["base"].(map[string]any)
		if b == nil || b["name"] != "main" {
			t.Fatalf("place summary %v", p)
		}
		return b
	}
	// Fresh: nothing of its own yet, so "merged" says nothing.
	if b := base(p); b["merged"] != true || p["branch_moved"] != false {
		t.Fatal(p)
	}
	write(t, filepath.Join(f.wt("tilarivit"), "rivit.txt"), "rivi\n")
	f.git(f.wt("tilarivit"), "add", ".")
	f.git(f.wt("tilarivit"), "commit", "-q", "-m", "rivit")
	p, _ = place(f.snapshot())
	if b := base(p); b["merged"] != false || b["ahead"] != float64(1) || p["branch_moved"] != true {
		t.Fatal(p)
	}
	// The agent merges as asked; the snapshot reads Git again.
	f.git(f.src("app"), "merge", "-q", "--ff-only", "wt/tilarivit")
	p, _ = place(f.snapshot())
	if b := base(p); b["merged"] != true || p["branch_moved"] != true {
		t.Fatal(p)
	}

	// The Git details read the place by its ID, never by a path.
	h := WorkspaceGitHandler(f.cfg, func(*http.Request) bool { return true })
	r := httptest.NewRequest("GET", "http://unix"+WorkspaceGitPath+"?workspace_id="+id, nil)
	r.RequestURI = WorkspaceGitPath + "?workspace_id=" + id
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	var detail map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &detail)
	if w.Code != 200 || detail["branch"] != "wt/tilarivit" || detail["workspace_id"] != id {
		t.Fatalf("%d %v", w.Code, detail)
	}

	// An agent's own worktree records no base; without origin/HEAD it is
	// compared with the main checkout's branch, as the cleanup list does.
	f.git(f.src("app"), "remote", "set-head", "origin", "--delete")
	write(t, filepath.Join(f.wt("agentin"), "a.txt"), "a\n")
	f.git(f.wt("agentin"), "add", ".")
	f.git(f.wt("agentin"), "commit", "-q", "-m", "a")
	writeSession(t, f.cfg.Home, "33333333-3333-4333-8333-333333333333", f.wt("agentin"))
	for _, raw := range f.snapshot()["workspaces"].([]any)[0].(map[string]any)["worktrees"].([]any) {
		if p := raw.(map[string]any); p["name"] == "agentin" {
			b, _ := p["git_summary"].(map[string]any)["base"].(map[string]any)
			if b == nil || b["name"] != "main" || b["source"] != "local" || b["ahead"] != float64(1) {
				t.Fatal(p)
			}
		}
	}
	// A branch name longer than the snapshot allows is left out, not sent.
	long := strings.Repeat("pitka/", 50) + "haara"
	f.git(f.src("app"), "worktree", "add", "-q", "-b", long, f.wt("pitka"))
	for _, raw := range f.snapshot()["workspaces"].([]any)[0].(map[string]any)["worktrees"].([]any) {
		if p := raw.(map[string]any); p["name"] == "pitka" && p["branch"] != nil {
			t.Fatal(p)
		}
	}

	// Something else in the container makes it an ordinary directory again.
	write(t, filepath.Join(f.src("app__worktrees"), "muistiinpanot", "a.txt"), "x\n")
	if ws := f.snapshot()["workspaces"].([]any); len(ws) != 3 { // app, the container and the fixture's toinen
		t.Fatalf("a container with other content was hidden: %v", ws)
	}
	if e := os.RemoveAll(filepath.Join(f.src("app__worktrees"), "muistiinpanot")); e != nil {
		t.Fatal(e)
	}
}

// A checkout observation or annotation update briefly owns the same writer as
// a worktree creation. A single explicit send must survive that overlap.
func TestWorktreeCreationWaitsForWorkspaceWriter(t *testing.T) {
	f := newWorktreeFixture(t)
	f.c.discover = Discover
	cloneWriter.Lock()
	released := make(chan struct{})
	go func() {
		time.Sleep(25 * time.Millisecond)
		cloneWriter.Unlock()
		close(released)
	}()
	id, status, code := f.c.createWorktree(context.Background(), httptest.NewRecorder(), f.id, "after-observation")
	<-released
	if code != "" || status != 0 || id == "" || !exists(f.wt("after-observation")) {
		t.Fatalf("creation refused a brief overlapping observation: %q %d %q", id, status, code)
	}
}

func TestWorktreeCreationConflictAndExplicitRetry(t *testing.T) {
	f := newWorktreeFixture(t)
	f.c.discover = Discover
	if !cloneWriter.TryLock("workspace_clone_running") {
		t.Fatal("writer already held")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Millisecond)
	defer cancel()
	_, status, code := f.c.createWorktree(ctx, httptest.NewRecorder(), f.id, "retry")
	cloneWriter.Unlock()
	if status != 409 || code != "workspace_clone_running" || exists(f.wt("retry")) || f.branchExists("wt/retry") {
		t.Fatalf("conflict wrote or lost the holder: %d %q", status, code)
	}
	// No background retry: only this new explicit request creates the worktree.
	id, status, code := f.c.createWorktree(context.Background(), httptest.NewRecorder(), f.id, "retry")
	if id == "" || status != 0 || code != "" || !exists(f.wt("retry")) || exists(f.wt("retry-2")) {
		t.Fatalf("explicit retry failed: %q %d %q", id, status, code)
	}
}

func TestWorktreeCreationCancelledBeforeAdmission(t *testing.T) {
	f := newWorktreeFixture(t)
	f.c.discover = Discover
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, status, code := f.c.createWorktree(ctx, httptest.NewRecorder(), f.id, "cancelled")
	if status != 409 || code == "" || exists(f.wt("cancelled")) || f.branchExists("wt/cancelled") {
		t.Fatalf("cancelled create wrote: %d %q", status, code)
	}
	if !cloneWriter.TryLock() {
		t.Fatal("cancelled request leaked writer")
	}
	cloneWriter.Unlock()
}
