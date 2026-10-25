//go:build linux

package daemon

import (
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/daemon/integrations"
	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"github.com/Open-Habitat/open-habitat/internal/entryfence"
	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

type AgentListener struct {
	Listener        *net.UnixListener
	Version, Commit string
}

const AgentEnvironmentPath = "/agent/v1/environment"
const AgentWorkspacesPath = "/agent/v1/workspaces"
const AgentModelsPath = "/agent/v1/models"
const AgentConversationPath = "/agent/v1/conversation"

// No fall-through to the browser mux. Unknown paths, methods and query fields
// are rejected before any native read; identity hints have no authority.
func agentHandler(cfg transport.Config, controller *ConversationController, version, commit string, pi *PiDevice, cloneSets ...*CloneJobs) http.Handler {
	return agentHandlerWithIntegrations(cfg, controller, version, commit, pi, nil, cloneSets...)
}

func agentHandlerWithIntegrations(cfg transport.Config, controller *ConversationController, version, commit string, pi *PiDevice, catalog *integrations.Catalog, cloneSets ...*CloneJobs) http.Handler {
	return agentHandlerWithLogins(cfg, controller, version, commit, pi, catalog, &claudeLogin{device: pi}, cloneSets...)
}

func agentHandlerWithLogins(cfg transport.Config, controller *ConversationController, version, commit string, pi *PiDevice, catalog *integrations.Catalog, claude *claudeLogin, cloneSets ...*CloneJobs) http.Handler {
	var clones *CloneJobs
	if len(cloneSets) > 0 {
		clones = cloneSets[0]
	}
	routes := agentWorkspaceRoutes(cfg, controller, clones)
	var onAuthenticated func()
	if controller != nil {
		onAuthenticated = controller.ClearPiAuthFailures
	}
	for path, handler := range agentIntegrationRoutes(cfg, pi, catalog, claude, onAuthenticated) {
		routes[path] = handler
	}
	native := cfg
	if controller != nil && controller.home != "" {
		native = controller.nativeCfg()
	}
	history := agentHistoryHandler(native)
	attachments := attachmentsHandlerAt(cfg, transport.AgentPeer, AgentAttachmentsPath)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if reason := entryfence.Reason(entryfence.AgentUpgradePath); reason != "" {
				diagnostic.New(os.Stderr, "daemon").Warn("agent_mutation", "outcome", "denied", "reason", reason)
				snapshotError(w, http.StatusServiceUnavailable, "host_maintenance")
				return
			}
		}
		if !transport.AgentPeer(r) {
			snapshotError(w, 403, "peer_not_authorized")
			return
		}
		if r.URL.RawPath == "" && r.RequestURI == r.URL.RequestURI() {
			switch {
			case r.URL.Path == AgentHistoryPath || strings.HasPrefix(r.URL.Path, AgentHistoryPath+"/"):
				history.ServeHTTP(w, r)
				return
			case r.URL.Path == AgentAttachmentsPath || strings.HasPrefix(r.URL.Path, AgentAttachmentsPath+"/"):
				attachments.ServeHTTP(w, r)
				return
			}

			if r.URL.Path == AgentViewsPath || r.URL.Path == AgentViewRemovePath {
				controller.agentViews(w, r)
				return
			}
			if handler, ok := routes[r.URL.Path]; ok {
				extendAgentWorkspaceReply(w)
				handler.ServeHTTP(w, r)
				return
			}
		}
		if r.URL.RawPath == "" && r.RequestURI == r.URL.RequestURI() && (r.URL.Path == AgentConversationsPath || strings.HasPrefix(r.URL.Path, AgentConversationsPath+"/")) {
			controller.agentConversations(w, r)
			return
		}
		if (r.Method != "GET" && !(r.Method == "POST" && (r.URL.Path == AgentNoticesPath || r.URL.Path == AgentModelsPath))) || r.URL.RawPath != "" || r.RequestURI != r.URL.RequestURI() {
			snapshotError(w, 404, "route_not_found")
			return
		}
		switch r.URL.Path {
		case AgentModelsPath:
			if r.URL.RawQuery != "" {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			servePiModels(w, r, pi)
		case AgentNoticesPath:
			controller.agentNotices(w, r)
		case AgentEnvironmentPath:
			if r.URL.RawQuery != "" {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			historyJSON(w, agentEnvironment(version, commit, time.Now()))
		case AgentWorkspacesPath:
			if r.URL.RawQuery != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			agentWorkspaceList(w, cfg)
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
	if noUserQuota() {
		quota = map[string]any{"state": "not_in_use", "source": "storage_policy"}
	} else if q, err := storagequota.Read(uint32(os.Geteuid())); err == nil {
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
