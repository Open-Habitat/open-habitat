//go:build linux

package daemon

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/open-habitat/open-habitat/internal/transport"
)

const AgentHistoryPath = "/agent/v1/history"
const AgentAttachmentsPath = "/agent/v1/attachments"

// This adapter admits only history/block reads, never the shared handler's
// spinoff/recap routes or a browser mux. Peer authority stays AgentPeer.
func agentHistoryHandler(cfg transport.Config) http.Handler {
	shared := HistoryHandler(cfg, transport.AgentPeer)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := url.ParseQuery(r.URL.RawQuery); err != nil {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
		if r.Method != "GET" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if r.URL.Path == AgentHistoryPath {
			if r.URL.RawQuery != "" {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			sessions, err := nativeSessions(cfg)
			if err != nil {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			rows := make([]map[string]any, 0, len(sessions))
			for _, s := range sessions {
				rows = append(rows, map[string]any{"agent_id": "pi:" + s.id, "cwd": s.cwd, "state": s.state, "native_revision": s.revision, "started_at": s.startedAt})
			}
			historyJSON(w, map[string]any{"schema_version": 1, "sessions": rows})
			return
		}
		suffix := strings.TrimPrefix(r.URL.Path, AgentHistoryPath+"/")
		parts := strings.Split(suffix, "/")
		if len(parts) < 1 || !strings.HasPrefix(parts[0], "pi:") || !attachmentID.MatchString(strings.TrimPrefix(parts[0], "pi:")) {
			snapshotError(w, 404, "route_not_found")
			return
		}
		path := "/api/v1/agents/" + suffix
		if len(parts) == 1 {
			path += "/history"
		} else if !blockReadPath.MatchString(path) {
			snapshotError(w, 404, "route_not_found")
			return
		}
		// Preserve query/context and kernel peer, replace only the explicitly admitted path.
		copy := r.Clone(r.Context())
		u := *r.URL
		copy.URL = &u
		copy.URL.Path = path
		copy.RequestURI = copy.URL.RequestURI()
		shared.ServeHTTP(w, copy)
	})
}
