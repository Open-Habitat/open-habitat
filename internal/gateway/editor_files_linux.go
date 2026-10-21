//go:build linux

package gateway

import (
	"net/http"
	"net/url"
	"strings"
)

const editorFilesPrefix = "/api/v1/workspaces/editor/"

// Only the session's mapped daemon has filesystem authority. The gateway
// checks framing/authentication, not the document or the filesystem target.
func (a *Auth) editorFiles(w http.ResponseWriter, r *http.Request) {
	op := strings.TrimPrefix(r.URL.Path, editorFilesPrefix)
	put := r.Method == http.MethodPut && op == "file"
	shape := r.URL.Path == editorFilesPrefix+op && r.URL.EscapedPath() == r.URL.Path && (op == "file" || op == "list" || op == "stat") && r.ProtoMajor == 1 && r.ProtoMinor == 1 && len(r.TransferEncoding) == 0
	if put {
		shape = shape && r.URL.RawQuery == "" && r.ContentLength >= 2 && r.ContentLength <= 8<<20 && r.Header.Get("Content-Type") == "application/json" && len(r.Header.Values("Content-Type")) == 1
	} else {
		q, e := url.ParseQuery(r.URL.RawQuery)
		shape = shape && e == nil && r.Method == http.MethodGet && r.ContentLength <= 0 && len(q) == 2 && len(q["workspace_id"]) == 1 && len(q["path"]) == 1
	}
	if !shape {
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
