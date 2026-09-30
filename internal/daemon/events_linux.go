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

// eventJournal belongs to one mapped UID and one daemon lifetime. It does not
// duplicate native history: changes signal that the client must read it again.
const eventWindowCount = 128
const eventWindowBytes = 1 << 20

type eventJournal struct {
	mu       sync.Mutex
	instance string
	seq      uint64
	frames   [][]byte
	bytes    int
	changed  chan struct{}
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
func (j *eventJournal) appendInvalidation(agent string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.instance == "" {
		return
	}
	j.seq++
	id, _ := uuid()
	resource := map[string]string{"scope": "user"}
	if agent != "" {
		resource = map[string]string{"agent_id": agent}
	}
	b, _ := json.Marshal(map[string]any{"schema_version": 1, "event_id": "evt_" + strings.ReplaceAll(id, "-", ""), "cursor": j.cursor(j.seq), "server_instance_id": j.instance, "sequence": j.seq, "emitted_at": time.Now().UTC().Format(time.RFC3339Nano), "kind": "snapshot.invalidated", "resource": resource, "payload": map[string]string{"reason": "source_changed"}})
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
func (j *eventJournal) stream(w http.ResponseWriter, r *http.Request, valid func() bool) {
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
	end := time.NewTimer(20 * time.Second)
	defer end.Stop()
	heartbeat := time.NewTicker(2 * time.Second)
	defer heartbeat.Stop()
	for {
		if !valid() || r.Context().Err() != nil {
			return
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
			}
			_ = json.Unmarshal(b, &event)
			if _, err := io.WriteString(w, "id: "+event.Cursor+"\nevent: snapshot.invalidated\ndata: "+string(b)+"\n\n"); err != nil {
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
