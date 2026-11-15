//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/open-habitat/open-habitat/internal/testpython"
	"github.com/open-habitat/open-habitat/internal/transport"
)

func agentListForTest(t *testing.T, c *ConversationController) []map[string]any {
	t.Helper()
	w := httptest.NewRecorder()
	c.agentConversations(w, httptest.NewRequest("GET", AgentConversationsPath, nil))
	if w.Code != 200 {
		t.Fatalf("list: %d %s", w.Code, w.Body.String())
	}
	cmd := exec.Command(testpython.Validator(t), "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); m['Draft202012Validator'](m['schemas']['agent-conversation-list.schema.json'],registry=m['registry']).validate(json.load(sys.stdin))`)
	cmd.Stdin = bytes.NewReader(w.Body.Bytes())
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("schema: %v %s", err, out)
	}
	var result struct {
		Sessions []map[string]any `json:"sessions"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result.Sessions
}

func TestAgentConversationListSurvivesHandleEviction(t *testing.T) {
	f := newWorktreeFixture(t)
	f.c.discover = Discover
	place, err := f.createPlace("planning")
	if err != nil {
		t.Fatal(err)
	}
	live := "11111111-1111-4111-8111-111111111111"
	resting := "22222222-2222-4222-8222-222222222222"
	archived := "33333333-3333-4333-8333-333333333333"
	pending := "44444444-4444-4444-8444-444444444444"
	writeSession(t, f.cfg.Home, live, f.src("app"), `{"type":"session_info","name":"Planning"}`)
	writeSession(t, f.cfg.Home, resting, f.wt("planning"), `{"type":"message","id":"m1","message":{"role":"user","content":"First question"}}`)
	writeSession(t, f.cfg.Home, archived, f.src("app"), `{"type":"session_info","name":"Earlier work"}`)
	// History outside the rail's workspace/place catalog is not a rail conversation.
	writeSession(t, f.cfg.Home, "55555555-5555-4555-8555-555555555555", filepath.Join(f.cfg.Home, "elsewhere"))
	visibility, err := loadVisibility(f.cfg.Home)
	if err != nil {
		t.Fatal(err)
	}
	visibility.Conversations["pi:"+archived] = json.RawMessage(`{"archived_at":"2026-10-06T12:00:00Z"}`)
	if err := saveVisibility(f.cfg.Home, visibility); err != nil {
		t.Fatal(err)
	}
	f.c.sessions = map[string]*conversation{
		live:     {id: live, cwd: f.src("app"), workspace: f.id, state: "idle", rpc: &piRPC{exited: make(chan struct{})}},
		resting:  {id: resting, cwd: f.wt("planning"), workspace: place, state: "idle"},
		archived: {id: archived, cwd: f.src("app"), workspace: f.id, state: "idle"},
		pending:  {id: pending, cwd: f.src("app"), workspace: f.id, state: "pending", givenName: "New plan", rpc: &piRPC{exited: make(chan struct{})}},
	}
	check := func() {
		t.Helper()
		rows := agentListForTest(t, f.c)
		if len(rows) != 4 {
			t.Fatalf("rows: %#v", rows)
		}
		for i, want := range []struct{ id, title, lifecycle, workspace string }{
			{live, "Planning", "live", f.id}, {resting, "First question", "resting", place},
			{archived, "Earlier work", "archived", f.id}, {pending, "New plan", "live", f.id},
		} {
			row := rows[i]
			if row["agent_id"] != "pi:"+want.id || row["title"] != want.title || row["lifecycle"] != want.lifecycle || row["workspace_id"] != want.workspace {
				t.Fatalf("want %+v, got %#v", want, row)
			}
		}
	}
	check()
	for _, state := range []string{"error", "partial"} {
		f.c.discover = func(cfg transport.Config) Discovery {
			if state == "error" {
				return Discovery{State: state}
			}
			d := Discover(cfg)
			d.State = state
			d.Entries = append(d.Entries, Workspace{Name: "racing", Error: "raced_entry"})
			return d
		}
		w := httptest.NewRecorder()
		f.c.agentConversations(w, httptest.NewRequest("GET", AgentConversationsPath, nil))
		if w.Code != 503 {
			t.Fatalf("%s discovery returned partial success: %d %s", state, w.Code, w.Body.String())
		}
	}
	f.c.discover = Discover
	delete(f.c.sessions, resting)
	delete(f.c.sessions, archived)
	check() // reproduces the report: stopped handles vanish, their rows must not.
	rows := agentListForTest(t, f.c)
	if _, exists := rows[1]["state"]; exists {
		t.Fatal("invented controller state without a handle")
	}
	f.c.sessions = map[string]*conversation{}
	rows = agentListForTest(t, f.c)
	if len(rows) != 3 || rows[0]["lifecycle"] != "resting" {
		t.Fatalf("restart lost history: %#v", rows)
	}
	// The same native membership is visible in the rail, including the worktree.
	doc := f.snapshot()
	if len(doc["agents"].([]any)) != len(rows) {
		t.Fatalf("rail/list mismatch: %v / %v", doc["agents"], rows)
	}
	// Never disguise an unavailable inventory as an empty or handle-only success.
	root := filepath.Join(f.cfg.Home, historyRoot)
	if err := os.Rename(root, root+"-saved"); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(root+"-saved", root); err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	f.c.agentConversations(w, httptest.NewRequest("GET", AgentConversationsPath, nil))
	if w.Code != 503 {
		t.Fatalf("unavailable history: %d %s", w.Code, w.Body.String())
	}
}
