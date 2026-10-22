//go:build linux

package daemon

import (
	"encoding/json"
	"strings"
	"testing"
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
