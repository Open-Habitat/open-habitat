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
			token, id, login, err := p.Exchange(context.Background(), "code", "verifier")
			if tc.valid && (err != nil || token != "synthetic" || id != "42" || login != "alice") || !tc.valid && (err == nil || token != "" || id != "" || login != "") || calls != 2 {
				t.Fatalf("calls=%d id=%s login=%s err=%v", calls, id, login, err)
			}
		})
	}
}
