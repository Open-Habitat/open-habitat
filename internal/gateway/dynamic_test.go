package gateway

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type stoppingSink struct {
	entered chan struct{}
	resume  chan struct{}
	calls   atomic.Int32
	fail    bool
}

func (s *stoppingSink) Deliver(ctx context.Context, _ Identity, _ string, _ string) (Handoff, error) {
	s.calls.Add(1)
	close(s.entered)
	select {
	case <-s.resume:
	case <-ctx.Done():
		return "", ctx.Err()
	}
	if s.fail {
		return "", errors.New("ack lost")
	}
	return HandoffInUse, nil
}
func TestCallbackRechecksAfterHandoff(t *testing.T) {
	for _, tc := range []string{"revoke", "epoch", "binding", "outage", "lost-ack"} {
		t.Run(tc, func(t *testing.T) {
			h, a, _, _, _ := fixture(t)
			b := a.broker.(*fakeBroker)
			sink := &stoppingSink{entered: make(chan struct{}), resume: make(chan struct{}), fail: tc == "lost-ack"}
			a.sink = sink
			state, flow := start(t, h)
			done := make(chan int, 1)
			go func() { done <- callback(h, state, flow).Code }()
			<-sink.entered
			b.mu.Lock()
			switch tc {
			case "revoke":
				delete(b.routes, "42")
			case "epoch":
				b.epoch++
			case "binding":
				v := b.routes["42"]
				v.UID = 2000
				b.routes["42"] = v
			case "outage":
				b.fail = true
			}
			b.mu.Unlock()
			close(sink.resume)
			if code := <-done; code == 303 {
				t.Fatal("issued after changed authorization or uncertain handoff")
			}
			if sink.calls.Load() != 1 || len(a.sessions) != 0 {
				t.Fatal("token retried or session issued")
			}
			if callback(h, state, flow).Code == 303 {
				t.Fatal("flow replayed")
			}
		})
	}
}
func TestParallelCallbacksOneStateOnly(t *testing.T) {
	h, _, _, sink, _ := fixture(t)
	state, flow := start(t, h)
	const count = 16
	var wg sync.WaitGroup
	codes := make(chan int, count)
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); codes <- callback(h, state, flow).Code }()
	}
	wg.Wait()
	close(codes)
	successes := 0
	for c := range codes {
		if c == 303 {
			successes++
		}
	}
	if successes != 1 || sink.calls != 1 {
		t.Fatalf("successes=%d handoffs=%d", successes, sink.calls)
	}
}

func TestConcurrentSessionRequestsAndUnrelatedProvision(t *testing.T) {
	h, a, _, _, _ := fixture(t)
	a.now = time.Now
	state, flow := start(t, h)
	cb := callback(h, state, flow)
	if cb.Code != 303 {
		t.Fatal(cb.Code)
	}
	cookie := cb.Result().Cookies()[1]
	b := a.broker.(*fakeBroker)
	b.mu.Lock()
	b.generation++
	b.mu.Unlock() // another user's first login is not a revocation
	const n = 16
	var wg sync.WaitGroup
	outcomes := make(chan int, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); outcomes <- request(h, "GET", "/auth/session", cookie).Code }()
	}
	wg.Wait()
	close(outcomes)
	for code := range outcomes {
		if code != 200 {
			t.Fatalf("valid concurrent request: %d", code)
		}
	}
}

// Login authorizes once. Policy edits and broker outages do not invalidate a
// live session; only explicit revocation, logout and expiry do.
func TestSessionAuthorizationOnlyAtLogin(t *testing.T) {
	h, a, _, _, _ := fixture(t)
	b := a.broker.(*fakeBroker)
	var mu sync.Mutex
	calls := map[string]int{}
	b.hook = func(r BrokerRequest) { mu.Lock(); calls[r.Operation]++; mu.Unlock() }
	state, flow := start(t, h)
	cb := callback(h, state, flow)
	if cb.Code != 303 {
		t.Fatal(cb.Code)
	}
	cookie := cb.Result().Cookies()[1]
	mu.Lock()
	if calls["ensure"] != 1 || calls["authorize"] != 1 {
		t.Fatalf("login calls: %v", calls)
	}
	mu.Unlock()
	b.mu.Lock()
	b.epoch++
	delete(b.routes, "42")
	b.fail = true
	b.mu.Unlock()
	for i := 0; i < 5; i++ {
		if code := request(h, "GET", "/auth/session", cookie).Code; code != 200 {
			t.Fatalf("live session: %d", code)
		}
	}
	mu.Lock()
	defer mu.Unlock()
	if calls["authorize"] != 1 || calls["ensure"] != 1 {
		t.Fatalf("live session called broker: %v", calls)
	}
}
