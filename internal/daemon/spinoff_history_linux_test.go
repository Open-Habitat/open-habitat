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
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

const claudeWorkerSession = "61098600-bbc7-47b7-ace1-2ac8b043946e"

func claudeRecord(t *testing.T, v map[string]any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b) + "\n"
}

// claudeWorkerFile writes a Claude Code session shaped like the 2.x files
// observed on Birch (2026-10-26): one record per assistant content block,
// tool results as user records, sidechain and meta records interleaved.
func claudeWorkerFile(t *testing.T, home, worktree, session, recordSession, cwd string) string {
	t.Helper()
	name, ok := claudeProjectDir(worktree)
	if !ok {
		t.Fatal("project dir")
	}
	dir := filepath.Join(home, ".claude", "projects", name)
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	rec := func(id, kind string, content any, extra map[string]any) string {
		v := map[string]any{"type": kind, "uuid": id, "sessionId": recordSession, "cwd": cwd, "timestamp": "2026-10-26T17:46:55.864Z", "message": map[string]any{"role": kind, "content": content}}
		for k, x := range extra {
			v[k] = x
		}
		return claudeRecord(t, v)
	}
	body := claudeRecord(t, map[string]any{"type": "permission-mode", "permissionMode": "bypassPermissions", "sessionId": recordSession}) +
		rec("aaaaaaaa-0000-4000-8000-000000000001", "user", "Lisää testit kesäajalle.", nil) +
		rec("aaaaaaaa-0000-4000-8000-000000000002", "user", "<local-command-caveat>meta</local-command-caveat>", map[string]any{"isMeta": true}) +
		rec("aaaaaaaa-0000-4000-8000-000000000003", "assistant", []any{map[string]any{"type": "thinking", "thinking": "", "signature": "opaque"}}, map[string]any{"message": map[string]any{"id": "msg_1", "role": "assistant", "content": []any{map[string]any{"type": "thinking", "thinking": "", "signature": "opaque"}}}}) +
		rec("aaaaaaaa-0000-4000-8000-000000000004", "assistant", nil, map[string]any{"message": map[string]any{"id": "msg_1", "role": "assistant", "content": []any{map[string]any{"type": "tool_use", "id": "toolu_1", "name": "Bash", "input": map[string]any{"command": "npm test -- clock"}}}}}) +
		rec("aaaaaaaa-0000-4000-8000-000000000005", "user", []any{map[string]any{"type": "tool_result", "tool_use_id": "toolu_1", "content": "15 passed", "is_error": false}}, nil) +
		rec("aaaaaaaa-0000-4000-8000-000000000006", "assistant", []any{map[string]any{"type": "tool_use", "id": "toolu_2", "name": "Edit", "input": map[string]any{"file_path": "tests/clock.test.ts", "old_string": "a", "new_string": "b"}}}, nil) +
		rec("aaaaaaaa-0000-4000-8000-000000000007", "user", []any{map[string]any{"type": "tool_result", "tool_use_id": "toolu_2", "content": []any{map[string]any{"type": "text", "text": "edited"}}, "is_error": true}}, nil) +
		rec("aaaaaaaa-0000-4000-8000-000000000008", "assistant", []any{map[string]any{"type": "text", "text": "Sub-agent reply"}}, map[string]any{"isSidechain": true}) +
		rec("aaaaaaaa-0000-4000-8000-000000000009", "assistant", []any{map[string]any{"type": "text", "text": "Valmis."}}, nil)
	path := filepath.Join(dir, session+".jsonl")
	if err := os.WriteFile(path, []byte(body), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

func claudeNode(worktree string) spinoffNode {
	return spinoffNode{NodeID: "n-0001", Harness: "claude", Worktree: worktree, Support: "unsupported"}
}

func TestClaudeWorkerConversation(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	worktree := "/invented/src/aurinkokello__worktrees/wt-kello.dst"
	if got := readSpinoffTranscript(cfg, spinoffFixtureID, claudeNode(worktree)); got.Availability != "unavailable" || got.Harness != "claude" {
		t.Fatalf("a worker whose session has not appeared is not unsupported: %+v", got)
	}
	claudeWorkerFile(t, home, worktree, claudeWorkerSession, claudeWorkerSession, worktree+"/web")
	got := readSpinoffTranscript(cfg, spinoffFixtureID, claudeNode(worktree))
	if got.Availability != "available" {
		t.Fatalf("%+v", got)
	}
	kinds := []string{}
	for _, e := range got.Entries {
		kinds = append(kinds, e.Kind)
	}
	// One reply's blocks arrive as separate records of the same message.
	if strings.Join(kinds, ",") != "user,assistant,tool,assistant,tool,assistant" {
		t.Fatalf("sidechain or meta records leaked, or turns lost: %v", kinds)
	}
	if got.Entries[0].Content.Text != "Lisää testit kesäajalle." {
		t.Fatalf("native text changed: %+v", got.Entries[0])
	}
	if th := got.Entries[1].Blocks[0]; th.Type != "thinking" || !th.Redacted {
		t.Fatalf("withheld thinking shown as empty text: %+v", th)
	}
	bash := got.Entries[1].Blocks[1]
	if bash.Type != "toolCall" || bash.ToolName != "bash" || bash.ToolCallID != "toolu_1" || !strings.Contains(bash.Text, `"command":"npm test -- clock"`) {
		t.Fatalf("Bash call not in the conversation's tool form: %+v", bash)
	}
	if r := got.Entries[2]; r.ToolCallID != "toolu_1" || r.IsError == nil || *r.IsError || r.Blocks[0].Text != "15 passed" {
		t.Fatalf("tool result not placed under its call: %+v", r)
	}
	var edit map[string]string
	if err := json.Unmarshal([]byte(got.Entries[3].Blocks[0].Text), &edit); err != nil || got.Entries[3].Blocks[0].ToolName != "edit" || edit["path"] != "tests/clock.test.ts" || edit["oldText"] != "a" || edit["newText"] != "b" {
		t.Fatalf("Edit arguments not mapped: %v %+v", err, got.Entries[3].Blocks[0])
	}
	if r := got.Entries[4]; r.IsError == nil || !*r.IsError || r.Blocks[0].Text != "edited" {
		t.Fatalf("failed result lost: %+v", r)
	}
}

func TestClaudeWorkerConfinement(t *testing.T) {
	worktree := "/invented/src/project__worktrees/wt-one"
	for _, mode := range []string{"other-session", "outside-worktree", "symlinked-file", "symlinked-dir", "foreign-owner", "sibling-worktree"} {
		t.Run(mode, func(t *testing.T) {
			home := t.TempDir()
			cfg := transport.Config{Home: home, UID: os.Getuid()}
			recordSession, cwd, at := claudeWorkerSession, worktree, worktree
			switch mode {
			case "other-session":
				recordSession = "11111111-1111-4111-8111-111111111111"
			case "outside-worktree":
				cwd = worktree + "-other"
			case "sibling-worktree":
				at = worktree + "-two"
			}
			path := claudeWorkerFile(t, home, at, claudeWorkerSession, recordSession, cwd)
			switch mode {
			case "symlinked-file":
				outside := filepath.Join(home, "outside.jsonl")
				_ = os.Rename(path, outside)
				_ = os.Symlink(outside, path)
			case "symlinked-dir":
				dir := filepath.Dir(path)
				_ = os.Rename(dir, dir+"-moved")
				_ = os.Symlink(dir+"-moved", dir)
			case "foreign-owner":
				cfg.UID = os.Getuid() + 1
			}
			if got := readSpinoffTranscript(cfg, spinoffFixtureID, claudeNode(worktree)); got.Availability != "unavailable" || len(got.Entries) != 0 {
				t.Fatalf("%s accepted: %+v", mode, got)
			}
		})
	}
}

// A restarted Claude worker leaves its earlier session beside the current
// one; the most recently written valid session is the conversation.
func TestClaudeWorkerNewestSession(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	worktree := "/invented/src/project__worktrees/wt-one"
	older := claudeWorkerFile(t, home, worktree, "22222222-2222-4222-8222-222222222222", "22222222-2222-4222-8222-222222222222", worktree)
	b, _ := os.ReadFile(older)
	_ = os.WriteFile(older, []byte(strings.ReplaceAll(string(b), "Valmis.", "Vanha istunto.")), 0600)
	past := time.Now().Add(-time.Hour)
	_ = os.Chtimes(older, past, past)
	claudeWorkerFile(t, home, worktree, claudeWorkerSession, claudeWorkerSession, worktree)
	got := readSpinoffTranscript(cfg, spinoffFixtureID, claudeNode(worktree))
	if got.Availability != "available" || got.Entries[len(got.Entries)-1].Blocks[0].Text != "Valmis." {
		t.Fatalf("older session shown: %+v", got.Entries[len(got.Entries)-1])
	}
}

// A long Claude session is read from its end: the newest work is shown and
// the view says the beginning is missing.
func TestClaudeWorkerTailRead(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	worktree := "/invented/src/project__worktrees/wt-one"
	path := claudeWorkerFile(t, home, worktree, claudeWorkerSession, claudeWorkerSession, worktree)
	b, _ := os.ReadFile(path)
	filler := claudeRecord(t, map[string]any{"type": "attachment", "sessionId": claudeWorkerSession, "cwd": worktree, "attachment": strings.Repeat("x", 1<<20)})
	_ = os.WriteFile(path, []byte(strings.Repeat(filler, 9)+string(b)), 0600)
	got := readSpinoffTranscript(cfg, spinoffFixtureID, claudeNode(worktree))
	if got.Availability != "available" || !got.Truncated || got.Entries[len(got.Entries)-1].Blocks[0].Text != "Valmis." {
		t.Fatalf("tail of a long session not shown: %s %v %d", got.Availability, got.Truncated, len(got.Entries))
	}
}

func TestPiWorkerToolArgumentsInline(t *testing.T) {
	cfg, n := spinoffFixture(t)
	p := filepath.Join(cfg.Home, ".taskfleet", "runs", spinoffFixtureID, *n.Original.Path)
	_ = os.MkdirAll(filepath.Dir(p), 0700)
	body := `{"type":"session","version":3,"id":"` + n.SessionID + `","cwd":"` + n.OriginalCwd + `"}
{"id":"msg-1","type":"message","parentId":null,"message":{"role":"user","content":"Aja testit."}}
{"id":"msg-2","type":"message","parentId":"msg-1","message":{"role":"assistant","content":[{"type":"text","text":"Ajan."},{"type":"toolCall","id":"call-1","name":"bash","arguments":{"command":"go test ./..."}}]}}
{"id":"msg-3","type":"message","parentId":"msg-2","message":{"role":"toolResult","toolCallId":"call-1","toolName":"bash","content":[{"type":"text","text":"ok"}],"isError":false}}
`
	if err := os.WriteFile(p, []byte(body), 0600); err != nil {
		t.Fatal(err)
	}
	got := readSpinoffTranscript(cfg, spinoffFixtureID, n)
	if got.Availability != "available" || len(got.Entries) != 3 {
		t.Fatalf("%+v", got)
	}
	call := got.Entries[1].Blocks[1]
	if call.Type != "toolCall" || call.Readable || call.Text != `{"command":"go test ./..."}` {
		t.Fatalf("worker tool call needs its arguments inline: %+v", call)
	}
	if got.Entries[0].Content.Text != "Aja testit." || got.Entries[2].ToolCallID != "call-1" {
		t.Fatalf("%+v", got.Entries)
	}
}

func TestWorkerEntriesKeepTheNewest(t *testing.T) {
	entries := []historyEntry{}
	for i := 0; i < 300; i++ {
		entries = append(entries, historyEntry{Key: string(rune('a' + i%26)), Content: historyContent{Text: "x"}})
	}
	kept, cut := boundWorkerEntries(entries)
	if len(kept) != workerEntryLimit || !cut || &kept[len(kept)-1] != &entries[299] {
		t.Fatal("count bound must keep the newest entries")
	}
	// Escaping, not text length, is what reaches the browser's read cap:
	// json.Marshal writes each '<' as six bytes.
	escaped := []historyEntry{}
	for i := 0; i < 48; i++ {
		escaped = append(escaped, historyEntry{Key: fmt.Sprint(i), Kind: "assistant", Blocks: []historyBlock{{Type: "text", Text: strings.Repeat("<", 16384)}}})
	}
	kept, cut = boundWorkerEntries(escaped)
	wire, _ := json.Marshal(kept)
	if !cut || len(wire) > workerWireBudget+1024 || kept[len(kept)-1].Key != "47" {
		t.Fatalf("wire budget: %d entries, %d bytes, cut %v", len(kept), len(wire), cut)
	}
}

func TestWorkerTerminalPointer(t *testing.T) {
	run := func(status, state, socket, window string) nativeSpinoff {
		var r nativeSpinoff
		r.Status = status
		r.Attach.State = state
		r.Attach.Identity.Socket = socket
		r.Attach.Identity.WindowID = window
		return r
	}
	sock := "/run/user/32000/taskfleet/tmux-30c4a765d13e401ef01f.sock"
	for _, c := range []struct {
		r    nativeSpinoff
		want string
	}{
		{run("pending", "recorded", sock, "@1"), "30c4a765d13e401ef01f-1"},
		{run("running", "recorded", sock, "@12"), "30c4a765d13e401ef01f-12"},
		{run("done", "recorded", sock, "@1"), ""},
		{run("pending", "missing", sock, "@1"), ""},
		{run("pending", "recorded", "/run/user/32000/elsewhere/tmux-30c4a765d13e401ef01f.sock", "@1"), ""},
		{run("pending", "recorded", "relative/taskfleet/tmux-30c4a765d13e401ef01f.sock", "@1"), ""},
		{run("pending", "recorded", sock, "%1"), ""},
	} {
		if got := workerTerminal(c.r); got != c.want {
			t.Fatalf("%+v -> %q, want %q", c.r.Attach, got, c.want)
		}
	}
}

// The selected run carries what the worker view needs beside its history:
// harness and profile, the live window pointer, and the brief.
func TestSpinoffDetailCarriesWorkerFacts(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	worktree := filepath.Join(home, "src", "project__worktrees", "wt-one")
	_ = os.MkdirAll(filepath.Join(home, "src", "project"), 0700)
	claudeWorkerFile(t, home, worktree, claudeWorkerSession, claudeWorkerSession, worktree)
	runDir := filepath.Join(home, ".taskfleet", "runs", spinoffFixtureID)
	_ = os.MkdirAll(runDir, 0700)
	_ = os.WriteFile(filepath.Join(runDir, "prompt.md"), []byte("# Tehtävä\n\nLisää testit."), 0600)
	native := `{"run_id":"` + spinoffFixtureID + `","kind":"spinoff","lifecycle":"interactive","status":"pending","title":"kello-dst",
	"created_at":"2026-10-26T17:46:54Z","source_repo":"` + filepath.Join(home, "src", "project") + `","source_branch":"main","worktree_path":"` + worktree + `",
	"harness":"claude","awaiting_input":true,"node_transcripts":[{"node_id":"n-0001","harness":"claude","attempt":null,"session_id":null,"worktree_path":"` + worktree + `","support":"unsupported",
	"live":{"anchor":"state-root","path":null,"availability":"unsupported"},"original":{"anchor":"run-root","path":null,"availability":"unsupported"}}],
	"created_by_run_id":null,"created_by_session":{"harness":"pi","session_id":"` + spinoffParent + `"},"supervisor":{"state":"alive"},
	"manifest":{"selection":{"profile":"prototype-opus"}},
	"attach":{"state":"recorded","identity":{"socket":"/run/user/1/taskfleet/tmux-30c4a765d13e401ef01f.sock","window_id":"@1"}}}`
	bin := filepath.Join(home, ".local", "bin", "taskfleet")
	_ = os.MkdirAll(filepath.Dir(bin), 0700)
	script := "#!/bin/sh\ncase \"$1 $2\" in 'version --output') printf '%s' '{\"schema_version\":1,\"data\":{\"version\":\"0.17.1\"}}';; 'run show') printf '%s' '{\"schema_version\":1,\"data\":" + native + "}';; *) printf '%s' '{\"schema_version\":1,\"data\":{\"runs\":[" + native + "]}}';; esac\n"
	if err := os.WriteFile(bin, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", filepath.Dir(bin))
	parent := nativeSession{id: spinoffParent, cwd: "/invented/source", state: "readable"}
	h := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, func(transport.Config) ([]nativeSession, error) { return []nativeSession{parent}, nil })
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+spinoffParent+"/spinoffs?run="+spinoffFixtureID, nil))
	var body struct {
		Runs        []spinoffRow `json:"runs"`
		Transcripts []struct {
			Harness      string           `json:"harness"`
			Availability string           `json:"availability"`
			Entries      []map[string]any `json:"entries"`
		} `json:"transcripts"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &body) != nil || len(body.Runs) != 1 || len(body.Transcripts) != 1 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
	r := body.Runs[0]
	if r.Harness != "claude" || r.Profile != "prototype-opus" || !r.AwaitingInput || r.Terminal != "30c4a765d13e401ef01f-1" || !strings.HasPrefix(r.TerminalSpace, "ws_") || r.Brief != "# Tehtävä\n\nLisää testit." {
		t.Fatalf("worker facts lost: %+v", r)
	}
	if tr := body.Transcripts[0]; tr.Harness != "claude" || tr.Availability != "available" || len(tr.Entries) != 6 {
		t.Fatalf("Claude conversation not served: %+v", tr)
	}
	// The list carries no brief, window or history: only the selected run.
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+spinoffParent+"/spinoffs", nil))
	if strings.Contains(w.Body.String(), "Lisää testit") || strings.Contains(w.Body.String(), "30c4a765") || !strings.Contains(w.Body.String(), `"harness":"claude"`) {
		t.Fatalf("list read the worker's files: %s", w.Body.String())
	}
}

// A worker in another repository than its parent is watched through its own
// workspace: the terminal route lists only windows under the one it is asked.
func TestWorkerTerminalWorkspaceIsTheWorktreesOwn(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, UID: os.Getuid(), Provider: "github", Subject: "42"}
	for _, name := range []string{"parent-repo", "other-repo"} {
		_ = os.MkdirAll(filepath.Join(home, "src", name), 0700)
	}
	other := workerTerminalWorkspace(cfg, filepath.Join(home, "src", "other-repo__worktrees", "wt-x"))
	parent := workerTerminalWorkspace(cfg, filepath.Join(home, "src", "parent-repo"))
	if other == "" || parent == "" || other == parent {
		t.Fatalf("%q %q", other, parent)
	}
	if got := workerTerminalWorkspace(cfg, filepath.Join(home, "Sources", "elsewhere__worktrees", "wt-x")); got != "" {
		t.Fatalf("a worktree outside ~/src has no workspace: %q", got)
	}
}
