//go:build linux

package gateway

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	_ "embed"
	"encoding/base32"
	"encoding/hex"
	"html"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/udssecure"
)

// The workspace editor (code-server) runs in the person's daemon and is
// served on a separate editor origin, never the app's: code-server serves its
// webviews and extensions' web code from its own origin, and on the app's
// origin any of them could use the app session. The app hands the editor
// origin an editor-scoped session that grants only the relay to the same
// person's daemon editor; it lives in gateway memory only, ends with its app
// session, and is never accepted on the app origin, as the app cookie is
// never accepted on the editor origin.

const (
	editorCookie        = "__Host-oh-editor"
	editorHandoffPath   = "/auth/editor"
	editorPath          = "/api/v1/editor"
	editorOpenPath      = "/api/v1/editor/open"
	editorStopPath      = "/api/v1/editor/stop"
	editorGrantLifetime = 60 * time.Second
	// An editor session also ends with its app session; this only bounds a
	// frame left open for days.
	editorSessionLifetime = 12 * time.Hour
	editorPerSession      = 8
	editorMaxSessions     = 4096
	// Request heads the daemon accepts are small (2 KiB), so only the
	// headers code-server needs cross the boundary.
	editorHeadLimit = 1800
)

//go:embed editor_bridge.js
var editorBridgeJS string

var editorForwardHeaders = []string{
	"Accept", "Accept-Encoding", "Accept-Language", "Cache-Control", "Content-Type",
	"If-Match", "If-Modified-Since", "If-None-Match", "If-Range", "Range", "Pragma",
	"Sec-WebSocket-Extensions", "Sec-WebSocket-Key", "Sec-WebSocket-Protocol", "Sec-WebSocket-Version",
}

type editorGrant struct {
	parent, parentID string
	identity         Identity
	accessEmail      string
	until            time.Time
}

type editorSession struct {
	parent, parentID string
	identity         Identity
	accessEmail      string
	until            time.Time
}

func editorKey(kind, secret string) string {
	h := sha256.Sum256([]byte(kind + "\x00" + secret))
	return hex.EncodeToString(h[:])
}

// validEditorOrigin accepts a separate DNS namespace. Same-site naming for
// framed Strict cookies and wildcard certificate coverage belong to the operator.
func validEditorOrigin(app, editor string) bool {
	u, err := url.Parse(editor)
	appURL, appErr := url.Parse(app)
	if err != nil || appErr != nil || u.Scheme != "https" || u.Host == "" || u.User != nil ||
		editor != "https://"+u.Host || u.Port() != "" || strings.Contains(u.Host, ":") {
		return false
	}
	host := u.Host
	if strings.Contains(host, "*") {
		if strings.Count(host, "*") != 1 || strings.Index(host, "*") > strings.Index(host, ".") {
			return false
		}
		// Validate the actual expanded name, including the 63-byte label limit.
		expanded := strings.Replace(host, "*", strings.Repeat("a", 52), 1)
		if !validEditorDNSName(expanded) {
			return false
		}
		prefix, suffix, _ := strings.Cut(host, "*")
		return !(strings.HasPrefix(appURL.Hostname(), prefix) && strings.HasSuffix(appURL.Hostname(), suffix))
	}
	return validEditorDNSName(host) && editor != app &&
		!strings.HasSuffix(appURL.Hostname(), "."+host) &&
		validEditorDNSName(strings.Repeat("a", 52)+"."+host)
}

func validEditorDNSName(host string) bool {
	if len(host) > 253 || net.ParseIP(host) != nil {
		return false
	}
	labels := strings.Split(host, ".")
	if len(labels) < 2 {
		return false
	}
	for _, label := range labels {
		if len(label) == 0 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, c := range label {
			if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-') {
				return false
			}
		}
	}
	return true
}

func (a *Auth) editorHost() string { return strings.TrimPrefix(a.cfg.EditorOrigin, "https://") }

// Full SHA-256 of the authenticated provider identity, never a browser-selected
// account, keeps hosts stable without a registry or account IDs in URLs.
func (a *Auth) editorPersonOrigin(identity Identity) string {
	h := sha256.Sum256([]byte(identity.Provider + "\x00" + identity.Subject))
	label := strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(h[:]))
	host := a.editorHost()
	if strings.Contains(host, "*") {
		return "https://" + strings.Replace(host, "*", label, 1)
	}
	return "https://" + label + "." + host
}

func (a *Auth) isEditorHost(host string) bool {
	if !validEditorDNSName(host) {
		return false
	}
	template := a.editorHost()
	if !strings.Contains(template, "*") {
		template = "*." + template
	}
	prefix, suffix, _ := strings.Cut(template, "*")
	if !strings.HasPrefix(host, prefix) || !strings.HasSuffix(host, suffix) || len(host) != len(prefix)+52+len(suffix) {
		return false
	}
	label := host[len(prefix) : len(host)-len(suffix)]
	for _, c := range label {
		if !(c >= 'a' && c <= 'z' || c >= '2' && c <= '7') {
			return false
		}
	}
	return true
}

// editorParentValid reports whether the app session that created a grant or
// an editor session still exists unchanged. Call under mu.
func (a *Auth) editorParentValid(parent, parentID string, identity Identity) bool {
	s, ok := a.sessions[parent]
	now := a.now()
	return ok && s.id == parentID && s.identity == identity && now.Before(s.idle) && now.Before(s.absolute) && a.sessionStoreHealthy()
}

// pruneEditorSessions drops grants and editor sessions whose app session has
// gone or that have expired. Call under mu.
func (a *Auth) pruneEditorSessions() {
	now := a.now()
	for k, g := range a.editorGrants {
		if !now.Before(g.until) || !a.editorParentValid(g.parent, g.parentID, g.identity) {
			delete(a.editorGrants, k)
		}
	}
	for k, e := range a.editors {
		if !now.Before(e.until) || !a.editorParentValid(e.parent, e.parentID, e.identity) {
			delete(a.editors, k)
		}
	}
}

// mintEditorHandoff gives the signed-in app a one-minute, single-use token
// that the editor origin's frame page redeems for an editor session.
func (a *Auth) mintEditorHandoff(w http.ResponseWriter, r *http.Request) {
	if a.cfg.EditorOrigin == "" {
		http.NotFound(w, r)
		return
	}
	if !a.exact(r, editorHandoffPath) || r.ContentLength > 0 {
		safe(w, 400, "invalid_request")
		return
	}
	s, key, ok := a.currentSession(w, r, true)
	if !ok {
		return
	}
	token, err := a.secret()
	if err != nil {
		safe(w, 503, "authentication_required")
		return
	}
	a.mu.Lock()
	a.pruneEditorSessions()
	if a.editorGrants == nil {
		a.editorGrants = map[string]editorGrant{}
	}
	outstanding := 0
	for _, g := range a.editorGrants {
		if g.parent == key {
			outstanding++
		}
	}
	if outstanding >= editorPerSession || len(a.editorGrants) >= editorMaxSessions {
		a.mu.Unlock()
		safe(w, 429, "editor_handoff_limited")
		return
	}
	a.editorGrants[editorKey("editor-grant", token)] = editorGrant{parent: key, parentID: s.id, identity: s.identity, accessEmail: s.accessEmail, until: a.now().Add(editorGrantLifetime)}
	a.mu.Unlock()
	writeJSON(w, map[string]any{"schema_version": 1, "token": token, "origin": a.editorPersonOrigin(s.identity)})
}

// editorAuthenticated resolves the editor cookie to its live editor session.
func (a *Auth) editorAuthenticated(r *http.Request) (editorSession, string, bool) {
	c, err := r.Cookie(editorCookie)
	if err != nil || len(c.Value) != 43 || strings.ContainsAny(c.Value, "=+/") {
		return editorSession{}, "", false
	}
	key := editorKey("editor-session", c.Value)
	a.mu.Lock()
	defer a.mu.Unlock()
	e, ok := a.editors[key]
	if !ok || "https://"+r.Host != a.editorPersonOrigin(e.identity) || !a.now().Before(e.until) || !a.editorParentValid(e.parent, e.parentID, e.identity) || e.accessEmail != accessEmail(r) {
		return editorSession{}, "", false
	}
	return e, key, true
}

// editorFrameHeaders lets only the app origin (and the editor's own nested
// frames) embed the editor host. The app itself keeps frame-ancestors 'none'.
func (a *Auth) editorFrameHeaders(h http.Header) {
	h.Del("X-Frame-Options")
	h.Add("Content-Security-Policy", "frame-ancestors 'self' "+a.cfg.Origin)
}

// editorServe is the whole editor origin. It never serves the app, its API or
// its static files, and never reads the app cookie.
func (a *Auth) editorServe(w http.ResponseWriter, r *http.Request) {
	a.editorFrameHeaders(w.Header())
	if r.TLS == nil || !a.isEditorHost(r.Host) || r.Host == a.editorHost() || r.URL.Fragment != "" {
		safe(w, 400, "invalid_request")
		return
	}
	upgrade := r.Header.Get("Upgrade") != ""
	if upgrade || r.Method != http.MethodGet && r.Method != http.MethodHead {
		// WebSockets are not subject to CORS and every write must come from
		// the editor itself.
		if r.Header.Get("Origin") != "https://"+r.Host || len(r.Header.Values("Origin")) != 1 {
			safe(w, 403, "origin_denied")
			return
		}
	}
	switch r.URL.Path {
	case "/_open-habitat/frame":
		if r.Method != http.MethodGet {
			safe(w, 405, "invalid_request")
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Add("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'")
		_, _ = w.Write([]byte(`<!doctype html><html lang="fi"><head><meta charset="utf-8"><meta name="oh-app-origin" content="` + html.EscapeString(a.cfg.Origin) + `"><title>VS Code</title><link rel="stylesheet" href="/_open-habitat/bridge.css"></head><body><iframe id="editor" title="VS Code" allow="clipboard-read; clipboard-write"></iframe><script src="/_open-habitat/bridge.js"></script></body></html>`))
		return
	case "/_open-habitat/bridge.js", "/_open-habitat/bridge.css":
		if r.Method != http.MethodGet {
			safe(w, 405, "invalid_request")
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if strings.HasSuffix(r.URL.Path, ".js") {
			w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
			_, _ = w.Write([]byte(editorBridgeJS))
		} else {
			w.Header().Set("Content-Type", "text/css; charset=utf-8")
			_, _ = w.Write([]byte("html,body{margin:0;height:100%;overflow:hidden}iframe{display:block;border:0;width:100%;height:100%}"))
		}
		return
	case "/_open-habitat/handoff":
		a.redeemEditorHandoff(w, r)
		return
	case "/_open-habitat/session":
		w.Header().Set("Cache-Control", "no-store")
		if _, _, ok := a.editorAuthenticated(r); !ok || r.Method != http.MethodGet {
			safe(w, 401, "authentication_required")
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	case "/_open-habitat/start", "/_open-habitat/workspace":
	default:
		if strings.HasPrefix(r.URL.Path, "/_open-habitat/") {
			http.NotFound(w, r)
			return
		}
	}
	if r.URL.Path == "/_open-habitat/start" && (r.Method != http.MethodPost || r.URL.RawQuery != "" || r.ContentLength > 0) || r.URL.Path == "/_open-habitat/workspace" && r.Method != http.MethodGet {
		safe(w, 400, "invalid_request")
		return
	}
	e, key, ok := a.editorAuthenticated(r)
	if !ok {
		if strings.Contains(r.Header.Get("Accept"), "text/html") {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`<!doctype html><html lang="fi"><meta charset="utf-8"><title>VS Code</title><p>Editorin istunto on päättynyt. Avaa editori uudelleen sovelluksesta.</p></html>`))
			return
		}
		safe(w, 401, "authentication_required")
		return
	}
	a.editorRelay(w, r, e, key, upgrade)
}

func (a *Auth) redeemEditorHandoff(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	var body struct {
		Token string `json:"token"`
	}
	if r.Method != http.MethodPost || r.URL.RawQuery != "" || !jsonBody(w, r, &body) || len(body.Token) != 43 {
		safe(w, 400, "invalid_request")
		return
	}
	secret, err := a.secret()
	if err != nil {
		safe(w, 503, "authentication_required")
		return
	}
	a.mu.Lock()
	a.pruneEditorSessions()
	gk := editorKey("editor-grant", body.Token)
	g, ok := a.editorGrants[gk]
	// Single use: the grant is consumed whatever happens next.
	delete(a.editorGrants, gk)
	if !ok || "https://"+r.Host != a.editorPersonOrigin(g.identity) || subtle.ConstantTimeCompare([]byte(g.accessEmail), []byte(accessEmail(r))) != 1 {
		a.mu.Unlock()
		safe(w, 401, "authentication_required")
		return
	}
	if a.editors == nil {
		a.editors = map[string]editorSession{}
	}
	// A session keeps at most a few editor sessions (frames, tabs); the
	// oldest gives way.
	var mine []string
	for k, e := range a.editors {
		if e.parent == g.parent {
			mine = append(mine, k)
		}
	}
	for len(mine) >= editorPerSession {
		oldest := 0
		for i := range mine {
			if a.editors[mine[i]].until.Before(a.editors[mine[oldest]].until) {
				oldest = i
			}
		}
		delete(a.editors, mine[oldest])
		mine = append(mine[:oldest], mine[oldest+1:]...)
	}
	if len(a.editors) >= editorMaxSessions {
		a.mu.Unlock()
		safe(w, 503, "authentication_required")
		return
	}
	until := a.now().Add(editorSessionLifetime)
	a.editors[editorKey("editor-session", secret)] = editorSession{parent: g.parent, parentID: g.parentID, identity: g.identity, accessEmail: g.accessEmail, until: until}
	a.mu.Unlock()
	if a.log != nil {
		a.log.Info("editor_session", "outcome", "accepted", "reason", "handoff", "user", g.identity.Username)
	}
	// Clear stale storage within this person's origin as defense in depth;
	// cross-person isolation comes from distinct hosts, not this header.
	w.Header().Set("Clear-Site-Data", `"storage", "cache"`)
	// Strict: the editor is reached only inside the app's same-site frame.
	http.SetCookie(w, &http.Cookie{Name: editorCookie, Value: secret, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode})
	w.WriteHeader(http.StatusNoContent)
}

// editorRelay forwards one editor request to the session's own daemon. Only
// an allow-list of headers crosses, the editor cookie never does, and the
// relay is registered with the app session so ending it closes the relay.
func (a *Auth) editorRelay(w http.ResponseWriter, r *http.Request, e editorSession, key string, upgrade bool) {
	target := e.identity
	if a.snapshotDial == nil && udssecure.Mapped(target.Socket, target.UID) != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	a.mu.Lock()
	if !a.editorParentValid(e.parent, e.parentID, e.identity) {
		a.mu.Unlock()
		safe(w, 401, "authentication_required")
		return
	}
	ctx, release := a.registerLive(r.Context(), e.parent, func() bool {
		current, ok := a.editors[key]
		return ok && a.now().Before(current.until) && a.editorParentValid(e.parent, e.parentID, e.identity)
	})
	a.mu.Unlock()
	defer release()
	path := strings.TrimSuffix("/editor-relay/", "/") + r.URL.Path
	switch r.URL.Path {
	case "/_open-habitat/start":
		path = "/api/v1/editor/start"
	case "/_open-habitat/workspace":
		path = "/api/v1/editor/workspace"
	}
	out := &url.URL{Scheme: "http", Host: "unix", Path: path, RawQuery: r.URL.RawQuery}
	if len(r.Method)+len(out.RequestURI())+len("unix")+64 > editorHeadLimit {
		safe(w, 414, "invalid_request")
		return
	}
	if upgrade {
		// The connection outlives net/http once hijacked; only the session's
		// context ends it.
		rc := http.NewResponseController(w)
		_ = rc.SetReadDeadline(time.Time{})
		_ = rc.SetWriteDeadline(time.Time{})
	}
	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.Out.URL, pr.Out.Host = out, "unix"
			header := http.Header{}
			size := 0
			for _, name := range editorForwardHeaders {
				for _, v := range pr.In.Header.Values(name) {
					if size += len(name) + len(v) + 4; size <= editorHeadLimit-len(out.RequestURI())-64 {
						header.Add(name, v)
					}
				}
			}
			if upgrade {
				header.Set("Connection", "Upgrade")
				header.Set("Upgrade", pr.In.Header.Get("Upgrade"))
			}
			pr.Out.Header = header
		},
		Transport: &http.Transport{
			DisableKeepAlives:      true,
			MaxResponseHeaderBytes: 64 << 10,
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return a.dialDaemon(ctx, target)
			},
		},
		FlushInterval: -1,
		ModifyResponse: func(res *http.Response) error {
			// The editor origin's cookies are the gateway's alone.
			res.Header.Del("Set-Cookie")
			res.Header.Del("X-Frame-Options")
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, _ *http.Request, err error) {
			if ctx.Err() == nil && r.Context().Err() == nil && a.log != nil {
				a.log.Warn("editor_relay", "outcome", "failed", "reason", "daemon_exchange_failed", "user", target.Username)
			}
			safe(w, 503, "daemon_unavailable")
		},
	}
	proxy.ServeHTTP(w, r.WithContext(ctx))
}

// editorStatus and editorOpen are the app origin's editor routes: whether the
// person's daemon offers an editor, and opening a file link in it.
func (a *Auth) editorStatus(w http.ResponseWriter, r *http.Request) {
	if a.cfg.EditorOrigin == "" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet || !a.exact(r, editorPath) || r.ContentLength > 0 {
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

func (a *Auth) editorOpen(w http.ResponseWriter, r *http.Request) {
	if a.cfg.EditorOrigin == "" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost || !a.exact(r, editorOpenPath) || r.Header.Get("Content-Type") != "application/json" || r.ContentLength < 2 || r.ContentLength > 2048 {
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
}

func (a *Auth) editorStop(w http.ResponseWriter, r *http.Request) {
	if a.cfg.EditorOrigin == "" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost || !a.exact(r, editorStopPath) || r.ContentLength != 0 || len(r.TransferEncoding) != 0 {
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
}
