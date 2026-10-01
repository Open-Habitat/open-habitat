//go:build linux

package gateway

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/maintainer/native-agent-host/internal/udssecure"
	"golang.org/x/sys/unix"
)

const proxyBodyLimit int64 = 2 << 20
const proxyRequestLimit int64 = 66000

type idleReadConn struct{ net.Conn }

func (c idleReadConn) Read(p []byte) (int, error) {
	if err := c.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
		return 0, err
	}
	return c.Conn.Read(p)
}

func identityID(m Identity) string {
	h := sha256.Sum256([]byte(m.Provider + ":" + m.Subject))
	return "wid_" + base64.RawURLEncoding.EncodeToString(h[:18])
}

// A systemd-created listening socket reports PID 1 as its peer. The mapped
// socket's root-controlled path and ownership, not SO_PEERCRED, bind the route.
// The peer check below is only for the test dial seam (locally bound sockets).
func daemonUID(c *net.UnixConn) int {
	raw, err := c.SyscallConn()
	if err != nil {
		return -1
	}
	var u *unix.Ucred
	var e error
	if raw.Control(func(fd uintptr) { u, e = unix.GetsockoptUcred(int(fd), unix.SOL_SOCKET, unix.SO_PEERCRED) }) != nil || e != nil || u == nil {
		return -1
	}
	return int(u.Uid)
}

// proxy builds a new request rather than cloning the browser request: only the
// session's mapped socket and the explicitly selected headers cross the boundary.
func (a *Auth) proxy(w http.ResponseWriter, r *http.Request, s session, stream bool) {
	target := s.identity
	if a.snapshotDial == nil && udssecure.Mapped(target.Socket, target.UID) != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	dial := a.snapshotDial
	if dial == nil {
		dial = func(ctx context.Context, path string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, "unix", path)
		}
	}
	transport := &http.Transport{
		MaxResponseHeaderBytes: 64 << 10,
		DisableKeepAlives:      true,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			conn, err := dial(ctx, target.Socket)
			if err != nil {
				return nil, err
			}
			if a.snapshotDial != nil || a.snapshotPeerUID != nil {
				uc, ok := conn.(*net.UnixConn)
				peer := a.snapshotPeerUID
				if peer == nil {
					peer = daemonUID
				}
				if !ok || peer(uc) != target.UID {
					conn.Close()
					return nil, errors.New("wrong daemon peer")
				}
			}
			if stream {
				return idleReadConn{conn}, nil
			}
			return conn, nil
		},
	}
	defer transport.CloseIdleConnections()
	ctx := r.Context()
	// No fixed socket deadline for streams: a healthy stream may remain open.
	// Request context cancellation closes the transport connection; finite reads
	// get ample headroom beyond the daemon's onboarding and native I/O budgets.
	if !stream {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 60*time.Second)
		defer cancel()
	}
	// A zero-length POST must be sent without chunked framing: the daemon
	// rejects transfer encoding on body-less control and onboarding routes.
	var body io.ReadCloser = http.NoBody
	if r.ContentLength < 0 || r.ContentLength > proxyRequestLimit {
		safe(w, 400, "invalid_request")
		return
	}
	if r.Method != http.MethodGet && r.ContentLength > 0 && r.Body != nil {
		body = http.MaxBytesReader(w, r.Body, proxyRequestLimit)
	}
	req, err := http.NewRequestWithContext(ctx, r.Method, "http://unix"+r.URL.RequestURI(), body)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	if body != http.NoBody {
		req.ContentLength = r.ContentLength
		if typ := r.Header.Get("Content-Type"); typ != "" {
			req.Header.Set("Content-Type", typ)
		}
	}
	if c, e := r.Cookie(cookieName); e == nil && r.URL.Path == piAttemptPath {
		hash := sha256.Sum256([]byte("pi-attempt-owner\x00" + c.Value))
		req.Header.Set("X-Agent-Host-Session", base64.RawURLEncoding.EncodeToString(hash[:]))
	}
	if stream {
		if last := r.Header.Get("Last-Event-ID"); last != "" {
			req.Header.Set("Last-Event-ID", last)
		}
	}
	res, err := transport.RoundTrip(req)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	if stream && res.StatusCode == 200 {
		flusher, ok := w.(http.Flusher)
		controller := http.NewResponseController(w)
		if !ok || controller.SetWriteDeadline(time.Now().Add(10*time.Second)) != nil {
			safe(w, 503, "daemon_unavailable")
			return
		}
		w.Header().Set("Content-Type", res.Header.Get("Content-Type"))
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.WriteHeader(res.StatusCode)
		flusher.Flush()
		buf := make([]byte, 32<<10)
		for {
			n, readErr := res.Body.Read(buf)
			if n > 0 {
				if controller.SetWriteDeadline(time.Now().Add(10*time.Second)) != nil {
					return
				}
				if _, err := w.Write(buf[:n]); err != nil {
					return
				}
				flusher.Flush()
			}
			if readErr != nil {
				return
			}
		}
	}
	// Buffer finite responses before writing headers: an oversized or broken
	// daemon response must not leave a successful but truncated JSON document.
	data, err := io.ReadAll(io.LimitReader(res.Body, proxyBodyLimit+1))
	if err != nil || int64(len(data)) > proxyBodyLimit {
		safe(w, 503, "daemon_unavailable")
		return
	}
	if typ := res.Header.Get("Content-Type"); typ != "" {
		w.Header().Set("Content-Type", typ)
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(res.StatusCode)
	_, _ = w.Write(data)
}
