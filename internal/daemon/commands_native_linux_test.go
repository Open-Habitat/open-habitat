//go:build linux

package daemon

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// The list-only helper against the pinned Pi itself: `--mode rpc
// --no-session` answers get_commands with the person's skills and writes no
// session. No credentials and no model are involved.
func TestListOnlyPinnedPiAnswersCommandsWithoutSession(t *testing.T) {
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
	home := t.TempDir()
	skill := filepath.Join(home, ".pi", "agent", "skills", "demo-skill")
	if err := os.MkdirAll(skill, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skill, "SKILL.md"), []byte("---\nname: demo-skill\ndescription: A synthetic skill for the list-only helper.\n---\n\nDo nothing.\n"), 0600); err != nil {
		t.Fatal(err)
	}
	ws := filepath.Join(home, "src", "project")
	if err := os.MkdirAll(ws, 0700); err != nil {
		t.Fatal(err)
	}
	dir, err := os.Open(ws)
	if err != nil {
		t.Fatal(err)
	}
	defer dir.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	started := time.Now()
	commands, ok := listOnlyPi(ctx, node, []string{cli}, home, dir, []string{"PATH=/usr/bin:/bin"})
	t.Logf("native command helper startup + RPC + teardown: %s", time.Since(started))
	if !ok {
		t.Fatal("the pinned Pi did not answer get_commands")
	}
	found := false
	for _, c := range commands {
		if c.Name == "skill:demo-skill" && c.Source == "skill" && c.Scope == "user" {
			found = true
		}
	}
	if !found {
		t.Fatalf("skill missing from %+v", commands)
	}
	if sessions, _ := filepath.Glob(filepath.Join(home, ".pi", "agent", "sessions", "*", "*.jsonl")); len(sessions) != 0 {
		t.Fatalf("the list-only Pi wrote a session: %v", sessions)
	}
}
