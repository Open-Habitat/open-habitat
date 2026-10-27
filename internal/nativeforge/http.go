package nativeforge

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
	"strconv"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/egress"
)

const requestTimeout = 15 * time.Second

// HTTP performs a provider's fixed reads. It never follows redirects, never
// uses a proxy, verifies TLS against the system trust store and dials only
// the base's own host and port after checking every resolved address.
type HTTP struct {
	// Test seams: a resolver and private roots. Production leaves both nil:
	// the system resolver and the operator-approved system trust store.
	Resolve func(ctx context.Context, host string) ([]netip.Addr, error)
	Roots   *x509.CertPool
}

func (c HTTP) lookup(ctx context.Context, host string) ([]netip.Addr, error) {
	if ip, err := netip.ParseAddr(host); err == nil {
		return []netip.Addr{ip}, nil
	}
	if c.Resolve != nil {
		return c.Resolve(ctx, host)
	}
	return net.DefaultResolver.LookupNetIP(ctx, "ip", host)
}

var errForbidden = errors.New("forbidden destination")

func (c HTTP) transport(b Base) *http.Transport {
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
				if !egress.Allowed(ip, b.ExplicitLoopback()) {
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
		TLSClientConfig:        &tls.Config{RootCAs: c.Roots, MinVersion: tls.VersionTLS12},
		TLSHandshakeTimeout:    10 * time.Second,
		ResponseHeaderTimeout:  10 * time.Second,
		MaxResponseHeaderBytes: 64 << 10,
		DisableKeepAlives:      true,
		ForceAttemptHTTP2:      true,
	}
}

// Response is one bounded answer that was not a redirect.
type Response struct {
	Status int
	Header http.Header
	Body   []byte
}

// Get performs one bounded GET of base+path (path starts with "/" and may
// carry a query) with the given request headers, which is where a token
// lives for this one request only. A redirect is ErrRedirect, a success body
// beyond limit ErrProtocol, and a failed connection, a refused destination or an
// unverified certificate their own errors. Any other status is the caller's
// to interpret, with its bounded body.
func (c HTTP) Get(ctx context.Context, b Base, path string, header http.Header, limit int) (Response, error) {
	if !b.Valid() {
		return Response{}, ErrInvalidAddress
	}
	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, b.String()+path, nil)
	if err != nil {
		return Response{}, ErrInvalidAddress
	}
	for k, v := range header {
		req.Header[k] = v
	}
	req.Header.Set("Accept", "application/json")
	tr := c.transport(b)
	defer tr.CloseIdleConnections()
	hc := &http.Client{
		Transport:     tr,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	resp, err := hc.Do(req)
	if err != nil {
		return Response{}, classifyTransport(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		return Response{}, ErrRedirect
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, int64(limit)+1))
	if err != nil {
		return Response{}, classifyTransport(err)
	}
	if len(body) > limit {
		// An oversized answer is no answer; a refusal's status still says
		// what it is, whatever its body.
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return Response{}, ErrProtocol
		}
		body = body[:limit]
	}
	return Response{Status: resp.StatusCode, Header: resp.Header, Body: body}, nil
}

// JSON decodes the answer. Only a JSON answer is the provider's: a login
// page or another service behind the address answers HTML, which is never
// parsed as an empty list.
func (r Response) JSON(out any) error {
	if media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type")); err != nil || media != "application/json" {
		return ErrProtocol
	}
	if json.Unmarshal(r.Body, out) != nil {
		return ErrProtocol
	}
	return nil
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

// ValidToken bounds a token to printable ASCII without spaces, so it can
// never split a Git credential protocol line or an HTTP header.
func ValidToken(t string) bool {
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
