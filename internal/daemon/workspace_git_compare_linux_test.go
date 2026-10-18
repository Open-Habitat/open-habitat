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
	"strconv"
	"strings"
	"testing"
	"time"
)

type gitFixture struct {
	t     *testing.T
	home  string
	env   []string
	clock int
}

func (g *gitFixture) run(dir string, args ...string) string {
	g.t.Helper()
	g.clock++
	stamp := "@" + strconv.Itoa(1790000000+g.clock*60) + " +0000"
	cmd := exec.Command("/usr/bin/git", args...)
	cmd.Dir = dir
	cmd.Env = append(append([]string{}, g.env...), "GIT_AUTHOR_DATE="+stamp, "GIT_COMMITTER_DATE="+stamp)
	out, err := cmd.CombinedOutput()
	if err != nil {
		g.t.Fatalf("git %v: %v %s", args, err, out)
	}
	return strings.TrimSpace(string(out))
}

func (g *gitFixture) commit(dir, file, body, subject string) {
	g.t.Helper()
	if err := os.WriteFile(filepath.Join(dir, file), []byte(body), 0600); err != nil {
		g.t.Fatal(err)
	}
	g.run(dir, "add", file)
	g.run(dir, "commit", "-qm", subject)
}

// A clone of a bare remote in the same disposable home: the fetch reaches it
// by path, so nothing leaves the machine.
func newGitFixture(t *testing.T) (*gitFixture, string, string, string) {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	g := &gitFixture{t: t, home: home, env: []string{"PATH=/usr/bin:/bin", "HOME=" + home, "GIT_CONFIG_NOSYSTEM=1", "GIT_AUTHOR_NAME=Synthetic", "GIT_AUTHOR_EMAIL=synthetic@example.invalid", "GIT_COMMITTER_NAME=Synthetic", "GIT_COMMITTER_EMAIL=synthetic@example.invalid"}}
	remote := filepath.Join(home, "remote.git")
	other := filepath.Join(home, "other")
	repo := filepath.Join(home, "src", "aurinkokello")
	g.run(home, "init", "-q", "--bare", "-b", "main", remote)
	g.run(home, "clone", "-q", remote, other)
	g.commit(other, "README.md", "a\n", "Ensimmäinen")
	g.commit(other, "status.py", "x\n", "Statusskripti")
	g.run(other, "push", "-q", "origin", "main")
	if err := os.MkdirAll(filepath.Dir(repo), 0700); err != nil {
		t.Fatal(err)
	}
	g.run(home, "clone", "-q", remote, repo)
	return g, remote, other, repo
}

func TestWorkspaceGitBaseAndCommitLists(t *testing.T) {
	g, _, other, repo := newGitFixture(t)
	cfg, _ := cloneFixture(t)
	cfg.Home = g.home
	// Feature branch with its own upstream: two unpushed, one incoming.
	g.run(repo, "switch", "-q", "-c", "status-rivit")
	g.commit(repo, "status.py", "x\ny\n", "Statusrivit JSON-muotoon")
	g.run(repo, "push", "-q", "-u", "origin", "status-rivit")
	g.run(other, "fetch", "-q")
	g.run(other, "switch", "-q", "status-rivit")
	g.commit(other, "README.md", "a\nb\n", "README: esimerkki")
	g.run(other, "push", "-q", "origin", "status-rivit")
	g.commit(repo, "status.py", "x\ny\nz\n", "Statusrivit: --since")
	g.commit(repo, "status.py", "x\ny\nz\nw\n", "Jäsennys omaksi funktioksi")
	// main moves on twice on the remote.
	g.run(other, "switch", "-q", "main")
	g.commit(other, "ci.yml", "c\n", "CI: välimuisti")
	g.commit(other, "tz.py", "t\n", "Aikavyöhyke")
	g.run(other, "push", "-q", "origin", "main")
	g.run(repo, "fetch", "-q")
	// Working tree: a modified tracked file, an untracked text file and an
	// untracked binary file.
	if err := os.WriteFile(filepath.Join(repo, "status.py"), []byte("x\nY\nz\nw\nv\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repo, "test status.py"), []byte("1\n2\n3"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(repo, "kuva.bin"), []byte{1, 0, 2}, 0600); err != nil {
		t.Fatal(err)
	}
	entries := Discover(cfg).Entries
	if len(entries) != 1 {
		t.Fatalf("entries %+v", entries)
	}
	summary, ok := workspaceGitSummary(context.Background(), cfg.Home, entries[0])
	base, _ := summary["base"].(*gitBase)
	if !ok || summary["branch"] != "status-rivit" || summary["dirty_count"] != 3 || summary["upstream"] != "origin/status-rivit" || summary["ahead"] != 2 || summary["behind"] != 1 || base == nil {
		t.Fatalf("summary %+v", summary)
	}
	// origin/HEAD comes from the clone, as GitHub's default branch would.
	if base.Name != "main" || base.Ref != "origin/main" || base.Source != "origin_head" || base.Ahead != 3 || base.Behind != 2 || base.Merged {
		t.Fatalf("base %+v", base)
	}
	detail, err := readWorkspaceGitDetail(context.Background(), cfg, workspaceGitTarget(cfg, entries[0]))
	if err != nil {
		t.Fatal(err)
	}
	subjects := func(list []workspaceGitCommit) string {
		var s []string
		for _, c := range list {
			s = append(s, c.Subject)
		}
		return strings.Join(s, "|")
	}
	if subjects(detail.Unpushed) != "Jäsennys omaksi funktioksi|Statusrivit: --since" || subjects(detail.Incoming) != "README: esimerkki" {
		t.Fatalf("upstream lists %q %q", subjects(detail.Unpushed), subjects(detail.Incoming))
	}
	if subjects(detail.BaseAhead) != "Jäsennys omaksi funktioksi|Statusrivit: --since|Statusrivit JSON-muotoon" || subjects(detail.BaseBehind) != "Aikavyöhyke|CI: välimuisti" {
		t.Fatalf("base lists %q %q", subjects(detail.BaseAhead), subjects(detail.BaseBehind))
	}
	counts := map[string]string{}
	for _, f := range detail.Files {
		if f.Added == nil {
			counts[f.Path] = f.Status + " -"
		} else {
			counts[f.Path] = f.Status + " +" + strconv.Itoa(*f.Added) + "-" + strconv.Itoa(*f.Deleted)
		}
	}
	if counts["status.py"] != " M +2-1" || counts["test status.py"] != "?? +3-0" || counts["kuva.bin"] != "?? -" {
		t.Fatalf("line counts %v", counts)
	}

	// A recorded source branch wins over origin/HEAD; merging the work into
	// it is what "merged" reports.
	g.run(repo, "config", "branch.status-rivit.workmux-base", "main")
	summary, _ = workspaceGitSummary(context.Background(), cfg.Home, entries[0])
	base, _ = summary["base"].(*gitBase)
	if base == nil || base.Source != "recorded" || base.Ref != "main" || base.Ahead != 3 || base.Behind != 0 || base.Merged {
		t.Fatalf("recorded base %+v", base)
	}
	g.run(repo, "stash", "-q", "-u")
	g.run(repo, "switch", "-q", "main")
	g.run(repo, "merge", "-q", "--ff-only", "status-rivit")
	g.run(repo, "switch", "-q", "status-rivit")
	summary, _ = workspaceGitSummary(context.Background(), cfg.Home, entries[0])
	base, _ = summary["base"].(*gitBase)
	if base == nil || base.Ahead != 0 || !base.Merged {
		t.Fatalf("merged base %+v", base)
	}
	// An unusable record is ignored, not followed.
	g.run(repo, "config", "branch.status-rivit.workmux-base", "-main")
	summary, _ = workspaceGitSummary(context.Background(), cfg.Home, entries[0])
	if base, _ = summary["base"].(*gitBase); base == nil || base.Source != "origin_head" {
		t.Fatalf("invalid record %+v", base)
	}

	// On main itself the base is its own upstream: nothing new to say.
	g.run(repo, "switch", "-q", "main")
	summary, _ = workspaceGitSummary(context.Background(), cfg.Home, entries[0])
	if summary["base"] != nil || summary["upstream"] != "origin/main" {
		t.Fatalf("main %+v", summary)
	}
	// Without origin/HEAD or a record there is no base to guess.
	g.run(repo, "switch", "-q", "status-rivit")
	g.run(repo, "config", "--unset", "branch.status-rivit.workmux-base")
	g.run(repo, "remote", "set-head", "origin", "--delete")
	summary, _ = workspaceGitSummary(context.Background(), cfg.Home, entries[0])
	if summary["base"] != nil {
		t.Fatalf("guessed base %+v", summary["base"])
	}
	detail, err = readWorkspaceGitDetail(context.Background(), cfg, workspaceGitTarget(cfg, entries[0]))
	if err != nil || detail.Base != nil || detail.BaseAhead != nil {
		t.Fatalf("detail without base %+v %v", detail, err)
	}
}

func TestWorkspaceGitFetchRunsAsUserAndClassifiesFailures(t *testing.T) {
	g, _, other, repo := newGitFixture(t)
	cfg, _ := cloneFixture(t)
	cfg.Home = g.home
	head := g.run(repo, "rev-parse", "HEAD")
	g.commit(other, "uusi.txt", "u\n", "Korjaa CI-aikakatkaisu")
	g.run(other, "push", "-q", "origin", "main")
	entries := Discover(cfg).Entries
	id := opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entries[0].Name)
	handler := workspaceGitFetchHandler(cfg, func(*http.Request) bool { return true }, "/usr/bin/git", 10*time.Second)
	post := func(body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "http://unix"+WorkspaceGitFetchPath, bytes.NewBufferString(body))
		r.RequestURI = WorkspaceGitFetchPath
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", cfg.Provider+":"+cfg.Subject))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	before, err := readWorkspaceGitDetail(context.Background(), cfg, workspaceGitTarget(cfg, entries[0]))
	if err != nil || *before.Behind != 0 || before.FetchedAt != nil {
		t.Fatalf("before %+v %v", before, err)
	}
	reply := post(`{"workspace_id":"` + id + `"}`)
	var after workspaceGitDetail
	if reply.Code != 200 || json.Unmarshal(reply.Body.Bytes(), &after) != nil || after.WorkspaceID != id || after.Behind == nil || *after.Behind != 1 || len(after.Incoming) != 1 || after.Incoming[0].Subject != "Korjaa CI-aikakatkaisu" || after.FetchedAt == nil {
		t.Fatalf("fetch %d %s", reply.Code, reply.Body.String())
	}
	// Remote-tracking refs only: the branch and working tree stay.
	if g.run(repo, "rev-parse", "HEAD") != head {
		t.Fatal("fetch moved HEAD")
	}
	for _, body := range []string{`{"workspace_id":"../x"}`, `{"workspace_id":"` + id + `","remote":"evil"}`, `{"workspace_id":"` + id + `","workspace_id":"` + id + `"}`} {
		if w := post(body); w.Code != 400 {
			t.Fatalf("accepted %s: %d", body, w.Code)
		}
	}
	g.run(repo, "remote", "set-url", "origin", filepath.Join(g.home, "missing.git"))
	if w := post(`{"workspace_id":"` + id + `"}`); w.Code != 409 || !strings.Contains(w.Body.String(), `"remote_not_found"`) || strings.Contains(w.Body.String(), "missing.git") {
		t.Fatalf("missing remote %d %s", w.Code, w.Body.String())
	}
	g.run(repo, "remote", "remove", "origin")
	if w := post(`{"workspace_id":"` + id + `"}`); w.Code != 409 || !strings.Contains(w.Body.String(), `"no_remote"`) {
		t.Fatalf("no remote %d %s", w.Code, w.Body.String())
	}
	untrusted := workspaceGitFetchHandler(cfg, func(*http.Request) bool { return false }, "/usr/bin/git", time.Second)
	r := httptest.NewRequest("POST", "http://unix"+WorkspaceGitFetchPath, bytes.NewBufferString(`{"workspace_id":"`+id+`"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	untrusted.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("accepted untrusted peer")
	}
}

func TestFetchFailureClassification(t *testing.T) {
	for _, c := range []struct {
		stderr string
		ssh    bool
		want   string
	}{
		{"git@github.com: Permission denied (publickey).\r\nfatal: Could not read from remote repository.\n", true, "remote_ssh_unavailable"},
		{"Host key verification failed.\nfatal: Could not read from remote repository.", true, "remote_ssh_unavailable"},
		{"fatal: could not read Username for 'https://github.com': terminal prompts disabled", false, "remote_auth_unavailable"},
		{"ssh: Could not resolve hostname github.com: Temporary failure in name resolution", true, "remote_unreachable"},
		{"ERROR: Repository not found.\nfatal: Could not read from remote repository.", true, "remote_not_found"},
		{"fatal: something else", false, "fetch_failed"},
	} {
		if got := classifyFetchFailure([]byte(c.stderr), c.ssh); got != c.want {
			t.Errorf("%q: %s, want %s", c.stderr, got, c.want)
		}
	}
	for url, want := range map[string]bool{"git@github.com:o/r.git": true, "ssh://git@host/r": true, "https://github.com/o/r.git": false, "/srv/r.git": false, "./r": false} {
		if gitURLIsSSH(url) != want {
			t.Errorf("%s: %v", url, !want)
		}
	}
}
