package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"
)

// GitHubProvider exchanges a code once and resolves /user using the returned bearer token.
// Only fixed GitHub endpoints are contacted; no redirects are followed with credentials.
type GitHubProvider struct {
	ClientID, ClientSecret, CallbackURL string
	Client                              *http.Client
}

// githubScopes are what every sign-in asks for, so the person's gh can clone,
// push, see organisation memberships and create gists.
const githubScopes = "repo read:org gist"

// AuthorizationURL asks for githubScopes and the extra scopes start allowed
// (only ever from allowedExtraScopes).
func (g GitHubProvider) AuthorizationURL(state, challenge string, extraScopes []string) string {
	scope := githubScopes
	for _, s := range extraScopes {
		if slices.Contains(allowedExtraScopes, s) {
			scope += " " + s
		}
	}
	q := url.Values{"client_id": {g.ClientID}, "redirect_uri": {g.CallbackURL}, "state": {state}, "scope": {scope}, "code_challenge": {challenge}, "code_challenge_method": {"S256"}}
	return "https://github.com/login/oauth/authorize?" + q.Encode()
}
func (g GitHubProvider) client() *http.Client {
	if g.Client != nil {
		copy := *g.Client
		copy.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
		return &copy
	}
	return &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
}
func (g GitHubProvider) Exchange(ctx context.Context, code, verifier string) (string, string, string, error) {
	token, id, login, _, err := g.ExchangeProfile(ctx, code, verifier)
	return token, id, login, err
}

func (g GitHubProvider) ExchangeProfile(ctx context.Context, code, verifier string) (string, string, string, AccountProfile, error) {
	grant, err := g.ExchangeGrant(ctx, code, verifier)
	return grant.Token, grant.ID, grant.Login, grant.Profile, err
}

// GitHubGrant is one code exchange. ExpiresIn is positive when GitHub issued
// an expiring token: an OAuth app registered since August 2026 does so by
// default, for eight hours, with a refresh token. gh cannot refresh another
// app's token and Habitat keeps none, so such a login stops working in gh
// after ExpiresIn; the refresh token is never read. Zero means no expiry
// metadata; negative means malformed metadata (not evidence of a durable token).
type GitHubGrant struct {
	Token, ID, Login string
	Profile          AccountProfile
	ExpiresIn        time.Duration
}

func (g GitHubProvider) ExchangeGrant(ctx context.Context, code, verifier string) (GitHubGrant, error) {
	token, id, login, profile, expires, err := g.exchange(ctx, code, verifier)
	return GitHubGrant{Token: token, ID: id, Login: login, Profile: profile, ExpiresIn: expires}, err
}

func (g GitHubProvider) exchange(ctx context.Context, code, verifier string) (string, string, string, AccountProfile, time.Duration, error) {
	form := url.Values{"client_id": {g.ClientID}, "client_secret": {g.ClientSecret}, "code": {code}, "redirect_uri": {g.CallbackURL}, "code_verifier": {verifier}}
	req, e := http.NewRequestWithContext(ctx, "POST", "https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	if e != nil {
		return "", "", "", AccountProfile{}, 0, errors.New("provider unavailable")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, e := g.client().Do(req)
	if e != nil {
		return "", "", "", AccountProfile{}, 0, errors.New("provider unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", "", "", AccountProfile{}, 0, errors.New("provider unavailable")
	}
	var result struct {
		Token     string `json:"access_token"`
		TokenType string `json:"token_type"`
		Error     string `json:"error"`
		// Raw, so that an unexpected shape only loses the warning, never
		// the sign-in.
		ExpiresIn json.RawMessage `json:"expires_in"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&result) != nil || result.Error != "" || result.Token == "" || !strings.EqualFold(result.TokenType, "bearer") {
		return "", "", "", AccountProfile{}, 0, errors.New("provider unavailable")
	}
	req, e = http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	if e != nil {
		return "", "", "", AccountProfile{}, 0, errors.New("provider unavailable")
	}
	req.Header.Set("Authorization", "Bearer "+result.Token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, e = g.client().Do(req)
	if e != nil {
		return "", "", "", AccountProfile{}, 0, errors.New("provider unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", "", "", AccountProfile{}, 0, errors.New("provider unavailable")
	}
	user, ok := githubUser(io.LimitReader(resp.Body, 65537))
	if !ok {
		return "", "", "", AccountProfile{}, 0, errors.New("provider unavailable")
	}
	id := string(user.ID)
	n, e := strconv.ParseUint(id, 10, 64)
	if e != nil || n == 0 || strconv.FormatUint(n, 10) != id || user.Login == "" {
		return "", "", "", AccountProfile{}, 0, errors.New("provider unavailable")
	}
	var expires time.Duration
	if len(result.ExpiresIn) != 0 {
		expires = -1
		if n, e := strconv.ParseInt(strings.Trim(string(result.ExpiresIn), `"`), 10, 32); e == nil && n > 0 {
			expires = time.Duration(n) * time.Second
		}
	}
	return result.Token, id, user.Login, normalizeProfile(AccountProfile{Name: user.Name, Email: user.Email, AvatarURL: user.AvatarURL}), expires, nil
}

// Reject ambiguous /user identities (duplicate or case-variant keys), oversized
// bodies and trailing data. Other GitHub profile fields do not authorize access.
func githubUser(body io.Reader) (struct {
	ID        json.RawMessage
	Login     string
	Name      string
	Email     string
	AvatarURL string
}, bool) {
	var user struct {
		ID        json.RawMessage
		Login     string
		Name      string
		Email     string
		AvatarURL string
	}
	data, err := io.ReadAll(body)
	if err != nil || len(data) > 65536 {
		return user, false
	}
	d := json.NewDecoder(strings.NewReader(string(data)))
	tok, err := d.Token()
	if err != nil || tok != json.Delim('{') {
		return user, false
	}
	seen := map[string]bool{}
	for d.More() {
		key, err := d.Token()
		if err != nil {
			return user, false
		}
		k, ok := key.(string)
		if !ok {
			return user, false
		}
		if strings.EqualFold(k, "id") || strings.EqualFold(k, "login") {
			if k != "id" && k != "login" || seen[k] {
				return user, false
			}
			seen[k] = true
		}
		var raw json.RawMessage
		if d.Decode(&raw) != nil {
			return user, false
		}
		if k == "id" {
			user.ID = raw
		}
		if k == "login" && json.Unmarshal(raw, &user.Login) != nil {
			return user, false
		}
		// Malformed optional fields are absent rather than an authentication failure.
		if k == "name" {
			_ = json.Unmarshal(raw, &user.Name)
		}
		if k == "email" {
			_ = json.Unmarshal(raw, &user.Email)
		}
		if k == "avatar_url" {
			_ = json.Unmarshal(raw, &user.AvatarURL)
		}
	}
	tok, err = d.Token()
	if err != nil || tok != json.Delim('}') {
		return user, false
	}
	if _, err = d.Token(); err != io.EOF || !seen["id"] || !seen["login"] {
		return user, false
	}
	return user, true
}

// githubAPI is the fixed REST origin; tests replace the transport, not the URL.
const githubAPI = "https://api.github.com"

// LookupLogin resolves a login through the public users API, authenticated as
// the OAuth app only for its rate limit. No person's token is used.
func (g GitHubProvider) LookupLogin(ctx context.Context, login string) (GitHubUser, error) {
	if !githubLoginName(login) {
		return GitHubUser{}, ErrGitHubUserNotFound
	}
	u, err := g.lookup(ctx, "/users/"+login)
	if err == nil && !strings.EqualFold(u.Login, login) {
		return GitHubUser{}, ErrGitHubLookup
	}
	return u, err
}

// LookupID resolves a numeric account id the same way.
func (g GitHubProvider) LookupID(ctx context.Context, id string) (GitHubUser, error) {
	if !canonicalSubject(id) {
		return GitHubUser{}, ErrGitHubUserNotFound
	}
	u, err := g.lookup(ctx, "/user/"+id)
	if err == nil && u.ID != id {
		return GitHubUser{}, ErrGitHubLookup
	}
	return u, err
}

func (g GitHubProvider) lookup(ctx context.Context, path string) (GitHubUser, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "GET", githubAPI+path, nil)
	if err != nil {
		return GitHubUser{}, ErrGitHubLookup
	}
	req.SetBasicAuth(g.ClientID, g.ClientSecret)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := g.client().Do(req)
	if err != nil {
		return GitHubUser{}, ErrGitHubLookup
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return GitHubUser{}, ErrGitHubUserNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return GitHubUser{}, ErrGitHubLookup
	}
	var body struct {
		ID    json.Number `json:"id"`
		Login string      `json:"login"`
		Name  string      `json:"name"`
		Type  string      `json:"type"`
	}
	d := json.NewDecoder(io.LimitReader(resp.Body, 65536))
	d.UseNumber()
	if d.Decode(&body) != nil {
		return GitHubUser{}, ErrGitHubLookup
	}
	// Organisations and bots cannot sign in as a person.
	if body.Type != "User" {
		return GitHubUser{}, ErrGitHubNotUser
	}
	if !canonicalSubject(body.ID.String()) || !githubLoginName(body.Login) {
		return GitHubUser{}, ErrGitHubLookup
	}
	name := body.Name
	if len(name) > 255 {
		name = ""
	}
	return GitHubUser{ID: body.ID.String(), Login: body.Login, Name: name, Type: body.Type}, nil
}

// RevokeToken deletes one OAuth token of this app with the app's own
// credentials. GitHub answers 204 when it is gone; nothing it says is
// returned, and the token is never logged.
func (g GitHubProvider) RevokeToken(ctx context.Context, token string) error {
	if g.ClientID == "" || g.ClientSecret == "" || token == "" {
		return errors.New("revocation unavailable")
	}
	body, e := json.Marshal(struct {
		AccessToken string `json:"access_token"`
	}{token})
	if e != nil {
		return errors.New("revocation unavailable")
	}
	req, e := http.NewRequestWithContext(ctx, "DELETE", githubAPI+"/applications/"+url.PathEscape(g.ClientID)+"/token", bytes.NewReader(body))
	if e != nil {
		return errors.New("revocation unavailable")
	}
	req.SetBasicAuth(g.ClientID, g.ClientSecret)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")
	resp, e := g.client().Do(req)
	if e != nil {
		return errors.New("revocation unavailable")
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		return errors.New("revocation refused")
	}
	return nil
}

// CheckRepository answers whether the signed-in person can read one site
// default (ADR 0030): readable, no_access or check_failed. It uses the
// person's transient sign-in token for one read-only GET of a fixed GitHub
// endpoint, never follows a redirect and returns nothing GitHub said.
func (g GitHubProvider) CheckRepository(ctx context.Context, token, fullName string) string {
	if !validRepositoryName(fullName) {
		return "check_failed"
	}
	req, e := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/repos/"+fullName, nil)
	if e != nil {
		return "check_failed"
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, e := g.client().Do(req)
	if e != nil {
		return "check_failed"
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == 404, resp.StatusCode == 451, resp.StatusCode == 403 && resp.Header.Get("X-RateLimit-Remaining") != "0":
		// GitHub answers a repository the token cannot see as not found;
		// a refusal that is not the rate limit says the same.
		return "no_access"
	case resp.StatusCode != 200:
		return "check_failed"
	}
	var repo struct {
		FullName string `json:"full_name"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&repo) != nil || !strings.EqualFold(repo.FullName, fullName) {
		return "check_failed"
	}
	return "readable"
}
