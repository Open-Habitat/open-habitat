//go:build linux

package daemon

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestWorkspaceGitSummaryNativeOnly(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	t.Setenv("HOME", cfg.Home)
	root := filepath.Join(cfg.Home, "src")
	if err := os.Mkdir(root, 0700); err != nil {
		t.Fatal(err)
	}
	repo := filepath.Join(root, "native")
	if err := os.Mkdir(repo, 0700); err != nil {
		t.Fatal(err)
	}
	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("/usr/bin/git", args...)
		cmd.Dir = repo
		cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1")
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %s: %v", args, out, err)
		}
	}
	run("init", "-q", "-b", "feature", ".")
	run("remote", "add", "origin", "https://github.com/org/native.git")
	if err := os.WriteFile(filepath.Join(repo, "with\nnewline"), []byte("a"), 0600); err != nil {
		t.Fatal(err)
	}
	entries := Discover(cfg).Entries
	if len(entries) != 1 {
		t.Fatalf("entries %+v", entries)
	}
	got, ok := workspaceGitSummary(context.Background(), cfg.Home, entries[0])
	if !ok || got["branch"] != "feature" || got["dirty_count"] != 1 || got["github_repo"] != "org/native" {
		t.Fatalf("summary %+v (%v)", got, ok)
	}
	run("remote", "set-url", "origin", "https://user:password@github.com/org/native.git")
	got, ok = workspaceGitSummary(context.Background(), cfg.Home, entries[0])
	if !ok || got["github_repo"] != nil {
		t.Fatalf("credential URL leaked: %+v", got)
	}
	if err := os.Rename(repo, filepath.Join(root, "moved")); err != nil {
		t.Fatal(err)
	}
	if _, ok := workspaceGitSummary(context.Background(), cfg.Home, entries[0]); ok {
		t.Fatal("stale inode accepted")
	}
}
