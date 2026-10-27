//go:build linux

package gateway

import (
	"net/http"
	"net/url"
	"regexp"
	"strings"
)

const githubClonesPath = "/api/v1/onboarding/github/clones"
const githubCloneEventsPath = githubClonesPath + "/events"
const githubLookupPath = "/api/v1/onboarding/github/repository"

var githubCloneJobID = regexp.MustCompile(`^[0-9a-f]{32}$`)

// Clone jobs belong to the mapped user's daemon. The gateway authenticates,
// admits writes by origin and CSRF, and forwards to that one socket; the
// daemon validates every action and the browser validates every reply.
func (a *Auth) githubClones(w http.ResponseWriter, r *http.Request) {
	if !a.exact(r, githubClonesPath) || r.URL.EscapedPath() != githubClonesPath || r.RequestURI != githubClonesPath || !browserHTTP(r) || len(r.TransferEncoding) != 0 {
		safe(w, 400, "invalid_request")
		return
	}
	switch r.Method {
	case http.MethodGet:
		if r.ContentLength > 0 {
			safe(w, 400, "invalid_request")
			return
		}
		s, ok := a.authenticated(r)
		if !ok {
			safe(w, 401, "authentication_required")
			return
		}
		a.proxy(w, r, s, false)
	case http.MethodPost:
		// A GitLab remove names a project path of up to 1024 characters.
		if r.ContentLength < 1 || r.ContentLength > cloneRequestLimit || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
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
	default:
		safe(w, 400, "invalid_request")
	}
}

// A subscription is a read: it neither starts nor stops the job, so leaving
// the page or losing the stream changes nothing on the host.
func (a *Auth) githubCloneEvents(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("job_id")
	if r.Method != http.MethodGet || !a.exact(r, githubCloneEventsPath, "job_id") || r.URL.EscapedPath() != githubCloneEventsPath || !githubCloneJobID.MatchString(id) || r.RequestURI != githubCloneEventsPath+"?job_id="+id || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || r.Header.Get("Last-Event-ID") != "" {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	a.proxy(w, r, s, true)
}

func (a *Auth) githubLookup(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("full_name")
	parts := strings.Split(name, "/")
	if r.Method != http.MethodGet || !a.exact(r, githubLookupPath, "full_name") || r.URL.EscapedPath() != githubLookupPath || len(parts) != 2 || !catalogOwner(parts[0]) || !catalogName(parts[1]) || r.RequestURI != githubLookupPath+"?full_name="+url.QueryEscape(name) || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
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

// cloneRequestLimit bounds one clone action: the longest is a GitLab remove
// with a 1024-character project path.
const cloneRequestLimit = 2048
