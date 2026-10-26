//go:build linux

package cli

import (
	"bufio"
	"context"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/gateway"
)

type revokeTestBroker struct{}

func (revokeTestBroker) Exchange(_ context.Context, r gateway.BrokerRequest) (gateway.BrokerReply, error) {
	if r.ID != "42" {
		return gateway.BrokerReply{}, nil
	}
	return gateway.BrokerReply{Route: &gateway.BrokerRoute{UID: 1001, Username: "alice", Socket: "/run/open-habitat/users/alice/daemon.sock"}, Epoch: 1, Generation: 1}, nil
}

func TestPrivateRevocationProtocol(t *testing.T) {
	a, err := gateway.NewAuth(gateway.OAuthConfig{ClientID: "test", ClientSecret: "test", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, gateway.AuthOptions{Provider: gateway.GitHubProvider{}, Sink: revokeTestSink{}, Broker: revokeTestBroker{}})
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "control.sock")
	ln, err := net.Listen("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	defer ln.Close()
	go serveRevocations(ctx, ln, a)
	for _, tc := range []struct{ input, want string }{{"42\n", "OK\n"}, {"44\n", "DENIED\n"}, {strings.Repeat("4", 34) + "\n", ""}, {"42", ""}} {
		c, e := net.Dial("unix", path)
		if e != nil {
			t.Fatal(e)
		}
		c.SetDeadline(time.Now().Add(time.Second))
		c.Write([]byte(tc.input))
		if !strings.HasSuffix(tc.input, "\n") {
			c.(*net.UnixConn).CloseWrite()
		}
		line, e := bufio.NewReader(c).ReadString('\n')
		c.Close()
		if os.Geteuid() != 0 || tc.want == "" {
			if line != "" {
				t.Fatalf("unexpected control reply %q", line)
			}
			continue
		}
		if e != nil || line != tc.want {
			t.Fatalf("input %q reply %q: %v", tc.input, line, e)
		}
	}
}

type revokeTestSink struct{}

func (revokeTestSink) Deliver(context.Context, gateway.Identity, string, string) (gateway.Handoff, error) {
	return gateway.HandoffInUse, nil
}
