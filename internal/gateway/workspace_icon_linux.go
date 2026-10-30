//go:build linux

package gateway

import (
	"net/http"
	"net/url"
)

// A workspace's icon image comes from the person's repository, which their
// agents write, so it is untrusted content on the app origin. The browser
// shows it only as an <img>, where an SVG runs nothing; this policy keeps it
// inert when the address is opened on its own too, and nosniff keeps the
// daemon's image type from being reinterpreted.
const (
	workspaceIconPath = "/api/v1/workspaces/icon"
	workspaceIconCSP  = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'"
)

func (a *Auth) workspaceIcon(w http.ResponseWriter, r *http.Request) {
	q, err := url.ParseQuery(r.URL.RawQuery)
	short := len(q.Get("v")) <= 64 && (len(q["logo"]) == 0 || q.Get("logo") == "1")
	shape := short && (a.exact(r, workspaceIconPath, "workspace_id") || a.exact(r, workspaceIconPath, "workspace_id", "v") || a.exact(r, workspaceIconPath, "workspace_id", "logo") || a.exact(r, workspaceIconPath, "workspace_id", "v", "logo"))
	if err != nil || !shape || r.Method != http.MethodGet || r.URL.EscapedPath() != workspaceIconPath || !workspaceGitID.MatchString(q.Get("workspace_id")) || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || !browserHTTP(r) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	w.Header().Add("Content-Security-Policy", workspaceIconCSP)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	a.proxy(w, r, s, false)
}
