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

	"github.com/open-habitat/open-habitat/internal/transport"
)

const turnTestID = "12345678-1234-4123-8123-123456789abc"

// turnFixture is a home with one readable native conversation and the
// person's controller over it.
func turnFixture(t *testing.T) (*ConversationController, transport.Config, string) {
	t.Helper()
	cfg, home := cloneFixture(t)
	cwd := filepath.Join(home, "src", "project")
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(home, ".pi", "agent", "sessions")
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	header := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", turnTestID, cwd)
	if err := os.WriteFile(filepath.Join(root, "history.jsonl"), []byte(header), 0600); err != nil {
		t.Fatal(err)
	}
	c := &ConversationController{home: home, cfg: cfg, sessions: map[string]*conversation{}, journal: newEventJournal()}
	return c, cfg, home
}

func postTurn(c *ConversationController, id, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodPost, "http://unix/api/v1/conversations/"+id+"/turn", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.markTurn(w, r, id)
	return w
}

// snapshotMark reads the conversation's mark from a schema-valid snapshot.
func snapshotMark(t *testing.T, cfg transport.Config, home string) map[string]any {
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
	var doc struct {
		Agents []map[string]any
	}
	if err := json.Unmarshal(w.Body.Bytes(), &doc); err != nil {
		t.Fatal(err)
	}
	for _, a := range doc.Agents {
		if a["agent_id"] == "pi:"+turnTestID {
			mark, _ := a["turn_mark"].(map[string]any)
			return mark
		}
	}
	t.Fatal("conversation missing from snapshot")
	return nil
}

// Nosta and Ei nyt are one mark the person's daemon keeps: each write
// replaces the last, every reader (another device's snapshot) sees it, and
// the change is published so other tabs read it without a reload.
func TestTurnMarkIsOneDaemonMarkEveryDeviceSees(t *testing.T) {
	c, cfg, home := turnFixture(t)
	if mark := snapshotMark(t, cfg, home); mark != nil {
		t.Fatalf("unmarked conversation carries %v", mark)
	}
	w := postTurn(c, turnTestID, `{"mark":"raised"}`)
	if w.Code != 200 {
		t.Fatalf("raise: %d %s", w.Code, w.Body.String())
	}
	matchesSchema(t, "turn-mark.schema.json", w.Body.String())
	var reply struct {
		AgentID     string   `json:"agent_id"`
		TurnMark    turnMark `json:"turn_mark"`
		EventCursor string   `json:"event_cursor"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &reply); err != nil {
		t.Fatal(err)
	}
	if reply.AgentID != "pi:"+turnTestID || reply.TurnMark.State != "raised" || reply.EventCursor == "" {
		t.Fatalf("reply %+v", reply)
	}
	if mark := snapshotMark(t, cfg, home); mark["state"] != "raised" || mark["at"] != reply.TurnMark.At || mark["reply_id"] != nil {
		t.Fatalf("snapshot mark %v", mark)
	}
	w = postTurn(c, turnTestID, `{"mark":"not_now","reply_id":"a1b2c3d4"}`)
	if w.Code != 200 {
		t.Fatalf("not now: %d %s", w.Code, w.Body.String())
	}
	matchesSchema(t, "turn-mark.schema.json", w.Body.String())
	if mark := snapshotMark(t, cfg, home); mark["state"] != "not_now" || mark["reply_id"] != "a1b2c3d4" {
		t.Fatalf("snapshot mark %v", mark)
	}
	st, err := os.Stat(filepath.Join(home, ".config", "open-habitat", "turn-marks.json"))
	if err != nil || st.Mode().Perm() != 0600 {
		t.Fatalf("marks file: %v %v", st, err)
	}
	if c.clearTurnMark(turnTestID) != true || c.clearTurnMark(turnTestID) != false {
		t.Fatal("clearing reports the wrong change")
	}
	if mark := snapshotMark(t, cfg, home); mark != nil {
		t.Fatalf("cleared mark still shown: %v", mark)
	}
}

func TestTurnMarkRefusesWhatTheContractDoesNot(t *testing.T) {
	c, _, _ := turnFixture(t)
	for _, body := range []string{
		`{"mark":"raised","reply_id":"a1"}`,
		`{"mark":"none"}`,
		`{"mark":"not_now","reply_id":""}`,
		`{"mark":"not_now","reply_id":"a\nb"}`,
		`{"mark":"raised","at":"2026-11-06T09:20:00Z"}`,
		`{"mark":"raised"} {}`,
		`{"mark":"not_now","reply_id":"` + strings.Repeat("x", 201) + `"}`,
	} {
		if w := postTurn(c, turnTestID, body); w.Code != 400 {
			t.Errorf("%s: %d", body, w.Code)
		}
	}
	if w := postTurn(c, "87654321-4321-4321-8321-cba987654321", `{"mark":"raised"}`); w.Code != 404 {
		t.Fatalf("unknown conversation: %d", w.Code)
	}
}

// An unreadable file is never taken for no marks: a write would replace
// what it could not read.
func TestTurnMarkUnreadableFileIsNotEmpty(t *testing.T) {
	c, cfg, home := turnFixture(t)
	dir := filepath.Join(home, ".config", "open-habitat")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "turn-marks.json"), []byte(`{"schema_version":1,"marks":{"pi:`+turnTestID+`":{"state":"seen","at":"2026-11-06T09:20:00Z"}}}`), 0600); err != nil {
		t.Fatal(err)
	}
	if w := postTurn(c, turnTestID, `{"mark":"raised"}`); w.Code != 503 {
		t.Fatalf("write over unreadable marks: %d", w.Code)
	}
	if mark := snapshotMark(t, cfg, home); mark != nil {
		t.Fatalf("unreadable mark shown: %v", mark)
	}
}

func TestTurnMarksKeepTheNewestWithinTheBound(t *testing.T) {
	home := t.TempDir()
	base := time.Date(2026, 11, 6, 9, 0, 0, 0, time.UTC)
	key := func(i int) string { return fmt.Sprintf("pi:%08d-1234-4123-8123-123456789abc", i) }
	for i := 0; i <= maxTurnMarks; i++ {
		mark := turnMark{State: "raised", At: base.Add(time.Duration(i) * time.Second).Format(time.RFC3339Nano)}
		if _, err := setTurnMark(home, key(i), &mark); err != nil {
			t.Fatal(err)
		}
	}
	marks, err := readTurnMarks(home)
	if err != nil {
		t.Fatal(err)
	}
	if _, oldest := marks.Marks[key(0)]; len(marks.Marks) != maxTurnMarks || oldest {
		t.Fatalf("%d marks, oldest kept %v", len(marks.Marks), oldest)
	}
	if _, newest := marks.Marks[key(maxTurnMarks)]; !newest {
		t.Fatal("newest mark dropped")
	}
}

// Long reply IDs fill the byte bound before the count: the oldest give way
// so the file stays readable and writable.
func TestTurnMarksStayReadableWithLongReplyIDs(t *testing.T) {
	home := t.TempDir()
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
	if _, newest := marks.Marks[fmt.Sprintf("pi:%08d-1234-4123-8123-123456789abc", maxTurnMarks-1)]; !newest || len(marks.Marks) >= maxTurnMarks {
		t.Fatalf("%d marks, newest kept %v", len(marks.Marks), newest)
	}
}

// The person's reply ends a raise: when Pi accepts their message the mark
// goes, and the change is published.
func TestAcceptedMessageClearsTurnMark(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	code := `#!/usr/bin/env python3
import json,sys
for line in sys.stdin:
 r=json.loads(line)
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
	mark := turnMark{State: "raised", At: time.Now().UTC().Format(time.RFC3339Nano)}
	if _, err := setTurnMark(home, "pi:"+turnTestID, &mark); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "http://unix/send", strings.NewReader(`{"message":"vastaus","command_id":"0b6f2a4e-7d1c-4c3a-9f6e-2a1b3c4d5e60"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.admitMessage(w, req, turnTestID, "send", true)
	if w.Code != 200 {
		t.Fatalf("send: %d %s", w.Code, w.Body.String())
	}
	for end := time.Now().Add(5 * time.Second); ; time.Sleep(10 * time.Millisecond) {
		marks, err := readTurnMarks(home)
		if err != nil {
			t.Fatal(err)
		}
		if _, ok := marks.Marks["pi:"+turnTestID]; !ok {
			break
		}
		if time.Now().After(end) {
			t.Fatal("accepted message left the raise")
		}
	}
}
