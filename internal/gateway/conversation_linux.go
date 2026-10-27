//go:build linux

package gateway

import (
	"net/http"
	"regexp"
	"strings"
)

var conversationPath = regexp.MustCompile(`^/api/v1/conversations(?:/([0-9a-fA-F-]{36})/(send|steer|follow_up|clear_queue|regenerate_title|history_title|recap|presence|question|abort|status|eligibility|receipt|stop|continue|cancel_held|close|commands|bash|abort_bash))?$`)
var conversationStreamCursor = regexp.MustCompile(`^ev1:[0-9a-fA-F-]{36}:[0-9]{1,20}$`)
var conversationUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

const conversationBase = "/api/v1/conversations"

func (a *Auth) conversation(w http.ResponseWriter, r *http.Request) {
	path := r.URL.EscapedPath()
	if strings.Contains(path, "/processes") {
		a.processConversation(w, r)
		return
	}
	events := path == "/api/v1/events"
	match := conversationPath.FindStringSubmatch(path)
	if events {
		match = []string{path, "", "events"}
	}
	if match == nil || path != r.URL.Path || (events && (r.Method != http.MethodGet || !a.exact(r, path, "after") || !conversationStreamCursor.MatchString(r.URL.Query().Get("after")))) || (!events && match[2] == "status" && !(a.exact(r, path) || (a.exact(r, path, "continuation") && r.URL.Query().Get("continuation") == "true"))) || (!events && match[2] == "receipt" && (!a.exact(r, path, "command_id") || !conversationUUID.MatchString(r.URL.Query().Get("command_id")))) || (!events && match[2] != "receipt" && match[2] != "status" && !a.exact(r, path)) || (r.Method != http.MethodGet && r.Method != http.MethodPost) || (match[1] != "" && (match[2] == "status" || match[2] == "eligibility" || match[2] == "receipt" || match[2] == "commands") != (r.Method == http.MethodGet)) {
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
	if match[1] != "" && !conversationUUID.MatchString(match[1]) {
		safe(w, 404, "resource_not_found")
		return
	}
	// The daemon is the single validator of control input. Cap request bytes at
	// the transport boundary, without interpreting its JSON or rejecting extensions.
	if r.ContentLength > proxyRequestLimit {
		safe(w, 400, "invalid_request")
		return
	}
	a.proxy(w, r, s, stream)
}

var processConversationPath = regexp.MustCompile(`^/api/v1/conversations/([0-9a-fA-F-]{36})/processes(?:/(clear-finished)|/(proc_[a-f0-9]{4})/(output|stop))?$`)

func (a *Auth) processConversation(w http.ResponseWriter, r *http.Request) {
	path := r.URL.EscapedPath()
	m := processConversationPath.FindStringSubmatch(path)
	if m == nil || path != r.URL.Path || !conversationUUID.MatchString(m[1]) {
		safe(w, 400, "invalid_request")
		return
	}
	output := m[4] == "output"
	read := m[2] == "" && (m[3] == "" || output)
	if (read && r.Method != http.MethodGet) || (!read && r.Method != http.MethodPost) || (output && !a.exact(r, path, "owner_generation", "process_token", "tail_lines")) || (!output && !a.exact(r, path)) || r.ContentLength > proxyRequestLimit {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if !read {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}
