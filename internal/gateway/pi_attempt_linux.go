//go:build linux

package gateway

import "net/http"

const piAttemptPath = "/api/v1/onboarding/pi/attempt"

func (a *Auth) piAttempt(w http.ResponseWriter, r *http.Request) {
	if (r.Method != http.MethodGet && r.Method != http.MethodPost && r.Method != http.MethodDelete) || !a.exact(r, piAttemptPath) {
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
