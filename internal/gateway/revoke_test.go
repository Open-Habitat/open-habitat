package gateway

import (
	"context"
	"net/http"
	"sync"
	"testing"
)

func TestRevokeSubjectIsolationAndFlowCutoff(t *testing.T) {
	h, a, p, _, _ := fixture(t)
	state, flow := start(t, h)
	old := callback(h, state, flow).Result().Cookies()[1]
	a.mu.Lock()
	a.conversations = map[string]map[string]bool{old.Value: {"synthetic": true}}
	a.mu.Unlock()
	state2, flow2 := start(t, h)
	// Two subjects share the gateway; the other subject remains authorized.
	p.id = "43"
	p.login = "bob"
	other := callback(h, state2, flow2).Result().Cookies()[1]
	state3, flow3 := start(t, h)
	if err := a.RevokeSubject(context.Background(), "42"); err != nil {
		t.Fatal(err)
	}
	if request(h, "GET", "/auth/session", old).Code != http.StatusUnauthorized {
		t.Fatal("old cookie survived")
	}
	a.mu.Lock()
	_, grant := a.conversations[old.Value]
	a.mu.Unlock()
	if grant {
		t.Fatal("conversation authorization survived")
	}
	if request(h, "GET", "/auth/session", other).Code != http.StatusOK {
		t.Fatal("other subject removed")
	}
	p.id = "42"
	p.login = "alice"
	if callback(h, state3, flow3).Code == http.StatusSeeOther {
		t.Fatal("anonymous pending flow survived")
	}
	state4, flow4 := start(t, h)
	fresh := callback(h, state4, flow4)
	if fresh.Code != http.StatusSeeOther {
		t.Fatalf("new flow: %d", fresh.Code)
	}
	if request(h, "GET", "/auth/session", fresh.Result().Cookies()[1]).Code != http.StatusOK {
		t.Fatal("new cookie denied")
	}
	if err := a.RevokeSubject(context.Background(), "43"); err != nil {
		t.Fatal(err)
	}
	if request(h, "GET", "/auth/session", other).Code != http.StatusUnauthorized {
		t.Fatal("other cookie survived own revocation")
	}
	if request(h, "GET", "/auth/session", fresh.Result().Cookies()[1]).Code != http.StatusOK {
		t.Fatal("wrong subject revoked")
	}
	if callback(h, state3, flow3).Code == http.StatusSeeOther {
		t.Fatal("callback replay")
	}
}

type blockedSink struct {
	entered, release chan struct{}
	once             sync.Once
}

func (s *blockedSink) Deliver(context.Context, Identity, string, string) error {
	s.once.Do(func() { close(s.entered) })
	<-s.release
	return nil
}

func TestRevokeDuringHandoff(t *testing.T) {
	h, a, _, _, _ := fixture(t)
	sink := &blockedSink{entered: make(chan struct{}), release: make(chan struct{})}
	a.sink = sink
	state, flow := start(t, h)
	done := make(chan *http.Response, 1)
	go func() { done <- callback(h, state, flow).Result() }()
	<-sink.entered
	if err := a.RevokeSubject(context.Background(), "42"); err != nil {
		t.Fatal(err)
	}
	close(sink.release)
	result := <-done
	if result.StatusCode == http.StatusSeeOther {
		t.Fatal("session issued after revoke during handoff")
	}
}

func TestRevokeFailClosedAndRestart(t *testing.T) {
	h, a, _, _, _ := fixture(t)
	state, flow := start(t, h)
	old := callback(h, state, flow).Result().Cookies()[1]
	for _, id := range []string{"0", "+42", "042", "-42", "44"} {
		if a.RevokeSubject(context.Background(), id) == nil {
			t.Fatalf("accepted %q", id)
		}
	}
	a.broker.(*fakeBroker).fail = true
	if a.RevokeSubject(context.Background(), "42") == nil {
		t.Fatal("broker failure accepted")
	}
	a.broker.(*fakeBroker).fail = false
	if request(h, "GET", "/auth/session", old).Code != http.StatusOK {
		t.Fatal("wrong subject revoked")
	}
	newH, _, _, _, _ := fixture(t)
	if request(newH, "GET", "/auth/session", old).Code != http.StatusUnauthorized {
		t.Fatal("session survived restart")
	}
}
