//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/core"
)

// guestTurnFixture is a shared conversation with a joined participant and a fake
// companion that records the bridge requests it gets. busy makes it refuse a
// participant message or release as Pi would during a run.
type guestTurnFixture struct {
	c        *ConversationController
	s        *conversation
	mu       sync.Mutex
	requests []map[string]any
	busy     bool
	reason   string // a refusal reason other than busy
}

func newGuestTurnFixture(t *testing.T) *guestTurnFixture {
	t.Helper()
	c, _ := membershipFixture(t)
	if c.runtime == nil {
		c.runtime = &core.PiRuntimeConfig{}
	}
	f := &guestTurnFixture{c: c}
	p := testProcessPeer(t, os.Getpid(), func(conn net.Conn) {
		var q map[string]any
		if json.NewDecoder(conn).Decode(&q) != nil {
			return
		}
		f.mu.Lock()
		reply := map[string]any{"ok": true}
		switch {
		case q["op"] == "grant":
			reply["data"] = map[string]any{"told": true}
		case f.busy:
			reply["data"] = map[string]any{"delivered": false, "reason": "busy"}
		case f.reason != "":
			reply["data"] = map[string]any{"delivered": false, "reason": f.reason}
		case q["op"] == "participant_message" || q["op"] == "release":
			f.requests = append(f.requests, q)
			reply["data"] = map[string]any{"delivered": true}
		default:
			reply["data"] = map[string]any{"written": true}
		}
		f.mu.Unlock()
		_ = json.NewEncoder(conn).Encode(reply)
	})
	f.s = &conversation{id: memberConv, rpc: p, state: "idle", commands: map[string]bool{}}
	c.sessions[memberConv] = f.s
	memberCall(t, c, "POST", control("invite", ville.Subject, "Example Participant"))
	if _, ok := c.joinMember(memberConv, ville); !ok {
		t.Fatal("join failed")
	}
	return f
}

func (f *guestTurnFixture) seen() []map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]map[string]any(nil), f.requests...)
}

// deliver runs one delivery as a settle would, with the run's start (which
// ends the daemon's hold on the owner's sends) arriving at once.
func (f *guestTurnFixture) deliver(t *testing.T) {
	t.Helper()
	done := make(chan struct{})
	go func() { f.c.deliverGuest(f.s); close(done) }()
	deadline := time.Now().Add(5 * time.Second)
	for {
		select {
		case <-done:
			return
		default:
		}
		f.c.mu.Lock()
		if f.s.waking {
			f.s.waking = false // Pi's agent_start
		}
		f.c.mu.Unlock()
		if time.Now().After(deadline) {
			t.Fatal("delivery did not finish")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func (f *guestTurnFixture) held() []guestHeld {
	f.c.mu.Lock()
	defer f.c.mu.Unlock()
	return append([]guestHeld(nil), f.s.guestHeld...)
}

func TestParticipantMessagesWaitForAnIdlePiAndCarryTheRecordsRole(t *testing.T) {
	f := newGuestTurnFixture(t)
	// A run is in progress: the message is held, not steered into it.
	f.c.mu.Lock()
	f.s.runActive = true
	f.c.mu.Unlock()
	if _, status, code := f.c.holdParticipantMessage(memberConv, ville, "first"); status != 0 {
		t.Fatalf("hold: %d %s", status, code)
	}
	if _, status, _ := f.c.holdParticipantMessage(memberConv, ville, "second"); status != 0 {
		t.Fatal("second hold refused")
	}
	f.deliver(t)
	if n := len(f.seen()); n != 0 {
		t.Fatalf("delivered into a running turn: %d", n)
	}
	// The run settles. The owner meanwhile gave full rights; the message
	// carries the role the record has when it is delivered.
	f.c.mu.Lock()
	f.s.runActive = false
	f.c.mu.Unlock()
	memberCall(t, f.c, "POST", control("full_rights", ville.Subject, ""))
	f.deliver(t)
	seen := f.seen()
	if len(seen) != 1 || seen[0]["op"] != "participant_message" {
		t.Fatalf("one run for the person's consecutive messages: %v", seen)
	}
	m := seen[0]["message"].(map[string]any)
	if m["text"] != "first\n\nsecond" || m["role"] != roleFullRights || m["subject"] != ville.Subject || m["display_name"] != "Example Participant" {
		t.Fatalf("message: %v", m)
	}
	record, _ := loadMembership(f.c.home)
	if uint64(m["generation"].(float64)) != record.Conversations["pi:"+memberConv].Members[0].Generation {
		t.Fatalf("generation is not the member's current one: %v", m)
	}
	if len(f.held()) != 0 {
		t.Fatal("delivered messages stayed held")
	}
}

func TestParticipantMessageIsRecheckedAtDeliveryAndRefusedToStrangers(t *testing.T) {
	f := newGuestTurnFixture(t)
	stranger := guestParticipant{Subject: "github:2002", DisplayName: "Example Stranger"}
	if _, status, code := f.c.holdParticipantMessage(memberConv, stranger, "hello"); status != 404 || code != "resource_not_found" {
		t.Fatalf("a non-member: %d %s", status, code)
	}
	for _, text := range []string{"", "   ", strings.Repeat("x", maxParticipantText+1), "nul\x00"} {
		if _, status, _ := f.c.holdParticipantMessage(memberConv, ville, text); status != 400 {
			t.Fatalf("text %q admitted", text[:min(len(text), 10)])
		}
	}
	f.mu.Lock()
	f.busy = true
	f.mu.Unlock()
	if _, status, _ := f.c.holdParticipantMessage(memberConv, ville, "hello"); status != 0 {
		t.Fatal("hold refused")
	}
	f.deliver(t)
	if len(f.held()) != 1 {
		t.Fatal("a busy Pi lost the message")
	}
	// Removed before Pi was free: the message is never delivered.
	memberCall(t, f.c, "POST", control("remove", ville.Subject, ""))
	f.mu.Lock()
	f.busy = false
	f.mu.Unlock()
	f.deliver(t)
	if len(f.seen()) != 0 || len(f.held()) != 0 {
		t.Fatalf("removed person's message: delivered %v, held %v", f.seen(), f.held())
	}
}

func TestParticipantAndOwnerHeldTextStayApartInOrder(t *testing.T) {
	f := newGuestTurnFixture(t)
	f.c.mu.Lock()
	f.s.held = []heldMessage{{id: "owner-1", text: "owner first", seq: f.s.nextHeldSeq()}}
	f.c.mu.Unlock()
	f.c.holdParticipantMessage(memberConv, ville, "guest after")
	f.c.mu.Lock()
	f.s.held = append(f.s.held, heldMessage{id: "owner-2", text: "owner last", seq: f.s.nextHeldSeq()})
	_, ok := f.c.takeHeldLocked(f.s)
	f.c.mu.Unlock()
	if !ok {
		t.Fatal("the owner's older message did not go first")
	}
	f.c.mu.Lock()
	if len(f.s.held) != 1 || f.s.held[0].id != "owner-2" || !participantFirst(f.s) {
		t.Fatalf("held after the owner's batch: %+v", f.s.held)
	}
	f.s.state, f.s.promptIDs = "idle", nil
	_, ok = f.c.takeHeldLocked(f.s)
	f.c.mu.Unlock()
	if ok {
		t.Fatal("the owner's later message overtook the participant's")
	}
	f.deliver(t)
	if seen := f.seen(); len(seen) != 1 || seen[0]["message"].(map[string]any)["text"] != "guest after" {
		t.Fatalf("participant delivery: %v", seen)
	}
}

func TestOwnerReleaseIsHeldAndDeliveredAsALine(t *testing.T) {
	f := newGuestTurnFixture(t)
	request := "0f8fad5b-d9cb-469f-a165-70867728950e"
	call := func(body any) (int, string) {
		b, _ := json.Marshal(body)
		req := httptest.NewRequest("POST", "http://unix/api/v1/conversations/"+memberConv+"/requests", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		f.c.releaseRequest(w, req, memberConv)
		return w.Code, w.Body.String()
	}
	for _, bad := range []map[string]string{{"request": request, "subject": ville.Subject, "action": "owner"}, {"request": "x", "subject": ville.Subject, "action": "decline"}, {"request": request, "subject": "unix:1000", "action": "decline"}} {
		if code, _ := call(bad); code != 400 {
			t.Fatalf("bad release %v answered %d", bad, code)
		}
	}
	for _, tc := range []struct{ action, kind, mode string }{{"allow_all", "continue", "tools"}, {"approve_each", "continue", "approve_each"}, {"decline", "declined", ""}} {
		if code, body := call(map[string]string{"request": request, "subject": ville.Subject, "action": tc.action}); code != 200 || !strings.Contains(body, `"state":"held"`) {
			t.Fatalf("%s: %d %s", tc.action, code, body)
		}
		f.deliver(t)
		seen := f.seen()
		line := seen[len(seen)-1]["line"].(map[string]any)
		if seen[len(seen)-1]["op"] != "release" || line["kind"] != tc.kind || line["request"] != request || line["subject"] != ville.Subject || line["display_name"] != "Example Participant" {
			t.Fatalf("%s line: %v", tc.action, line)
		}
		if mode, _ := line["mode"].(string); mode != tc.mode {
			t.Fatalf("%s mode %q", tc.action, mode)
		}
	}
	// A request no longer waiting is answered already: dropped, not retried.
	f.mu.Lock()
	f.reason = "not_waiting"
	f.mu.Unlock()
	call(map[string]string{"request": request, "subject": ville.Subject, "action": "allow_all"})
	f.deliver(t)
	if len(f.held()) != 0 {
		t.Fatal("a release for a settled request stayed held")
	}
	// Off with the feature.
	if err := savePreferences(f.c.cfg.Home, accountPreferences{Engine: "codemirror6", Experimental: map[string]bool{}}); err != nil {
		t.Fatal(err)
	}
	if code, _ := call(map[string]string{"request": request, "subject": ville.Subject, "action": "decline"}); code != 404 {
		t.Fatalf("release with the feature off: %d", code)
	}
}

func TestApprovalQuestionKeepsCompleteArgumentsAndRefusesMalformedOnes(t *testing.T) {
	args := "{\n  \"command\": \"rm -rf build\\nmake\"\n}"
	title := func(v map[string]any) string { b, _ := json.Marshal(v); return approvalPrefix + string(b) }
	good := map[string]any{"call_id": "call_1/2", "tool": "bash", "arguments": args, "parent_call_id": "call_1", "request": "0f8fad5b-d9cb-469f-a165-70867728950e"}
	is, view := approvalRequest("select", title(good), approvalChoices)
	if !is || view == nil || view.Arguments != args || view.ParentCallID != "call_1" {
		t.Fatalf("well formed: %v %+v", is, view)
	}
	long := map[string]any{"call_id": "c", "tool": "write", "arguments": strings.Repeat("ä", maxApprovalArguments)}
	if _, v := approvalRequest("select", title(long), approvalChoices); v == nil || len([]rune(v.Arguments)) != maxApprovalArguments {
		t.Fatal("arguments at the bound were not kept whole")
	}
	for name, tc := range map[string]struct {
		title   string
		options []string
	}{
		"too long":        {title(map[string]any{"call_id": "c", "tool": "write", "arguments": strings.Repeat("x", maxApprovalArguments+1)}), approvalChoices},
		"unknown field":   {title(map[string]any{"call_id": "c", "tool": "t", "arguments": "{}", "html": "x"}), approvalChoices},
		"other choices":   {title(good), []string{"allow", "deny"}},
		"reordered":       {title(good), []string{"deny", "allow", "allow_all"}},
		"control char":    {title(map[string]any{"call_id": "c", "tool": "t", "arguments": "a\x1bb"}), approvalChoices},
		"empty call":      {title(map[string]any{"call_id": "", "tool": "t", "arguments": "{}"}), approvalChoices},
		"bad request":     {title(map[string]any{"call_id": "c", "tool": "t", "arguments": "{}", "request": "x"}), approvalChoices},
		"trailing data":   {title(good) + "{}", approvalChoices},
		"not json":        {approvalPrefix + "nope", approvalChoices},
		"spaced call ids": {title(map[string]any{"call_id": "a b", "tool": "t", "arguments": "{}"}), approvalChoices},
	} {
		if is, v := approvalRequest("select", tc.title, tc.options); !is || v != nil {
			t.Errorf("%s: %v %+v", name, is, v)
		}
	}
	if is, _ := approvalRequest("confirm", title(good), nil); is {
		t.Fatal("a confirm became an approval question")
	}
	if is, _ := approvalRequest("select", "Pick one", approvalChoices); is {
		t.Fatal("an ordinary select became an approval question")
	}
}

// An approval question reaches the owner typed and whole through the event
// translation; only one of its fixed choices answers it, and a malformed one
// is cancelled unseen so the guard blocks the call.
func TestApprovalQuestionThroughController(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	args := "{\n  \"command\": \"rm -rf build\\nmake\"\n}"
	q, _ := json.Marshal(map[string]any{"call_id": "call_1", "tool": "bash", "arguments": args})
	frames := []map[string]any{
		{"type": "extension_ui_request", "id": "appr-bad", "method": "select", "title": approvalPrefix + `{"call_id":"c"}`, "options": approvalChoices},
		{"type": "extension_ui_request", "id": "appr-1", "method": "select", "title": approvalPrefix + string(q), "options": approvalChoices},
	}
	var lines []string
	for _, f := range frames {
		b, _ := json.Marshal(f)
		lines = append(lines, string(b))
	}
	code := fmt.Sprintf(`#!/usr/bin/env python3
import json,sys
frames=%q.split("\n")
for line in sys.stdin:
 r=json.loads(line)
 open(sys.argv[0]+".log","a").write(line)
 if r["type"] == "prompt":
  print(json.dumps(dict(type="response",id=r["id"],command="prompt",success=True)),flush=True)
  for f in frames: print(f,flush=True)
`, strings.Join(lines, "\n"))
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	id := ownershipTestID
	s := &conversation{id: id, rpc: p, state: "idle", commands: map[string]bool{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, journal: newEventJournal()}
	go c.drain(s)
	if accepted, err := p.request("prompt", "start", time.Second); err != nil || !accepted {
		t.Fatalf("prompt: %v %v", accepted, err)
	}
	end := time.Now().Add(2 * time.Second)
	for {
		c.mu.Lock()
		got := s.questionID
		c.mu.Unlock()
		if got == "appr-1" {
			break
		}
		if time.Now().After(end) {
			t.Fatal("approval question not pending")
		}
		time.Sleep(time.Millisecond)
	}
	call := func(request, value string) int {
		body := fmt.Sprintf(`{"request_id":%q,"action":"answer","value":%s}`, request, value)
		req := httptest.NewRequest("POST", AgentConversationsPath+"/"+id+"/question", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.agentConversations(w, req)
		return w.Code
	}
	if code := call("appr-1", `"Salli"`); code != 400 {
		t.Fatalf("an answer outside the choices: %d", code)
	}
	if code := call("appr-bad", `"allow"`); code != 409 {
		t.Fatalf("the malformed question was answerable: %d", code)
	}
	if code := call("appr-1", `"allow"`); code != 200 {
		t.Fatalf("allow: %d", code)
	}
	events, raw := questionEvents(c)
	if len(events) != 1 {
		t.Fatalf("shown questions: %+v", events)
	}
	approval, _ := events[0]["approval"].(map[string]any)
	if events[0]["question_kind"] != "approval" || events[0]["prompt"] != "bash" || approval == nil || approval["arguments"] != args || approval["call_id"] != "call_1" {
		t.Fatalf("typed question: %+v", events[0])
	}
	validateEventFrames(t, raw)
	end = time.Now().Add(2 * time.Second)
	var log string
	for time.Now().Before(end) {
		b, _ := os.ReadFile(script + ".log")
		if log = string(b); strings.Count(log, "extension_ui_response") == 2 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	for _, want := range []string{`{"cancelled":true,"id":"appr-bad","type":"extension_ui_response"}`, `{"id":"appr-1","type":"extension_ui_response","value":"allow"}`} {
		if !strings.Contains(log, want) {
			t.Fatalf("Pi did not receive %s:\n%s", want, log)
		}
	}
}
