package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
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
		return reply(200, fmt.Sprintf(`{"access_token":"gho_synthetic_minted_%d","token_type":"bearer"}`, g.minted))
	case r.Method == "GET" && r.URL.String() == "https://api.github.com/user":
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

func revokeFixture(t *testing.T) (http.Handler, *syntheticGitHub, *fakeSink, *fakeBroker, *bytes.Buffer) {
	t.Helper()
	gh := &syntheticGitHub{}
	p := GitHubProvider{ClientID: "client", ClientSecret: "secret", CallbackURL: "https://host.test/auth/github/callback", Client: &http.Client{Transport: gh}}
	s := &fakeSink{}
	broker := newFakeBroker()
	var logs bytes.Buffer
	now := time.Date(2026, 10, 26, 9, 0, 0, 0, time.UTC)
	a, e := NewAuth(OAuthConfig{ClientID: "client", ClientSecret: "secret", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: p, Sink: s, Broker: broker, Now: func() time.Time { return now }, Log: CallbackLogger(&logs)})
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
