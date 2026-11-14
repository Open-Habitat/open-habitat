//go:build linux

package daemon

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestConversationRecordsCreateStopBeyondCeiling(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	var first, recent string
	for i := 0; i < maxConversationRecords+2; i++ {
		id := h.create(c)
		if i == 0 {
			first = id
		}
		h.eventually("ready", func() bool { _, s := h.status(c, id); return s.State == "idle" })
		w := h.post(func(w http.ResponseWriter, r *http.Request) { c.stop(w, r, id) }, "")
		if w.Code != 200 {
			t.Fatalf("stop: %d %s", w.Code, w.Body.String())
		}
		h.eventually("reaped tombstone", func() bool {
			c.mu.Lock()
			defer c.mu.Unlock()
			s := c.sessions[id]
			return s.dead && s.state == "stopped"
		})
		recent = id
	}
	h.create(c)
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.sessions) != maxConversationRecords || c.sessions[first] != nil || c.sessions[recent] == nil {
		t.Fatalf("records=%d oldest=%v recent=%v", len(c.sessions), c.sessions[first] != nil, c.sessions[recent] != nil)
	}
}

func TestConversationRecordsEvictionProtectsWorkAndRecentReceipts(t *testing.T) {
	c := &ConversationController{sessions: make(map[string]*conversation), started: time.Now().UnixMilli()}
	for i := 0; i < maxConversationRecords; i++ {
		id := fmt.Sprint(i)
		c.sessions[id] = &conversation{id: id, dead: true, state: "stopped", rpc: stoppedRPC(), stoppedAt: time.Unix(int64(i), 0), waitChecked: true}
	}
	last := fmt.Sprint(maxConversationRecords - 1)
	c.sessions["0"].dead = false       // watcher has not finalized the reap
	c.sessions["1"].state = "starting" // a pending retry has no child yet
	c.sessions["2"].held = []heldMessage{{id: "held", text: "do not lose"}}
	c.sessions["3"].bash = &bashRun{state: "held"}
	c.sessions["4"].rpc = &piRPC{exited: make(chan struct{})} // not reaped
	c.sessions["5"].waitChecked = false
	c.sessions["5"].stopCause = "crash" // automatic wake still owes this a check
	c.sessions[last].receipts = map[string]string{"recent": "accepted"}
	c.mu.Lock()
	ok := c.makeRecordRoom()
	c.mu.Unlock()
	if !ok || len(c.sessions) != maxConversationRecords-1 || c.sessions["6"] != nil {
		t.Fatal("did not evict oldest eligible tombstone")
	}
	for _, id := range []string{"0", "1", "2", "3", "4", "5"} {
		if c.sessions[id] == nil {
			t.Fatalf("evicted protected %s", id)
		}
	}
	if c.sessions[last].receipts["recent"] != "accepted" {
		t.Fatal("lost recent receipt")
	}
}

func TestConversationRecordsResumeEvictedHandle(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.converse(c, id, "before eviction", activityCommand(1))
	h.quiescent(c, id)
	w := h.post(func(w http.ResponseWriter, r *http.Request) { c.stop(w, r, id) }, "")
	if w.Code != 200 {
		t.Fatalf("stop: %d %s", w.Code, w.Body.String())
	}
	h.eventually("reaped", func() bool { c.mu.Lock(); defer c.mu.Unlock(); return c.sessions[id].dead })
	c.mu.Lock()
	old := c.sessions[id]
	old.stoppedAt = time.Unix(1, 0)
	for i := 0; i < maxConversationRecords-1; i++ {
		key := fmt.Sprint(i)
		c.sessions[key] = &conversation{id: key, dead: true, state: "stopped", rpc: stoppedRPC(), stoppedAt: time.Unix(2, 0), waitChecked: true}
	}
	ok := c.makeRecordRoom()
	c.mu.Unlock()
	if !ok {
		t.Fatal("no room")
	}
	s, problem := c.resume(id, old, startWake)
	if problem != "" || s == nil {
		t.Fatalf("resume evicted handle: %s", problem)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.sessions) != maxConversationRecords || c.sessions[id] != s || s.receipts[activityCommand(1)] != "accepted" {
		t.Fatal("resume lost receipt or exceeded bound")
	}
}

func TestConversationRecordsExhaustionIsNotLiveLimit(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	c.mu.Lock()
	for i := 0; i < maxConversationRecords; i++ {
		id := fmt.Sprint(i)
		c.sessions[id] = &conversation{id: id, dead: true, state: "start_failed", rpc: stoppedRPC(), held: []heldMessage{{text: "unsent"}}}
	}
	c.mu.Unlock()
	w := h.post(c.create, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace))
	if w.Code != 429 || !strings.Contains(w.Body.String(), `"session_records_exhausted"`) {
		t.Fatalf("create: %d %s", w.Code, w.Body.String())
	}
}
