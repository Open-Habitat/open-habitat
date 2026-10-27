//go:build linux

package gateway

import (
	"net/http"
	"net/url"
	"regexp"
	"strings"
)

func (a *Auth) snapshot(w http.ResponseWriter, r *http.Request) {
	a.snapshotOrPiStatus(w, r, "/api/v1/snapshot")
}
func (a *Auth) piStatus(w http.ResponseWriter, r *http.Request) {
	a.snapshotOrPiStatus(w, r, "/api/v1/onboarding/pi/status")
}
func (a *Auth) snapshotOrPiStatus(w http.ResponseWriter, r *http.Request, path string) {
	if r.Method != http.MethodGet || !a.exact(r, path) {
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

// The gateway accepts only canonical, bounded read paths. It never chooses a UID
// or copies browser headers to the daemon.
func historyGatewayPath(path string, q url.Values) bool {
	if spinoffPath.MatchString(path) {
		return len(q) == 0 || len(q) == 1 && len(q["run"]) == 1 && spinoffRunID.MatchString(q.Get("run"))
	}
	if recapPath.MatchString(path) || contextPath.MatchString(path) {
		return len(q) == 0
	}
	if m := historyPath.FindStringSubmatch(path); m != nil {
		if len(q) > 2 || (q.Has("after") && q.Has("before")) {
			return false
		}
		for k, v := range q {
			if (k != "after" && k != "before" && k != "limit") || len(v) != 1 {
				return false
			}
		}
		return true
	}
	if blockReadPath.MatchString(path) {
		expected := 3
		if q.Has("part") {
			if len(q["part"]) != 1 || q.Get("part") != "skill_arguments" {
				return false
			}
			expected++
		}
		return len(q) == expected && len(q["revision"]) == 1 && len(q["offset"]) == 1 && len(q["limit_bytes"]) == 1
	}
	return false
}

var spinoffPath = regexp.MustCompile(`^/api/v1/agents/pi:[0-9a-fA-F-]{36}/spinoffs$`)
var spinoffRunID = regexp.MustCompile(`^[0-9a-hjkmnp-tv-z]{26}$`)
var recapPath = regexp.MustCompile(`^/api/v1/agents/pi:[0-9a-fA-F-]{36}/recap$`)
var contextPath = regexp.MustCompile(`^/api/v1/agents/pi:[0-9a-fA-F-]{36}/context$`)
var historyPath = regexp.MustCompile(`^/api/v1/agents/pi:[0-9a-fA-F-]{36}/history$`)
var blockReadPath = regexp.MustCompile(`^/api/v1/agents/pi:[0-9a-fA-F-]{36}/entries/[A-Za-z0-9_-]{1,128}/blocks/[0-9]{1,3}$`)

func (a *Auth) history(w http.ResponseWriter, r *http.Request) {
	path := r.URL.EscapedPath()
	if r.Method != http.MethodGet || !historyGatewayPath(path, r.URL.Query()) || path != r.URL.Path || r.Host != strings.TrimPrefix(a.cfg.Origin, "https://") || r.TLS == nil || r.URL.Fragment != "" {
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
