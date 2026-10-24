package gateway

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type providerRoundTrip func(*http.Request) (*http.Response, error)

func (f providerRoundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestGitHubVerifiedUserProfile(t *testing.T) {
	for _, tc := range []struct {
		name, profile string
		valid         bool
	}{
		{"canonical", `{"id":42,"login":"alice","name":"Ignored"}`, true},
		{"missing login", `{"id":42}`, false},
		{"missing id", `{"login":"alice"}`, false},
		{"string id", `{"id":"42","login":"alice"}`, false},
		{"zero id", `{"id":0,"login":"alice"}`, false},
		{"duplicate id", `{"id":42,"id":43,"login":"alice"}`, false},
		{"case variant", `{"id":42,"ID":43,"login":"alice"}`, false},
		{"duplicate login", `{"id":42,"login":"alice","login":"bob"}`, false},
		{"extra object", `{"id":42,"login":"alice"}{"id":43}`, false},
		{"oversize", `{"id":42,"login":"alice","name":"` + strings.Repeat("a", 65536) + `"}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			p := GitHubProvider{ClientID: "client", ClientSecret: "secret", CallbackURL: "https://host.test/auth/github/callback", Client: &http.Client{Transport: providerRoundTrip(func(r *http.Request) (*http.Response, error) {
				calls++
				if calls == 1 {
					if r.URL.String() != "https://github.com/login/oauth/access_token" || r.Method != "POST" {
						return nil, errors.New("bad exchange")
					}
					return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"access_token":"synthetic","token_type":"bearer"}`)), Header: make(http.Header)}, nil
				}
				if r.URL.String() != "https://api.github.com/user" || r.Header.Get("Authorization") != "Bearer synthetic" {
					return nil, errors.New("bad user")
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(tc.profile)), Header: make(http.Header)}, nil
			})}}
			token, id, login, profile, err := p.ExchangeProfile(context.Background(), "code", "verifier")
			if tc.name == "canonical" && (profile.Name != "Ignored" || profile.Email != "" || profile.AvatarURL != "") {
				t.Fatalf("unexpected profile: %+v", profile)
			}
			if tc.valid && (err != nil || token != "synthetic" || id != "42" || login != "alice") || !tc.valid && (err == nil || token != "" || id != "" || login != "") || calls != 2 {
				t.Fatalf("calls=%d id=%s login=%s err=%v", calls, id, login, err)
			}
		})
	}
}

// The access check reads one fixed endpoint with the person's token and
// never follows a redirect: GitHub's not-found and refusals mean no_access,
// a rate limit, redirect, error or a different repository means check_failed.
func TestGitHubCheckRepository(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		header map[string]string
		body   string
		want   string
	}{
		{"readable", 200, nil, `{"full_name":"Acme/Team"}`, "readable"},
		{"other repository", 200, nil, `{"full_name":"acme/other"}`, "check_failed"},
		{"not found", 404, nil, `{}`, "no_access"},
		{"forbidden", 403, nil, `{}`, "no_access"},
		{"rate limited", 403, map[string]string{"X-RateLimit-Remaining": "0"}, `{}`, "check_failed"},
		{"renamed", 301, map[string]string{"Location": "https://api.github.com/repositories/1"}, ``, "check_failed"},
		{"unauthorized", 401, nil, `{}`, "check_failed"},
		{"server error", 502, nil, ``, "check_failed"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			p := GitHubProvider{Client: &http.Client{Transport: providerRoundTrip(func(r *http.Request) (*http.Response, error) {
				calls++
				if r.Method != "GET" || r.URL.String() != "https://api.github.com/repos/acme/team" || r.Header.Get("Authorization") != "Bearer person-token" {
					return nil, errors.New("unexpected request")
				}
				h := make(http.Header)
				for k, v := range tc.header {
					h.Set(k, v)
				}
				return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body)), Header: h}, nil
			})}}
			if got := p.CheckRepository(context.Background(), "person-token", "acme/team"); got != tc.want || calls != 1 {
				t.Fatalf("got %s after %d calls", got, calls)
			}
		})
	}
	if got := (GitHubProvider{}).CheckRepository(context.Background(), "t", "acme/../x"); got != "check_failed" {
		t.Fatal(got)
	}
}
