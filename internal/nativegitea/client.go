package nativegitea

import (
	"context"
	"crypto/x509"
	"encoding/json"
	"net/http"
	"net/netip"
	"regexp"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
)

// Account is the Gitea identity a PAT authenticates.
type Account struct {
	ID    int64
	Login string
}

var giteaLogin = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,40}$`)

const maxBody = 256 << 10

// Client performs the fixed Gitea reads over nativeforge's egress-checked
// HTTP: no redirects, no proxy, verified TLS, only the base's own address.
type Client struct {
	// Test seams: a resolver and private roots. Production uses the system
	// resolver and the operator-approved system trust store.
	resolve func(ctx context.Context, host string) ([]netip.Addr, error)
	roots   *x509.CertPool
}

// NewClient returns the production client.
func NewClient() *Client { return &Client{} }

// NewClientWithRoots trusts roots instead of the system store. Only same-UID
// tests and the synthetic browser host use it, for their own fixture CA; the
// product never does.
func NewClientWithRoots(roots *x509.CertPool) *Client { return &Client{roots: roots} }

// get performs one bounded GET of base+/api/v1+path with the PAT. The token
// lives only in this request's header.
func (c *Client) get(ctx context.Context, b Base, path, token string, out any) error {
	_, err := c.getLimited(ctx, b, path, token, maxBody, out)
	return err
}

// getLimited is get with its own body bound; it also returns the answer's
// headers. Only a JSON answer is Gitea's.
func (c *Client) getLimited(ctx context.Context, b Base, path, token string, limit int, out any) (http.Header, error) {
	if !b.Valid() {
		return nil, ErrInvalidAddress
	}
	if !validToken(token) {
		return nil, ErrInvalidToken
	}
	resp, err := nativeforge.HTTP{Resolve: c.resolve, Roots: c.roots}.Get(ctx, b, "/api/v1"+path, http.Header{"Authorization": {"token " + token}}, limit)
	if err != nil {
		return nil, err
	}
	switch resp.Status {
	case http.StatusOK:
	case http.StatusUnauthorized:
		return nil, ErrRejected
	case http.StatusForbidden:
		return nil, ErrScope
	default:
		return nil, ErrProtocol
	}
	if err := resp.JSON(out); err != nil {
		return nil, err
	}
	return resp.Header, nil
}

// User reads /user: which Gitea account the PAT authenticates. A Basic or
// requested username is no proof of that; only this answer is.
func (c *Client) User(ctx context.Context, b Base, token string) (Account, error) {
	var u struct {
		ID    int64  `json:"id"`
		Login string `json:"login"`
	}
	if err := c.get(ctx, b, "/user", token, &u); err != nil {
		return Account{}, err
	}
	if u.ID <= 0 || !giteaLogin.MatchString(u.Login) {
		return Account{}, ErrProtocol
	}
	return Account{ID: u.ID, Login: u.Login}, nil
}

// Verify is what a connection needs before tea's file holds a PAT and
// what a check reports: the account the PAT authenticates (/user, which
// needs read:user) and one page of the repository list (/user/repos, which
// needs read:repository). Gitea shows a token none of its own scopes, so only
// the two reads the connector makes can show that both are granted; a PAT
// lacking either is ErrScope.
func (c *Client) Verify(ctx context.Context, b Base, token string) (Account, error) {
	account, err := c.User(ctx, b, token)
	if err != nil {
		return Account{}, err
	}
	var page []json.RawMessage
	if _, err := c.getLimited(ctx, b, "/user/repos?page=1&limit=1", token, repoPageBytes, &page); err != nil {
		return Account{}, err
	}
	if page == nil {
		return Account{}, ErrProtocol
	}
	return account, nil
}

// validToken bounds a PAT to printable ASCII without spaces, so it can never
// split a Git credential protocol line or an HTTP header.
func validToken(t string) bool { return nativeforge.ValidToken(t) }
