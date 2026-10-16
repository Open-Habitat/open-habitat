//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// trashFixture is one synthetic home with ~/src, a controller without Pi
// children and an empty synthetic /proc unless a test supplies processes.
type trashFixture struct {
	t       *testing.T
	cfg     transport.Config
	c       *ConversationController
	handler http.Handler
	proc    string
}

func newTrashFixture(t *testing.T) *trashFixture {
	t.Helper()
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	if e := os.Mkdir(filepath.Join(cfg.Home, "src"), 0700); e != nil {
		t.Fatal(e)
	}
	f := &trashFixture{t: t, cfg: cfg, proc: t.TempDir()}
	f.c = &ConversationController{cfg: cfg, home: cfg.Home, sessions: map[string]*conversation{}}
	f.handler = WorkspaceHandlerWithArchive(cfg, func(*http.Request) bool { return true }, f.c)
	oldProc, oldHook, oldRename, oldGrace, oldDevice := deletionProcRoot, trashHook, renameNoReplace, trashIntentGrace, trashDevice
	deletionProcRoot = f.proc
	t.Cleanup(func() {
		deletionProcRoot, trashHook, renameNoReplace, trashIntentGrace, trashDevice = oldProc, oldHook, oldRename, oldGrace, oldDevice
	})
	return f
}

func (f *trashFixture) src(name string) string { return filepath.Join(f.cfg.Home, "src", name) }
func (f *trashFixture) trash(part, name string) string {
	return filepath.Join(f.cfg.Home, ".local", "share", "Trash", part, name)
}

func (f *trashFixture) request(input map[string]any) (int, map[string]any) {
	f.t.Helper()
	b, _ := json.Marshal(input)
	r := httptest.NewRequest("POST", "http://unix"+WorkspacePath, bytes.NewReader(b))
	r.RequestURI = WorkspacePath
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	f.handler.ServeHTTP(w, r)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func errorCode(body map[string]any) string {
	if e, ok := body["error"].(map[string]any); ok {
		s, _ := e["code"].(string)
		return s
	}
	return ""
}

// target observes name afresh and returns its ID and observation token.
func (f *trashFixture) target(name string) (string, string) {
	f.t.Helper()
	for _, w := range Discover(f.cfg).Entries {
		if w.Name == name {
			id := w.WorkspaceID
			if id == "" {
				id = opaque("ws_", f.cfg.Provider+":"+f.cfg.Subject+":"+w.Name)
			}
			return id, workspaceToken(f.cfg, w)
		}
	}
	f.t.Fatalf("workspace %s not discovered", name)
	return "", ""
}

func (f *trashFixture) check(name string) map[string]any {
	f.t.Helper()
	id, token := f.target(name)
	code, body := f.request(map[string]any{"action": "delete_check", "workspace_id": id, "observation_token": token})
	if code != 200 {
		f.t.Fatalf("check %s: %d %v", name, code, body)
	}
	return body
}

func (f *trashFixture) remove(name, disposal string) (int, map[string]any) {
	f.t.Helper()
	id, token := f.target(name)
	return f.request(map[string]any{"action": "delete", "workspace_id": id, "observation_token": token, "disposal": disposal})
}

func (f *trashFixture) list() []map[string]any {
	f.t.Helper()
	code, body := f.request(map[string]any{"action": "trash_list"})
	if code != 200 {
		f.t.Fatalf("list: %d %v", code, body)
	}
	var out []map[string]any
	for _, e := range body["entries"].([]any) {
		out = append(out, e.(map[string]any))
	}
	return out
}

func (f *trashFixture) git(dir string, args ...string) string {
	f.t.Helper()
	cmd := exec.Command("/usr/bin/git", append([]string{"-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "init.defaultBranch=main", "-c", "protocol.file.allow=always"}, args...)...)
	cmd.Dir = dir
	cmd.Env = []string{"HOME=" + f.cfg.Home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1"}
	out, err := cmd.CombinedOutput()
	if err != nil {
		f.t.Fatalf("git %v: %v %s", args, err, out)
	}
	return strings.TrimSpace(string(out))
}

// pushedClone makes ~/src/<name> a clone of a bare remote with one pushed commit.
func (f *trashFixture) pushedClone(name string) string {
	f.t.Helper()
	remote := filepath.Join(f.t.TempDir(), "remote.git")
	f.git(f.cfg.Home, "init", "-q", "--bare", remote)
	f.git(f.cfg.Home, "clone", "-q", remote, f.src(name))
	write(f.t, filepath.Join(f.src(name), "README"), "hello\n")
	f.git(f.src(name), "add", "README")
	f.git(f.src(name), "commit", "-q", "-m", "first")
	f.git(f.src(name), "push", "-q", "origin", "main")
	return remote
}

func write(t *testing.T, path, body string) {
	t.Helper()
	if e := os.MkdirAll(filepath.Dir(path), 0700); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(path, []byte(body), 0600); e != nil {
		t.Fatal(e)
	}
}

func inode(t *testing.T, path string) uint64 {
	t.Helper()
	var s unix.Stat_t
	if e := unix.Lstat(path, &s); e != nil {
		t.Fatal(e)
	}
	return s.Ino
}

func exists(path string) bool {
	_, err := os.Lstat(path)
	return err == nil
}

func blockerKinds(body map[string]any) []string {
	var kinds []string
	for _, b := range body["blockers"].([]any) {
		m := b.(map[string]any)
		kind := m["kind"].(string)
		if check, ok := m["check"].(string); ok {
			kind += ":" + check
		}
		kinds = append(kinds, kind)
	}
	return kinds
}

func TestWorkspaceTrashMoveRestoreAndPermanentDelete(t *testing.T) {
	f := newTrashFixture(t)
	write(t, f.src("notes")+"/a/b.txt", "kept\n")
	original := inode(t, f.src("notes"))
	check := f.check("notes")
	if check["outcome"] != "trash" || len(check["blockers"].([]any)) != 0 || check["facts"].(map[string]any)["kind"] != "directory" {
		t.Fatalf("plain directory check: %v", check)
	}
	code, body := f.remove("notes", "trash")
	if code != 200 || body["state"] != "trashed" || body["entry"] != "notes" {
		t.Fatalf("delete: %d %v", code, body)
	}
	if exists(f.src("notes")) || inode(t, f.trash("files", "notes")) != original {
		t.Fatal("the observed directory was not moved whole into the Trash")
	}
	info, err := os.ReadFile(f.trash("info", "notes.trashinfo"))
	if err != nil || !strings.HasPrefix(string(info), "[Trash Info]\nPath="+trashURLPath(f.src("notes"))+"\nDeletionDate=") {
		t.Fatalf("info file: %q %v", info, err)
	}
	entries := f.list()
	if len(entries) != 1 || entries[0]["name"] != "notes" || entries[0]["restore"] != "available" || entries[0]["kind"] != "workspace" {
		t.Fatalf("listing: %v", entries)
	}
	// A second workspace of the same name gets the next free entry name.
	write(t, f.src("notes")+"/other", "second\n")
	if code, body = f.remove("notes", "trash"); code != 200 || body["entry"] != "notes.2" {
		t.Fatalf("second delete: %d %v", code, body)
	}
	if code, body = f.request(map[string]any{"action": "trash_delete", "entry": "notes.2", "confirmation": "wrong"}); code != 409 || errorCode(body) != "confirmation_mismatch" {
		t.Fatalf("mismatched confirmation: %d %v", code, body)
	}
	if code, body = f.request(map[string]any{"action": "trash_delete", "entry": "notes.2", "confirmation": "notes"}); code != 200 || body["state"] != "deleted" {
		t.Fatalf("permanent delete: %d %v", code, body)
	}
	if exists(f.trash("files", "notes.2")) || exists(f.trash("info", "notes.2.trashinfo")) {
		t.Fatal("permanently deleted entry remains")
	}
	if code, body = f.request(map[string]any{"action": "trash_restore", "entry": "notes"}); code != 200 || body["state"] != "restored" || body["name"] != "notes" {
		t.Fatalf("restore: %d %v", code, body)
	}
	if inode(t, f.src("notes")) != original || exists(f.trash("info", "notes.trashinfo")) || len(f.list()) != 0 {
		t.Fatal("restore did not return the same directory")
	}
	if b, _ := os.ReadFile(f.src("notes") + "/a/b.txt"); string(b) != "kept\n" {
		t.Fatal("restored content changed")
	}
}

func TestWorkspaceDeleteCleanPushedCloneOutright(t *testing.T) {
	f := newTrashFixture(t)
	remote := f.pushedClone("clone")
	// Ignored files are not on the remote; they do not prevent outright
	// deletion but are reported.
	write(t, f.src("clone")+"/.gitignore", ".env\n")
	f.git(f.src("clone"), "add", ".gitignore")
	f.git(f.src("clone"), "commit", "-q", "-m", "ignore")
	f.git(f.src("clone"), "push", "-q", "origin", "main")
	write(t, f.src("clone")+"/.env", "SECRET=1\n")
	check := f.check("clone")
	git := check["facts"].(map[string]any)["git"].(map[string]any)
	if check["outcome"] != "permanent" || git["ignored"] != float64(1) || git["ignored_paths"].([]any)[0] != ".env" {
		t.Fatalf("clean pushed check: %v", check)
	}
	code, body := f.remove("clone", "permanent")
	if code != 200 || body["state"] != "deleted" {
		t.Fatalf("outright delete: %d %v", code, body)
	}
	if exists(f.src("clone")) || exists(f.trash("files", "clone")) || exists(f.trash("info", "clone.trashinfo")) || !exists(remote) {
		t.Fatal("outright deletion left the clone or touched the remote")
	}

	// Each fact Jari named keeps a repository from outright deletion: the
	// check says Trash and a permanent request is refused with nothing moved.
	cases := map[string]func(dir string){
		"untracked": func(dir string) { write(t, dir+"/new.txt", "x\n") },
		"changed":   func(dir string) { write(t, dir+"/README", "changed\n") },
		"unpushed": func(dir string) {
			write(t, dir+"/more", "x\n")
			f.git(dir, "add", "more")
			f.git(dir, "commit", "-q", "-m", "local")
		},
		"stash": func(dir string) {
			write(t, dir+"/README", "stashed\n")
			f.git(dir, "stash", "-q")
		},
		"unpushed-branch": func(dir string) {
			f.git(dir, "switch", "-q", "-c", "side")
			write(t, dir+"/side", "x\n")
			f.git(dir, "add", "side")
			f.git(dir, "commit", "-q", "-m", "side")
			f.git(dir, "switch", "-q", "main")
		},
	}
	for name, dirty := range cases {
		f.pushedClone(name)
		dirty(f.src(name))
		if check := f.check(name); check["outcome"] != "trash" {
			t.Fatalf("%s: outcome %v", name, check)
		}
		if code, body := f.remove(name, "permanent"); code != 409 || errorCode(body) != "workspace_not_clean" || !exists(f.src(name)) {
			t.Fatalf("%s: permanent request %d %v", name, code, body)
		}
	}
	// A repository with no remote at all has nowhere that holds its commits.
	if e := os.Mkdir(f.src("local"), 0700); e != nil {
		t.Fatal(e)
	}
	f.git(f.src("local"), "init", "-q")
	write(t, f.src("local")+"/f", "x\n")
	f.git(f.src("local"), "add", "f")
	f.git(f.src("local"), "commit", "-q", "-m", "only here")
	if check := f.check("local"); check["outcome"] != "trash" {
		t.Fatalf("no remote: %v", check)
	}
}

func TestWorkspaceDeleteRechecksTheMovedInode(t *testing.T) {
	f := newTrashFixture(t)
	f.pushedClone("clone")
	// A write that lands between the check and the move is in the moved
	// directory; outright deletion then keeps it in the Trash.
	trashHook = func(stage string) error {
		if stage == "info_written" {
			write(t, f.src("clone")+"/late.txt", "late\n")
		}
		return nil
	}
	code, body := f.remove("clone", "permanent")
	if code != 200 || body["state"] != "trashed" || body["kept_reason"] != "changed_after_check" || !exists(f.trash("files", "clone")+"/late.txt") {
		t.Fatalf("late write: %d %v", code, body)
	}
	// A process that entered the directory meanwhile is reported and keeps it.
	trashHook = func(string) error { return nil }
	f.pushedClone("busy")
	pid := filepath.Join(f.proc, "4242")
	write(t, pid+"/cmdline", "vim\x00")
	write(t, pid+"/comm", "vim\n")
	trashHook = func(stage string) error {
		if stage == "checked" {
			if e := os.Symlink(f.trash("files", "busy"), pid+"/cwd"); e != nil {
				t.Fatal(e)
			}
		}
		return nil
	}
	code, body = f.remove("busy", "permanent")
	inside, _ := body["processes_inside"].([]any)
	if code != 200 || body["state"] != "trashed" || body["kept_reason"] != "process_inside" || len(inside) != 1 || inside[0].(map[string]any)["pid"] != float64(4242) {
		t.Fatalf("process after move: %d %v", code, body)
	}
}

func TestWorkspaceDeleteBlockers(t *testing.T) {
	f := newTrashFixture(t)
	mustMkdir := func(p string) {
		if e := os.MkdirAll(p, 0700); e != nil {
			t.Fatal(e)
		}
	}
	expectBlocked := func(name string, want ...string) map[string]any {
		t.Helper()
		check := f.check(name)
		kinds := blockerKinds(check)
		for _, w := range want {
			found := false
			for _, k := range kinds {
				found = found || k == w
			}
			if !found {
				t.Fatalf("%s: want blocker %s, got %v", name, w, kinds)
			}
		}
		code, body := f.remove(name, "trash")
		if code != 200 || body["state"] != "blocked" || !exists(f.src(name)) || exists(f.trash("files", name)) {
			t.Fatalf("%s: delete was not blocked: %d %v", name, code, body)
		}
		return check
	}

	// 1. A live managed Pi child in the workspace.
	mustMkdir(f.src("pi"))
	f.c.sessions["11111111-1111-4111-8111-111111111111"] = &conversation{id: "11111111-1111-4111-8111-111111111111", cwd: f.src("pi"), rpc: &piRPC{exited: make(chan struct{})}}
	check := expectBlocked("pi", "pi_session")
	if check["blockers"].([]any)[0].(map[string]any)["agent_id"] != "pi:11111111-1111-4111-8111-111111111111" {
		t.Fatalf("pi blocker does not name the conversation: %v", check)
	}
	// A settled conversation whose child has exited never blocks.
	exited := make(chan struct{})
	close(exited)
	f.c.sessions["11111111-1111-4111-8111-111111111111"].rpc.exited = exited
	if check := f.check("pi"); check["outcome"] != "trash" {
		t.Fatalf("settled conversation blocked: %v", check)
	}

	// 2. A real process of the person with its cwd inside, read from /proc.
	mustMkdir(f.src("shell"))
	sleeper := exec.Command("/bin/sleep", "30")
	sleeper.Dir = f.src("shell")
	if e := sleeper.Start(); e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { _ = sleeper.Process.Kill(); _ = sleeper.Wait() })
	deletionProcRoot = "/proc"
	check = f.check("shell")
	found := false
	for _, b := range check["blockers"].([]any) {
		m := b.(map[string]any)
		found = found || m["kind"] == "process" && m["pid"] == float64(sleeper.Process.Pid) && m["comm"] == "sleep"
	}
	if !found {
		t.Fatalf("live process not named: %v", check)
	}
	deletionProcRoot = f.proc
	// A same-UID process whose details cannot be read is unknown and blocks.
	mustMkdir(f.src("opaque"))
	write(t, f.proc+"/777/cmdline", "secret\x00")
	write(t, f.proc+"/777/cwd", "not a link")
	expectBlocked("opaque", "unknown:processes")
	// The same unreadable details on a zombie are not a reason to block.
	write(t, f.proc+"/777/stat", "777 (sh (x)) Z 1 777 777 0 -1")
	if check := f.check("opaque"); check["outcome"] != "trash" {
		t.Fatalf("zombie blocked: %v", check)
	}
	if e := os.RemoveAll(f.proc + "/777"); e != nil {
		t.Fatal(e)
	}

	// 3. A Taskfleet run of the repository that is still live.
	f.pushedClone("fleet")
	script := filepath.Join(f.cfg.Home, ".local", "bin", "taskfleet")
	write(t, script, "#!/bin/sh\necho '{\"schema_version\":1,\"data\":{\"runs\":[{\"run_id\":\"01m53433zdhmcc9q1spepb30gz\",\"status\":\"running\",\"worktree_path\":\"/nonexistent/wt\"},{\"run_id\":\"01m53433zdhmcc9q1spepb30ga\",\"status\":\"done\",\"worktree_path\":\"/nonexistent/merged\"}]}}'\n")
	if e := os.Chmod(script, 0700); e != nil {
		t.Fatal(e)
	}
	check = expectBlocked("fleet", "taskfleet_run")
	if len(check["blockers"].([]any)) != 1 || check["blockers"].([]any)[0].(map[string]any)["run_id"] != "01m53433zdhmcc9q1spepb30gz" {
		t.Fatalf("only the live run blocks: %v", check)
	}
	write(t, script, "#!/bin/sh\nexit 3\n")
	expectBlocked("fleet", "unknown:taskfleet")
	if e := os.Remove(script); e != nil {
		t.Fatal(e)
	}
	if check := f.check("fleet"); check["outcome"] != "permanent" {
		t.Fatalf("no Taskfleet installed means no runs: %v", check)
	}

	// 4. Linked worktrees of this repository, wherever they are.
	f.pushedClone("main")
	elsewhere := filepath.Join(t.TempDir(), "wt")
	f.git(f.src("main"), "worktree", "add", "-q", elsewhere)
	check = expectBlocked("main", "linked_worktree")
	if check["blockers"].([]any)[0].(map[string]any)["path"] != elsewhere {
		t.Fatalf("worktree blocker path: %v", check)
	}
	f.git(f.src("main"), "worktree", "lock", elsewhere)
	expectBlocked("main", "locked_worktree")
	f.git(f.src("main"), "worktree", "unlock", elsewhere)
	if e := os.RemoveAll(elsewhere); e != nil {
		t.Fatal(e)
	}
	if check := f.check("main"); check["outcome"] == "blocked" || check["facts"].(map[string]any)["stale_worktrees"] != float64(1) {
		t.Fatalf("a stale worktree must be shown, not block: %v", check)
	}

	// 5. The workspace is itself a linked worktree, or holds one.
	f.pushedClone("base")
	f.git(f.src("base"), "worktree", "add", "-q", f.src("linked"))
	expectBlocked("linked", "is_linked_worktree")
	mustMkdir(f.src("base__worktrees"))
	f.git(f.src("base"), "worktree", "add", "-q", f.src("base__worktrees")+"/wt1")
	expectBlocked("base__worktrees", "contains_linked_worktree")

	// 6. A mount below the workspace, and an unreadable mount table.
	mustMkdir(f.src("mounted/data"))
	table := filepath.Join(t.TempDir(), "mountinfo")
	write(t, table, "1 0 8:1 / / rw - ext4 /dev/sda1 rw\n2 1 0:5 / "+strings.ReplaceAll(f.src("mounted/data"), " ", `\040`)+" rw - tmpfs tmpfs rw\n")
	oldTable := deletionMountInfo
	deletionMountInfo = table
	t.Cleanup(func() { deletionMountInfo = oldTable })
	expectBlocked("mounted", "mount")
	write(t, table, "garbage\n")
	expectBlocked("mounted", "unknown:mounts")
	deletionMountInfo = oldTable

	// 7. The Trash on another filesystem than ~/src.
	trashDevice = func(string) (uint64, bool) { return 1<<62 + 7, true }
	expectBlocked("mounted", "different_filesystem")
}

func TestWorkspaceDeleteRacesAndCrashes(t *testing.T) {
	f := newTrashFixture(t)
	if e := os.Mkdir(f.src("work"), 0700); e != nil {
		t.Fatal(e)
	}
	original := inode(t, f.src("work"))

	// A same-UID process swaps the directory after the checks: the swapped
	// one is moved, found to be different and put back. Nothing is lost.
	trashHook = func(stage string) error {
		if stage == "info_written" {
			if e := os.Rename(f.src("work"), f.src("work-original")); e != nil {
				return e
			}
			return os.Mkdir(f.src("work"), 0700)
		}
		return nil
	}
	if code, body := f.remove("work", "trash"); code != 409 || errorCode(body) != "workspace_changed" {
		t.Fatalf("swap: %d %v", code, body)
	}
	if !exists(f.src("work")) || inode(t, f.src("work-original")) != original || exists(f.trash("files", "work")) || exists(f.trash("info", "work.trashinfo")) {
		t.Fatal("swapped directory was not put back")
	}
	// If putting it back fails too, the swapped directory stays whole in
	// the Trash and the reply names the entry.
	if e := os.RemoveAll(f.src("work")); e != nil {
		t.Fatal(e)
	}
	if e := os.Rename(f.src("work-original"), f.src("work")); e != nil {
		t.Fatal(e)
	}
	real := renameNoReplace
	trashHook = func(stage string) error {
		if stage == "info_written" {
			os.Rename(f.src("work"), f.src("work-original"))
			os.Mkdir(f.src("work"), 0700)
			calls := 0
			renameNoReplace = func(a int, an string, b int, bn string) error {
				if calls++; calls > 1 {
					return unix.EEXIST
				}
				return real(a, an, b, bn)
			}
		}
		return nil
	}
	code, body := f.remove("work", "trash")
	renameNoReplace = real
	if code != 200 || body["state"] != "replaced" || body["entry"] != "work" || !exists(f.trash("files", "work")) || inode(t, f.src("work-original")) != original {
		t.Fatalf("unrestorable swap: %d %v", code, body)
	}
	trashHook = func(string) error { return nil }
	if e := os.RemoveAll(f.trash("files", "work")); e != nil {
		t.Fatal(e)
	}
	os.Remove(f.trash("info", "work.trashinfo"))
	if e := os.Rename(f.src("work-original"), f.src("work")); e != nil {
		t.Fatal(e)
	}

	// EXDEV from rename leaves no intent behind and nothing moved.
	renameNoReplace = func(int, string, int, string) error { return unix.EXDEV }
	if code, body := f.remove("work", "trash"); code != 409 || errorCode(body) != "trash_unavailable" {
		t.Fatalf("EXDEV: %d %v", code, body)
	}
	renameNoReplace = real
	if !exists(f.src("work")) || exists(f.trash("info", "work.trashinfo")) {
		t.Fatal("EXDEV left a trace")
	}

	// A crash after the info file and before the move leaves an intent
	// without an entry. Listing removes it only after the grace period, so
	// another tool's move in progress is left alone.
	trashHook = func(stage string) error {
		if stage == "info_written" {
			return errTrashAbandon
		}
		return nil
	}
	f.remove("work", "trash")
	trashHook = func(string) error { return nil }
	if !exists(f.trash("info", "work.trashinfo")) || !exists(f.src("work")) {
		t.Fatal("crash fixture did not leave the intent")
	}
	if len(f.list()) != 0 || !exists(f.trash("info", "work.trashinfo")) {
		t.Fatal("a fresh intent was removed or listed")
	}
	trashIntentGrace = 0
	if len(f.list()) != 0 || exists(f.trash("info", "work.trashinfo")) {
		t.Fatal("an aborted intent was not cleaned up")
	}

	// A crash during restore, after the rename: the workspace is back and
	// the leftover info file is cleaned up by the next listing.
	if code, _ := f.remove("work", "trash"); code != 200 {
		t.Fatal(code)
	}
	trashHook = func(stage string) error {
		if stage == "restored" {
			return errTrashAbandon
		}
		return nil
	}
	f.request(map[string]any{"action": "trash_restore", "entry": "work"})
	trashHook = func(string) error { return nil }
	if inode(t, f.src("work")) != original || len(f.list()) != 0 || exists(f.trash("info", "work.trashinfo")) {
		t.Fatal("interrupted restore was not recovered")
	}

	// A permanent deletion interrupted midway leaves the entry listed; a
	// second request finishes it.
	for i := range 5 {
		write(t, fmt.Sprintf("%s/d%d/f", f.src("work"), i), "x\n")
	}
	if code, _ := f.remove("work", "trash"); code != 200 {
		t.Fatal(code)
	}
	walks := 0
	trashHook = func(stage string) error {
		if stage == "walk" {
			if walks++; walks == 3 {
				return errors.New("interrupted")
			}
		}
		return nil
	}
	code, body = f.request(map[string]any{"action": "trash_delete", "entry": "work", "confirmation": "work"})
	trashHook = func(string) error { return nil }
	if code != 200 || body["state"] != "partial" || len(f.list()) != 1 {
		t.Fatalf("interrupted permanent deletion: %d %v", code, body)
	}
	if code, body = f.request(map[string]any{"action": "trash_delete", "entry": "work", "confirmation": "work"}); code != 200 || body["state"] != "deleted" || len(f.list()) != 0 {
		t.Fatalf("second permanent deletion: %d %v", code, body)
	}
}

func TestWorkspaceFenceRefusesStartsDuringAndAfterTheMove(t *testing.T) {
	f := newTrashFixture(t)
	if e := os.Mkdir(f.src("work"), 0700); e != nil {
		t.Fatal(e)
	}
	f.c.discover = Discover
	id, _ := f.target("work")
	ws, _, err := f.c.workspaceFD(id)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	s, _ := stat(int(ws.Fd()))
	live, release := f.c.fenceWorkspace(f.src("work"), inodeOf(s))
	if live != nil || release == nil {
		t.Fatal("fence refused without a live session")
	}
	f.c.mu.Lock()
	admitted := f.c.admits(ws)
	f.c.mu.Unlock()
	if admitted {
		t.Fatal("a start resolved before the fence was admitted while it is held")
	}
	if _, _, err := f.c.workspaceFD(id); err == nil {
		t.Fatal("workspaceFD resolved a fenced workspace")
	}
	release(true)
	f.c.mu.Lock()
	admitted = f.c.admits(ws)
	f.c.mu.Unlock()
	if admitted {
		t.Fatal("a moved workspace was admitted after the fence")
	}
	f.c.workspaceRestored(inodeOf(s))
	f.c.mu.Lock()
	admitted = f.c.admits(ws)
	f.c.mu.Unlock()
	if !admitted {
		t.Fatal("a restored workspace stays refused")
	}
	_, release = f.c.fenceWorkspace(f.src("work"), inodeOf(s))
	release(false)
	if fd, _, err := f.c.workspaceFD(id); err != nil {
		t.Fatalf("a released, unmoved workspace stays refused: %v", err)
	} else {
		fd.Close()
	}
}

func TestTrashTreatsOtherToolsEntriesAsData(t *testing.T) {
	f := newTrashFixture(t)
	outside := filepath.Join(t.TempDir(), "outside")
	write(t, outside+"/precious", "keep\n")
	if e := os.Mkdir(f.src("w"), 0700); e != nil {
		t.Fatal(e)
	}
	// Permanent deletion never follows a symlink out of the entry and
	// empties read-only directories it owns.
	if e := os.Symlink(outside, f.src("w")+"/link"); e != nil {
		t.Fatal(e)
	}
	write(t, f.src("w")+"/ro/file", "x\n")
	if e := os.Chmod(f.src("w")+"/ro", 0500); e != nil {
		t.Fatal(e)
	}
	if code, _ := f.remove("w", "trash"); code != 200 {
		t.Fatal(code)
	}
	if code, body := f.request(map[string]any{"action": "trash_delete", "entry": "w", "confirmation": "w"}); code != 200 || body["state"] != "deleted" {
		t.Fatalf("delete: %d %v", code, body)
	}
	if b, err := os.ReadFile(outside + "/precious"); err != nil || string(b) != "keep\n" {
		t.Fatal("permanent deletion followed a symlink out of the entry")
	}

	// Entries of other paths, malformed info files and entries without an
	// info file: only the last is listed, and only it can be deleted.
	write(t, f.trash("files", "photo")+"/a.jpg", "x")
	write(t, f.trash("info", "photo.trashinfo"), "[Trash Info]\nPath=/home/someone/photo\nDeletionDate=2026-10-01T10:00:00\n")
	write(t, f.trash("files", "forged")+"/x", "x")
	write(t, f.trash("info", "forged.trashinfo"), "[Trash Info]\nPath="+trashURLPath(f.src("forged"))+"\nPath=/etc\nDeletionDate=2026-10-01T10:00:00\n")
	write(t, f.trash("files", "escape")+"/x", "x")
	write(t, f.trash("info", "escape.trashinfo"), "[Trash Info]\nPath="+trashURLPath(f.cfg.Home+"/src/../escape")+"\nDeletionDate=2026-10-01T10:00:00\n")
	write(t, f.trash("files", "nested")+"/x", "x")
	write(t, f.trash("info", "nested.trashinfo"), "[Trash Info]\nPath="+trashURLPath(f.cfg.Home+"/src/a/nested")+"\nDeletionDate=2026-10-01T10:00:00\n")
	write(t, f.trash("files", "lost")+"/x", "x")
	entries := f.list()
	if len(entries) != 1 || entries[0]["entry"] != "lost" || entries[0]["kind"] != "unlabelled" || entries[0]["restore"] != "unavailable" {
		t.Fatalf("listing of foreign entries: %v", entries)
	}
	for _, entry := range []string{"photo", "forged", "escape", "nested"} {
		if code, body := f.request(map[string]any{"action": "trash_delete", "entry": entry, "confirmation": entry}); code != 409 || errorCode(body) != "trash_entry_missing" || !exists(f.trash("files", entry)) {
			t.Fatalf("%s: %d %v", entry, code, body)
		}
		if code, _ := f.request(map[string]any{"action": "trash_restore", "entry": entry}); code != 409 {
			t.Fatalf("%s restore: %d", entry, code)
		}
	}
	if code, _ := f.request(map[string]any{"action": "trash_restore", "entry": "lost"}); code != 409 {
		t.Fatal("an entry without a recorded path was restored")
	}
	if code, body := f.request(map[string]any{"action": "trash_delete", "entry": "lost", "confirmation": "lost"}); code != 200 || body["state"] != "deleted" {
		t.Fatalf("unlabelled delete: %d %v", code, body)
	}

	// Restore never replaces or shadows an existing name.
	if e := os.Mkdir(f.src("dup"), 0700); e != nil {
		t.Fatal(e)
	}
	if code, _ := f.remove("dup", "trash"); code != 200 {
		t.Fatal(code)
	}
	if e := os.Mkdir(f.src("DUP"), 0700); e != nil {
		t.Fatal(e)
	}
	entries = f.list()
	if len(entries) != 1 || entries[0]["restore"] != "name_taken" {
		t.Fatalf("taken name: %v", entries)
	}
	if code, body := f.request(map[string]any{"action": "trash_restore", "entry": "dup"}); code != 409 || errorCode(body) != "workspace_exists" || !exists(f.trash("files", "dup")) {
		t.Fatalf("restore over a taken name: %d %v", code, body)
	}
	code, body := f.request(map[string]any{"action": "trash_inspect", "entry": "dup"})
	if code != 200 || body["entry"].(map[string]any)["name"] != "dup" || body["facts"].(map[string]any)["kind"] != "directory" {
		t.Fatalf("inspect: %d %v", code, body)
	}
}

func TestWorkspaceDeletionRequestGrammar(t *testing.T) {
	f := newTrashFixture(t)
	if e := os.Mkdir(f.src("w"), 0700); e != nil {
		t.Fatal(e)
	}
	id, token := f.target("w")
	for _, bad := range []map[string]any{
		{"action": "delete", "workspace_id": id, "observation_token": token},
		{"action": "delete", "workspace_id": id, "observation_token": token, "disposal": "shred"},
		{"action": "delete_check", "workspace_id": id, "observation_token": token, "disposal": "trash"},
		{"action": "delete", "workspace_id": id, "observation_token": token, "disposal": "trash", "entry": "w"},
		{"action": "trash_list", "entry": "w"},
		{"action": "trash_restore", "entry": "../w"},
		{"action": "trash_restore", "entry": ".."},
		{"action": "trash_restore", "entry": "w", "workspace_id": id},
		{"action": "trash_delete", "entry": "w"},
		{"action": "trash_restore", "entry": "w", "confirmation": "w"},
		{"action": "settings", "workspace_id": id, "observation_token": token, "display_name": "x", "entry": "w"},
		{"action": "delete", "workspace_id": id, "observation_token": token, "disposal": "trash", "name": "w"},
	} {
		if code, _ := f.request(bad); code != 400 {
			t.Fatalf("%v: %d", bad, code)
		}
	}
	if code, body := f.request(map[string]any{"action": "delete", "workspace_id": id, "observation_token": "obs_stale123", "disposal": "trash"}); code != 409 || errorCode(body) != "workspace_changed" || !exists(f.src("w")) {
		t.Fatalf("stale token: %d %v", code, body)
	}
	nocontroller := WorkspaceHandler(f.cfg, func(*http.Request) bool { return true })
	b, _ := json.Marshal(map[string]any{"action": "delete", "workspace_id": id, "observation_token": token, "disposal": "trash"})
	r := httptest.NewRequest("POST", "http://unix"+WorkspacePath, bytes.NewReader(b))
	r.RequestURI = WorkspacePath
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	nocontroller.ServeHTTP(w, r)
	if w.Code != 503 || !exists(f.src("w")) {
		t.Fatalf("deletion without the controller: %d", w.Code)
	}
}

func TestTrashInfoFormat(t *testing.T) {
	path := "/home/a b/src/ä%x"
	encoded := trashURLPath(path)
	if encoded != "/home/a%20b/src/%C3%A4%25x" {
		t.Fatalf("encoding: %s", encoded)
	}
	info, ok := parseTrashInfo([]byte("[Trash Info]\nPath=" + encoded + "\nDeletionDate=2026-10-16T21:05:09\n"))
	if !ok || info.path != path || info.deleted.Format("2006-01-02T15:04:05") != "2026-10-16T21:05:09" {
		t.Fatalf("parse: %+v %v", info, ok)
	}
	for _, bad := range []string{
		"Path=/x\nDeletionDate=2026-10-16T21:05:09\n",
		"[Trash Info]\nPath=/x%zz\nDeletionDate=2026-10-16T21:05:09\n",
		"[Trash Info]\nPath=/x%0\nDeletionDate=2026-10-16T21:05:09\n",
		"[Trash Info]\nPath=relative\nDeletionDate=2026-10-16T21:05:09\n",
		"[Trash Info]\nPath=/x%00y\nDeletionDate=2026-10-16T21:05:09\n",
		"[Trash Info]\nPath=/x\nDeletionDate=yesterday\n",
		"[Trash Info]\nPath=/x\nDeletionDate=2026-10-16T21:05:09\nExtra=1\n",
	} {
		if _, ok := parseTrashInfo([]byte(bad)); ok {
			t.Fatalf("accepted %q", bad)
		}
	}
	if p, ok := unescapeMount(`/a\040b\134c`); !ok || p != `/a b\c` {
		t.Fatalf("mount unescape: %q", p)
	}
	if _, ok := unescapeMount(`/a\04`); ok {
		t.Fatal("truncated mount escape accepted")
	}
}
