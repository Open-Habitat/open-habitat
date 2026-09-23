package gateway

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Identity is a root-configured route. Its socket is never derived from a browser field.
type Identity struct {
	Provider string `json:"provider"`
	Subject  string `json:"subject"`
	UID      int    `json:"uid"`
	Username string `json:"username"`
	Socket   string `json:"socket"`
}
type OAuthConfig struct {
	ClientID     string     `json:"client_id"`
	ClientSecret string     `json:"client_secret"`
	CallbackURL  string     `json:"callback_url"`
	Origin       string     `json:"origin"`
	Identities   []Identity `json:"identities"`
}

// Provider must validate the authorization code and obtain an authenticated account ID.
// Token is transient: implementations must not log request/response bodies.
type Provider interface {
	AuthorizationURL(state, challenge string) string
	Exchange(context.Context, string, string) (token string, numericID string, err error)
}

// TokenSink consumes a token in one attempt; a failure is terminal for this login.
// Phase 2 supplies the authenticated local UDS implementation.
type TokenSink interface {
	Deliver(context.Context, Identity, string, string) error
}
type AuthOptions struct {
	Provider        Provider
	Sink            TokenSink
	Now             func() time.Time
	Random          io.Reader
	SnapshotDial    func(context.Context, string) (net.Conn, error) // test seam; production uses one Unix dial
	SnapshotPeerUID func(*net.UnixConn) int                         // test seam; production reads SO_PEERCRED
}
type pending struct {
	verifier, browser, returnTo string
	until                       time.Time
}
type session struct {
	identity       Identity
	csrf           string
	idle, absolute time.Time
}
type Auth struct {
	cfg             OAuthConfig
	provider        Provider
	sink            TokenSink
	now             func() time.Time
	random          io.Reader
	mu              sync.Mutex
	pending         map[string]pending
	sessions        map[string]session
	admission       map[string]admission
	snapshotDial    func(context.Context, string) (net.Conn, error)
	snapshotPeerUID func(*net.UnixConn) int
}
type admission struct {
	tokens float64
	at     time.Time
}

const cookieName = "__Host-agent-host"
const flowCookie = "__Host-agent-host-flow"

func NewAuth(cfg OAuthConfig, opts AuthOptions) (*Auth, error) {
	origin, err := url.Parse(cfg.Origin)
	if err != nil || origin.Scheme != "https" || origin.Host == "" || origin.User != nil || origin.Path != "" || origin.RawQuery != "" || origin.Fragment != "" {
		return nil, errors.New("invalid auth origin")
	}
	callback, err := url.Parse(cfg.CallbackURL)
	if err != nil || callback.Scheme != "https" || callback.Host != origin.Host || callback.Path != "/auth/github/callback" || callback.RawQuery != "" || callback.Fragment != "" || callback.User != nil {
		return nil, errors.New("invalid auth callback")
	}
	if cfg.ClientID == "" || cfg.ClientSecret == "" || opts.Provider == nil || opts.Sink == nil {
		return nil, errors.New("auth dependencies missing")
	}
	keys, targets, users, sockets := map[string]bool{}, map[string]bool{}, map[string]bool{}, map[string]bool{}
	if len(cfg.Identities) == 0 {
		return nil, errors.New("no identity mappings")
	}
	for _, m := range cfg.Identities {
		id, e := strconv.ParseUint(m.Subject, 10, 64)
		if m.Provider != "github" || e != nil || id == 0 || strconv.FormatUint(id, 10) != m.Subject || m.UID <= 0 || m.Username == "" || strings.ContainsAny(m.Username, "/\\ \t\n") || m.Socket != "/run/native-agent-host/users/"+m.Username+"/daemon.sock" || len(m.Socket) >= 108 {
			return nil, errors.New("invalid identity mapping")
		}
		key := m.Provider + ":" + m.Subject
		target := strconv.Itoa(m.UID)
		if keys[key] || targets[target] || users[m.Username] || sockets[m.Socket] {
			return nil, errors.New("duplicate identity mapping")
		}
		keys[key] = true
		targets[target] = true
		users[m.Username] = true
		sockets[m.Socket] = true
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if opts.Random == nil {
		opts.Random = rand.Reader
	}
	return &Auth{cfg: cfg, provider: opts.Provider, sink: opts.Sink, now: opts.Now, random: opts.Random, pending: map[string]pending{}, sessions: map[string]session{}, admission: map[string]admission{}, snapshotDial: opts.SnapshotDial, snapshotPeerUID: opts.SnapshotPeerUID}, nil
}
func (a *Auth) secret() (string, error) {
	b := make([]byte, 32)
	if _, err := io.ReadFull(a.random, b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func (a *Auth) routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /auth/github/start", a.start)
	mux.HandleFunc("GET /auth/github/callback", a.callback)
	mux.HandleFunc("GET /auth/session", a.current)
	mux.HandleFunc("POST /auth/logout", a.logout)
}
func (a *Auth) exact(r *http.Request, path string, params ...string) bool {
	if r.URL.Path != path || r.URL.Fragment != "" || r.Host != strings.TrimPrefix(a.cfg.Origin, "https://") || r.TLS == nil {
		return false
	}
	q, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil || len(q) != len(params) {
		return false
	}
	for _, p := range params {
		if len(q[p]) != 1 || q.Get(p) == "" {
			return false
		}
	}
	return true
}
func safe(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "error": map[string]any{"code": code, "message": "Request could not be completed", "retryable": false, "correlation_id": "req_00000000"}})
}

// uiReturn accepts only known same-origin selection routes; never API/auth/events or external URLs.
func uiReturn(path string) bool {
	if path == "/" || path == "/workspaces" {
		return true
	}
	if !strings.HasPrefix(path, "/workspaces/") {
		return false
	}
	id := strings.TrimPrefix(path, "/workspaces/")
	if len(id) < 11 || len(id) > 83 || !strings.HasPrefix(id, "ws_") {
		return false
	}
	for _, c := range id[3:] {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-') {
			return false
		}
	}
	return true
}
func (a *Auth) start(w http.ResponseWriter, r *http.Request) {
	returnTo := "/workspaces"
	if a.exact(r, "/auth/github/start", "return_to") && uiReturn(r.URL.Query().Get("return_to")) {
		returnTo = r.URL.Query().Get("return_to")
	} else if !a.exact(r, "/auth/github/start") {
		safe(w, 400, "invalid_request")
		return
	}
	state, e := a.secret()
	if e != nil {
		safe(w, 503, "authentication_required")
		return
	}
	verifier, e := a.secret()
	if e != nil {
		safe(w, 503, "authentication_required")
		return
	}
	browser, e := a.secret()
	if e != nil {
		safe(w, 503, "authentication_required")
		return
	}
	h := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(h[:])
	a.mu.Lock()
	now := a.now()
	// Use the direct peer, never an untrusted forwarded IP. A bounded per-peer
	// bucket mitigates unauthenticated saturation of the global pending cap.
	peer := r.RemoteAddr
	if host, _, err := net.SplitHostPort(peer); err == nil {
		peer = host
	}
	for k, v := range a.admission {
		if now.Sub(v.at) > 5*time.Minute {
			delete(a.admission, k)
		}
	}
	if len(a.admission) >= 4096 && a.admission[peer].at.IsZero() {
		a.mu.Unlock()
		safe(w, 503, "authentication_required")
		return
	}
	bucket := a.admission[peer]
	if bucket.at.IsZero() {
		bucket.tokens = 16
	} else {
		bucket.tokens = math.Min(16, bucket.tokens+now.Sub(bucket.at).Minutes()*8)
	}
	if bucket.tokens < 1 {
		a.mu.Unlock()
		safe(w, 429, "authentication_required")
		return
	}
	bucket.tokens--
	bucket.at = now
	a.admission[peer] = bucket
	for k, v := range a.pending {
		if !now.Before(v.until) {
			delete(a.pending, k)
		}
	}
	if len(a.pending) >= 4096 {
		a.mu.Unlock()
		safe(w, 503, "authentication_required")
		return
	}
	a.pending[state] = pending{verifier: verifier, browser: browser, returnTo: returnTo, until: now.Add(5 * time.Minute)}
	a.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: flowCookie, Value: browser, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: 300})
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, a.provider.AuthorizationURL(state, challenge), http.StatusFound)
}
func (a *Auth) callbackFailure(w http.ResponseWriter, r *http.Request, status int, code string) {
	// A browser can recover at the login card; API callers retain typed errors.
	// Codes below are fixed internal constants, never provider-controlled strings.
	if r.TLS != nil && r.Host == strings.TrimPrefix(a.cfg.Origin, "https://") && strings.Contains(r.Header.Get("Accept"), "text/html") {
		w.Header().Set("Cache-Control", "no-store")
		http.Redirect(w, r, "/workspaces?auth_error="+code, http.StatusSeeOther)
		return
	}
	safe(w, status, code)
}
func (a *Auth) callback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	// Consume the flow before inspecting any provider outcome. No replay even after errors.
	state := r.URL.Query().Get("state")
	a.mu.Lock()
	p, exists := a.pending[state]
	delete(a.pending, state)
	a.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: flowCookie, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	c, e := r.Cookie(flowCookie)
	if !a.exact(r, "/auth/github/callback", "state", "code") && !a.exact(r, "/auth/github/callback", "state", "error") {
		a.callbackFailure(w, r, 400, "invalid_request")
		return
	}
	if !exists || !a.now().Before(p.until) || e != nil || subtle.ConstantTimeCompare([]byte(c.Value), []byte(p.browser)) != 1 {
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	if r.URL.Query().Has("error") {
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	token, id, e := a.provider.Exchange(r.Context(), r.URL.Query().Get("code"), p.verifier)
	if e != nil || token == "" {
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	n, e := strconv.ParseUint(id, 10, 64)
	if e != nil || n == 0 || strconv.FormatUint(n, 10) != id {
		a.callbackFailure(w, r, 403, "identity_mapping_denied")
		return
	}
	var target Identity
	count := 0
	for _, m := range a.cfg.Identities {
		if m.Provider == "github" && m.Subject == id {
			target = m
			count++
		}
	}
	if count != 1 {
		a.callbackFailure(w, r, 403, "identity_mapping_denied")
		return
	}
	// Never store token; do not retry or expose sink/provider errors.
	if a.sink.Deliver(r.Context(), target, id, token) != nil {
		a.callbackFailure(w, r, 503, "native_adapter_error")
		return
	}
	sid, e := a.secret()
	if e != nil {
		a.callbackFailure(w, r, 503, "authentication_required")
		return
	}
	csrf, e := a.secret()
	if e != nil {
		a.callbackFailure(w, r, 503, "authentication_required")
		return
	}
	a.mu.Lock()
	now := a.now()
	for k, v := range a.sessions {
		if !now.Before(v.idle) || !now.Before(v.absolute) {
			delete(a.sessions, k)
		}
	}
	if old, err := r.Cookie(cookieName); err == nil {
		delete(a.sessions, old.Value)
	}
	a.sessions[sid] = session{target, csrf, now.Add(8 * time.Hour), now.Add(24 * time.Hour)}
	a.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: sid, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode})
	http.Redirect(w, r, p.returnTo, http.StatusSeeOther)
}
func (a *Auth) authenticated(r *http.Request) (session, bool) {
	c, e := r.Cookie(cookieName)
	if e != nil {
		return session{}, false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	s, ok := a.sessions[c.Value]
	now := a.now()
	if !ok {
		return session{}, false
	}
	if !now.Before(s.idle) || !now.Before(s.absolute) {
		delete(a.sessions, c.Value)
		return session{}, false
	}
	s.idle = now.Add(8 * time.Hour)
	if s.idle.After(s.absolute) {
		s.idle = s.absolute
	}
	a.sessions[c.Value] = s
	return s, true
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
	_ = json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "provider": s.identity.Provider, "csrf": s.csrf})
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
	delete(a.sessions, c.Value)
	a.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: cookieName, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}
