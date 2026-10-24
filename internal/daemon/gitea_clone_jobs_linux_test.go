//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/nativegitea/giteafake"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// These extend the clone-job guarantees (github_jobs_linux_test.go) to a
// Gitea source with real Git, the synthetic Gitea and the native helper: the
// job outlives its stream, survives a daemon restart only as an interrupted
// directory the person explicitly removes or restarts, keeps a download that
// fails verification, and never sends a transfer or the token anywhere the
// daemon did not validate.

// restart replaces the daemon's clone jobs with a fresh process's: the old
// jobs' lifetime ends and nothing of them remains in memory.
func (w *giteaWalk) restart() {
	w.t.Helper()
	w.clones.stop()
	w.clones = newCloneJobsFixture(w.t, w.home, "/usr/bin/git")
	w.clones.jobs.gitea, w.clones.jobs.giteaGit = w.adapter, "/usr/bin/git"
}

func (w *giteaWalk) start(connection string, repository int) string {
	w.t.Helper()
	status, out := w.clone(connection, repository)
	job, _ := out["job"].(map[string]any)
	if status != 200 || job["state"] != "running" {
		w.t.Fatalf("start: %d %v", status, out)
	}
	return job["job_id"].(string)
}

// waitConfigured waits until git clone has written the new repository's
// configuration, which it does before its first request.
func (w *giteaWalk) waitConfigured(name string) {
	w.t.Helper()
	config := filepath.Join(w.home, "src", name, ".git", "config")
	for deadline := time.Now().Add(10 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		if b, err := os.ReadFile(config); err == nil && strings.Contains(string(b), "username = ") && strings.Contains(string(b), "[remote \"origin\"]") {
			return
		}
	}
	w.t.Fatal("clone never configured its origin")
}

func (w *giteaWalk) appendGitconfig(text string) {
	w.t.Helper()
	f, err := os.OpenFile(filepath.Join(w.home, ".gitconfig"), os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		w.t.Fatal(err)
	}
	defer f.Close()
	if _, err := f.WriteString(text); err != nil {
		w.t.Fatal(err)
	}
}

// noToken fails when any reply or written file carries a token.
func (w *giteaWalk) noToken(what string, v any) {
	w.t.Helper()
	b, _ := json.Marshal(v)
	if strings.Contains(string(b), "tok-") {
		w.t.Fatalf("token in %s: %s", what, b)
	}
}

// The job belongs to the daemon: losing the progress stream mid-transfer
// does not stop a Gitea clone, and a later subscription sees it confirmed.
func TestGiteaCloneJobOutlivesItsStream(t *testing.T) {
	w := newGiteaWalk(t)
	ada := w.connect(w.srv.URL, "tok-ada-0001")
	release := w.srv.Block()
	id := w.start(ada, 101)
	w.waitConfigured("notes")
	ctx, disconnect := context.WithCancel(context.Background())
	first := w.clones.frames(ctx, id, "progress")
	disconnect()
	if len(first) != 1 || first[0]["kind"] != "progress" {
		t.Fatalf("first subscription: %v", first)
	}
	if d := DiscoverFixtureRoot(w.home, w.clones.cfg.UID); len(d.Entries) != 0 {
		t.Fatalf("running clone listed as a workspace: %+v", d.Entries)
	}
	time.Sleep(100 * time.Millisecond) // the stream is gone; the job is not
	release()
	second := w.clones.frames(context.Background(), id, "terminal")
	if last := second[len(second)-1]; last["outcome"] != "confirmed" {
		t.Fatalf("resubscription: %v", second)
	}
	w.noToken("frames", append(first, second...))
	for _, frame := range append(first, second...) {
		if b, _ := json.Marshal(frame); strings.Contains(string(b), w.srv.URL) {
			t.Fatalf("native address in a frame: %s", b)
		}
	}
	w.clones.settle()
	if users := w.srv.GitUsers(); len(users) == 0 || users[len(users)-1] != "ada" {
		t.Fatalf("clone authenticated as %v", users)
	}
}

// After a daemon restart the leftover of a Gitea clone is an interrupted
// clone: it names its connection while one matches, it is not a workspace,
// nothing restarts it, and only the person's restart or remove touches it.
// Remove still works once the connection is gone.
func TestGiteaCloneInterruptedAfterRestartAndExplicitActions(t *testing.T) {
	isolateDeletionProcesses(t)
	w := newGiteaWalk(t)
	ada := w.connect(w.srv.URL, "tok-ada-0001")
	bob := w.connect(w.srv.URL, "tok-bob-0002")
	checkout := filepath.Join(w.home, "src", "notes")
	interrupt := func() {
		t.Helper()
		release := w.srv.Block()
		defer release()
		id := w.start(ada, 101)
		w.waitConfigured("notes")
		job := w.clones.jobs.find(id)
		w.clones.stop() // the daemon stops mid-transfer
		if s, _ := job.snapshot(); s.State != "failed" || s.Reason != "daemon_stopping" || s.Leftover != "kept" {
			t.Fatalf("stopping daemon: %+v", s)
		}
		w.restart()
	}

	interrupt()
	listed := w.clones.list()
	interrupted := listed["interrupted"].([]any)
	if len(listed["jobs"].([]any)) != 0 || len(interrupted) != 1 || listed["interrupted_complete"] != true {
		t.Fatalf("list after restart: %v", listed)
	}
	item := interrupted[0].(map[string]any)
	source, _ := item["source"].(map[string]any)
	if item["full_name"] != "ada/notes" || item["size_bytes"].(float64) <= 0 || source["provider"] != "gitea" || source["connection_id"] != ada {
		t.Fatalf("interrupted Gitea clone: %v", item)
	}
	w.noToken("list", listed)
	if d := DiscoverFixtureRoot(w.home, w.clones.cfg.UID); len(d.Entries) != 0 {
		t.Fatalf("interrupted clone listed as a workspace: %+v", d.Entries)
	}
	time.Sleep(100 * time.Millisecond)
	if len(w.clones.list()["jobs"].([]any)) != 0 {
		t.Fatal("clone restarted without being asked")
	}
	if status, out := w.clone(ada, 101); status != 409 || code(out) != "checkout_exists" {
		t.Fatalf("plain start over the leftover: %d %v", status, out)
	}
	// Each action acts only on the clone the directory records.
	for body, want := range map[string]string{
		`{"action":"remove","full_name":"ada/notes"}`:                                                           "not_interrupted", // not a GitHub clone
		`{"action":"remove","source":"gitea","full_name":"bob/notes"}`:                                          "not_interrupted",
		`{"action":"restart","source":"gitea","connection_id":"` + bob + `","repository_id":103,"mode":"full"}`: "not_interrupted",
	} {
		if status, out := w.clones.action(body); status != 409 || code(out) != want {
			t.Fatalf("%s: %d %v", body, status, out)
		}
	}
	for _, body := range []string{
		`{"action":"restart","source":"gitea","connection_id":"` + ada + `","repository_id":101,"mode":"blobless"}`,
		`{"action":"remove","source":"gitea","full_name":"ada/notes","connection_id":"` + ada + `"}`,
		`{"action":"remove","source":"gitea","full_name":"../notes"}`,
		`{"action":"cancel","source":"gitea","job_id":"0123456789abcdef0123456789abcdef"}`,
		`{"action":"start","source":"github","connection_id":"` + ada + `","repository_id":101,"mode":"full"}`,
	} {
		if status, _ := w.clones.action(body); status != 400 {
			t.Fatalf("%s: %d", body, status)
		}
	}
	if _, err := os.Stat(filepath.Join(checkout, ".git", "config")); err != nil {
		t.Fatal("a refused action touched the leftover", err)
	}

	// Restart replaces the unfinished download with a new clone.
	status, out := w.clones.action(`{"action":"restart","source":"gitea","connection_id":"` + ada + `","repository_id":101,"mode":"full"}`)
	job, _ := out["job"].(map[string]any)
	if status != 200 || job["state"] != "running" {
		t.Fatalf("restart: %d %v", status, out)
	}
	if done := w.waitJob(job["job_id"].(string)); done["state"] != "confirmed" {
		t.Fatalf("restarted clone: %v", done)
	}
	w.clones.settle()
	if w.git(checkout, "rev-list", "--count", "HEAD") != "1" {
		t.Fatal("restarted clone has no history")
	}

	// Once the connection is gone the leftover can no longer be restarted,
	// but it is still listed and removed on request.
	if err := os.RemoveAll(checkout); err != nil {
		t.Fatal(err)
	}
	interrupt()
	if status, out, _ := w.gitea("DELETE", `{"action":"disconnect","connection_id":"`+ada+`"}`); status != 200 {
		t.Fatalf("disconnect: %d %v", status, out)
	}
	item = w.clones.list()["interrupted"].([]any)[0].(map[string]any)
	if source := item["source"].(map[string]any); source["provider"] != "gitea" || source["connection_id"] != nil {
		t.Fatalf("interrupted clone of a removed connection: %v", item)
	}
	if status, out := w.clones.action(`{"action":"remove","source":"gitea","full_name":"ada/notes"}`); status != 200 || out["state"] != "removed" || out["full_name"] != "ada/notes" {
		t.Fatalf("remove: %d %v", status, out)
	}
	if _, err := os.Lstat(checkout); !os.IsNotExist(err) {
		t.Fatalf("not removed: %v", err)
	}
}

// A directory a process left before Git recorded the origin and account is
// ambiguous: it is never recognised, removed or given an owner, and a start
// refuses it as an existing destination.
func TestGiteaAmbiguousLeftoverStaysAConflict(t *testing.T) {
	isolateDeletionProcesses(t)
	w := newGiteaWalk(t)
	ada := w.connect(w.srv.URL, "tok-ada-0001")
	checkout := filepath.Join(w.home, "src", "notes")
	remote := w.srv.URL + "/ada/notes.git"
	for name, prepare := range map[string][]string{
		"empty directory": nil,
		"no origin yet":   {"init -q ."},
		"no account yet":  {"init -q .", "remote add origin " + remote},
		"file beside git": {"init -q .", "config credential." + remote + ".username ada", "remote add origin " + remote, "!draft"},
	} {
		t.Run(name, func(t *testing.T) {
			if err := os.MkdirAll(checkout, 0o700); err != nil {
				t.Fatal(err)
			}
			defer os.RemoveAll(checkout)
			for _, step := range prepare {
				if step == "!draft" {
					if err := os.WriteFile(filepath.Join(checkout, "draft.txt"), []byte("work"), 0o600); err != nil {
						t.Fatal(err)
					}
					continue
				}
				w.git(checkout, strings.Fields(step)...)
			}
			before := snapshotTree(t, checkout)
			if status, out := w.clone(ada, 101); status != 409 || code(out) != "checkout_exists" {
				t.Fatalf("start: %d %v", status, out)
			}
			for _, body := range []string{
				`{"action":"remove","source":"gitea","full_name":"ada/notes"}`,
				`{"action":"restart","source":"gitea","connection_id":"` + ada + `","repository_id":101,"mode":"full"}`,
			} {
				if status, out := w.clones.action(body); status != 409 || code(out) != "not_interrupted" {
					t.Fatalf("%s: %d %v", body, status, out)
				}
			}
			if got := w.clones.list()["interrupted"].([]any); len(got) != 0 {
				t.Fatalf("ambiguous directory listed as interrupted: %v", got)
			}
			if after := snapshotTree(t, checkout); after != before {
				t.Fatalf("directory changed:\n%s\n%s", before, after)
			}
		})
	}
}

func snapshotTree(t *testing.T, root string) string {
	t.Helper()
	var b strings.Builder
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err == nil {
			b.WriteString(path + " " + info.Mode().String() + "\n")
		}
		return nil
	})
	return b.String()
}

// Git finished, but the result is not the clone that was asked for: here a
// personal rewrite that applies only once HEAD is on main, after the
// transfer. The download is kept for the person, never deleted.
func TestGiteaCloneJobVerificationFailureKeepsTheDownload(t *testing.T) {
	w := newGiteaWalk(t)
	ada := w.connect(w.srv.URL, "tok-ada-0001")
	include := filepath.Join(w.home, ".gitconfig-main")
	if err := os.WriteFile(include, []byte("[url \""+w.srv.URL+"/ada/other.git\"]\n\tinsteadOf = "+w.srv.URL+"/ada/notes.git\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	w.appendGitconfig("[init]\n\tdefaultBranch = trunk\n[includeIf \"onbranch:main\"]\n\tpath = " + include + "\n")
	id := w.start(ada, 101)
	frames := w.clones.frames(context.Background(), id, "terminal")
	if last := frames[len(frames)-1]; last["outcome"] != "failed" || last["reason"] != "verification_failed" || last["leftover"] != "kept" {
		t.Fatalf("terminal: %v", last)
	}
	w.clones.settle()
	if _, err := os.Stat(filepath.Join(w.home, "src", "notes", ".git", "HEAD")); err != nil {
		t.Fatal("download removed", err)
	}
	for _, r := range w.srv.GitRequests() {
		if !strings.HasPrefix(r.Path, "/ada/notes.git/") {
			t.Fatalf("transfer went to %s", r.Path)
		}
	}
}

// Admission refusals reserve nothing and release the connection: quota,
// an existing name in any case, a symlink in ~/src or as ~/src, a cross-host
// clone_url and a personal URL rewrite in any form Git would apply.
// Cancellation removes what the job created.
func TestGiteaCloneRefusalsAndCancel(t *testing.T) {
	w := newGiteaWalk(t)
	ada := w.connect(w.srv.URL, "tok-ada-0001")
	src := filepath.Join(w.home, "src")
	if err := os.Mkdir(src, 0o700); err != nil {
		t.Fatal(err)
	}
	refused := func(what, want string, status int) {
		t.Helper()
		before := len(w.srv.GitRequests())
		got, out := w.clone(ada, 101)
		if got != status || code(out) != want {
			t.Fatalf("%s: %d %v", what, got, out)
		}
		w.noToken(what, out)
		if len(w.srv.GitRequests()) != before {
			t.Fatalf("%s: Git contacted the server", what)
		}
		if _, err := os.Lstat(filepath.Join(src, "notes")); what != "existing name" && what != "symlink" && !os.IsNotExist(err) {
			t.Fatalf("%s left a destination: %v", what, err)
		}
	}

	w.clones.jobs.budget = func(int) bool { return false }
	refused("quota", "checkout_unavailable", 409)
	w.clones.jobs.budget = func(int) bool { return true }

	if err := os.Mkdir(filepath.Join(src, "NOTES"), 0o700); err != nil {
		t.Fatal(err)
	}
	refused("existing name", "checkout_exists", 409)
	if err := os.Remove(filepath.Join(src, "NOTES")); err != nil {
		t.Fatal(err)
	}
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(src, "notes")); err != nil {
		t.Fatal(err)
	}
	refused("symlink", "checkout_exists", 409)
	if err := os.Remove(filepath.Join(src, "notes")); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(src, src+".real"); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(src+".real", src); err != nil {
		t.Fatal(err)
	}
	refused("linked ~/src", "checkout_unavailable", 409)
	if err := os.Remove(src); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(src+".real", src); err != nil {
		t.Fatal(err)
	}
	if entries, _ := os.ReadDir(outside); len(entries) != 0 {
		t.Fatal("a refusal wrote through a symlink")
	}

	// A Gitea whose API names a clone address on another host gets no
	// transfer and no token.
	if err := w.srv.AddRepo(giteafake.Repo{ID: 104, Owner: "ada", Name: "elsewhere", Private: true, CloneURL: "https://attacker.invalid/ada/elsewhere.git"}); err != nil {
		t.Fatal(err)
	}
	if status, out := w.clone(ada, 104); status != 503 || code(out) != "native_source_unavailable" {
		t.Fatalf("cross-host clone_url: %d %v", status, out)
	}

	// Rewrites, whether always on or only inside the new repository.
	plain := filepath.Join(w.home, ".gitconfig")
	original, _ := os.ReadFile(plain)
	for _, rule := range []string{
		"[url \"https://attacker.invalid/\"]\n\tinsteadOf = " + w.srv.URL + "/\n",
		"[url \"" + w.srv.URL + "/ada/notes.git\"]\n\tinsteadOf = " + w.srv.URL + "/ada/notes.git\n",
		"[url \"https://attacker.invalid/\"]\n\tpushInsteadOf = " + w.srv.URL + "/\n",
		"[includeIf \"gitdir:" + src + "/\"]\n\tpath = " + w.home + "/rewrite\n",
		"[includeIf \"hasconfig:remote.*.url:" + w.srv.URL + "/**\"]\n\tpath = " + w.home + "/rewrite\n",
	} {
		if err := os.WriteFile(filepath.Join(w.home, "rewrite"), []byte("[url \"https://attacker.invalid/\"]\n\tinsteadOf = "+w.srv.URL+"/\n"), 0o600); err != nil {
			t.Fatal(err)
		}
		w.appendGitconfig(rule)
		refused("rewrite "+strings.SplitN(rule, "\n", 2)[0], "remote_rewritten", 409)
		if err := os.WriteFile(plain, original, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	// A rewrite of another server's addresses is the person's own business.
	w.appendGitconfig("[url \"git@github.com:\"]\n\tinsteadOf = https://github.com/\n")

	// Cancel stops the process group and removes the directory it created.
	release := w.srv.Block()
	id := w.start(ada, 101)
	w.waitConfigured("notes")
	status, out := w.clones.action(`{"action":"cancel","job_id":"` + id + `"}`)
	job, _ := out["job"].(map[string]any)
	release()
	if status != 200 || job["state"] != "cancelled" || job["leftover"] != "removed" {
		t.Fatalf("cancel: %d %v", status, out)
	}
	if _, err := os.Lstat(filepath.Join(src, "notes")); !os.IsNotExist(err) {
		t.Fatalf("cancelled clone left %v", err)
	}
	// Nothing above still holds the connection.
	if status, out, _ := w.gitea("DELETE", `{"action":"disconnect","connection_id":"`+ada+`"}`); status != 200 {
		t.Fatalf("disconnect after refusals: %d %v", status, out)
	}
}

// Redirects are refused for the clone and the later fetch even when the
// person's own configuration follows them, and the redirect target never
// sees a request.
func TestGiteaTransfersRefuseRedirects(t *testing.T) {
	w := newGiteaWalk(t)
	ada := w.connect(w.srv.URL, "tok-ada-0001")
	// The person's most specific setting, for this very remote, says follow.
	w.appendGitconfig("[http \"" + w.srv.URL + "/ada/notes.git\"]\n\tfollowRedirects = true\n")
	w.srv.SetRedirect("ada", "notes", w.srv.URL+"/bob/notes.git")
	id := w.start(ada, 101)
	if done := w.waitJob(id); done["state"] != "failed" || done["reason"] != "native_failure" || done["leftover"] != "removed" {
		t.Fatalf("redirected clone: %v", done)
	}
	w.clones.settle()
	w.srv.SetRedirect("ada", "notes", "")
	if done := w.waitJob(w.start(ada, 101)); done["state"] != "confirmed" {
		t.Fatalf("clone: %v", done)
	}
	w.clones.settle()
	w.srv.SetRedirect("ada", "notes", w.srv.URL+"/bob/notes.git")
	if got := w.fetch("notes"); got == "" {
		t.Fatal("a redirected fetch succeeded")
	}
	for _, r := range w.srv.GitRequests() {
		if strings.HasPrefix(r.Path, "/bob/") {
			t.Fatalf("redirect followed: %+v", r)
		}
	}
}

// The workspace fetch of a Gitea clone is pinned as the clone is: a
// personal storing helper inside ~/src gets no copy, a rewrite of its
// address is refused before any request, an extra address is refused, and
// after disconnect another account's credential is never used. A remote of
// any other server keeps the person's own configuration.
func TestGiteaFetchIsPinnedToItsRemote(t *testing.T) {
	w := newGiteaWalk(t)
	ada := w.connect(w.srv.URL, "tok-ada-0001")
	w.connect(w.srv.URL, "tok-bob-0002")
	if done := w.waitJob(w.start(ada, 101)); done["state"] != "confirmed" {
		t.Fatalf("clone: %v", done)
	}
	w.clones.settle()
	checkout := filepath.Join(w.home, "src", "notes")
	remote := w.srv.URL + "/ada/notes.git"
	store := filepath.Join(w.home, ".git-credentials")
	// bob's token for the whole server, offered by a storing helper that
	// applies only inside ~/src.
	if err := os.WriteFile(store, []byte("https://bob:tok-bob-0002@"+strings.TrimPrefix(w.srv.URL, "https://")+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(w.home, ".gitconfig-src"), []byte("[credential]\n\thelper = store\n\tuseHttpPath = false\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	w.appendGitconfig("[includeIf \"gitdir:" + w.home + "/src/\"]\n\tpath = " + w.home + "/.gitconfig-src\n")
	storeBefore, _ := os.ReadFile(store)

	if err := w.srv.AddCommit("ada", "notes", "LATER.md", "later\n"); err != nil {
		t.Fatal(err)
	}
	before := len(w.srv.GitUsers())
	if got := w.fetch("notes"); got != "" {
		t.Fatalf("fetch: %s", got)
	}
	if users := w.srv.GitUsers()[before:]; len(users) == 0 || users[0] != "ada" {
		t.Fatalf("fetch authenticated as %v", users)
	}
	if after, _ := os.ReadFile(store); string(after) != string(storeBefore) {
		t.Fatal("the personal store got a copy of the token")
	}

	gitconfig := filepath.Join(w.home, ".gitconfig")
	original, _ := os.ReadFile(gitconfig)
	local, _ := os.ReadFile(filepath.Join(checkout, ".git", "config"))
	for what, change := range map[string]func(){
		"global insteadOf":   func() { w.appendGitconfig("[url \"https://attacker.invalid/\"]\n\tinsteadOf = " + w.srv.URL + "/\n") },
		"pushInsteadOf":      func() { w.appendGitconfig("[url \"https://attacker.invalid/\"]\n\tpushInsteadOf = " + remote + "\n") },
		"repository rewrite": func() { w.git(checkout, "config", "url."+w.srv.URL+"/bob/notes.git.insteadOf", remote) },
		"second address":     func() { w.git(checkout, "config", "--add", "remote.origin.url", w.srv.URL+"/bob/notes.git") },
		"rewrite onto Gitea": func() {
			w.git(checkout, "remote", "set-url", "origin", "https://mirror.invalid/ada/notes.git")
			w.git(checkout, "config", "url."+remote+".insteadOf", "https://mirror.invalid/ada/notes.git")
		},
	} {
		change()
		before := len(w.srv.GitRequests())
		if got := w.fetch("notes"); got != "remote_rewritten" {
			t.Fatalf("%s: fetch %q", what, got)
		}
		if len(w.srv.GitRequests()) != before {
			t.Fatalf("%s: Git contacted the server", what)
		}
		_ = os.WriteFile(gitconfig, original, 0o600)
		_ = os.WriteFile(filepath.Join(checkout, ".git", "config"), local, 0o600)
	}

	// After disconnect, bob's account on the same server stays connected:
	// the fetch is still pinned, so neither our helper nor the personal
	// store answers ada's clone with bob's token.
	if status, out, _ := w.gitea("DELETE", `{"action":"disconnect","connection_id":"`+ada+`"}`); status != 200 {
		t.Fatalf("disconnect: %d %v", status, out)
	}
	before = len(w.srv.GitUsers())
	if got := w.fetch("notes"); got != "remote_auth_unavailable" {
		t.Fatalf("fetch after disconnect: %q", got)
	}
	if users := w.srv.GitUsers()[before:]; len(users) != 0 {
		t.Fatalf("a disconnected clone authenticated as %v", users)
	}

	// An ordinary remote elsewhere, rewritten by the person, is fetched as
	// before.
	bare := seedBare(t)
	other := filepath.Join(w.home, "src", "other")
	w.git(w.home, "clone", "-q", bare, other)
	w.git(other, "remote", "set-url", "origin", "mirror:repo")
	w.appendGitconfig("[url \"" + bare + "\"]\n\tinsteadOf = mirror:repo\n[protocol \"file\"]\n\tallow = always\n")
	if got := w.fetch("other"); got != "" {
		t.Fatalf("ordinary rewritten remote: %q", got)
	}
}

// The same tea entry answers Git wherever the person runs it: the browser
// fetch (nativeCommandInput), the clone job (cloneProgressCommand), Pi's
// environment (agentPath, HOME) and the browser shell's (terminalHost.env).
// None of them carries an SSH agent or a token, and the helper needs
// neither XDG_CONFIG_HOME nor a PATH entry of its own.
func TestGiteaHelperAnswersInEveryNativeEnvironment(t *testing.T) {
	t.Setenv("SSH_AUTH_SOCK", "/nonexistent/agent.sock")
	t.Setenv("GITEA_TOKEN", "tok-ada-0001")
	w := newGiteaWalk(t)
	ada := w.connect(w.srv.URL, "tok-ada-0001")
	if done := w.waitJob(w.start(ada, 101)); done["state"] != "confirmed" {
		t.Fatalf("clone (cloneProgressCommand): %v", done)
	}
	w.clones.settle()
	if got := w.fetch("notes"); got != "" {
		t.Fatalf("browser fetch (nativeCommandInput): %s", got)
	}
	checkout := filepath.Join(w.home, "src", "notes")
	terminal := (&terminalHost{cfg: transport.Config{Home: w.home, Username: "ada"}}).env()
	pi := []string{agentPath(w.home), "USER=ada", "HOME=" + w.home}
	for what, env := range map[string][]string{"pi": pi, "terminal": terminal} {
		for _, e := range env {
			if strings.HasPrefix(e, "SSH_AUTH_SOCK=") || strings.HasPrefix(e, "GITEA_TOKEN=") || strings.HasPrefix(e, "XDG_CONFIG_HOME=") || strings.Contains(e, "tok-") {
				t.Fatalf("%s environment carries %s", what, e)
			}
		}
		if err := w.srv.AddCommit("ada", "notes", what+".md", what+"\n"); err != nil {
			t.Fatal(err)
		}
		before := len(w.srv.GitUsers())
		cmd := exec.Command("/usr/bin/git", "fetch", "--quiet", "origin")
		cmd.Dir, cmd.Env = checkout, env
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("%s fetch: %v %s", what, err, out)
		}
		if users := w.srv.GitUsers()[before:]; len(users) == 0 || users[0] != "ada" {
			t.Fatalf("%s fetch authenticated as %v", what, users)
		}
	}
	if w.git(checkout, "rev-list", "--count", "HEAD..origin/main") != "2" {
		t.Fatal("the native fetches did not bring the upstream commits")
	}
	if _, err := os.Stat(filepath.Join(w.home, ".git-credentials")); !os.IsNotExist(err) {
		t.Fatal("a second credential store appeared")
	}
}
