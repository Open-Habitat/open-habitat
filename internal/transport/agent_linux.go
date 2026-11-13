//go:build linux

package transport

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/open-habitat/open-habitat/internal/udssecure"
)

func AgentPath(c Config) string { return filepath.Join(filepath.Dir(c.Socket), "agent.sock") }

type agentPeerKey struct{}

// AgentPeer is deliberately not TrustedPeer: own-user requests never acquire
// the gateway's authority, even when an adapter is accidentally shared.
func AgentPeer(r *http.Request) bool {
	return r.Context().Value(agentPeerKey{}) == os.Geteuid() && os.Geteuid() > 0
}

// ValidateAgentListener proves the pathname reaches this descriptor without
// reading a byte of a queued request. A random abstract client address identifies
// only our probe; unlike an owner-UID probe, it cannot consume the activation call.
func ValidateAgentListener(c Config, ln *net.UnixListener) error {
	if validate(c, false) != nil || udssecure.Agent(AgentPath(c), c.UID) != nil {
		return denied
	}
	return probeAgentListener(c, ln)
}
func probeAgentListener(c Config, ln *net.UnixListener) error {
	if ln == nil || ln.Addr().String() != AgentPath(c) {
		return denied
	}
	var nonce [24]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return denied
	}
	name := "@oh-agent-probe-" + hex.EncodeToString(nonce[:])
	probe, err := (&net.Dialer{Timeout: time.Second, LocalAddr: &net.UnixAddr{Name: name, Net: "unix"}}).Dial("unix", AgentPath(c))
	if err != nil {
		return denied
	}
	defer probe.Close()
	var queued []*net.UnixConn
	verified := false
	defer func() {
		ln.SetDeadline(time.Time{})
		if !verified {
			for _, conn := range queued {
				conn.Close()
			}
		}
	}()
	ln.SetDeadline(time.Now().Add(time.Second))
	for {
		conn, err := ln.AcceptUnix()
		if err != nil {
			return denied
		}
		if peerUID(conn) != c.UID {
			conn.Close()
			continue
		}
		if conn.RemoteAddr().String() == name {
			conn.Close()
			break
		}
		if len(queued) == 64 {
			conn.Close()
			return denied
		}
		queued = append(queued, conn)
	}
	if len(queued) > 0 {
		startupConnections.Store(ln, queued)
	}
	verified = true
	return nil
}

// ServeAgent accepts only the daemon UID. Its handler must be a separate,
// default-deny table, never the browser mux or token handoff handler.
func ServeAgent(ctx context.Context, ln *net.UnixListener, c Config, handler http.Handler) error {
	if ln == nil || c.UID <= 0 || c.UID != os.Geteuid() || ln.Addr().String() != AgentPath(c) {
		return denied
	}
	pending, _ := startupConnections.LoadAndDelete(ln)
	guard := &guardListener{UnixListener: ln, cfg: Config{GatewayUID: c.UID}, ctx: ctx, slots: make(chan struct{}, 64)}
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
				return context.WithValue(ctx, agentPeerKey{}, peerUID(s.UnixConn))
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
