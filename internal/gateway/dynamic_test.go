package gateway

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestBrokerRevokesExistingSessions(t *testing.T) {
	for _, tc := range []string{"revoked", "outage", "epoch", "generation rollback", "uid", "socket"} {
		t.Run(tc, func(t *testing.T) {
			h, a, _, _, _ := fixture(t)
			b := a.broker.(*fakeBroker)
			state, flow := start(t, h)
			cb := callback(h, state, flow)
			if cb.Code != http.StatusSeeOther {
				t.Fatal(cb.Code)
			}
			cookie := cb.Result().Cookies()[1]
			if request(h, "GET", "/auth/session", cookie).Code != 200 {
				t.Fatal("initial session denied")
			}
			b.mu.Lock()
			switch tc {
			case "revoked":
				delete(b.routes, "42")
			case "outage":
				b.fail = true
			case "epoch":
				b.epoch++
			case "generation rollback":
				b.generation = 0
			case "uid":
				v := b.routes["42"]
				v.UID++
				b.routes["42"] = v
			case "socket":
				v := b.routes["42"]
				v.Socket = "/tmp/attacker"
				b.routes["42"] = v
			}
			b.mu.Unlock()
			for _, path := range []string{"/auth/session", "/api/v1/snapshot"} {
				r := httptest.NewRequest("GET", "https://host.test"+path, nil)
				r.RequestURI = r.URL.RequestURI()
				r.AddCookie(cookie)
				w := httptest.NewRecorder()
				h.ServeHTTP(w, r)
				if got := w.Code; got != 401 {
					t.Fatalf("%s: %d", path, got)
				}
			}
		})
	}
}

type stoppingSink struct {
	entered chan struct{}
	resume  chan struct{}
	calls   atomic.Int32
	fail    bool
}

func (s *stoppingSink) Deliver(ctx context.Context, _ Identity, _ string, _ string) error {
	s.calls.Add(1)
	close(s.entered)
	select {
	case <-s.resume:
	case <-ctx.Done():
		return ctx.Err()
	}
	if s.fail {
		return errors.New("ack lost")
	}
	return nil
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

type barrierBroker struct {
	base    *fakeBroker
	entered chan struct{}
	resume  chan struct{}
	count   atomic.Int32
}

func (b *barrierBroker) Exchange(ctx context.Context, r BrokerRequest) (BrokerReply, error) {
	if r.Operation == "authorize" && b.count.Add(1) <= 2 {
		b.entered <- struct{}{}
		select {
		case <-b.resume:
		case <-ctx.Done():
			return BrokerReply{}, ctx.Err()
		}
	}
	return b.base.Exchange(ctx, r)
}
func TestSimultaneousBrokerSessionRechecks(t *testing.T) {
	h, a, _, _, _ := fixture(t)
	a.now = time.Now
	state, flow := start(t, h)
	cb := callback(h, state, flow)
	if cb.Code != 303 {
		t.Fatal(cb.Code)
	}
	cookie := cb.Result().Cookies()[1]
	base := a.broker.(*fakeBroker)
	barrier := &barrierBroker{base: base, entered: make(chan struct{}, 2), resume: make(chan struct{})}
	a.broker = barrier
	codes := make(chan int, 2)
	for i := 0; i < 2; i++ {
		go func() { codes <- request(h, "GET", "/auth/session", cookie).Code }()
	}
	<-barrier.entered
	<-barrier.entered
	close(barrier.resume)
	for i := 0; i < 2; i++ {
		if code := <-codes; code != 200 {
			t.Fatalf("concurrent broker recheck: %d", code)
		}
	}
}
