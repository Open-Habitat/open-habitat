package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"
)

// syntheticGitHub answers the sign-in exchange with a new token each time,
// as GitHub does, and records every revocation the gateway asks for.
type syntheticGitHub struct {
	mu      sync.Mutex
	minted  int
	revoked []string
	// refuse answers a revocation with this status instead of 204.
	refuse int
	// expiry, when set, is the expires_in member of the exchange reply,
	// which then also carries a refresh token, as an OAuth app registered
	// since August 2026 answers by default.
	expiry string
	// user is GitHub's answer about the signing-in account; alice by default.
	user string
}

func (g *syntheticGitHub) RoundTrip(r *http.Request) (*http.Response, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	reply := func(status int, body string) (*http.Response, error) {
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	}
	switch {
	case r.Method == "POST" && r.URL.String() == "https://github.com/login/oauth/access_token":
		g.minted++
		if g.expiry != "" {
			return reply(200, fmt.Sprintf(`{"access_token":"gho_synthetic_minted_%d","expires_in":%s,"refresh_token":"ghr_synthetic_refresh","refresh_token_expires_in":15811200,"token_type":"bearer","scope":"gist,read:org,repo"}`, g.minted, g.expiry))
		}
		return reply(200, fmt.Sprintf(`{"access_token":"gho_synthetic_minted_%d","token_type":"bearer"}`, g.minted))
	case r.Method == "GET" && r.URL.String() == "https://api.github.com/user":
		if g.user != "" {
			return reply(200, g.user)
		}
		return reply(200, `{"id":42,"login":"alice"}`)
	case r.Method == "DELETE" && r.URL.String() == "https://api.github.com/applications/client/token":
		user, pass, ok := r.BasicAuth()
		var body struct {
			AccessToken string `json:"access_token"`
		}
		d := json.NewDecoder(r.Body)
		d.DisallowUnknownFields()
		if !ok || user != "client" || pass != "secret" || r.Header.Get("Content-Type") != "application/json" || d.Decode(&body) != nil || body.AccessToken == "" {
			return reply(401, `{"message":"Requires authentication"}`)
		}
		g.revoked = append(g.revoked, body.AccessToken)
		if g.refuse != 0 {
			return reply(g.refuse, `{"message":"synthetic refusal"}`)
		}
		return reply(204, "")
	}
	return nil, errors.New("unexpected GitHub request " + r.Method + " " + r.URL.String())
}

func revokeFixture(t *testing.T, expiryFile ...string) (http.Handler, *syntheticGitHub, *fakeSink, *fakeBroker, *bytes.Buffer) {
	t.Helper()
	gh := &syntheticGitHub{}
	p := GitHubProvider{ClientID: "client", ClientSecret: "secret", CallbackURL: "https://host.test/auth/github/callback", Client: &http.Client{Transport: gh}}
	s := &fakeSink{}
	broker := newFakeBroker()
	var logs bytes.Buffer
	now := time.Date(2026, 10, 26, 9, 0, 0, 0, time.UTC)
	var stateFile string
	if len(expiryFile) != 0 {
		stateFile = expiryFile[0]
	}
	a, e := NewAuth(OAuthConfig{ClientID: "client", ClientSecret: "secret", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{GitHubExpiryFile: stateFile, Provider: p, Sink: s, Broker: broker, Now: func() time.Time { return now }, Log: CallbackLogger(&logs)})
	if e != nil {
		t.Fatal(e)
	}
	return NewWithAuth("", a), gh, s, broker, &logs
}

func signIn(t *testing.T, h http.Handler) int {
	t.Helper()
	state, flow := start(t, h)
	return callback(h, state, flow).Code
}

// Each sign-in mints a token. The one gh came to hold is never revoked; a
// later one the daemon reports unused, because gh kept its own login, is
// revoked once, with the app's credentials.
func TestSignInRevokesOnlyTheUnusedToken(t *testing.T) {
	h, gh, s, _, logs := revokeFixture(t)
	if code := signIn(t, h); code != 303 || len(gh.revoked) != 0 {
		t.Fatal(code, gh.revoked)
	}
	installed := s.token
	s.handoff = HandoffUnused
	if code := signIn(t, h); code != 303 {
		t.Fatal(code)
	}
	surplus := s.token
	if surplus == installed || len(gh.revoked) != 1 || gh.revoked[0] != surplus {
		t.Fatalf("revoked %v, installed %s, surplus %s", gh.revoked, installed, surplus)
	}
	if !strings.Contains(logs.String(), `"event":"github_token_revoke","schema_version":1,"component":"gateway","outcome":"revoked"`) {
		t.Fatal(logs.String())
	}
	s.handoff = HandoffInUse
	if code := signIn(t, h); code != 303 || len(gh.revoked) != 1 {
		t.Fatal(code, gh.revoked)
	}
	for _, token := range []string{installed, surplus, s.token} {
		if strings.Contains(logs.String(), token) {
			t.Fatal("token logged")
		}
	}
}

// A revocation GitHub refuses or never answers does not fail the sign-in,
// and its log line names no token.
func TestFailedRevocationKeepsTheSignIn(t *testing.T) {
	h, gh, s, _, logs := revokeFixture(t)
	gh.refuse = 500
	s.handoff = HandoffUnused
	if code := signIn(t, h); code != 303 || len(gh.revoked) != 1 {
		t.Fatal(code, gh.revoked)
	}
	if !strings.Contains(logs.String(), `"event":"github_token_revoke","schema_version":1,"component":"gateway","outcome":"failed"`) || strings.Contains(logs.String(), s.token) || strings.Contains(logs.String(), "synthetic refusal") {
		t.Fatal(logs.String())
	}
}

// A handoff whose answer is lost may have installed the token: nothing is
// revoked, and the binding-creating login revokes an unused token as well.
func TestRevocationFollowsOnlyAnAnsweredHandoff(t *testing.T) {
	h, gh, s, broker, _ := revokeFixture(t)
	s.handoff, s.err = HandoffUnused, errors.New("ack lost")
	if code := signIn(t, h); code == 303 || len(gh.revoked) != 0 {
		t.Fatal(code, gh.revoked)
	}
	s.err = nil
	broker.unbound = map[string]bool{"42": true}
	if code := signIn(t, h); code != 303 || len(gh.revoked) != 1 || gh.revoked[0] != s.token {
		t.Fatal(code, gh.revoked)
	}
}

func TestGitHubRevokeTokenNeedsAppCredentials(t *testing.T) {
	gh := &syntheticGitHub{}
	if (GitHubProvider{ClientID: "client", Client: &http.Client{Transport: gh}}).RevokeToken(context.Background(), "gho_x") == nil || len(gh.revoked) != 0 {
		t.Fatal("revoked without the app secret")
	}
	if (GitHubProvider{ClientID: "client", ClientSecret: "wrong", Client: &http.Client{Transport: gh}}).RevokeToken(context.Background(), "gho_x") == nil {
		t.Fatal("refusal accepted")
	}
	if e := (GitHubProvider{ClientID: "client", ClientSecret: "secret", Client: &http.Client{Transport: gh}}).RevokeToken(context.Background(), "gho_x"); e != nil || len(gh.revoked) != 1 {
		t.Fatal(e, gh.revoked)
	}
}

// An OAuth app that issues eight-hour tokens is the cause of gh's login
// dying every day: the sign-in still hands the token over, and the gateway
// says why the connection will not last, naming neither token.
func TestExpiringTokenSignInWarns(t *testing.T) {
	const warning = `"event":"github_token_expiring","schema_version":1,"component":"gateway","outcome":"degraded","reason":"oauth_app_expiring_tokens","expires_in_s":28800`
	path := filepath.Join(t.TempDir(), "github-token-expiry")
	checkState := func(want string) {
		t.Helper()
		b, err := os.ReadFile(path)
		if err != nil || string(b) != want {
			t.Fatalf("expiry observation: %q, %v", b, err)
		}
		st, err := os.Stat(path)
		if err != nil || st.Mode().Perm() != 0600 {
			t.Fatalf("state permissions: %v, %v", st, err)
		}
	}
	h, gh, s, _, logs := revokeFixture(t, path)
	if code := signIn(t, h); code != 303 || strings.Contains(logs.String(), "github_token_expiring") {
		t.Fatal(code, logs.String())
	}
	checkState("non-expiring\n")
	gh.expiry = "28800"
	if code := signIn(t, h); code != 303 || s.token != "gho_synthetic_minted_2" || !strings.Contains(logs.String(), warning) {
		t.Fatal(code, logs.String())
	}
	checkState("expiring\n")
	if strings.Contains(logs.String(), s.token) || strings.Contains(logs.String(), "ghr_") {
		t.Fatal("token logged")
	}
	// A shape GitHub does not send loses only the warning, never the sign-in.
	logs.Reset()
	gh.expiry = `"eight hours"`
	if code := signIn(t, h); code != 303 || s.token != "gho_synthetic_minted_3" || strings.Contains(logs.String(), "github_token_expiring") {
		t.Fatal(code, logs.String())
	}
	checkState("expiring\n") // malformed metadata is not proof of recovery
	gh.expiry = ""
	if code := signIn(t, h); code != 303 {
		t.Fatal(code)
	}
	checkState("non-expiring\n")
	// Restarting a gateway must not erase the last observation.
	_, _, _, _, _ = revokeFixture(t, path)
	checkState("non-expiring\n")
}

func TestExpiryStateWriteFailureDoesNotRejectSignIn(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing", "github-token-expiry")
	h, gh, s, _, logs := revokeFixture(t, path)
	gh.expiry = "28800"
	if code := signIn(t, h); code != 303 {
		t.Fatal(code)
	}
	if !strings.Contains(logs.String(), `"reason":"state_write_failed"`) || strings.Contains(logs.String(), s.token) || strings.Contains(logs.String(), "ghr_") || strings.Contains(logs.String(), path) {
		t.Fatal(logs.String())
	}
}

// replacingSink records whether the gateway asked the daemon to replace gh's
// login, as the transport sink does for an explicit reconnect.
type replacingSink struct {
	fakeSink
	replaced []bool
}

func (s *replacingSink) Deliver(ctx context.Context, m Identity, id, token string) (Handoff, error) {
	s.replaced = append(s.replaced, false)
	return s.fakeSink.Deliver(ctx, m, id, token)
}
func (s *replacingSink) DeliverReplacing(ctx context.Context, m Identity, id, token string) (Handoff, error) {
	s.replaced = append(s.replaced, true)
	return s.fakeSink.Deliver(ctx, m, id, token)
}

// A reconnect the person starts from settings while signed in asks the daemon
// to replace gh's working login, and the gateway revokes nothing, since the
// new token is the one gh then uses. An ordinary sign-in, a reconnect from
// another site's page or from no session, and a reconnect that signs in to
// GitHub as another account all keep today's handoff.
func TestExplicitReconnectReplacesGhLogin(t *testing.T) {
	gh := &syntheticGitHub{}
	p := GitHubProvider{ClientID: "client", ClientSecret: "secret", CallbackURL: "https://host.test/auth/github/callback", Client: &http.Client{Transport: gh}}
	s := &replacingSink{}
	var logs bytes.Buffer
	now := time.Date(2026, 10, 27, 9, 0, 0, 0, time.UTC)
	a, e := NewAuth(OAuthConfig{ClientID: "client", ClientSecret: "secret", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: p, Sink: s, Broker: newFakeBroker(), Now: func() time.Time { return now }, Log: CallbackLogger(&logs)})
	if e != nil {
		t.Fatal(e)
	}
	h := NewWithAuth("", a)
	// begin starts a sign-in from the settings page and finishes it.
	begin := func(reconnect bool, site string, session *http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		path := "/auth/github/start?return_to=%2Fsettings%2Fcode-hosts"
		if reconnect {
			path += "&reconnect=1"
		}
		r := httptest.NewRequest("GET", "https://host.test"+path, nil)
		if site != "" {
			r.Header.Set("Sec-Fetch-Site", site)
		}
		if session != nil {
			r.AddCookie(session)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 302 {
			t.Fatalf("start: %d %s", w.Code, w.Body.String())
		}
		u, _ := url.Parse(w.Header().Get("Location"))
		return callback(h, u.Query().Get("state"), w.Result().Cookies()[0])
	}
	w := begin(false, "", nil)
	if w.Code != 303 {
		t.Fatal(w.Code)
	}
	var session *http.Cookie
	for _, c := range w.Result().Cookies() {
		if c.Name == cookieName {
			session = c
		}
	}
	if session == nil {
		t.Fatal("no session")
	}
	if w := begin(true, "same-origin", session); w.Code != 303 || w.Header().Get("Location") != "/settings/code-hosts" || len(gh.revoked) != 0 {
		t.Fatal(w.Code, w.Header().Get("Location"), gh.revoked)
	}
	// Every other start is an ordinary sign-in: gh keeps its working login,
	// the daemon answers unused, and the new token is revoked.
	s.handoff = HandoffUnused
	for _, c := range []struct {
		site    string
		session *http.Cookie
	}{{"cross-site", session}, {"", session}, {"same-origin", nil}} {
		begin(true, c.site, c.session)
	}
	begin(false, "same-origin", session)
	gh.user = `{"id":43,"login":"bob"}`
	begin(true, "same-origin", session)
	if want := []bool{false, true, false, false, false, false, false}; !slices.Equal(s.replaced, want) || len(gh.revoked) != 5 {
		t.Fatalf("replaced %v, want %v; revoked %d", s.replaced, want, len(gh.revoked))
	}
	if !strings.Contains(logs.String(), `"outcome":"started","reason":"reconnect"`) || !strings.Contains(logs.String(), `"outcome":"started","reason":"reconnect_refused"`) {
		t.Fatal(logs.String())
	}
}

// A reconnect may add the workflow scope, and only under the reconnect's own
// guard: the person's session on their own page. Any other scope, or the
// scope without a reconnect, is not a sign-in shape at all; a refused
// reconnect is an ordinary sign-in that asks for the usual scopes.
func TestReconnectMayAskForWorkflowScope(t *testing.T) {
	gh := &syntheticGitHub{}
	p := GitHubProvider{ClientID: "client", ClientSecret: "secret", CallbackURL: "https://host.test/auth/github/callback", Client: &http.Client{Transport: gh}}
	s := &replacingSink{}
	var logs bytes.Buffer
	now := time.Date(2026, 11, 14, 9, 0, 0, 0, time.UTC)
	a, e := NewAuth(OAuthConfig{ClientID: "client", ClientSecret: "secret", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: p, Sink: s, Broker: newFakeBroker(), Now: func() time.Time { return now }, Log: CallbackLogger(&logs)})
	if e != nil {
		t.Fatal(e)
	}
	h := NewWithAuth("", a)
	start := func(query, site string, session *http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest("GET", "https://host.test/auth/github/start?"+query, nil)
		if site != "" {
			r.Header.Set("Sec-Fetch-Site", site)
		}
		if session != nil {
			r.AddCookie(session)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	scope := func(w *httptest.ResponseRecorder) string {
		t.Helper()
		if w.Code != 302 {
			t.Fatalf("start: %d %s", w.Code, w.Body.String())
		}
		u, _ := url.Parse(w.Header().Get("Location"))
		return u.Query().Get("scope")
	}
	first := start("return_to=%2Fsettings%2Fcode-hosts", "", nil)
	u, _ := url.Parse(first.Header().Get("Location"))
	w := callback(h, u.Query().Get("state"), first.Result().Cookies()[0])
	var session *http.Cookie
	for _, c := range w.Result().Cookies() {
		if c.Name == cookieName {
			session = c
		}
	}
	if session == nil || u.Query().Get("scope") != "repo read:org gist" {
		t.Fatal("first sign-in", u.Query().Get("scope"))
	}
	const allow = "return_to=%2Fsettings%2Fcode-hosts&reconnect=1&scope=workflow"
	w = start(allow, "same-origin", session)
	if got := scope(w); got != "repo read:org gist workflow" {
		t.Fatal(got)
	}
	u, _ = url.Parse(w.Header().Get("Location"))
	if back := callback(h, u.Query().Get("state"), w.Result().Cookies()[0]); back.Code != 303 || !slices.Equal(s.replaced, []bool{false, true}) {
		t.Fatal(back.Code, s.replaced)
	}
	// The reconnect's guard refuses: an ordinary sign-in, usual scopes.
	for _, c := range []struct {
		site    string
		session *http.Cookie
	}{{"cross-site", session}, {"", session}, {"same-origin", nil}} {
		if got := scope(start(allow, c.site, c.session)); got != "repo read:org gist" {
			t.Fatalf("%+v: %s", c, got)
		}
	}
	for _, q := range []string{
		"return_to=%2Fsettings%2Fcode-hosts&reconnect=1&scope=admin%3Aorg",
		"return_to=%2Fsettings%2Fcode-hosts&reconnect=1&scope=workflow+admin%3Aorg",
		"return_to=%2Fsettings%2Fcode-hosts&reconnect=1&scope=",
		"return_to=%2Fsettings%2Fcode-hosts&reconnect=1&scope=workflow&scope=workflow",
		"return_to=%2Fsettings%2Fcode-hosts&scope=workflow",
		"return_to=%2Fsettings%2Fcode-hosts&reconnect=0&scope=workflow",
		"return_to=https%3A%2F%2Fevil.test&reconnect=1&scope=workflow",
	} {
		if w := start(q, "same-origin", session); w.Code != 400 {
			t.Fatalf("%s: %d", q, w.Code)
		}
	}
	if !strings.Contains(logs.String(), `"outcome":"started","reason":"reconnect_scope"`) {
		t.Fatal(logs.String())
	}
}

// The provider adds only allowed extra scopes to its own.
func TestAuthorizationURLExtraScopes(t *testing.T) {
	p := GitHubProvider{ClientID: "client", CallbackURL: "https://host.test/auth/github/callback"}
	for extra, want := range map[string]string{"": "repo read:org gist", "workflow": "repo read:org gist workflow", "admin:org": "repo read:org gist"} {
		var scopes []string
		if extra != "" {
			scopes = []string{extra}
		}
		u, err := url.Parse(p.AuthorizationURL("state", "challenge", scopes))
		if err != nil || u.Query().Get("scope") != want || u.Query().Get("code_challenge_method") != "S256" {
			t.Fatalf("%q: %v %v", extra, u, err)
		}
	}
}
