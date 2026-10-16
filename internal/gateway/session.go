package gateway

import (
	"crypto/subtle"
	"encoding/json"
	"math"
	"net/http"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
)

// authenticated resolves the cookie locally. The broker authorizes the binding at
// login; RevokeSubject deletes sessions under this same lock.
func (a *Auth) authenticated(r *http.Request) (session, bool) {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return session{}, false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	key := a.cookieKey(c.Value)
	if !a.sessionStoreHealthy() && a.sessionFile != "" {
		a.sessions = map[string]session{}
		return session{}, false
	}
	s, ok := a.sessions[key]
	if !ok {
		return session{}, false
	}
	now := a.now()
	if !now.Before(s.idle) || !now.Before(s.absolute) {
		_ = a.changedSessions(func(next map[string]session) { delete(next, key) })
		return session{}, false
	}
	if s.accessEmail != accessEmail(r) {
		return session{}, false
	}
	renewed := now.Add(sessionIdle)
	if renewed.After(s.absolute) {
		renewed = s.absolute
	}
	if renewed.Sub(s.idle) >= renewalInterval {
		updated := false
		err := a.changedSessions(func(next map[string]session) {
			if _, ok := next[key]; !ok {
				return
			}
			s.idle = renewed
			next[key] = s
			updated = true
		})
		if err != nil || !updated {
			return session{}, false
		}
	}
	diagnostic.SetUser(r.Context(), s.identity.Username)
	return s, true
}
func brokerIdentity(id string, reply BrokerReply) (Identity, bool) {
	if reply.Route == nil || reply.Epoch == 0 || reply.Generation == 0 {
		return Identity{}, false
	}
	route := reply.Route
	if route.UID == 0 || route.UID > uint32(math.MaxInt32) || route.Username == "" || len(route.Username) > 32 || route.Socket != "/run/open-habitat/users/"+route.Username+"/daemon.sock" {
		return Identity{}, false
	}
	for i, c := range route.Username {
		if i == 0 && (c < 'a' || c > 'z') || !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '_' || c == '-') {
			return Identity{}, false
		}
	}
	return Identity{Provider: "github", Subject: id, UID: int(route.UID), Username: route.Username, Socket: route.Socket}, true
}
func (a *Auth) authorizeWrite(r *http.Request, s session) string {
	if r.Header.Get("Origin") != a.cfg.Origin || len(r.Header.Values("Origin")) != 1 {
		return "origin_denied"
	}
	if len(r.Header.Values("X-Agent-Host-CSRF")) != 1 || subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Agent-Host-CSRF")), []byte(s.csrf)) != 1 {
		return "csrf_denied"
	}
	return ""
}
func (a *Auth) current(w http.ResponseWriter, r *http.Request) {
	if !a.exact(r, "/auth/session") {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "provider": s.identity.Provider, "csrf": s.csrf, "profile": s.profile})
}
func (a *Auth) logout(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if !a.exact(r, "/auth/logout") || r.URL.RawQuery != "" {
		safe(w, 400, "invalid_request")
		return
	}
	if denied := a.authorizeWrite(r, s); denied != "" {
		safe(w, 403, denied)
		return
	}
	c, _ := r.Cookie(cookieName)
	a.mu.Lock()
	err := a.changedSessions(func(next map[string]session) { delete(next, a.cookieKey(c.Value)) })
	a.mu.Unlock()
	if err != nil {
		safe(w, 503, "authentication_required")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: cookieName, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}
