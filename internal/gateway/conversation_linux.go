//go:build linux

package gateway

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/maintainer/native-agent-host/internal/udssecure"
)

// This private gateway protocol deliberately does not add a browser v1 contract.
// The lease table is fail-closed on gateway restart: an orphan cannot be claimed
// by another browser session. Native histories remain accessible read-only.
var conversationPath = regexp.MustCompile(`^/api/v1/conversations(?:/([0-9a-fA-F-]{36})/(send|steer|follow_up|clear_queue|status|stop))?$`)
var conversationUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
var conversationWorkspace = regexp.MustCompile(`^ws_[A-Za-z0-9_-]{8,64}$`)

const conversationBase = "/api/v1/conversations"

func (a *Auth) conversation(w http.ResponseWriter, r *http.Request) {
	path := r.URL.EscapedPath()
	match := conversationPath.FindStringSubmatch(path)
	if match == nil || path != r.URL.Path || r.URL.RawQuery != "" || r.RequestURI != path || !a.exact(r, path) || (r.ProtoMajor != 1 || r.ProtoMinor != 1) && r.ProtoMajor != 2 || len(r.TransferEncoding) != 0 || (r.Method != "GET" && r.Method != "POST") || (match[1] != "" && ((match[2] == "status") != (r.Method == "GET"))) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method == "POST" {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	c, err := r.Cookie(cookieName)
	if err != nil {
		safe(w, 401, "authentication_required")
		return
	}
	owner := c.Value
	kind := "list"
	if r.Method == "POST" && match[1] == "" {
		kind = "create"
	} else if match[1] != "" {
		kind = match[2]
	}
	if match[1] != "" {
		if !conversationUUID.MatchString(match[1]) || !a.ownsConversation(owner, match[1]) {
			safe(w, 404, "resource_not_found")
			return
		}
	}
	var body []byte
	if kind == "create" || kind == "send" || kind == "steer" || kind == "follow_up" || kind == "clear_queue" {
		limit := int64(1024)
		if kind == "send" || kind == "steer" || kind == "follow_up" {
			limit = 66000
		}
		if r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 || r.ContentLength <= 0 || r.ContentLength > limit {
			safe(w, 400, "invalid_request")
			return
		}
		body, err = io.ReadAll(io.LimitReader(r.Body, limit+1))
		if err != nil || int64(len(body)) != r.ContentLength || int64(len(body)) > limit || !validConversationInput(kind, body) {
			safe(w, 400, "invalid_request")
			return
		}
	} else if r.ContentLength != 0 {
		safe(w, 400, "invalid_request")
		return
	}
	// A slow browser body can outlive logout or a broker rebind. Authorize
	// again immediately before touching the mapped socket.
	latest, valid := a.authenticated(r)
	if !valid || latest.identity != s.identity || latest.csrf != s.csrf || latest.epoch != s.epoch || latest.generation != s.generation {
		safe(w, 401, "authentication_required")
		return
	}
	if match[1] != "" && !a.ownsConversation(owner, match[1]) {
		safe(w, 404, "resource_not_found")
		return
	}
	target := s.identity
	dial := a.snapshotDial
	if dial == nil {
		if udssecure.Mapped(target.Socket, target.UID) != nil {
			safe(w, 503, "daemon_unavailable")
			return
		}
		dial = func(ctx context.Context, p string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, "unix", p)
		}
	}
	conn, err := dial(r.Context(), target.Socket)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer conn.Close()
	uc, ok := conn.(*net.UnixConn)
	peer := a.snapshotPeerUID
	if peer == nil {
		peer = daemonUID
	}
	if !ok || (a.snapshotPeerUID == nil && a.snapshotDial == nil && (peer(uc) != 0 || udssecure.Mapped(target.Socket, target.UID) != nil)) || ((a.snapshotPeerUID != nil || a.snapshotDial != nil) && peer(uc) != target.UID) {
		safe(w, 503, "daemon_unavailable")
		return
	}
	deadline := time.Now().Add(5 * time.Second)
	if d, ok := r.Context().Deadline(); ok && d.Before(deadline) {
		deadline = d
	}
	if conn.SetDeadline(deadline) != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	stop := context.AfterFunc(r.Context(), func() { _ = conn.SetDeadline(time.Now()) })
	defer stop()
	req, err := http.NewRequestWithContext(r.Context(), r.Method, "http://unix"+path, bytes.NewReader(body))
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("X-Agent-Host-Identity", identityID(target))
	req.Header.Set("X-Agent-Host-Display-Name", "GitHub user "+target.Subject)
	hash := sha256.Sum256([]byte("conversation-owner\x00" + owner))
	req.Header.Set("X-Agent-Host-Session", base64.RawURLEncoding.EncodeToString(hash[:]))
	req.Close = true
	// The socket may have accepted a write even when no acknowledgement arrives.
	ambiguous := kind == "create" || kind == "send" || kind == "steer" || kind == "follow_up" || kind == "clear_queue" || kind == "stop"
	failure := func() {
		if ambiguous {
			safe(w, 503, "control_uncertain")
		} else {
			safe(w, 503, "daemon_unavailable")
		}
	}
	if req.Write(conn) != nil {
		failure()
		return
	}
	limited := &io.LimitedReader{R: conn, N: conversationReplyLimit + 4096}
	reader := bufio.NewReader(limited)
	res, err := http.ReadResponse(reader, req)
	if err != nil {
		failure()
		return
	}
	defer res.Body.Close()
	if res.ProtoMajor != 1 || res.ProtoMinor != 1 || len(res.Header.Values("Content-Type")) != 1 || res.Header.Get("Content-Type") != "application/json" || len(res.Header.Values("Content-Length")) != 1 || res.ContentLength <= 0 || res.ContentLength > conversationReplyLimit || len(res.TransferEncoding) != 0 {
		failure()
		return
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, conversationReplyLimit+1))
	if err != nil || int64(len(data)) != res.ContentLength {
		failure()
		return
	}
	var extra [1]byte
	if n, e := reader.Read(extra[:]); n != 0 || e != io.EOF || limited.N == 0 {
		failure()
		return
	}
	if res.StatusCode != 200 {
		// Errors have a closed vocabulary. Do not reflect daemon-controlled text.
		codes := map[int]string{400: "invalid_request", 403: "cross_user_denied", 404: "resource_not_found", 409: "control_uncertain", 428: "pi_onboarding_required", 429: "capacity_exceeded", 503: "native_source_unavailable"}
		code, ok := codes[res.StatusCode]
		if !ok || !validConversationError(data, res.StatusCode) {
			failure()
			return
		}
		safe(w, res.StatusCode, code)
		return
	}
	clean, id, ok := validatedConversationReply(kind, data, match[1])
	if ok && kind == "create" {
		var input map[string]string
		_ = json.Unmarshal(body, &input)
		var reply map[string]json.RawMessage
		_ = json.Unmarshal(clean, &reply)
		ok = str(reply, "workspace_id") == input["workspace_id"]
	}
	if ok && (kind == "send" || kind == "steer" || kind == "follow_up" || kind == "clear_queue") {
		var input map[string]string
		_ = json.Unmarshal(body, &input)
		var reply map[string]json.RawMessage
		_ = json.Unmarshal(clean, &reply)
		ok = str(reply, "command_id") == input["command_id"]
	}
	if !ok {
		failure()
		return
	}
	if kind == "create" {
		// A concurrent logout must not grant its successor an orphan handle.
		a.mu.Lock()
		if current, exists := a.sessions[owner]; exists && current.csrf == s.csrf && current.identity == target {
			if a.conversations == nil {
				a.conversations = make(map[string]map[string]bool)
			}
			if a.conversations[owner] == nil {
				a.conversations[owner] = make(map[string]bool)
			}
			for other, ids := range a.conversations {
				if other != owner && ids[id] {
					a.mu.Unlock()
					failure()
					return
				}
			}
			a.conversations[owner][id] = true
		} else {
			a.mu.Unlock()
			failure()
			return
		}
		a.mu.Unlock()
	}
	// Fail closed if a logout/rebind raced the daemon response.
	a.mu.Lock()
	current, exists := a.sessions[owner]
	live := exists && current.csrf == s.csrf && current.identity == target && current.epoch == s.epoch && current.generation == s.generation
	a.mu.Unlock()
	if !live {
		failure()
		return
	}
	if kind == "list" {
		// Never expose another browser session's daemon-owned handles.
		var list struct {
			SchemaVersion int `json:"schema_version"`
			Sessions      []struct {
				AgentID     string `json:"agent_id"`
				WorkspaceID string `json:"workspace_id"`
				State       string `json:"state"`
			} `json:"sessions"`
		}
		_ = json.Unmarshal(clean, &list)
		a.mu.Lock()
		owned := a.conversations[owner]
		filtered := list.Sessions[:0]
		for _, entry := range list.Sessions {
			if owned[strings.TrimPrefix(entry.AgentID, "pi:")] {
				filtered = append(filtered, entry)
			}
		}
		a.mu.Unlock()
		list.Sessions = filtered
		if list.Sessions == nil {
			list.Sessions = make([]struct {
				AgentID     string `json:"agent_id"`
				WorkspaceID string `json:"workspace_id"`
				State       string `json:"state"`
			}, 0)
		}
		clean, _ = json.Marshal(list)
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(clean)))
	w.WriteHeader(200)
	_, _ = w.Write(clean)
}

const conversationReplyLimit = 1 << 20

func (a *Auth) ownsConversation(owner, id string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.conversations[owner][id]
}
func strictObject(data []byte, required []string, allowed ...string) (map[string]json.RawMessage, bool) {
	dec := json.NewDecoder(bytes.NewReader(data))
	start, err := dec.Token()
	if err != nil || start != json.Delim('{') {
		return nil, false
	}
	m := make(map[string]json.RawMessage)
	for dec.More() {
		token, err := dec.Token()
		if err != nil {
			return nil, false
		}
		key, ok := token.(string)
		if !ok {
			return nil, false
		}
		if _, exists := m[key]; exists {
			return nil, false
		}
		var value json.RawMessage
		if dec.Decode(&value) != nil {
			return nil, false
		}
		m[key] = value
	}
	end, err := dec.Token()
	if err != nil || end != json.Delim('}') {
		return nil, false
	}
	var trailing any
	if dec.Decode(&trailing) != io.EOF {
		return nil, false
	}
	keys := make(map[string]bool)
	for _, k := range required {
		keys[k] = true
		if _, ok := m[k]; !ok {
			return nil, false
		}
	}
	for _, k := range allowed {
		keys[k] = true
	}
	for k := range m {
		if !keys[k] {
			return nil, false
		}
	}
	return m, true
}
func str(m map[string]json.RawMessage, k string) string {
	var v string
	_ = json.Unmarshal(m[k], &v)
	return v
}
func validConversationInput(kind string, b []byte) bool {
	if kind == "create" {
		m, ok := strictObject(b, []string{"workspace_id"})
		return ok && conversationWorkspace.MatchString(str(m, "workspace_id"))
	}
	if kind == "clear_queue" {
		m, ok := strictObject(b, []string{"command_id"})
		return ok && conversationUUID.MatchString(str(m, "command_id"))
	}
	m, ok := strictObject(b, []string{"message", "command_id"})
	message := str(m, "message")
	return ok && message != "" && len(message) <= 65536 && conversationUUID.MatchString(str(m, "command_id"))
}
func validConversationError(b []byte, status int) bool {
	m, ok := strictObject(b, []string{"schema_version", "error"})
	if !ok || string(m["schema_version"]) != "1" {
		return false
	}
	e, ok := strictObject(m["error"], []string{"code", "message", "retryable", "correlation_id"})
	allowed := map[int]map[string]bool{400: {"invalid_request": true}, 403: {"cross_user_denied": true}, 404: {"resource_not_found": true}, 409: {"control_uncertain": true}, 428: {"pi_onboarding_required": true}, 429: {"capacity_exceeded": true}, 503: {"daemon_unavailable": true, "native_source_unavailable": true}}
	return ok && allowed[status][str(e, "code")] && string(e["retryable"]) == "false"
}
func stateOK(s string) bool {
	switch s {
	case "idle", "pending", "accepted", "rejected", "uncertain", "stopping":
		return true
	}
	return false
}
func validatedConversationReply(kind string, b []byte, requestedID string) ([]byte, string, bool) {
	var required, optional []string
	switch kind {
	case "create":
		required = []string{"schema_version", "agent_id", "workspace_id", "state"}
	case "list":
		required = []string{"schema_version", "sessions"}
	case "send", "steer", "follow_up":
		required = []string{"schema_version", "command_id", "state"}
	case "clear_queue":
		required = []string{"schema_version", "command_id", "state", "removed_queue"}
	case "stop":
		required = []string{"schema_version", "state"}
	case "status":
		optional = []string{"queue"}
		required = []string{"schema_version", "agent_id", "workspace_id", "state", "command_id", "ack", "event_cursor", "events", "event_loss", "native_history", "native_revision", "history_query"}
	default:
		return nil, "", false
	}
	m, ok := strictObject(b, required, optional...)
	if !ok || string(m["schema_version"]) != "1" {
		return nil, "", false
	}
	id := strings.TrimPrefix(str(m, "agent_id"), "pi:")
	validAgent := func(agent string) bool {
		return strings.HasPrefix(agent, "pi:") && conversationUUID.MatchString(strings.TrimPrefix(agent, "pi:"))
	}
	validWS := func(v string) bool { return conversationWorkspace.MatchString(v) }
	switch kind {
	case "create":
		ok = validAgent(str(m, "agent_id")) && validWS(str(m, "workspace_id")) && str(m, "state") == "idle"
	case "list":
		var entries []json.RawMessage
		ok = json.Unmarshal(m["sessions"], &entries) == nil && entries != nil && len(entries) <= 128
		for _, raw := range entries {
			item, valid := strictObject(raw, []string{"agent_id", "workspace_id", "state"})
			if !valid || !validAgent(str(item, "agent_id")) || !validWS(str(item, "workspace_id")) || !stateOK(str(item, "state")) {
				ok = false
				break
			}
		}
	case "send", "steer", "follow_up":
		ok = conversationUUID.MatchString(str(m, "command_id")) && str(m, "state") == "pending"
	case "clear_queue":
		q, valid := strictObject(m["removed_queue"], []string{"steering", "follow_up"})
		var a, b []string
		ok = valid && conversationUUID.MatchString(str(m, "command_id")) && str(m, "state") == "accepted" && json.Unmarshal(q["steering"], &a) == nil && a != nil && json.Unmarshal(q["follow_up"], &b) == nil && b != nil && len(a)+len(b) <= 128
		for _, text := range append(a, b...) {
			if len(text) > 65536 {
				ok = false
			}
		}
	case "stop":
		ok = str(m, "state") == "termination_unknown"
	case "status":
		var cursor uint64
		var events []json.RawMessage
		var lost bool
		ack := str(m, "ack")
		history := str(m, "native_history")
		ok = id == requestedID && validAgent(str(m, "agent_id")) && validWS(str(m, "workspace_id")) && stateOK(str(m, "state")) && (str(m, "command_id") == "" || conversationUUID.MatchString(str(m, "command_id"))) && (ack == "" || ack == "pending" || ack == "accepted" || ack == "rejected" || ack == "uncertain") && json.Unmarshal(m["event_cursor"], &cursor) == nil && json.Unmarshal(m["event_loss"], &lost) == nil && json.Unmarshal(m["events"], &events) == nil && events != nil && len(events) <= 64 && (history == "missing" || history == "unavailable" || history == "readable") && str(m, "history_query") == "/api/v1/agents/pi:"+id+"/history" && len(str(m, "native_revision")) <= 256
		if raw, present := m["queue"]; present {
			q, valid := strictObject(raw, []string{"revision", "steering", "follow_up"})
			var rev uint64
			var a, b []string
			if !valid || json.Unmarshal(q["revision"], &rev) != nil || json.Unmarshal(q["steering"], &a) != nil || a == nil || json.Unmarshal(q["follow_up"], &b) != nil || b == nil || len(a)+len(b) > 128 {
				ok = false
			}
			for _, text := range append(a, b...) {
				if len(text) > 65536 {
					ok = false
				}
			}
		}
		for _, event := range events {
			var object map[string]json.RawMessage
			if json.Unmarshal(event, &object) != nil || object == nil || len(event) > 8192 {
				ok = false
				break
			}
		}
	}
	if !ok {
		return nil, "", false
	}
	clean, err := json.Marshal(m)
	return clean, id, err == nil
}
