package daemon

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

// The scripted Pi keeps its queue as Pi's session does: a message leaves the
// list when it starts in the conversation, and one the loop has already pulled
// for its next turn is still listed, so a clear reports it and Pi delivers it
// anyway. Steers starting with "!" drive the script and are never queued.
func TestStopClearReturnsDeliveredUnansweredOnce(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	code := `#!/usr/bin/env python3
import json,sys
q=[]
pulled=[]
settle_after=False
def out(v): print(json.dumps(v),flush=True)
def deliver(text): out(dict(type="message_start",message=dict(role="user",content=[dict(type="text",text=text)])))
for line in sys.stdin:
 r=json.loads(line)
 m=r.get("message","")
 if r["type"]=="steer" and m.startswith("!deliver:"):
  q.remove(m[9:]); out(dict(type="queue_update",steering=q,followUp=[])); deliver(m[9:])
 elif r["type"]=="steer" and m.startswith("!pull:"):
  pulled.append(m[6:])
 elif r["type"]=="steer" and m=="!settle-after-clear":
  settle_after=True
 elif r["type"]=="steer" and m.startswith("!take:"):
  q.remove(m[6:]); out(dict(type="queue_update",steering=q,followUp=[])); pulled.append(m[6:])
 elif r["type"]=="steer" and m.startswith("!emit:"):
  print(m[6:],flush=True)
 elif r["type"]=="steer":
  q.append(m); out(dict(type="queue_update",steering=q,followUp=[]))
 if r["type"]=="clear_queue":
  result=dict(steering=q,followUp=[]); q=[]
  out(dict(type="queue_update",steering=q,followUp=[]))
  out(dict(type="response",id=r["id"],command=r["type"],success=True,data=result))
  for text in pulled: deliver(text)
  pulled=[]
  if settle_after: out(dict(type="agent_settled",aborted=False)); settle_after=False
 else:
  out(dict(type="response",id=r["id"],command=r["type"],success=True))
`
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	id := ownershipTestID
	s := &conversation{id: id, rpc: p, state: "accepted", commands: map[string]bool{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}}
	go c.drain(s)
	n := 0
	steer := func(text string) {
		t.Helper()
		n++
		body := fmt.Sprintf(`{"message":%q,"command_id":"12345678-1234-4123-8123-%012d"}`, text, n)
		req := httptest.NewRequest("POST", "http://unix/steer", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.sendKind(w, req, id, "steer")
		if w.Code != 200 {
			t.Fatalf("steer %q: %d %s", text, w.Code, w.Body.String())
		}
		for deadline := time.Now().Add(2 * time.Second); time.Now().Before(deadline); time.Sleep(time.Millisecond) {
			c.mu.Lock()
			ack := s.ack
			c.mu.Unlock()
			if ack == "accepted" {
				return
			}
		}
		t.Fatalf("steer %q not acknowledged", text)
	}
	type reply struct {
		Removed struct {
			Steering []string `json:"steering"`
			FollowUp []string `json:"follow_up"`
		} `json:"removed_queue"`
		Unanswered *[]string `json:"unanswered"`
	}
	clear := func(body string) reply {
		t.Helper()
		n++
		req := httptest.NewRequest("POST", "http://unix/clear_queue", strings.NewReader(fmt.Sprintf(body, fmt.Sprintf("12345678-1234-4123-8123-%012d", n))))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.clearQueue(w, req, id)
		var r reply
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &r) != nil {
			t.Fatalf("clear: %d %s", w.Code, w.Body.String())
		}
		return r
	}
	settle := func() {
		t.Helper()
		// Events after the clear's reply are drained before this barrier's reply.
		steer("!emit:" + `{"type":"queue_update","steering":[],"followUp":[]}`)
	}

	// Delivered just before the Stop, no model output: Pi's queue is empty,
	// and the delivered message comes back. An aborted response is no output.
	steer("eka")
	steer("toka")
	steer("!deliver:eka")
	steer("!emit:" + `{"type":"message_update","message":{"role":"assistant"},"assistantMessageEvent":{"type":"start"}}`)
	steer("!emit:" + `{"type":"message_update","message":{"role":"assistant"},"assistantMessageEvent":{"type":"error","reason":"aborted"}}`)
	steer("!emit:" + `{"type":"message_end","message":{"role":"assistant","content":[],"stopReason":"aborted"}}`)
	// "kolmas" is pulled for the next turn: the clear still lists it, and Pi
	// delivers it after the clear. It comes back once, as a removed message.
	steer("kolmas")
	steer("!pull:kolmas")
	got := clear(`{"command_id":%q,"unanswered":true}`)
	if !reflect.DeepEqual(got.Removed.Steering, []string{"toka", "kolmas"}) || got.Unanswered == nil || !reflect.DeepEqual(*got.Unanswered, []string{"eka"}) {
		t.Fatalf("stop clear: %+v unanswered=%v", got.Removed, got.Unanswered)
	}
	settle()
	if again := clear(`{"command_id":%q,"unanswered":true}`); len(again.Removed.Steering) != 0 || len(*again.Unanswered) != 0 {
		t.Fatalf("texts returned twice: %+v %v", again.Removed, *again.Unanswered)
	}

	// Any model output answers a delivered message: it stays where it is.
	steer("neljäs")
	steer("!deliver:neljäs")
	steer("!emit:" + `{"type":"message_update","message":{"role":"assistant"},"assistantMessageEvent":{"type":"thinking_delta","delta":"x"}}`)
	if got := clear(`{"command_id":%q,"unanswered":true}`); len(*got.Unanswered) != 0 {
		t.Fatalf("answered message returned: %v", *got.Unanswered)
	}

	// The queue's own restore keeps its reply: no unanswered list, and a
	// delivered message is not taken by it.
	steer("viides")
	steer("!deliver:viides")
	settle()
	if got := clear(`{"command_id":%q}`); got.Unanswered != nil {
		t.Fatalf("plain clear carried unanswered: %v", *got.Unanswered)
	}
	if got := clear(`{"command_id":%q,"unanswered":true}`); !reflect.DeepEqual(*got.Unanswered, []string{"viides"}) {
		t.Fatalf("stop after plain clear: %v", *got.Unanswered)
	}

	// Pi took it off its queue and is still in its extension hooks when the
	// clear comes: the queue is empty and the delivery follows the reply.
	steer("seitsemäs")
	steer("!take:seitsemäs")
	if got := clear(`{"command_id":%q,"unanswered":true}`); len(got.Removed.Steering) != 0 || !reflect.DeepEqual(*got.Unanswered, []string{"seitsemäs"}) {
		t.Fatalf("taken before the clear: %+v %v", got.Removed, *got.Unanswered)
	}
	settle()
	if got := clear(`{"command_id":%q,"unanswered":true}`); len(*got.Unanswered) != 0 {
		t.Fatalf("taken message returned twice: %v", *got.Unanswered)
	}

	// The run settles right after Pi answers the Stop's clear: the clear is
	// reconciled first, at its place in Pi's order.
	steer("kahdeksas")
	steer("!deliver:kahdeksas")
	steer("!settle-after-clear")
	if got := clear(`{"command_id":%q,"unanswered":true}`); !reflect.DeepEqual(*got.Unanswered, []string{"kahdeksas"}) {
		t.Fatalf("settled after the clear: %v", *got.Unanswered)
	}
	for deadline := time.Now().Add(2 * time.Second); ; time.Sleep(time.Millisecond) {
		c.mu.Lock()
		done := s.settled
		if done {
			s.state, s.settled = "accepted", false // the next run
		}
		c.mu.Unlock()
		if done {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("run did not settle")
		}
	}

	// A settled run ends what can still be unanswered.
	steer("kuudes")
	steer("!deliver:kuudes")
	steer("!emit:" + `{"type":"agent_settled","aborted":true}`)
	if got := clear(`{"command_id":%q,"unanswered":true}`); len(*got.Unanswered) != 0 {
		t.Fatalf("settled run returned: %v", *got.Unanswered)
	}
	if p.overflow.Load() {
		t.Fatal("transport poisoned")
	}
}

func TestWrittenTextUndoesAttachmentPaths(t *testing.T) {
	home := "/home/person"
	ref := "0d6f3b1e-6b55-4bcd-9a39-6f1f0c4b8a21"
	written := "katso tämä ![kuva](/api/v1/attachments/" + ref + ") ja /api/v1/attachments/" + ref
	expanded := written + "\nAttachment path: " + filepath.Join(home, "attachments", ref)
	if got := writtenText(home, expanded); got != written {
		t.Fatalf("expanded: %q", got)
	}
	if got := writtenText(home, written); got != written {
		t.Fatalf("unexpanded changed: %q", got)
	}
	if got := writtenText(home, "pelkkä teksti"); got != "pelkkä teksti" {
		t.Fatalf("plain: %q", got)
	}
	// Pi's queue as the page matches it against its own messages.
	if got := writtenTexts(home, []string{expanded, "pelkkä teksti"}); len(got) != 2 || got[0] != written || got[1] != "pelkkä teksti" {
		t.Fatalf("queue: %q", got)
	}
	if got := writtenTexts(home, nil); got == nil || len(got) != 0 {
		t.Fatalf("empty queue: %#v", got)
	}
}

// The clear's reply and Pi's later delivery of a pulled message reach the
// daemon on different goroutines; either order returns the text once.
func TestClearAndLateDeliveryInEitherOrder(t *testing.T) {
	user := func(text string) json.RawMessage {
		raw, _ := json.Marshal(map[string]any{"type": "message_start", "message": map[string]any{"role": "user", "content": []map[string]string{{"type": "text", "text": text}}}})
		return raw
	}
	for _, deliveryFirst := range []bool{true, false} {
		s := &conversation{queueSteering: []string{"x"}}
		noteQueueTaken(s, []string{}, []string{})
		s.queueSteering = []string{}
		var unanswered []string
		if deliveryFirst {
			noteQueueDelivery(s, "message_start", user("x"))
			unanswered = noteClear(s, []string{"x"}, true)
		} else {
			unanswered = noteClear(s, []string{"x"}, true)
			noteQueueDelivery(s, "message_start", user("x"))
		}
		if len(unanswered) != 0 || len(s.unanswered) != 0 || len(s.queueCleared) != 0 {
			t.Fatalf("delivery first=%v: returned %v, left %v cleared %v", deliveryFirst, unanswered, s.unanswered, s.queueCleared)
		}
	}
	// Taken by Pi for delivery, not by the clear: back once, before or
	// after its delivery reaches the daemon.
	for _, deliveryFirst := range []bool{true, false} {
		s := &conversation{queueSteering: []string{"y"}}
		noteQueueTaken(s, []string{}, []string{})
		s.queueSteering = []string{}
		var got []string
		if deliveryFirst {
			noteQueueDelivery(s, "message_start", user("y"))
			got = noteClear(s, []string{}, true)
		} else {
			got = noteClear(s, []string{}, true)
			noteQueueDelivery(s, "message_start", user("y"))
		}
		if !reflect.DeepEqual(got, []string{"y"}) || len(s.unanswered) != 0 || len(noteClear(s, []string{}, true)) != 0 {
			t.Fatalf("delivery first=%v: returned %v, left %v", deliveryFirst, got, s.unanswered)
		}
	}
}
