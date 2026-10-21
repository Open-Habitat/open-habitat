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
	for _, scope := range []string{"project", "temporary", "user"} {
		effective := []piCommand{{Name: "skill:tests", Source: "skill", Scope: scope, Path: path}}
		c.describeSkills(context.Background(), h.workspace, effective)
		got := effective[0].Discovery
		if got == nil || !got.Repository || got.Start == nil || *got.Start != 2 || got.Added == nil || got.Added.Commit != added {
			t.Fatalf("effective repository path misclassified for scope %s: %+v", scope, got)
		}
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

// Exercise the pinned SDK's actual loader and sourceInfo paths. A filesystem
// census or a user-first precedence guess would fail this trust/collision case.
func TestSkillDiscoveryNativeEffectivePaths(t *testing.T) {
	sdk, err := filepath.Abs("pi-device-test/node_modules/@earendil-works/pi-coding-agent")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(sdk, "dist/core/resource-loader.js")); err != nil {
		t.Fatal("install pinned Pi SDK fixture: ", err)
	}
	home := t.TempDir()
	repo := filepath.Join(home, "repo")
	for _, dir := range []string{filepath.Join(repo, ".pi/skills/shared"), filepath.Join(home, ".pi/agent/skills/shared")} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte("---\nname: shared\ndescription: Synthetic shared skill\n---\nInstructions"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	os.Mkdir(filepath.Join(repo, ".git"), 0700)
	script := `
import {pathToFileURL} from 'node:url';
const [sdk,cwd,agentDir]=process.argv.slice(1);
const {DefaultResourceLoader}=await import(pathToFileURL(sdk+'/dist/core/resource-loader.js'));
const {SettingsManager}=await import(pathToFileURL(sdk+'/dist/core/settings-manager.js'));
const settingsManager=SettingsManager.create(cwd,agentDir);
settingsManager.setProjectTrusted(true);
const loader=new DefaultResourceLoader({cwd,agentDir,settingsManager,noExtensions:true,noThemes:true,noPromptTemplates:true});
const view=()=>({commands:loader.getSkills().skills.map(s=>({name:'skill:'+s.name,description:s.description,source:'skill',sourceInfo:s.sourceInfo}))});
await loader.reload(); console.log(JSON.stringify(view()));
settingsManager.setProjectTrusted(false); await loader.reload(); console.log(JSON.stringify(view()));
`
	cmd := exec.Command("node", "--input-type=module", "-e", script, sdk, repo, filepath.Join(home, ".pi/agent"))
	cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home}
	b, err := cmd.Output()
	if err != nil {
		t.Fatalf("pinned loader: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(b)), "\n")
	if len(lines) != 2 {
		t.Fatalf("loader output: %s", b)
	}
	trusted, ok := parsePiCommands(json.RawMessage(lines[0]))
	if !ok || len(trusted) != 1 || trusted[0].Path != filepath.Join(repo, ".pi/skills/shared/SKILL.md") {
		t.Fatalf("trusted effective set: %+v", trusted)
	}
	untrusted, ok := parsePiCommands(json.RawMessage(lines[1]))
	if !ok || len(untrusted) != 1 || untrusted[0].Path != filepath.Join(home, ".pi/agent/skills/shared/SKILL.md") {
		t.Fatalf("untrusted effective set: %+v", untrusted)
	}
}
