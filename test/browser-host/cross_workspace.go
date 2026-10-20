package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
)

// Additive fixture for the cross-repository journey. Git owns the checkout,
// Taskfleet-shaped native records own the child; no API responses are mocked.
func crossWorkspaceFixture(home, parent string) error {
	if err := writeFakeTaskfleet(home, parent, "git-project", "running"); err != nil {
		return err
	}
	repo := filepath.Join(home, "src", "git-project")
	worktree := filepath.Join(home, "src", "git-project__worktrees", "cross-worker")
	env := []string{"HOME=" + home, "PATH=/usr/bin:/bin", "GIT_AUTHOR_NAME=Fixture", "GIT_AUTHOR_EMAIL=fixture@example.invalid", "GIT_COMMITTER_NAME=Fixture", "GIT_COMMITTER_EMAIL=fixture@example.invalid"}
	for _, args := range [][]string{{"init", "-q", "-b", "main"}, {"commit", "--allow-empty", "-qm", "fixture"}, {"worktree", "add", "-qb", "cross-worker", worktree}} {
		cmd := exec.Command("/usr/bin/git", append([]string{"-C", repo}, args...)...)
		cmd.Env = env
		if err := cmd.Run(); err != nil {
			return err
		}
	}
	root := filepath.Join(home, ".taskfleet")
	b, err := os.ReadFile(filepath.Join(root, "fixture-show.json"))
	if err != nil {
		return err
	}
	var reply struct {
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(b, &reply); err != nil {
		return err
	}
	run := reply.Data
	run["worktree_path"] = worktree
	run["node_transcripts"] = []any{map[string]any{"node_id": "n-0001", "worktree_path": worktree}}
	for name, value := range map[string]any{
		"fixture-list.json":                             map[string]any{"schema_version": 1, "data": map[string]any{"runs": []any{run}}},
		"fixture-show.json":                             map[string]any{"schema_version": 1, "data": run},
		"runs/" + fakeTaskfleetRunID + "/manifest.json": run,
	} {
		b, err := json.Marshal(value)
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(root, name), b, 0600); err != nil {
			return err
		}
	}
	return nil
}
