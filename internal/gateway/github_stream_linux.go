//go:build linux

package gateway

import (
	"net/http"
)

const githubCloneStreamPath = githubClonePath + "/stream"

// A new stream is authorized once at admission. The mapped socket is the only
// upstream; its bytes are forwarded by the common proxy. The browser validates
// each bounded frame before displaying it and never treats EOF as success.
func (a *Auth) githubCloneStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !a.exact(r, githubCloneStreamPath) || r.URL.EscapedPath() != githubCloneStreamPath || r.RequestURI != githubCloneStreamPath || r.ContentLength < 1 || r.ContentLength > 256 || len(r.TransferEncoding) != 0 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 || r.Header.Get("Last-Event-ID") != "" {
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
	a.proxy(w, r, s, true)
}
