package nativegitea

import (
	"context"
	"crypto/x509"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"sync/atomic"
	"testing"
)

type fakeGitea struct {
	srv  *httptest.Server
	hits atomic.Int32
	base Base
}

// startGitea serves /api/v1/user over TLS on addr ("127.0.0.1:0" or
// "[::1]:0"): token good-<id>-<login> authenticates that account.
func startGitea(t *testing.T, addr string) *fakeGitea {
	t.Helper()
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		t.Skipf("listen %s: %v", addr, err)
	}
	f := &fakeGitea{}
	f.srv = httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.hits.Add(1)
		tok := strings.TrimPrefix(r.Header.Get("Authorization"), "token ")
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path != "/api/v1/user" || r.Method != http.MethodGet:
			http.NotFound(w, r)
		case tok == "redirect":
			http.Redirect(w, r, "https://elsewhere.example/api/v1/user", http.StatusFound)
		case tok == "huge":
			w.Write([]byte(`{"id":1,"login":"` + strings.Repeat("a", maxBody) + `"}`))
		case tok == "noscope":
			w.WriteHeader(http.StatusForbidden)
		case strings.HasPrefix(tok, "good-"):
			parts := strings.SplitN(tok, "-", 3)
			w.Write([]byte(`{"id":` + parts[1] + `,"login":"` + parts[2] + `","email":"x@example.org"}`))
		default:
			w.WriteHeader(http.StatusUnauthorized)
		}
	}))
	f.srv.Listener.Close()
	f.srv.Listener = ln
	f.srv.StartTLS()
	t.Cleanup(f.srv.Close)
	if f.base, err = ParseBase(f.srv.URL); err != nil {
		t.Fatal(err)
	}
	return f
}

func (f *fakeGitea) client() *Client {
	pool := x509.NewCertPool()
	pool.AddCert(f.srv.Certificate())
	return &Client{roots: pool}
}

func TestClientUser(t *testing.T) {
	g := startGitea(t, "127.0.0.1:0")
	c := g.client()
	ctx := context.Background()
	a, err := c.User(ctx, g.base, "good-7-alice")
	if err != nil || a != (Account{ID: 7, Login: "alice"}) {
		t.Fatalf("%+v %v", a, err)
	}
	for tok, want := range map[string]error{"bad": ErrRejected, "noscope": ErrScope, "redirect": ErrRedirect, "huge": ErrProtocol, "good-0-alice": ErrProtocol, "bad token": ErrInvalidToken} {
		if _, err := c.User(ctx, g.base, tok); err != want {
			t.Errorf("%s: %v, want %v", tok, err, want)
		}
	}
	// The system trust store does not hold the test CA: verified TLS only.
	if _, err := NewClient().User(ctx, g.base, "good-7-alice"); err != ErrUntrustedTLS {
		t.Fatalf("untrusted: %v", err)
	}
}

func TestClientDialFilter(t *testing.T) {
	g := startGitea(t, "127.0.0.1:0")
	ctx := context.Background()
	port := g.base.Port
	named := Base{Host: "gitea.test", Port: port}
	for _, ips := range [][]string{
		{"127.0.0.1"}, // loopback the person did not name (DNS rebinding)
		{"::1"},
		{"169.254.169.254"},
		{"::ffff:169.254.169.254"},
		{"fe80::1"},
		{"fd00:ec2::254"},
		{"0.0.0.0"},
		{"::"},
		{"ff02::1"},
		{"10.0.0.5", "169.254.169.254"}, // one refused address refuses the name
	} {
		c := g.client()
		c.resolve = func(context.Context, string) ([]netip.Addr, error) {
			var out []netip.Addr
			for _, s := range ips {
				out = append(out, netip.MustParseAddr(s))
			}
			return out, nil
		}
		before := g.hits.Load()
		if _, err := c.User(ctx, named, "good-7-alice"); !errors.Is(err, ErrForbiddenDestination) {
			t.Errorf("%v: %v", ips, err)
		}
		if g.hits.Load() != before {
			t.Errorf("%v reached the server", ips)
		}
	}
	// IPv6 loopback named explicitly by the person is a legitimate cohosted
	// Gitea; TLS still verifies.
	g6 := startGitea(t, "[::1]:0")
	if g6.base.Host != "::1" {
		t.Fatalf("base %+v", g6.base)
	}
	if a, err := g6.client().User(ctx, g6.base, "good-9-bob"); err != nil || a.Login != "bob" {
		t.Fatalf("ipv6: %+v %v", a, err)
	}
}
