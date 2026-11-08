//go:build linux

package gateway

import (
	"net/http"
	"strings"
)

func (a *Auth) attachments(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	upload := path == "/api/v1/attachments" && r.Method == http.MethodPost
	id := strings.TrimPrefix(path, "/api/v1/attachments/")
	id = strings.TrimSuffix(id, "/thumbnail")
	if !a.exact(r, path) || r.URL.EscapedPath() != path || (!upload && (r.Method != http.MethodGet || !conversationUUID.MatchString(id))) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if upload {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}
