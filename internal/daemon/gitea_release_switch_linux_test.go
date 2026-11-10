//go:build linux

package daemon

import (
	"context"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/nativegitea"
	"github.com/open-habitat/open-habitat/internal/nativegitea/giteafake"
)

// installGeneration copies this test binary (which answers as the product
// helper, see TestMain) into an immutable generation, as a release upgrade
// stages the product binary.
func installGeneration(t *testing.T, root, name string) string {
	t.Helper()
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(root, "generations", name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	src, err := os.Open(self)
	if err != nil {
		t.Fatal(err)
	}
	defer src.Close()
	path := filepath.Join(dir, "open-habitat")
	dst, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o755)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.Copy(dst, src); err != nil {
		t.Fatal(err)
	}
	if err := dst.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

// switchCurrent replaces the selector atomically, as host upgrade does.
func switchCurrent(t *testing.T, root, generation string) {
	t.Helper()
	next := filepath.Join(root, "current.next")
	if err := os.Symlink(filepath.Join(root, "generations", generation), next); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(next, filepath.Join(root, "current")); err != nil {
		t.Fatal(err)
	}
}

// A clone made under one release keeps fetching after an upgrade switches
// the installation's selector and the previous generation is deleted. The
// daemon registers the helper at the path it was launched through, the
// restarted daemon finds that registration its own, and a person's plain
// `git fetch` and the next clone job both authenticate from tea's file with
// no second token store, no token in argv and no repair.
func TestGiteaHelperSurvivesReleaseSwitchAndOldReleaseRemoval(t *testing.T) {
	root := t.TempDir()
	genA := installGeneration(t, root, "a")
	switchCurrent(t, root, "a")
	launch := filepath.Join(root, "current", "open-habitat")
	// What systemd's ExecStart=/opt/open-habitat/current/open-habitat gives
	// the daemon: argv[0] through the selector, os.Executable resolved.
	exe := launchedExecutable(genA, launch)
	if exe != launch {
		t.Fatalf("helper pinned to a generation: %s", exe)
	}
	w := newGiteaWalkAt(t, exe)
	host := strings.TrimPrefix(w.srv.URL, "https://")
	ada := w.connect(host, "tok-ada-0001")
	_, started := w.clone(ada, 101)
	job, _ := started["job"].(map[string]any)
	if done := w.waitJob(job["job_id"].(string)); done["state"] != "confirmed" {
		t.Fatalf("clone before upgrade: %v", done)
	}
	gitconfig, _ := os.ReadFile(filepath.Join(w.home, ".gitconfig"))
	if !strings.Contains(string(gitconfig), launch+" gitea git-credential") || strings.Contains(string(gitconfig), "generations") {
		t.Fatalf("registration is not the stable entry point: %s", gitconfig)
	}

	// Upgrade: the next generation is staged, the selector switched, and
	// the previous generation removed while the clone stays on disk.
	genB := installGeneration(t, root, "b")
	switchCurrent(t, root, "b")
	if err := os.RemoveAll(filepath.Dir(genA)); err != nil {
		t.Fatal(err)
	}
	if err := w.srv.AddCommit("ada", "notes", "after-upgrade.txt", "upgrade\n"); err != nil {
		t.Fatal(err)
	}

	// The person's own Git, from a shell, with only their configuration.
	trace := filepath.Join(t.TempDir(), "trace")
	checkout := filepath.Join(w.home, "src", "notes")
	cmd := exec.Command("/usr/bin/git", "fetch", "-q", "origin")
	cmd.Dir = checkout
	cmd.Env = []string{"HOME=" + w.home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0", "GIT_TRACE=" + trace}
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("person's fetch after upgrade: %v %s", err, out)
	}
	traced, _ := os.ReadFile(trace)
	if !strings.Contains(string(traced), launch+" gitea git-credential get") || strings.Contains(string(traced), "tok-") {
		t.Fatalf("helper run: %s", traced)
	}
	if got := w.git(checkout, "rev-parse", "origin/main:after-upgrade.txt"); got == "" {
		t.Fatal("fetch did not bring the upstream commit")
	}

	// The daemon restarted from the new generation: same entry point, so
	// its registration is still its own and nothing needs a repair.
	exeB := launchedExecutable(genB, launch)
	env := integrations.Env{Home: w.home, FixtureTools: true, LoadConfig: func() (integrations.Config, error) { return integrations.Config{Tools: w.tools}, nil }}
	restarted, err := integrations.NewGitea(env, nativegitea.NewClientWithRoots(w.srv.Roots), "/usr/bin/git", exeB)
	if err != nil {
		t.Fatal(err)
	}
	login, err := restarted.Login(ada)
	if err != nil {
		t.Fatal(err)
	}
	if st, err := restarted.Git.State(context.Background(), login.Base, restarted.Executable); err != nil || st != nativegitea.HelperRegistered {
		t.Fatalf("restarted daemon's registration: %v %v", st, err)
	}
	w.adapter, w.clones.jobs.gitea = restarted, restarted
	if got := w.fetch("notes"); got != "" {
		t.Fatalf("managed fetch after upgrade: %s", got)
	}
	if err := w.srv.AddRepo(giteafake.Repo{ID: 104, Owner: "ada", Name: "diary", Private: true}); err != nil {
		t.Fatal(err)
	}
	_, started = w.clone(ada, 104)
	job, _ = started["job"].(map[string]any)
	if done := w.waitJob(job["job_id"].(string)); done["state"] != "confirmed" {
		t.Fatalf("clone after upgrade: %v", done)
	}

	// tea's file stays the one place the token is written.
	tea := filepath.Join(w.home, ".config", "tea", "config.yml")
	_ = filepath.WalkDir(w.home, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || path == tea {
			return nil
		}
		if b, _ := os.ReadFile(path); strings.Contains(string(b), "tok-ada-0001") {
			t.Errorf("token copied into %s", path)
		}
		return nil
	})
	if _, err := os.Stat(filepath.Join(w.home, ".git-credentials")); !os.IsNotExist(err) {
		t.Fatalf("a second token store: %v", err)
	}
}
