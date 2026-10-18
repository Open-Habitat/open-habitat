//go:build linux

package daemon

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// worktreeFixture is a pushed clone ~/src/app with linked worktrees in the
// sibling layout ~/src/app__worktrees/<name>.
type worktreeFixture struct {
	*trashFixture
	id string
}

func newWorktreeFixture(t *testing.T) *worktreeFixture {
	f := &worktreeFixture{trashFixture: newTrashFixture(t)}
	f.pushedClone("app")
	f.id, _ = f.target("app")
	return f
}

func (f *worktreeFixture) wt(name string) string { return f.src("app__worktrees/" + name) }

// add makes a worktree on a new branch from main, optionally with one commit.
func (f *worktreeFixture) add(name string, commit bool) {
	f.t.Helper()
	f.git(f.src("app"), "worktree", "add", "-q", "-b", name, f.wt(name))
	if commit {
		write(f.t, filepath.Join(f.wt(name), name+".txt"), name+"\n")
		f.git(f.wt(name), "add", ".")
		f.git(f.wt(name), "commit", "-q", "-m", name)
	}
}

func (f *worktreeFixture) listing(scope string) map[string]any {
	f.t.Helper()
	req := map[string]any{"action": "worktree_list"}
	if scope != "" {
		req["workspace_id"] = scope
	}
	code, body := f.request(req)
	if code != 200 {
		f.t.Fatalf("list: %d %v", code, body)
	}
	return body
}

func (f *worktreeFixture) row(name string) map[string]any {
	f.t.Helper()
	for _, w := range f.listing(f.id)["worktrees"].([]any) {
		m := w.(map[string]any)
		if m["name"] == name {
			return m
		}
	}
	f.t.Fatalf("worktree %s not listed", name)
	return nil
}

func (f *worktreeFixture) removeRow(row map[string]any, disposal, confirmation string) (int, map[string]any) {
	f.t.Helper()
	req := map[string]any{"action": "worktree_remove", "workspace_id": row["workspace_id"], "entry": row["entry"], "observation_token": row["observation_token"], "disposal": disposal}
	if confirmation != "" {
		req["confirmation"] = confirmation
	}
	return f.request(req)
}

func (f *worktreeFixture) branchExists(name string) bool {
	cmd := exec.Command("/usr/bin/git", "rev-parse", "--verify", "--quiet", "refs/heads/"+name)
	cmd.Dir = f.src("app")
	return cmd.Run() == nil
}

func actions(row map[string]any) string {
	var out []string
	for _, a := range row["actions"].([]any) {
		out = append(out, a.(string))
	}
	return strings.Join(out, ",")
}

func TestWorktreeListShowsEachGitState(t *testing.T) {
	f := newWorktreeFixture(t)
	f.add("merged", true)
	f.git(f.src("app"), "merge", "-q", "--ff-only", "merged")
	f.add("fresh", false) // no commits of its own: already in main
	f.add("ahead", true)
	f.add("dirty", true)
	write(t, filepath.Join(f.wt("dirty"), "dirty.txt"), "changed\n")
	write(t, filepath.Join(f.wt("dirty"), "new.txt"), "new\n")
	write(t, filepath.Join(f.wt("dirty"), ".gitignore"), "build/\n")
	write(t, filepath.Join(f.wt("dirty"), "build", "out.bin"), "x")
	f.add("gone", false)
	if e := os.RemoveAll(f.wt("gone")); e != nil {
		t.Fatal(e)
	}
	f.add("locked", false)
	f.git(f.src("app"), "worktree", "lock", "--reason", "on a USB disk", f.wt("locked"))
	// A detached HEAD with a commit no ref contains.
	f.git(f.src("app"), "worktree", "add", "-q", "--detach", f.wt("detached"))
	write(t, filepath.Join(f.wt("detached"), "d.txt"), "d\n")
	f.git(f.wt("detached"), "add", ".")
	f.git(f.wt("detached"), "commit", "-q", "-m", "detached")
	// Made elsewhere by any tool: still in Git's registry, but outside home.
	elsewhere := filepath.Join(t.TempDir(), "elsewhere")
	f.git(f.src("app"), "worktree", "add", "-q", "-b", "elsewhere", elsewhere)

	want := map[string]struct{ state, actions string }{
		"merged":    {"merged", "remove"},
		"fresh":     {"merged", "remove"},
		"ahead":     {"unmerged", "remove"},
		"dirty":     {"dirty", "commit,force"},
		"gone":      {"missing", "prune"},
		"locked":    {"locked", ""},
		"detached":  {"unmerged", "force"},
		"elsewhere": {"merged", ""},
	}
	rows := f.listing(f.id)["worktrees"].([]any)
	if len(rows) != len(want) {
		t.Fatalf("listed %d worktrees, want %d: %v", len(rows), len(want), rows)
	}
	for _, r := range rows {
		m := r.(map[string]any)
		w := want[m["name"].(string)]
		if m["state"] != w.state || actions(m) != w.actions {
			t.Errorf("%s: state %v actions %q, want %s %q (%v)", m["name"], m["state"], actions(m), w.state, w.actions, m)
		}
	}
	dirty := f.row("dirty")
	if dirty["changed"] != float64(1) || dirty["untracked"] != float64(2) || dirty["ignored"] != float64(1) || dirty["ignored_paths"].([]any)[0] != "build/" {
		t.Fatalf("dirty facts: %v", dirty)
	}
	if p := f.row("ahead"); p["base"] != "main" || p["ahead"] != float64(1) || p["branch"] != "ahead" || p["path"] != "~/src/app__worktrees/ahead" {
		t.Fatalf("ahead facts: %v", p)
	}
	if l := f.row("locked"); l["locked_reason"] != "on a USB disk" {
		t.Fatalf("lock reason: %v", l)
	}
	if d := f.row("detached"); d["unreachable_head"] != true || d["branch"] != nil {
		t.Fatalf("detached facts: %v", d)
	}
	if b := blockerKinds(f.row("elsewhere")); len(b) != 1 || b[0] != "outside_home" {
		t.Fatalf("elsewhere blockers: %v", b)
	}
	// The whole-home listing is the same set; a directory workspace has none.
	if all := f.listing("")["worktrees"].([]any); len(all) != len(want) {
		t.Fatalf("home listing: %d", len(all))
	}
	// The local upstream recorded on the branch is its base.
	f.git(f.src("app"), "branch", "-q", "dev", "main")
	f.git(f.src("app"), "worktree", "add", "-q", "--track", "-b", "feature", f.wt("feature"), "dev")
	f.git(f.src("app"), "commit", "-q", "--allow-empty", "-m", "main moves on")
	if r := f.row("feature"); r["base"] != "dev" || r["state"] != "merged" {
		t.Fatalf("upstream base: %v", r)
	}
	// The source branch Taskfleet records is the top bar's base and wins.
	f.git(f.src("app"), "worktree", "add", "-q", "-b", "recorded", f.wt("recorded"), "dev")
	f.git(f.src("app"), "config", "branch.recorded.workmux-base", "dev")
	if r := f.row("recorded"); r["base"] != "dev" || r["state"] != "merged" {
		t.Fatalf("recorded base: %v", r)
	}
	// Without a record, origin/HEAD is the base, as in the top bar; the
	// commit merged into local main but never pushed counts as ahead too.
	f.git(f.src("app"), "remote", "set-head", "origin", "main")
	if r := f.row("ahead"); r["base"] != "origin/main" || r["ahead"] != float64(2) || r["state"] != "unmerged" {
		t.Fatalf("origin/HEAD base: %v", r)
	}
}

func TestWorktreeRemovalByState(t *testing.T) {
	f := newWorktreeFixture(t)
	admin := func(name string) string { return f.src("app/.git/worktrees/" + name) }

	// Merged: checkout, registry entry and branch go.
	f.add("merged", true)
	f.git(f.src("app"), "merge", "-q", "--ff-only", "merged")
	code, body := f.removeRow(f.row("merged"), "remove", "")
	if code != 200 || body["state"] != "removed" || body["branch_deleted"] != true || exists(f.wt("merged")) || exists(admin("merged")) || f.branchExists("merged") {
		t.Fatalf("merged removal: %d %v", code, body)
	}

	// Not merged: the checkout goes, the branch keeps its commits.
	f.add("ahead", true)
	code, body = f.removeRow(f.row("ahead"), "remove", "")
	if code != 200 || body["state"] != "removed" || body["branch_kept"] != "not_merged" || exists(f.wt("ahead")) || !f.branchExists("ahead") {
		t.Fatalf("unmerged removal: %d %v", code, body)
	}

	// Uncommitted changes saved to the branch, untracked files included,
	// with the person's own Git identity.
	write(t, filepath.Join(f.cfg.Home, ".gitconfig"), "[user]\n\tname = Person\n\temail = person@example.invalid\n")
	f.add("save", true)
	before := f.git(f.wt("save"), "rev-parse", "HEAD")
	write(t, filepath.Join(f.wt("save"), "save.txt"), "edited\n")
	write(t, filepath.Join(f.wt("save"), "untracked.txt"), "keep me\n")
	if code, _ := f.removeRow(f.row("save"), "remove", ""); code != 409 {
		t.Fatalf("plain removal of a dirty worktree must be refused: %d", code)
	}
	code, body = f.removeRow(f.row("save"), "commit", "")
	if code != 200 || body["state"] != "removed" || exists(f.wt("save")) || !f.branchExists("save") {
		t.Fatalf("save and remove: %d %v", code, body)
	}
	if f.git(f.src("app"), "rev-parse", "save^") != before || f.git(f.src("app"), "show", "save:untracked.txt") != "keep me" || body["committed"] != f.git(f.src("app"), "rev-parse", "save") {
		t.Fatalf("the branch does not hold the saved work: %v", body)
	}

	// Forced: only with the worktree's name typed; changes are lost.
	f.add("force", true)
	write(t, filepath.Join(f.wt("force"), "force.txt"), "lost\n")
	row := f.row("force")
	if code, body := f.removeRow(row, "force", "forc"); code != 409 || errorCode(body) != "confirmation_mismatch" || !exists(f.wt("force")) {
		t.Fatalf("wrong confirmation: %d %v", code, body)
	}
	code, body = f.removeRow(row, "force", "force")
	if code != 200 || body["state"] != "removed" || exists(f.wt("force")) || !f.branchExists("force") {
		t.Fatalf("forced removal: %d %v", code, body)
	}

	// Missing directory: prune the registry entry only.
	f.add("gone", true)
	if e := os.RemoveAll(f.wt("gone")); e != nil {
		t.Fatal(e)
	}
	code, body = f.removeRow(f.row("gone"), "prune", "")
	if code != 200 || body["state"] != "pruned" || exists(admin("gone")) || !f.branchExists("gone") {
		t.Fatalf("prune: %d %v", code, body)
	}
	if out := f.git(f.src("app"), "worktree", "list", "--porcelain"); strings.Count(out, "worktree ") != 1 {
		t.Fatalf("git still lists worktrees: %s", out)
	}

	// Locked: shown, never removed.
	f.add("locked", false)
	f.git(f.src("app"), "worktree", "lock", f.wt("locked"))
	row = f.row("locked")
	if code, body := f.removeRow(row, "remove", ""); code != 409 || errorCode(body) != "worktree_changed" || !exists(f.wt("locked")) {
		t.Fatalf("locked removal: %d %v", code, body)
	}
}

func TestWorktreeRemovalBlockers(t *testing.T) {
	f := newWorktreeFixture(t)
	f.add("busy", true)

	// A live Taskfleet run owns the worktree: listed, but nothing to do.
	script := filepath.Join(f.cfg.Home, ".local", "bin", "taskfleet")
	runs := func(status string) {
		write(t, script, "#!/bin/sh\necho '{\"schema_version\":1,\"data\":{\"runs\":[{\"run_id\":\"01m53433zdhmcc9q1spepb30gz\",\"status\":\""+status+"\",\"worktree_path\":\""+f.wt("busy")+"\"}]}}'\n")
		if e := os.Chmod(script, 0700); e != nil {
			t.Fatal(e)
		}
	}
	runs("running")
	row := f.row("busy")
	if b := blockerKinds(row); len(b) != 1 || b[0] != "taskfleet_run" || actions(row) != "" {
		t.Fatalf("live run: %v", row)
	}
	if code, body := f.removeRow(row, "remove", ""); code != 200 || body["state"] != "blocked" || !exists(f.wt("busy")) {
		t.Fatalf("removal under a live run: %d %v", code, body)
	}
	// The run ended between the listing and the click: the facts changed.
	runs("done")
	if code, body := f.removeRow(row, "remove", ""); code != 409 || errorCode(body) != "worktree_changed" {
		t.Fatalf("stale live-run row: %d %v", code, body)
	}
	for _, status := range []string{"pending", "done", "cancelled", "failed"} {
		runs(status)
		live := len(blockerKinds(f.row("busy"))) > 0
		if live != (status == "pending") {
			t.Fatalf("run status %s: blocked=%v", status, live)
		}
	}
	// A live run that names no worktree may own any of them.
	write(t, script, "#!/bin/sh\necho '{\"schema_version\":1,\"data\":{\"runs\":[{\"run_id\":\"01m53433zdhmcc9q1spepb30gz\",\"status\":\"running\",\"worktree_path\":null}]}}'\n")
	if b := blockerKinds(f.row("busy")); len(b) != 1 || b[0] != "unknown:taskfleet" {
		t.Fatalf("live run without a worktree: %v", b)
	}
	// An unreadable Taskfleet reply blocks.
	write(t, script, "#!/bin/sh\nexit 3\n")
	if b := blockerKinds(f.row("busy")); len(b) != 1 || b[0] != "unknown:taskfleet" {
		t.Fatalf("unreadable Taskfleet: %v", b)
	}
	if e := os.Remove(script); e != nil {
		t.Fatal(e)
	}

	// A live managed Pi child in the worktree, or in a directory below it.
	exited := make(chan struct{})
	f.c.sessions["22222222-2222-4222-8222-222222222222"] = &conversation{id: "22222222-2222-4222-8222-222222222222", cwd: f.wt("busy") + "/sub", rpc: &piRPC{exited: exited}}
	code, body := f.removeRow(f.row("busy"), "remove", "")
	if code != 200 || body["state"] != "blocked" || blockerKinds(body)[0] != "pi_session" || !exists(f.wt("busy")) {
		t.Fatalf("live Pi: %d %v", code, body)
	}
	close(exited)

	// A process of the person with its cwd inside, read from /proc.
	sleeper := exec.Command("/bin/sleep", "30")
	sleeper.Dir = f.wt("busy")
	if e := sleeper.Start(); e != nil {
		t.Fatal(e)
	}
	deletionProcRoot = "/proc"
	code, body = f.removeRow(f.row("busy"), "remove", "")
	_ = sleeper.Process.Kill()
	_ = sleeper.Wait()
	if code != 200 || body["state"] != "blocked" || !exists(f.wt("busy")) {
		t.Fatalf("process inside: %d %v", code, body)
	}
	found := false
	for _, b := range body["blockers"].([]any) {
		m := b.(map[string]any)
		found = found || m["kind"] == "process" && m["comm"] == "sleep"
	}
	if !found {
		t.Fatalf("process not named: %v", body)
	}
	deletionProcRoot = f.proc

	// Another repository below the checkout: a commit to the branch would
	// record only a gitlink, so neither saving nor force removes it.
	f.git(f.wt("busy"), "init", "-q", "embedded")
	write(t, filepath.Join(f.wt("busy"), "embedded", "only-here.txt"), "x")
	code, body = f.removeRow(f.row("busy"), "force", "busy")
	if code != 200 || body["state"] != "blocked" || blockerKinds(body)[0] != "nested_repository" || !exists(f.wt("busy/embedded/only-here.txt")) {
		t.Fatalf("embedded repository: %d %v", code, body)
	}
	if e := os.RemoveAll(f.wt("busy/embedded")); e != nil {
		t.Fatal(e)
	}

	// A worktree registered inside this one would be taken along, even by
	// a forced removal (Git reports it as untracked in the outer one).
	f.git(f.src("app"), "worktree", "add", "-q", "-b", "inner", f.wt("busy")+"/inner")
	code, body = f.removeRow(f.row("busy"), "force", "busy")
	if code != 200 || body["state"] != "blocked" || blockerKinds(body)[0] != "contains_linked_worktree" || !exists(f.wt("busy/inner")) {
		t.Fatalf("nested worktree: %d %v", code, body)
	}
}

func TestWorktreeRemovalRefusesChangedFacts(t *testing.T) {
	f := newWorktreeFixture(t)
	f.add("w", true)
	row := f.row("w")
	// A change after the listing: nothing is removed.
	write(t, filepath.Join(f.wt("w"), "late.txt"), "late\n")
	if code, body := f.removeRow(row, "remove", ""); code != 409 || errorCode(body) != "worktree_changed" || !exists(f.wt("w/late.txt")) {
		t.Fatalf("changed worktree: %d %v", code, body)
	}
	if e := os.Remove(f.wt("w/late.txt")); e != nil {
		t.Fatal(e)
	}
	// An ignored file that appears changes what the confirmation names.
	f.git(f.wt("w"), "config", "core.excludesFile", filepath.Join(f.cfg.Home, "ignore"))
	write(t, filepath.Join(f.cfg.Home, "ignore"), "*.secret\n")
	row = f.row("w")
	write(t, filepath.Join(f.wt("w"), "new.secret"), "s")
	if r := f.row("w"); r["ignored"] != float64(1) || r["state"] != "unmerged" {
		t.Fatalf("the new file must be ignored, not untracked: %v", r)
	}
	if code, body := f.removeRow(row, "remove", ""); code != 409 || errorCode(body) != "worktree_changed" || !exists(f.wt("w/new.secret")) {
		t.Fatalf("new ignored file: %d %v", code, body)
	}
	if e := os.Remove(f.wt("w/new.secret")); e != nil {
		t.Fatal(e)
	}
	// A new commit moves the tip.
	row = f.row("w")
	f.git(f.wt("w"), "commit", "-q", "--allow-empty", "-m", "more")
	if code, body := f.removeRow(row, "remove", ""); code != 409 || errorCode(body) != "worktree_changed" {
		t.Fatalf("moved tip: %d %v", code, body)
	}
	// The checkout swapped for a symlink to somewhere else: the target is
	// never touched.
	row = f.row("w")
	victim := filepath.Join(f.cfg.Home, "victim")
	write(t, filepath.Join(victim, "keep.txt"), "keep\n")
	if e := os.Rename(f.wt("w"), f.wt("w.moved")); e != nil {
		t.Fatal(e)
	}
	if e := os.Symlink(victim, f.wt("w")); e != nil {
		t.Fatal(e)
	}
	if code, _ := f.removeRow(row, "remove", ""); code != 409 || !exists(filepath.Join(victim, "keep.txt")) {
		t.Fatalf("symlinked checkout: %d", code)
	}
	if r := f.row("w"); r["state"] != "unknown" || actions(r) != "" {
		t.Fatalf("a symlink is not the worktree: %v", r)
	}
	// A directory that does not point back to the registry entry.
	if e := os.Remove(f.wt("w")); e != nil {
		t.Fatal(e)
	}
	write(t, filepath.Join(f.wt("w"), ".git"), "gitdir: /elsewhere/.git/worktrees/w\n")
	if r := f.row("w"); r["state"] != "unknown" || actions(r) != "" {
		t.Fatalf("an impostor directory is not the worktree: %v", r)
	}
	// A registry entry that cannot be read is listed by its entry name.
	if e := os.Remove(f.src("app/.git/worktrees/w/gitdir")); e != nil {
		t.Fatal(e)
	}
	if r := f.row("w"); r["state"] != "unknown" || r["path"] != nil || r["entry"] != "w" || actions(r) != "" {
		t.Fatalf("unreadable entry: %v", r)
	}
	// A browser-supplied entry that is not a registry entry.
	if code, body := f.request(map[string]any{"action": "worktree_remove", "workspace_id": f.id, "entry": "nope", "observation_token": row["observation_token"], "disposal": "remove"}); code != 409 || errorCode(body) != "worktree_missing" {
		t.Fatalf("unknown entry: %d %v", code, body)
	}
}

func TestWorktreeMergedBranchIsCompareAndDelete(t *testing.T) {
	f := newWorktreeFixture(t)
	f.add("m", true)
	f.git(f.src("app"), "merge", "-q", "--ff-only", "m")
	row := f.row("m")
	old := worktreeHook
	t.Cleanup(func() { worktreeHook = old })
	// The branch moves after the last check: the checkout goes, the branch
	// and its new commit stay.
	worktreeHook = func(string) error {
		tip := f.git(f.src("app"), "commit-tree", "-p", "m", "-m", "late", "m^{tree}")
		f.git(f.src("app"), "update-ref", "refs/heads/m", tip)
		return nil
	}
	code, body := f.removeRow(row, "remove", "")
	if code != 200 || body["state"] != "removed" || body["branch_kept"] != "moved" || !f.branchExists("m") || exists(f.wt("m")) {
		t.Fatalf("moved branch: %d %v", code, body)
	}
}

func TestWorktreeCleanMergedActsOnTheListedSet(t *testing.T) {
	f := newWorktreeFixture(t)
	for _, n := range []string{"a", "b"} {
		f.add(n, true)
		f.git(f.src("app"), "merge", "-q", "--ff-only", n)
	}
	f.add("open", true)
	listing := f.listing("")
	token := listing["listing_token"]
	// Another merged worktree arrives after the person looked.
	f.add("late", false)
	if code, body := f.request(map[string]any{"action": "worktree_clean_merged", "listing_token": token}); code != 409 || errorCode(body) != "worktrees_changed" || !exists(f.wt("a")) {
		t.Fatalf("changed set: %d %v", code, body)
	}
	// An unmerged worktree changing does not change the merged set.
	listing = f.listing("")
	write(t, filepath.Join(f.wt("open"), "x"), "x")
	code, body := f.request(map[string]any{"action": "worktree_clean_merged", "listing_token": listing["listing_token"]})
	if code != 200 || body["state"] != "cleaned" || body["removed"] != float64(3) || len(body["kept"].([]any)) != 0 {
		t.Fatalf("clean merged: %d %v", code, body)
	}
	for _, n := range []string{"a", "b", "late"} {
		if exists(f.wt(n)) || f.branchExists(n) {
			t.Fatalf("%s not cleaned", n)
		}
	}
	if !exists(f.wt("open")) || !f.branchExists("open") {
		t.Fatal("an unmerged worktree was cleaned")
	}
}

func TestWorktreeRequestGrammar(t *testing.T) {
	f := newWorktreeFixture(t)
	token := "wt_" + strings.Repeat("a", 24)
	for _, req := range []map[string]any{
		{"action": "worktree_list", "entry": "x"},
		{"action": "worktree_list", "workspace_id": "../x"},
		{"action": "worktree_remove", "workspace_id": f.id, "entry": "../x", "observation_token": token, "disposal": "remove"},
		{"action": "worktree_remove", "workspace_id": f.id, "entry": "x", "observation_token": token, "disposal": "shred"},
		{"action": "worktree_remove", "workspace_id": f.id, "entry": "x", "observation_token": token, "disposal": "force"},
		{"action": "worktree_remove", "workspace_id": f.id, "entry": "x", "observation_token": token, "disposal": "remove", "confirmation": "x"},
		{"action": "worktree_remove", "entry": "x", "observation_token": token, "disposal": "remove"},
		{"action": "worktree_clean_merged"},
		{"action": "worktree_clean_merged", "listing_token": strings.Repeat("0", 64), "entry": "x"},
	} {
		if code, _ := f.request(req); code != 400 {
			t.Errorf("%v: %d, want 400", req, code)
		}
	}
	if code, body := f.request(map[string]any{"action": "worktree_list", "workspace_id": "ws_missingmissing"}); code != 409 || errorCode(body) != "workspace_missing" {
		t.Fatalf("missing scope: %d %v", code, body)
	}
}

// A linked checkout directly in ~/src is a workspace of its own; worktree
// cleanup never removes the person's only visible workspace either.
func TestWorktreeRemovalKeepsTheLastVisibleWorkspace(t *testing.T) {
	f := newWorktreeFixture(t)
	f.git(f.src("app"), "worktree", "add", "-q", "-b", "feature", f.src("feature"))
	f.git(f.src("app"), "merge", "-q", "--ff-only", "feature")
	f.hide("app", true)
	f.hide("toinen", true)
	row := f.row("feature")
	if actions(row) != "remove" {
		t.Fatalf("listed actions: %v", row)
	}
	code, body := f.removeRow(row, "remove", "")
	if code != 200 || body["state"] != "blocked" || strings.Join(blockerKinds(body), ",") != "last_workspace" || !exists(f.src("feature")) {
		t.Fatalf("removal of the last visible workspace: %d %v", code, body)
	}
	code, body = f.request(map[string]any{"action": "worktree_clean_merged", "workspace_id": f.id, "listing_token": f.listing(f.id)["listing_token"]})
	if code != 200 || body["removed"] != float64(0) || !exists(f.src("feature")) {
		t.Fatalf("bulk cleanup of the last visible workspace: %d %v", code, body)
	}
	f.hide("toinen", false)
	if code, body = f.removeRow(f.row("feature"), "remove", ""); code != 200 || body["state"] != "removed" || exists(f.src("feature")) {
		t.Fatalf("removal with another visible workspace: %d %v", code, body)
	}
}
