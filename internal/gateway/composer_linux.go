//go:build linux

package gateway

import (
	"net/http"
	"net/url"
)

// The composer's reads of one workspace: Pi's command list before the
// conversation has a Pi, and its file names, folders and one file's preview. The
// gateway checks the session and the exact query shape and relays; the
// daemon, running as the person, validates the values and reads.
const (
	workspaceStartPagePath   = "/api/v1/workspaces/start_page"
	workspaceCommandsPath    = "/api/v1/workspaces/commands"
	workspaceFilesPath       = "/api/v1/workspaces/files"
	workspaceFilePreviewPath = "/api/v1/workspaces/file_preview"
	workspaceFileTreePath    = "/api/v1/workspaces/file_tree"
)

func (a *Auth) workspaceComposerRead(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	q, err := url.ParseQuery(r.URL.RawQuery)
	shape := false
	switch path {
	case workspaceCommandsPath, workspaceStartPagePath:
		shape = a.exact(r, path, "workspace_id")
	case workspaceFilesPath:
		// rank=name: the in-field list's order, name first.
		shape = a.exact(r, path, "workspace_id") || (len(q["query"]) == 1 && a.exact(r, path, "workspace_id", "query")) || (q.Get("rank") == "name" && a.exact(r, path, "workspace_id", "query", "rank"))
	case workspaceFileTreePath:
		shape = a.exact(r, path, "workspace_id") || a.exact(r, path, "workspace_id", "folder")
	case workspaceFilePreviewPath:
		shape = a.exact(r, path, "workspace_id", "path")
	}
	if err != nil || !shape || r.Method != http.MethodGet || r.URL.EscapedPath() != path || !workspaceGitID.MatchString(q.Get("workspace_id")) || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || !browserHTTP(r) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	a.proxy(w, r, s, false)
}
