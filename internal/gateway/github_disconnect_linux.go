//go:build linux

package gateway

import (
	"net/http"
	"time"
)

const githubDisconnectPath = "/api/v1/account/github/disconnect"

func recentGitHubSignIn(s session, now time.Time) bool {
	return !s.githubAt.IsZero() && now.Sub(s.githubAt) < 5*time.Minute
}

func (a *Auth) githubDisconnect(w http.ResponseWriter, r *http.Request) {
	if (r.Method != "POST" && r.Method != "GET") || !a.exact(r, githubDisconnectPath) || r.RequestURI != githubDisconnectPath || len(r.TransferEncoding) != 0 || r.Method == "POST" && (r.ContentLength < 2 || r.ContentLength > 256 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1) || r.Method == "GET" && r.ContentLength > 0 {
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
	// A GitHub sign-in within five minutes; a session made from a device
	// link carries its parent's sign-in time, never a fresh one.
	if !recentGitHubSignIn(s, a.now()) {
		safe(w, 403, "reauthentication_required")
		return
	}
	a.proxy(w, r, s, false)
}
