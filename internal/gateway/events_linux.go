//go:build linux

package gateway

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// forwardEvents does not forward arbitrary daemon bytes. Every frame is
// allowlisted and bound to the exact cursor sequence and daemon instance.
func (a *Auth) forwardEvents(w http.ResponseWriter, r *http.Request, conn net.Conn, req *http.Request, initial session) {
	reader := bufio.NewReader(&streamHeaderReader{source: conn})
	res, err := http.ReadResponse(reader, req)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	if res.ProtoMajor != 1 || res.ProtoMinor != 1 {
		safe(w, 503, "daemon_unavailable")
		return
	}
	if res.StatusCode != 200 {
		if (res.StatusCode != 409 && res.StatusCode != 400 && res.StatusCode != 403 && res.StatusCode != 503) || res.ContentLength <= 0 || res.ContentLength > 4096 || len(res.TransferEncoding) != 0 || res.Header.Get("Content-Type") != "application/json" {
			safe(w, 503, "daemon_unavailable")
			return
		}
		b, err := io.ReadAll(io.LimitReader(res.Body, 4097))
		if err != nil || int64(len(b)) != res.ContentLength {
			safe(w, 503, "daemon_unavailable")
			return
		}
		var e struct {
			SchemaVersion int `json:"schema_version"`
			Error         struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		if json.Unmarshal(b, &e) != nil || e.SchemaVersion != 1 {
			safe(w, 503, "daemon_unavailable")
			return
		}
		allowed := map[int]map[string]bool{400: {"invalid_request": true}, 403: {"cross_user_denied": true}, 409: {"cursor_expired": true, "cursor_instance_mismatch": true}, 503: {"native_source_unavailable": true}}
		if !allowed[res.StatusCode][e.Error.Code] {
			safe(w, 503, "daemon_unavailable")
			return
		}
		safe(w, res.StatusCode, e.Error.Code)
		return
	}
	if res.Header.Get("Content-Type") != "text/event-stream" || len(res.Header.Values("Content-Type")) != 1 || res.ContentLength > 0 || len(res.TransferEncoding) > 1 {
		safe(w, 503, "daemon_unavailable")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok || http.NewResponseController(w).SetWriteDeadline(time.Now().Add(26*time.Second)) != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	scanner := bufio.NewScanner(res.Body)
	scanner.Buffer(make([]byte, 4096), conversationReplyLimit+256)
	cursor := r.URL.Query().Get("after")
	if last := r.Header.Get("Last-Event-ID"); last != "" {
		cursor = last
	}
	parts := strings.Split(cursor, ":")
	previous, _ := strconv.ParseUint(parts[2], 10, 64)
	for count := 0; count < 128; count++ {
		if !scanner.Scan() {
			return
		}
		line := scanner.Text()
		if line == ": heartbeat" {
			if !scanner.Scan() || scanner.Text() != "" {
				return
			}
			latest, valid := a.authenticated(r)
			if !valid || latest.identity != initial.identity || latest.csrf != initial.csrf || latest.epoch != initial.epoch || latest.generation != initial.generation {
				return
			}
			if _, err := io.WriteString(w, ": heartbeat\n\n"); err != nil {
				return
			}
			flusher.Flush()
			continue
		}
		if !strings.HasPrefix(line, "id: ") {
			return
		}
		id := strings.TrimPrefix(line, "id: ")
		next := strings.Split(id, ":")
		if len(next) != 3 || next[1] != parts[1] {
			return
		}
		seq, err := strconv.ParseUint(next[2], 10, 64)
		if err != nil || seq != previous+1 {
			return
		}
		if !scanner.Scan() || !strings.HasPrefix(scanner.Text(), "event: ") {
			return
		}
		kind := strings.TrimPrefix(scanner.Text(), "event: ")
		if !scanner.Scan() || !strings.HasPrefix(scanner.Text(), "data: ") {
			return
		}
		body := strings.TrimPrefix(scanner.Text(), "data: ")
		if len(body) > conversationReplyLimit {
			return
		}
		var event struct {
			EmittedAt        string            `json:"emitted_at"`
			SchemaVersion    int               `json:"schema_version"`
			Cursor           string            `json:"cursor"`
			ServerInstanceID string            `json:"server_instance_id"`
			Sequence         uint64            `json:"sequence"`
			EventID          string            `json:"event_id"`
			Kind             string            `json:"kind"`
			NativeKey        string            `json:"native_key"`
			Resource         map[string]string `json:"resource"`
			Payload          json.RawMessage   `json:"payload"`
		}
		decoder := json.NewDecoder(bytes.NewReader([]byte(body)))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&event) != nil || decoder.Decode(new(any)) != io.EOF || event.SchemaVersion != 1 || event.Cursor != id || event.ServerInstanceID != parts[1] || event.Sequence != seq || !regexp.MustCompile(`^evt_[A-Za-z0-9_-]{8,80}$`).MatchString(event.EventID) || !validEventTime(event.EmittedAt) || event.Kind != kind || !validEventResource(event.Resource) || !validCombinedPayload(kind, event.Resource, event.NativeKey, event.Payload) {
			return
		}
		if !scanner.Scan() || scanner.Text() != "" {
			return
		}
		latest, valid := a.authenticated(r)
		if !valid || latest.identity != initial.identity || latest.csrf != initial.csrf || latest.epoch != initial.epoch || latest.generation != initial.generation {
			return
		}
		if _, err := io.WriteString(w, "id: "+id+"\nevent: "+kind+"\ndata: "+body+"\n\n"); err != nil {
			return
		}
		flusher.Flush()
		previous = seq
	}
}

// This allowlist prevents a compromised daemon response from forwarding
// arbitrary event types or extra fields into another user's browser.
func validCombinedPayload(kind string, resource map[string]string, nativeKey string, raw json.RawMessage) bool {
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil || fields == nil {
		return false
	}
	allowed := map[string][]string{
		"snapshot.invalidated": {"reason"},
		"queue.changed":        {"revision", "steering", "follow_up"},
		"history.entry":        {"entry_key", "entry_kind", "content"},
		"assistant.delta":      {"text", "content_index"},
		"tool.started":         {"tool_call_id", "tool_name", "state"},
		"tool.updated":         {"tool_call_id", "tool_name", "state"},
		"tool.finished":        {"tool_call_id", "tool_name", "state"},
		"turn.settled":         {"state", "observed_at", "native_key"},
		"command.changed":      {"client_command_id", "acceptance", "execution"},
		"question.requested":   {"request_id", "question_kind", "prompt", "choices"},
		"unknown.native":       {"native_type", "content"},
	}
	keys, ok := allowed[kind]
	if !ok || len(fields) != len(keys) {
		return false
	}
	for _, k := range keys {
		if _, ok := fields[k]; !ok {
			return false
		}
	}
	if kind != "history.entry" && nativeKey != "" {
		return false
	}
	if kind == "unknown.native" {
		if resource["agent_id"] == "" || string(fields["native_type"]) != `"extension_ui_request"` {
			return false
		}
		content, ok := strictObject(fields["content"], []string{"media_type", "text", "complete"})
		return ok && str(content, "media_type") == "text/plain" && len(str(content, "text")) > 0 && len(str(content, "text")) <= 1000 && string(content["complete"]) == "true"
	}
	if kind == "turn.settled" || kind == "question.requested" || kind == "command.changed" {
		if resource["agent_id"] == "" {
			return false
		}
		if kind == "turn.settled" {
			return validSettlement(raw)
		}
		if kind == "question.requested" {
			return validQuestion(raw)
		}
		var id, acceptance, execution string
		if json.Unmarshal(fields["client_command_id"], &id) != nil || !conversationUUID.MatchString(id) || json.Unmarshal(fields["acceptance"], &acceptance) != nil || json.Unmarshal(fields["execution"], &execution) != nil {
			return false
		}
		return (acceptance == "pending" || acceptance == "accepted" || acceptance == "rejected" || acceptance == "uncertain") && execution == "unknown"
	}
	if kind == "assistant.delta" {
		if resource["agent_id"] == "" {
			return false
		}
		var text string
		var index int
		return json.Unmarshal(fields["text"], &text) == nil && len(text) > 0 && len(text) <= 4096 && json.Unmarshal(fields["content_index"], &index) == nil && index >= 0
	}
	if strings.HasPrefix(kind, "tool.") {
		if resource["agent_id"] == "" {
			return false
		}
		var id, name, state string
		if json.Unmarshal(fields["tool_call_id"], &id) != nil || json.Unmarshal(fields["tool_name"], &name) != nil || json.Unmarshal(fields["state"], &state) != nil || len(id) < 1 || len(id) > 200 || len(name) < 1 || len(name) > 200 {
			return false
		}
		if kind == "tool.finished" {
			return state == "succeeded" || state == "failed" || state == "cancelled"
		}
		return state == "running"
	}
	if kind == "history.entry" {
		if resource["agent_id"] == "" || len(nativeKey) < 1 || len(nativeKey) > 128 {
			return false
		}
		for _, ch := range nativeKey {
			if !((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_' || ch == '-') {
				return false
			}
		}
		var key, entryKind string
		if json.Unmarshal(fields["entry_key"], &key) != nil || key != nativeKey || json.Unmarshal(fields["entry_kind"], &entryKind) != nil {
			return false
		}
		switch entryKind {
		case "user", "assistant", "tool", "model_change", "unknown":
		default:
			return false
		}
		var content struct {
			MediaType  string `json:"media_type"`
			Text       string `json:"text"`
			Complete   bool   `json:"complete"`
			ContentID  string `json:"content_id"`
			NextOffset int    `json:"next_offset"`
		}
		dec := json.NewDecoder(bytes.NewReader(fields["content"]))
		dec.DisallowUnknownFields()
		if dec.Decode(&content) != nil || dec.Decode(new(any)) != io.EOF || content.MediaType != "text/plain" || len(content.Text) > 65536 || content.NextOffset < 0 {
			return false
		}
		return true
	}
	if kind == "snapshot.invalidated" {
		var reason string
		return json.Unmarshal(fields["reason"], &reason) == nil && (reason == "source_changed" || reason == "ring_truncated")
	}
	if resource["agent_id"] == "" {
		return false
	}
	var revision string
	var steering, follow []string
	if json.Unmarshal(fields["revision"], &revision) != nil || len(revision) < 8 || len(revision) > 200 || json.Unmarshal(fields["steering"], &steering) != nil || steering == nil || json.Unmarshal(fields["follow_up"], &follow) != nil || follow == nil || len(steering)+len(follow) > 128 {
		return false
	}
	for _, text := range append(steering, follow...) {
		if len(text) > 65536 {
			return false
		}
	}
	return true
}
func validEventTime(v string) bool { _, err := time.Parse(time.RFC3339Nano, v); return err == nil }
func validEventResource(m map[string]string) bool {
	if len(m) != 1 {
		return false
	}
	if m["scope"] == "user" {
		return true
	}
	id := m["agent_id"]
	return strings.HasPrefix(id, "pi:") && conversationUUID.MatchString(strings.TrimPrefix(id, "pi:"))
}
