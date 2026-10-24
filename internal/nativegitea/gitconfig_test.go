package nativegitea

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// gitHome is a disposable HOME with an ordinary global Git configuration:
// gh's GitHub helper and a global store helper. The real ~/.gitconfig is
// never read or written.
func gitHome(t *testing.T) (GitConfig, string) {
	t.Helper()
	if _, err := os.Stat("/usr/bin/git"); err != nil {
		t.Skip("git unavailable")
	}
	home := t.TempDir()
	cfg := "[credential]\n\thelper = store\n[credential \"https://github.com\"]\n\thelper = \n\thelper = !/usr/bin/gh auth git-credential\n"
	if err := os.WriteFile(filepath.Join(home, ".gitconfig"), []byte(cfg), 0o600); err != nil {
		t.Fatal(err)
	}
	exe := filepath.Join(home, "bin", "open-habitat")
	os.MkdirAll(filepath.Dir(exe), 0o700)
	if err := os.WriteFile(exe, []byte("#!/bin/sh\nexit 0\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	return GitConfig{Home: home, ConfigHome: filepath.Join(home, ".config")}, exe
}

func gitGet(t *testing.T, g GitConfig, key string) string {
	t.Helper()
	out, _ := g.run(context.Background(), "config", "--get-all", "--global", "--includes", key)
	return string(out)
}

func TestGitHelperRegistration(t *testing.T) {
	g, exe := gitHome(t)
	ctx := context.Background()
	b := mustBase(t, "https://git.example.org:3000/gitea")
	github := gitGet(t, g, "credential.https://github.com.helper")
	if st, err := g.State(ctx, b, exe); err != nil || st != HelperAbsent {
		t.Fatal(st, err)
	}
	if err := g.Register(ctx, b, exe); err != nil {
		t.Fatal(err)
	}
	if err := g.Register(ctx, b, exe); err != nil {
		t.Fatal("repeat:", err)
	}
	if st, err := g.State(ctx, b, exe); err != nil || st != HelperRegistered {
		t.Fatal(st, err)
	}
	if got := gitGet(t, g, "credential.https://git.example.org:3000/gitea.helper"); got != "\n"+exe+" gitea git-credential\n" {
		t.Fatalf("helper chain %q", got)
	}
	if gitGet(t, g, "credential.https://github.com.helper") != github || gitGet(t, g, "credential.helper") != "store\n" {
		t.Fatal("other helpers changed")
	}
	// Git itself resolves the scope: this base and below, not the host root
	// or another port.
	for url, want := range map[string]string{
		"https://git.example.org:3000/gitea/o/r.git": "true\n",
		"https://git.example.org:3000/o/r.git":       "",
		"https://git.example.org/gitea/o/r.git":      "",
	} {
		out, _ := g.run(ctx, "config", "--global", "--get-urlmatch", "credential.useHttpPath", url)
		if string(out) != want {
			t.Errorf("%s: %q", url, out)
		}
	}
	data, _ := os.ReadFile(filepath.Join(g.Home, ".gitconfig"))
	if !strings.Contains(string(data), "followRedirects = false") {
		t.Fatalf("redirects not disabled:\n%s", data)
	}

	// A foreign change in our scope is left alone on removal.
	if _, err := g.run(ctx, "config", "--global", "--add", "credential.https://git.example.org:3000/gitea.helper", "cache"); err != nil {
		t.Fatal(err)
	}
	before, _ := os.ReadFile(filepath.Join(g.Home, ".gitconfig"))
	if err := g.Unregister(ctx, b, exe); err != ErrHelperConflict {
		t.Fatal(err)
	}
	if after, _ := os.ReadFile(filepath.Join(g.Home, ".gitconfig")); string(after) != string(before) {
		t.Fatal("foreign scope edited")
	}
	g.run(ctx, "config", "--global", "--fixed-value", "--unset", "credential.https://git.example.org:3000/gitea.helper", "cache")
	if err := g.Unregister(ctx, b, exe); err != nil {
		t.Fatal(err)
	}
	if st, err := g.State(ctx, b, exe); err != nil || st != HelperAbsent {
		t.Fatal(st, err)
	}
	if gitGet(t, g, "credential.https://github.com.helper") != github || gitGet(t, g, "credential.helper") != "store\n" {
		t.Fatal("other helpers changed by removal")
	}
}

func TestGitHelperRefusesForeignScopeAndUnsafeExecutable(t *testing.T) {
	g, exe := gitHome(t)
	ctx := context.Background()
	b := mustBase(t, "git.example.org")
	exec.Command("/usr/bin/git", "config", "--file", filepath.Join(g.Home, ".gitconfig"), "credential.https://git.example.org.helper", "!tea login helper").Run()
	before, _ := os.ReadFile(filepath.Join(g.Home, ".gitconfig"))
	if err := g.Register(ctx, b, exe); err != ErrHelperConflict {
		t.Fatal(err)
	}
	if after, _ := os.ReadFile(filepath.Join(g.Home, ".gitconfig")); string(after) != string(before) {
		t.Fatal("foreign helper overwritten")
	}
	for _, bad := range []string{"open-habitat", exe + " ; rm", "/usr/bin/../bin/git", filepath.Join(g.Home, "missing"), filepath.Join(g.Home, ".gitconfig")} {
		if _, err := HelperCommand(bad); err == nil {
			t.Errorf("%q accepted", bad)
		}
	}
}

func appendGitconfig(t *testing.T, g GitConfig, text string) {
	t.Helper()
	f, err := os.OpenFile(filepath.Join(g.Home, ".gitconfig"), os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	f.WriteString(text)
}

// Git applies helper entries in configuration-file order, so a helper
// written after our chain reset would also be asked (and asked to store).
func TestGitHelperShadowedByLaterEntry(t *testing.T) {
	g, exe := gitHome(t)
	ctx := context.Background()
	b := mustBase(t, "git.example.org")
	if err := g.Register(ctx, b, exe); err != nil {
		t.Fatal(err)
	}
	for _, later := range []string{
		"[credential \"https://other.example.org\"]\n\thelper = cache\n",
		"[credential \"http://git.example.org\"]\n\thelper = cache\n",
		"[credential \"https://git.example.org:3000\"]\n\thelper = cache\n",
	} {
		appendGitconfig(t, g, later)
		if st, err := g.State(ctx, b, exe); err != nil || st != HelperRegistered {
			t.Fatalf("unrelated later scope %q: %s %v", later, st, err)
		}
	}
	for _, later := range []string{
		"[credential]\n\thelper = cache\n",
		"[credential \"https://*.example.org\"]\n\thelper = cache\n",
		"[credential \"https://git.example.org/o\"]\n\thelper = cache\n",
	} {
		appendGitconfig(t, g, later)
		if st, err := g.State(ctx, b, exe); err != nil || st != HelperShadowed {
			t.Fatalf("%q: %s %v", later, st, err)
		}
		if err := g.Register(ctx, b, exe); err != nil {
			t.Fatalf("repair: %v", err)
		}
		if st, err := g.State(ctx, b, exe); err != nil || st != HelperRegistered {
			t.Fatalf("after repair: %s %v", st, err)
		}
	}
	// A later applicable reset drops our helper from the chain.
	appendGitconfig(t, g, "[credential]\n\thelper =\n")
	if st, err := g.State(ctx, b, exe); err != nil || st != HelperShadowed {
		t.Fatalf("later reset: %s %v", st, err)
	}
	if err := g.Register(ctx, b, exe); err != nil {
		t.Fatal(err)
	}
	// Another of our base registrations (reset, then ours) is not shadowing.
	if err := g.Register(ctx, mustBase(t, "git.example.org/gitea"), exe); err != nil {
		t.Fatal(err)
	}
	if st, err := g.State(ctx, b, exe); err != nil || st != HelperRegistered {
		t.Fatalf("sibling registration: %s %v", st, err)
	}
	// Git loads included files during credential operations; so do we.
	inc := filepath.Join(g.Home, "extra.inc")
	os.WriteFile(inc, []byte("[credential]\n\thelper = store\n"), 0o600)
	appendGitconfig(t, g, "[include]\n\tpath = "+inc+"\n")
	if st, err := g.State(ctx, b, exe); err != nil || st != HelperShadowed {
		t.Fatalf("included helper: %s %v", st, err)
	}
	if err := g.Register(ctx, b, exe); err != nil {
		t.Fatal(err)
	}
	if st, err := g.State(ctx, b, exe); err != nil || st != HelperRegistered {
		t.Fatalf("after moving past the include: %s %v", st, err)
	}
	if got := gitGet(t, g, "credential.helper"); got != "store\ncache\n\nstore\n" {
		t.Fatalf("foreign helpers changed by the move: %q", got)
	}
	// A foreign key in our section keeps it in place: refuse, do not move it.
	if _, err := g.run(ctx, "config", "--global", "credential.https://git.example.org.username", "bob"); err != nil {
		t.Fatal(err)
	}
	appendGitconfig(t, g, "[credential]\n\thelper = cache\n")
	if err := g.Register(ctx, b, exe); err != ErrHelperConflict {
		t.Fatalf("pinned section: %v", err)
	}
	if gitGet(t, g, "credential.https://git.example.org.username") != "bob\n" {
		t.Fatal("foreign key in our scope removed")
	}
}
