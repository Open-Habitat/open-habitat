//go:build linux

package gateway

import "net/http"

const (
	pushPath         = "/api/v1/notifications/push"
	pushPresencePath = "/api/v1/notifications/presence"
)

// pushRoutes are the person's phone-notification routes and the largest
// body each takes. The daemon keeps the keys and subscriptions in the
// person's own home and sends the notifications; the gateway only relays to
// the session's own daemon, as for every personal setting.
var pushRoutes = map[string]int64{
	pushPath + "/key":     0,
	pushPath + "/devices": 2048,
	pushPath + "/remove":  128,
	pushPath + "/test":    128,
	pushPresencePath:      0,
}

func (a *Auth) push(w http.ResponseWriter, r *http.Request) {
	limit, post := pushRoutes[r.URL.Path]
	read := r.URL.Path == pushPath && r.Method == http.MethodGet && r.ContentLength <= 0
	write := post && r.Method == http.MethodPost && r.ContentLength >= 0 && r.ContentLength <= limit && (limit == 0 || r.ContentLength > 0 && r.Header.Get("Content-Type") == "application/json")
	if !(read || write) || !a.exact(r, r.URL.Path) || r.URL.EscapedPath() != r.URL.Path || len(r.TransferEncoding) != 0 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if write {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}
