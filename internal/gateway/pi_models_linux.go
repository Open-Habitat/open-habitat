//go:build linux

package gateway

import "net/http"

func (a *Auth) piModels(w http.ResponseWriter, r *http.Request) {
	if (r.Method != http.MethodGet && r.Method != http.MethodPost) || !a.exact(r, "/api/v1/pi/models") {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method == http.MethodPost {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}

// recapSettings relays the person's recap settings to their daemon, which
// alone validates them and writes them into Pi's settings.
func (a *Auth) recapSettings(w http.ResponseWriter, r *http.Request) {
	if (r.Method != http.MethodGet && r.Method != http.MethodPut) || !a.exact(r, "/api/v1/pi/recap-settings") {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method == http.MethodPut {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}

// Removal routes of the provider keys the mapped daemon manages. An unknown
// provider is refused here rather than forwarded.
var piCredentialRemovals = []string{"/api/v1/pi/credentials/openai", "/api/v1/pi/credentials/anthropic", "/api/v1/pi/credentials/deepseek"}

// The gateway only authenticates and routes; credential parsing belongs to the mapped daemon.
func (a *Auth) piCredentials(w http.ResponseWriter, r *http.Request) {
	valid := (r.Method == http.MethodGet || r.Method == http.MethodPost) && a.exact(r, "/api/v1/pi/credentials")
	for _, path := range piCredentialRemovals {
		valid = valid || r.Method == http.MethodDelete && a.exact(r, path)
	}
	if !valid {
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

const (
	speechKeyPath     = "/api/v1/speech/key"
	speechSessionPath = "/api/v1/speech/session"
)

// speechRoute forwards the person's Soniox key routes and the temporary-key
// mint to their daemon without parsing either: the key is saved and the
// temporary key minted only there.
func (a *Auth) speechRoute(w http.ResponseWriter, r *http.Request) {
	valid := (r.Method == http.MethodGet || r.Method == http.MethodPost || r.Method == http.MethodDelete) && a.exact(r, speechKeyPath) || r.Method == http.MethodPost && a.exact(r, speechSessionPath)
	if !valid {
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

func (a *Auth) claudeLogin(w http.ResponseWriter, r *http.Request) {
	if (r.Method != "GET" && r.Method != "POST" && r.Method != "PUT" && r.Method != "DELETE") || !a.exact(r, "/api/v1/pi/claude-login") {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method != "GET" {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}
