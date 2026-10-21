//go:build linux

package daemon

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

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
	shipped, err := installStartPageSkill(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	script := `
import {pathToFileURL} from 'node:url';
const [sdk,cwd,agentDir,shipped]=process.argv.slice(1);
const {DefaultResourceLoader}=await import(pathToFileURL(sdk+'/dist/core/resource-loader.js'));
const {SettingsManager}=await import(pathToFileURL(sdk+'/dist/core/settings-manager.js'));
const settingsManager=SettingsManager.create(cwd,agentDir);
settingsManager.setProjectTrusted(true);
const loader=new DefaultResourceLoader({cwd,agentDir,settingsManager,noExtensions:true,noThemes:true,noPromptTemplates:true});
const view=()=>({commands:loader.getSkills().skills.map(s=>({name:'skill:'+s.name,description:s.description,source:'skill',sourceInfo:s.sourceInfo}))});
await loader.reload(); console.log(JSON.stringify(view()));
settingsManager.setProjectTrusted(false); await loader.reload(); console.log(JSON.stringify(view()));
const hostLoader=new DefaultResourceLoader({cwd,agentDir,settingsManager,noExtensions:true,noThemes:true,noPromptTemplates:true,additionalSkillPaths:[shipped]});
await hostLoader.reload(); console.log(JSON.stringify({names:hostLoader.getSkills().skills.map(s=>s.name)}));
`
	cmd := exec.Command("node", "--input-type=module", "-e", script, sdk, repo, filepath.Join(home, ".pi/agent"), shipped)
	cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home}
	b, err := cmd.Output()
	if err != nil {
		t.Fatalf("pinned loader: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(b)), "\n")
	if len(lines) != 3 {
		t.Fatalf("loader output: %s", b)
	}
	trusted, ok := parsePiCommands(json.RawMessage(lines[0]))
	if !ok || len(trusted) != 1 || trusted[0].Path != filepath.Join(repo, ".pi/skills/shared/SKILL.md") {
		t.Fatalf("trusted effective set: %+v", trusted)
	}
	var shippedNames struct {
		Names []string `json:"names"`
	}
	if json.Unmarshal([]byte(lines[2]), &shippedNames) != nil || !strings.Contains(strings.Join(shippedNames.Names, ","), "open-habitat-start-page") {
		t.Fatalf("host skill missing from native loader: %s", lines[2])
	}
	untrusted, ok := parsePiCommands(json.RawMessage(lines[1]))
	if !ok || len(untrusted) != 1 || untrusted[0].Path != filepath.Join(home, ".pi/agent/skills/shared/SKILL.md") {
		t.Fatalf("untrusted effective set: %+v", untrusted)
	}
}
