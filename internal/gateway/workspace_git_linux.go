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

// Hae etärepo: the gateway checks the session, Origin and CSRF and forwards
// to the mapped daemon, which runs the fetch as that user.
func (a *Auth) workspaceGitFetch(w http.ResponseWriter, r *http.Request) {
	const path = "/api/v1/workspaces/git/fetch"
	if r.Method != http.MethodPost || !a.exact(r, path) || r.URL.EscapedPath() != path || r.RequestURI != path || r.ContentLength < 2 || r.ContentLength > 256 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 || len(r.TransferEncoding) != 0 || r.ProtoMajor != 1 || r.ProtoMinor != 1 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if denied := a.authorizeWrite(r, s); denied != "" {
		safe(w, 403, denied)
		return
	}
	a.proxy(w, r, s, false)
}
