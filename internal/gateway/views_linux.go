//go:build linux

package gateway

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/udssecure"
)

// Agent HTML views (ADR 0032) are agent-written HTML with scripts, so they are
// served on their own per-view hosts, never the app's or the editor's. The
// app hands a view host a one-time token; redeeming it gives a view session
// whose only authority is reading that one export of the same person through
// their daemon's fixed export-read route. Every response on a view host,
// errors included, carries the sandbox CSP, so a direct open of a view URL is
// as confined as the panel's sandboxed frame: an opaque origin, scripts but
// no network, no forms, no popups, no top navigation. View sessions live in
// gateway memory only and end with their app session; the app cookie is
// host-only on the app's host and never reaches a view host, and the view
// cookie is never accepted anywhere but its own view host.

const (
	viewCookie        = "__Host-oh-view"
	viewHandoffPath   = "/auth/view"
	viewsPath         = "/api/v1/views"
	viewHandoffRoute  = "/_open-habitat/handoff"
	viewGrantLifetime = 60 * time.Second
	// A view session also ends with its app session; this only bounds a tab
	// left open for days.
	viewSessionLifetime = 12 * time.Hour
	viewPerSession      = 32
	viewMaxSessions     = 4096
	viewLabelLength     = 52
	viewMaxPath         = 1024
)

var viewIDPattern = regexp.MustCompile(`^v[a-z2-7]{26}$`)

// viewContentTypes are the only types a view host announces; anything else is
// opaque octets. The CSP sandbox applies to every one of them, SVG included.
var viewContentTypes = map[string]string{
	".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
	".json": "application/json", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8", ".csv": "text/plain; charset=utf-8",
	".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
	".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
	".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp4": "video/mp4", ".webm": "video/webm",
}

type viewGrant struct {
	parent, parentID string
	identity         Identity
	accessEmail      string
	viewID           string
	until            time.Time
}

type viewSession struct {
	parent, parentID string
	identity         Identity
	accessEmail      string
	viewID           string
	until            time.Time
}

// validViewOrigin accepts a template with one * in its first label that can
// hold a 52-character view label, and that can never name the app host or an
// editor host. Wildcard DNS and certificate coverage belong to the operator.
func validViewOrigin(app, editor, view string) bool {
	u, err := url.Parse(view)
	appURL, appErr := url.Parse(app)
	if err != nil || appErr != nil || u.Scheme != "https" || u.Host == "" || u.User != nil ||
		view != "https://"+u.Host || u.Port() != "" || strings.Contains(u.Host, ":") {
		return false
	}
	host := u.Host
	if strings.Count(host, "*") != 1 || strings.Index(host, ".") < 0 || strings.Index(host, "*") > strings.Index(host, ".") {
		return false
	}
	if !validEditorDNSName(strings.Replace(host, "*", strings.Repeat("a", viewLabelLength), 1)) {
		return false
	}
	prefix, suffix, _ := strings.Cut(host, "*")
	if strings.HasPrefix(appURL.Hostname(), prefix) && strings.HasSuffix(appURL.Hostname(), suffix) {
		return false
	}
	if editor == "" {
		return true
	}
	// Editor hosts are prefix+52+suffix too (a base namespace is "*."+base).
	editorHost := strings.TrimPrefix(editor, "https://")
	if !strings.Contains(editorHost, "*") {
		editorHost = "*." + editorHost
	}
	ep, es, _ := strings.Cut(editorHost, "*")
	overlap := len(ep)+len(es) == len(prefix)+len(suffix) &&
		(strings.HasPrefix(ep, prefix) || strings.HasPrefix(prefix, ep)) &&
		(strings.HasSuffix(es, suffix) || strings.HasSuffix(suffix, es))
	return !overlap
}

func (a *Auth) viewTemplate() string { return strings.TrimPrefix(a.cfg.ViewOrigin, "https://") }

// viewOrigin is the per-view host: a full SHA-256 of the authenticated
// identity and the view ID. Two views, or two people's views, never share an
// origin, and no registry maps hosts to views.
func (a *Auth) viewOrigin(identity Identity, viewID string) string {
	h := sha256.Sum256([]byte("view\x00" + identity.Provider + "\x00" + identity.Subject + "\x00" + viewID))
	label := strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(h[:]))
	return "https://" + strings.Replace(a.viewTemplate(), "*", label, 1)
}

func (a *Auth) isViewHost(host string) bool {
	if a.cfg.ViewOrigin == "" || !validEditorDNSName(host) {
		return false
	}
	prefix, suffix, _ := strings.Cut(a.viewTemplate(), "*")
	if !strings.HasPrefix(host, prefix) || !strings.HasSuffix(host, suffix) || len(host) != len(prefix)+viewLabelLength+len(suffix) {
		return false
	}
	for _, c := range host[len(prefix) : len(host)-len(suffix)] {
		if !(c >= 'a' && c <= 'z' || c >= '2' && c <= '7') {
			return false
		}
	}
	return true
}

// viewParentValid reports whether the app session behind a grant or view
// session still exists unchanged. Call under mu.
func (a *Auth) viewParentValid(parent, parentID string, identity Identity) bool {
	return a.editorParentValid(parent, parentID, identity)
}

// pruneViewSessions drops grants and view sessions whose app session has gone
// or that have expired. Call under mu.
func (a *Auth) pruneViewSessions() {
	now := a.now()
	for k, g := range a.viewGrants {
		if !now.Before(g.until) || !a.viewParentValid(g.parent, g.parentID, g.identity) {
			delete(a.viewGrants, k)
		}
	}
	for k, v := range a.views {
		if !now.Before(v.until) || !a.viewParentValid(v.parent, v.parentID, v.identity) {
			delete(a.views, k)
		}
	}
}

// mintViewHandoff gives the signed-in app a one-minute, single-use URL that
// opens one view on its own host. It checks only who asks; whether the view
// exists is the person's daemon's answer when the host reads it.
func (a *Auth) mintViewHandoff(w http.ResponseWriter, r *http.Request) {
	if a.cfg.ViewOrigin == "" {
		http.NotFound(w, r)
		return
	}
	var body struct {
		ViewID string `json:"view_id"`
	}
	if !a.exact(r, viewHandoffPath) || !jsonBody(w, r, &body) || !viewIDPattern.MatchString(body.ViewID) {
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
	a.pruneViewSessions()
	if a.viewGrants == nil {
		a.viewGrants = map[string]viewGrant{}
	}
	outstanding := 0
	for _, g := range a.viewGrants {
		if g.parent == key {
			outstanding++
		}
	}
	if outstanding >= viewPerSession || len(a.viewGrants) >= viewMaxSessions {
		a.mu.Unlock()
		safe(w, 429, "view_handoff_limited")
		return
	}
	a.viewGrants[editorKey("view-grant", token)] = viewGrant{parent: key, parentID: s.id, identity: s.identity, accessEmail: s.accessEmail, viewID: body.ViewID, until: a.now().Add(viewGrantLifetime)}
	a.mu.Unlock()
	writeJSON(w, map[string]any{"schema_version": 1, "url": a.viewOrigin(s.identity, body.ViewID) + viewHandoffRoute + "?token=" + token})
}

// viewList is the app origin's list of the person's views; nothing where no
// view origin is configured, so the browser offers nothing.
func (a *Auth) viewList(w http.ResponseWriter, r *http.Request) {
	if a.cfg.ViewOrigin == "" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet || !a.exact(r, viewsPath) || r.ContentLength > 0 {
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

// viewHeaders are set before anything else on a view host, so an error from
// any layer still runs sandboxed. Sources name the exact view host, never a
// sibling, and frames are allowed only inside the app.
func (a *Auth) viewHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		self := "'none'"
		if a.isViewHost(r.Host) {
			self = "https://" + r.Host
		}
		h := w.Header()
		h.Set("Content-Security-Policy", "sandbox allow-scripts; default-src 'none'; script-src "+self+" 'unsafe-inline'; style-src "+self+" 'unsafe-inline'; img-src "+self+" data: blob:; font-src "+self+" data:; media-src "+self+" data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors "+a.cfg.Origin)
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cache-Control", "no-store")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), usb=(), serial=(), bluetooth=(), payment=(), clipboard-read=(), clipboard-write=()")
		next.ServeHTTP(w, r)
	})
}

func viewFailure(w http.ResponseWriter, status int, text string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(status)
	_, _ = io.WriteString(w, text+"\n")
}

// viewServe is the whole of a view host. It never serves the app, its API,
// its static files or the editor, and never reads the app or editor cookie.
func (a *Auth) viewServe(w http.ResponseWriter, r *http.Request) {
	if r.TLS == nil || !a.isViewHost(r.Host) {
		viewFailure(w, 400, "Virheellinen pyyntö.")
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead || r.Header.Get("Upgrade") != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		viewFailure(w, 405, "Näkymää voi vain lukea.")
		return
	}
	if r.URL.Path == viewHandoffRoute {
		a.redeemViewHandoff(w, r)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/_open-habitat/") {
		viewFailure(w, 404, "Tiedostoa ei löydy tästä näkymästä.")
		return
	}
	v, ok := a.viewAuthenticated(r)
	if !ok {
		viewFailure(w, 401, "Näkymän istunto on päättynyt. Avaa näkymä uudelleen Habitatista.")
		return
	}
	a.viewRelay(w, r, v)
}

func (a *Auth) redeemViewHandoff(w http.ResponseWriter, r *http.Request) {
	q, err := url.ParseQuery(r.URL.RawQuery)
	token := q.Get("token")
	if r.Method != http.MethodGet || err != nil || len(q) != 1 || len(q["token"]) != 1 || len(token) != 43 || strings.ContainsAny(token, "=+/") {
		viewFailure(w, 400, "Virheellinen pyyntö.")
		return
	}
	secret, err := a.secret()
	if err != nil {
		viewFailure(w, 503, "Näkymä ei ole juuri nyt käytettävissä.")
		return
	}
	a.mu.Lock()
	a.pruneViewSessions()
	gk := editorKey("view-grant", token)
	g, ok := a.viewGrants[gk]
	// Single use: the grant is consumed whatever happens next.
	delete(a.viewGrants, gk)
	if !ok || "https://"+r.Host != a.viewOrigin(g.identity, g.viewID) || subtle.ConstantTimeCompare([]byte(g.accessEmail), []byte(accessEmail(r))) != 1 {
		a.mu.Unlock()
		viewFailure(w, 401, "Avauslinkki on vanhentunut. Avaa näkymä uudelleen Habitatista.")
		return
	}
	if a.views == nil {
		a.views = map[string]viewSession{}
	}
	var mine []string
	for k, v := range a.views {
		if v.parent == g.parent {
			mine = append(mine, k)
		}
	}
	for len(mine) >= viewPerSession {
		oldest := 0
		for i := range mine {
			if a.views[mine[i]].until.Before(a.views[mine[oldest]].until) {
				oldest = i
			}
		}
		delete(a.views, mine[oldest])
		mine = append(mine[:oldest], mine[oldest+1:]...)
	}
	if len(a.views) >= viewMaxSessions {
		a.mu.Unlock()
		viewFailure(w, 503, "Näkymä ei ole juuri nyt käytettävissä.")
		return
	}
	a.views[editorKey("view-session", secret)] = viewSession{parent: g.parent, parentID: g.parentID, identity: g.identity, accessEmail: g.accessEmail, viewID: g.viewID, until: a.now().Add(viewSessionLifetime)}
	a.mu.Unlock()
	if a.log != nil {
		a.log.Info("view_session", "outcome", "accepted", "reason", "handoff", "user", g.identity.Username)
	}
	// SameSite=None: a sandboxed document has an opaque origin, so its own
	// subresource requests count as cross-site and a Lax or Strict cookie
	// would not go with them. The cookie authorizes only reading this one
	// view on this one host, the host has no state-changing route, and only
	// the app may frame it.
	http.SetCookie(w, &http.Cookie{Name: viewCookie, Value: secret, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteNoneMode})
	w.Header().Set("Location", "/")
	w.WriteHeader(http.StatusSeeOther)
}

// viewAuthenticated resolves the view cookie to its live view session on the
// view's own host.
func (a *Auth) viewAuthenticated(r *http.Request) (viewSession, bool) {
	cookies := 0
	value := ""
	for _, c := range r.Cookies() {
		if c.Name == viewCookie {
			cookies++
			value = c.Value
		}
	}
	if cookies != 1 || len(value) != 43 || strings.ContainsAny(value, "=+/") {
		return viewSession{}, false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	v, ok := a.views[editorKey("view-session", value)]
	if !ok || "https://"+r.Host != a.viewOrigin(v.identity, v.viewID) || !a.now().Before(v.until) || !a.viewParentValid(v.parent, v.parentID, v.identity) || v.accessEmail != accessEmail(r) {
		return viewSession{}, false
	}
	return v, true
}

// viewRelPath turns a view URL path into a path inside the export, or false.
// "dir/" means "dir/index.html", as a static host would serve it.
func viewRelPath(r *http.Request) (string, bool) {
	p := r.URL.Path
	if r.URL.RawPath != "" || !strings.HasPrefix(p, "/") || len(p) > viewMaxPath || !utf8.ValidString(p) {
		return "", false
	}
	rel := strings.TrimPrefix(p, "/")
	if rel == "" {
		return "", true
	}
	if strings.HasSuffix(rel, "/") {
		rel += "index.html"
	}
	if path.Clean(rel) != rel {
		return "", false
	}
	for _, part := range strings.Split(rel, "/") {
		if part == "" || strings.HasPrefix(part, ".") || len(part) > 255 {
			return "", false
		}
		for _, c := range part {
			if unicode.IsControl(c) || c == '\\' {
				return "", false
			}
		}
	}
	return rel, true
}

func (a *Auth) viewRelay(w http.ResponseWriter, r *http.Request, v viewSession) {
	rel, ok := viewRelPath(r)
	if !ok {
		viewFailure(w, 404, "Tiedostoa ei löydy tästä näkymästä.")
		return
	}
	target := v.identity
	if a.snapshotDial == nil && udssecure.Mapped(target.Socket, target.UID) != nil {
		viewFailure(w, 503, "Näkymä ei ole juuri nyt käytettävissä.")
		return
	}
	transport := &http.Transport{
		DisableKeepAlives:      true,
		MaxResponseHeaderBytes: 16 << 10,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return a.dialDaemon(ctx, target)
		},
	}
	defer transport.CloseIdleConnections()
	method := r.Method
	if rel == "" {
		method = http.MethodGet
	}
	out := &url.URL{Scheme: "http", Host: "unix", Path: "/view-export/" + v.viewID + "/" + rel}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, method, out.String(), http.NoBody)
	if err != nil {
		viewFailure(w, 404, "Tiedostoa ei löydy tästä näkymästä.")
		return
	}
	res, err := transport.RoundTrip(req)
	if err != nil {
		if a.log != nil && r.Context().Err() == nil {
			a.log.Warn("view_relay", "outcome", "failed", "reason", "daemon_exchange_failed", "user", target.Username)
		}
		viewFailure(w, 503, "Näkymä ei ole juuri nyt käytettävissä.")
		return
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == 404:
		viewFailure(w, 404, "Tiedostoa ei löydy tästä näkymästä.")
		return
	case res.StatusCode != 200:
		viewFailure(w, 503, "Näkymä ei ole juuri nyt käytettävissä.")
		return
	}
	if rel == "" {
		// The export's own summary names its entry; the browser goes there so
		// the entry's relative links resolve against its directory.
		var body struct {
			View struct {
				Entry string `json:"entry"`
			} `json:"view"`
		}
		if json.NewDecoder(io.LimitReader(res.Body, 64<<10)).Decode(&body) != nil {
			viewFailure(w, 503, "Näkymä ei ole juuri nyt käytettävissä.")
			return
		}
		probe := &http.Request{URL: &url.URL{Path: "/" + body.View.Entry}}
		if entry, ok := viewRelPath(probe); !ok || entry == "" {
			viewFailure(w, 503, "Näkymä ei ole juuri nyt käytettävissä.")
			return
		}
		w.Header().Set("Location", (&url.URL{Path: "/" + body.View.Entry}).EscapedPath())
		w.WriteHeader(http.StatusFound)
		return
	}
	size, err := strconv.ParseInt(res.Header.Get("Content-Length"), 10, 64)
	if err != nil || size < 0 {
		viewFailure(w, 503, "Näkymä ei ole juuri nyt käytettävissä.")
		return
	}
	kind, ok := viewContentTypes[strings.ToLower(path.Ext(rel))]
	if !ok {
		kind = "application/octet-stream"
	}
	w.Header().Set("Content-Type", kind)
	w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	w.WriteHeader(200)
	if r.Method == http.MethodGet {
		_, _ = io.Copy(w, io.LimitReader(res.Body, size))
	}
}
