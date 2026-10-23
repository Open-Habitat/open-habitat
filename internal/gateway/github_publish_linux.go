//go:build linux

package gateway

import "net/http"

// The gateway supplies only the authenticated mapped socket and CSRF check;
// the user's daemon observes its own GitHub identity and native workspace.
func (a *Auth) githubPublish(w http.ResponseWriter, r *http.Request) {
	const path = "/api/v1/workspaces/github/publish"
	if !a.exact(r, path, "workspace_id", "full_name", "visibility") && r.Method == "GET" || !a.exact(r, path) && r.Method == "POST" || r.URL.EscapedPath() != path || !browserHTTP(r) || len(r.TransferEncoding) != 0 || (r.Method != http.MethodGet && r.Method != http.MethodPost) || r.Method == http.MethodPost && (r.RequestURI != path || r.ContentLength < 2 || r.ContentLength > 1024 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1) || r.Method == http.MethodGet && (r.ContentLength > 0 || r.URL.RawQuery == "") {
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
	a.proxy(w, r, s, false)
}
