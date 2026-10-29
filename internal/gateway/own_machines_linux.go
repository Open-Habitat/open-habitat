//go:build linux

package gateway

import "net/http"

const ownMachinesPath = "/api/v1/own-machines"

// ownMachines relays the person's own-machine reads and requests to their
// daemon, which alone runs their Tailscale node and SSH. Nothing here sees a
// key, a login URL's use or a machine.
func (a *Auth) ownMachines(w http.ResponseWriter, r *http.Request) {
	post := r.Method == http.MethodPost
	if r.URL.Path != ownMachinesPath || r.URL.EscapedPath() != ownMachinesPath || r.URL.RawQuery != "" || !browserHTTP(r) || len(r.TransferEncoding) != 0 || (!post && r.Method != http.MethodGet) || (!post && r.ContentLength > 0) || (post && (r.ContentLength < 2 || r.ContentLength > 512 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1)) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if post {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}
