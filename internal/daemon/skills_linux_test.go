//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestSkillDiscoveryIsEffectiveHomeBoundAndUsesAddingCommit(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	repo := filepath.Join(h.root, "src", "project")
	path := filepath.Join(repo, ".pi", "skills", "tests", "SKILL.md")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	original := "---\nname: tests\ndescription: Find failures\nmetadata:\n  open-habitat-title: Fix tests\n  open-habitat-start: 2\n  open-habitat-example: |\n    Measure the failing case.\n    Keep the draft editable.\n---\nInstructions\n"
	if err := os.WriteFile(path, []byte(original), 0600); err != nil {
		t.Fatal(err)
	}
	git := func(args ...string) string {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-C", repo}, args...)...)
		cmd.Env = append(os.Environ(), "GIT_AUTHOR_NAME=Fixture Author", "GIT_AUTHOR_EMAIL=fixture@example.invalid", "GIT_COMMITTER_NAME=Fixture", "GIT_COMMITTER_EMAIL=fixture@example.invalid", "GIT_AUTHOR_DATE=2025-01-01T12:00:00Z", "GIT_COMMITTER_DATE=2025-01-01T12:00:00Z")
		b, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git: %v %s", err, b)
		}
		return strings.TrimSpace(string(b))
	}
	git("init", "-q")
	git("add", ".pi/skills/tests/SKILL.md")
	git("commit", "-qm", "add skill")
	added := git("rev-parse", "HEAD")
	if err := os.WriteFile(path, []byte(strings.ReplaceAll(original, "Fix tests", "Investigate tests")), 0600); err != nil {
		t.Fatal(err)
	}
	git("add", ".pi/skills/tests/SKILL.md")
	git("commit", "-qm", "presentation only")
	outside := filepath.Join(t.TempDir(), "SKILL.md")
	os.WriteFile(outside, []byte(original), 0600)
	link := filepath.Join(repo, "escape.md")
	os.Symlink(outside, link)
	global := filepath.Join(h.root, "global.md")
	os.WriteFile(global, []byte(original), 0600)
	commands := []piCommand{
		{Name: "skill:tests", Source: "skill", Scope: "project", Path: path},
		{Name: "skill:escape", Source: "skill", Scope: "project", Path: link},
		{Name: "skill:own", Source: "skill", Scope: "user", Path: global},
		{Name: "prompt", Source: "prompt", Scope: "project", Path: path},
	}
	key := c.describeSkills(context.Background(), h.workspace, commands)
	d := commands[0].Discovery
	if key == "" || d == nil || !d.Repository || d.Start == nil || *d.Start != 2 || d.Title != "Investigate tests" || d.Added == nil || d.Added.Commit != added || d.Added.Author != "Fixture Author" || !strings.Contains(d.Example, "\n") {
		t.Fatalf("discovery: %s %+v", key, d)
	}
	if commands[1].Discovery.Title != "" || commands[1].Discovery.Repository || commands[2].Discovery.Start != nil || commands[2].Discovery.Repository || commands[2].Discovery.Title != "Fix tests" || commands[3].Discovery != nil {
		t.Fatalf("source confinement: %+v", commands)
	}
	b, _ := json.Marshal(commandListView("helper", commands))
	if strings.Contains(string(b), h.root) || strings.Contains(string(b), outside) {
		t.Fatalf("native path leaked: %s", b)
	}
	// An unavailable/shallow history remains unknown; a skill still appears.
	os.WriteFile(filepath.Join(repo, ".git", "shallow"), []byte(git("rev-parse", "HEAD")+"\n"), 0600)
	c.describeSkills(context.Background(), h.workspace, commands)
	if commands[0].Discovery.Added != nil || commands[0].Discovery.Start == nil {
		t.Fatal("shallow history guessed provenance or hid a goal")
	}
}

func TestSkillMetadataRejectsNonStringsAndMalformedYAML(t *testing.T) {
	for _, body := range []string{"metadata: [broken", "metadata: {open-habitat-title: 12}", "metadata: {open-habitat-title: [a, b]}"} {
		meta, _ := skillMetadata([]byte("---\n" + body + "\n---\nbody"))
		if got := skillText(meta, "open-habitat-title", 256); got != "" {
			t.Fatalf("non-string: %q", got)
		}
	}
	parsed, ok := parsePiCommands(json.RawMessage(`{"commands":[{"name":"skill:hello","description":"Native","source":"skill","sourceInfo":{"path":"/native/SKILL.md","scope":"project"}}]}`))
	if !ok || len(parsed) != 1 || parsed[0].Path != "/native/SKILL.md" {
		t.Fatalf("native path lost: %+v", parsed)
	}
}
