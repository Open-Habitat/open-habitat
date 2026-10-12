//go:build linux

package daemon

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestWorkspaceRemoteNativeObservation(t *testing.T) {
	home := t.TempDir()
	src := filepath.Join(home, "src")
	if err := os.Mkdir(src, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(src, "local")
	if err := os.Mkdir(path, 0700); err != nil {
		t.Fatal(err)
	}
	git := func(args ...string) {
		t.Helper()
		cmd := exec.Command("/usr/bin/git", args...)
		cmd.Dir = path
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git: %v %s", err, out)
		}
	}
	git("init", "-q")
	read := func() string {
		obs := DiscoverFixtureRoot(home, os.Geteuid())
		if len(obs.Entries) != 1 {
			t.Fatalf("discovery: %+v", obs)
		}
		remote, continuation := workspaceRemote(context.Background(), home, obs.Entries[0])
		if continuation && remote != "github" {
			t.Fatalf("unexpected continuation: %s", remote)
		}
		return remote
	}
	if got := read(); got != "none" {
		t.Fatalf("empty: %s", got)
	}
	git("remote", "add", "origin", "https://github.com/example/local.git")
	if got := read(); got != "github" {
		t.Fatalf("github: %s", got)
	}
	git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "Initial")
	obs := DiscoverFixtureRoot(home, os.Geteuid()).Entries[0]
	if remote, continuation := workspaceRemote(context.Background(), home, obs); remote != "github" || !continuation {
		t.Fatalf("unpublished origin: %s %v", remote, continuation)
	}
	git("remote", "set-url", "origin", "https://example.invalid/local.git")
	if got := read(); got != "other" {
		t.Fatalf("other: %s", got)
	}
	stale := DiscoverFixtureRoot(home, os.Geteuid()).Entries[0]
	if err := os.Rename(path, path+"-moved"); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path, 0700); err != nil {
		t.Fatal(err)
	}
	// An old discovery entry does not prove the replacement is the same checkout.
	if got, _ := workspaceRemote(context.Background(), home, stale); got != "unknown" {
		t.Fatalf("stale: %s", got)
	}
}
