//go:build linux

package gateway

import "net/http"

const (
	integrationsPath        = "/api/v1/integrations"
	integrationAccountsPath = "/api/v1/integrations/accounts"
	integrationLoginPath    = "/api/v1/integrations/login"
)

// integrations routes the person's integration requests to their daemon. The
// gateway parses no body here: passwords, pasted redirect addresses and
// folder choices go through unread, and the daemon runs every tool as the
// person (ADR 0026). A login attempt is owned by a hash of the session, as
// the Pi and Claude logins are.
func (a *Auth) integrations(w http.ResponseWriter, r *http.Request) {
	allowed := map[string]map[string]bool{
		integrationsPath:        {http.MethodGet: true},
		integrationAccountsPath: {http.MethodPost: true, http.MethodDelete: true},
		integrationLoginPath:    {http.MethodGet: true, http.MethodPost: true, http.MethodPut: true, http.MethodDelete: true},
	}
	if !allowed[r.URL.Path][r.Method] || !a.exact(r, r.URL.Path) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method != http.MethodGet {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}
