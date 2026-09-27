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
	"log/slog"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
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
	Exchange(context.Context, string, string) (token string, numericID string, login string, err error)
}

// TokenSink consumes a token in one attempt; a failure is terminal for this login.
// Phase 2 supplies the authenticated local UDS implementation.
type TokenSink interface {
	Deliver(context.Context, Identity, string, string) error
}

// ErrBrokerUnavailable denies this request without invalidating an otherwise
// valid session. Authorization is still rechecked on every subsequent request.
var ErrBrokerUnavailable = errors.New("broker temporarily unavailable")

type BrokerRequest struct{ Operation, ID, Candidate string }
type BrokerRoute struct {
	UID              uint32
	Username, Socket string
}
type BrokerReply struct {
	Route             *BrokerRoute
	Generation, Epoch uint64
}
type Broker interface {
	Exchange(context.Context, BrokerRequest) (BrokerReply, error)
}
type AuthOptions struct {
	Broker   Broker
	Provider Provider
	Sink     TokenSink
	Now      func() time.Time
	Random   io.Reader
	// Log receives only fixed event fields and server-generated attempt IDs.
	// Production defaults to JSONL on stderr.
	Log             *slog.Logger
	SnapshotDial    func(context.Context, string) (net.Conn, error) // test seam; production uses one Unix dial
	SnapshotPeerUID func(*net.UnixConn) int                         // test seam; production reads SO_PEERCRED
}
type pending struct {
	verifier, browser, returnTo, attempt string
	until                                time.Time
}
type session struct {
	identity          Identity
	epoch, generation uint64
	csrf              string
	idle, absolute    time.Time
}
type Auth struct {
	cfg             OAuthConfig
	provider        Provider
	sink            TokenSink
	broker          Broker
	now             func() time.Time
	random          io.Reader
	log             *slog.Logger
	mu              sync.Mutex
	pending         map[string]pending
	sessions        map[string]session
	admission       map[string]admission
	unmatchedLog    admission // process-wide budget; never keyed by request input
	snapshotDial    func(context.Context, string) (net.Conn, error)
	snapshotPeerUID func(*net.UnixConn) int
}
type admission struct {
	tokens float64
	at     time.Time
}

const cookieName = "__Host-agent-host"
const flowCookie = "__Host-agent-host-flow"
const githubOAuthIssuer = "https://github.com/login/oauth"

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
	if len(cfg.Identities) != 0 {
		return nil, errors.New("fixed identity mappings are not supported")
	}
	if opts.Broker == nil {
		return nil, errors.New("broker dependency missing")
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if opts.Random == nil {
		opts.Random = rand.Reader
	}
	if opts.Log == nil {
		opts.Log = CallbackLogger(os.Stderr)
	}
	return &Auth{cfg: cfg, provider: opts.Provider, sink: opts.Sink, broker: opts.Broker, now: opts.Now, random: opts.Random, log: opts.Log, pending: map[string]pending{}, sessions: map[string]session{}, admission: map[string]admission{}, snapshotDial: opts.SnapshotDial, snapshotPeerUID: opts.SnapshotPeerUID}, nil
}
func (a *Auth) secret() (string, error) {
	b := make([]byte, 32)
	if _, err := io.ReadFull(a.random, b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// CallbackLogger emits the CLI's JSONL envelope to a caller-owned writer.
// These security diagnostics are always on, independently of --verbose.
func CallbackLogger(w io.Writer) *slog.Logger {
	h := slog.NewJSONHandler(w, &slog.HandlerOptions{ReplaceAttr: func(_ []string, attr slog.Attr) slog.Attr {
		if attr.Key == slog.MessageKey {
			attr.Key = "event"
		}
		return attr
	}})
	return slog.New(h).With("schema_version", 1, "component", "gateway")
}

// attemptID is independent of OAuth state and of the injectable OAuth random
// source. It is never sent to a browser, provider, broker or untrusted header.
func attemptID() string {
	b := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "" // Diagnostics must not change the authentication outcome.
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func (a *Auth) authEvent(attempt, outcome, reason string) {
	// Only these internally chosen literals may enter the structured log.
	if attempt == "" {
		a.log.Info("oauth_callback", "outcome", outcome, "reason", reason)
		return
	}
	a.log.Info("oauth_callback", "outcome", outcome, "reason", reason, "attempt_id", attempt)
}

// callbackShapeReason is diagnostic only. exact() remains the acceptance
// authority; classification runs only after exact has rejected the request.
func (a *Auth) callbackShapeReason(r *http.Request) string {
	if r.URL.Path != "/auth/github/callback" || r.URL.Fragment != "" {
		return "shape_malformed"
	}
	if r.Host != strings.TrimPrefix(a.cfg.Origin, "https://") {
		return "host_mismatch"
	}
	if r.TLS == nil {
		return "tls_missing"
	}
	q, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return "shape_malformed"
	}
	for _, values := range q {
		if len(values) > 1 {
			return "shape_duplicate_key"
		}
	}
	if len(q["state"]) != 1 || q.Get("state") == "" ||
		(len(q["code"]) == 0 && len(q["error"]) == 0) ||
		(len(q["code"]) == 1 && q.Get("code") == "") ||
		(len(q["error"]) == 1 && q.Get("error") == "") {
		return "shape_missing_or_empty"
	}
	if len(q["iss"]) == 1 && q.Get("iss") != githubOAuthIssuer {
		return "shape_issuer_mismatch"
	}
	return "shape_extra_key"
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

// callbackExact admits the historical two-key shape and the three-key GitHub
// response only when its issuer is exactly the pinned OAuth issuer. Keep the
// generic exact validator strict for all other gateway routes.
func (a *Auth) callbackExact(r *http.Request) bool {
	for _, outcome := range []string{"code", "error"} {
		if a.exact(r, "/auth/github/callback", "state", outcome) ||
			a.exact(r, "/auth/github/callback", "state", outcome, "iss") && r.URL.Query().Get("iss") == githubOAuthIssuer {
			return true
		}
	}
	return false
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
	attempt := attemptID()
	a.pending[state] = pending{verifier: verifier, browser: browser, returnTo: returnTo, attempt: attempt, until: now.Add(5 * time.Minute)}
	a.mu.Unlock()
	a.authEvent(attempt, "started", "none")
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
	logCallback := exists
	if !exists {
		// Bound unauthenticated journal emission without changing callback handling.
		now := a.now()
		if a.unmatchedLog.at.IsZero() {
			a.unmatchedLog.tokens = 32
		} else {
			a.unmatchedLog.tokens = math.Min(32, a.unmatchedLog.tokens+now.Sub(a.unmatchedLog.at).Seconds())
		}
		logCallback = a.unmatchedLog.tokens >= 1
		if logCallback {
			a.unmatchedLog.tokens--
		}
		a.unmatchedLog.at = now
	}
	a.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: flowCookie, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	c, e := r.Cookie(flowCookie)
	attempt := p.attempt
	if !exists && logCallback {
		attempt = attemptID() // Never derive correlation from untrusted state.
	}
	if !a.callbackExact(r) {
		if logCallback {
			a.authEvent(attempt, "rejected", a.callbackShapeReason(r))
		}
		a.callbackFailure(w, r, 400, "invalid_request")
		return
	}
	if !exists || !a.now().Before(p.until) {
		if logCallback {
			a.authEvent(attempt, "rejected", "flow_missing_or_expired")
		}
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	if e != nil || subtle.ConstantTimeCompare([]byte(c.Value), []byte(p.browser)) != 1 {
		a.authEvent(attempt, "rejected", "browser_mismatch")
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	if r.URL.Query().Has("error") {
		a.authEvent(attempt, "rejected", "provider_denied")
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	token, id, login, e := a.provider.Exchange(r.Context(), r.URL.Query().Get("code"), p.verifier)
	if e != nil || token == "" {
		a.authEvent(attempt, "rejected", "exchange_failed")
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	n, e := strconv.ParseUint(id, 10, 64)
	if e != nil || n == 0 || strconv.FormatUint(n, 10) != id || login == "" {
		a.authEvent(attempt, "rejected", "identity_denied")
		a.callbackFailure(w, r, 403, "identity_mapping_denied")
		return
	}
	ensured, err := a.broker.Exchange(r.Context(), BrokerRequest{Operation: "ensure", ID: id, Candidate: login})
	target, valid := brokerIdentity(id, ensured)
	if err != nil || !valid {
		a.authEvent(attempt, "rejected", "broker_denied")
		a.callbackFailure(w, r, 403, "identity_mapping_denied")
		return
	}
	// The token is handed off exactly once. A lost acknowledgement is terminal.
	if a.sink.Deliver(r.Context(), target, id, token) != nil {
		a.authEvent(attempt, "rejected", "handoff_failed")
		a.callbackFailure(w, r, 503, "native_adapter_error")
		return
	}
	sid, e := a.secret()
	if e != nil {
		a.authEvent(attempt, "rejected", "session_failed")
		a.callbackFailure(w, r, 503, "authentication_required")
		return
	}
	csrf, e := a.secret()
	if e != nil {
		a.authEvent(attempt, "rejected", "session_failed")
		a.callbackFailure(w, r, 503, "authentication_required")
		return
	}
	// Recheck after handoff. Epoch and immutable binding must still match the
	// ensure response; no session is issued based on stale authorization.
	checked, err := a.broker.Exchange(r.Context(), BrokerRequest{Operation: "authorize", ID: id})
	rebound, valid := brokerIdentity(id, checked)
	if err != nil || !valid || checked.Epoch != ensured.Epoch || checked.Generation < ensured.Generation || rebound != target {
		a.authEvent(attempt, "rejected", "broker_denied")
		a.callbackFailure(w, r, 403, "identity_mapping_denied")
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
	a.sessions[sid] = session{target, checked.Epoch, checked.Generation, csrf, now.Add(8 * time.Hour), now.Add(24 * time.Hour)}
	a.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: sid, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode})
	a.authEvent(attempt, "accepted", "none")
	http.Redirect(w, r, p.returnTo, http.StatusSeeOther)
}

// authenticated rechecks the broker for every session-backed request before any
// daemon operation or session disclosure. Never cache a positive decision.
func (a *Auth) authenticated(r *http.Request) (session, bool) {
	c, e := r.Cookie(cookieName)
	if e != nil {
		return session{}, false
	}
	a.mu.Lock()
	s, ok := a.sessions[c.Value]
	now := a.now()
	if ok && (!now.Before(s.idle) || !now.Before(s.absolute)) {
		delete(a.sessions, c.Value)
		ok = false
	}
	a.mu.Unlock()
	if !ok {
		return session{}, false
	}
	reply, err := a.broker.Exchange(r.Context(), BrokerRequest{Operation: "authorize", ID: s.identity.Subject})
	target, valid := brokerIdentity(s.identity.Subject, reply)
	if err != nil || !valid || target != s.identity || reply.Generation < s.generation || reply.Epoch != s.epoch {
		if !errors.Is(err, ErrBrokerUnavailable) {
			a.mu.Lock()
			delete(a.sessions, c.Value)
			a.mu.Unlock()
		}
		return session{}, false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	// A concurrent logout or rotation cannot resurrect a removed session.
	current, ok := a.sessions[c.Value]
	if !ok || current.csrf != s.csrf || current.identity != s.identity || current.epoch != s.epoch || current.generation != s.generation || current.absolute != s.absolute {
		return session{}, false
	}
	s = current
	now = a.now()
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
func brokerIdentity(id string, reply BrokerReply) (Identity, bool) {
	if reply.Route == nil || reply.Epoch == 0 || reply.Generation == 0 {
		return Identity{}, false
	}
	route := reply.Route
	if route.UID == 0 || route.UID > uint32(math.MaxInt32) || route.Username == "" || len(route.Username) > 32 || route.Socket != "/run/native-agent-host/users/"+route.Username+"/daemon.sock" {
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
