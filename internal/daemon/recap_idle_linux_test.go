//go:build linux

package daemon

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestAutomaticRecapIdleGateAcrossTabsAndActivity(t *testing.T) {
	id := "11111111-1111-4111-8111-111111111111"
	s := &conversation{id: id, state: "idle", settled: true, rpc: &piRPC{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, recapIdleDelay: 20 * time.Millisecond}
	entered := make(chan struct{}, 4)
	release := make(chan struct{})
	var calls atomic.Int32
	c.recapGenerator = func(_ *conversation, trigger string, epoch uint64) bool {
		if trigger != "automatic" {
			t.Errorf("unexpected trigger %q", trigger)
		}
		calls.Add(1)
		entered <- struct{}{}
		<-release
		return true
	}
	c.mu.Lock()
	c.scheduleAutomaticRecap(s)
	c.noteRecapActivity(s) // a new native message/queue item cancels the old idle period
	s.state = "accepted"
	c.mu.Unlock()
	select {
	case <-entered:
		t.Fatal("recap started during running turn")
	case <-time.After(50 * time.Millisecond):
	}
	c.mu.Lock()
	s.state = "idle"
	c.scheduleAutomaticRecap(s)
	c.noteRecapActivity(s) // queued native activity resets the idle clock, not the eligibility
	c.mu.Unlock()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("idle period never triggered recap")
	}
	// A second tab sees the same per-session in-flight guard, not another call.
	second := httptest.NewRecorder()
	c.requestRecap(second, httptest.NewRequest(http.MethodPost, "http://unix/recap", nil), id)
	if second.Code != 409 {
		t.Fatalf("concurrent tab: %d", second.Code)
	}
	close(release)
	c.mu.Lock()
	c.noteRecapActivity(s)
	if s.recapTimer != nil {
		s.recapTimer.Stop()
	}
	c.mu.Unlock()
	if calls.Load() != 1 {
		t.Fatalf("automatic requests = %d", calls.Load())
	}
}

// The browser hides a recap that later messages outdated and relies on this
// daemon to replace it: each later settled turn earns one more idle recap.
func TestOutdatedAutomaticRecapIsRegeneratedAfterNextIdle(t *testing.T) {
	s := &conversation{id: "11111111-1111-4111-8111-111111111111", state: "idle", settled: true, rpc: &piRPC{}}
	c := &ConversationController{sessions: map[string]*conversation{s.id: s}, recapIdleDelay: 20 * time.Millisecond}
	called := make(chan string, 4)
	c.recapGenerator = func(_ *conversation, trigger string, _ uint64) bool { called <- trigger; return true }
	wait := func(what string) {
		t.Helper()
		select {
		case trigger := <-called:
			if trigger != "automatic" {
				t.Fatalf("%s: trigger %q", what, trigger)
			}
		case <-time.After(time.Second):
			t.Fatalf("%s: no automatic recap", what)
		}
	}
	c.mu.Lock()
	c.scheduleAutomaticRecap(s)
	c.mu.Unlock()
	wait("first idle period")
	// The agent continues on its own (a process wake), then settles again.
	c.mu.Lock()
	s.state, s.settled = "accepted", false
	c.noteRecapActivity(s)
	c.mu.Unlock()
	select {
	case <-called:
		t.Fatal("recap during the later turn")
	case <-time.After(60 * time.Millisecond):
	}
	c.mu.Lock()
	s.state, s.settled = "idle", true
	s.recapLastActivity = time.Now()
	c.scheduleAutomaticRecap(s)
	c.mu.Unlock()
	wait("idle period after the later turn")
}

func TestRejectedCommandDoesNotRestartNativeIdleClock(t *testing.T) {
	s := &conversation{id: "11111111-1111-4111-8111-111111111111", state: "rejected", settled: true, rpc: &piRPC{}}
	c := &ConversationController{sessions: map[string]*conversation{s.id: s}, recapIdleDelay: 50 * time.Millisecond}
	s.recapLastActivity = time.Now().Add(-time.Second)
	called := make(chan struct{}, 1)
	c.recapGenerator = func(_ *conversation, _ string, _ uint64) bool { called <- struct{}{}; return true }
	c.mu.Lock()
	c.scheduleAutomaticRecap(s)
	c.mu.Unlock()
	select {
	case <-called:
	case <-time.After(time.Second):
		t.Fatal("rejected browser action postponed native idle recap")
	}
}

func TestRecapNativeTriggerProjection(t *testing.T) {
	parent := "assistant1"
	entry := nativeEntry{ID: "recap1", ParentID: &parent, Type: "custom", Raw: []byte(`{"type":"custom","id":"recap1","parentId":"assistant1","customType":"conversation-recap","data":{"recap":"Done","next":"Check","generatedAt":1750000000000,"trigger":"automatic"}}`)}
	projected := nativeBlocks(entry)
	if projected.Recap == nil || projected.Recap.Trigger != "automatic" {
		t.Fatalf("projection: %+v", projected.Recap)
	}
}
