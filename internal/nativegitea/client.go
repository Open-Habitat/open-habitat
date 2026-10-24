package nativegitea

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"net/netip"
	"regexp"
	"strconv"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/egress"
)

// Account is the Gitea identity a PAT authenticates.
type Account struct {
	ID    int64
	Login string
}

var giteaLogin = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,40}$`)

const (
	requestTimeout = 15 * time.Second
	maxBody        = 256 << 10
)

// Client performs the fixed Gitea reads. It never follows redirects, never
// uses a proxy, verifies TLS against the system trust store and dials only
// the base's own host and port after checking every resolved address.
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

func (c *Client) lookup(ctx context.Context, host string) ([]netip.Addr, error) {
	if ip, err := netip.ParseAddr(host); err == nil {
		return []netip.Addr{ip}, nil
	}
	if c.resolve != nil {
		return c.resolve(ctx, host)
	}
	return net.DefaultResolver.LookupNetIP(ctx, "ip", host)
}

var errForbidden = errors.New("forbidden destination")

func (c *Client) transport(b Base) *http.Transport {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	want := net.JoinHostPort(b.Host, strconv.Itoa(b.Port))
	return &http.Transport{
		Proxy: nil,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			// Only the base itself is ever dialed; no redirect or proxy can
			// reach here with another address.
			if addr != want {
				return nil, errForbidden
			}
			ips, err := c.lookup(ctx, b.Host)
			if err != nil || len(ips) == 0 {
				return nil, ErrUnreachable
			}
			for _, ip := range ips {
				if !egress.Allowed(ip, b.explicitLoopback()) {
					return nil, errForbidden
				}
			}
			var last error = ErrUnreachable
			for _, ip := range ips {
				conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(ip.Unmap().String(), strconv.Itoa(b.Port)))
				if err == nil {
					return conn, nil
				}
				last = err
			}
			return nil, last
		},
		TLSClientConfig:        &tls.Config{RootCAs: c.roots, MinVersion: tls.VersionTLS12},
		TLSHandshakeTimeout:    10 * time.Second,
		ResponseHeaderTimeout:  10 * time.Second,
		MaxResponseHeaderBytes: 64 << 10,
		DisableKeepAlives:      true,
		ForceAttemptHTTP2:      true,
	}
}

// get performs one bounded GET of base+/api/v1+path with the PAT. The token
// lives only in this request's header.
func (c *Client) get(ctx context.Context, b Base, path, token string, out any) error {
	_, err := c.getLimited(ctx, b, path, token, maxBody, out)
	return err
}

// getLimited is get with its own body bound; it also returns the answer's
// headers. Only a JSON answer is Gitea's: a login page or another service
// behind the address answers HTML, which is never parsed as an empty list.
func (c *Client) getLimited(ctx context.Context, b Base, path, token string, limit int, out any) (http.Header, error) {
	if !b.valid() {
		return nil, ErrInvalidAddress
	}
	if !validToken(token) {
		return nil, ErrInvalidToken
	}
	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, b.String()+"/api/v1"+path, nil)
	if err != nil {
		return nil, ErrInvalidAddress
	}
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/json")
	tr := c.transport(b)
	defer tr.CloseIdleConnections()
	hc := &http.Client{
		Transport:     tr,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	resp, err := hc.Do(req)
	if err != nil {
		return nil, classifyTransport(err)
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusOK:
	case resp.StatusCode >= 300 && resp.StatusCode < 400:
		return nil, ErrRedirect
	case resp.StatusCode == http.StatusUnauthorized:
		return nil, ErrRejected
	case resp.StatusCode == http.StatusForbidden:
		return nil, ErrScope
	default:
		return nil, ErrProtocol
	}
	if media, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type")); err != nil || media != "application/json" {
		return nil, ErrProtocol
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, int64(limit)+1))
	if err != nil {
		return nil, classifyTransport(err)
	}
	if len(body) > limit || json.Unmarshal(body, out) != nil {
		return nil, ErrProtocol
	}
	return resp.Header, nil
}

func classifyTransport(err error) error {
	var unknown x509.UnknownAuthorityError
	var invalid x509.CertificateInvalidError
	var hostname x509.HostnameError
	var verify *tls.CertificateVerificationError
	switch {
	case errors.Is(err, errForbidden):
		return ErrForbiddenDestination
	case errors.As(err, &unknown), errors.As(err, &invalid), errors.As(err, &hostname), errors.As(err, &verify):
		return ErrUntrustedTLS
	}
	return ErrUnreachable
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

// validToken bounds a PAT to printable ASCII without spaces, so it can never
// split a Git credential protocol line or an HTTP header.
func validToken(t string) bool {
	if t == "" || len(t) > 1024 {
		return false
	}
	for i := 0; i < len(t); i++ {
		if t[i] <= ' ' || t[i] > '~' {
			return false
		}
	}
	return true
}
