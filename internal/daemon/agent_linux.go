//go:build linux

package daemon

import (
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

type AgentListener struct {
	Listener        *net.UnixListener
	Version, Commit string
}

const AgentEnvironmentPath = "/agent/v1/environment"
const AgentWorkspacesPath = "/agent/v1/workspaces"
const AgentConversationPath = "/agent/v1/conversation"

// No fall-through to the browser mux. Unknown paths, methods and query fields
// are rejected before any native read; identity hints have no authority.
func agentHandler(cfg transport.Config, controller *ConversationController, version, commit string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !transport.AgentPeer(r) {
			snapshotError(w, 403, "peer_not_authorized")
			return
		}
		if r.Method != "GET" || r.URL.RawPath != "" || r.RequestURI != r.URL.RequestURI() {
			snapshotError(w, 404, "route_not_found")
			return
		}
		switch r.URL.Path {
		case AgentEnvironmentPath:
			if r.URL.RawQuery != "" {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			historyJSON(w, agentEnvironment(version, commit, time.Now()))
		case AgentWorkspacesPath:
			if r.URL.RawQuery != "" {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			d := Discover(cfg)
			if d.State == "error" || d.State == "partial" {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			entries := make([]any, 0, len(d.Entries))
			for _, e := range d.Entries {
				id := workspaceID(cfg, e)
				entries = append(entries, map[string]any{"workspace_id": id, "name": e.Name, "path": cfg.Home + "/src/" + e.Name, "kind": e.Kind})
			}
			historyJSON(w, map[string]any{"schema_version": 1, "state": d.State, "workspaces": entries})
		case AgentConversationPath:
			q, err := parseAgentConversation(r)
			if err {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			controller.mu.Lock()
			s := controller.sessions[strings.TrimPrefix(q.id, "pi:")]
			if s == nil {
				controller.mu.Unlock()
				if q.current {
					snapshotError(w, 409, "current_context_stale")
					return
				}
				snapshotError(w, 404, "conversation_not_found")
				return
			}
			if q.current && (s.workspace != q.workspace || s.dead || s.rpc == nil || s.rpc.processGeneration != q.generation || s.rpc.closing.Load() || channelClosed(s.rpc.exited)) {
				controller.mu.Unlock()
				snapshotError(w, 409, "current_context_stale")
				return
			}
			reply := map[string]any{"schema_version": 1, "agent_id": "pi:" + s.id, "workspace_id": s.workspace, "state": s.state}
			controller.mu.Unlock()
			historyJSON(w, reply)
		default:
			snapshotError(w, 404, "route_not_found")
		}
	})
}
func workspaceID(cfg transport.Config, e Workspace) string {
	if e.WorkspaceID != "" {
		return e.WorkspaceID
	}
	return opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+e.Name)
}
func channelClosed(c <-chan struct{}) bool {
	select {
	case <-c:
		return true
	default:
		return false
	}
}

type agentConversationQuery struct {
	id, workspace, generation string
	current                   bool
}

func parseAgentConversation(r *http.Request) (agentConversationQuery, bool) {
	q, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return agentConversationQuery{}, true
	}
	v := agentConversationQuery{id: q.Get("id"), workspace: q.Get("workspace_id"), generation: q.Get("generation"), current: q.Get("current") == "true"}
	if len(q["id"]) != 1 || !strings.HasPrefix(v.id, "pi:") || !sessionIDPattern.MatchString(strings.TrimPrefix(v.id, "pi:")) {
		return v, true
	}
	if v.current {
		if len(q) != 4 || len(q["current"]) != 1 || len(q["workspace_id"]) != 1 || len(q["generation"]) != 1 || !idPattern.MatchString(v.workspace) || !sessionIDPattern.MatchString(v.generation) {
			return v, true
		}
	} else if len(q) != 1 {
		return v, true
	}
	return v, false
}
func agentEnvironment(version, commit string, now time.Time) map[string]any {
	quota := map[string]any{"state": "unavailable", "reason": "quota_unavailable", "source": "linux_quotactl_fd"}
	if q, err := storagequota.Read(uint32(os.Geteuid())); err == nil {
		quota = map[string]any{"state": "available", "usage_bytes": q.Usage, "hard_limit_bytes": q.Limit, "enforced": true, "source": "linux_quotactl_fd"}
	}
	fs := map[string]any{"state": "unavailable", "reason": "filesystem_unavailable", "source": "linux_statfs"}
	if f, err := storagequota.Capacity(); err == nil {
		fs = map[string]any{"state": "available", "capacity_bytes": f.Capacity, "free_bytes": f.Free, "source": "linux_statfs"}
	}
	var revision any
	if commit != "" {
		revision = commit
	}
	return map[string]any{"schema_version": 1, "observed_at": now.UTC().Format(time.RFC3339Nano), "daemon": map[string]any{"version": version, "commit": revision}, "quota": quota, "filesystem": fs}
}
