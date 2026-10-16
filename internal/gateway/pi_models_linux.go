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

// The gateway only authenticates and routes; credential parsing belongs to the mapped daemon.
func (a *Auth) piCredentials(w http.ResponseWriter, r *http.Request) {
	valid := ((r.Method == http.MethodGet || r.Method == http.MethodPost) && a.exact(r, "/api/v1/pi/credentials")) || (r.Method == http.MethodDelete && a.exact(r, "/api/v1/pi/credentials/openai"))
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
