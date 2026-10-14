//go:build linux

package gateway

import "net/http"

const gitIdentityPath = "/api/v1/account/git-identity"

func (a *Auth) gitIdentity(w http.ResponseWriter, r *http.Request) {
	if (r.Method != "GET" && r.Method != "POST") || !a.exact(r, gitIdentityPath) || r.RequestURI != gitIdentityPath || len(r.TransferEncoding) != 0 || r.Method == "POST" && (r.ContentLength < 2 || r.ContentLength > 1024 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1) || r.Method == "GET" && r.ContentLength > 0 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method == "POST" {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}
