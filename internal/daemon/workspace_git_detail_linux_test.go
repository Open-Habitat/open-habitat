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
	"strings"
	"testing"
	"time"
)

func TestWorkspaceGitDetailNativeBoundaries(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	t.Setenv("HOME", cfg.Home)
	repo := filepath.Join(cfg.Home, "src", "native")
	if err := os.MkdirAll(repo, 0700); err != nil {
		t.Fatal(err)
	}
	run := func(args ...string) string {
		t.Helper()
		cmd := exec.Command("/usr/bin/git", args...)
		cmd.Dir = repo
		cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + cfg.Home, "GIT_CONFIG_NOSYSTEM=1", "GIT_AUTHOR_NAME=Synthetic", "GIT_AUTHOR_EMAIL=synthetic@example.invalid", "GIT_COMMITTER_NAME=Synthetic", "GIT_COMMITTER_EMAIL=synthetic@example.invalid"}
		output, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %v %s", args, err, output)
		}
		return string(output)
	}
	run("init", "-q", "-b", "main")
	if err := os.WriteFile(filepath.Join(repo, "old name"), []byte("a\n"), 0600); err != nil {
		t.Fatal(err)
	}
	run("add", ".")
	run("commit", "-qm", "first")
	first := run("rev-parse", "HEAD")
	run("remote", "add", "origin", "https://invalid.example/never-contacted.git")
	run("update-ref", "refs/remotes/origin/main", first[:len(first)-1])
	run("config", "branch.main.remote", "origin")
	run("config", "branch.main.merge", "refs/heads/main")
	if err := os.WriteFile(filepath.Join(repo, "old name"), []byte("b\n"), 0600); err != nil {
		t.Fatal(err)
	}
	run("add", ".")
	run("commit", "-qm", "second <script>literal</script>")
	run("mv", "old name", "renamed\nfile")
	entries := Discover(cfg).Entries
	if len(entries) != 1 {
		t.Fatalf("entries %+v", entries)
	}
	detail, err := readWorkspaceGitDetail(context.Background(), cfg, entries[0])
	if err != nil {
		t.Fatal(err)
	}
	if detail.Branch != "main" || detail.DirtyCount != 1 || len(detail.Files) != 1 || detail.Files[0].PreviousPath != "old name" || detail.Files[0].Path != "renamed\nfile" {
		t.Fatalf("files %+v", detail)
	}
	// A pure rename changed no lines; it is not the whole file added.
	if f := detail.Files[0]; f.Added == nil || *f.Added != 0 || *f.Deleted != 0 {
		t.Fatalf("rename counts %+v", f)
	}
	if detail.Ahead == nil || *detail.Ahead != 1 || detail.Behind == nil || *detail.Behind != 0 || len(detail.Commits) != 2 || detail.Commits[0].Pushed == nil || *detail.Commits[0].Pushed || detail.Commits[1].Pushed == nil || !*detail.Commits[1].Pushed {
		t.Fatalf("sync %+v", detail)
	}
	// The observation neither writes FETCH_HEAD nor contacts the deliberately invalid remote.
	if _, err := os.Stat(filepath.Join(repo, ".git", "FETCH_HEAD")); !os.IsNotExist(err) {
		t.Fatal("read fetched or created FETCH_HEAD")
	}
	fetchPath := filepath.Join(repo, ".git", "FETCH_HEAD")
	if err := os.WriteFile(fetchPath, []byte("synthetic recorded fetch"), 0600); err != nil {
		t.Fatal(err)
	}
	fetchTime := time.Unix(1700000000, 0)
	if err := os.Chtimes(fetchPath, fetchTime, fetchTime); err != nil {
		t.Fatal(err)
	}
	detail, err = readWorkspaceGitDetail(context.Background(), cfg, entries[0])
	if err != nil || detail.FetchedAt == nil || *detail.FetchedAt != 1700000000 {
		t.Fatalf("fetch metadata %+v %v", detail, err)
	}
	if err := os.Remove(fetchPath); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(repo, "old name"), fetchPath); err != nil {
		t.Fatal(err)
	}
	detail, err = readWorkspaceGitDetail(context.Background(), cfg, entries[0])
	if err != nil || detail.FetchedAt != nil {
		t.Fatalf("followed unsafe fetch file: %+v %v", detail, err)
	}
	id := opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entries[0].Name)
	handler := WorkspaceGitHandler(cfg, func(*http.Request) bool { return true })
	request := func(query string) *http.Request {
		r := httptest.NewRequest("GET", "http://unix"+WorkspaceGitPath+query, nil)
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", cfg.Provider+":"+cfg.Subject))
		return r
	}
	good := httptest.NewRecorder()
	handler.ServeHTTP(good, request("?workspace_id="+id))
	if good.Code != 200 {
		t.Fatalf("reply %d %s", good.Code, good.Body.String())
	}
	var reply workspaceGitDetail
	if json.Unmarshal(good.Body.Bytes(), &reply) != nil || reply.WorkspaceID != id {
		t.Fatal("invalid response identity")
	}
	for _, query := range []string{"?workspace_id=../../etc", "?workspace_id=" + id + "&workspace_id=" + id, "?workspace_id=" + id + "&path=/etc", "?workspace_id=%77" + id[1:]} {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, request(query))
		if w.Code != 400 {
			t.Fatalf("accepted query %q: %d", query, w.Code)
		}
	}
	denied := httptest.NewRecorder()
	WorkspaceGitHandler(cfg, func(*http.Request) bool { return false }).ServeHTTP(denied, request("?workspace_id="+id))
	if denied.Code != 403 {
		t.Fatal("accepted untrusted peer")
	}
	foreign := request("?workspace_id=" + id)
	foreign.Header.Set("X-Agent-Host-Identity", "wid_other-person")
	denied = httptest.NewRecorder()
	handler.ServeHTTP(denied, foreign)
	if denied.Code != 200 {
		t.Fatal("browser identity claim affected daemon authority")
	}
	var own workspaceGitDetail
	if json.Unmarshal(denied.Body.Bytes(), &own) != nil || own.WorkspaceID != id {
		t.Fatal("identity claim selected foreign state")
	}
	key := filepath.Join(cfg.Home, "signing-key")
	if output, e := exec.Command("/usr/bin/ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", key).CombinedOutput(); e != nil {
		t.Fatalf("key: %s %v", output, e)
	}
	run("config", "log.showSignature", "true")
	run("-c", "gpg.format=ssh", "-c", "user.signingkey="+key, "commit", "--allow-empty", "-S", "-qm", "signed")
	signed, e := readWorkspaceGitDetail(context.Background(), cfg, entries[0])
	if e != nil || len(signed.Commits) != 3 || signed.Commits[0].Subject != "signed" || !workspaceCommitHash.MatchString(signed.Commits[0].Hash) {
		t.Fatalf("signature output polluted records: %+v %v", signed, e)
	}
	stale := entries[0]
	if err := os.Rename(repo, repo+"-old"); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(repo, 0700); err != nil {
		t.Fatal(err)
	}
	if _, err := readWorkspaceGitDetail(context.Background(), cfg, stale); err == nil {
		t.Fatal("accepted replaced directory")
	}
}

func TestWorkspaceGitUnbornIsNotCorruption(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	t.Setenv("HOME", cfg.Home)
	repo := filepath.Join(cfg.Home, "src", "new")
	if err := os.MkdirAll(repo, 0700); err != nil {
		t.Fatal(err)
	}
	if out, err := exec.Command("/usr/bin/git", "-C", repo, "init", "-q", "-b", "main").CombinedOutput(); err != nil {
		t.Fatalf("init %s %v", out, err)
	}
	entry := Discover(cfg).Entries[0]
	detail, err := readWorkspaceGitDetail(context.Background(), cfg, entry)
	if err != nil || !detail.CommitsAvailable || len(detail.Commits) != 0 {
		t.Fatalf("unborn %+v %v", detail, err)
	}
	if err := os.WriteFile(filepath.Join(repo, ".git", "refs", "heads", "main"), []byte(strings.Repeat("1", 40)+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	detail, err = readWorkspaceGitDetail(context.Background(), cfg, entry)
	if err == nil && detail.CommitsAvailable {
		t.Fatal("corrupt HEAD reported as known empty commits")
	}
	if err := os.WriteFile(filepath.Join(repo, ".git", "refs", "heads", "main"), []byte("malformed ref\n"), 0600); err != nil {
		t.Fatal(err)
	}
	detail, err = readWorkspaceGitDetail(context.Background(), cfg, entry)
	if err == nil && detail.CommitsAvailable {
		t.Fatal("malformed ref reported as known empty commits")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	detail, err = readWorkspaceGitDetail(ctx, cfg, entry)
	if err == nil || detail.CommitsAvailable {
		t.Fatal("cancelled read reported as known empty commits")
	}
}
