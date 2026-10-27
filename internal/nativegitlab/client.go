package nativegitlab

import (
	"context"
	"crypto/x509"
	"encoding/json"
	"net/http"
	"net/netip"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
)

// Account is the GitLab user a token authenticates. For a group or project
// access token it is that token's bot user.
type Account struct {
	ID       int64
	Username string
}

// Push says whether the token can push over Git, as far as GitLab tells.
type Push string

const (
	// PushYes: the token has write_repository or api.
	PushYes Push = "yes"
	// PushNo: GitLab lists the token's scopes and neither is among them.
	PushNo Push = "no"
	// PushUnknown: GitLab did not describe the token (a fine-grained token,
	// a server without the self endpoint, or a read the token may not make).
	// The first push tells.
	PushUnknown Push = "unknown"
)

// TokenInfo is what GET /personal_access_tokens/self says about the token.
type TokenInfo struct {
	// Known is false when GitLab gave no description; the rest is then
	// empty and Push is PushUnknown.
	Known bool
	// Scopes are the legacy scopes, sorted.
	Scopes []string
	// Fine is set for a fine-grained token (granular scopes), whose push
	// permission the legacy scopes do not tell.
	Fine bool
	// ExpiresAt is GitLab's expiry date, YYYY-MM-DD, or "" when the token
	// does not expire.
	ExpiresAt string
	Push      Push
}

const (
	maxBody         = 256 << 10
	projectPageSize = 100
	projectPageMax  = 4 << 20
)

// Client performs the fixed GitLab reads over nativeforge's egress-checked
// HTTP: no redirects, no proxy, verified TLS, only the base's own address.
// Its reads are /user, /personal_access_tokens/self, the person's project
// list and one project by id; it is never a proxy.
type Client struct {
	resolve func(ctx context.Context, host string) ([]netip.Addr, error)
	roots   *x509.CertPool
}

// NewClient returns the production client.
func NewClient() *Client { return &Client{} }

// NewClientWithRoots trusts roots instead of the system store. Only same-UID
// tests and the synthetic browser host use it, for their own fixture CA; the
// product never does.
func NewClientWithRoots(roots *x509.CertPool) *Client { return &Client{roots: roots} }

// get performs one bounded GET of base+/api/v4+path with the token in
// GitLab's PRIVATE-TOKEN header, for this request only.
func (c *Client) get(ctx context.Context, b Base, path, token string, limit int, out any) (http.Header, error) {
	if !b.Valid() {
		return nil, ErrInvalidAddress
	}
	if !nativeforge.ValidToken(token) {
		return nil, ErrInvalidToken
	}
	resp, err := nativeforge.HTTP{Resolve: c.resolve, Roots: c.roots}.Get(ctx, b, "/api/v4"+path, http.Header{"Private-Token": {token}}, limit)
	if err != nil {
		return nil, err
	}
	switch resp.Status {
	case http.StatusOK:
	case http.StatusUnauthorized:
		return nil, refusal(resp)
	case http.StatusForbidden:
		return nil, ErrScope
	case http.StatusNotFound:
		return nil, ErrNotFound
	default:
		return nil, ErrProtocol
	}
	if err := resp.JSON(out); err != nil {
		return nil, err
	}
	return resp.Header, nil
}

// refusal tells an expired token from any other rejection by GitLab's own
// OAuth-style error description, the one difference a person acts on
// differently (create a new token rather than check this one).
func refusal(resp nativeforge.Response) error {
	var e struct {
		Description string `json:"error_description"`
	}
	if resp.JSON(&e) == nil && strings.HasPrefix(e.Description, "Token is expired") {
		return ErrExpired
	}
	return ErrRejected
}

// User reads /user: which GitLab user the token authenticates. A username
// the request or glab's file names is no proof of that; only this answer is.
// It needs read_api (or read_user, or api).
func (c *Client) User(ctx context.Context, b Base, token string) (Account, error) {
	var u struct {
		ID       int64  `json:"id"`
		Username string `json:"username"`
	}
	if _, err := c.get(ctx, b, "/user", token, maxBody, &u); err != nil {
		if err == ErrNotFound {
			// No GitLab API at this address.
			return Account{}, ErrProtocol
		}
		return Account{}, err
	}
	if u.ID <= 0 || !gitlabUser.MatchString(u.Username) {
		return Account{}, ErrProtocol
	}
	return Account{ID: u.ID, Username: u.Username}, nil
}

var expiry = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}$`)
var scopeName = regexp.MustCompile(`^[a-z_:]{1,64}$`)

// Token reads /personal_access_tokens/self. A rejection or expiry is that
// error; any other failure (a fine-grained or OAuth token the endpoint does
// not describe, an older GitLab without it, a malformed answer) is an
// unknown description, never an error, because the token still works for
// what it can do.
func (c *Client) Token(ctx context.Context, b Base, token string) (TokenInfo, error) {
	var t struct {
		Scopes        []string          `json:"scopes"`
		GranularScope []json.RawMessage `json:"granular_scopes"`
		ExpiresAt     *string           `json:"expires_at"`
		Active        *bool             `json:"active"`
		Revoked       bool              `json:"revoked"`
	}
	_, err := c.get(ctx, b, "/personal_access_tokens/self", token, maxBody, &t)
	switch {
	case err == ErrRejected || err == ErrExpired:
		return TokenInfo{}, err
	case err != nil:
		return TokenInfo{Push: PushUnknown}, nil
	}
	if t.Revoked || (t.Active != nil && !*t.Active) {
		return TokenInfo{}, ErrRejected
	}
	info := TokenInfo{Known: true, Scopes: []string{}, Fine: len(t.GranularScope) > 0}
	for _, s := range t.Scopes {
		if !scopeName.MatchString(s) || len(info.Scopes) == 32 {
			return TokenInfo{Push: PushUnknown}, nil
		}
		info.Scopes = append(info.Scopes, s)
	}
	slices.Sort(info.Scopes)
	info.Scopes = slices.Compact(info.Scopes)
	if t.ExpiresAt != nil {
		if d, err := time.Parse("2006-01-02", *t.ExpiresAt); err != nil || !expiry.MatchString(*t.ExpiresAt) || d.Year() < 1970 {
			return TokenInfo{Push: PushUnknown}, nil
		}
		info.ExpiresAt = *t.ExpiresAt
	}
	switch {
	case slices.Contains(info.Scopes, "api") || slices.Contains(info.Scopes, "write_repository"):
		info.Push = PushYes
	case info.Fine || len(info.Scopes) == 0:
		info.Push = PushUnknown
	default:
		info.Push = PushNo
	}
	return info, nil
}

// Verify is what a connection needs before glab's file holds a token, and
// what a check reports: the user the token authenticates (/user), its own
// description where GitLab gives one (/personal_access_tokens/self), and one
// page of the person's project list, which only read_api (or api) can read.
// A token without read_api fails /user or the list with ErrScope. Missing
// write_repository is no refusal: such a token lists and clones, and the
// description says push will not work.
func (c *Client) Verify(ctx context.Context, b Base, token string) (Account, TokenInfo, error) {
	account, err := c.User(ctx, b, token)
	if err != nil {
		return Account{}, TokenInfo{}, err
	}
	info, err := c.Token(ctx, b, token)
	if err != nil {
		return Account{}, TokenInfo{}, err
	}
	var page []json.RawMessage
	if _, err := c.get(ctx, b, "/projects?membership=true&simple=true&per_page=1", token, maxBody, &page); err != nil {
		if err == ErrNotFound {
			err = ErrProtocol
		}
		return Account{}, TokenInfo{}, err
	}
	if page == nil {
		return Account{}, TokenInfo{}, ErrProtocol
	}
	return account, info, nil
}
