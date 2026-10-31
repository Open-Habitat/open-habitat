//go:build linux

package daemon

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestCloneEmptyRepository(t *testing.T) {
	for _, mode := range []string{"full", "blobless"} {
		t.Run(mode, func(t *testing.T) {
			home := t.TempDir()
			bare := filepath.Join(t.TempDir(), "empty.git")
			if b, err := exec.Command("/usr/bin/git", "init", "--bare", "-q", bare).CombinedOutput(); err != nil {
				t.Fatalf("init: %s %v", b, err)
			}
			script := filepath.Join(home, "git")
			// Actual Git clones an empty remote; only the provider address is synthetic.
			code := "#!/bin/sh\nif [ \"$1\" = clone ]; then\n/usr/bin/git clone -q '" + bare + "' . || exit 1\nexec /usr/bin/git remote set-url origin https://github.com/org/repo.git\nfi\nexec /usr/bin/git \"$@\"\n"
			if err := os.WriteFile(script, []byte(code), 0700); err != nil {
				t.Fatal(err)
			}
			f := newCloneJobsFixture(t, home, script)
			id := f.start(mode)
			frames := f.frames(context.Background(), id, "terminal")
			if len(frames) == 0 || frames[len(frames)-1]["outcome"] != "confirmed" {
				t.Fatalf("empty clone: %v", frames)
			}
			f.settle()
			if got := f.observe()["state"]; got != "confirmed" {
				t.Fatalf("observe: %v", got)
			}
			if d := DiscoverFixtureRoot(home, f.cfg.UID); len(d.Entries) != 1 {
				t.Fatalf("discovery: %+v", d)
			}
			// The job is not the completion record: filesystem discovery after restart
			// must retain this workspace and never offer destructive interrupted recovery.
			f.jobs.mu.Lock()
			f.jobs.jobs = nil
			f.jobs.mu.Unlock()
			if got := f.list()["interrupted"].([]any); len(got) != 0 {
				t.Fatalf("interrupted: %v", got)
			}
			path := filepath.Join(home, "src", "repo")
			for _, args := range [][]string{
				{"-C", path, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-m", "first"},
				{"-C", path, "push", bare, "HEAD:refs/heads/main"},
			} {
				if b, e := exec.Command("/usr/bin/git", args...).CombinedOutput(); e != nil {
					t.Fatalf("first commit/push: %s %v", b, e)
				}
			}
		})
	}
}
