//go:build linux

package gateway

import (
	"net/http"
	"regexp"
)

var workspaceGitID = regexp.MustCompile(`^ws_[A-Za-z0-9_-]{8,64}$`)

func (a *Auth) workspaceGit(w http.ResponseWriter, r *http.Request) {
	const path = "/api/v1/workspaces/git"
	id := r.URL.Query().Get("workspace_id")
	if r.Method != "GET" || !a.exact(r, path, "workspace_id") || r.URL.EscapedPath() != path || r.URL.RawQuery != "workspace_id="+id || !workspaceGitID.MatchString(id) || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || r.ProtoMajor != 1 || r.ProtoMinor != 1 {
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
