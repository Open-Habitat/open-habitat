//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

const sectionGeneration = "33333333-3333-4333-8333-333333333333"

// sectionFixture is turnFixture with the conversation's own Pi launched by
// the daemon, its turn running or not.
func sectionFixture(t *testing.T, running bool) (*ConversationController, *conversation, string) {
	t.Helper()
	c, _, home := turnFixture(t)
	s := &conversation{id: turnTestID, workspace: "ws_example123", runActive: running, rpc: &piRPC{processGeneration: sectionGeneration, exited: make(chan struct{})}}
	c.sessions[turnTestID] = s
	return c, s, home
}

func postSection(c *ConversationController, query, body string) *httptest.ResponseRecorder {
	if query == "" {
		query = "current=true&id=pi:" + turnTestID + "&workspace_id=ws_example123&generation=" + sectionGeneration
	}
	r := httptest.NewRequest("POST", AgentSectionPath+"?"+query, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.agentSectionUpdate(w, r)
	return w
}

func storedSection(t *testing.T, home string) (agentSection, bool) {
	t.Helper()
	marks, err := readTurnMarks(home)
	if err != nil {
		t.Fatal(err)
	}
	s, ok := marks.Sections["pi:"+turnTestID]
	return s, ok
}

// The agent's choice is one stored section per conversation that every
// device's snapshot carries; repeating it reports and publishes no change,
// and a new choice replaces it. It never touches the person's own mark.
func TestAgentSectionIsStoredBesideThePersonsMark(t *testing.T) {
	c, _, home := sectionFixture(t, true)
	if w := postTurn(c, turnTestID, `{"mark":"raised"}`); w.Code != 200 {
		t.Fatalf("raise: %d", w.Code)
	}
	w := postSection(c, "", `{"section":"quiet"}`)
	if w.Code != 200 {
		t.Fatalf("quiet: %d %s", w.Code, w.Body.String())
	}
	matchesSchema(t, "agent-section.schema.json", w.Body.String())
	var reply struct {
		AgentSection agentSection `json:"agent_section"`
		Changed      bool         `json:"changed"`
		EventCursor  string       `json:"event_cursor"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &reply); err != nil {
		t.Fatal(err)
	}
	if reply.AgentSection.Section != "quiet" || !reply.Changed || reply.EventCursor == "" {
		t.Fatalf("reply %+v", reply)
	}
	again := postSection(c, "", `{"section":"quiet"}`)
	var repeated struct {
		AgentSection agentSection `json:"agent_section"`
		Changed      bool         `json:"changed"`
		EventCursor  string       `json:"event_cursor"`
	}
	if again.Code != 200 || json.Unmarshal(again.Body.Bytes(), &repeated) != nil || repeated.Changed || repeated.AgentSection.Section != "quiet" || repeated.EventCursor != "" {
		t.Fatalf("repeat was not a no-op: %d %s", again.Code, again.Body.String())
	}
	if w := postSection(c, "", `{"section":"running"}`); w.Code != 200 {
		t.Fatalf("running: %d", w.Code)
	}
	if s, _ := storedSection(t, home); s.Section != "running" {
		t.Fatalf("stored %+v", s)
	}
	agent := snapshotAgent(t, c.cfg, home)
	if choice, _ := agent["agent_section"].(map[string]any); choice["section"] != "running" {
		t.Fatalf("snapshot choice %v", agent["agent_section"])
	}
	if mark, _ := agent["turn_mark"].(map[string]any); mark["state"] != "raised" {
		t.Fatalf("the choice replaced the person's mark: %v", agent["turn_mark"])
	}
}

// snapshotAgent reads the test conversation from a schema-valid snapshot.
func snapshotAgent(t *testing.T, cfg transport.Config, home string) map[string]any {
	t.Helper()
	h := SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, func(transport.Config) Discovery { return DiscoverFixtureRoot(home, os.Geteuid()) }, home)
	r := httptest.NewRequest("GET", "http://unix"+SnapshotPath, nil)
	r.RequestURI = SnapshotPath
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("snapshot: %d %s", w.Code, w.Body.String())
	}
	matchesSchema(t, "snapshot.schema.json", w.Body.String())
	var doc struct{ Agents []map[string]any }
	if err := json.Unmarshal(w.Body.Bytes(), &doc); err != nil {
		t.Fatal(err)
	}
	for _, a := range doc.Agents {
		if a["agent_id"] == "pi:"+turnTestID {
			return a
		}
	}
	t.Fatal("conversation missing from snapshot")
	return nil
}

// Only the conversation's own running turn may choose, with exactly one of
// the three sections; nothing is stored on a refusal.
func TestAgentSectionRefusesOutsideItsOwnRunningTurn(t *testing.T) {
	c, s, home := sectionFixture(t, true)
	for _, body := range []string{
		`{"section":"hidden"}`,
		`{"section":""}`,
		`{}`,
		`{"section":"quiet","conversation":"pi:` + turnTestID + `"}`,
		`{"section":"quiet"} {}`,
	} {
		if w := postSection(c, "", body); w.Code != 400 {
			t.Errorf("%s: %d", body, w.Code)
		}
	}
	// An explicit ID is no current context: an agent places only its own.
	if w := postSection(c, "id=pi:"+turnTestID, `{"section":"quiet"}`); w.Code != 400 {
		t.Errorf("explicit id: %d", w.Code)
	}
	// A worker or leftover script holding an older launch is stale.
	if w := postSection(c, "current=true&id=pi:"+turnTestID+"&workspace_id=ws_example123&generation=44444444-4444-4444-8444-444444444444", `{"section":"quiet"}`); w.Code != 409 || !strings.Contains(w.Body.String(), "current_context_stale") {
		t.Errorf("stale generation: %d %s", w.Code, w.Body.String())
	}
	c.mu.Lock()
	s.runActive = false
	c.mu.Unlock()
	if w := postSection(c, "", `{"section":"quiet"}`); w.Code != 409 || !strings.Contains(w.Body.String(), "conversation_not_running") {
		t.Errorf("settled turn: %d %s", w.Code, w.Body.String())
	}
	if choice, ok := storedSection(t, home); ok {
		t.Fatalf("a refusal stored %+v", choice)
	}
}

// The choice belongs to the turn it was made in: a later turn start or an
// accepted message removes it, but never a choice made after that moment.
func TestAgentSectionEndsWithItsTurn(t *testing.T) {
	_, _, home := sectionFixture(t, true)
	before := time.Now()
	if _, _, err := setAgentSection(home, "pi:"+turnTestID, "running", before); err != nil {
		t.Fatal(err)
	}
	// The turn the choice was made in started before it.
	if changed, err := clearAgentSection(home, "pi:"+turnTestID, before.Add(-time.Second)); err != nil || changed {
		t.Fatalf("the choice's own turn cleared it: %v %v", changed, err)
	}
	if changed, err := clearAgentSection(home, "pi:"+turnTestID, before.Add(time.Millisecond)); err != nil || !changed {
		t.Fatalf("the next turn kept it: %v %v", changed, err)
	}
	if _, ok := storedSection(t, home); ok {
		t.Fatal("choice survived the next turn")
	}
}

// The new turn, or the agent after a steer, repeats the earlier section
// before the earlier clear has run: the repeat is stamped anew, reports no
// change, and the pending clear leaves it alone.
func TestRepeatedSectionOutlivesThePendingClear(t *testing.T) {
	home := t.TempDir()
	key := "pi:" + turnTestID
	earlier := time.Now().Add(-time.Minute)
	if _, _, err := setAgentSection(home, key, "quiet", earlier); err != nil {
		t.Fatal(err)
	}
	boundary := earlier.Add(30 * time.Second)
	choice, changed, err := setAgentSection(home, key, "quiet", boundary.Add(time.Second))
	if err != nil || changed {
		t.Fatalf("repeat reported a change: %v %v", changed, err)
	}
	if cleared, err := clearAgentSection(home, key, boundary); err != nil || cleared {
		t.Fatalf("the pending clear took the repeated choice: %v %v", cleared, err)
	}
	if stored, ok := storedSection(t, home); !ok || stored != choice {
		t.Fatalf("stored %+v, replied %+v", stored, choice)
	}
}

// A message Pi takes in supersedes the choice made before it was sent, not
// one the agent makes while working on it before Pi's receipt arrives.
func TestLateReceiptKeepsTheChoiceMadeForTheNewMessage(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	code := `#!/usr/bin/env python3
import json,sys,time
for line in sys.stdin:
 r=json.loads(line)
 time.sleep(0.5)
 print(json.dumps(dict(type="response",id=r["id"],command=r["type"],success=True)),flush=True)
`
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	s := &conversation{id: turnTestID, rpc: p, state: "idle", settled: true, commands: map[string]bool{}}
	c := &ConversationController{home: home, sessions: map[string]*conversation{turnTestID: s}, journal: newEventJournal()}
	go c.drain(s)
	if _, _, err := setAgentSection(home, "pi:"+turnTestID, "running", time.Now().Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "http://unix/send", strings.NewReader(`{"message":"vastaus","command_id":"0b6f2a4e-7d1c-4c3a-9f6e-2a1b3c4d5e61"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.admitMessage(w, req, turnTestID, "send", true, nil)
	if w.Code != 200 {
		t.Fatalf("send: %d %s", w.Code, w.Body.String())
	}
	time.Sleep(100 * time.Millisecond)
	// The agent, already at work on the message, chooses before the receipt.
	if _, _, err := setAgentSection(home, "pi:"+turnTestID, "quiet", time.Now()); err != nil {
		t.Fatal(err)
	}
	for end := time.Now().Add(5 * time.Second); ; time.Sleep(10 * time.Millisecond) {
		c.mu.Lock()
		ack := s.ack
		c.mu.Unlock()
		if ack != "pending" {
			break
		}
		if time.Now().After(end) {
			t.Fatal("no receipt")
		}
	}
	time.Sleep(200 * time.Millisecond) // the background clear has run
	if choice, ok := storedSection(t, home); !ok || choice.Section != "quiet" {
		t.Fatalf("the late receipt cleared the new choice: %+v %v", choice, ok)
	}
}

// Under byte pressure the agents' choices give way before the person's
// marks: as many marks fit beside full sections as without them.
func TestAgentSectionsNeverCrowdOutThePersonsMarks(t *testing.T) {
	fill := func(home string) int {
		base := time.Date(2026, 11, 6, 9, 0, 0, 0, time.UTC)
		reply := strings.Repeat("<", 200)
		for i := 0; i < maxTurnMarks; i++ {
			mark := turnMark{State: "not_now", At: base.Add(time.Duration(i) * time.Second).Format(time.RFC3339Nano), ReplyID: reply}
			if _, err := setTurnMark(home, fmt.Sprintf("pi:%08d-1234-4123-8123-123456789abc", i), &mark); err != nil {
				t.Fatalf("mark %d: %v", i, err)
			}
		}
		marks, err := readTurnMarks(home)
		if err != nil {
			t.Fatal(err)
		}
		return len(marks.Marks)
	}
	plain := fill(t.TempDir())
	home := t.TempDir()
	for i := 0; i < maxAgentSections; i++ {
		if _, _, err := setAgentSection(home, fmt.Sprintf("pi:%08d-4321-4123-8123-123456789abc", i), "quiet", time.Now()); err != nil {
			t.Fatal(err)
		}
	}
	if got := fill(home); got != plain {
		t.Fatalf("%d marks beside sections, %d without", got, plain)
	}
}

// Pi starting a new turn of its own (a wake, say) supersedes the agent's
// earlier choice, as the person's message does.
func TestNativeTurnStartClearsAgentSection(t *testing.T) {
	home := t.TempDir()
	trigger := filepath.Join(home, "wake")
	script := filepath.Join(home, "pi")
	code := `#!/usr/bin/env python3
import json,os,sys,time
while not os.path.exists(` + strconv.Quote(trigger) + `):
 time.sleep(0.01)
print(json.dumps(dict(type="agent_start")),flush=True)
for line in sys.stdin:
 pass
`
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	s := &conversation{id: turnTestID, rpc: p, state: "idle", settled: true, commands: map[string]bool{}}
	c := &ConversationController{home: home, sessions: map[string]*conversation{turnTestID: s}, journal: newEventJournal()}
	go c.drain(s)
	if _, _, err := setAgentSection(home, "pi:"+turnTestID, "quiet", time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(trigger, nil, 0600); err != nil {
		t.Fatal(err)
	}
	for end := time.Now().Add(5 * time.Second); ; time.Sleep(10 * time.Millisecond) {
		if _, ok := storedSection(t, home); !ok {
			break
		}
		if time.Now().After(end) {
			t.Fatal("a new turn left the earlier choice")
		}
	}
}
