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
	"unicode/utf8"
)

// eventJournal belongs to one mapped UID and one daemon lifetime. Frames are
// transient presentation hints; native Pi history remains authoritative.
const eventWindowCount = 1024
const eventWindowBytes = 16 << 20
const eventFrameBytes = 1 << 20

type turnTail struct {
	activity string
	frames   []json.RawMessage
	bytes    int
	text     string
	index    int
	textKind string
	timer    *time.Timer
	overflow bool
}

type eventJournal struct {
	mu        sync.Mutex
	instance  string
	seq       uint64
	frames    [][]byte
	bytes     int
	changed   chan struct{}
	pending   bool // one trailing invalidation coalesces bursty Pi deltas
	nativeGen uint64
	tails     map[string]*turnTail
}

func newEventJournal() *eventJournal {
	id, _ := uuid()
	return &eventJournal{instance: id, changed: make(chan struct{}), tails: make(map[string]*turnTail)}
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
	j.nativeGen++
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
// history body falls back to invalidation rather than publishing an oversized
// frame; selected blocks can be fetched from the native file.
func (j *eventJournal) appendNativeEntry(agent string, entry historyEntry) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.instance == "" {
		return
	}
	j.appendLocked("history.entry", agent, entry.Key, nativeEntryPayload(entry))
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
	if len(b) > eventFrameBytes {
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

// All tail changes and the corresponding cursor allocations use the journal lock.
// A snapshot copies both under that same lock. Text is coalesced for at most
// 50ms or 4096 bytes; non-text events flush it first to preserve RPC order.
func (j *eventJournal) tail(agent string) *turnTail {
	t := j.tails[agent]
	if t == nil {
		t = &turnTail{activity: "idle"}
		j.tails[agent] = t
	}
	return t
}
func (j *eventJournal) flushTextLocked(agent string, t *turnTail) {
	if t.text == "" {
		return
	}
	text, index, kind := t.text, t.index, t.textKind
	t.text = ""
	j.appendTailLocked(agent, t, kind, map[string]any{"text": text, "content_index": index})
}
func (j *eventJournal) appendTailLocked(agent string, t *turnTail, kind string, payload any) {
	if t.overflow {
		return
	}
	before := j.seq
	j.appendLocked(kind, agent, "", payload)
	if j.seq == before {
		return
	}
	frame := j.frames[len(j.frames)-1]
	if len(frame) > 16<<10 || t.bytes+len(frame) > 128<<10 || len(t.frames) == 128 {
		t.overflow = true
		t.frames = nil
		t.bytes = 0
		j.appendLocked("snapshot.invalidated", agent, "", map[string]string{"reason": "ring_truncated"})
		return
	}
	t.frames = append(t.frames, frame)
	t.bytes += len(frame)
}
func (j *eventJournal) delta(agent, kind, text string, index int) {
	if text == "" || !utf8.ValidString(text) {
		return
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	t := j.tail(agent)
	if t.overflow {
		return
	}
	if len(text) > 4096 {
		t.overflow = true
		t.frames = nil
		t.bytes = 0
		t.text = ""
		j.appendLocked("snapshot.invalidated", agent, "", map[string]string{"reason": "ring_truncated"})
		return
	}
	if t.text != "" && (t.index != index || t.textKind != kind || len(t.text)+len(text) > 4096) {
		j.flushTextLocked(agent, t)
	}
	t.index, t.textKind, t.text = index, kind, t.text+text
	if t.timer == nil {
		t.timer = time.AfterFunc(50*time.Millisecond, func() { j.mu.Lock(); defer j.mu.Unlock(); t.timer = nil; j.flushTextLocked(agent, t) })
	}
}

// Pi tool updates are cumulative snapshots, not incremental output. Keep only
// the newest update for each call in a snapshot tail; the event ring still
// publishes every update to connected subscribers.
func (j *eventJournal) toolUpdate(agent, callID string, payload any) {
	j.mu.Lock()
	defer j.mu.Unlock()
	t := j.tail(agent)
	j.flushTextLocked(agent, t)
	kept := t.frames[:0]
	t.bytes = 0
	for _, frame := range t.frames {
		var event struct {
			Kind    string `json:"kind"`
			Payload struct {
				ToolCallID string `json:"tool_call_id"`
			} `json:"payload"`
		}
		if json.Unmarshal(frame, &event) == nil && event.Kind == "tool.updated" && event.Payload.ToolCallID == callID {
			continue
		}
		kept = append(kept, frame)
		t.bytes += len(frame)
	}
	t.frames = kept
	j.appendTailLocked(agent, t, "tool.updated", payload)
}
func (j *eventJournal) progress(agent, kind string, payload any) {
	j.mu.Lock()
	defer j.mu.Unlock()
	t := j.tail(agent)
	j.flushTextLocked(agent, t)
	j.appendTailLocked(agent, t, kind, payload)
}

// Reset is used only at writer/turn boundaries. A timer from the old turn
// cannot resurrect its text: it finds an empty pending buffer under this lock.
func (j *eventJournal) reset(agent, state string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	t := j.tail(agent)
	t.text = ""
	t.frames = nil
	t.bytes = 0
	t.overflow = false
	t.activity = state
	if t.timer != nil {
		t.timer.Stop()
		t.timer = nil
	}
}
func (j *eventJournal) activity(agent, state string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	t := j.tail(agent)
	j.flushTextLocked(agent, t)
	t.activity = state
}
func (j *eventJournal) nativeEntry(agent string, entry historyEntry) {
	j.mu.Lock()
	defer j.mu.Unlock()
	t := j.tail(agent)
	j.flushTextLocked(agent, t)
	j.nativeGen++
	j.appendLocked("history.entry", agent, entry.Key, nativeEntryPayload(entry))
	// Pi does not give RPC deltas a persistent key. Assistant entries supersede
	// the provisional turn as a unit, never match on text or event arrival time.
	if entry.Kind == "assistant" {
		t.frames = nil
		t.bytes = 0
		t.overflow = false
	} else if entry.Kind == "bash" {
		kept := t.frames[:0]
		t.bytes = 0
		for _, frame := range t.frames {
			var event struct {
				Kind string `json:"kind"`
			}
			if json.Unmarshal(frame, &event) == nil && event.Kind == "bash.output" {
				continue
			}
			kept = append(kept, frame)
			t.bytes += len(frame)
		}
		t.frames = kept
	} else if entry.Kind == "tool" && entry.ToolCallID != "" {
		kept := t.frames[:0]
		t.bytes = 0
		indexes := map[int]bool{}
		for _, frame := range t.frames {
			var event struct {
				Kind    string `json:"kind"`
				Payload struct {
					ToolCallID string `json:"tool_call_id"`
					Index      int    `json:"content_index"`
				} `json:"payload"`
			}
			if json.Unmarshal(frame, &event) == nil && event.Kind == "assistant.toolcall.end" && event.Payload.ToolCallID == entry.ToolCallID {
				indexes[event.Payload.Index] = true
			}
		}
		for _, frame := range t.frames {
			var event struct {
				Kind    string `json:"kind"`
				Payload struct {
					ToolCallID string `json:"tool_call_id"`
					Index      int    `json:"content_index"`
				} `json:"payload"`
			}
			if json.Unmarshal(frame, &event) == nil && (event.Payload.ToolCallID == entry.ToolCallID || (event.Kind == "assistant.toolcall.delta" && indexes[event.Payload.Index])) {
				continue
			}
			kept = append(kept, frame)
			t.bytes += len(frame)
		}
		t.frames = kept
	}
}
func (j *eventJournal) nativeGeneration() uint64 {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.nativeGen
}

func (j *eventJournal) turnView() (string, string, uint64, map[string]turnTail) {
	j.mu.Lock()
	defer j.mu.Unlock()
	views := make(map[string]turnTail, len(j.tails))
	for agent, t := range j.tails {
		j.flushTextLocked(agent, t)
		copyTail := *t
		copyTail.frames = append([]json.RawMessage(nil), t.frames...)
		views[agent] = copyTail
	}
	return j.cursor(j.seq), j.cursor(j.seq - uint64(len(j.frames))), j.nativeGen, views
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
	if control.SetReadDeadline(time.Time{}) != nil || control.SetWriteDeadline(time.Now().Add(11*time.Minute)) != nil {
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
	flusher.Flush() // Open the SSE connection now, not on the first 20s heartbeat.
	deadline := time.Now().Add(10 * time.Minute)
	end := time.NewTimer(time.Until(deadline))
	defer end.Stop()
	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()
	for {
		if r.Context().Err() != nil || !time.Now().Before(deadline) {
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

func nativeEntryPayload(entry historyEntry) map[string]any {
	payload := map[string]any{"entry_key": entry.Key, "entry_kind": entry.Kind, "content": entry.Content}
	if len(entry.Blocks) > 0 {
		payload["blocks"] = entry.Blocks
	}
	if entry.ToolCallID != "" {
		payload["tool_call_id"] = entry.ToolCallID
	}
	if entry.IsError != nil {
		payload["is_error"] = *entry.IsError
	}
	if entry.StopReason != "" {
		payload["stop_reason"] = entry.StopReason
	}
	if entry.Model != "" {
		payload["model"] = entry.Model
	}
	if entry.EntryType != "" {
		payload["entry_type"] = entry.EntryType
	}
	if entry.ExitCode != nil {
		payload["exit_code"] = *entry.ExitCode
	}
	if entry.Cancelled {
		payload["cancelled"] = true
	}
	if entry.OutputTruncated {
		payload["output_truncated"] = true
	}
	if entry.ExcludeFromContext {
		payload["exclude_from_context"] = true
	}
	if entry.TruncatedBlocks {
		payload["truncated_blocks"] = true
	}
	if entry.NativeRevision != "" {
		payload["native_revision"] = entry.NativeRevision
	}
	return payload
}
