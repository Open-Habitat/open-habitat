//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// contextSession writes a synthetic Pi 1.3 session: a system message, then
// turns of user → assistant (tool call) → tool result → assistant, with
// optional entries after the turns.
type contextSession struct {
	lines  []string
	parent string
	n      int
	system map[string]any
}

// compact appends Pi's compaction entry, which checkpoints the prompt state.
func (s *contextSession) compact(fields map[string]any) {
	fields["systemMessage"] = s.system
	s.add("compaction", fields)
}

func (s *contextSession) add(kind string, fields map[string]any) string {
	s.n++
	id := fmt.Sprintf("e%07d", s.n)
	fields["type"], fields["id"], fields["timestamp"] = kind, id, fmt.Sprintf("2026-10-27T10:%02d:00.000Z", s.n%60)
	if s.parent != "" {
		fields["parentId"] = s.parent
	}
	b, _ := json.Marshal(fields)
	s.lines = append(s.lines, string(b))
	s.parent = id
	return id
}

func (s *contextSession) message(m map[string]any) string {
	return s.add("message", map[string]any{"message": m})
}

func (s *contextSession) turn(provider, ask string, output int, usage int, image bool) (userID string) {
	content := []any{map[string]any{"type": "text", "text": ask}}
	if image {
		content = append(content, map[string]any{"type": "image", "data": "aGVsbG8=", "mimeType": "image/png"})
	}
	userID = s.message(map[string]any{"role": "user", "content": content, "timestamp": 1})
	call := fmt.Sprintf("call_%d", s.n)
	reply := func(content []any) {
		s.message(map[string]any{"role": "assistant", "content": content, "api": "test", "provider": provider, "model": "m",
			"usage":      map[string]any{"input": 10, "output": 20, "cacheRead": usage - 30, "cacheWrite": 0, "totalTokens": usage, "cost": map[string]any{"total": 0.5}},
			"stopReason": "stop", "timestamp": 1})
	}
	reply([]any{map[string]any{"type": "toolCall", "id": call, "name": "bash", "arguments": map[string]any{"command": "cat " + ask}}})
	s.message(map[string]any{"role": "toolResult", "toolCallId": call, "toolName": "bash", "content": []any{map[string]any{"type": "text", "text": strings.Repeat("x", output)}}, "isError": false, "timestamp": 1})
	reply([]any{map[string]any{"type": "text", "text": "done " + ask}})
	return userID
}

func writeContextSession(t *testing.T, home, id, provider string, build func(*contextSession)) {
	t.Helper()
	s := &contextSession{}
	header, _ := json.Marshal(map[string]any{"type": "session", "version": 3, "id": id, "timestamp": "2026-10-27T10:00:00.000Z", "cwd": "/work"})
	s.lines = append(s.lines, string(header))
	s.add("model_change", map[string]any{"provider": provider, "modelId": "m"})
	s.system = map[string]any{"role": "system", "content": "", "timestamp": 1,
		"sections":   map[string]any{"preamble": strings.Repeat("p", 400), "rules": strings.Repeat("r", 400), "project_context": strings.Repeat("c", 4000), "cwd": "/work"},
		"toolsAdded": []any{map[string]any{"name": "bash", "description": strings.Repeat("d", 200), "parameters": map[string]any{"type": "object"}}}}
	s.message(s.system)
	build(s)
	dir := filepath.Join(home, ".pi", "agent", "sessions", "--work--")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "2026-10-27T10-00-00-000Z_"+id+".jsonl"), []byte(strings.Join(s.lines, "\n")+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
}

func readContextDetail(t *testing.T, h http.Handler, id string) (int, contextDetail) {
	t.Helper()
	req := httptest.NewRequest("GET", "http://unix/api/v1/agents/"+id+"/context", nil)
	mux := http.NewServeMux()
	mux.Handle(ContextDetailPattern, h)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	var d contextDetail
	if w.Code == 200 {
		if err := json.Unmarshal(w.Body.Bytes(), &d); err != nil {
			t.Fatal(err)
		}
	}
	return w.Code, d
}

func TestContextDetailIsPisOwnReading(t *testing.T) {
	p, home := piFixture(t)
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	trusted := func(*http.Request) bool { return true }
	h := ContextDetailHandler(cfg, trusted, p)

	const gpt = "11111111-1111-4111-8111-111111111111"
	writeContextSession(t, home, gpt, "openai-codex", func(s *contextSession) {
		s.turn("openai-codex", "first", 40000, 30000, false)
		kept := s.turn("openai-codex", "second", 4000, 41000, true)
		s.compact(map[string]any{"summary": "## Goal\nsynthetic summary", "firstKeptEntryId": kept, "tokensBefore": 41000,
			"details": map[string]any{"readFiles": []string{"/work/a.go"}, "modifiedFiles": []string{"/work/b.go"}}})
		s.turn("openai-codex", "third", 800, 12345, false)
	})
	code, d := readContextDetail(t, h, "pi:"+gpt)
	if code != 200 {
		t.Fatalf("status %d", code)
	}
	if d.AgentID != "pi:"+gpt || d.Harness != "pi" || d.MeasuredTokens == nil || *d.MeasuredTokens != 12345 {
		t.Fatalf("measured total is Pi's last usage after the compaction: %+v", d)
	}
	if len(d.Compactions) != 1 || d.Compactions[0].KeptFromTurn != 2 || d.Compactions[0].TokensBefore != 41000 || d.Compactions[0].ModifiedFiles[0] != "/work/b.go" || !strings.Contains(d.Compactions[0].Summary, "synthetic summary") {
		t.Fatalf("compaction entry: %+v", d.Compactions)
	}
	// What the model sees: the summarized first turn's 10k-token output is gone.
	for _, o := range d.LargestOutputs {
		if o.Turn < 2 {
			t.Fatalf("summarized output counted in the current context: %+v", d.LargestOutputs)
		}
	}
	if d.Parts.ToolOutput >= 10000 || d.Parts.Summary == 0 || d.Parts.Attachments == 0 {
		t.Fatalf("composition: %+v", d.Parts)
	}
	if len(d.Turns) != 3 || d.Turns[0].Replies != 2 || d.Turns[0].ContextTokens == nil || *d.Turns[0].ContextTokens != 30000 || d.Turns[2].Cost != 1 {
		t.Fatalf("turns: %+v", d.Turns)
	}
	if d.Settings == nil || d.Settings.KeepRecentTokens != 20000 {
		t.Fatalf("Pi's default keep: %+v", d.Settings)
	}

	// The person's own setting drives Pi's cut: keep almost nothing, and
	// everything since the kept boundary would be summarized.
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "settings.json"), []byte(`{"compaction":{"keepRecentTokens":1}}`), 0600); err != nil {
		t.Fatal(err)
	}
	_, d = readContextDetail(t, h, "pi:"+gpt)
	if d.NextCompaction == nil || d.NextCompaction.FromTurn != 2 || d.NextCompaction.KeptFromTurn != 3 || d.NextCompaction.SummarizedTokens == 0 {
		t.Fatalf("next compaction: %+v", d.NextCompaction)
	}

	// Through the Claude bridge, Claude Code's preset replaces Pi's base
	// prompt; only the portable sections count. Right after a compaction
	// nothing is measured.
	const claude = "22222222-2222-4222-8222-222222222222"
	writeContextSession(t, home, claude, "claude-bridge", func(s *contextSession) {
		kept := s.turn("claude-bridge", "only", 400, 9000, false)
		s.compact(map[string]any{"summary": "s", "firstKeptEntryId": kept, "tokensBefore": 9000})
	})
	code, d = readContextDetail(t, h, "pi:"+claude)
	if code != 200 || d.Harness != "claude_code" || d.MeasuredTokens != nil || d.EstimatedTokens == 0 {
		t.Fatalf("claude after compaction: %d %+v", code, d)
	}
	replaced := map[string]bool{}
	for _, s := range d.Instructions {
		replaced[s.Name] = s.Replaced
	}
	if !replaced["preamble"] || !replaced["rules"] || replaced["project_context"] || d.Parts.Instructions != 1000 {
		t.Fatalf("bridge sections: %+v %d", d.Instructions, d.Parts.Instructions)
	}
}

func TestContextDetailBoundary(t *testing.T) {
	p, home := piFixture(t)
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	const id = "33333333-3333-4333-8333-333333333333"
	writeContextSession(t, home, id, "openai-codex", func(s *contextSession) { s.turn("openai-codex", "one", 10, 100, false) })
	if code, _ := readContextDetail(t, ContextDetailHandler(cfg, func(*http.Request) bool { return false }, p), "pi:"+id); code != 403 {
		t.Fatalf("untrusted peer: %d", code)
	}
	h := ContextDetailHandler(cfg, func(*http.Request) bool { return true }, p)
	if code, _ := readContextDetail(t, h, "pi:44444444-4444-4444-8444-444444444444"); code != 404 {
		t.Fatalf("unknown session: %d", code)
	}
	if code, _ := readContextDetail(t, h, "claude:"+id); code != 400 {
		t.Fatalf("non-Pi id: %d", code)
	}
	req := httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+id+"/context?path=/etc", nil)
	mux := http.NewServeMux()
	mux.Handle(ContextDetailPattern, h)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != 400 {
		t.Fatalf("query accepted: %d", w.Code)
	}
}
