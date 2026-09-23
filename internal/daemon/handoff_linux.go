//go:build linux

package daemon

import (
	"context"
	"net"
	"net/http"

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
func ServeHTTP(ctx context.Context, listener *net.UnixListener, cfg transport.Config, consume transport.Consumer, mux *http.ServeMux) error {
	server, err := transport.NewServer(cfg, consume)
	if err != nil {
		return err
	}
	return server.ServeMux(ctx, listener, mux)
}
