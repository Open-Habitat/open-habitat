package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
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

func (g GitHubProvider) AuthorizationURL(state, challenge string) string {
	q := url.Values{"client_id": {g.ClientID}, "redirect_uri": {g.CallbackURL}, "state": {state}, "scope": {"repo read:org gist"}, "code_challenge": {challenge}, "code_challenge_method": {"S256"}}
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
	form := url.Values{"client_id": {g.ClientID}, "client_secret": {g.ClientSecret}, "code": {code}, "redirect_uri": {g.CallbackURL}, "code_verifier": {verifier}}
	req, e := http.NewRequestWithContext(ctx, "POST", "https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	if e != nil {
		return "", "", "", AccountProfile{}, errors.New("provider unavailable")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, e := g.client().Do(req)
	if e != nil {
		return "", "", "", AccountProfile{}, errors.New("provider unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", "", "", AccountProfile{}, errors.New("provider unavailable")
	}
	var result struct {
		Token     string `json:"access_token"`
		TokenType string `json:"token_type"`
		Error     string `json:"error"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&result) != nil || result.Error != "" || result.Token == "" || !strings.EqualFold(result.TokenType, "bearer") {
		return "", "", "", AccountProfile{}, errors.New("provider unavailable")
	}
	req, e = http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	if e != nil {
		return "", "", "", AccountProfile{}, errors.New("provider unavailable")
	}
	req.Header.Set("Authorization", "Bearer "+result.Token)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, e = g.client().Do(req)
	if e != nil {
		return "", "", "", AccountProfile{}, errors.New("provider unavailable")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", "", "", AccountProfile{}, errors.New("provider unavailable")
	}
	user, ok := githubUser(io.LimitReader(resp.Body, 65537))
	if !ok {
		return "", "", "", AccountProfile{}, errors.New("provider unavailable")
	}
	id := string(user.ID)
	n, e := strconv.ParseUint(id, 10, 64)
	if e != nil || n == 0 || strconv.FormatUint(n, 10) != id || user.Login == "" {
		return "", "", "", AccountProfile{}, errors.New("provider unavailable")
	}
	return result.Token, id, user.Login, normalizeProfile(AccountProfile{Name: user.Name, Email: user.Email, AvatarURL: user.AvatarURL}), nil
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
