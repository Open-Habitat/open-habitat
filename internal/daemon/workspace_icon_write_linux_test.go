//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"
)

// The config is edited line by line: the icon line is replaced or added and
// every other line, comment and key stays; what cannot be edited that way is
// refused rather than rewritten.
func TestEditIconConfig(t *testing.T) {
	for _, c := range []struct{ name, old, value, want string }{
		{"new", "", "🦔", "icon: \"🦔\"\n"},
		{"replace keeps comments and keys", "# Open Habitat\nicon: \"🍳\" # the old one\nfuture:\n  - 1\n", "OH", "# Open Habitat\nicon: \"OH\"\nfuture:\n  - 1\n"},
		{"append", "# comment only", "auto", "# comment only\nicon: auto\n"},
		{"append after keys", "name: x\n", "design-system/favicon.svg", "name: x\nicon: \"design-system/favicon.svg\"\n"},
		{"crlf", "a: 1\r\nicon: x.svg\r\n", "🦊", "a: 1\r\nicon: \"🦊\"\r\n"},
	} {
		got, err := editIconConfig([]byte(c.old), c.value)
		if err != nil || string(got) != c.want {
			t.Errorf("%s: %q %v, want %q", c.name, got, err, c.want)
		}
	}
	for _, c := range []struct {
		name, old, value string
		want             error
	}{
		{"two icon lines", "icon: a.svg\nicon: b.svg\n", "🦔", errIconConfig},
		{"multi-line value", "icon: |\n  🦔\nother: 1\n", "OH", errIconConfig},
		{"quoted key", "\"icon\": \"🍳\"\n", "OH", errIconConfig},
		{"not a mapping", "- one\n- two\n", "OH", errIconConfig},
		{"not YAML", "a: [\n", "OH", errIconConfig},
		{"nested icon kept", "theme:\n  icon: x\n", "OH", nil},
		{"words", "", "hello world", errIconInvalid},
		{"lower case letters", "", "oh", errIconInvalid},
		{"escape", "", "../x.svg", errIconInvalid},
		{"quote", "", "a\".svg", errIconInvalid},
		{"newline", "", "🦔\nother: 1", errIconInvalid},
	} {
		if _, err := editIconConfig([]byte(c.old), c.value); !errors.Is(err, c.want) && (err != nil || c.want != nil) {
			t.Errorf("%s: %v, want %v", c.name, err, c.want)
		}
	}
}

// The flat format the reader and every writer share.
func TestParseIconValue(t *testing.T) {
	for v, want := range map[string]iconSetting{
		"auto":          {Kind: "auto", Value: "auto"},
		"oh":            {Kind: "letters", Value: "OH"},
		"Ä3":            {Kind: "letters", Value: "Ä3"},
		"ABCD":          {},
		"🦔":             {Kind: "emoji", Value: "🦔"},
		"./brand/a.PNG": {Kind: "image", Value: "brand/a.PNG"},
		"brand/a.gif":   {},
		"a b":           {},
		"":              {},
	} {
		if got := parseIconValue(v); got != want {
			t.Errorf("%q: %+v, want %+v", v, got, want)
		}
	}
}

func iconGitFixture(t *testing.T, home, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("/usr/bin/git", append([]string{"-C", dir}, args...)...)
	cmd.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1"}
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v %s", args, err, out)
	}
	return string(out)
}

// Choosing an icon writes the config and commits that file alone, without
// the work an agent has staged or left in the working tree; a directory
// without Git only gets the file; a config with changes of its own is
// written but not committed; and every tab hears to read the snapshot again.
func TestWorkspaceIconWriteCommitsOnlyTheConfig(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	if err := os.WriteFile(filepath.Join(cfg.Home, ".gitconfig"), []byte("[user]\n\tname = Synthetic\n\temail = synthetic@example.invalid\n[init]\n\tdefaultBranch = main\n"), 0600); err != nil {
		t.Fatal(err)
	}
	repo := filepath.Join(cfg.Home, "src", "repo")
	plain := filepath.Join(cfg.Home, "src", "plain")
	for _, d := range []string{repo, plain} {
		if err := os.MkdirAll(d, 0700); err != nil {
			t.Fatal(err)
		}
	}
	iconGitFixture(t, cfg.Home, repo, "init", "-q")
	iconTree(t, repo, map[string]string{"README.md": "x\n", "staged.txt": "a\n", "design-system/favicon.svg": iconSVG})
	iconGitFixture(t, cfg.Home, repo, "add", ".")
	iconGitFixture(t, cfg.Home, repo, "commit", "-qm", "first")
	// An agent's work in progress: one staged change, one unstaged.
	iconTree(t, repo, map[string]string{"staged.txt": "b\n", "README.md": "y\n"})
	iconGitFixture(t, cfg.Home, repo, "add", "staged.txt")
	// A hook that would fail the commit is never run.
	iconTree(t, repo, map[string]string{".git/hooks/pre-commit": "#!/bin/sh\nexit 1\n"})
	if err := os.Chmod(filepath.Join(repo, ".git/hooks/pre-commit"), 0700); err != nil {
		t.Fatal(err)
	}

	controller := &ConversationController{journal: newEventJournal()}
	handler := workspaceHandler(cfg, func(*http.Request) bool { return true }, controller)
	set := func(name string, icon any) (int, map[string]any) {
		t.Helper()
		var entry Workspace
		for _, e := range Discover(cfg).Entries {
			if e.Name == name {
				entry = e
			}
		}
		b, _ := json.Marshal(map[string]any{"action": "icon", "workspace_id": workspaceIDOf(cfg, entry), "observation_token": workspaceToken(cfg, entry), "icon": icon})
		r := httptest.NewRequest("POST", "http://unix/api/v1/workspaces", bytes.NewReader(b))
		r.RequestURI = WorkspacePath
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		var out map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w.Code, out
	}
	icon := func(name string) workspaceIcon {
		for _, e := range DiscoverListing(cfg).Entries {
			if e.Name == name {
				return e.Icon
			}
		}
		return workspaceIcon{}
	}

	before := controller.journal.seq
	code, out := set("repo", "🦔")
	if code != 200 || out["icon_commit"] != iconCommitted || controller.journal.seq == before {
		t.Fatalf("set: %d %v", code, out)
	}
	if got := iconGitFixture(t, cfg.Home, repo, "show", "--name-only", "--format=%s", "HEAD"); got != "Työtilan kuvake: 🦔 (open-habitat)\n\n.open-habitat.yaml\n" {
		t.Fatalf("commit: %q", got)
	}
	if got := iconGitFixture(t, cfg.Home, repo, "status", "--porcelain"); got != " M README.md\nM  staged.txt\n" {
		t.Fatalf("the agent's work moved: %q", got)
	}
	if got := icon("repo"); got.Kind != "emoji" || got.Value != "🦔" || got.LogoPath != "design-system/favicon.svg" {
		t.Fatalf("icon: %+v", got)
	}
	if code, out = set("repo", "🦔"); code != 200 || out["icon_commit"] != iconUnchanged {
		t.Fatalf("same again: %d %v", code, out)
	}
	if code, out = set("repo", "auto"); code != 200 || out["icon_commit"] != iconCommitted {
		t.Fatalf("auto: %d %v", code, out)
	}
	if got := icon("repo"); got.Kind != "image" || got.Source != "logo" || !got.Auto {
		t.Fatalf("auto icon: %+v", got)
	}
	// The person's own edit to the config is not committed for them.
	iconTree(t, repo, map[string]string{".open-habitat.yaml": "# mine\nicon: auto\n"})
	if code, out = set("repo", "OH"); code != 200 || out["icon_commit"] != iconUncommitted {
		t.Fatalf("dirty config: %d %v", code, out)
	}
	if got, _ := os.ReadFile(filepath.Join(repo, ".open-habitat.yaml")); string(got) != "# mine\nicon: \"OH\"\n" {
		t.Fatalf("dirty config content: %q", got)
	}
	if got := iconGitFixture(t, cfg.Home, repo, "log", "--format=%s"); strings.Count(got, "\n") != 3 {
		t.Fatalf("commits: %q", got)
	}

	// Without Git there is only the file.
	if code, out = set("plain", "AB"); code != 200 || out["icon_commit"] != iconNotGit {
		t.Fatalf("plain: %d %v", code, out)
	}
	if got := icon("plain"); got.Kind != "letters" || got.Value != "AB" {
		t.Fatalf("plain icon: %+v", got)
	}
	// What the format does not admit, or the chain could not show, is refused.
	for _, bad := range []any{"hello world", "missing/logo.svg", "", 7} {
		if code, out = set("plain", bad); code != 409 && code != 400 {
			t.Fatalf("%v: %d %v", bad, code, out)
		}
	}
	iconTree(t, plain, map[string]string{".open-habitat.yaml": "icon: a.svg\nicon: b.svg\n"})
	if code, out = set("plain", "🦊"); code != 409 {
		t.Fatalf("unsupported config: %d %v", code, out)
	}
	// A symlinked config is never followed or replaced.
	if err := os.Remove(filepath.Join(plain, ".open-habitat.yaml")); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(cfg.Home, "outside.yaml")
	iconTree(t, cfg.Home, map[string]string{"outside.yaml": "icon: auto\n"})
	if err := os.Symlink(outside, filepath.Join(plain, ".open-habitat.yaml")); err != nil {
		t.Fatal(err)
	}
	if code, _ = set("plain", "🦊"); code != 409 {
		t.Fatalf("symlinked config: %d", code)
	}
	if got, _ := os.ReadFile(outside); string(got) != "icon: auto\n" {
		t.Fatalf("followed the symlink: %q", got)
	}
}

// The agent listener has no icon write.
func TestAgentWorkspaceRouteHasNoIconWrite(t *testing.T) {
	if agentWorkspaceAction("icon") {
		t.Fatal("agent route admits icon")
	}
}

// Another writer's change is not lost to the icon write, and the commit
// holds exactly the bytes the daemon wrote, on top of the HEAD it read:
// what the working tree holds at commit time, a change made before the
// read, and a commit made meanwhile do not enter it.
func TestWorkspaceIconWriteRaces(t *testing.T) {
	home := t.TempDir()
	if err := os.WriteFile(filepath.Join(home, ".gitconfig"), []byte("[user]\n\tname = Synthetic\n\temail = synthetic@example.invalid\n[init]\n\tdefaultBranch = main\n"), 0600); err != nil {
		t.Fatal(err)
	}
	repo := filepath.Join(home, "repo")
	if err := os.MkdirAll(repo, 0700); err != nil {
		t.Fatal(err)
	}
	open := func() int {
		fd, err := unix.Open(repo, unix.O_DIRECTORY|unix.O_RDONLY|unix.O_CLOEXEC, 0)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { unix.Close(fd) })
		return fd
	}
	iconGitFixture(t, home, repo, "init", "-q")
	root := open()
	ctx := context.Background()
	config := filepath.Join(repo, ".open-habitat.yaml")
	read := func() string { b, _ := os.ReadFile(config); return string(b) }
	defer func() { iconBeforeRename = func() {} }()

	// An unborn branch: the first commit holds the config alone.
	iconTree(t, repo, map[string]string{"notes.txt": "x\n"})
	if out, err := setWorkspaceIcon(ctx, home, root, "git_main_worktree", "🦔"); err != nil || out != iconCommitted {
		t.Fatalf("unborn: %q %v", out, err)
	}
	if got := iconGitFixture(t, home, repo, "show", "--name-only", "--format=%s", "HEAD"); got != "Työtilan kuvake: 🦔 (open-habitat)\n\n.open-habitat.yaml\n" {
		t.Fatalf("unborn commit: %q", got)
	}
	if got := iconGitFixture(t, home, repo, "status", "--porcelain"); got != "?? notes.txt\n" {
		t.Fatalf("unborn status: %q", got)
	}

	// A write landing between the check and the rename is put back.
	iconBeforeRename = func() {
		if err := os.WriteFile(config, []byte("icon: \"🦔\"\nmine: true\n"), 0600); err != nil {
			t.Error(err)
		}
	}
	if _, err := writeIconConfig(root, "OH"); !errors.Is(err, errIconUnavailable) || read() != "icon: \"🦔\"\nmine: true\n" {
		t.Fatalf("lost the other write: %v %q", err, read())
	}
	iconGitFixture(t, home, repo, "checkout", "--", ".open-habitat.yaml")
	// A config created meanwhile where there was none is not replaced.
	plain := filepath.Join(home, "plain")
	if err := os.MkdirAll(plain, 0700); err != nil {
		t.Fatal(err)
	}
	pfd, err := unix.Open(plain, unix.O_DIRECTORY|unix.O_RDONLY|unix.O_CLOEXEC, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(pfd)
	iconBeforeRename = func() {
		if err := os.WriteFile(filepath.Join(plain, ".open-habitat.yaml"), []byte("theirs: 1\n"), 0600); err != nil {
			t.Error(err)
		}
	}
	if _, err := writeIconConfig(pfd, "OH"); !errors.Is(err, errIconUnavailable) {
		t.Fatalf("replaced a new config: %v", err)
	}
	if b, _ := os.ReadFile(filepath.Join(plain, ".open-habitat.yaml")); string(b) != "theirs: 1\n" {
		t.Fatalf("new config: %q", b)
	}
	iconBeforeRename = func() {}
	if entries, _ := os.ReadDir(plain); len(entries) != 1 {
		t.Fatalf("temporary left behind: %v", entries)
	}

	// A change made before the read is preserved but not committed.
	st, err := readIconGitState(ctx, home, root)
	if err != nil {
		t.Fatal(err)
	}
	iconTree(t, repo, map[string]string{".open-habitat.yaml": "icon: \"🦔\"\nagent: 1\n"})
	w, err := writeIconConfig(root, "AB")
	if err != nil || iconConfigClean(ctx, home, root, st, w.old) {
		t.Fatalf("an edited base counted as clean: %v", err)
	}
	iconGitFixture(t, home, repo, "checkout", "--", ".open-habitat.yaml")

	// What the working tree holds at commit time does not enter the commit.
	st, err = readIconGitState(ctx, home, root)
	if err != nil {
		t.Fatal(err)
	}
	w, err = writeIconConfig(root, "AB")
	if err != nil || !iconConfigClean(ctx, home, root, st, w.old) {
		t.Fatalf("clean write: %v", err)
	}
	iconTree(t, repo, map[string]string{".open-habitat.yaml": "icon: \"AB\"\nlater: 1\n"})
	if out := commitIconConfig(ctx, home, root, st, w.next, "AB"); out != iconCommitted {
		t.Fatalf("commit: %q", out)
	}
	if got := iconGitFixture(t, home, repo, "show", "HEAD:.open-habitat.yaml"); got != string(w.next) {
		t.Fatalf("committed %q, wrote %q", got, w.next)
	}
	if read() != "icon: \"AB\"\nlater: 1\n" {
		t.Fatalf("working tree changed: %q", read())
	}
	iconGitFixture(t, home, repo, "checkout", "--", ".open-habitat.yaml")

	// Nothing is committed in the middle of a merge or rebase.
	iconTree(t, repo, map[string]string{".git/MERGE_HEAD": "0000000000000000000000000000000000000000\n"})
	if out, err := setWorkspaceIcon(ctx, home, root, "git_main_worktree", "🦉"); err != nil || out != iconCommitFailed {
		t.Fatalf("mid-merge: %q %v", out, err)
	}
	if err := os.Remove(filepath.Join(repo, ".git/MERGE_HEAD")); err != nil {
		t.Fatal(err)
	}
	iconGitFixture(t, home, repo, "checkout", "--", ".open-habitat.yaml")

	// A commit made meanwhile is not overwritten.
	st, err = readIconGitState(ctx, home, root)
	if err != nil {
		t.Fatal(err)
	}
	w, err = writeIconConfig(root, "🦊")
	if err != nil {
		t.Fatal(err)
	}
	iconGitFixture(t, home, repo, "commit", "-q", "--allow-empty", "-m", "agent")
	if out := commitIconConfig(ctx, home, root, st, w.next, "🦊"); out != iconCommitFailed {
		t.Fatalf("overwrote a newer HEAD: %q", out)
	}
	if got := iconGitFixture(t, home, repo, "log", "-1", "--format=%s"); got != "agent\n" {
		t.Fatalf("HEAD: %q", got)
	}
}
