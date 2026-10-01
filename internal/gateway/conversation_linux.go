//go:build linux

package gateway

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
)

// The browser-session lease is removed in the later ownership step. Until then
// the gateway must filter lists and record successful creates for that session.
var conversationPath = regexp.MustCompile(`^/api/v1/conversations(?:/([0-9a-fA-F-]{36})/(send|steer|follow_up|clear_queue|question|abort|status|receipt|stop|continue))?$`)
var conversationStreamCursor = regexp.MustCompile(`^ev1:[0-9a-fA-F-]{36}:[0-9]{1,20}$`)
var conversationUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

const conversationBase = "/api/v1/conversations"

func (a *Auth) conversation(w http.ResponseWriter, r *http.Request) {
	path := r.URL.EscapedPath()
	events := path == "/api/v1/events"
	match := conversationPath.FindStringSubmatch(path)
	if events {
		match = []string{path, "", "events"}
	}
	if match == nil || path != r.URL.Path || (events && (r.Method != http.MethodGet || !a.exact(r, path, "after") || !conversationStreamCursor.MatchString(r.URL.Query().Get("after")))) || (!events && match[2] == "status" && !(a.exact(r, path) || (a.exact(r, path, "continuation") && r.URL.Query().Get("continuation") == "true"))) || (!events && match[2] == "receipt" && (!a.exact(r, path, "command_id") || !conversationUUID.MatchString(r.URL.Query().Get("command_id")))) || (!events && match[2] != "receipt" && match[2] != "status" && !a.exact(r, path)) || (r.Method != http.MethodGet && r.Method != http.MethodPost) || (match[1] != "" && (match[2] == "status" || match[2] == "receipt") != (r.Method == http.MethodGet)) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method == http.MethodPost {
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
	if events {
		kind = "events"
	} else if match[1] != "" {
		kind = match[2]
	} else if r.Method == http.MethodPost {
		kind = "create"
	}
	stream := kind == "events"
	if stream {
		last := r.Header.Get("Last-Event-ID")
		if len(r.Header.Values("Last-Event-ID")) > 1 || len(last) > 100 || last != "" && !conversationStreamCursor.MatchString(last) {
			safe(w, 400, "invalid_request")
			return
		}
	}
	if match[1] != "" && (!conversationUUID.MatchString(match[1]) || !a.ownsConversation(owner, match[1])) {
		safe(w, 404, "resource_not_found")
		return
	}
	// The daemon is the single validator of control input. Cap request bytes at
	// the transport boundary, without interpreting its JSON or rejecting extensions.
	if r.ContentLength > proxyRequestLimit {
		safe(w, 400, "invalid_request")
		return
	}
	var onReply func([]byte) ([]byte, bool)
	if kind == "create" {
		onReply = func(data []byte) ([]byte, bool) {
			var reply struct {
				AgentID string `json:"agent_id"`
			}
			if json.Unmarshal(data, &reply) != nil || !strings.HasPrefix(reply.AgentID, "pi:") || !conversationUUID.MatchString(strings.TrimPrefix(reply.AgentID, "pi:")) {
				return nil, false
			}
			id := strings.TrimPrefix(reply.AgentID, "pi:")
			a.mu.Lock()
			defer a.mu.Unlock()
			current, live := a.sessions[owner]
			if !live || current.csrf != s.csrf || current.identity != s.identity {
				return nil, false
			}
			if a.conversations == nil {
				a.conversations = make(map[string]map[string]bool)
			}
			for other, ids := range a.conversations {
				if other != owner && ids[id] {
					return nil, false
				}
			}
			if a.conversations[owner] == nil {
				a.conversations[owner] = make(map[string]bool)
			}
			a.conversations[owner][id] = true
			return data, true
		}
	} else if kind == "list" {
		onReply = func(data []byte) ([]byte, bool) {
			// Preserve unknown top-level and entry fields. Only ownership filtering is
			// unavoidable while leases remain browser-session scoped.
			var reply map[string]json.RawMessage
			if json.Unmarshal(data, &reply) != nil {
				return nil, false
			}
			var entries []json.RawMessage
			if json.Unmarshal(reply["sessions"], &entries) != nil {
				return nil, false
			}
			a.mu.Lock()
			owned := make(map[string]bool, len(a.conversations[owner]))
			for id := range a.conversations[owner] {
				owned[id] = true
			}
			a.mu.Unlock()
			filtered := make([]json.RawMessage, 0, len(entries))
			for _, entry := range entries {
				var item struct {
					AgentID string `json:"agent_id"`
				}
				if json.Unmarshal(entry, &item) != nil {
					return nil, false
				}
				if owned[strings.TrimPrefix(item.AgentID, "pi:")] {
					filtered = append(filtered, entry)
				}
			}
			reply["sessions"], _ = json.Marshal(filtered)
			result, err := json.Marshal(reply)
			return result, err == nil
		}
	}
	a.proxy(w, r, s, stream, onReply)
}

func (a *Auth) ownsConversation(owner, id string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.conversations[owner][id]
}
