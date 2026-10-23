//go:build linux

package gateway

import "net/http"

// The gateway checks the browser session and CSRF; only the per-user daemon
// resolves workspace IDs against native filesystem entries.
func (a *Auth) workspaces(w http.ResponseWriter, r *http.Request) {
	const path = "/api/v1/workspaces"
	if r.Method != http.MethodPost || !a.exact(r, path) || r.RequestURI != path || r.URL.EscapedPath() != path || !browserHTTP(r) || r.ContentLength < 2 || r.ContentLength > 2048 || len(r.TransferEncoding) != 0 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
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
