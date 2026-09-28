//go:build linux

package daemon

import (
	"context"
	"net"
	"net/http"
	"time"

	"github.com/maintainer/native-agent-host/internal/core"
	"github.com/maintainer/native-agent-host/internal/transport"
)

// ServeHandoff serves a pre-opened, configured systemd Unix listener as the
// mapped user. A real native credential consumer must be supplied by phase 2B;
// nil is rejected, rather than acknowledging tokens without installing them.
func ServeHandoff(ctx context.Context, listener *net.UnixListener, cfg transport.Config, consume transport.Consumer) error {
	server, err := transport.NewServer(cfg, consume)
	if err != nil {
		return err
	}
	return server.Serve(ctx, listener)
}

// ServeHTTP accepts a pre-opened per-user listener and mounts internal handoff
// alongside future daemon workspace routes on a shared HTTP/1.1 ServeMux.
func ServeHTTP(ctx context.Context, listener *net.UnixListener, cfg transport.Config, consume transport.Consumer, nativeStatus func(context.Context) string, mux *http.ServeMux, runtime *core.PiRuntimeConfig) error {
	server, err := transport.NewServer(cfg, consume)
	if err != nil {
		return err
	}
	if mux == nil {
		mux = http.NewServeMux()
	}
	// The native Pi status is checked before any native workspace or history read.
	// No positive result is retained across requests, refreshes or daemon restarts.
	pi := &PiDevice{Home: cfg.Home}
	if runtime != nil {
		pi.Node, pi.Entry, pi.Manifest = runtime.Node, runtime.Entry, runtime.Manifest
		pi.TrustedRuntime = true
	}
	piStatus := func(parent context.Context) string {
		ctx, cancel := context.WithTimeout(parent, 3*time.Second)
		defer cancel()
		return pi.StatusContext(ctx)
	}
	mux.Handle("GET /api/v1/onboarding/pi/status", PiStatusHandler(cfg, server.TrustedPeer, piStatus))
	mux.Handle("/api/v1/onboarding/pi/attempt", PiAttemptHandler(cfg, server.TrustedPeer, pi))
	mux.Handle(SnapshotPath, piGate(cfg, server.TrustedPeer, piStatus, SnapshotHandlerWithStatus(cfg, server.TrustedPeer, Discover, nativeStatus)))
	mux.Handle("/api/v1/agents/", piGate(cfg, server.TrustedPeer, piStatus, HistoryHandler(cfg, server.TrustedPeer)))
	mux.Handle("/api/v1/content/", piGate(cfg, server.TrustedPeer, piStatus, HistoryHandler(cfg, server.TrustedPeer)))
	return server.ServeMux(ctx, listener, mux)
}
