//go:build linux

package gateway

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"io"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/maintainer/native-agent-host/internal/udssecure"
	"golang.org/x/sys/unix"
)

const snapshotLimit = 65536

func identityID(m Identity) string {
	h := sha256.Sum256([]byte(m.Provider + ":" + m.Subject))
	return "wid_" + base64.RawURLEncoding.EncodeToString(h[:18])
}
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
func (a *Auth) snapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || !a.exact(r, "/api/v1/snapshot") || r.URL.RawQuery != "" || r.RequestURI != "/api/v1/snapshot" || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	// Rebind to configured mapping, not a cookie, header, username, or path.
	var target Identity
	count := 0
	for _, m := range a.cfg.Identities {
		if m.Provider == s.identity.Provider && m.Subject == s.identity.Subject && m == s.identity {
			target = m
			count++
		}
	}
	if count != 1 {
		safe(w, 403, "identity_mapping_denied")
		return
	}
	dial := a.snapshotDial
	if dial == nil {
		if udssecure.Mapped(target.Socket, target.UID) != nil {
			safe(w, 503, "daemon_unavailable")
			return
		}
		dial = func(ctx context.Context, p string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, "unix", p)
		}
	}
	conn, err := dial(r.Context(), target.Socket)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer conn.Close()
	uc, ok := conn.(*net.UnixConn)
	peer := a.snapshotPeerUID
	if peer == nil {
		peer = daemonUID
	}
	if !ok || (a.snapshotPeerUID == nil && a.snapshotDial == nil && (peer(uc) != 0 || udssecure.Mapped(target.Socket, target.UID) != nil)) || ((a.snapshotPeerUID != nil || a.snapshotDial != nil) && peer(uc) != target.UID) {
		safe(w, 503, "daemon_unavailable")
		return
	}
	deadline := time.Now().Add(5 * time.Second)
	if d, ok := r.Context().Deadline(); ok && d.Before(deadline) {
		deadline = d
	}
	if conn.SetDeadline(deadline) != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	stop := context.AfterFunc(r.Context(), func() { _ = conn.SetDeadline(time.Now()) })
	defer stop()
	// Construct an entirely new request: not a clone. No browser headers, cookies,
	// host, URL, forwarded attributes or hop-by-hop fields cross this boundary.
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "http://unix/api/v1/snapshot", nil)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	req.Header.Set("X-Agent-Host-Identity", identityID(target))
	req.Header.Set("X-Agent-Host-Display-Name", "GitHub user "+target.Subject)
	req.Close = true
	if req.Write(conn) != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	limited := &io.LimitedReader{R: conn, N: snapshotLimit + 4096}
	reader := bufio.NewReader(limited)
	res, err := http.ReadResponse(reader, req)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	if res.ProtoMajor != 1 || res.ProtoMinor != 1 || res.StatusCode != 200 || res.Header.Get("Content-Type") != "application/json" || len(res.Header.Values("Content-Type")) != 1 || res.ContentLength <= 0 || res.ContentLength > snapshotLimit || len(res.TransferEncoding) != 0 || len(res.Header.Values("Content-Length")) != 1 {
		safe(w, 503, "daemon_unavailable")
		return
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, snapshotLimit+1))
	if err != nil || int64(len(b)) != res.ContentLength || len(b) > snapshotLimit {
		safe(w, 503, "daemon_unavailable")
		return
	}
	var tail [1]byte
	if n, e := reader.Read(tail[:]); n != 0 || e != io.EOF || limited.N == 0 {
		safe(w, 503, "daemon_unavailable")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	w.WriteHeader(200)
	_, _ = w.Write(b)
}
