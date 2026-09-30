//go:build linux

package daemon

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/user"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
)

func TestEventJournalReplayAndErrors(t *testing.T) {
	j := newEventJournal()
	if j.instance == "" {
		t.Fatal("instance")
	}
	zero, _ := j.watermark()
	j.appendInvalidation("pi:12345678-1234-1234-1234-123456789012")
	first, _ := j.watermark()
	j.appendInvalidation("")
	for _, tc := range []struct{ cursor, code string }{
		{"ev1:00000000-0000-4000-8000-000000000001:0", "cursor_instance_mismatch"},
		{"invalid", "invalid_request"}, {j.cursor(999), "invalid_request"},
		{first, ""}, {zero, ""},
	} {
		_, code := j.parse(tc.cursor)
		if code != tc.code {
			t.Errorf("%s: got %s want %s", tc.cursor, code, tc.code)
		}
	}
	for n := 0; n < eventWindowCount+1; n++ {
		j.appendInvalidation("")
	}
	_, code := j.parse(zero)
	if code != "cursor_expired" {
		t.Fatalf("expired: %s", code)
	}
	r := httptest.NewRequest("GET", "http://unix/api/v1/events?after="+zero, nil)
	w := httptest.NewRecorder()
	j.stream(w, r, func() bool { return true }, func() bool { return true })
	if w.Code != 409 || !strings.Contains(w.Body.String(), "cursor_expired") || strings.Contains(w.Header().Get("Content-Type"), "event-stream") {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestEventJournalNativeBurstHasTrailingInvalidation(t *testing.T) {
	j := newEventJournal()
	before, _ := j.watermark()
	for i := 0; i < 300; i++ {
		j.invalidateNative()
	}
	deadline := time.After(time.Second)
	for {
		j.mu.Lock()
		cursor, changed := j.cursor(j.seq), j.changed
		j.mu.Unlock()
		if cursor != before {
			break
		}
		select {
		case <-changed:
		case <-deadline:
			t.Fatal("missing trailing invalidation")
		}
	}
	j.mu.Lock()
	count := j.seq
	j.mu.Unlock()
	if count != 1 {
		t.Fatalf("burst produced %d events", count)
	}
	j.invalidateNative()
	deadline = time.After(time.Second)
	for {
		j.mu.Lock()
		seq := j.seq
		changed := j.changed
		j.mu.Unlock()
		if seq == 2 {
			break
		}
		select {
		case <-changed:
		case <-deadline:
			t.Fatal("last native change was suppressed")
		}
	}
}

func TestEventStreamExactReplayAndLastEventID(t *testing.T) {
	j := newEventJournal()
	zero, _ := j.watermark()
	j.appendInvalidation("")
	first, _ := j.watermark()
	j.appendInvalidation("")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		j.stream(w, r, func() bool { return r.Context().Err() == nil }, func() bool { return true })
	}))
	defer server.Close()
	for _, tc := range []struct {
		last string
		want uint64
	}{{"", 1}, {first, 2}} {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		req, _ := http.NewRequestWithContext(ctx, "GET", server.URL+"/api/v1/events?after="+zero, nil)
		req.Host = "unix"
		if tc.last != "" {
			req.Header.Set("Last-Event-ID", tc.last)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			cancel()
			t.Fatal(err)
		}
		scanner := bufio.NewScanner(res.Body)
		if !scanner.Scan() {
			t.Fatal("no replay frame")
		}
		if got := scanner.Text(); got != "id: "+j.cursor(tc.want) {
			t.Fatalf("replay %q", got)
		}
		_ = res.Body.Close()
		cancel()
	}
}

func TestSnapshotWatermarkPrecedesConcurrentNativeChange(t *testing.T) {
	j := newEventJournal()
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, _ := strconv.Atoi(u.Uid)
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: "123", Home: u.HomeDir}
	// The snapshot constructor captures the watermark before discovery, even if
	// the native event arrives while discovery is still constructing the image.
	discover := func(transport.Config) Discovery { j.appendInvalidation(""); return Discovery{State: "empty"} }
	h := snapshotHandlerWithJournal(cfg, func(*http.Request) bool { return true }, discover, func(transport.Config) ([]nativeSession, error) { return nil, nil }, cfg.Home, func(context.Context) string { return "disconnected" }, j)
	r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
	r.RequestURI = SnapshotPath
	r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:123"))
	r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 123")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("snapshot: %d %s", w.Code, w.Body.String())
	}
	var snap struct {
		EventCursor string `json:"event_cursor"`
		Oldest      string `json:"oldest_replay_cursor"`
		Instance    string `json:"server_instance_id"`
	}
	if json.Unmarshal(w.Body.Bytes(), &snap) != nil || snap.EventCursor != j.cursor(0) || snap.Instance != j.instance || snap.Oldest != j.cursor(0) {
		t.Fatal(w.Body.String())
	}
	seq, code := j.parse(snap.EventCursor)
	if code != "" || seq != 0 {
		t.Fatal(seq, code)
	}
}
