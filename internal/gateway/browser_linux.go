//go:build linux

package gateway

import (
	"net/http"
	"regexp"

	"github.com/open-habitat/open-habitat/internal/wsframe"
)

// The person's server browser (experimental). The daemon runs the browser
// as the person; the gateway authenticates, picks the daemon from the
// session and relays: the reads and requests as ordinary daemon routes, and
// the viewer as a WebSocket like the browser shell's, with the same Origin,
// first-message CSRF proof and session end. The viewer carries pixels, never
// the remote page's content, so it needs no origin of its own as the editor
// does. Nothing here sees DevTools, the profile or what the browser shows
// beyond relaying it.
const (
	browserPath        = "/api/v1/browser"
	browserStartPath   = "/api/v1/browser/start"
	browserStopPath    = "/api/v1/browser/stop"
	browserControlPath = "/api/v1/browser/control"
	browserWindowPath  = "/api/v1/browser/window"
	browserViewPath    = "/api/v1/browser/view"
	// Viewers one browser session may hold open at once.
	browserViewLimit = 4
)

var browserTarget = regexp.MustCompile(`^[0-9A-F]{32}$`)

func (a *Auth) browserHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if r.URL.EscapedPath() != path || len(r.TransferEncoding) != 0 || !browserHTTP(r) {
		safe(w, 400, "invalid_request")
		return
	}
	write := false
	switch {
	case path == browserPath:
		if r.Method != http.MethodGet || !a.exact(r, browserPath) || r.ContentLength > 0 {
			safe(w, 400, "invalid_request")
			return
		}
	case path == browserWindowPath:
		id := r.URL.Query().Get("id")
		if r.Method != http.MethodGet || !a.exact(r, browserWindowPath, "id") || r.URL.RawQuery != "id="+id || !browserTarget.MatchString(id) || r.ContentLength > 0 {
			safe(w, 400, "invalid_request")
			return
		}
	case path == browserStartPath || path == browserStopPath:
		if r.Method != http.MethodPost || !a.exact(r, path) || r.ContentLength != 0 {
			safe(w, 400, "invalid_request")
			return
		}
		write = true
	case path == browserControlPath:
		if r.Method != http.MethodPost || !a.exact(r, path) || r.ContentLength < 2 || r.ContentLength > 128 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
			safe(w, 400, "invalid_request")
			return
		}
		write = true
	default:
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

// browserView relays the person's viewer to their daemon's display.
func (a *Auth) browserView(w http.ResponseWriter, r *http.Request) {
	if r.URL.RawQuery != "" || !a.exact(r, browserViewPath) || r.URL.EscapedPath() != browserViewPath || !wsframe.IsUpgrade(r) {
		safe(w, 400, "invalid_request")
		return
	}
	a.relayWebSocket(w, r, browserViewPath, "browser_view_relay", a.browserViewSlot)
}

// browserViewSlot holds one of the session's viewer places.
func (a *Auth) browserViewSlot(r *http.Request) (func(), bool) {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return nil, false
	}
	key := "browser-view:" + a.cookieKey(c.Value)
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.terminals[key] >= browserViewLimit {
		return nil, false
	}
	if a.terminals == nil {
		a.terminals = make(map[string]int)
	}
	a.terminals[key]++
	return func() {
		a.mu.Lock()
		defer a.mu.Unlock()
		if a.terminals[key]--; a.terminals[key] <= 0 {
			delete(a.terminals, key)
		}
	}, true
}
