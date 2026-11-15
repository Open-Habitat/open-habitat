//go:build linux

package gateway

import (
	"net/http"
	"strings"
	"unicode/utf8"
)

const searchPath = "/api/v1/search"

// search relays the switcher's conversation search to the person's daemon,
// which alone holds their index (ADR 0036). Like a history read, the gateway
// learns nothing from it and forwards the reply unparsed.
func (a *Auth) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if r.Method != http.MethodGet || r.URL.Path != searchPath || r.URL.EscapedPath() != searchPath || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || !browserHTTP(r) || r.Host != strings.TrimPrefix(a.cfg.Origin, "https://") || r.TLS == nil || r.URL.Fragment != "" || len(q) != 1 || len(q["q"]) != 1 || !utf8.ValidString(q.Get("q")) || utf8.RuneCountInString(q.Get("q")) > 200 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	a.proxy(w, r, s, false)
}
