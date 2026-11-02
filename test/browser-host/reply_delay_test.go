package main

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"
)

func TestReplyDelaySchedule(t *testing.T) {
	seen := map[time.Duration]bool{}
	changed := false
	for n := uint64(0); n < 100; n++ {
		d := replyDelay("replay", "GET /api/status", n, 250)
		if d < 0 || d > 250*time.Millisecond || d != replyDelay("replay", "GET /api/status", n, 250) {
			t.Fatal(d)
		}
		seen[d] = true
		changed = changed || d != replyDelay("other", "GET /api/status", n, 250)
	}
	if len(seen) < 2 || !changed {
		t.Fatal("schedule does not vary")
	}
}

func TestReplyDelayBypassAndCancellation(t *testing.T) {
	t.Setenv("OH_REPLY_DELAY_MS", "60000")
	t.Setenv("OH_REPLY_SEED", "test")
	delay := replyDelayFromEnv()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	for _, path := range []string{"/api/v1/events", "/fixture/scenario", "/"} {
		if !delay(nil, httptest.NewRequest("GET", path, nil).WithContext(ctx)) {
			t.Fatal(path)
		}
	}
	if delay(nil, httptest.NewRequest("GET", "/api/v1/snapshot", nil).WithContext(ctx)) {
		t.Fatal("ignored cancellation")
	}
	t.Setenv("OH_REPLY_DELAY_MS", "0")
	if !replyDelayFromEnv()(nil, httptest.NewRequest("GET", "/api/v1/snapshot", nil).WithContext(ctx)) {
		t.Fatal("default adds delay")
	}
}
