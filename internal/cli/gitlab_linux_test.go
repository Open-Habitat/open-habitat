package cli

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/nativegitlab"
	"github.com/open-habitat/open-habitat/internal/nativegitlab/gitlabfake"
)

// newGitLabHome connects ada to a synthetic GitLab through the product's
// own store and registers this test binary as the helper for it, in a
// disposable HOME with an ordinary global store helper beside it.
func newGitLabHome(t *testing.T, token string) (gitHome, *gitlabfake.Server, nativegitlab.Base) {
	t.Helper()
	if _, err := os.Stat("/usr/bin/git"); err != nil {
		t.Skip("git unavailable")
	}
	srv, err := gitlabfake.Start(t.TempDir(), []gitlabfake.Account{
		{ID: 7, Username: "ada", Tokens: []gitlabfake.Token{{Value: "glpat-ada-0001"}, {Value: "glpat-ada-read", Scopes: []string{"read_api", "read_repository"}}}},
	}, []gitlabfake.Project{
		{ID: 102, Path: "konepaja/verkkokauppa/infra/terraform", Members: []int64{7}},
		{ID: 103, Path: "pankki-oy/digi/mobiili", Members: []int64{7}, SSO: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(srv.Close)
	home := t.TempDir()
	os.Chmod(home, 0o700)
	b, _ := nativegitlab.ParseBase(srv.URL)
	gc := "[credential]\n\thelper = store\n[http \"" + srv.URL + "\"]\n\tsslCAInfo = " + srv.CAFile + "\n[user]\n\tname = Ada\n\temail = ada@example.invalid\n"
	if err := os.WriteFile(filepath.Join(home, ".gitconfig"), []byte(gc), 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := nativegitlab.NewStore(home, filepath.Join(home, ".config"))
	if err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := store.Connect(context.Background(), nativegitlab.NewClientWithRoots(srv.Roots), b, token); err != nil {
		t.Fatal(err)
	}
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	if err := nativegitlab.NewGitConfig(home, filepath.Join(home, ".config"), "").Register(context.Background(), b, exe); err != nil {
		t.Fatal(err)
	}
	return gitHome{home: home, env: []string{"HOME=" + home, "PATH=/usr/bin:/bin", "LC_ALL=C", "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0", "OH_TEST_CLI_MAIN=1"}}, srv, b
}

// Git reaches a nested group project with the token glab's file holds, by
// the helper alone; nothing stores a second copy.
func TestGitLabCredentialHelperClonesAndPushesNestedProjects(t *testing.T) {
	g, srv, b := newGitLabHome(t, "glpat-ada-0001")
	url := b.String() + "/konepaja/verkkokauppa/infra/terraform.git"
	if _, stderr, err := g.git(t, "", "clone", "-q", "--config", "credential."+url+".username=ada", url, "terraform"); err != nil {
		t.Fatalf("clone: %v %s", err, stderr)
	}
	work := filepath.Join(g.home, "terraform")
	os.WriteFile(filepath.Join(work, "main.tf"), []byte("# change\n"), 0o600)
	for _, args := range [][]string{{"-C", work, "add", "main.tf"}, {"-C", work, "commit", "-q", "-m", "change"}, {"-C", work, "push", "-q", "origin", "HEAD:main"}} {
		if _, stderr, err := g.git(t, "", args...); err != nil {
			t.Fatalf("%v: %v %s", args, err, stderr)
		}
	}
	for _, r := range srv.GitRequests() {
		if r.User != "" && r.User != "ada" {
			t.Fatalf("Git authenticated as %q", r.User)
		}
	}
	// A group that enforces SSO for Git refuses: Git reports it, and the
	// helper never offers another credential.
	sso := b.String() + "/pankki-oy/digi/mobiili.git"
	if _, stderr, err := g.git(t, "", "clone", "-q", sso, "mobiili"); err == nil || !strings.Contains(stderr, "403") {
		t.Fatalf("sso clone: %v %s", err, stderr)
	}
	for _, copy := range []string{".git-credentials"} {
		if _, err := os.Lstat(filepath.Join(g.home, copy)); !os.IsNotExist(err) {
			t.Fatalf("credential-store copy %s created", copy)
		}
	}
	fill := func(u string) string {
		out, _, _ := g.git(t, "url="+u+"\n\n", "credential", "fill")
		return out
	}
	if out := fill(b.String() + "/a/b/c.git"); !strings.Contains(out, "username=ada\npassword=glpat-ada-0001\n") {
		t.Fatalf("fill: %q", out)
	}
	for _, u := range []string{b.String() + "/-/x/y.git", b.String() + "/only.git", "http://" + b.Authority() + "/a/b.git", "https://mallory@" + b.Authority() + "/a/b.git"} {
		if out := fill(u); strings.Contains(out, "glpat-") {
			t.Errorf("%s: %q", u, out)
		}
	}
}

func TestGitLabReadOnlyTokenCannotPush(t *testing.T) {
	g, _, b := newGitLabHome(t, "glpat-ada-read")
	url := b.String() + "/konepaja/verkkokauppa/infra/terraform.git"
	if _, stderr, err := g.git(t, "", "clone", "-q", url, "terraform"); err != nil {
		t.Fatalf("clone: %v %s", err, stderr)
	}
	work := filepath.Join(g.home, "terraform")
	g.git(t, "", "-C", work, "commit", "-q", "--allow-empty", "-m", "x")
	if _, stderr, err := g.git(t, "", "-C", work, "push", "-q", "origin", "HEAD:main"); err == nil || !strings.Contains(stderr, "403") {
		t.Fatalf("push with a read-only token: %v %s", err, stderr)
	}
}

func TestGitLabCredentialCommandSurface(t *testing.T) {
	home := t.TempDir()
	os.Chmod(home, 0o700)
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", "")
	run := func(stdin string, args ...string) (int, string, string) {
		var out, errb bytes.Buffer
		code := gitlabCommand(args, strings.NewReader(stdin), &out, &errb)
		return code, out.String(), errb.String()
	}
	if code, out, _ := run("protocol=https\nhost=gitlab.com\npath=a/b.git\n", "git-credential", "get"); code != 0 || out != "" {
		t.Fatalf("missing glab config: %d %q", code, out)
	}
	if code, out, _ := run("password=secret\n", "git-credential", "store"); code != 0 || out != "" {
		t.Fatal(code, out)
	}
	for _, args := range [][]string{{}, {"login"}, {"git-credential"}, {"git-credential", "fetch"}, {"git-credential", "get", "extra"}, {"git-credential", "--login", "x", "get"}} {
		if code, out, _ := run("", args...); code != 1 || out != "" {
			t.Errorf("%v: %d %q", args, code, out)
		}
	}
	file := filepath.Join(home, ".config", "glab-cli", "config.yml")
	os.MkdirAll(filepath.Dir(file), 0o700)
	os.WriteFile(file, []byte("hosts: [\n"), 0o600)
	if code, out, stderr := run("protocol=https\nhost=gitlab.com\npath=a/b.git\nusername=a\n", "git-credential", "get"); code != 2 || out != "" || !strings.Contains(stderr, "native_unavailable") {
		t.Fatalf("malformed glab: %d %q %q", code, out, stderr)
	}
	if code, out, _ := call(t, "gitlab", "git-credential", "--help", "--json"); code != 0 || out["data"] == nil {
		t.Fatal("help", code)
	}
}
