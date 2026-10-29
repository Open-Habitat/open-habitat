//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// factsHome is a synthetic account whose snapshots go through the
// controller's remembered facts, as production does.
type factsHome struct {
	t        testing.TB
	home     string
	src      string
	snapshot func() map[string]any
}

func newFactsHome(t testing.TB) *factsHome {
	t.Helper()
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, _ := strconv.Atoi(u.Uid)
	home := t.TempDir()
	src := filepath.Join(home, "src")
	if err := os.Mkdir(src, 0700); err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: home, Provider: "github", Subject: "42", Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock"}
	trusted := func(*http.Request) bool { return true }
	status := func(context.Context) string { return "unknown" }
	controller := newConversationController(t.Context(), cfg, nil, trusted, status)
	h := snapshotHandlerWithController(cfg, trusted, func(transport.Config) Discovery { return scan(home, uid, unix.Openat2) }, nativeSessions, home, unknownGitHub, nil, controller)
	f := &factsHome{t: t, home: home, src: src}
	f.snapshot = func() map[string]any {
		t.Helper()
		r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
		r.RequestURI = SnapshotPath
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 200 {
			t.Fatalf("snapshot %d: %s", w.Code, w.Body.String())
		}
		var doc map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &doc); err != nil {
			t.Fatal(err)
		}
		return doc
	}
	return f
}

func (f *factsHome) git(dir string, args ...string) {
	f.t.Helper()
	// No detached auto-maintenance: it writes into the repository after the
	// fixture command returns, which a watch rightly reports as a change.
	cmd := exec.Command("/usr/bin/git", append([]string{"-C", dir, "-c", "user.name=Synthetic", "-c", "user.email=synthetic@example.invalid", "-c", "init.defaultBranch=main", "-c", "maintenance.auto=false"}, args...)...)
	cmd.Env = []string{"HOME=" + f.home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1"}
	if out, err := cmd.CombinedOutput(); err != nil {
		f.t.Fatalf("git %v: %v %s", args, err, out)
	}
}

func (f *factsHome) write(path, text string) {
	f.t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		f.t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(text), 0600); err != nil {
		f.t.Fatal(err)
	}
}

func workspaceNamed(doc map[string]any, name string) map[string]any {
	for _, raw := range doc["workspaces"].([]any) {
		if ws := raw.(map[string]any); ws["name"] == name {
			return ws
		}
	}
	return nil
}

func (f *factsHome) summary(name string) (string, int, string) {
	f.t.Helper()
	ws := workspaceNamed(f.snapshot(), name)
	if ws == nil {
		f.t.Fatalf("no workspace %s", name)
	}
	s, ok := ws["git_summary"].(map[string]any)
	if !ok {
		f.t.Fatalf("no git summary for %s: %v", name, ws)
	}
	repo, _ := s["github_repo"].(string)
	return s["branch"].(string), int(s["dirty_count"].(float64)), repo
}

// Every Git input of the summary shows up in the very next snapshot: the
// worktree, a new directory and a file in it, the index and HEAD, refs, the
// remote configuration, ignore rules, Git's global configuration, a linked
// worktree's own Git directory, and a workspace replaced under its name.
func TestSnapshotGitFactsFollowNativeInputs(t *testing.T) {
	f := newFactsHome(t)
	repo := filepath.Join(f.src, "repo")
	f.write(filepath.Join(repo, "a.txt"), "one\n")
	f.write(filepath.Join(repo, ".gitignore"), "build/\n")
	f.git(repo, "init", "-q")
	f.git(repo, "add", ".")
	f.git(repo, "commit", "-qm", "first")
	expect := func(step, branch string, dirty int, github string) {
		t.Helper()
		b, d, g := f.summary("repo")
		if b != branch || d != dirty || g != github {
			t.Fatalf("%s: branch=%s dirty=%d github=%q, want %s %d %q", step, b, d, g, branch, dirty, github)
		}
	}
	expect("clean", "main", 0, "")
	expect("unchanged", "main", 0, "")

	f.write(filepath.Join(repo, "a.txt"), "two\n")
	expect("worktree edit", "main", 1, "")
	f.write(filepath.Join(repo, "new", "b.txt"), "b\n")
	expect("new directory", "main", 2, "")
	f.write(filepath.Join(repo, "new", "c.txt"), "c\n")
	expect("file in the new directory", "main", 3, "")

	f.write(filepath.Join(repo, "build", "out.o"), "ignored\n")
	expect("ignored output", "main", 3, "")
	f.write(filepath.Join(repo, ".gitignore"), "\n")
	expect("ignore rule removed", "main", 5, "") // .gitignore itself and build/out.o
	f.write(filepath.Join(repo, "build", "more.o"), "now visible\n")
	expect("file in a formerly ignored directory", "main", 6, "")

	f.git(repo, "add", ".")
	f.git(repo, "commit", "-qm", "second")
	expect("commit", "main", 0, "")
	f.git(repo, "checkout", "-qb", "feature")
	expect("branch switch", "feature", 0, "")
	f.git(repo, "remote", "add", "origin", "https://github.com/fixture/repo.git")
	expect("remote added", "feature", 0, "fixture/repo")
	if ws := workspaceNamed(f.snapshot(), "repo"); ws["git_remote"] != "github" {
		t.Fatalf("remote classification: %v", ws["git_remote"])
	}

	f.write(filepath.Join(repo, "debug.log"), "x\n")
	expect("untracked log", "feature", 1, "fixture/repo")
	f.write(filepath.Join(f.home, ".config", "git", "ignore"), "*.log\n")
	expect("global ignore", "feature", 0, "fixture/repo")

	// A directory ignored only by the global rules becomes visible, and
	// later files in it still count.
	f.write(filepath.Join(f.home, ".config", "git", "ignore"), "*.log\nvendor/\n")
	f.write(filepath.Join(repo, "vendor", "a.go"), "a\n")
	expect("globally ignored directory", "feature", 0, "fixture/repo")
	f.write(filepath.Join(f.home, ".config", "git", "ignore"), "*.log\n")
	expect("global rule removed", "feature", 1, "fixture/repo")
	f.write(filepath.Join(repo, "vendor", "b.go"), "b\n")
	expect("file in the formerly ignored directory", "feature", 2, "fixture/repo")
	if err := os.RemoveAll(filepath.Join(repo, "vendor")); err != nil {
		t.Fatal(err)
	}
	// A force-added file in an ignored directory is tracked, so its edits count.
	f.write(filepath.Join(repo, ".gitignore"), "gen/\n")
	f.write(filepath.Join(repo, "gen", "out.txt"), "1\n")
	f.git(repo, "add", ".gitignore")
	f.git(repo, "commit", "-qm", "ignore gen")
	expect("ignored generated file", "feature", 0, "fixture/repo")
	f.git(repo, "add", "-f", "gen/out.txt")
	f.git(repo, "commit", "-qm", "force-add")
	expect("force-added", "feature", 0, "fixture/repo")
	f.write(filepath.Join(repo, "gen", "out.txt"), "2\n")
	expect("edit of a force-added file", "feature", 1, "fixture/repo")
	f.git(repo, "checkout", "-q", "--", "gen/out.txt")

	linked := filepath.Join(f.src, "linked")
	f.git(repo, "worktree", "add", "-q", "-b", "side", linked)
	if ws := workspaceNamed(f.snapshot(), "linked"); ws == nil || ws["kind"] != "git_linked_worktree" {
		t.Fatalf("linked worktree: %v", ws)
	}
	if b, d, _ := f.summary("linked"); b != "side" || d != 0 {
		t.Fatalf("linked: %s %d", b, d)
	}
	// The linked worktree's HEAD lives in the main repository's Git directory.
	f.git(linked, "checkout", "-qb", "elsewhere")
	if b, _, _ := f.summary("linked"); b != "elsewhere" {
		t.Fatalf("linked branch: %s", b)
	}
	// Unstaging writes only the linked worktree's own index, outside its tree.
	f.git(linked, "rm", "-q", "--cached", ".gitignore")
	if _, d, _ := f.summary("linked"); d != 2 {
		t.Fatalf("linked index change: %d", d)
	}
	f.git(linked, "reset", "-q")
	f.write(filepath.Join(linked, "a.txt"), "linked edit\n")
	if _, d, _ := f.summary("linked"); d != 1 {
		t.Fatalf("linked dirty: %d", d)
	}
	expect("main unaffected by the linked edit", "feature", 0, "fixture/repo")

	// The same name, a different directory: nothing carries over.
	f.git(repo, "worktree", "remove", "--force", linked)
	if err := os.RemoveAll(repo); err != nil {
		t.Fatal(err)
	}
	f.write(filepath.Join(repo, "x.txt"), "x\n")
	f.write(filepath.Join(repo, "y.txt"), "y\n")
	f.git(repo, "init", "-q", "-b", "trunk")
	expect("replaced workspace", "trunk", 2, "")
}

// Unchanged inputs are answered without asking Git, and an ignored
// directory's churn does not count as a change.
func TestGitWatchAnswersUnchangedWorkspaceFromMemory(t *testing.T) {
	f := newFactsHome(t)
	repo := filepath.Join(f.src, "repo")
	f.write(filepath.Join(repo, "a.txt"), "one\n")
	f.write(filepath.Join(repo, ".gitignore"), "node_modules/\n")
	f.write(filepath.Join(repo, "node_modules", "dep", "index.js"), "x\n")
	f.git(repo, "init", "-q")
	f.git(repo, "add", ".")
	f.git(repo, "commit", "-qm", "first")
	var entry Workspace
	for _, e := range scan(f.home, os.Geteuid(), unix.Openat2).Entries {
		if e.Name == "repo" {
			entry = e
		}
	}
	w := newGitWatch(t.Context())
	observed := 0
	observe := func() (gitFacts, bool) {
		observed++
		summary, ok := workspaceGitSummary(context.Background(), f.home, entry)
		return gitFacts{summary: summary, summaryOK: ok}, true
	}
	ask := func() int {
		facts := w.facts(context.Background(), f.home, entry, gitGlobalStamp(f.home), observe)
		return facts.summary["dirty_count"].(int)
	}
	if ask() != 0 || ask() != 0 || observed != 1 {
		t.Fatalf("observed %d times for an unchanged workspace", observed)
	}
	f.write(filepath.Join(repo, "node_modules", "dep", "index.js"), "y\n")
	f.write(filepath.Join(repo, "node_modules", "other", "index.js"), "z\n")
	if ask() != 0 || observed != 1 {
		t.Fatalf("ignored churn caused %d observations", observed)
	}
	f.write(filepath.Join(repo, "a.txt"), "two\n")
	if ask() != 1 || ask() != 1 || observed != 2 {
		t.Fatalf("one change, %d observations", observed)
	}
}

func writeSession(t testing.TB, home, id, cwd string, lines ...string) string {
	t.Helper()
	path := filepath.Join(home, historyRoot, "--synthetic--", id+".jsonl")
	header := fmt.Sprintf(`{"type":"session","version":3,"id":%q,"timestamp":"2026-10-16T10:00:00.000Z","cwd":%q}`, id, cwd)
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(header+"\n"+strings.Join(lines, "\n")+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

func agentTitle(doc map[string]any, id string) string {
	for _, raw := range doc["agents"].([]any) {
		if a := raw.(map[string]any); a["agent_id"] == "pi:"+id {
			return a["title"].(map[string]any)["display"].(string)
		}
	}
	return ""
}

// A session file's header and title are read again whenever the file changes,
// and a new or removed file is seen at once.
func TestSnapshotSessionFactsFollowSessionFiles(t *testing.T) {
	f := newFactsHome(t)
	if err := os.Mkdir(filepath.Join(f.src, "work"), 0700); err != nil {
		t.Fatal(err)
	}
	cwd := filepath.Join(f.src, "work")
	id := "11111111-1111-4111-8111-111111111111"
	user := `{"type":"message","id":"m1","parentId":null,"timestamp":"2026-10-16T10:00:01.000Z","message":{"role":"user","content":[{"type":"text","text":"Ensimmäinen kysymys"}]}}`
	path := writeSession(t, f.home, id, cwd, user)
	if got := agentTitle(f.snapshot(), id); got != "Ensimmäinen kysymys" {
		t.Fatalf("first prompt: %q", got)
	}
	if got := agentTitle(f.snapshot(), id); got != "Ensimmäinen kysymys" {
		t.Fatalf("unchanged: %q", got)
	}
	file, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.WriteString(`{"type":"session_info","id":"i1","parentId":"m1","timestamp":"2026-10-16T10:00:02.000Z","name":"Nimetty keskustelu"}` + "\n"); err != nil {
		t.Fatal(err)
	}
	file.Close()
	if got := agentTitle(f.snapshot(), id); got != "Nimetty keskustelu" {
		t.Fatalf("appended name: %q", got)
	}
	other := "22222222-2222-4222-8222-222222222222"
	writeSession(t, f.home, other, cwd, user)
	if got := agentTitle(f.snapshot(), other); got != "Ensimmäinen kysymys" {
		t.Fatalf("new file: %q", got)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if got := agentTitle(f.snapshot(), id); got != "" {
		t.Fatalf("removed file still listed: %q", got)
	}
}

func agentChanged(doc map[string]any, id string) string {
	for _, raw := range doc["agents"].([]any) {
		if a := raw.(map[string]any); a["agent_id"] == "pi:"+id {
			changed, _ := a["changed_at"].(string)
			return changed
		}
	}
	return ""
}

// A conversation's last change is its session file's modification time, and
// the next snapshot after Pi appends to the file carries the new time.
func TestSnapshotChangedAtFollowsSessionFile(t *testing.T) {
	f := newFactsHome(t)
	if err := os.Mkdir(filepath.Join(f.src, "work"), 0700); err != nil {
		t.Fatal(err)
	}
	id := "33333333-3333-4333-8333-333333333333"
	path := writeSession(t, f.home, id, filepath.Join(f.src, "work"), `{"type":"message","id":"m1","parentId":null,"timestamp":"2026-10-16T10:00:01.000Z","message":{"role":"user","content":[{"type":"text","text":"Kysymys"}]}}`)
	earlier := time.Date(2026, 10, 16, 10, 0, 1, 0, time.UTC)
	if err := os.Chtimes(path, earlier, earlier); err != nil {
		t.Fatal(err)
	}
	if got := agentChanged(f.snapshot(), id); got != "2026-10-16T10:00:01Z" {
		t.Fatalf("changed_at %q", got)
	}
	file, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.WriteString(`{"type":"session_info","id":"i1","parentId":"m1","timestamp":"2026-10-16T10:05:00.000Z","name":"Nimi"}` + "\n"); err != nil {
		t.Fatal(err)
	}
	file.Close()
	later := earlier.Add(5 * time.Minute)
	if err := os.Chtimes(path, later, later); err != nil {
		t.Fatal(err)
	}
	if got := agentChanged(f.snapshot(), id); got != "2026-10-16T10:05:01Z" {
		t.Fatalf("changed_at after append %q", got)
	}
}

// Taskfleet's listing is reused while its run records are unchanged; a new
// node record hides its worktree container at once, and a supervisor's
// heartbeat does not cost another listing.
func TestSnapshotTaskfleetFactsFollowRunRecords(t *testing.T) {
	f := newFactsHome(t)
	calls := filepath.Join(f.home, "taskfleet-calls")
	listing := filepath.Join(f.home, "taskfleet-list.json")
	f.write(listing, `{"schema_version":1,"data":{"runs":[]}}`)
	f.write(filepath.Join(f.home, ".local", "bin", "taskfleet"), "#!/bin/sh\necho call >> \"$HOME/taskfleet-calls\"\ncat \"$HOME/taskfleet-list.json\"\n")
	if err := os.Chmod(filepath.Join(f.home, ".local", "bin", "taskfleet"), 0700); err != nil {
		t.Fatal(err)
	}
	container := filepath.Join(f.src, "repo__worktrees")
	if err := os.MkdirAll(filepath.Join(container, "wt-task"), 0700); err != nil {
		t.Fatal(err)
	}
	listed := func() int {
		b, _ := os.ReadFile(calls)
		return strings.Count(string(b), "call")
	}
	if workspaceNamed(f.snapshot(), "repo__worktrees") == nil || workspaceNamed(f.snapshot(), "repo__worktrees") == nil || listed() != 1 {
		t.Fatalf("container should be visible and listed once, listed %d", listed())
	}
	run := "01m52z7x908xeehvas4j6xrtj1"
	dir := filepath.Join(f.home, ".taskfleet", "runs", run)
	f.write(filepath.Join(dir, "manifest.json"), `{"kind":"spinoff"}`)
	f.write(filepath.Join(dir, "nodes", "n-0001.json"), `{"worktree_path":"`+filepath.Join(container, "wt-task")+`"}`)
	f.write(listing, `{"schema_version":1,"data":{"runs":[{"run_id":"`+run+`","kind":"spinoff","source_repo":"`+filepath.Join(f.src, "repo")+`","node_transcripts":[{"node_id":"n-0001","worktree_path":"`+filepath.Join(container, "wt-task")+`"}]}]}}`)
	if workspaceNamed(f.snapshot(), "repo__worktrees") != nil || listed() != 2 {
		t.Fatalf("new node record: listed %d", listed())
	}
	f.write(filepath.Join(dir, "supervisor.state.json"), `{"state":"alive"}`)
	f.write(filepath.Join(dir, "agent.log"), "working\n")
	if workspaceNamed(f.snapshot(), "repo__worktrees") != nil || listed() != 2 {
		t.Fatalf("heartbeat caused a listing: %d", listed())
	}
	// A node record rewritten in place (same directory entries) still counts.
	f.write(filepath.Join(dir, "nodes", "n-0001.json"), `{"worktree_path":"`+filepath.Join(f.src, "elsewhere")+`"}`)
	f.write(listing, `{"schema_version":1,"data":{"runs":[]}}`)
	if workspaceNamed(f.snapshot(), "repo__worktrees") == nil || listed() != 3 {
		t.Fatalf("rewritten node record: listed %d", listed())
	}
}

// BenchmarkSnapshotWarm is a home sized like the test server's account: nine
// Git workspaces and two dozen Pi sessions, all unchanged between snapshots.
func BenchmarkSnapshotWarm(b *testing.B) {
	f := newFactsHome(b)
	for i := range 9 {
		repo := filepath.Join(f.src, fmt.Sprintf("repo%d", i))
		for j := range 40 {
			f.write(filepath.Join(repo, fmt.Sprintf("pkg%d", j%5), fmt.Sprintf("f%d.txt", j)), "x\n")
		}
		f.git(repo, "init", "-q")
		f.git(repo, "add", ".")
		f.git(repo, "commit", "-qm", "first")
		f.write(filepath.Join(repo, "pkg0", "f0.txt"), "changed\n")
	}
	user := `{"type":"message","id":"m1","parentId":null,"timestamp":"2026-10-16T10:00:01.000Z","message":{"role":"user","content":[{"type":"text","text":"Kysymys"}]}}`
	for i := range 24 {
		writeSession(b, f.home, fmt.Sprintf("33333333-3333-4333-8333-%012d", i), filepath.Join(f.src, fmt.Sprintf("repo%d", i%9)), user)
	}
	f.snapshot()
	b.ResetTimer()
	for b.Loop() {
		f.snapshot()
	}
}

// A killed supervisor changes no stamped record, while Taskfleet probes its
// liveness at list time: a listing with unsettled runs must not live forever.
func TestTaskfleetListingWithUnsettledRunsExpires(t *testing.T) {
	f := newFactsHome(t)
	calls := filepath.Join(f.home, "taskfleet-calls")
	f.write(filepath.Join(f.home, ".local", "bin", "taskfleet"), "#!/bin/sh\necho call >> \"$HOME/taskfleet-calls\"\ncat \"$HOME/taskfleet-list.json\"\n")
	if err := os.Chmod(filepath.Join(f.home, ".local", "bin", "taskfleet"), 0700); err != nil {
		t.Fatal(err)
	}
	listed := func() int {
		b, _ := os.ReadFile(calls)
		return strings.Count(string(b), "call")
	}
	facts := &taskfleetRunFacts{}
	for _, status := range []string{"done", "running"} {
		f.write(filepath.Join(f.home, "taskfleet-list.json"), `{"schema_version":1,"data":{"runs":[{"run_id":"01m52z7x908xeehvas4j6xrtj1","kind":"spinoff","status":"`+status+`"}]}}`)
		before := listed()
		facts.mu.Lock()
		facts.valid = false
		facts.mu.Unlock()
		facts.list(context.Background(), f.home)
		facts.list(context.Background(), f.home)
		if listed() != before+1 {
			t.Fatalf("%s: unchanged records listed %d times", status, listed()-before)
		}
		facts.mu.Lock()
		expiring := !facts.until.IsZero()
		if expiring {
			facts.until = time.Now().Add(-time.Second)
		}
		facts.mu.Unlock()
		facts.list(context.Background(), f.home)
		if want := status == "running"; expiring != want || (listed() == before+2) != want {
			t.Fatalf("%s: expiring %v, listings %d", status, expiring, listed()-before)
		}
	}
}
