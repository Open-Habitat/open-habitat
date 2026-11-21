//go:build linux

package transport

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"testing"
	"time"
)

// The guest listener serves only the gateway's UID. Here the test process is
// not the configured gateway, so its connections are dropped unread, and a
// probe from the daemon's own UID still proves the pathname.
func TestGuestListenerRefusesEveryOtherPeer(t *testing.T) {
	dir := shortDir(t)
	path := dir + "/guest.sock"
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	cfg := Config{UID: os.Geteuid(), GatewayUID: os.Geteuid() + 1, Socket: dir + "/daemon.sock"}
	// A queued own-UID connection is not the gateway's and is not kept.
	queued, err := net.Dial("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	defer queued.Close()
	if err := probeGuestListener(cfg, ln); err != nil {
		t.Fatal("probe", err)
	}
	if _, ok := startupConnections.Load(ln); ok {
		t.Fatal("a non-gateway connection was queued for serving")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	reached := make(chan struct{}, 1)
	done := make(chan error, 1)
	go func() {
		done <- ServeGuest(ctx, ln, cfg, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reached <- struct{}{}
		}))
	}()
	c, err := net.Dial("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	c.SetDeadline(time.Now().Add(3 * time.Second))
	fmt.Fprint(c, "GET /guest/v1/conversations HTTP/1.1\r\nHost: unix\r\nConnection: close\r\n\r\n")
	var b [64]byte
	if n, _ := c.Read(b[:]); n != 0 {
		t.Fatalf("non-gateway peer answered: %q", b[:n])
	}
	select {
	case <-reached:
		t.Fatal("handler reached by a non-gateway peer")
	default:
	}
	cancel()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

func TestServeGuestRefusesUnsafeConfiguration(t *testing.T) {
	dir := shortDir(t)
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: dir + "/guest.sock", Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	h := http.NotFoundHandler()
	for name, cfg := range map[string]Config{
		"gateway is the owner": {UID: os.Geteuid(), GatewayUID: os.Geteuid(), Socket: dir + "/daemon.sock"},
		"no gateway":           {UID: os.Geteuid(), Socket: dir + "/daemon.sock"},
		"not this process":     {UID: os.Geteuid() + 1, GatewayUID: os.Geteuid() + 2, Socket: dir + "/daemon.sock"},
		"another path":         {UID: os.Geteuid(), GatewayUID: os.Geteuid() + 1, Socket: dir + "/other/daemon.sock"},
	} {
		if ServeGuest(context.Background(), ln, cfg, h) == nil {
			t.Fatal("served:", name)
		}
		if probeGuestListener(cfg, ln) == nil && (cfg.GatewayUID <= 0 || cfg.GatewayUID == cfg.UID) {
			t.Fatal("probed:", name)
		}
	}
	if ServeGuest(context.Background(), ln, Config{UID: os.Geteuid(), GatewayUID: os.Geteuid() + 1, Socket: dir + "/daemon.sock"}, nil) == nil {
		t.Fatal("served without a route table")
	}
}

func TestGuestPeerIsNotOwnerOrAgent(t *testing.T) {
	r, _ := http.NewRequest("GET", "http://unix/", nil)
	r = r.WithContext(context.WithValue(r.Context(), guestPeerKey{}, os.Geteuid()+1))
	if !GuestPeer(r) || AgentPeer(r) || (&Server{cfg: Config{GatewayUID: os.Geteuid() + 1}}).TrustedPeer(r) {
		t.Fatal("guest peer confused with another authority")
	}
	plain, _ := http.NewRequest("GET", "http://unix/", nil)
	if GuestPeer(plain) {
		t.Fatal("a request without the listener's mark is a guest")
	}
}
