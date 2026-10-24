package gateway

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

// Device linking (ADR 0018): a signed-in browser mints a one-minute,
// single-use token that it shows as a QR code; the phone confirms and redeems
// it for its own session. Grants live only in gateway memory beside pending
// OAuth flows, so a restart drops them.

const linkLifetime = 60 * time.Second

// linkGrant is the minting session's one outstanding or last link. The token
// itself is never kept; hash is cleared when the token is consumed.
type linkGrant struct {
	hash        string
	parentID    string
	identity    Identity
	profile     AccountProfile
	accessEmail string
	githubAt    time.Time
	serial      uint64
	until       time.Time
	state       string // pending, redeeming, used or failed; expiry is read from until
	usedBy      string // public id of the session the link created
}

func (a *Auth) sessionID() (string, error) {
	b := make([]byte, 16)
	if _, err := io.ReadFull(a.random, b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func validSessionID(id string) bool {
	if len(id) != 22 {
		return false
	}
	_, err := base64.RawURLEncoding.DecodeString(id)
	return err == nil
}
func linkHash(token string) string {
	h := sha256.Sum256([]byte("device-link\x00" + token))
	return hex.EncodeToString(h[:])
}

// linkEvent writes only fixed reasons, the attempt ID and the bound username.
func (a *Auth) linkEvent(attempt, outcome, reason, user string) {
	fields := []any{"outcome", outcome, "reason", reason}
	if attempt != "" {
		fields = append(fields, "attempt_id", attempt)
	}
	if user != "" {
		fields = append(fields, "user", user)
	}
	a.log.Info("device_link", fields...)
}

// currentSession resolves the cookie and also returns its store key.
func (a *Auth) currentSession(w http.ResponseWriter, r *http.Request, write bool) (session, string, bool) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return session{}, "", false
	}
	if write {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return session{}, "", false
		}
	}
	c, _ := r.Cookie(cookieName)
	return s, a.cookieKey(c.Value), true
}

// jsonBody decodes one small JSON object with exactly the expected fields.
func jsonBody(w http.ResponseWriter, r *http.Request, v any) bool {
	if r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 || r.ContentLength < 2 || r.ContentLength > 256 {
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256))
	d.DisallowUnknownFields()
	return d.Decode(v) == nil && d.Decode(new(any)) == io.EOF
}
func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// pruneLinks drops grants whose minting session has gone or that ended long
// ago. Call under mu.
func (a *Auth) pruneLinks(now time.Time) {
	if a.links == nil {
		a.links = map[string]*linkGrant{}
	}
	for key, g := range a.links {
		if s, ok := a.sessions[key]; !ok || s.id != g.parentID || now.Sub(g.until) > 10*time.Minute {
			delete(a.links, key)
		}
	}
}

func (a *Auth) mintLink(w http.ResponseWriter, r *http.Request) {
	if !a.exact(r, "/auth/link") || r.ContentLength > 0 {
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
	now := a.now()
	a.pruneLinks(now)
	if _, alive := a.sessions[key]; !alive {
		a.mu.Unlock()
		safe(w, 401, "authentication_required")
		return
	}
	// Minting again replaces, and so cancels, the previous token.
	a.serial++
	a.links[key] = &linkGrant{hash: linkHash(token), parentID: s.id, identity: s.identity, profile: s.profile, accessEmail: s.accessEmail, githubAt: s.githubAt, serial: a.serial, until: now.Add(linkLifetime), state: "pending"}
	a.mu.Unlock()
	a.linkEvent("", "accepted", "minted", s.identity.Username)
	writeJSON(w, map[string]any{"schema_version": 1, "token": token, "expires_in_seconds": int(linkLifetime / time.Second)})
}

func (a *Auth) cancelLink(w http.ResponseWriter, r *http.Request) {
	if !a.exact(r, "/auth/link/cancel") || r.ContentLength > 0 {
		safe(w, 400, "invalid_request")
		return
	}
	_, key, ok := a.currentSession(w, r, true)
	if !ok {
		return
	}
	a.mu.Lock()
	if g := a.links[key]; g != nil && g.state == "pending" {
		delete(a.links, key)
	}
	a.mu.Unlock()
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}

// linkStatus lets the minting browser see whether its code was used, and by
// which device, so it can hide the code and offer to sign that device out.
func (a *Auth) linkStatus(w http.ResponseWriter, r *http.Request) {
	if !a.exact(r, "/auth/link") {
		safe(w, 400, "invalid_request")
		return
	}
	s, key, ok := a.currentSession(w, r, false)
	if !ok {
		return
	}
	a.mu.Lock()
	now := a.now()
	a.pruneLinks(now)
	out := map[string]any{"schema_version": 1, "state": "none"}
	if g := a.links[key]; g != nil && g.parentID == s.id {
		switch {
		case g.state == "used":
			out["state"] = "used"
			for _, other := range a.sessions {
				if other.id == g.usedBy && other.identity.Subject == s.identity.Subject {
					out["session"] = sessionView(other, false)
				}
			}
		case g.state == "failed":
			out["state"] = "failed"
		case g.state == "redeeming":
			// Not terminal: the phone's redemption is still deciding.
			out["state"] = "pending"
			out["expires_in_seconds"] = 0
		case !now.Before(g.until):
			out["state"] = "expired"
		default:
			out["state"] = "pending"
			out["expires_in_seconds"] = int(g.until.Sub(now).Round(time.Second) / time.Second)
		}
	}
	a.mu.Unlock()
	writeJSON(w, out)
}

// readLink admits an anonymous phone request: exact route, configured Origin
// (no cross-site page may describe or redeem into this browser), the per-peer
// bucket shared with sign-in starts, and a well-formed token body.
func (a *Auth) readLink(w http.ResponseWriter, r *http.Request, path string) (string, bool) {
	if !a.exact(r, path) || r.URL.RawQuery != "" {
		safe(w, 400, "invalid_request")
		return "", false
	}
	if r.Header.Get("Origin") != a.cfg.Origin || len(r.Header.Values("Origin")) != 1 {
		safe(w, 403, "origin_denied")
		return "", false
	}
	var body struct {
		Token string `json:"token"`
	}
	if !jsonBody(w, r, &body) || len(body.Token) != 43 || strings.ContainsAny(body.Token, "=+/") {
		safe(w, 400, "invalid_request")
		return "", false
	}
	a.mu.Lock()
	status := a.admit(r, a.now())
	a.mu.Unlock()
	if status != 0 {
		safe(w, status, "authentication_required")
		return "", false
	}
	return body.Token, true
}

// liveGrant finds the pending grant for token and checks everything that can
// be checked locally. Call under mu. reason is empty when the grant is live.
func (a *Auth) liveGrant(r *http.Request, token string, now time.Time) (string, *linkGrant, string) {
	hash := linkHash(token)
	for key, g := range a.links {
		if g.hash == "" || g.hash != hash {
			continue
		}
		parent, ok := a.sessions[key]
		switch {
		case g.state != "pending" || !now.Before(g.until):
			return key, g, "link_expired"
		case !ok || parent.id != g.parentID || parent.identity != g.identity || !now.Before(parent.idle) || !now.Before(parent.absolute):
			return key, g, "parent_ended"
		case a.subjectClosedLocked(g.identity.Subject, g.serial):
			return key, g, "subject_revoked"
		case g.accessEmail != accessEmail(r):
			return key, g, "access_mismatch"
		}
		return key, g, ""
	}
	return "", nil, "link_missing"
}

func (a *Auth) describeLink(w http.ResponseWriter, r *http.Request) {
	token, ok := a.readLink(w, r, "/auth/link/describe")
	if !ok {
		return
	}
	a.mu.Lock()
	_, g, reason := a.liveGrant(r, token, a.now())
	var profile AccountProfile
	if reason == "" {
		profile = g.profile
	}
	a.mu.Unlock()
	if reason != "" {
		safe(w, 403, "link_unavailable")
		return
	}
	writeJSON(w, map[string]any{"schema_version": 1, "profile": profile})
}

func (a *Auth) redeemLink(w http.ResponseWriter, r *http.Request) {
	token, ok := a.readLink(w, r, "/auth/link/redeem")
	if !ok {
		return
	}
	attempt := attemptID()
	a.mu.Lock()
	key, g, reason := a.liveGrant(r, token, a.now())
	if g != nil {
		// Consumed before anything else is decided: a failed attempt also
		// uses the token up, as the OAuth callback does with its state.
		g.hash = ""
		if g.state == "pending" {
			g.state = "failed"
			if reason == "" {
				g.state = "redeeming"
			}
		}
	}
	a.mu.Unlock()
	fail := func() {
		a.mu.Lock()
		if g.state == "redeeming" {
			g.state = "failed"
		}
		a.mu.Unlock()
	}
	if reason != "" {
		a.linkEvent(attempt, "rejected", reason, "")
		safe(w, 403, "link_unavailable")
		return
	}
	// The broker's authorize check runs here as at the end of every login.
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	checked, err := a.broker.Exchange(ctx, BrokerRequest{Operation: "authorize", ID: g.identity.Subject})
	cancel()
	rebound, valid := brokerIdentity(g.identity.Subject, checked)
	if err != nil || !valid || rebound != g.identity {
		fail()
		a.linkEvent(attempt, "rejected", "broker_denied", "")
		safe(w, 403, "link_unavailable")
		return
	}
	sid, e1 := a.secret()
	csrf, e2 := a.secret()
	publicID, e3 := a.sessionID()
	if e1 != nil || e2 != nil || e3 != nil {
		fail()
		a.linkEvent(attempt, "rejected", "session_failed", "")
		safe(w, 503, "authentication_required")
		return
	}
	a.mu.Lock()
	now := a.now()
	parent, alive := a.sessions[key]
	if !alive || parent.id != g.parentID || !now.Before(parent.idle) || !now.Before(parent.absolute) || a.subjectClosedLocked(g.identity.Subject, g.serial) {
		if g.state == "redeeming" {
			g.state = "failed"
		}
		a.mu.Unlock()
		a.linkEvent(attempt, "rejected", "parent_ended", "")
		safe(w, 403, "link_unavailable")
		return
	}
	err = a.changedSessions(func(next map[string]session) {
		for k, v := range next {
			if !now.Before(v.idle) || !now.Before(v.absolute) {
				delete(next, k)
			}
		}
		if old, e := r.Cookie(cookieName); e == nil {
			delete(next, a.cookieKey(old.Value))
		}
		next[a.sessionKey(sid)] = session{identity: g.identity, profile: parent.profile, accessEmail: accessEmail(r), csrf: csrf, idle: now.Add(sessionIdle), absolute: now.Add(sessionAbsolute), id: publicID, method: "link", device: deviceLabel(r.UserAgent()), created: now, githubAt: g.githubAt}
	})
	if err == nil {
		g.state = "used"
		g.usedBy = publicID
	} else {
		g.state = "failed"
	}
	a.mu.Unlock()
	if err != nil {
		a.linkEvent(attempt, "rejected", "session_failed", "")
		safe(w, 503, "authentication_required")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: sid, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, Expires: now.Add(sessionAbsolute)})
	a.linkEvent(attempt, "accepted", "redeemed", g.identity.Username)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}

func sessionView(s session, current bool) map[string]any {
	return map[string]any{"id": s.id, "method": s.method, "device": s.device, "device_kind": deviceKind(s.device), "created_at": s.created.UTC().Format(time.RFC3339), "current": current}
}

// listSessions shows the person their own browser sessions.
func (a *Auth) listSessions(w http.ResponseWriter, r *http.Request) {
	if !a.exact(r, "/auth/sessions") {
		safe(w, 400, "invalid_request")
		return
	}
	s, key, ok := a.currentSession(w, r, false)
	if !ok {
		return
	}
	a.mu.Lock()
	now := a.now()
	var own []session
	var keys []string
	for k, other := range a.sessions {
		if other.identity.Subject == s.identity.Subject && now.Before(other.idle) && now.Before(other.absolute) {
			own = append(own, other)
			keys = append(keys, k)
		}
	}
	a.mu.Unlock()
	order := make([]int, len(own))
	for i := range order {
		order[i] = i
	}
	sort.Slice(order, func(i, j int) bool {
		x, y := own[order[i]], own[order[j]]
		if !x.created.Equal(y.created) {
			return x.created.After(y.created)
		}
		return x.id < y.id
	})
	list := make([]map[string]any, 0, len(own))
	for _, i := range order {
		list = append(list, sessionView(own[i], keys[i] == key))
	}
	writeJSON(w, map[string]any{"schema_version": 1, "sessions": list})
}

// endSession signs one of the person's own sessions out. Other people's
// sessions are indistinguishable from absent ones.
func (a *Auth) endSession(w http.ResponseWriter, r *http.Request) {
	if !a.exact(r, "/auth/sessions/end") {
		safe(w, 400, "invalid_request")
		return
	}
	s, _, ok := a.currentSession(w, r, true)
	if !ok {
		return
	}
	var body struct {
		ID string `json:"id"`
	}
	if !jsonBody(w, r, &body) || !validSessionID(body.ID) {
		safe(w, 400, "invalid_request")
		return
	}
	a.mu.Lock()
	found := false
	err := a.changedSessions(func(next map[string]session) {
		for k, other := range next {
			if other.id == body.ID && other.identity.Subject == s.identity.Subject {
				delete(next, k)
				found = true
			}
		}
	})
	a.mu.Unlock()
	if err != nil {
		safe(w, 503, "authentication_required")
		return
	}
	if !found {
		safe(w, 404, "session_not_found")
		return
	}
	a.log.Info("session_ended", "outcome", "accepted", "reason", "person_request", "user", s.identity.Username)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}

// deviceLabel maps a User-Agent to a fixed vocabulary. It is a description the
// browser supplies; nothing makes an authorization decision from it, and no
// browser-supplied text is stored or shown.
func deviceLabel(ua string) string {
	system := ""
	switch {
	case strings.Contains(ua, "iPhone"):
		system = "iPhone"
	case strings.Contains(ua, "iPad"):
		system = "iPad"
	case strings.Contains(ua, "Android"):
		system = "Android"
	case strings.Contains(ua, "CrOS"):
		system = "ChromeOS"
	case strings.Contains(ua, "Macintosh") || strings.Contains(ua, "Mac OS X"):
		system = "macOS"
	case strings.Contains(ua, "Windows"):
		system = "Windows"
	case strings.Contains(ua, "Linux"):
		system = "Linux"
	}
	browser := ""
	switch {
	case strings.Contains(ua, "Edg/") || strings.Contains(ua, "EdgiOS") || strings.Contains(ua, "EdgA/"):
		browser = "Edge"
	case strings.Contains(ua, "SamsungBrowser"):
		browser = "Samsung Internet"
	case strings.Contains(ua, "OPR/") || strings.Contains(ua, "OPiOS"):
		browser = "Opera"
	case strings.Contains(ua, "Firefox/") || strings.Contains(ua, "FxiOS"):
		browser = "Firefox"
	case strings.Contains(ua, "Chrome/") || strings.Contains(ua, "CriOS") || strings.Contains(ua, "Chromium/"):
		browser = "Chrome"
	case strings.Contains(ua, "Safari/") && strings.Contains(ua, "Version/"):
		browser = "Safari"
	}
	switch {
	case system != "" && browser != "":
		return system + " · " + browser
	case system != "":
		return system
	}
	return browser
}

var deviceSystems = []string{"", "iPhone", "iPad", "Android", "ChromeOS", "macOS", "Windows", "Linux"}
var deviceBrowsers = []string{"", "Edge", "Samsung Internet", "Opera", "Firefox", "Chrome", "Safari"}

// knownDevice accepts only labels deviceLabel can produce.
func knownDevice(label string) bool {
	for _, s := range deviceSystems {
		for _, b := range deviceBrowsers {
			want := s + b
			if s != "" && b != "" {
				want = s + " · " + b
			}
			if label == want {
				return true
			}
		}
	}
	return false
}
func deviceKind(label string) string {
	if strings.HasPrefix(label, "iPhone") || strings.HasPrefix(label, "Android") {
		return "phone"
	}
	return "computer"
}
