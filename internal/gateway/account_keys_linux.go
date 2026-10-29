//go:build linux

package gateway

import "net/http"

const accountKeysPath = "/api/v1/account/keys"

// accountKeys relays a read of the person's public keys, or a request to
// create one default key, to their daemon. The daemon alone reads the key
// files and runs the key tools; nothing here sees a key.
func (a *Auth) accountKeys(w http.ResponseWriter, r *http.Request) {
	post := r.Method == http.MethodPost
	if r.URL.Path != accountKeysPath || r.URL.EscapedPath() != accountKeysPath || r.URL.RawQuery != "" || !browserHTTP(r) || len(r.TransferEncoding) != 0 || (!post && r.Method != http.MethodGet) || (!post && r.ContentLength > 0) || (post && (r.ContentLength < 2 || r.ContentLength > 128 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1)) {
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
