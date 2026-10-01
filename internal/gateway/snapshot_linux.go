//go:build linux

package gateway

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/maintainer/native-agent-host/internal/udssecure"
	"golang.org/x/sys/unix"
)

const snapshotLimit = 1 << 20
const historyLimit = 2 << 20

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
	a.snapshotOrPiStatus(w, r, "/api/v1/snapshot")
}
func (a *Auth) piStatus(w http.ResponseWriter, r *http.Request) {
	a.snapshotOrPiStatus(w, r, "/api/v1/onboarding/pi/status")
}
func (a *Auth) snapshotOrPiStatus(w http.ResponseWriter, r *http.Request, path string) {
	if r.Method != http.MethodGet || !a.exact(r, path) || r.URL.RawQuery != "" || r.RequestURI != path || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	// authenticated has revalidated the immutable broker binding.
	target := s.identity
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
	deadline := time.Now().Add(func() time.Duration {
		if path == "/api/v1/onboarding/pi/status" {
			return 14 * time.Second
		}
		return 5 * time.Second
	}())
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
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "http://unix"+path, nil)
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
	// Invalid upstream envelopes are not transport outages, for either
	// snapshot or Pi status. A 503 means the mapped daemon could not answer.
	invalidStatus := 502
	if res.ProtoMajor != 1 || res.ProtoMinor != 1 || (res.StatusCode != 200 && !(path == "/api/v1/snapshot" && res.StatusCode == 503)) || res.Header.Get("Content-Type") != "application/json" || len(res.Header.Values("Content-Type")) != 1 || res.ContentLength <= 0 || res.ContentLength > snapshotLimit || len(res.TransferEncoding) != 0 || len(res.Header.Values("Content-Length")) != 1 {
		safe(w, invalidStatus, "daemon_unavailable")
		return
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, snapshotLimit+1))
	if err != nil || int64(len(b)) != res.ContentLength || len(b) > snapshotLimit {
		safe(w, invalidStatus, "daemon_unavailable")
		return
	}
	var tail [1]byte
	if n, e := reader.Read(tail[:]); n != 0 || e != io.EOF || limited.N == 0 {
		safe(w, invalidStatus, "daemon_unavailable")
		return
	}
	// Bind the response identity to the authenticated fixed mapping before any
	// bytes reach the browser. Full v1 contract validation remains at the browser.
	var binding struct {
		Identity struct {
			WebIdentityID string `json:"web_identity_id"`
		} `json:"identity"`
		Auth struct {
			Provider          string `json:"provider"`
			ProviderAccountID string `json:"provider_account_id"`
		} `json:"auth"`
	}
	if path == "/api/v1/snapshot" {
		if res.StatusCode == 503 {
			var sourceError struct {
				SchemaVersion int `json:"schema_version"`
				Error         struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			if json.Unmarshal(b, &sourceError) != nil || sourceError.SchemaVersion != 1 || sourceError.Error.Code != "native_source_unavailable" {
				safe(w, 502, "daemon_unavailable")
				return
			}
			safe(w, 503, "native_source_unavailable")
			return
		}
		if json.Unmarshal(b, &binding) != nil {
			safe(w, 502, "daemon_unavailable")
			return
		}
		if binding.Identity.WebIdentityID != identityID(target) || binding.Auth.Provider != target.Provider || binding.Auth.ProviderAccountID != target.Subject {
			safe(w, 403, "identity_mismatch")
			return
		}
	} else {
		var status struct {
			SchemaVersion int `json:"schema_version"`
			Pi            struct {
				State string `json:"state"`
			} `json:"pi"`
		}
		decoder := json.NewDecoder(strings.NewReader(string(b)))
		decoder.DisallowUnknownFields()
		var extra any
		if decoder.Decode(&status) != nil || decoder.Decode(&extra) != io.EOF || status.SchemaVersion != 1 || (status.Pi.State != "usable" && status.Pi.State != "missing" && status.Pi.State != "unknown") {
			safe(w, invalidStatus, "daemon_unavailable")
			return
		}
		// Reconstruct only the closed public vocabulary; never forward raw
		// native bytes even when the shape was otherwise valid.
		b, _ = json.Marshal(status)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	w.WriteHeader(200)
	_, _ = w.Write(b)
}

// The gateway accepts only canonical, bounded read paths. It never chooses a UID
// or copies browser headers to the daemon.
func historyGatewayPath(path string, q url.Values) bool {
	if m := historyPath.FindStringSubmatch(path); m != nil {
		if len(q) > 2 {
			return false
		}
		for k, v := range q {
			if (k != "after" && k != "limit") || len(v) != 1 {
				return false
			}
		}
		return true
	}
	if contentPath.MatchString(path) {
		if len(q) != 2 || len(q["offset"]) != 1 || len(q["limit_bytes"]) != 1 {
			return false
		}
		return true
	}
	return false
}

var historyPath = regexp.MustCompile(`^/api/v1/agents/pi:[0-9a-fA-F-]{36}/history$`)
var contentPath = regexp.MustCompile(`^/api/v1/content/ct_[A-Za-z0-9_-]{8,80}$`)

func (a *Auth) history(w http.ResponseWriter, r *http.Request) {
	path := r.URL.EscapedPath()
	allowed := historyGatewayPath(path, r.URL.Query())
	if r.Method != http.MethodGet || !allowed || r.URL.Fragment != "" || r.Host != strings.TrimPrefix(a.cfg.Origin, "https://") || r.TLS == nil || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	// authenticated has revalidated the immutable broker binding.
	target := s.identity
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
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "http://unix"+r.URL.RequestURI(), nil)
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
	limited := &io.LimitedReader{R: conn, N: historyLimit + 4096}
	reader := bufio.NewReader(limited)
	res, err := http.ReadResponse(reader, req)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	if res.ProtoMajor != 1 || res.ProtoMinor != 1 || (res.StatusCode != 200 && res.StatusCode != 400 && res.StatusCode != 404 && res.StatusCode != 409 && res.StatusCode != 503) || res.Header.Get("Content-Type") != "application/json" || len(res.Header.Values("Content-Type")) != 1 || res.ContentLength < 0 || res.ContentLength > historyLimit || len(res.TransferEncoding) != 0 || len(res.Header.Values("Content-Length")) != 1 {
		safe(w, 503, "daemon_unavailable")
		return
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, historyLimit+1))
	if err != nil || int64(len(b)) != res.ContentLength || len(b) > historyLimit {
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
	w.WriteHeader(res.StatusCode)
	_, _ = w.Write(b)
}
