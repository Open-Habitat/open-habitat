//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func activityCommand(n int) string { return fmt.Sprintf("bbbbbbbb-0000-4000-8000-%012d", n) }

func (h *heldHarness) live(c *ConversationController, id string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	s := c.sessions[id]
	return s != nil && liveChild(s)
}

// converse sends one message and waits until Pi has answered it and is idle.
func (h *heldHarness) converse(c *ConversationController, id, text, command string) {
	h.t.Helper()
	if w := h.send(c, id, text, command); w.Code != 200 {
		h.t.Fatalf("send %q: %d %s", text, w.Code, w.Body.String())
	}
	h.eventually("turn of "+text+" settled", func() bool {
		_, v := h.status(c, id)
		return h.receipt(c, id, command) == "accepted" && v.State == "idle"
	})
}

// deletion runs the workspace deletion handler on the harness's own
// controller, against a synthetic /proc that holds no foreign processes.
func (h *heldHarness) deletion(c *ConversationController, action string) (int, map[string]any) {
	h.t.Helper()
	token := ""
	for _, w := range Discover(h.cfg).Entries {
		if w.Name == "project" {
			token = workspaceToken(h.cfg, w)
		}
	}
	input := map[string]any{"action": action, "workspace_id": h.workspace, "observation_token": token}
	if action == "delete" {
		input["disposal"] = "trash"
	}
	b, _ := json.Marshal(input)
	r := httptest.NewRequest("POST", "http://unix"+WorkspacePath, bytes.NewReader(b))
	r.RequestURI = WorkspacePath
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	WorkspaceHandlerWithArchive(h.cfg, func(*http.Request) bool { return true }, c).ServeHTTP(w, r)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func (h *heldHarness) deletable() {
	h.t.Helper()
	// Not the person's last workspace, and no real /proc scan.
	if err := os.MkdirAll(filepath.Join(h.root, "src", "toinen"), 0700); err != nil {
		h.t.Fatal(err)
	}
	old := deletionProcRoot
	deletionProcRoot = h.t.TempDir()
	h.t.Cleanup(func() { deletionProcRoot = old })
}

// Four idle conversations do not fill the limit: a fifth start stops the
// longest unused idle Pi. Its history stays, and its next message resumes it,
// which in turn stops the then longest unused one.
func TestIdleConversationsYieldTheirPlace(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	var ids []string
	for i := 0; i < maxLiveConversations; i++ {
		id := h.create(c)
		h.converse(c, id, fmt.Sprintf("Viesti %d", i), activityCommand(i))
		ids = append(ids, id)
	}
	fifth := h.create(c)
	if h.live(c, ids[0]) {
		t.Fatal("the longest unused idle Pi still runs after a fifth start")
	}
	for _, id := range ids[1:] {
		if !h.live(c, id) {
			t.Fatalf("an idle Pi other than the longest unused one was stopped: %s", id)
		}
	}
	h.eventually("fifth ready", func() bool { _, v := h.status(c, fifth); return v.State == "idle" })

	h.converse(c, ids[0], "Jatketaan", activityCommand(10))
	if h.live(c, ids[1]) || !h.live(c, ids[0]) {
		t.Fatalf("resume did not take the longest unused place: first live %v, second live %v", h.live(c, ids[0]), h.live(c, ids[1]))
	}
	launches := 0
	for _, l := range h.lines("launches.log") {
		if l == ids[0] {
			launches++
		}
	}
	if launches != 2 {
		t.Fatalf("first conversation launched %d times, want a fresh start and one resume", launches)
	}
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		t.Fatal(err)
	}
	for _, n := range sessions {
		if n.id == ids[0] {
			b, _ := os.ReadFile(n.path)
			if !strings.Contains(string(b), "Viesti 0") || !strings.Contains(string(b), "Jatketaan") {
				t.Fatalf("native history lost a message across the stop: %s", b)
			}
			return
		}
	}
	t.Fatal("native history of the stopped conversation not found")
}

// A turn in progress holds its place and blocks deletion, naming the
// conversation; once the turns end, the fifth start and deletion go through
// without archiving anything, and deletion stops the idle Pi it found.
func TestBusyConversationsHoldPlacesAndBlockDeletion(t *testing.T) {
	h := newHeldHarness(t)
	h.deletable()
	c, stop := h.daemon()
	defer stop()
	h.setFile("prompt-hold", "1")
	var ids []string
	for i := 0; i < maxLiveConversations; i++ {
		id := h.create(c)
		h.eventually("ready", func() bool { _, v := h.status(c, id); return v.State == "idle" })
		if w := h.send(c, id, fmt.Sprintf("Pitkä työ %d", i), activityCommand(i)); w.Code != 200 {
			t.Fatalf("send: %d %s", w.Code, w.Body.String())
		}
		h.eventually("turn running", func() bool {
			c.mu.Lock()
			defer c.mu.Unlock()
			return c.sessions[id].runActive
		})
		ids = append(ids, id)
	}
	w := h.post(c.create, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace))
	if w.Code != 429 || !strings.Contains(w.Body.String(), "capacity_exceeded") {
		t.Fatalf("a fifth start beside four running turns: %d %s", w.Code, w.Body.String())
	}
	for _, id := range ids {
		if !h.live(c, id) {
			t.Fatalf("a running turn was stopped to make room: %s", id)
		}
	}
	for _, action := range []string{"delete_check", "delete"} {
		code, body := h.deletion(c, action)
		blockers, _ := body["blockers"].([]any)
		named := map[string]bool{}
		for _, raw := range blockers {
			b := raw.(map[string]any)
			if b["kind"] == "pi_session" && b["activity"] == "turn" {
				named[b["agent_id"].(string)] = true
			}
		}
		if code != 200 || body["outcome"] != "blocked" || len(named) != len(ids) {
			t.Fatalf("%s beside running turns: %d %v", action, code, body)
		}
		for _, id := range ids {
			if !named["pi:"+id] {
				t.Fatalf("%s does not name %s: %v", action, id, body)
			}
		}
	}

	h.setFile("prompt-hold", "")
	for i, id := range ids {
		h.eventually("turn settled", func() bool { return h.receipt(c, id, activityCommand(i)) == "accepted" })
		h.eventually("idle", func() bool { _, v := h.status(c, id); return v.State == "idle" })
	}
	if code, body := h.deletion(c, "delete_check"); code != 200 || body["outcome"] != "trash" {
		t.Fatalf("idle conversations block the check: %d %v", code, body)
	}
	for _, id := range ids {
		if !h.live(c, id) {
			t.Fatal("a check that changes nothing stopped an idle Pi")
		}
	}
	if code, body := h.deletion(c, "delete"); code != 200 || body["state"] != "trashed" {
		t.Fatalf("deletion beside idle conversations: %d %v", code, body)
	}
	for _, id := range ids {
		if h.live(c, id) {
			t.Fatalf("an idle Pi still runs in the trashed workspace: %s", id)
		}
	}
}

func (h *heldHarness) archive(c *ConversationController, id string) {
	h.t.Helper()
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		h.t.Fatal(err)
	}
	token := ""
	for _, n := range sessions {
		if n.id == id {
			token = opaque("obs_", id+":"+n.revision)
		}
	}
	w := httptest.NewRecorder()
	c.archiveInput(context.Background(), w, id, archiveRequest{WorkspaceID: h.workspace, Archived: true, ObservationToken: token, PreviousArchive: "active"})
	if w.Code != 200 {
		h.t.Fatalf("archive: %d %s", w.Code, w.Body.String())
	}
}

// An idle conversation's Pi holds no place once archived. A Pi whose
// background process still runs is busy: archive, the limit and deletion
// leave it running, since stopping Pi would stop the process too.
func TestArchiveStopsIdlePiButNotBackgroundWork(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "Arkistoitava", activityCommand(1))
	h.archive(c, id)
	h.eventually("archived idle Pi stopped", func() bool { return !h.live(c, id) })

	h.setFile("background", "1")
	working := h.create(c)
	h.converse(c, working, "Käynnistä käännös taustalle", activityCommand(2))
	h.setFile("background", "")
	h.archive(c, working)
	c.stopIfIdle(context.Background(), working) // what archive started, done synchronously
	busy := c.busySessions(context.Background(), filepath.Join(h.root, "src", "project"))
	if !h.live(c, working) || len(busy) != 1 || busy[0] != (busyConversation{"pi:" + working, "processes"}) {
		t.Fatalf("background work: live %v, busy %v", h.live(c, working), busy)
	}
	for i := 0; i < maxLiveConversations-1; i++ {
		h.create(c)
	}
	if w := h.post(c.create, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace)); !h.live(c, working) {
		t.Fatalf("a start stopped a Pi with background work: %d", w.Code)
	}
}

// The definition itself: everything the controller knows in memory that makes
// a conversation busy. A plausible wrong definition (runActive alone, or any
// live child) fails one of these rows.
func TestHeldActivity(t *testing.T) {
	cases := []struct {
		name string
		s    conversation
		want string
	}{
		{"idle", conversation{state: "idle"}, ""},
		{"rejected prompt", conversation{state: "rejected"}, ""},
		{"settled and published", conversation{state: "idle", settled: true, settlement: map[string]string{}}, ""},
		{"run active", conversation{state: "idle", runActive: true}, "turn"},
		{"prompt pending", conversation{state: "pending"}, "turn"},
		{"prompt accepted", conversation{state: "accepted"}, "turn"},
		{"starting", conversation{state: "starting"}, "turn"},
		{"held message", conversation{state: "idle", held: []heldMessage{{}}}, "turn"},
		{"queued follow-up", conversation{state: "idle", queueFollowUp: []string{"x"}}, "turn"},
		{"title being written", conversation{state: "idle", naming: true}, "turn"},
		{"recap being written", conversation{state: "idle", recapping: true}, "turn"},
		{"abort in flight", conversation{state: "idle", aborting: true}, "turn"},
		{"settling history", conversation{state: "idle", settled: true}, "turn"},
		{"question", conversation{state: "accepted", runActive: true, questionID: "q"}, "question"},
		{"stopping", conversation{state: "stopping"}, "unknown"},
		{"uncertain", conversation{state: "uncertain"}, "unknown"},
	}
	for _, tc := range cases {
		if got := heldActivity(&tc.s); got != tc.want {
			t.Errorf("%s: %q, want %q", tc.name, got, tc.want)
		}
	}
}
