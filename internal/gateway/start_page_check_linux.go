//go:build linux

package gateway

import "net/http"

const workspaceStartPageCheckPath = "/api/v1/workspaces/start_page/check"

// Buffer content uses POST, so it follows ordinary session/CSRF forwarding.
// Only the person's daemon interprets it.
func (a *Auth) workspaceStartPageCheck(w http.ResponseWriter, r *http.Request) {
	const path = workspaceStartPageCheckPath
	if r.Method != http.MethodPost || !a.exact(r, path) || r.URL.EscapedPath() != path || r.RequestURI != path || r.ContentLength < 2 || r.ContentLength > 6*32*1024+1024 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 || len(r.TransferEncoding) != 0 || !browserHTTP(r) {
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
