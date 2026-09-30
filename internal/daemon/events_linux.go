//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// eventJournal belongs to one mapped UID and one daemon lifetime. Frames are
// transient presentation hints; native Pi history remains authoritative.
const eventWindowCount = 128
const eventWindowBytes = 1 << 20

type eventJournal struct {
	mu       sync.Mutex
	instance string
	seq      uint64
	frames   [][]byte
	bytes    int
	changed  chan struct{}
	pending  bool // one trailing invalidation coalesces bursty Pi deltas
}

func newEventJournal() *eventJournal {
	id, _ := uuid()
	return &eventJournal{instance: id, changed: make(chan struct{})}
}
func (j *eventJournal) cursor(seq uint64) string { return fmt.Sprintf("ev1:%s:%d", j.instance, seq) }

// The oldest replay cursor is the predecessor of the first retained event.
func (j *eventJournal) watermark() (string, string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	oldest := j.seq - uint64(len(j.frames))
	return j.cursor(j.seq), j.cursor(oldest)
}

// A single trailing invalidation covers all deltas in a burst, including the
// last one. Never merely suppress a delta after publishing: a client may have
// already resnapshotted at the earlier cursor.
func (j *eventJournal) invalidateNative() {
	j.mu.Lock()
	if j.pending || j.instance == "" {
		j.mu.Unlock()
		return
	}
	j.pending = true
	j.mu.Unlock()
	time.AfterFunc(250*time.Millisecond, func() {
		j.mu.Lock()
		j.pending = false
		j.mu.Unlock()
		j.appendInvalidation("")
	})
}
func (j *eventJournal) appendInvalidation(agent string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.instance == "" {
		return
	}
	j.appendLocked("snapshot.invalidated", agent, "", map[string]string{"reason": "source_changed"})
}

// appendEvent serializes publication with cursor allocation. Oversized native
// content is never partially presented as if complete: invalidate instead.
func (j *eventJournal) appendEvent(kind, agent string, payload any) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.instance == "" {
		return
	}
	j.appendLocked(kind, agent, "", payload)
}

// Native history identity is sourced only from checked Pi JSONL. A large
// history body falls back to invalidation rather than publishing a partial
// entry without a way to fetch its remaining content.
func (j *eventJournal) appendNativeEntry(agent string, entry historyEntry) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.instance == "" {
		return
	}
	j.appendLocked("history.entry", agent, entry.Key, map[string]any{"entry_key": entry.Key, "entry_kind": entry.Kind, "content": entry.Content})
}
func (j *eventJournal) appendLocked(kind, agent, nativeKey string, payload any) {
	id, ok := uuid()
	if !ok {
		return
	}
	resource := map[string]string{"scope": "user"}
	if agent != "" {
		resource = map[string]string{"agent_id": agent}
	}
	frame := map[string]any{"schema_version": 1, "event_id": "evt_" + strings.ReplaceAll(id, "-", ""), "cursor": j.cursor(j.seq + 1), "server_instance_id": j.instance, "sequence": j.seq + 1, "emitted_at": time.Now().UTC().Format(time.RFC3339Nano), "kind": kind, "resource": resource, "payload": payload}
	if nativeKey != "" {
		frame["native_key"] = nativeKey
	}
	b, err := json.Marshal(frame)
	if err != nil {
		return
	}
	if len(b) > eventWindowBytes {
		// A bounded invalidation still tells clients to reload native sources.
		kind = "snapshot.invalidated"
		b, _ = json.Marshal(map[string]any{"schema_version": 1, "event_id": "evt_" + strings.ReplaceAll(id, "-", ""), "cursor": j.cursor(j.seq + 1), "server_instance_id": j.instance, "sequence": j.seq + 1, "emitted_at": time.Now().UTC().Format(time.RFC3339Nano), "kind": kind, "resource": resource, "payload": map[string]string{"reason": "ring_truncated"}})
	}
	j.seq++
	j.frames = append(j.frames, b)
	j.bytes += len(b)
	for len(j.frames) > eventWindowCount || j.bytes > eventWindowBytes {
		j.bytes -= len(j.frames[0])
		j.frames = j.frames[1:]
	}
	close(j.changed)
	j.changed = make(chan struct{})
}
func (j *eventJournal) parse(cursor string) (uint64, string) {
	parts := strings.Split(cursor, ":")
	if len(parts) != 3 || parts[0] != "ev1" || len(parts[2]) == 0 || len(parts[2]) > 20 || (len(parts[2]) > 1 && parts[2][0] == '0') {
		return 0, "invalid_request"
	}
	for _, ch := range parts[2] {
		if ch < '0' || ch > '9' {
			return 0, "invalid_request"
		}
	}
	if !regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`).MatchString(parts[1]) {
		return 0, "invalid_request"
	}
	// A syntactically valid foreign instance must not be treated as a gap.
	if _, err := strconv.ParseUint(parts[2], 10, 64); err != nil {
		return 0, "invalid_request"
	}
	if parts[1] != j.instance {
		return 0, "cursor_instance_mismatch"
	}
	seq, _ := strconv.ParseUint(parts[2], 10, 64)
	j.mu.Lock()
	defer j.mu.Unlock()
	if seq > j.seq {
		return 0, "invalid_request"
	}
	if seq < j.seq-uint64(len(j.frames)) {
		return 0, "cursor_expired"
	}
	return seq, ""
}
func (j *eventJournal) stream(w http.ResponseWriter, r *http.Request, valid, nativeUsable func() bool) {
	if r.Method != "GET" || r.URL.Path != "/api/v1/events" || r.Host != "unix" || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength > 0 || len(r.TransferEncoding) > 0 || len(r.Header.Values("Last-Event-ID")) > 1 || len(r.URL.Query()["after"]) != 1 || len(r.URL.Query()) != 1 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	after := r.URL.Query().Get("after")
	if last := r.Header.Get("Last-Event-ID"); last != "" {
		after = last
	}
	if !valid() {
		snapshotError(w, 403, "cross_user_denied")
		return
	}
	seq, code := j.parse(after)
	if code != "" {
		status := 400
		if code == "cursor_expired" || code == "cursor_instance_mismatch" {
			status = 409
		}
		snapshotError(w, status, code)
		return
	}
	control := http.NewResponseController(w)
	if control.SetReadDeadline(time.Time{}) != nil || control.SetWriteDeadline(time.Now().Add(24*time.Second)) != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(200)
	deadline := time.Now().Add(20 * time.Second)
	end := time.NewTimer(time.Until(deadline))
	defer end.Stop()
	lastNative := time.Now() // the outer Pi gate checked native usability at admission
	heartbeat := time.NewTicker(2 * time.Second)
	defer heartbeat.Stop()
	for {
		if !valid() || r.Context().Err() != nil || !time.Now().Before(deadline) {
			return
		}
		// Also check during a busy replay: a continuously available frame
		// must not starve the native revocation or finite lifetime checks.
		if time.Since(lastNative) >= 2*time.Second {
			if !nativeUsable() {
				return
			}
			lastNative = time.Now()
		}
		j.mu.Lock()
		oldest := j.seq - uint64(len(j.frames))
		if seq < oldest {
			j.mu.Unlock()
			return
		} // browser must resnapshot after disconnect
		var b []byte
		if seq < j.seq {
			b = j.frames[seq-oldest]
			seq++
		}
		changed := j.changed
		j.mu.Unlock()
		if b != nil {
			if !valid() {
				return
			}
			var event struct {
				Cursor string `json:"cursor"`
				Kind   string `json:"kind"`
			}
			_ = json.Unmarshal(b, &event)
			if _, err := io.WriteString(w, "id: "+event.Cursor+"\nevent: "+event.Kind+"\ndata: "+string(b)+"\n\n"); err != nil {
				return
			}
			flusher.Flush()
			continue
		}
		select {
		case <-changed:
		case <-heartbeat.C:
			if !valid() {
				return
			}
			if _, err := io.WriteString(w, ": heartbeat\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case <-end.C:
			return
		case <-r.Context().Done():
			return
		}
	}
}
