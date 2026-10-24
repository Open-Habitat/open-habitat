//go:build linux

package gateway

import "net/http"

const (
	editorPreferencePath = "/api/v1/account/editor-preference"
	firstRoutePath       = "/api/v1/account/first-route"
)

// personalSetting relays a read or a replacing write of one small piece of
// the person's own state (the editor choice, the first-route mark) to their
// daemon, which alone reads and writes it.
func (a *Auth) personalSetting(path string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { a.personalSettingHTTP(path, w, r) }
}

func (a *Auth) personalSettingHTTP(path string, w http.ResponseWriter, r *http.Request) {
	put := r.Method == http.MethodPut
	if r.URL.Path != path || r.URL.EscapedPath() != path || r.URL.RawQuery != "" || !browserHTTP(r) || len(r.TransferEncoding) != 0 || (!put && r.Method != http.MethodGet) || (!put && r.ContentLength > 0) || (put && (r.ContentLength < 2 || r.ContentLength > 128 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1)) {
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
