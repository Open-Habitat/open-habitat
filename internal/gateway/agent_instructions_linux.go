//go:build linux

package gateway

import "net/http"

const agentInstructionsPath = "/api/v1/account/agent-instructions"

// agentInstructions relays the read and the compare-and-swap write of the
// person's own instructions file to their daemon, which alone reads and
// writes it as the person. The gateway checks only the request's shape, the
// session and, for a write, CSRF; it never parses or keeps the text.
func (a *Auth) agentInstructions(w http.ResponseWriter, r *http.Request) {
	put := r.Method == http.MethodPut
	if r.URL.Path != agentInstructionsPath || r.URL.EscapedPath() != agentInstructionsPath || r.URL.RawQuery != "" || !browserHTTP(r) || len(r.TransferEncoding) != 0 || (!put && r.Method != http.MethodGet) || (!put && r.ContentLength > 0) || (put && (r.ContentLength < 2 || r.ContentLength > 2<<20 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1)) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if put {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}
