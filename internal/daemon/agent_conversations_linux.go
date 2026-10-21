//go:build linux

package daemon

import (
	"net/http"
	"net/url"
	"strings"
	"time"
)

const AgentConversationsPath = "/agent/v1/conversations"

// Called only after AgentPeer. This is an explicit operation table, not a
// forwarding adapter to ServeHTTP: adding a browser route grants nothing here.
func (c *ConversationController) agentConversations(w http.ResponseWriter, r *http.Request) {
	if _, err := url.ParseQuery(r.URL.RawQuery); err != nil {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, AgentConversationsPath+"/"), "/")
	if len(parts) >= 2 && attachmentID.MatchString(parts[0]) && parts[1] == "processes" {
		c.processRoutes(w, r, parts)
		return
	}
	if len(parts) == 2 && attachmentID.MatchString(parts[0]) && parts[1] == "receipt" && r.Method == "GET" {
		q := r.URL.Query()
		if len(q) != 1 || len(q["command_id"]) != 1 || !attachmentID.MatchString(q.Get("command_id")) {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
		c.readReceipt(w, r, parts[0])
		return
	}
	if r.URL.RawQuery != "" {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	if r.URL.Path == AgentConversationsPath {
		switch r.Method {
		case "GET":
			if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			c.list(w)
		case "POST":
			c.create(w, r)
		default:
			snapshotError(w, 404, "route_not_found")
		}
		return
	}
	if len(parts) != 2 || !sessionIDPattern.MatchString(parts[0]) {
		snapshotError(w, 404, "route_not_found")
		return
	}
	id, action := parts[0], parts[1]
	if r.Method == "GET" {
		if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		switch action {
		case "status":
			c.observe(w, r, id)
		case "eligibility":
			c.historyEligibility(w, r, id)
		case "archive":
			c.agentArchiveObservation(w, id)
		case "recap":
			sessions, err := nativeSessions(c.nativeCfg())
			if err != nil {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			serveNativeRecap(w, c.nativeCfg(), sessions, "pi:"+id)
		default:
			snapshotError(w, 404, "route_not_found")
		}
		return
	}
	if r.Method != "POST" {
		snapshotError(w, 404, "route_not_found")
		return
	}
	// Native title/recap calls may exceed the socket's default five seconds.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(60 * time.Second))
	switch action {
	case "send", "steer", "follow_up":
		c.sendKind(w, r, id, action)
	case "clear_queue":
		c.clearQueue(w, r, id)
	case "cancel_held":
		c.cancelHeld(w, r, id)
	case "continue":
		c.continueEnded(w, r, id)
	case "abort":
		c.abort(w, r, id)
	case "stop":
		c.stop(w, r, id)
	case "close":
		c.closeEmpty(w, r, id)
	case "archive":
		c.archive(w, r, id)
	case "regenerate_title":
		c.regenerateTitle(w, r, id)
	case "history_title":
		c.historyTitle(w, r, id)
	case "recap":
		c.requestRecap(w, r, id)
	default:
		snapshotError(w, 404, "route_not_found")
	}
}

// The same native header revision used by snapshot/archiveInput. A token is an
// observation, not a reservation; archiveInput re-proves ownership and freshness.
func (c *ConversationController) agentArchiveObservation(w http.ResponseWriter, id string) {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	for _, s := range sessions {
		if s.id != id {
			continue
		}
		if s.state != "readable" {
			snapshotError(w, 409, "control_uncertain")
			return
		}
		state, err := loadVisibility(c.home)
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "observation_token": opaque("obs_", id+":"+s.revision), "archive": archiveFact(state, nil, "pi:"+id)})
		return
	}
	snapshotError(w, 404, "resource_not_found")
}
