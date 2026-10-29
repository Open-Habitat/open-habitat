//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestParsePullRequestCountsChecksAndRefusesWhatItCannotRead(t *testing.T) {
	out := `[{"number":412,"state":"OPEN","isDraft":true,"checks":[["CheckRun","COMPLETED","SUCCESS",""],["CheckRun","COMPLETED","SKIPPED",""],["CheckRun","IN_PROGRESS","",""],["CheckRun","COMPLETED","FAILURE",""],["StatusContext","","","PENDING"],["StatusContext","","","SUCCESS"],["StatusContext","","","ERROR"]]}]`
	pr, found, ok := parsePullRequest([]byte(out), "example-owner/example-repo")
	if !ok || !found || pr.State != "draft" || pr.Number != 412 || pr.URL != "https://github.com/example-owner/example-repo/pull/412" || pr.Checks != (workChecks{Passed: 3, Failed: 2, Pending: 2}) {
		t.Fatalf("%+v %v %v", pr, found, ok)
	}
	// GitHub's empty answer is "no pull request", which a failure must never be.
	if _, found, ok := parsePullRequest([]byte(`[]`), "o/r"); !ok || found {
		t.Fatal("an empty list is a known absence")
	}
	for _, bad := range []string{``, `{}`, `[{"number":1,"state":"OPEN"},{"number":2,"state":"OPEN"}]`, `[{"number":1,"state":"WEIRD"}]`, `[{"number":0,"state":"OPEN"}]`, `[{"number":1,"state":"OPEN","checks":[["CheckRun"]]}]`} {
		if _, _, ok := parsePullRequest([]byte(bad), "o/r"); ok {
			t.Fatalf("read %q", bad)
		}
	}
	if pr, _, ok := parsePullRequest([]byte(`[{"number":7,"state":"MERGED","isDraft":false,"checks":[]}]`), "o/r"); !ok || pr.State != "merged" {
		t.Fatalf("merged: %+v", pr)
	}
}

func TestSpinoffWorkReadsEachWorkerAgainstItsSourceBranch(t *testing.T) {
	cfg, _ := spinoffFixture(t)
	home := cfg.Home
	git := func(dir string, args ...string) {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false"}, args...)...)
		cmd.Dir = dir
		cmd.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1"}
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v %s", args, err, out)
		}
	}
	write := func(path, body string) {
		t.Helper()
		if err := os.WriteFile(path, []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	repo := filepath.Join(home, "src", "proj")
	if err := os.MkdirAll(repo, 0700); err != nil {
		t.Fatal(err)
	}
	git(repo, "init", "-q")
	write(filepath.Join(repo, "a.txt"), "one\ntwo\n")
	git(repo, "add", "a.txt")
	git(repo, "commit", "-q", "-m", "base")
	git(repo, "remote", "add", "origin", "https://github.com/example-owner/example-repo.git")
	busy := filepath.Join(home, "src", "proj__worktrees", "wt-busy")
	fresh := filepath.Join(home, "src", "proj__worktrees", "wt-fresh")
	git(repo, "worktree", "add", "-q", "-b", "wt/busy", busy, "main")
	git(repo, "worktree", "add", "-q", "-b", "wt/fresh", fresh, "main")
	git(repo, "branch", "wt/kept", "main")
	// Busy: two commits, one modified file and an untracked three-line file.
	write(filepath.Join(busy, "b.txt"), "x\n")
	git(busy, "add", "b.txt")
	git(busy, "commit", "-q", "-m", "one")
	write(filepath.Join(busy, "a.txt"), "one\nTWO\n")
	git(busy, "commit", "-q", "-am", "two")
	write(filepath.Join(busy, "b.txt"), "x\ny\n")
	write(filepath.Join(busy, "new.txt"), "1\n2\n3\n")
	// Kept: an ended worker whose worktree is gone but whose branch stays.
	git(repo, "checkout", "-q", "wt/kept")
	write(filepath.Join(repo, "c.txt"), "c\n")
	git(repo, "add", "c.txt")
	git(repo, "commit", "-q", "-m", "kept")
	git(repo, "checkout", "-q", "main")
	// The source branch moves on after the workers started.
	write(filepath.Join(repo, "d.txt"), "d\n")
	git(repo, "add", "d.txt")
	git(repo, "commit", "-q", "-m", "main moves")

	parent := nativeSession{id: spinoffParent, cwd: repo, state: "readable"}
	creator := &struct {
		Harness   string `json:"harness"`
		SessionID string `json:"session_id"`
	}{"pi", spinoffParent}
	run := func(id, status, worktree string) nativeSpinoff {
		return nativeSpinoff{ID: id, Kind: "spinoff", Status: status, SourceRepo: repo, SourceBranch: "main", WorktreePath: worktree, Creator: creator, CreatedAt: "2026-10-29T10:00:00Z" + id[25:]}
	}
	const busyID, freshID, goneID, keptID, landedID = "01m521vczarx5bkx086n64t1t1", "01m521vczarx5bkx086n64t1t2", "01m521vczarx5bkx086n64t1t3", "01m521vczarx5bkx086n64t1t4", "01m521vczarx5bkx086n64t1t5"
	kept := run(keptID, "failed", filepath.Join(home, "src", "proj__worktrees", "wt-kept"))
	keptBranch := "wt/kept"
	kept.Preserved = []spinoffPreserved{{Branch: &keptBranch, BranchPresent: true}}
	landed := run(landedID, "done", busy)
	landed.Landed = true
	runs := []nativeSpinoff{run(busyID, "running", busy), run(freshID, "running", fresh), run(goneID, "pending", filepath.Join(home, "src", "proj__worktrees", "wt-not-yet")), kept, landed}
	dir := filepath.Join(home, "taskfleet-fixture")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	list, _ := json.Marshal(map[string]any{"schema_version": 1, "data": map[string]any{"runs": runs}})
	write(filepath.Join(dir, "list.json"), string(list))
	for _, r := range runs {
		b, _ := json.Marshal(map[string]any{"schema_version": 1, "data": r})
		write(filepath.Join(dir, r.ID+".json"), string(b))
	}
	bin := filepath.Join(home, ".local", "bin", "taskfleet")
	if err := os.MkdirAll(filepath.Dir(bin), 0700); err != nil {
		t.Fatal(err)
	}
	write(bin, "#!/bin/sh\ncase \"$1\" in version) printf '%s' '{\"schema_version\":1,\"data\":{\"version\":\"0.18.0\"}}';; *) if [ \"$2\" = show ]; then cat '"+dir+"'/\"$3\".json; else cat '"+dir+"'/list.json; fi;; esac\n")
	if err := os.Chmod(bin, 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", filepath.Dir(bin)+":/usr/bin:/bin")

	// The reads run side by side.
	var mu sync.Mutex
	asked := map[string]bool{}
	workPullRequest = func(_ context.Context, _, repo, branch string) (workPR, bool, bool) {
		mu.Lock()
		asked[branch] = true
		mu.Unlock()
		switch branch {
		case "wt/busy":
			return workPR{Number: 9, State: "open", URL: "https://github.com/" + repo + "/pull/9"}, true, true
		case "wt/kept":
			return workPR{}, false, false
		}
		return workPR{}, false, true
	}
	t.Cleanup(func() { workPullRequest = ghPullRequest })

	h := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, func(transport.Config) ([]nativeSession, error) { return []nativeSession{parent}, nil })
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+spinoffParent+"/spinoff-work", nil))
	var got struct {
		Availability string `json:"availability"`
		Runs         []struct {
			ID      string  `json:"run_id"`
			Git     string  `json:"git"`
			Dirty   *int    `json:"dirty_count"`
			Ahead   *int    `json:"ahead"`
			Behind  *int    `json:"behind"`
			Added   *int    `json:"added"`
			Removed *int    `json:"removed"`
			PRState string  `json:"pull_request_state"`
			PR      *workPR `json:"pull_request"`
		} `json:"runs"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got) != nil || got.Availability != "available" {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
	byID := map[string]int{}
	for i, r := range got.Runs {
		byID[r.ID] = i
	}
	if _, ok := byID[landedID]; ok || len(got.Runs) != 4 {
		t.Fatalf("a landed worker has no work facts: %s", w.Body.String())
	}
	n := func(p *int) int {
		if p == nil {
			return -1
		}
		return *p
	}
	b := got.Runs[byID[busyID]]
	// a.txt one line changed (+1 -1), b.txt two lines, new.txt three lines.
	if b.Git != "available" || n(b.Dirty) != 2 || n(b.Ahead) != 2 || n(b.Behind) != 1 || n(b.Added) != 6 || n(b.Removed) != 1 || b.PRState != "found" || b.PR == nil || b.PR.Number != 9 {
		t.Fatalf("busy: %+v", b)
	}
	f := got.Runs[byID[freshID]]
	if f.Git != "available" || n(f.Dirty) != 0 || n(f.Ahead) != 0 || n(f.Behind) != 1 || f.PRState != "none" {
		t.Fatalf("a worker with nothing yet must read as zero, known: %+v", f)
	}
	g := got.Runs[byID[goneID]]
	if g.Git != "unavailable" || g.Dirty != nil || g.Ahead != nil || g.PRState != "unknown" || asked[""] {
		t.Fatalf("unknown must not read as nothing: %+v", g)
	}
	k := got.Runs[byID[keptID]]
	if k.Git != "available" || k.Dirty != nil || n(k.Ahead) != 1 || n(k.Behind) != 1 || n(k.Added) != 1 || k.PRState != "unknown" {
		t.Fatalf("kept branch: %+v", k)
	}

	// The route takes no query: nothing selects another run, repository or branch.
	for _, q := range []string{"?run=" + busyID, "?branch=main"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+spinoffParent+"/spinoff-work"+q, nil))
		if w.Code != 400 {
			t.Fatalf("%s: %d", q, w.Code)
		}
	}
}

// Unknown stays unknown: a line total missing a file it could not count, and
// a GitHub repository whose address form is not read here.
func TestWorkerGitLeavesWhatItCannotCountUnknown(t *testing.T) {
	home := t.TempDir()
	repo := filepath.Join(home, "src", "proj")
	if err := os.MkdirAll(repo, 0700); err != nil {
		t.Fatal(err)
	}
	git := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false"}, args...)...)
		cmd.Dir = repo
		cmd.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1"}
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v %s", args, err, out)
		}
	}
	git("init", "-q")
	if err := os.WriteFile(filepath.Join(repo, "a.txt"), []byte("a\n"), 0600); err != nil {
		t.Fatal(err)
	}
	git("add", "a.txt")
	git("commit", "-q", "-m", "base")
	git("checkout", "-q", "-b", "wt/w")
	r := nativeSpinoff{ID: spinoffFixtureID, SourceRepo: repo, SourceBranch: "main"}
	n := func(p *int) int {
		if p == nil {
			return -1
		}
		return *p
	}
	// No origin at all: not a GitHub repository.
	if w := readWorkerGit(context.Background(), home, r, repo, ""); w.PRState != "unsupported" || n(w.Added) != 0 {
		t.Fatalf("no origin: %+v", w)
	}
	git("remote", "add", "origin", "ssh://git@github.com/example-owner/example-repo.git")
	// A binary file has no lines, as in Git's numstat; a file too large to
	// count leaves the total unknown.
	if err := os.WriteFile(filepath.Join(repo, "image.bin"), []byte{0, 1, 2}, 0600); err != nil {
		t.Fatal(err)
	}
	w := readWorkerGit(context.Background(), home, r, repo, "")
	if w.PRState != "unknown" || n(w.Added) != 0 || n(w.Dirty) != 1 || n(w.Ahead) != 0 {
		t.Fatalf("binary file or unread GitHub address: %+v", w)
	}
	if err := os.WriteFile(filepath.Join(repo, "big.txt"), make([]byte, 2<<20), 0600); err != nil {
		t.Fatal(err)
	}
	if w := readWorkerGit(context.Background(), home, r, repo, ""); w.Added != nil || w.Removed != nil {
		t.Fatalf("uncountable file: %+v", w)
	}
}
