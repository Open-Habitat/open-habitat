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
	"slices"
	"strconv"
	"strings"
	"sync"

	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/uiroutes"
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
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	CallbackURL  string `json:"callback_url"`
	Origin       string `json:"origin"`
	// EditorOrigin is a per-person DNS template (https://code-*.example.org)
	// or a base namespace (https://code.example.org).
	// Identity-specific subdomains require wildcard routing and TLS. Empty disables it.
	EditorOrigin string `json:"editor_origin,omitempty"`
	// ViewOrigin is the per-view DNS template for agent HTML views
	// (https://oh-view-*.example.org, ADR 0032). Empty offers no views.
	ViewOrigin string `json:"view_origin,omitempty"`
	// ViewLinkMaxDays enables public sharing of view addresses (ADR 0033,
	// ADR 0035) and is a publication's longest period in days; 0 shares
	// none. It needs a view origin.
	ViewLinkMaxDays int `json:"view_link_max_days,omitempty"`
	// DefaultLanguage is the installation's default interface language
	// (system, fi, en-US, en-GB or legacy en; empty is system). An administrator's choice in
	// Settings takes its place.
	DefaultLanguage string        `json:"default_language,omitempty"`
	Identities      []Identity    `json:"identities"`
	Access          *AccessConfig `json:"access,omitempty"`
}

// Provider must validate the authorization code and obtain an authenticated account ID.
// Token is transient: implementations must not log request/response bodies.
// extraScopes are scopes asked for beyond the provider's own fixed set; only
// the person's own explicit reconnect asks for any (allowedExtraScopes).
type Provider interface {
	AuthorizationURL(state, challenge string, extraScopes []string) string
	Exchange(context.Context, string, string) (token string, numericID string, login string, err error)
}

// TokenSink consumes a token in one attempt; a failure is terminal for this login.
// Phase 2 supplies the authenticated local UDS implementation.
type TokenSink interface {
	Deliver(context.Context, Identity, string, string) (Handoff, error)
}

// Handoff is the daemon's answer on what became of the token. HandoffUnused
// means the person's gh kept its own login of the same account and positively
// holds another token, so this one went nowhere; anything else is in use.
type Handoff string

const (
	HandoffInUse  Handoff = "in_use"
	HandoffUnused Handoff = "unused"
)

// ReplacingSink delivers the token of an explicit reconnect, which may take
// the place of gh's working login of the same account. An ordinary sign-in
// keeps that login.
type ReplacingSink interface {
	DeliverReplacing(context.Context, Identity, string, string) (Handoff, error)
}

// TokenRevoker revokes a token the gateway itself just obtained. Only an
// unused token is revoked: GitHub keeps ten tokens per person and scope and
// revokes the oldest, which is the one the person's gh holds.
type TokenRevoker interface {
	RevokeToken(context.Context, string) error
}

// RepositoryPlan is the part of the site onboarding the binding-creating
// login hands to the person's daemon with the token (ADR 0030): the mode
// and only the defaults the gateway's own check found this person can read.
type RepositoryPlan struct {
	Mode     string // auto or skip; preselected imports nothing by itself
	Defaults []string
}

// PlanOutcome is the daemon's per-default answer: queued or already_present.
type PlanOutcome struct {
	FullName, Outcome string
}

// FirstLogin is what the binding-creating login hands over with the token,
// in the same one-time handoff (ADR 0030): the repository plan, the site AI
// key, or both.
type FirstLogin struct {
	Plan *RepositoryPlan
	Seed *SiteKeySeed
}

// FirstLoginReply answers a FirstLogin. Defaults are in the plan's order;
// AIKey is seeded, already_present (the person's Pi had a credential for
// that provider, which stays) or failed.
type FirstLoginReply struct {
	Token    Handoff
	Defaults []PlanOutcome
	AIKey    string
}

// FirstLoginSink delivers the token and the first login's parts. An error
// means the handoff's effect is unknown, exactly as for Deliver.
type FirstLoginSink interface {
	DeliverFirst(context.Context, Identity, string, string, FirstLogin) (FirstLoginReply, error)
}

// ErrBrokerUnavailable identifies a broker outage during login or an explicit
// revocation attempt. An issued browser session is not rechecked with the broker.
var ErrBrokerUnavailable = errors.New("broker temporarily unavailable")

// BrokerFailure is a closed diagnostic vocabulary; no broker error text is logged.
type BrokerFailure string

const (
	BrokerTransport        BrokerFailure = "transport"
	BrokerStateUnavailable BrokerFailure = "state_unavailable"
	BrokerDenied           BrokerFailure = "denied"
	BrokerNameCollision    BrokerFailure = "name_collision"
	BrokerDrift            BrokerFailure = "drift"
	BrokerInvalidReply     BrokerFailure = "invalid_reply"
	BrokerBindingChanged   BrokerFailure = "binding_changed"
)

func (f BrokerFailure) Error() string { return "broker refused" }
func (f BrokerFailure) Is(target error) bool {
	return target == ErrBrokerUnavailable && (f == BrokerTransport || f == BrokerStateUnavailable)
}
func brokerReason(err error, valid bool) BrokerFailure {
	if err != nil {
		var f BrokerFailure
		if errors.As(err, &f) {
			switch f {
			case BrokerTransport, BrokerStateUnavailable, BrokerDenied, BrokerNameCollision, BrokerDrift, BrokerInvalidReply:
				return f
			}
		}
		return BrokerTransport
	}
	if !valid {
		return BrokerInvalidReply
	}
	return BrokerBindingChanged
}

type BrokerRequest struct {
	Operation, ID, Candidate string
	DefaultLimitBytes        uint64
}
type BrokerRoute struct {
	UID              uint32
	Username, Socket string
}
type BrokerReply struct {
	Route             *BrokerRoute
	Generation, Epoch uint64
	// Created marks the ensure that committed the binding: the one login
	// whose handoff carries the site's onboarding plan (ADR 0030).
	Created bool
}
type Broker interface {
	Exchange(context.Context, BrokerRequest) (BrokerReply, error)
}
type AuthOptions struct {
	GitHubExpiryFile string // gateway-private observation; empty only in synthetic tests
	Version          string // running gateway binary version, supplied by the composition root
	Commit           string // 40-hex source commit of the running binary; empty when unknown
	Broker           Broker
	AdminFile        string // gateway-private name and browser roles; empty only in synthetic tests
	SiteKeyFile      string // gateway-private site AI key (site_key.go); empty: the site holds none
	SessionFile      string // gateway-private persistent state; empty only in synthetic tests
	Provider         Provider
	Sink             TokenSink
	Now              func() time.Time
	Random           io.Reader
	// Log receives only fixed event fields and server-generated attempt IDs.
	// Production defaults to JSONL on stderr.
	Log             *slog.Logger
	SnapshotDial    func(context.Context, string) (net.Conn, error) // test seam; production uses one Unix dial
	SnapshotPeerUID func(*net.UnixConn) int                         // test seam; production reads SO_PEERCRED
}
type pending struct {
	verifier, browser, returnTo, attempt, accessEmail string
	// reconnect is the subject whose own session started an explicit
	// reconnect; empty for an ordinary sign-in.
	reconnect string
	until     time.Time
	serial    uint64
}
type session struct {
	identity    Identity
	profile     AccountProfile
	accessEmail string
	csrf        string
	idle        time.Time
	absolute    time.Time
	// id names the session to its person in the session list; it is never
	// the cookie secret or its store key.
	id      string
	method  string // "github" or "link" (ADR 0018)
	device  string // coarse label from the fixed User-Agent vocabulary
	created time.Time
	// githubAt is the last proven GitHub sign-in. A link session inherits its
	// parent's time, so a QR never counts as a recent GitHub sign-in.
	githubAt time.Time
}
type Auth struct {
	githubExpiryFile string
	githubExpiryMu   sync.Mutex
	version          string
	commit           string
	cfg              OAuthConfig
	provider         Provider
	sink             TokenSink
	broker           Broker
	now              func() time.Time
	random           io.Reader
	log              *slog.Logger
	mu               sync.Mutex
	// accessMu serializes admission changes, which span broker exchanges
	// and so cannot hold mu throughout.
	accessMu sync.Mutex
	pending  map[string]pending
	serial   uint64
	revoked  map[string]uint64
	live     map[string]map[*liveRelay]struct{}
	// terminals counts each session's relayed browser terminals (cap per session).
	terminals        map[string]int
	sessions         map[string]session
	links            map[string]*linkGrant // keyed by the minting session's store key
	editorGrants     map[string]editorGrant
	editors          map[string]editorSession
	viewGrants       map[string]viewGrant
	views            map[string]viewSession
	viewAddresses    map[string]viewAddress // keyed by reservation ID
	viewLinkHosts    map[string]string      // content host -> reservation ID
	viewEntries      map[string]string      // viewEntryKey(entry) -> reservation ID
	viewAddressFault string                 // why the address store is unusable
	viewLinkTraffic  viewLinkTraffic
	sessionFile      string
	adminFile        string
	adminEstablished bool
	settings         serverSettings
	siteKeyFile      string
	siteKey          *siteKeyRecord
	ledger           siteKeyLedger
	// siteKeyOps runs one site key change at a time across the daemon calls
	// that give or replace copies, so no write hands over a key that a
	// concurrent change has already replaced.
	siteKeyOps          chan struct{}
	speech              siteSpeech
	admission           map[string]admission
	unmatchedLog        admission // process-wide budget; never keyed by request input
	accessLog           admission // bound anonymous Access denials independently
	clientDiagnosticLog admission
	snapshotDial        func(context.Context, string) (net.Conn, error)
	snapshotPeerUID     func(*net.UnixConn) int
	access              *accessVerifier
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
	if cfg.EditorOrigin != "" && !validEditorOrigin(cfg.Origin, cfg.EditorOrigin) {
		return nil, errors.New("invalid editor origin")
	}
	if cfg.ViewOrigin != "" && !validViewOrigin(cfg.Origin, cfg.EditorOrigin, cfg.ViewOrigin) {
		return nil, errors.New("invalid view origin")
	}
	if cfg.ViewLinkMaxDays < 0 || cfg.ViewLinkMaxDays > viewLinkMaxDays || cfg.ViewLinkMaxDays > 0 && cfg.ViewOrigin == "" {
		return nil, errors.New("invalid view link expiry")
	}
	if cfg.DefaultLanguage != "" && !validLanguage(cfg.DefaultLanguage) {
		return nil, errors.New("invalid default language")
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
	access, err := newAccessVerifier(cfg.Access, opts.Now)
	if err != nil {
		return nil, err
	}
	a := &Auth{githubExpiryFile: opts.GitHubExpiryFile, version: opts.Version, commit: opts.Commit, sessionFile: opts.SessionFile, cfg: cfg, provider: opts.Provider, sink: opts.Sink, broker: opts.Broker, now: opts.Now, random: opts.Random, log: opts.Log, pending: map[string]pending{}, sessions: map[string]session{}, links: map[string]*linkGrant{}, admission: map[string]admission{}, snapshotDial: opts.SnapshotDial, snapshotPeerUID: opts.SnapshotPeerUID, access: access}
	if err := a.loadAdministration(opts.AdminFile); err != nil {
		return nil, err
	}
	if err := a.loadSiteKey(opts.SiteKeyFile); err != nil {
		return nil, err
	}
	if err := a.loadSiteKeyLedger(); err != nil {
		return nil, err
	}
	a.siteKeyOps = make(chan struct{}, 1)
	if err := a.loadSiteSpeechKey(); err != nil {
		return nil, err
	}
	a.loadViewLinks()
	if err := a.loadSessions(); err != nil {
		// Unusable state cannot authenticate any cookie. Permit a new OAuth
		// login to replace it, without trusting or copying its old contents.
		a.log.Warn("session_store_discarded", "outcome", "rejected", "reason", "invalid_session_store")
		a.sessions = map[string]session{}
	}
	return a, nil
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
func CallbackLogger(w io.Writer) *slog.Logger { return diagnostic.New(w, "gateway") }

// attemptID is independent of OAuth state and of the injectable OAuth random
// source. It is never sent to a browser, provider, broker or untrusted header.
func attemptID() string {
	b := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "" // Diagnostics must not change the authentication outcome.
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func (a *Auth) brokerEvent(attempt, operation string, reason BrokerFailure) {
	if operation != "ensure" && operation != "authorize" {
		return
	}
	switch reason {
	case BrokerTransport, BrokerStateUnavailable, BrokerDenied, BrokerNameCollision, BrokerDrift, BrokerInvalidReply, BrokerBindingChanged:
	default:
		reason = BrokerInvalidReply
	}
	fields := []any{"outcome", "rejected", "reason", "broker_denied", "broker_operation", operation, "broker_reason", string(reason)}
	if attempt != "" {
		fields = append(fields, "attempt_id", attempt)
	}
	a.log.Info("oauth_callback", fields...)
}

// revokeUnused revokes the token this login obtained when the daemon answered
// that the person's gh kept another one. The sign-in goes on either way: a
// token left live only counts against GitHub's limit, as before.
func (a *Auth) revokeUnused(attempt, token string) {
	revoker, ok := a.provider.(TokenRevoker)
	if !ok {
		return
	}
	// A browser that leaves mid-callback must not leave the token live.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	outcome := "revoked"
	if revoker.RevokeToken(ctx, token) != nil {
		outcome = "failed"
	}
	a.log.Info("github_token_revoke", "outcome", outcome, "reason", "unused_by_native_gh", "attempt_id", attempt)
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
	mux.HandleFunc("POST /auth/profile", a.updateProfile)
	mux.HandleFunc("POST /auth/logout", a.logout)
	mux.HandleFunc("GET /auth/sessions", a.listSessions)
	mux.HandleFunc("POST /auth/sessions/end", a.endSession)
	mux.HandleFunc("GET /auth/link", a.linkStatus)
	mux.HandleFunc("POST /auth/link", a.mintLink)
	mux.HandleFunc("POST /auth/link/cancel", a.cancelLink)
	mux.HandleFunc("POST /auth/link/describe", a.describeLink)
	mux.HandleFunc("POST /auth/link/redeem", a.redeemLink)
	mux.HandleFunc("POST "+editorHandoffPath, a.mintEditorHandoff)
	mux.HandleFunc("POST "+viewHandoffPath, a.mintViewHandoff)
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

// Settings return targets are exact paths, not an arbitrary prefix that could
// admit query strings, fragments or traversal into non-UI endpoints.
func settingsUIRoute(path string) bool {
	return uiroutes.IsSettings(path)
}

// uiReturn accepts only known same-origin selection routes; never API/auth/events or external URLs.
// A view's entry address (/n/<secret>) returns to it: the pending flow keeps
// it server-side, so the provider never sees it.
func uiReturn(path string) bool {
	if path == "/" || path == "/workspaces" || settingsUIRoute(path) || path == "/administration" || path == "/resources" || path == "/shares" {
		return true
	}
	if entry, ok := strings.CutPrefix(path, viewEntryPrefix); ok {
		return validViewLinkToken(entry)
	}
	if strings.HasPrefix(path, "/agents/pi:") {
		id := strings.TrimPrefix(path, "/agents/pi:")
		if len(id) != 36 {
			return false
		}
		for _, c := range id {
			if c != '-' && !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				return false
			}
		}
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

// allowedExtraScopes are the scopes a reconnect may add to the sign-in's
// own: workflow, for agents that change GitHub Actions workflows. The person
// opts in on Settings › Code hosts; their daemon remembers the choice.
var allowedExtraScopes = []string{"workflow"}

func (a *Auth) start(w http.ResponseWriter, r *http.Request) {
	returnTo := "/workspaces"
	reconnect, intent := "", "none"
	var extra []string
	reconnecting := a.exact(r, "/auth/github/start", "return_to", "reconnect") && r.URL.Query().Get("reconnect") == "1"
	// A reconnect may also ask for one more scope from a fixed list. It only
	// widens what the person themselves approves on GitHub, so the browser
	// may ask; it is honoured under the same guard as the reconnect.
	scoped := a.exact(r, "/auth/github/start", "return_to", "reconnect", "scope") && r.URL.Query().Get("reconnect") == "1" && slices.Contains(allowedExtraScopes, r.URL.Query().Get("scope"))
	if (reconnecting || scoped) && uiReturn(r.URL.Query().Get("return_to")) {
		returnTo = r.URL.Query().Get("return_to")
		// A reconnect replaces gh's working login, so only the person's own
		// page may ask for it: a cross-site navigation carries the Lax
		// session cookie but not a same-origin fetch site. A refused intent
		// is an ordinary sign-in, and asks for no extra scope.
		intent = "reconnect_refused"
		if s, ok := a.authenticated(r); ok && r.Header.Get("Sec-Fetch-Site") == "same-origin" && len(r.Header.Values("Sec-Fetch-Site")) == 1 {
			reconnect, intent = s.identity.Subject, "reconnect"
			if scoped {
				extra, intent = []string{r.URL.Query().Get("scope")}, "reconnect_scope"
			}
		}
	} else if a.exact(r, "/auth/github/start", "return_to") && uiReturn(r.URL.Query().Get("return_to")) {
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
	if status := a.admit(r, now); status != 0 {
		a.mu.Unlock()
		safe(w, status, "authentication_required")
		return
	}
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
	a.serial++
	a.pending[state] = pending{verifier: verifier, browser: browser, returnTo: returnTo, attempt: attempt, accessEmail: accessEmail(r), reconnect: reconnect, until: now.Add(5 * time.Minute), serial: a.serial}
	a.mu.Unlock()
	a.authEvent(attempt, "started", intent)
	// return_to may hold a view's entry secret; the provider gets no referrer.
	w.Header().Set("Referrer-Policy", "no-referrer")
	http.SetCookie(w, &http.Cookie{Name: flowCookie, Value: browser, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: 300})
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, a.provider.AuthorizationURL(state, challenge, extra), http.StatusFound)
}

// admit spends one token from the per-peer bucket that sign-in starts and
// device-link lookups share. It returns 0 or the refusal status; call under mu.
func (a *Auth) admit(r *http.Request, now time.Time) int {
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
		return 503
	}
	bucket := a.admission[peer]
	if bucket.at.IsZero() {
		bucket.tokens = 16
	} else {
		bucket.tokens = math.Min(16, bucket.tokens+now.Sub(bucket.at).Minutes()*8)
	}
	if bucket.tokens < 1 {
		return 429
	}
	bucket.tokens--
	bucket.at = now
	a.admission[peer] = bucket
	return 0
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
	if e != nil || subtle.ConstantTimeCompare([]byte(c.Value), []byte(p.browser)) != 1 || p.accessEmail != accessEmail(r) {
		a.authEvent(attempt, "rejected", "browser_mismatch")
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	if r.URL.Query().Has("error") {
		a.authEvent(attempt, "rejected", "provider_denied")
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	var token, id, login string
	var profile AccountProfile
	expires := time.Duration(-1)
	// Preserve the lightweight Provider seam for synthetic login tests.
	if provider, ok := a.provider.(interface {
		ExchangeGrant(context.Context, string, string) (GitHubGrant, error)
	}); ok {
		var grant GitHubGrant
		grant, e = provider.ExchangeGrant(r.Context(), r.URL.Query().Get("code"), p.verifier)
		token, id, login, profile, expires = grant.Token, grant.ID, grant.Login, grant.Profile, grant.ExpiresIn
	} else if provider, ok := a.provider.(interface {
		ExchangeProfile(context.Context, string, string) (string, string, string, AccountProfile, error)
	}); ok {
		token, id, login, profile, e = provider.ExchangeProfile(r.Context(), r.URL.Query().Get("code"), p.verifier)
	} else {
		token, id, login, e = a.provider.Exchange(r.Context(), r.URL.Query().Get("code"), p.verifier)
	}
	if e != nil || token == "" {
		a.authEvent(attempt, "rejected", "exchange_failed")
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	a.recordGitHubExpiry(expires)
	if expires > 0 {
		// The OAuth app hands out expiring tokens. The sign-in goes on, but
		// the token gh receives stops working when it expires; only the app
		// registration can change that (docs/operations.md).
		a.log.Warn("github_token_expiring", "outcome", "degraded", "reason", "oauth_app_expiring_tokens", "expires_in_s", int64(expires/time.Second), "attempt_id", attempt)
	}
	n, e := strconv.ParseUint(id, 10, 64)
	if e != nil || n == 0 || strconv.FormatUint(n, 10) != id || login == "" {
		a.authEvent(attempt, "rejected", "identity_denied")
		a.callbackFailure(w, r, 403, "identity_mapping_denied")
		return
	}
	a.mu.Lock()
	revoked := a.subjectClosedLocked(id, p.serial)
	a.mu.Unlock()
	if revoked {
		a.authEvent(attempt, "rejected", "subject_revoked")
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	a.mu.Lock()
	defaultLimit := a.settings.DefaultLimitBytes
	ready := a.administrationHealthy()
	a.mu.Unlock()
	if a.adminFile != "" && !ready {
		a.authEvent(attempt, "rejected", "administration_unavailable")
		a.callbackFailure(w, r, 503, "identity_mapping_denied")
		return
	}
	// Team membership is asked of GitHub with this sign-in's token and told
	// to the broker before ensure, which then decides admission from it.
	teamsUnavailable, teamsRecorded := a.signInTeams(r.Context(), attempt, id, login, token)
	if !teamsRecorded {
		a.callbackFailure(w, r, 503, "identity_mapping_denied")
		return
	}
	// The broker owns the storage mode: under user quotas it refuses to create
	// an account without this default, and without them it sets no limit.
	ensured, err := a.broker.Exchange(r.Context(), BrokerRequest{Operation: "ensure", ID: id, Candidate: login, DefaultLimitBytes: defaultLimit})
	target, valid := brokerIdentity(id, ensured)
	if err != nil || !valid {
		if a.adminFile != "" && defaultLimit == 0 && errors.Is(err, BrokerInvalidReply) {
			// Installation configuration, not this person's identity.
			a.authEvent(attempt, "rejected", "quota_default_missing")
			a.callbackFailure(w, r, 503, "identity_mapping_denied")
			return
		}
		a.brokerEvent(attempt, "ensure", brokerReason(err, valid))
		if teamsUnavailable && errors.Is(err, BrokerDenied) {
			// Honest about why without naming any team: GitHub did not
			// answer, so membership could not be confirmed.
			a.callbackFailure(w, r, 403, "membership_unavailable")
			return
		}
		a.callbackFailure(w, r, 403, "identity_mapping_denied")
		return
	}
	// Old anonymous flows are identified only after the provider exchange.
	a.mu.Lock()
	revoked = a.subjectClosedLocked(id, p.serial)
	a.mu.Unlock()
	if revoked {
		a.authEvent(attempt, "rejected", "subject_revoked")
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	// The token is handed off exactly once. A lost acknowledgement is terminal.
	// Only the login that created the binding carries the site's repository
	// plan and the site AI key, and keeps its record even when the
	// handoff's answer is lost. Nothing is retried: a later login never
	// carries either.
	var delivered error
	var handoff Handoff
	if ensured.Created {
		receipt, keep, use, err := a.deliverFirstLogin(r.Context(), target, id, token)
		delivered, handoff = err, use
		if keep && a.recordReceipt(id, receipt) != nil {
			a.authEvent(attempt, "degraded", "onboarding_record_failed")
		}
	} else if replacing, ok := a.sink.(ReplacingSink); ok && p.reconnect == id {
		// Only a reconnect of the account that started it: signing in to
		// GitHub as someone else there is an ordinary sign-in.
		handoff, delivered = replacing.DeliverReplacing(r.Context(), target, id, token)
	} else {
		handoff, delivered = a.sink.Deliver(r.Context(), target, id, token)
	}
	if delivered != nil {
		a.authEvent(attempt, "rejected", "handoff_failed")
		a.callbackFailure(w, r, 503, "native_adapter_error")
		return
	}
	if handoff == HandoffUnused {
		a.revokeUnused(attempt, token)
	}
	if ensured.Created {
		a.giveSpeechKeyAtFirstLogin(target)
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
	publicID, e := a.sessionID()
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
		a.brokerEvent(attempt, "authorize", brokerReason(err, valid))
		a.callbackFailure(w, r, 403, "identity_mapping_denied")
		return
	}
	a.mu.Lock()
	if a.subjectClosedLocked(id, p.serial) {
		a.mu.Unlock()
		a.authEvent(attempt, "rejected", "subject_revoked")
		a.callbackFailure(w, r, 403, "authentication_required")
		return
	}
	// The broker has just confirmed the binding, so a subject root declared,
	// or an administrator designated, before it existed holds the role from
	// this session's first request. A failed grant leaves the declaration pending for the
	// next sign-in or host apply; it does not refuse the login.
	if a.grantPendingLocked(id) != nil {
		a.authEvent(attempt, "degraded", "administrator_grant_failed")
	}
	now := a.now()
	err = a.changedSessions(func(next map[string]session) {
		for k, v := range next {
			if !now.Before(v.idle) || !now.Before(v.absolute) {
				delete(next, k)
			}
		}
		if old, e := r.Cookie(cookieName); e == nil {
			delete(next, a.cookieKey(old.Value))
		}
		next[a.sessionKey(sid)] = session{identity: target, profile: profile, accessEmail: accessEmail(r), csrf: csrf, idle: now.Add(sessionIdle), absolute: now.Add(sessionAbsolute), id: publicID, method: "github", device: deviceLabel(r.UserAgent()), created: now, githubAt: now}
	})
	a.mu.Unlock()
	if err != nil {
		a.authEvent(attempt, "rejected", "session_failed")
		a.callbackFailure(w, r, 503, "authentication_required")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: sid, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, Expires: now.Add(sessionAbsolute)})
	// The broker-verified route, not the provider login or callback input,
	// is the source of the user attached to a completed login.
	a.log.Info("oauth_callback", "outcome", "accepted", "reason", "none", "attempt_id", attempt, "user", target.Username)
	http.Redirect(w, r, p.returnTo, http.StatusSeeOther)
}
