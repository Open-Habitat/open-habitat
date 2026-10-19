//go:build linux

package daemon

import (
	"bufio"
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

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// cloneJobsFixture serves the job routes over a real HTTP server on a
// disposable home. git is a wrapper around the real /usr/bin/git that clones
// a local bare repository but behaves, by its origin and directory, like a
// clone of github.com/org/repo. The returned stop simulates the daemon
// stopping: it cancels the jobs' lifetime and waits until they have settled.
type cloneJobsFixture struct {
	t     *testing.T
	cfg   transport.Config
	home  string
	jobs  *CloneJobs
	srv   *httptest.Server
	stop  context.CancelFunc
	gate  string // the wrapper waits while this file exists
	ready string // the wrapper writes this once it is inside the destination
	args  string // the wrapper records its clone arguments here
}

func newCloneJobsFixture(t *testing.T, home string, script string) *cloneJobsFixture {
	t.Helper()
	cfg, _ := cloneFixture(t)
	cfg.Home = home
	ctx, cancel := context.WithCancel(context.Background())
	run := func(ctx context.Context, program, _, fd string, args ...string) ([]byte, error) {
		if program == "gh" {
			if args[len(args)-1] == "/user" {
				return []byte(`{"id":42}`), nil
			}
			return []byte(`{"name":"repo","full_name":"org/repo","owner":{"login":"org"},"clone_url":"https://github.com/org/repo.git"}`), nil
		}
		return cloneCommand(ctx, program, home, fd, args...)
	}
	f := &cloneJobsFixture{t: t, cfg: cfg, home: home, gate: filepath.Join(home, "gate"), ready: filepath.Join(home, "ready"), args: filepath.Join(home, "args")}
	f.jobs = &CloneJobs{ctx: ctx, cfg: cfg, trusted: func(*http.Request) bool { return true }, home: home, gh: "gh", git: script, run: run, budget: func(int) bool { return true }, now: time.Now}
	mux := http.NewServeMux()
	mux.Handle(RepoClonesPath, f.jobs.Handler())
	mux.Handle(RepoCloneEventsPath, f.jobs.Events())
	mux.Handle(RepoObservePath, repoObserveHandler(cfg, func(*http.Request) bool { return true }, home, "/usr/bin/git", cloneCommand, f.jobs))
	f.srv = httptest.NewServer(mux)
	f.stop = func() {
		cancel()
		f.settle()
	}
	t.Cleanup(func() { f.stop(); f.srv.Close() })
	return f
}

// settle waits until no job holds the writer lock.
func (f *cloneJobsFixture) settle() {
	f.t.Helper()
	for deadline := time.Now().Add(10 * time.Second); ; {
		if cloneWriter.TryLock() {
			cloneWriter.Unlock()
			return
		}
		if time.Now().After(deadline) {
			f.t.Fatal("clone job did not settle")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func (f *cloneJobsFixture) do(ctx context.Context, method, path, body string) *http.Response {
	f.t.Helper()
	var reader *strings.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	var r *http.Request
	var err error
	if reader != nil {
		r, err = http.NewRequestWithContext(ctx, method, f.srv.URL+path, reader)
	} else {
		r, err = http.NewRequestWithContext(ctx, method, f.srv.URL+path, nil)
	}
	if err != nil {
		f.t.Fatal(err)
	}
	r.Host = "unix"
	r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
	r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
	res, err := http.DefaultClient.Do(r)
	if err != nil {
		f.t.Fatal(err)
	}
	return res
}

func (f *cloneJobsFixture) action(body string) (int, map[string]any) {
	f.t.Helper()
	res := f.do(context.Background(), "POST", RepoClonesPath, body)
	defer res.Body.Close()
	var reply map[string]any
	_ = json.NewDecoder(res.Body).Decode(&reply)
	return res.StatusCode, reply
}

func (f *cloneJobsFixture) list() map[string]any {
	f.t.Helper()
	res := f.do(context.Background(), "GET", RepoClonesPath, "")
	defer res.Body.Close()
	var reply map[string]any
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&reply) != nil {
		f.t.Fatalf("list: %d", res.StatusCode)
	}
	return reply
}

func (f *cloneJobsFixture) observe() map[string]any {
	f.t.Helper()
	res := f.do(context.Background(), "GET", RepoObservePath+"?full_name=org%2Frepo", "")
	defer res.Body.Close()
	var reply map[string]any
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&reply) != nil {
		f.t.Fatalf("observe: %d", res.StatusCode)
	}
	return reply
}

func (f *cloneJobsFixture) start(mode string) string {
	f.t.Helper()
	code, reply := f.action(`{"action":"start","full_name":"org/repo","mode":"` + mode + `"}`)
	job, _ := reply["job"].(map[string]any)
	if code != 200 || job["state"] != "running" || job["mode"] != mode {
		f.t.Fatalf("start: %d %v", code, reply)
	}
	return job["job_id"].(string)
}

func (f *cloneJobsFixture) waitFile(path string) {
	f.t.Helper()
	for deadline := time.Now().Add(10 * time.Second); ; {
		if _, err := os.Stat(path); err == nil {
			return
		}
		if time.Now().After(deadline) {
			f.t.Fatalf("%s never appeared", filepath.Base(path))
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// frames reads one subscription until it ends or until a frame of kind stop.
func (f *cloneJobsFixture) frames(ctx context.Context, id string, until string) []map[string]any {
	f.t.Helper()
	res := f.do(ctx, "GET", RepoCloneEventsPath+"?job_id="+id, "")
	defer res.Body.Close()
	if res.StatusCode != 200 || res.Header.Get("Content-Type") != "text/event-stream; charset=utf-8" {
		f.t.Fatalf("events: %d", res.StatusCode)
	}
	var out []map[string]any
	scanner := bufio.NewScanner(res.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		var frame map[string]any
		if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &frame); err != nil {
			f.t.Fatal(err)
		}
		out = append(out, frame)
		if frame["kind"] == until || frame["kind"] == "terminal" {
			return out
		}
	}
	return out
}

func seedBare(t *testing.T) string {
	t.Helper()
	bare := filepath.Join(t.TempDir(), "bare.git")
	work := t.TempDir()
	for _, args := range [][]string{{"init", "-q", "--bare", bare}, {"init", "-q", work}, {"-C", work, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-q", "--allow-empty", "-m", "fixture"}, {"-C", work, "push", "-q", bare, "HEAD:refs/heads/main"}, {"--git-dir", bare, "symbolic-ref", "HEAD", "refs/heads/main"}} {
		if b, e := exec.Command("/usr/bin/git", args...).CombinedOutput(); e != nil {
			t.Fatalf("seed fixture: %v %s", e, b)
		}
	}
	return bare
}

// gitWrapper begins like git clone (an initialised .git with the canonical
// origin), reports progress, waits while the gate file exists, then fails or
// fetches the bare repository and checks it out.
func gitWrapper(t *testing.T, home, bare string, fail bool) string {
	t.Helper()
	finish := "/usr/bin/git fetch -q '" + bare + "' main:refs/remotes/origin/main || exit 1\n/usr/bin/git checkout -q -b main origin/main || exit 1\n"
	if fail {
		finish = "printf 'fatal: early EOF https://user:secret@example.invalid\\n' >&2\nexit 128\n"
	}
	script := filepath.Join(home, "git")
	code := "#!/bin/sh\nif [ \"$1\" = clone ]; then\n printf '%s\\n' \"$*\" > '" + filepath.Join(home, "args") + "'\n" +
		" /usr/bin/git init -q . || exit 1\n /usr/bin/git remote add origin https://github.com/org/repo.git || exit 1\n" +
		" printf 'Receiving objects: 14%% (1/7), 1.00 MiB\\r' >&2\n printf ready > '" + filepath.Join(home, "ready") + "'\n" +
		" while [ -e '" + filepath.Join(home, "gate") + "' ]; do /bin/sleep 0.02; done\n " + finish + " exit 0\nfi\nexec /usr/bin/git \"$@\"\n"
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(home, "src"), 0700); err != nil {
		t.Fatal(err)
	}
	return script
}

// The clone belongs to the daemon: losing the progress stream mid-receive
// does not stop it, and a new subscription starts from its current state and
// sees it finish. The workspace list does not show it until it is a checkout.
func TestCloneJobOutlivesItsStream(t *testing.T) {
	home := t.TempDir()
	script := gitWrapper(t, home, seedBare(t), false)
	f := newCloneJobsFixture(t, home, script)
	if err := os.WriteFile(f.gate, nil, 0600); err != nil {
		t.Fatal(err)
	}
	id := f.start("blobless")
	f.waitFile(f.ready)
	ctx, disconnect := context.WithCancel(context.Background())
	first := f.frames(ctx, id, "progress")
	disconnect()
	if len(first) != 1 || first[0]["job_id"] != id || first[0]["sequence"] != 1.0 {
		t.Fatalf("first subscription: %v", first)
	}
	if got := f.observe()["state"]; got != "cloning" {
		t.Fatalf("observe while cloning: %v", got)
	}
	if d := DiscoverFixtureRoot(home, f.cfg.UID); len(d.Entries) != 0 {
		t.Fatalf("running clone listed as a workspace: %+v", d.Entries)
	}
	time.Sleep(100 * time.Millisecond) // the stream is gone; the job is not
	if err := os.Remove(f.gate); err != nil {
		t.Fatal(err)
	}
	second := f.frames(context.Background(), id, "terminal")
	last := second[len(second)-1]
	if second[0]["sequence"] != 1.0 || last["kind"] != "terminal" || last["outcome"] != "confirmed" {
		t.Fatalf("resubscription: %v", second)
	}
	for _, frame := range append(first, second...) {
		if b, _ := json.Marshal(frame); strings.Contains(string(b), "example.invalid") || strings.Contains(string(b), home) {
			t.Fatalf("native detail leaked: %s", b)
		}
	}
	f.settle()
	if args, _ := os.ReadFile(f.args); !strings.Contains(string(args), "--filter=blob:none") {
		t.Fatalf("light clone not requested: %q", args)
	}
	if got := f.observe()["state"]; got != "confirmed" {
		t.Fatalf("observe after clone: %v", got)
	}
	if d := DiscoverFixtureRoot(home, f.cfg.UID); len(d.Entries) != 1 || d.Entries[0].Name != "repo" {
		t.Fatalf("finished clone not a workspace: %+v", d.Entries)
	}
	jobs := f.list()["jobs"].([]any)
	if len(jobs) != 1 || jobs[0].(map[string]any)["state"] != "confirmed" {
		t.Fatalf("list: %v", jobs)
	}
	if code, reply := f.action(`{"action":"start","full_name":"org/repo","mode":"full"}`); code != 409 || !strings.Contains(reply["error"].(map[string]any)["code"].(string), "checkout_exists") {
		t.Fatalf("repeat over a checkout: %d %v", code, reply)
	}
	if code, _ := f.action(`{"action":"dismiss","job_id":"` + id + `"}`); code != 200 || len(f.list()["jobs"].([]any)) != 0 {
		t.Fatal("dismiss")
	}
}

// Cancel and failure remove the directory the job created, so a retry is
// admitted instead of refused with checkout_exists.
func TestCloneJobCancelAndFailureCleanUp(t *testing.T) {
	for _, variant := range []string{"cancel", "failure"} {
		t.Run(variant, func(t *testing.T) {
			home := t.TempDir()
			bare := seedBare(t)
			script := gitWrapper(t, home, bare, variant == "failure")
			f := newCloneJobsFixture(t, home, script)
			if err := os.WriteFile(f.gate, nil, 0600); err != nil {
				t.Fatal(err)
			}
			id := f.start("full")
			f.waitFile(f.ready)
			if _, err := os.Stat(filepath.Join(home, "src", "repo", ".git")); err != nil {
				t.Fatal("clone did not write its destination", err)
			}
			if code, reply := f.action(`{"action":"start","full_name":"org/repo","mode":"full"}`); code != 409 || reply["error"].(map[string]any)["code"] != "clone_running" {
				t.Fatalf("second start while running: %d %v", code, reply)
			}
			want := "failed"
			if variant == "cancel" {
				want = "cancelled"
				code, reply := f.action(`{"action":"cancel","job_id":"` + id + `"}`)
				job := reply["job"].(map[string]any)
				if code != 200 || job["state"] != "cancelled" || job["leftover"] != "removed" {
					t.Fatalf("cancel: %d %v", code, reply)
				}
			} else if err := os.Remove(f.gate); err != nil {
				t.Fatal(err)
			}
			frames := f.frames(context.Background(), id, "terminal")
			last := frames[len(frames)-1]
			if last["outcome"] != want || last["leftover"] != "removed" || (variant == "failure" && last["reason"] != "native_failure") {
				t.Fatalf("terminal: %v", last)
			}
			f.settle()
			if _, err := os.Lstat(filepath.Join(home, "src", "repo")); !os.IsNotExist(err) {
				t.Fatalf("leftover kept: %v", err)
			}
			if got := f.observe()["state"]; got != "absent" {
				t.Fatalf("observe after %s: %v", variant, got)
			}
			// The retry is admitted and, with a working Git, succeeds.
			f.jobs.git = gitWrapper(t, t.TempDir(), bare, false)
			id = f.start("full")
			if frames := f.frames(context.Background(), id, "terminal"); frames[len(frames)-1]["outcome"] != "confirmed" {
				t.Fatalf("retry: %v", frames)
			}
		})
	}
}

// After a daemon restart nothing in memory remains. The leftover is
// recognised from the filesystem as interrupted, with its size; it is not a
// workspace; and only the person's explicit remove or restart touches it.
func TestCloneInterruptedAfterRestartAndExplicitActions(t *testing.T) {
	home := t.TempDir()
	bare := seedBare(t)
	script := gitWrapper(t, home, bare, false)
	interrupt := func() *cloneJobsFixture {
		t.Helper()
		f := newCloneJobsFixture(t, home, script)
		if err := os.WriteFile(f.gate, nil, 0600); err != nil {
			t.Fatal(err)
		}
		_ = os.Remove(f.ready)
		id := f.start("full")
		f.waitFile(f.ready)
		f.stop() // the daemon stops mid-receive
		if job := f.jobs.find(id); job == nil {
			t.Fatal("job lost before restart")
		} else if s, _ := job.snapshot(); s.State != "failed" || s.Reason != "daemon_stopping" || s.Leftover != "kept" {
			t.Fatalf("stopping daemon: %+v", s)
		}
		return newCloneJobsFixture(t, home, script) // the restarted daemon
	}
	for _, action := range []string{"remove", "restart"} {
		t.Run(action, func(t *testing.T) {
			f := interrupt()
			if err := os.Remove(f.gate); err != nil {
				t.Fatal(err)
			}
			observed := f.observe()
			if observed["state"] != "interrupted" || observed["size_bytes"].(float64) <= 0 {
				t.Fatalf("observe: %v", observed)
			}
			listed := f.list()
			interrupted := listed["interrupted"].([]any)
			if len(listed["jobs"].([]any)) != 0 || len(interrupted) != 1 || interrupted[0].(map[string]any)["full_name"] != "org/repo" || listed["interrupted_complete"] != true {
				t.Fatalf("list after restart: %v", listed)
			}
			if d := DiscoverFixtureRoot(home, f.cfg.UID); len(d.Entries) != 0 {
				t.Fatalf("interrupted clone listed as a workspace: %+v", d.Entries)
			}
			// Nothing restarted it by itself.
			time.Sleep(100 * time.Millisecond)
			if len(f.list()["jobs"].([]any)) != 0 {
				t.Fatal("clone restarted without being asked")
			}
			if code, _ := f.action(`{"action":"start","full_name":"org/repo","mode":"full"}`); code != 409 {
				t.Fatalf("plain start over a leftover: %d", code)
			}
			if code, reply := f.action(`{"action":"remove","full_name":"org/other"}`); code != 409 || reply["error"].(map[string]any)["code"] != "not_interrupted" {
				t.Fatalf("remove of another name: %d %v", code, reply)
			}
			switch action {
			case "remove":
				if code, reply := f.action(`{"action":"remove","full_name":"org/repo"}`); code != 200 || reply["state"] != "removed" {
					t.Fatalf("remove: %d %v", code, reply)
				}
				if _, err := os.Lstat(filepath.Join(home, "src", "repo")); !os.IsNotExist(err) {
					t.Fatalf("not removed: %v", err)
				}
			case "restart":
				code, reply := f.action(`{"action":"restart","full_name":"org/repo","mode":"blobless"}`)
				job, _ := reply["job"].(map[string]any)
				if code != 200 || job["state"] != "running" {
					t.Fatalf("restart: %d %v", code, reply)
				}
				if frames := f.frames(context.Background(), job["job_id"].(string), "terminal"); frames[len(frames)-1]["outcome"] != "confirmed" {
					t.Fatalf("restarted clone: %v", frames)
				}
				f.settle()
				if got := f.observe()["state"]; got != "confirmed" {
					t.Fatalf("after restart: %v", got)
				}
				_ = os.RemoveAll(filepath.Join(home, "src", "repo"))
			}
		})
	}
}

// The browser names a repository, never a path. A checkout with work in it,
// or a symlink, is not an interrupted clone and is never removed.
func TestCloneRemoveRefusesAnythingButAnInterruptedClone(t *testing.T) {
	home := t.TempDir()
	script := gitWrapper(t, home, seedBare(t), false)
	f := newCloneJobsFixture(t, home, script)
	repo := filepath.Join(home, "src", "repo")
	for _, args := range [][]string{{"init", "-q", repo}, {"-C", repo, "remote", "add", "origin", "https://github.com/org/repo.git"}} {
		if b, e := exec.Command("/usr/bin/git", args...).CombinedOutput(); e != nil {
			t.Fatalf("git: %v %s", e, b)
		}
	}
	if err := os.WriteFile(filepath.Join(repo, "draft.txt"), []byte("unsaved work"), 0600); err != nil {
		t.Fatal(err)
	}
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(home, "src", "linked")); err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{`{"action":"remove","full_name":"org/repo"}`, `{"action":"remove","full_name":"org/linked"}`, `{"action":"restart","full_name":"org/repo","mode":"full"}`} {
		if code, reply := f.action(body); code != 409 || reply["error"].(map[string]any)["code"] != "not_interrupted" {
			t.Fatalf("%s: %d %v", body, code, reply)
		}
	}
	for _, body := range []string{`{"action":"remove","full_name":"org/repo","path":"/tmp"}`, `{"action":"remove","full_name":"../repo"}`, `{"action":"start","full_name":"org/repo","mode":"shallow"}`, `{"action":"cancel","job_id":"../x"}`, `{"action":"cancel","job_id":"0123456789abcdef0123456789abcdef","full_name":"org/repo"}`} {
		if code, _ := f.action(body); code != 400 {
			t.Fatalf("%s: %d", body, code)
		}
	}
	if _, err := os.Stat(filepath.Join(repo, "draft.txt")); err != nil {
		t.Fatal("work removed", err)
	}
	if _, err := os.Stat(outside); err != nil {
		t.Fatal("symlink target removed", err)
	}
	if code, _ := f.action(`{"action":"cancel","job_id":"0123456789abcdef0123456789abcdef"}`); code != 404 {
		t.Fatalf("unknown job: %d", code)
	}
	res := f.do(context.Background(), "GET", RepoCloneEventsPath+"?job_id=0123456789abcdef0123456789abcdef", "")
	res.Body.Close()
	if res.StatusCode != 404 {
		t.Fatalf("events of unknown job: %d", res.StatusCode)
	}
}

// Git finished but the checkout fails verification (here: a file the clone
// did not account for). The download may be a whole repository, so it is kept
// and reported, never deleted.
func TestCloneJobVerificationFailureKeepsTheDownload(t *testing.T) {
	home := t.TempDir()
	script := gitWrapper(t, home, seedBare(t), false)
	code, err := os.ReadFile(script)
	if err != nil {
		t.Fatal(err)
	}
	dirty := strings.Replace(string(code), " exit 0\nfi\n", " printf converted > stray.txt\n exit 0\nfi\n", 1)
	if dirty == string(code) {
		t.Fatal("fixture not modified")
	}
	if err := os.WriteFile(script, []byte(dirty), 0700); err != nil {
		t.Fatal(err)
	}
	f := newCloneJobsFixture(t, home, script)
	id := f.start("full")
	frames := f.frames(context.Background(), id, "terminal")
	last := frames[len(frames)-1]
	if last["outcome"] != "failed" || last["reason"] != "verification_failed" || last["leftover"] != "kept" {
		t.Fatalf("terminal: %v", last)
	}
	f.settle()
	if _, err := os.Stat(filepath.Join(home, "src", "repo", ".git", "HEAD")); err != nil {
		t.Fatal("download removed", err)
	}
}

// A same-UID process may be unreadable throughout the settled scan while
// exiting elsewhere. Listing must retain the candidate, not report absence.
func TestCloneListInconclusiveProcessScan(t *testing.T) {
	home := t.TempDir()
	path := filepath.Join(home, "src", "repo")
	if err := os.MkdirAll(path, 0700); err != nil {
		t.Fatal(err)
	}
	for _, args := range [][]string{{"init", path}, {"-C", path, "remote", "add", "origin", "https://github.com/org/repo.git"}} {
		if out, err := exec.Command("/usr/bin/git", args...).CombinedOutput(); err != nil {
			t.Fatalf("git: %s: %v", out, err)
		}
	}
	f := newCloneJobsFixture(t, home, "/usr/bin/git")
	for _, tc := range []struct {
		name                  string
		inside, unreadable    []workspaceProcess
		scanned, wantComplete bool
		wantCount             int
	}{
		{name: "clear", scanned: true, wantComplete: true, wantCount: 1},
		{name: "transient unreadable", unreadable: []workspaceProcess{{PID: 123}}, scanned: true, wantCount: 1},
		{name: "incomplete", wantCount: 1},
		{name: "known inside", inside: []workspaceProcess{{PID: 124}}, scanned: true, wantComplete: true},
		{name: "inside and unreadable", inside: []workspaceProcess{{PID: 124}}, unreadable: []workspaceProcess{{PID: 123}}, scanned: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f.jobs.listProcessScan = func(string, string, int, map[int]bool) ([]workspaceProcess, []workspaceProcess, bool) {
				return tc.inside, tc.unreadable, tc.scanned
			}
			got := f.list()
			entries := got["interrupted"].([]any)
			if len(entries) != tc.wantCount || got["interrupted_complete"] != tc.wantComplete {
				t.Fatalf("list: %v", got)
			}
			if tc.wantCount > 0 && (entries[0].(map[string]any)["full_name"] != "org/repo" || entries[0].(map[string]any)["size_bytes"].(float64) <= 0) {
				t.Fatalf("candidate: %v", entries)
			}
			if _, err := os.Stat(path); err != nil {
				t.Fatalf("list changed candidate: %v", err)
			}
		})
	}
}
