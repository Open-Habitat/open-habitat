//go:build linux

package transport

import (
	"context"
	"errors"
	"github.com/maintainer/native-agent-host/internal/gateway"
	"net"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestPeerBeforeBodyAndWrongTarget(t *testing.T) {
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(t.TempDir(), "sock")
	ln, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	calls := new(atomic.Int32)
	cfg := Config{GatewayUID: os.Getuid() + 1, UID: os.Geteuid(), Username: u.Username, Home: u.HomeDir, Socket: path, Provider: "github", Subject: "42"}
	s, e := newServer(cfg, func(context.Context, string) error { calls.Add(1); return nil }, true)
	if e != nil {
		t.Fatal(e)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	// A listener at another path must not be accepted even with a valid config.
	other, e := net.ListenUnix("unix", &net.UnixAddr{Name: filepath.Join(t.TempDir(), "other"), Net: "unix"})
	if e != nil {
		t.Fatal(e)
	}
	defer other.Close()
	if s.Serve(ctx, other) == nil {
		t.Fatal("wrong socket accepted")
	}
	go func() { _ = s.Serve(ctx, ln) }()
	c, e := net.Dial("unix", path)
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	_ = c.SetReadDeadline(time.Now().Add(time.Second))
	var byteOne [1]byte
	if n, e := c.Read(byteOne[:]); n != 0 || e == nil {
		t.Fatalf("peer accepted: %d %v", n, e)
	}
	if calls.Load() != 0 {
		t.Fatal("consumer called")
	}
	cfg.GatewayUID = os.Getuid()
	cfg.Home = filepath.Join(t.TempDir(), "false-home")
	if _, e := newServer(cfg, func(context.Context, string) error { return nil }, true); e == nil {
		t.Fatal("wrong home accepted")
	}
}
func TestSymlinkTargetRejected(t *testing.T) {
	_, _, m, calls := fixture(t)
	alias := filepath.Join(t.TempDir(), "alias")
	if e := os.Symlink(m.Socket, alias); e != nil {
		t.Fatal(e)
	}
	m.Socket = alias
	if e := (Sink{testPath: true}).Deliver(context.Background(), m, "42", "sentinel-secret"); e == nil {
		t.Fatal("symlink accepted")
	}
	if calls.Load() != 0 {
		t.Fatal("symlink consumed")
	}
}

func TestCanceledContextCannotConsume(t *testing.T) {
	_, _, m, calls := fixture(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if e := (Sink{testPath: true}).Deliver(ctx, m, "42", "sentinel-secret"); e == nil || strings.Contains(e.Error(), "sentinel-secret") {
		t.Fatal("canceled request accepted or leaked")
	}
	if calls.Load() != 0 {
		t.Fatal("canceled request consumed")
	}
}

func TestConsumerFailureAndOversize(t *testing.T) {
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(t.TempDir(), "sock")
	ln, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	cfg := Config{GatewayUID: os.Getuid(), UID: os.Geteuid(), Username: u.Username, Home: u.HomeDir, Socket: path, Provider: "github", Subject: "42"}
	calls := new(atomic.Int32)
	s, e := newServer(cfg, func(context.Context, string) error { calls.Add(1); return errors.New("sentinel-secret native failure") }, true)
	if e != nil {
		t.Fatal(e)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() { _ = s.Serve(ctx, ln) }()
	body := strings.Repeat("z", maxToken+1)
	m := gateway.Identity{Provider: cfg.Provider, Subject: cfg.Subject, UID: cfg.UID, Username: cfg.Username, Socket: path}
	sink := Sink{testPath: true}
	if e := sink.Deliver(ctx, m, "42", body); e == nil || strings.Contains(e.Error(), body) {
		t.Fatal("oversize not redacted")
	}
	if e := sink.Deliver(ctx, m, "42", "sentinel-secret"); e == nil || strings.Contains(e.Error(), "sentinel-secret") {
		t.Fatal("consumer failure leaked")
	}
	if calls.Load() != 1 {
		t.Fatal(calls.Load())
	}
}
