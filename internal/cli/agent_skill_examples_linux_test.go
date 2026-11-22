//go:build linux

package cli

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"
)

// Exercise the shipped recipes, not a second copy of their Python programs.
// The fixtures include unrelated entries and missing/null text chunks.
func TestAgentSkillJSONRecipes(t *testing.T) {
	var skill, stderr bytes.Buffer
	if code := Run([]string{"skill", "print", "agent"}, &skill, &stderr); code != 0 {
		t.Fatal(stderr.String())
	}
	programs := regexp.MustCompile(`python3 -c '([^']+)'`).FindAllStringSubmatch(skill.String(), -1)
	if len(programs) != 3 {
		t.Fatalf("expected conversation, history and block recipes, got %d", len(programs))
	}
	for _, match := range programs {
		program := match[1]
		dir := t.TempDir()
		stdin := `{"data":{"result":{"sessions":[{"title":"Other"},{"title":"Planning","id":"pi:example"},{}]}}}`
		want := "{\"title\": \"Planning\", \"id\": \"pi:example\"}\n"
		switch {
		case strings.Contains(program, "history.jsonl"):
			input := "{\"entries\":[{\"kind\":\"assistant\"},{\"kind\":\"user\",\"text\":\"first\"}]}\n{\"entries\":[{\"kind\":\"user\",\"text\":\"second\"}]}\n"
			if err := os.WriteFile(filepath.Join(dir, "history.jsonl"), []byte(input), 0600); err != nil {
				t.Fatal(err)
			}
			want = "{\"kind\": \"user\", \"text\": \"first\"}\n{\"kind\": \"user\", \"text\": \"second\"}\n"
		case strings.Contains(program, "block.jsonl"):
			input := "{\"chunk\":{\"text\":\"first\\n\"}}\n{\"chunk\":{\"data\":\"base64\"}}\n{\"chunk\":{\"text\":null}}\n{\"chunk\":{\"text\":\"second\"}}\n"
			if err := os.WriteFile(filepath.Join(dir, "block.jsonl"), []byte(input), 0600); err != nil {
				t.Fatal(err)
			}
			want = "first\nsecond"
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		cmd := exec.CommandContext(ctx, "python3", "-c", program)
		cmd.Dir, cmd.Stdin = dir, strings.NewReader(stdin)
		out, err := cmd.CombinedOutput()
		cancel()
		if err != nil || string(out) != want {
			t.Fatalf("recipe %s: %v\ngot %q\nwant %q", program, err, out, want)
		}
	}
}
