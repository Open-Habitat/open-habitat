//go:build linux

package daemon

import (
	"context"
	"maps"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/nativegitea"
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
	// Nothing but .git and a GitHub origin would be an interrupted clone.
	if err := os.WriteFile(filepath.Join(path, "README"), []byte("work"), 0600); err != nil {
		t.Fatal(err)
	}
	read := func() string {
		obs := DiscoverFixtureRoot(home, os.Geteuid())
		if len(obs.Entries) != 1 {
			t.Fatalf("discovery: %+v", obs)
		}
		remote, continuation, _ := workspaceRemote(context.Background(), home, obs.Entries[0])
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
	if remote, continuation, _ := workspaceRemote(context.Background(), home, obs); remote != "github" || !continuation {
		t.Fatalf("unpublished origin: %s %v", remote, continuation)
	}
	git("remote", "set-url", "origin", "https://example.invalid/local.git")
	if got := read(); got != "other" {
		t.Fatalf("other: %s", got)
	}
	// The origin a Gitea match is derived from is the address Git fetches,
	// after the person's own rewrite rules.
	git("config", "url.https://git.example.test/ada/.insteadOf", "gitea:")
	git("remote", "set-url", "origin", "gitea:local.git")
	if _, _, origin := workspaceRemote(context.Background(), home, DiscoverFixtureRoot(home, os.Geteuid()).Entries[0]); origin != "https://git.example.test/ada/local.git" {
		t.Fatalf("effective origin: %q", origin)
	}
	stale := DiscoverFixtureRoot(home, os.Geteuid()).Entries[0]
	if err := os.Rename(path, path+"-moved"); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path, 0700); err != nil {
		t.Fatal(err)
	}
	// An old discovery entry does not prove the replacement is the same checkout.
	if got, _, origin := workspaceRemote(context.Background(), home, stale); got != "unknown" || origin != "" {
		t.Fatalf("stale: %s", got)
	}
}

// A workspace's Gitea fact names a base and owner/name the person has
// connected, never an account and never the address. The same owner/name
// on two servers are two repositories; an origin that only resembles one
// (SSH, credentials in it, another base path) is no match.
func TestGiteaOriginMatchIsPerServer(t *testing.T) {
	one, _ := nativegitea.ParseBase("https://one.example.test")
	two, _ := nativegitea.ParseBase("https://two.example.test/git")
	bases := []nativegitea.Base{one, two, one}
	for origin, want := range map[string]map[string]string{
		"https://one.example.test/ada/notes.git":         {"base_url": "https://one.example.test", "full_name": "ada/notes"},
		"https://two.example.test/git/ada/notes.git":     {"base_url": "https://two.example.test/git", "full_name": "ada/notes"},
		"https://two.example.test/ada/notes.git":         nil,
		"git@one.example.test:ada/notes.git":             nil,
		"ssh://git@one.example.test/ada/notes.git":       nil,
		"https://ada:tok@one.example.test/ada/notes.git": nil,
		"https://github.com/ada/notes.git":               nil,
		"":                                               nil,
	} {
		if got := giteaOriginMatch(origin, bases); !maps.Equal(got, want) {
			t.Errorf("%q: %v, want %v", origin, got, want)
		}
	}
	if got := giteaOriginMatch("https://one.example.test/ada/notes.git", nil); got != nil {
		t.Fatalf("matched with no connection: %v", got)
	}
	if giteaBases(nil) != nil {
		t.Fatal("bases without an adapter")
	}
}
