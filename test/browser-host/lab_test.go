//go:build linux

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestLabEditorTargetBelongsToGitBaseline(t *testing.T) {
	home := t.TempDir()
	if err := seedLab(home); err != nil {
		t.Fatal(err)
	}
	repo := filepath.Join(home, "src", "aurinkokello")
	git := func(args ...string) string {
		t.Helper()
		cmd := exec.Command("/usr/bin/git", append([]string{"-C", repo}, args...)...)
		cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home, "GIT_CONFIG_NOSYSTEM=1"}
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %v: %s", args, err, out)
		}
		return string(out)
	}
	want := "M  README.md\n M pyproject.toml\n M scripts/status_rows.py\n?? tests/\n"
	if got := git("status", "--porcelain=v1"); got != want {
		t.Fatalf("lab dirty files = %q, want %q", got, want)
	}
	committed := git("show", "HEAD:cmd/main.go")
	current, err := os.ReadFile(filepath.Join(repo, "cmd", "main.go"))
	if err != nil {
		t.Fatal(err)
	}
	if string(current) != committed || !strings.Contains(committed, "Aurinkokello") {
		t.Fatal("editor link target is not the committed synthetic source")
	}
	// A new worktree also needs the link target; untracked fixture setup
	// would silently omit it from the person's new branch.
	worktree := filepath.Join(home, "editor-worktree")
	git("worktree", "add", "--detach", worktree)
	copied, err := os.ReadFile(filepath.Join(worktree, "cmd", "main.go"))
	if err != nil || string(copied) != committed {
		t.Fatalf("editor link target missing or changed in new worktree: %v", err)
	}
}
