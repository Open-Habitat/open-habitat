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

	"github.com/Open-Habitat/open-habitat/internal/transport"
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
	j.stream(w, r, func() bool { return true })
	if w.Code != 409 || !strings.Contains(w.Body.String(), "cursor_expired") || strings.Contains(w.Header().Get("Content-Type"), "event-stream") {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestEventStreamChecksValidityOnlyOnOpen(t *testing.T) {
	j := newEventJournal()
	zero, _ := j.watermark()
	j.appendInvalidation("")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		checks := 0
		j.stream(w, r, func() bool { checks++; return checks == 1 })
	}))
	defer server.Close()
	req, _ := http.NewRequest("GET", server.URL+"/api/v1/events?after="+zero, nil)
	req.Host = "unix"
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	reader := bufio.NewReader(res.Body)
	line, err := reader.ReadString('\n')
	if err != nil || line != "id: "+j.cursor(1)+"\n" {
		t.Fatalf("replay %q: %v", line, err)
	}
}

func TestEventJournalMixedReplayAndByteBound(t *testing.T) {
	j := newEventJournal()
	zero, _ := j.watermark()
	j.appendEvent("queue.changed", "pi:12345678-1234-1234-1234-123456789012", map[string]any{"revision": "queue_00000001", "steering": []string{"next"}, "follow_up": []string{}})
	j.appendInvalidation("")
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.seq != 2 || len(j.frames) != 2 || j.bytes > eventWindowBytes || !strings.Contains(string(j.frames[0]), `"queue.changed"`) || !strings.Contains(string(j.frames[1]), `"snapshot.invalidated"`) || zero != j.cursor(0) {
		t.Fatal("mixed stream lost ordering")
	}
}

func TestEventJournalByteBoundIndependentOfFrameBound(t *testing.T) {
	j := newEventJournal()
	zero, _ := j.watermark()
	// Each frame fits below the separate one-MiB frame limit; bytes expire
	// the first cursor long before the 1024-event count limit is reached.
	for n := 0; n < 25; n++ {
		j.appendEvent("assistant.delta", "pi:12345678-1234-1234-1234-123456789012", map[string]any{"text": strings.Repeat("a", 900<<10), "content_index": 0})
	}
	if len(j.frames) >= 25 || len(j.frames) >= eventWindowCount || j.bytes > eventWindowBytes {
		t.Fatalf("byte bound did not evict: %d frames, %d bytes", len(j.frames), j.bytes)
	}
	if _, code := j.parse(zero); code != "cursor_expired" {
		t.Fatal("byte-evicted cursor", code)
	}
	before := j.seq
	j.appendEvent("history.entry", "pi:12345678-1234-1234-1234-123456789012", map[string]any{"content": strings.Repeat("b", (1<<20)+1)})
	if j.seq != before+1 || !strings.Contains(string(j.frames[len(j.frames)-1]), `"ring_truncated"`) {
		t.Fatal("oversized frame did not emit bounded invalidation")
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

func TestEventStreamOpensBeforeFirstHeartbeat(t *testing.T) {
	j := newEventJournal()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		j.stream(w, r, func() bool { return true })
	}))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "GET", server.URL+"/api/v1/events?after="+j.cursor(0), nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = "unix"
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("idle event stream did not open before its heartbeat: %v", err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 || res.Header.Get("Content-Type") != "text/event-stream" {
		t.Fatalf("unexpected idle event stream: %d %s", res.StatusCode, res.Header.Get("Content-Type"))
	}
}

func TestEventStreamExactReplayAndLastEventID(t *testing.T) {
	j := newEventJournal()
	zero, _ := j.watermark()
	j.appendInvalidation("")
	first, _ := j.watermark()
	j.appendInvalidation("")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		j.stream(w, r, func() bool { return r.Context().Err() == nil })
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
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: "123", Home: u.HomeDir}
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
	if json.Unmarshal(w.Body.Bytes(), &snap) != nil || snap.EventCursor != j.cursor(1) || snap.Instance != j.instance || snap.Oldest != j.cursor(0) {
		t.Fatal(w.Body.String())
	}
	seq, code := j.parse(snap.EventCursor)
	if code != "" || seq != 1 {
		t.Fatal(seq, code)
	}
}

func TestJournalMidTurnAtomicTailAndReplay(t *testing.T) {
	j := newEventJournal()
	agent := "pi:12345678-1234-1234-1234-123456789012"
	j.activity(agent, "running")
	for i := 0; i < 30; i++ {
		j.delta(agent, "assistant.delta", "abc", 0)
	}
	j.progress(agent, "tool.started", map[string]string{"tool_call_id": "tool_1", "tool_name": "bash", "state": "running"})
	cursor, _, _, views := j.turnView()
	tail := views[agent]
	if tail.activity != "running" || len(tail.frames) != 2 || !strings.Contains(string(tail.frames[0]), `"text":"`+strings.Repeat("abc", 30)+`"`) {
		t.Fatalf("incomplete atomic tail: %+v", tail)
	}
	seq, code := j.parse(cursor)
	if code != "" {
		t.Fatal(code)
	}
	j.delta(agent, "assistant.delta", "next", 1)
	j.progress(agent, "tool.finished", map[string]string{"tool_call_id": "tool_1", "tool_name": "bash", "state": "succeeded"})
	j.mu.Lock()
	oldest := j.seq - uint64(len(j.frames))
	frames := append([][]byte(nil), j.frames...)
	j.mu.Unlock()
	if seq != 2 || len(frames[seq-oldest:]) != 2 || !strings.Contains(string(frames[seq-oldest]), `"text":"next"`) {
		t.Fatal("resume omitted or duplicated a delta")
	}
	j.nativeEntry(agent, historyEntry{Key: "native_1", Kind: "assistant", Content: historyContent{MediaType: "text/plain", Text: "abcnext", Complete: true}})
	_, _, _, views = j.turnView()
	if len(views[agent].frames) != 0 {
		t.Fatal("persisted assistant failed to supersede tail")
	}
}

func TestJournalCoalescingAndReplayLimits(t *testing.T) {
	j := newEventJournal()
	agent := "pi:12345678-1234-1234-1234-123456789012"
	for n := 0; n < 400; n++ {
		j.delta(agent, "assistant.delta", "a", 0)
	}
	cursor, _, _, views := j.turnView()
	if len(views[agent].frames) != 1 || j.seq != 1 {
		t.Fatal("unbounded delta frames")
	}
	for n := 0; n < eventWindowCount+10; n++ {
		j.appendEvent("tool.updated", agent, map[string]string{"tool_call_id": "call", "tool_name": "bash", "state": "running"})
	}
	j.mu.Lock()
	count, bytes := len(j.frames), j.bytes
	j.mu.Unlock()
	if count > eventWindowCount || bytes > eventWindowBytes {
		t.Fatal("unbounded replay")
	}
	if _, code := j.parse(cursor); code != "cursor_expired" {
		t.Fatal("old cursor did not expire", code)
	}
}

func TestSnapshotPendingDeltaDoesNotInvalidateNative(t *testing.T) {
	j := newEventJournal()
	agent := "pi:12345678-1234-1234-1234-123456789012"
	j.delta(agent, "assistant.delta", "hello", 0)
	before := j.nativeGeneration()
	cursor, _, after, views := j.turnView()
	if before != after || cursor != j.cursor(1) || j.seq != 1 || len(views[agent].frames) != 1 {
		t.Fatal("snapshot flush spuriously invalidated", cursor, j.seq)
	}
}

func TestJournalOverflowResetAndWriterExit(t *testing.T) {
	j := newEventJournal()
	agent := "pi:12345678-1234-1234-1234-123456789012"
	j.activity(agent, "running")
	j.delta(agent, "assistant.delta", "first", 0)
	j.progress(agent, "tool.started", map[string]string{"tool_call_id": "one", "tool_name": "bash", "state": "running"})
	j.delta(agent, "assistant.delta", strings.Repeat("x", 4097), 0)
	_, _, _, views := j.turnView()
	if !views[agent].overflow || len(views[agent].frames) != 0 {
		t.Fatal("overflow retained partial turn")
	}
	j.reset(agent, "unknown")
	_, _, _, views = j.turnView()
	if views[agent].activity != "unknown" || len(views[agent].frames) != 0 {
		t.Fatal("dead writer retained provisional state")
	}
	j.reset(agent, "running")
	j.delta(agent, "assistant.delta", "new turn", 0)
	_, _, _, views = j.turnView()
	if views[agent].overflow || len(views[agent].frames) != 1 {
		t.Fatal("new writer could not publish after overflow")
	}
}
