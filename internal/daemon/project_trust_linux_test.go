//go:build linux

package daemon

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

func trustHome(t *testing.T) string {
	t.Helper()
	// The test directory itself may sit below a symlink; Pi and the kernel
	// see canonical paths, and so does the decision.
	home, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range []string{"src/project", "src/project__worktrees/feature", "elsewhere/repo"} {
		if err := os.MkdirAll(filepath.Join(home, d), 0700); err != nil {
			t.Fatal(err)
		}
	}
	return home
}

func trustFor(t *testing.T, home, open, cwd string) []string {
	t.Helper()
	f, err := os.Open(open)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	return projectTrustArgs(home, cwd, f)
}

func writeTrustStore(t *testing.T, home, body string) {
	t.Helper()
	dir := filepath.Join(home, ".pi", "agent")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "trust.json"), []byte(body), 0600); err != nil {
		t.Fatal(err)
	}
}

// A workspace and a worktree below ~/src get Pi's --approve; ~/src itself,
// a directory elsewhere in the home and a symlink in ~/src that leads out
// of it keep Pi's default. A cwd that is not the held directory gets none.
func TestProjectTrustBelowSourceOnly(t *testing.T) {
	home := trustHome(t)
	src := filepath.Join(home, "src")
	if err := os.Symlink(filepath.Join(home, "elsewhere", "repo"), filepath.Join(src, "escape")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(src, "project"), filepath.Join(home, "alias")); err != nil {
		t.Fatal(err)
	}
	approve := []string{"--approve"}
	for _, tc := range []struct {
		name, open, cwd string
		want            []string
	}{
		{"workspace", filepath.Join(src, "project"), filepath.Join(src, "project"), approve},
		{"helper without cwd", filepath.Join(src, "project"), "", approve},
		{"worktree", filepath.Join(src, "project__worktrees", "feature"), filepath.Join(src, "project__worktrees", "feature"), approve},
		{"symlink into src", filepath.Join(home, "alias"), filepath.Join(home, "alias"), approve},
		{"source root", src, src, nil},
		{"outside src", filepath.Join(home, "elsewhere", "repo"), filepath.Join(home, "elsewhere", "repo"), nil},
		{"symlink escaping src", filepath.Join(src, "escape"), filepath.Join(src, "escape"), nil},
		{"cwd elsewhere", filepath.Join(src, "project"), filepath.Join(home, "elsewhere", "repo"), nil},
	} {
		if got := trustFor(t, home, tc.open, tc.cwd); !slices.Equal(got, tc.want) {
			t.Errorf("%s: %q, want %q", tc.name, got, tc.want)
		}
	}
	if got := projectTrustArgs(home, "", nil); got != nil {
		t.Errorf("no held directory: %q", got)
	}
}

// --approve outranks Pi's saved decisions, so the person's own saved false
// for the directory or its nearest ancestor leaves the flag out and Pi
// applies it. A closer true, a saved true or a null entry do not.
func TestProjectTrustHonoursSavedDistrust(t *testing.T) {
	home := trustHome(t)
	ws := filepath.Join(home, "src", "project")
	wt := filepath.Join(home, "src", "project__worktrees", "feature")
	for _, tc := range []struct {
		name, store string
		approve     bool
	}{
		{"no store", "", true},
		{"saved false here", `{"` + ws + `": false}`, false},
		{"saved false on src", `{"` + home + `/src": false}`, false},
		{"closer true wins", `{"` + home + `/src": false, "` + ws + `": true}`, true},
		{"closer false wins", `{"` + home + `/src": true, "` + ws + `": false}`, false},
		{"null is no decision", `{"` + ws + `": null, "` + home + `/src": true}`, true},
		{"saved true", `{"` + home + `": true}`, true},
		{"other directory", `{"` + wt + `": false}`, true},
		{"byte order mark", "\ufeff" + `{"` + ws + `": false}`, false},
		// A store that cannot be judged here, such as one Pi is rewriting,
		// is left to Pi's own locked read.
		{"malformed", `{"` + ws + `": "no"}`, false},
		{"not an object", `[]`, false},
		{"partial write", ``, false},
		{"null", `null`, false},
		{"oversized", `{"` + ws + `": false, "x": "` + strings.Repeat("x", maxTrustStore) + `"}`, false},
	} {
		if tc.name == "no store" {
			_ = os.Remove(filepath.Join(home, ".pi", "agent", "trust.json"))
		} else {
			writeTrustStore(t, home, tc.store)
		}
		if got := trustFor(t, home, ws, ws) != nil; got != tc.approve {
			t.Errorf("%s: approve=%v, want %v", tc.name, got, tc.approve)
		}
	}
}

// The pinned Pi itself: a skill committed in a workspace's .agents/skills
// reaches the list-only helper's get_commands below ~/src, but not in a
// directory outside it, nor where the person saved "do not trust". Nothing
// is written to Pi's trust store.
func TestListOnlyPinnedPiLoadsTrustedWorkspaceSkills(t *testing.T) {
	cli, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(cli); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	node, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node not installed")
	}
	home := trustHome(t)
	for _, d := range []string{filepath.Join(home, "src", "project"), filepath.Join(home, "elsewhere", "repo")} {
		skill := filepath.Join(d, ".agents", "skills", "repo-skill")
		if err := os.MkdirAll(skill, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(skill, "SKILL.md"), []byte("---\nname: repo-skill\ndescription: A synthetic skill committed in the repository.\n---\n\nDo nothing.\n"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	list := func(dir string) bool {
		t.Helper()
		f, err := os.Open(dir)
		if err != nil {
			t.Fatal(err)
		}
		defer f.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		commands, ok := listOnlyPi(ctx, node, []string{cli}, home, f, []string{"PATH=/usr/bin:/bin"})
		if !ok {
			t.Fatalf("the pinned Pi did not answer get_commands in %s", dir)
		}
		for _, c := range commands {
			if c.Name == "skill:repo-skill" && c.Source == "skill" && c.Scope == "project" {
				return true
			}
		}
		return false
	}
	if !list(filepath.Join(home, "src", "project")) {
		t.Fatal("the workspace's own skill is missing below ~/src")
	}
	if list(filepath.Join(home, "elsewhere", "repo")) {
		t.Fatal("a directory outside ~/src was trusted")
	}
	if _, err := os.Stat(filepath.Join(home, ".pi", "agent", "trust.json")); !os.IsNotExist(err) {
		t.Fatalf("Pi's trust store was written: %v", err)
	}
	writeTrustStore(t, home, `{"`+filepath.Join(home, "src", "project")+`": false}`)
	if list(filepath.Join(home, "src", "project")) {
		t.Fatal("the person's saved distrust was overridden")
	}
}
