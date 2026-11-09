package cli

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/nativegitea"
	"github.com/Open-Habitat/open-habitat/internal/testgitenv"
)

// TestMain lets Git run this test binary as the installed helper: with
// OH_TEST_CLI_MAIN set it is the open-habitat entry point. Otherwise it first
// drops the caller's repository-bound Git variables (internal/testgitenv).
func TestMain(m *testing.M) {
	if os.Getenv("OH_TEST_CLI_MAIN") == "1" {
		os.Exit(Run(os.Args[1:], os.Stdout, os.Stderr))
	}
	testgitenv.Scrub()
	os.Exit(m.Run())
}

const giteaTea = `logins:
    - name: alice-work
      url: https://git.example.org
      token: tok-alice-0001
      default: true
      user: alice
    - name: bob-work
      url: https://git.example.org
      token: tok-bob-0002
      user: bob
    - name: carol-sub
      url: https://git.example.org/gitea
      token: tok-carol-0003
      user: carol
    - name: dave-port
      url: https://git.example.org:3000
      token: tok-dave-0004
      user: dave
    - name: ivan-v6
      url: https://[fd00::5]:3000
      token: tok-ivan-0005
      user: ivan
`

type gitHome struct {
	home string
	env  []string
}

// newGitHome builds a disposable HOME: tea's file, an ordinary global Git
// configuration with a global store helper and gh's GitHub helper, and our
// helper registered through nativegitea for each Gitea base. Neither the
// real ~/.config/tea nor the real Git configuration is touched.
func newGitHome(t *testing.T, bases ...string) gitHome {
	t.Helper()
	if _, err := os.Stat("/usr/bin/git"); err != nil {
		t.Skip("git unavailable")
	}
	home := t.TempDir()
	os.Chmod(home, 0o700) // a group-writable home is refused, as it should be
	tea := filepath.Join(home, ".config", "tea", "config.yml")
	os.MkdirAll(filepath.Dir(tea), 0o700)
	if err := os.WriteFile(tea, []byte(giteaTea), 0o600); err != nil {
		t.Fatal(err)
	}
	gc := "[credential]\n\thelper = store\n[credential \"https://github.com\"]\n\thelper = \n\thelper = !/usr/bin/gh auth git-credential\n"
	if err := os.WriteFile(filepath.Join(home, ".gitconfig"), []byte(gc), 0o600); err != nil {
		t.Fatal(err)
	}
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	g := nativegitea.NewGitConfig(home, filepath.Join(home, ".config"), "")
	for _, s := range bases {
		b, err := nativegitea.ParseBase(s)
		if err != nil {
			t.Fatal(err)
		}
		if err := g.Register(context.Background(), b, exe); err != nil {
			t.Fatalf("register %s: %v", s, err)
		}
	}
	// A global helper written after ours (as `git config --global
	// credential.helper` does when no [credential] section exists yet)
	// shadows the registration until Register moves it after that entry.
	f, _ := os.OpenFile(filepath.Join(home, ".gitconfig"), os.O_APPEND|os.O_WRONLY, 0)
	f.WriteString("[credential]\n\thelper = store --file " + filepath.Join(home, "late-store") + "\n")
	f.Close()
	for _, s := range bases {
		b, _ := nativegitea.ParseBase(s)
		if st, err := g.State(context.Background(), b, exe); err != nil || st != nativegitea.HelperShadowed {
			t.Fatalf("%s: %s %v", s, st, err)
		}
		if err := g.Register(context.Background(), b, exe); err != nil {
			t.Fatalf("repair %s: %v", s, err)
		}
	}
	return gitHome{home: home, env: []string{"HOME=" + home, "PATH=/usr/bin:/bin", "LC_ALL=C", "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0", "OH_TEST_CLI_MAIN=1"}}
}

func (g gitHome) git(t *testing.T, input string, args ...string) (string, string, error) {
	t.Helper()
	cmd := exec.Command("/usr/bin/git", args...)
	cmd.Dir = g.home
	cmd.Env = g.env
	cmd.Stdin = strings.NewReader(input)
	var out, errb bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &errb
	err := cmd.Run()
	return out.String(), errb.String(), err
}

func TestGiteaCredentialHelperThroughGit(t *testing.T) {
	g := newGitHome(t, "https://git.example.org", "https://git.example.org/gitea", "https://git.example.org:3000", "https://[fd00::5]:3000")
	fill := func(url string, config ...string) (string, error) {
		args := append(config, "credential", "fill")
		out, stderr, err := g.git(t, "url="+url+"\n\n", args...)
		if strings.Contains(stderr, "tok-") {
			t.Fatalf("token on stderr: %q", stderr)
		}
		return out, err
	}
	for _, c := range []struct {
		url    string
		config []string
		token  string
	}{
		{"https://git.example.org/o/r.git", []string{"-c", "credential.username=alice"}, "tok-alice-0001"},
		{"https://git.example.org/o/r.git", []string{"-c", "credential.username=bob"}, "tok-bob-0002"},
		{"https://bob@git.example.org/o/r.git", nil, "tok-bob-0002"},
		{"https://git.example.org/gitea/o/r.git", nil, "tok-carol-0003"},
		{"https://git.example.org:3000/o/r.git", []string{"-c", "credential.username=dave"}, "tok-dave-0004"},
		{"https://ivan@[fd00::5]:3000/o/r.git", nil, "tok-ivan-0005"},
	} {
		out, err := fill(c.url, c.config...)
		if err != nil || !strings.Contains(out, "\npassword="+c.token+"\n") {
			t.Errorf("%s %v: %q %v", c.url, c.config, out, err)
		}
	}
	for _, c := range []struct {
		url    string
		config []string
	}{
		{"https://git.example.org/o/r.git", nil},                                               // two accounts, no username
		{"https://git.example.org/gitea/o/r.git", []string{"-c", "credential.username=alice"}}, // root account at base-path instance
		{"https://git.example.org:3000/o/r.git", []string{"-c", "credential.username=alice"}},  // other port
		{"http://git.example.org/o/r.git", []string{"-c", "credential.username=alice"}},        // plain HTTP
	} {
		if out, err := fill(c.url, c.config...); err == nil || strings.Contains(out, "password=") {
			t.Errorf("%s %v: credential returned %q", c.url, c.config, out)
		}
	}

	// Git asks every helper in the chain to store an approved credential.
	// The scope reset keeps the global store helper out of it, and our
	// store is a no-op: no second copy appears anywhere.
	out, err := fill("https://git.example.org/o/r.git", "-c", "credential.username=bob")
	if err != nil {
		t.Fatal(err)
	}
	if _, stderr, err := g.git(t, out+"\n", "credential", "approve"); err != nil {
		t.Fatalf("approve: %v %s", err, stderr)
	}
	if _, stderr, err := g.git(t, out+"\n", "credential", "reject"); err != nil {
		t.Fatalf("reject: %v %s", err, stderr)
	}
	for _, copy := range []string{".git-credentials", "late-store"} {
		if _, err := os.Lstat(filepath.Join(g.home, copy)); !os.IsNotExist(err) {
			t.Fatalf("credential-store copy %s created", copy)
		}
	}
	tea, _ := os.ReadFile(filepath.Join(g.home, ".config", "tea", "config.yml"))
	if string(tea) != giteaTea {
		t.Fatal("reject/erase changed tea's file")
	}
	filepath.Walk(g.home, func(p string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || strings.HasSuffix(p, "config.yml") {
			return nil
		}
		if b, _ := os.ReadFile(p); bytes.Contains(b, []byte("tok-")) {
			t.Errorf("token copied into %s", p)
		}
		return nil
	})
}

func TestGiteaCredentialHelperExplicitLoginNeverCrossesHost(t *testing.T) {
	// A mis-scoped, explicitly selected helper (here unscoped) still cannot
	// lend a login to another host, port or base.
	g := newGitHome(t)
	exe, _ := os.Executable()
	if _, _, err := g.git(t, "", "config", "--global", "--replace-all", "credential.helper", exe+" gitea git-credential --login alice-work"); err != nil {
		t.Fatal(err)
	}
	g.git(t, "", "config", "--global", "credential.useHttpPath", "true")
	for _, url := range []string{"https://alice@evil.example.org/o/r.git", "https://alice@git.example.org:3000/o/r.git", "https://alice@git.example.org/gitea/o/r.git"} {
		if out, _, err := g.git(t, "url="+url+"\n\n", "credential", "fill"); err == nil || strings.Contains(out, "password=") {
			t.Errorf("%s: %q", url, out)
		}
	}
	if out, _, err := g.git(t, "url=https://alice@git.example.org/o/r.git\n\n", "credential", "fill"); err != nil || !strings.Contains(out, "password=tok-alice-0001") {
		t.Fatalf("within instance: %q %v", out, err)
	}
}

func TestGiteaCredentialCommandSurface(t *testing.T) {
	home := t.TempDir()
	os.Chmod(home, 0o700) // a group-writable home is refused, as it should be
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", "")
	run := func(stdin string, args ...string) (int, string, string) {
		var out, errb bytes.Buffer
		code := giteaCommand(args, strings.NewReader(stdin), &out, &errb)
		return code, out.String(), errb.String()
	}
	if code, out, _ := run("protocol=https\nhost=git.example.org\npath=o/r.git\n", "git-credential", "get"); code != 0 || out != "" {
		t.Fatalf("missing tea config: %d %q", code, out)
	}
	if code, out, _ := run("password=secret\n", "git-credential", "store"); code != 0 || out != "" {
		t.Fatal(code, out)
	}
	for _, args := range [][]string{{}, {"login"}, {"git-credential"}, {"git-credential", "fetch"}, {"git-credential", "get", "extra"}, {"git-credential", "--login"}, {"git-credential", "--login", "", "get"}} {
		if code, out, _ := run("", args...); code != 1 || out != "" {
			t.Errorf("%v: %d %q", args, code, out)
		}
	}
	if code, out, _ := run("url=https://x.org/\n", "git-credential", "get"); code != 1 || out != "" {
		t.Fatalf("url attribute: %d %q", code, out)
	}
	tea := filepath.Join(home, ".config", "tea", "config.yml")
	os.MkdirAll(filepath.Dir(tea), 0o700)
	os.WriteFile(tea, []byte("logins: [\n"), 0o600)
	if code, out, stderr := run("protocol=https\nhost=git.example.org\npath=o/r.git\nusername=a\n", "git-credential", "get"); code != 2 || out != "" || !strings.Contains(stderr, "native_unavailable") {
		t.Fatalf("malformed tea: %d %q %q", code, out, stderr)
	}
	if code, out, _ := call(t, "gitea", "git-credential", "--help", "--json"); code != 0 || out["data"] == nil {
		t.Fatal("help", code)
	}
}
