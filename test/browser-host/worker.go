package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// writeFakeClaudeWorker turns the fixture's spinoff into a Claude Code
// worker in its own worktree, with Taskfleet's brief, and (history=ready)
// the session Claude Code files under ~/.claude/projects for that worktree.
func writeFakeClaudeWorker(home, workspace, history string, landed bool) error {
	root := filepath.Join(home, ".taskfleet")
	worktree := filepath.Join(home, "src", workspace+"__worktrees", "wt-ui-test-ok")
	b, err := os.ReadFile(filepath.Join(root, "fixture-show.json"))
	if err != nil {
		return err
	}
	var reply struct {
		Data map[string]any `json:"data"`
	}
	if err := json.Unmarshal(b, &reply); err != nil {
		return err
	}
	run := reply.Data
	run["harness"] = "claude"
	run["landed"] = landed
	run["worktree_path"] = worktree
	run["manifest"] = map[string]any{"selection": map[string]any{"profile": "prototype-opus"}}
	// A recorded window this host has no Taskfleet tmux server for: the
	// terminal route refuses it, as it does for a window that has closed.
	run["attach"] = map[string]any{"state": "recorded", "identity": map[string]any{"socket": "/run/user/1001/taskfleet/tmux-0123456789abcdef0123.sock", "window_id": "@1", "pane_id": "%1"}}
	run["node_transcripts"] = []any{map[string]any{"node_id": "n-0001", "harness": "claude", "session_id": nil, "attempt": nil, "worktree_path": worktree, "support": "unsupported",
		"live": map[string]any{"anchor": "state-root", "path": nil, "availability": "unsupported"}, "original": map[string]any{"anchor": "run-root", "path": nil, "availability": "unsupported"}}}
	for name, value := range map[string]any{
		"fixture-list.json":                             map[string]any{"schema_version": 1, "data": map[string]any{"runs": []any{run}}},
		"fixture-show.json":                             map[string]any{"schema_version": 1, "data": run},
		"runs/" + fakeTaskfleetRunID + "/manifest.json": run,
		"runs/" + fakeTaskfleetRunID + "/prompt.md":     "Lisää kellonäkymälle testit kesäajan vaihtumiselle. Kun testit menevät läpi, mergeä.",
	} {
		var b []byte
		if text, ok := value.(string); ok {
			b = []byte(text)
		} else if b, err = json.Marshal(value); err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(root, name), b, 0600); err != nil {
			return err
		}
	}
	name := []byte(worktree)
	for i, c := range name {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9') {
			name[i] = '-'
		}
	}
	project := filepath.Join(home, ".claude", "projects", string(name))
	session := filepath.Join(project, "61098600-bbc7-47b7-ace1-2ac8b043946e.jsonl")
	if history != "ready" {
		return os.RemoveAll(filepath.Join(home, ".claude"))
	}
	if err := os.MkdirAll(project, 0700); err != nil {
		return err
	}
	lines := []map[string]any{
		{"type": "user", "message": map[string]any{"role": "user", "content": "Lisää kellonäkymälle testit kesäajan vaihtumiselle. Kun testit menevät läpi, mergeä."}},
		{"type": "assistant", "message": map[string]any{"id": "msg_ui_1", "role": "assistant", "content": []any{map[string]any{"type": "text", "text": "Luen ensin nykyiset testit ja kellon muotoilun."}}}},
		{"type": "assistant", "message": map[string]any{"id": "msg_ui_1", "role": "assistant", "content": []any{map[string]any{"type": "tool_use", "id": "toolu_ui_1", "name": "Bash", "input": map[string]any{"command": "npm test -- clock"}}}}},
		{"type": "user", "message": map[string]any{"role": "user", "content": []any{map[string]any{"type": "tool_result", "tool_use_id": "toolu_ui_1", "content": "Tests  12 passed (12)", "is_error": false}}}},
		{"type": "assistant", "message": map[string]any{"role": "assistant", "content": []any{map[string]any{"type": "text", "text": "Kesäajan vaihde puuttuu testeistä. Lisään kolme tapausta."}}}},
	}
	var out strings.Builder
	for i, l := range lines {
		l["uuid"] = "aaaaaaaa-0000-4000-8000-00000000000" + string(rune('1'+i))
		l["sessionId"] = "61098600-bbc7-47b7-ace1-2ac8b043946e"
		l["cwd"] = worktree
		l["timestamp"] = "2026-10-26T10:00:0" + string(rune('1'+i)) + "Z"
		b, _ := json.Marshal(l)
		out.Write(b)
		out.WriteByte('\n')
	}
	return os.WriteFile(session, []byte(out.String()), 0600)
}
