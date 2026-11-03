//go:build linux

package daemon

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"

	"go.yaml.in/yaml/v3"
)

func TestRecordedSkillProjection(t *testing.T) {
	instruction := "# Review\n\nReview the interface.\n\n" + strings.Repeat("Long instruction. Ä\n", 5000) + "\nSee /synthetic/skills/review/notes.md."
	text := "<skill name=\"review\" location=\"/synthetic/skills/review/SKILL.md\">\nReferences are relative to /synthetic/skills/review.\n\n" + instruction + "\n</skill>\n\nMy extra text"
	for _, content := range []any{text, []any{map[string]any{"type": "text", "text": text}, map[string]any{"type": "image", "mimeType": "image/png", "data": "QUJD"}}} {
		message, _ := json.Marshal(map[string]any{"role": "user", "content": content})
		e := nativeEntry{ID: "skill_1", Type: "message", Message: message}
		out := nativeBlocks(e)
		if out.Skill == nil || out.Skill.Name != "review" || out.full != "My extra text" || !out.Blocks[0].Readable {
			t.Fatalf("incorrect skill projection: %+v", out)
		}
		wire, _ := json.Marshal(out)
		if strings.Contains(string(wire), "/synthetic/") || strings.Contains(string(wire), "<skill") {
			t.Fatal("source metadata escaped projection")
		}
		raw, _ := json.Marshal(map[string]any{"type": "message", "message": json.RawMessage(message)})
		all := ""
		offset := 0
		for {
			chunk, ok := nativeBlockChunk(raw, 0, offset, 1024)
			if !ok {
				t.Fatal("chunk unavailable")
			}
			all += chunk["text"].(string)
			if chunk["complete"] == true {
				break
			}
			offset = chunk["next_offset"].(int)
		}
		expected := strings.ReplaceAll(instruction, "/synthetic/skills/review", "[skill directory]")
		if all != expected {
			t.Fatal("chunk projection lost or duplicated instruction")
		}
		if strings.Contains(all, "My extra text") {
			t.Fatal("arguments mixed into instruction")
		}
	}
}

func TestSkillRecognitionBoundaries(t *testing.T) {
	for _, text := range []string{
		"Mention <skill name=\"review\" location=\"/example\">\nbody\n</skill>",
		"<skill name=\"review\" location=\"/example\">\nunfinished",
	} {
		if _, ok := projectSkill(text); ok {
			t.Fatalf("recognized ordinary text: %q", text)
		}
	}
	text := "<skill name=\"review\" location=\"/example/SKILL.md\">\n# Guide\n</skill>"
	msg, _ := json.Marshal(map[string]any{"role": "assistant", "content": text})
	if nativeBlocks(nativeEntry{Type: "message", Message: msg}).Skill != nil {
		t.Fatal("assistant text became an invocation")
	}
	if s, ok := projectSkill(text); !ok || s.arguments != "" || s.instruction != "# Guide" {
		t.Fatal("skill-only projection failed")
	}
}

func TestNonleadingSkillWrapperRemainsOrdinaryText(t *testing.T) {
	text := "<skill name=\"review\" location=\"/example/SKILL.md\">\nRecorded body\n</skill>\n\nOwn text"
	msg, _ := json.Marshal(map[string]any{"role": "user", "content": []any{map[string]any{"type": "text", "text": "An ordinary message mentioning a wrapper:"}, map[string]any{"type": "text", "text": text}}})
	out := nativeBlocks(nativeEntry{Type: "message", Message: msg})
	if out.Skill != nil || out.Blocks[1].Text != text {
		t.Fatal("nonleading text was reinterpreted")
	}
	raw, _ := json.Marshal(map[string]any{"type": "message", "message": json.RawMessage(msg)})
	chunk, ok := nativeBlockChunk(raw, 1, 0, 65536)
	if !ok || chunk["text"] != text {
		t.Fatal("block read reinterpreted nonleading text")
	}
}

func TestPiWarningNamesStillProjectWithoutPaths(t *testing.T) {
	for _, name := range []string{"Review.v2", "my skill", "name\rwith\nlinebreaks", strings.Repeat("long-", 300)} {
		text := "<skill name=\"" + name + "\" location=\"/example/private/SKILL.md\">\nRecorded body\n</skill>"
		msg, _ := json.Marshal(map[string]any{"role": "user", "content": text})
		out := nativeBlocks(nativeEntry{Type: "message", Message: msg})
		if out.Skill == nil || len(out.Skill.Name) > 1000 {
			t.Fatal("Pi's warning name failed projection")
		}
		inline(nil, &out)
		wire, _ := json.Marshal(nativeEntryPayload(out))
		if strings.Contains(string(wire), "/example/private") || strings.Contains(string(wire), "<skill") {
			t.Fatal("source metadata escaped projection")
		}
	}
}

func TestSkillArgumentsRemainReadableBeyondPreview(t *testing.T) {
	arguments := strings.Repeat("ä review diff\n", 12000) + "ARGUMENT END"
	text := "<skill name=\"review\" location=\"/example/private/SKILL.md\">\nRecorded body\n</skill>\n\n" + arguments
	msg, _ := json.Marshal(map[string]any{"role": "user", "content": text})
	raw, _ := json.Marshal(map[string]any{"type": "message", "message": json.RawMessage(msg)})
	out := nativeBlocks(nativeEntry{Type: "message", Message: msg})
	inline(nil, &out)
	if out.Content.Complete || !out.Content.Truncated {
		t.Fatal("argument preview claimed complete")
	}
	var all string
	offset := 0
	for {
		chunk, ok := nativeSkillArgumentsChunk(raw, 0, offset, 65536)
		if !ok {
			t.Fatal("arguments unavailable")
		}
		all += chunk["text"].(string)
		if chunk["complete"] == true {
			break
		}
		offset = chunk["next_offset"].(int)
	}
	if all != arguments {
		t.Fatal("argument pagination lost content")
	}
	if _, ok := nativeSkillArgumentsChunk(raw, 1, 0, 1024); ok {
		t.Fatal("wrong native index accepted")
	}
}

// The workspace button sends this argument-free command. Exercise Pi's real
// expander against the installed skill, rather than teaching a fake the answer.
func TestStartPageButtonNativeExpansion(t *testing.T) {
	sdk, err := filepath.Abs("pi-device-test/node_modules/@earendil-works/pi-coding-agent")
	if err != nil {
		t.Fatal(err)
	}
	file, err := installStartPageSkill(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	script := `
import {pathToFileURL} from 'node:url';
const [sdk, file] = process.argv.slice(1);
const {AgentSession} = await import(pathToFileURL(sdk+'/dist/core/agent-session.js'));
const name = 'open-habitat-start-page';
const session = {resourceLoader: {getSkills: () => ({skills: [{name, filePath: file, baseDir: file.slice(0,file.lastIndexOf('/'))}]})}};
console.log(JSON.stringify(AgentSession.prototype._expandSkillCommand.call(session, '/skill:open-habitat-start-page ')));
`
	b, err := exec.Command("node", "--input-type=module", "-e", script, sdk, file).Output()
	if err != nil {
		t.Fatal(err)
	}
	var text string
	if err := json.Unmarshal(b, &text); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(text, `<skill name="open-habitat-start-page"`) || !strings.Contains(text, "</skill>") {
		t.Fatalf("not expanded as a skill: %q", text)
	}
	msg, _ := json.Marshal(map[string]any{"role": "user", "content": text})
	out := nativeBlocks(nativeEntry{Type: "message", Message: msg})
	if out.Skill == nil || out.Skill.Name != "open-habitat-start-page" || out.full != "" {
		t.Fatalf("incorrect native skill: %+v", out)
	}
}

// These are excerpts of installed worktree/issue and the shipped start-page
// skill. Pi's actual expansion, not a guessed wrapper, supplies the regression.
func TestSkillMetadataFromNativeExpansion(t *testing.T) {
	sdk, err := filepath.Abs("pi-device-test/node_modules/@earendil-works/pi-coding-agent")
	if err != nil {
		t.Fatal(err)
	}
	script := `
import {pathToFileURL} from 'node:url';
const [sdk, file, name] = process.argv.slice(1);
const {AgentSession} = await import(pathToFileURL(sdk+'/dist/core/agent-session.js'));
const session = {resourceLoader: {getSkills: () => ({skills: [{name, filePath: file, baseDir: file.slice(0,file.lastIndexOf('/'))}]})}};
console.log(JSON.stringify(AgentSession.prototype._expandSkillCommand.call(session, '/skill:'+name+' My extra request')));
`
	for _, name := range []string{"worktree", "issue", "open-habitat-start-page", "no-description"} {
		t.Run(name, func(t *testing.T) {
			source, err := os.ReadFile(filepath.Join("testdata/skill-invocation", name+".md"))
			if err != nil {
				t.Fatal(err)
			}
			file := filepath.Join(t.TempDir(), "SKILL.md")
			if err := os.WriteFile(file, source, 0600); err != nil {
				t.Fatal(err)
			}
			cmd := exec.Command("node", "--input-type=module", "-e", script, sdk, file, name)
			b, err := cmd.Output()
			if err != nil {
				t.Fatal(err)
			}
			var text string
			if err := json.Unmarshal(b, &text); err != nil {
				t.Fatal(err)
			}
			if (name == "worktree" || name == "issue" || name == "no-description") && !strings.Contains(text, "$ARGUMENTS") {
				t.Fatal("native regression marker missing")
			}
			msg, _ := json.Marshal(map[string]any{"role": "user", "content": text})
			out := nativeBlocks(nativeEntry{Type: "message", Message: msg})
			if out.Skill == nil || out.Skill.Name != name || out.full != "My extra request" {
				t.Fatalf("incorrect native skill: %+v", out)
			}
			if out.Skill.Description != "" {
				t.Fatal("native scan read presentation metadata")
			}
			inline(nil, &out)
			if name == "no-description" {
				if out.Skill.Description != "" {
					t.Fatal("body prose used as description")
				}
			} else {
				var meta struct {
					Description string `yaml:"description"`
				}
				front := strings.Split(string(source), "---")[1]
				if err := yaml.Unmarshal([]byte(front), &meta); err != nil {
					t.Fatal(err)
				}
				if out.Skill.Description != strings.Join(strings.Fields(meta.Description), " ") {
					t.Fatalf("frontmatter missing: %+v", out.Skill)
				}
			}
			raw, _ := json.Marshal(map[string]any{"type": "message", "message": json.RawMessage(msg)})
			chunk, ok := nativeBlockChunk(raw, 0, 0, 65536)
			if !ok || strings.Contains(chunk["text"].(string), "$ARGUMENTS") {
				t.Fatal("argument marker leaked to reader")
			}
			if err := os.Remove(file); err != nil {
				t.Fatal(err)
			}
			if skillDescription(file, name) != "" {
				t.Fatal("missing file invented description")
			}
		})
	}
}

func TestSkillMetadataReadBoundaries(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "SKILL.md")
	for _, source := range []string{
		"---\nname: other\ndescription: Wrong skill\n---\nBody",
		"---\nname: review\ndescription: $ARGUMENTS\n---\nBody",
		"---\nname: review\ndescription: {{TEMPLATE}}\n---\nBody",
		"---\nname: review\ndescription: [invalid yaml\n---\nBody",
		strings.Repeat("x", 65537),
		"No frontmatter\n\nArguments: $ARGUMENTS",
	} {
		if err := os.WriteFile(file, []byte(source), 0600); err != nil {
			t.Fatal(err)
		}
		if got := skillDescription(file, "review"); got != "" {
			t.Fatalf("unexpected description: %q", got)
		}
	}
	large := "---\nname: review\ndescription: Real frontmatter\n---\n" + strings.Repeat("Instruction body.\n", 10000)
	if err := os.WriteFile(file, []byte(large), 0600); err != nil {
		t.Fatal(err)
	}
	if got := skillDescription(file, "review"); got != "Real frontmatter" {
		t.Fatalf("large body lost metadata: %q", got)
	}
	if err := os.Remove(file); err != nil {
		t.Fatal(err)
	}
	if err := syscall.Mkfifo(file, 0600); err != nil {
		t.Fatal(err)
	}
	if skillDescription(file, "review") != "" {
		t.Fatal("read special file")
	}
}

func TestSkillMetadataPiFileShapes(t *testing.T) {
	for _, fileName := range []string{"SKILL.md", "review.md"} {
		for _, source := range []string{
			"---\nname: review\ndescription: Actual description\n---\nBody",
			"\uFEFF---\r\nname: review\r\ndescription: Actual description\r\n---\r\nBody",
			"---\rname: review\rdescription: Actual description\r---\rBody",
			"---\nname: review\ndescription: Actual description\n--- \nBody",
			"---\nname: review\ndescription: Actual description\n---",
			"---\nname: review\ndescription: >-\n  Actual\n  description\n---\nBody",
		} {
			file := filepath.Join(t.TempDir(), fileName)
			if err := os.WriteFile(file, []byte(source), 0600); err != nil {
				t.Fatal(err)
			}
			if got := skillDescription(file, "review"); got != "Actual description" {
				t.Fatalf("%s %q: %q", fileName, source, got)
			}
		}
	}
}
