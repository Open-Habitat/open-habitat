//go:build linux

package transport

import (
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"

	"github.com/open-habitat/open-habitat/internal/udssecure"
)

// The guest socket (ADR 0038 section 2) is how other people on the server
// reach this person's conversations: through the gateway only, which names
// the speaking person in a header. Its requests never carry the gateway's
// owner authority: TrustedPeer stays false on them, so no daemon.sock route
// can serve one even if a handler were shared by mistake.

func GuestPath(c Config) string { return filepath.Join(filepath.Dir(c.Socket), "guest.sock") }

type guestPeerKey struct{}

// GuestPeer is true only for a request the guest listener accepted from the
// gateway's UID. It is identity of the transport, not permission: the guest
// route table still decides everything from the owner's membership record.
func GuestPeer(r *http.Request) bool {
	uid, ok := r.Context().Value(guestPeerKey{}).(int)
	return ok && uid > 0 && uid != os.Geteuid()
}

// ValidateGuestListener proves the pathname reaches this descriptor, owned by
// the daemon's UID with mode 0660 behind root-controlled directories, without
// consuming a queued gateway request.
func ValidateGuestListener(c Config, ln *net.UnixListener) error {
	if validate(c, false) != nil || udssecure.GuestListener(GuestPath(c), c.UID) != nil {
		return denied
	}
	return probeGuestListener(c, ln)
}

func probeGuestListener(c Config, ln *net.UnixListener) error {
	if c.GatewayUID <= 0 || c.GatewayUID == c.UID {
		return denied
	}
	return probeListener(ln, GuestPath(c), c.GatewayUID, "@oh-guest-probe-")
}

// ServeGuest accepts only the gateway's UID. Its handler must be the guest
// socket's own default-deny table, never the browser mux or the agent table.
func ServeGuest(ctx context.Context, ln *net.UnixListener, c Config, handler http.Handler) error {
	if ln == nil || handler == nil || c.UID <= 0 || c.UID != os.Geteuid() || c.GatewayUID <= 0 || c.GatewayUID == c.UID || ln.Addr().String() != GuestPath(c) {
		return denied
	}
	pending, _ := startupConnections.LoadAndDelete(ln)
	guard := &guardListener{UnixListener: ln, cfg: Config{GatewayUID: c.GatewayUID}, ctx: ctx, slots: make(chan struct{}, 64)}
	if pending != nil {
		guard.pending = pending.([]*net.UnixConn)
	}
	defer func() {
		for _, conn := range guard.pending {
			conn.Close()
		}
	}()
	srv := &http.Server{Handler: handler, ReadHeaderTimeout: deadline, ReadTimeout: deadline, WriteTimeout: deadline, IdleTimeout: deadline, MaxHeaderBytes: maxHeaders,
		ConnContext: func(ctx context.Context, conn net.Conn) context.Context {
			if s, ok := conn.(*slotConn); ok {
				return context.WithValue(ctx, guestPeerKey{}, peerUID(s.UnixConn))
			}
			return ctx
		}}
	srv.SetKeepAlivesEnabled(false)
	done := make(chan struct{})
	stop := context.AfterFunc(ctx, func() {
		defer close(done)
		grace, cancel := context.WithTimeout(context.Background(), deadline)
		defer cancel()
		srv.Shutdown(grace)
	})
	defer func() {
		if !stop() {
			<-done
		}
	}()
	err := srv.Serve(guard)
	if ctx.Err() != nil || errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return ErrServeEnded
}
