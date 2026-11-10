//go:build linux

package daemon

import (
	"context"
	"net/http"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const AgentWorkspaceOperationsPath = "/agent/v1/workspace-operations"
const AgentRepositoriesPath = "/agent/v1/repositories"
const AgentRepositoryPath = "/agent/v1/repository"
const AgentCheckoutPath = "/agent/v1/checkout"
const AgentClonesPath = "/agent/v1/clones"

func agentWorkspaceAction(action string) bool {
	switch action {
	case "create", "settings", "visibility", "delete_check", "delete", "trash_list", "trash_inspect", "trash_restore", "trash_delete", "trash_empty", "worktree_list", "worktree_remove", "worktree_clean_merged":
		return true
	}
	return false
}

// Explicit adapters to shared operations, not to the browser mux. In particular
// publishing, token handoff and git_init are not exposed by this table.
func agentWorkspaceRoutes(cfg transport.Config, c *ConversationController, clones *CloneJobs) map[string]http.Handler {
	run := func(ctx context.Context, args ...string) ([]byte, error) { return runRepoGH(ctx, cfg.Home, args...) }
	routes := map[string]http.Handler{
		AgentWorkspaceOperationsPath: workspaceHandlerAt(cfg, transport.AgentPeer, c, AgentWorkspaceOperationsPath, true),
		AgentRepositoriesPath:        repoCatalogHandlerAt(cfg, transport.AgentPeer, run, AgentRepositoriesPath),
		AgentRepositoryPath:          repoLookupHandlerAt(cfg, transport.AgentPeer, run, AgentRepositoryPath, c.githubOrgs()),
		AgentCheckoutPath:            repoObserveHandlerAt(cfg, transport.AgentPeer, cfg.Home, "/usr/bin/git", cloneCommand, clones, AgentCheckoutPath),
	}
	if clones != nil {
		routes[AgentClonesPath] = clones.handlerAt(AgentClonesPath, transport.AgentPeer)
	}
	return routes
}

func agentWorkspaceList(w http.ResponseWriter, cfg transport.Config) {
	d := Discover(cfg)
	if d.State == "error" || d.State == "partial" {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	state, annotationErr := loadVisibility(cfg.Home)
	annotationState := "readable"
	if annotationErr != nil {
		annotationState = "unreadable"
	}
	entries := make([]any, 0, len(d.Entries))
	for _, e := range d.Entries {
		id := workspaceID(cfg, e)
		display := e.DisplayName
		if display == "" {
			display = e.Name
		}
		var hidden any
		if annotationErr == nil {
			hidden = state.Workspaces[id].Hidden
		}
		entries = append(entries, map[string]any{"workspace_id": id, "name": e.Name, "path": cfg.Home + "/src/" + e.Name, "kind": e.Kind, "observation_token": workspaceToken(cfg, e), "display_name": display, "hidden": hidden})
	}
	reply := map[string]any{"schema_version": 1, "state": d.State, "workspaces": entries, "annotation_state": annotationState}
	// Missing src is an observation, not authority to create it. The existing
	// workspace creation operation requires a safely opened source directory.
	if src, source, err := workspaceSource(cfg); err == nil {
		unix.Close(src)
		reply["user_observation_token"] = workspaceUserToken(cfg, source)
	}
	historyJSON(w, reply)
}

func extendAgentWorkspaceReply(w http.ResponseWriter) { extendReply(w, 4*time.Minute) }
