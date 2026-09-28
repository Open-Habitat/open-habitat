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
	"regexp"
	"strings"
	"time"

	"github.com/maintainer/native-agent-host/internal/udssecure"
)

const piAttemptPath = "/api/v1/onboarding/pi/attempt"

var piCode = regexp.MustCompile(`^[A-Z0-9-]{4,24}$`)

type piAttemptReply struct {
	SchemaVersion int `json:"schema_version"`
	Attempt       struct {
		State           string `json:"state"`
		PiState         string `json:"pi_state"`
		VerificationURI string `json:"verification_uri,omitempty"`
		UserCode        string `json:"user_code,omitempty"`
	} `json:"attempt"`
}

func (a *Auth) piAttempt(w http.ResponseWriter, r *http.Request) {
	if (r.Method != "GET" && r.Method != "POST" && r.Method != "DELETE") || !a.exact(r, piAttemptPath) || r.RequestURI != piAttemptPath || r.URL.RawQuery != "" || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method != "GET" {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	c, err := r.Cookie(cookieName)
	if err != nil {
		safe(w, 401, "authentication_required")
		return
	}
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
	req, err := http.NewRequestWithContext(r.Context(), r.Method, "http://unix"+piAttemptPath, nil)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	req.Header.Set("X-Agent-Host-Identity", identityID(target))
	req.Header.Set("X-Agent-Host-Display-Name", "GitHub user "+target.Subject)
	// Correlate ownership without handing the browser bearer cookie to a daemon.
	owner := sha256.Sum256([]byte("pi-attempt-owner\x00" + c.Value))
	req.Header.Set("X-Agent-Host-Session", base64.RawURLEncoding.EncodeToString(owner[:]))
	req.Close = true
	if req.Write(conn) != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	limited := &io.LimitedReader{R: conn, N: 8192}
	reader := bufio.NewReader(limited)
	res, err := http.ReadResponse(reader, req)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	if res.ProtoMajor != 1 || res.ProtoMinor != 1 || (res.StatusCode != 200 && res.StatusCode != 404 && res.StatusCode != 409 && res.StatusCode != 503) || len(res.Header.Values("Content-Type")) != 1 || res.Header.Get("Content-Type") != "application/json" || res.ContentLength < 1 || res.ContentLength > 4096 || len(res.TransferEncoding) != 0 || len(res.Header.Values("Content-Length")) != 1 {
		safe(w, 503, "daemon_unavailable")
		return
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, 4097))
	if err != nil || len(b) != int(res.ContentLength) || len(b) > 4096 {
		safe(w, 503, "daemon_unavailable")
		return
	}
	var tail [1]byte
	if n, e := reader.Read(tail[:]); n != 0 || e != io.EOF || limited.N == 0 {
		safe(w, 503, "daemon_unavailable")
		return
	}
	if res.StatusCode != 200 {
		// Never reflect a daemon error body.
		code := map[int]string{404: "attempt_not_found", 409: "attempt_active", 503: "daemon_unavailable"}[res.StatusCode]
		safe(w, res.StatusCode, code)
		return
	}
	var reply piAttemptReply
	dec := json.NewDecoder(strings.NewReader(string(b)))
	dec.DisallowUnknownFields()
	var extra any
	if dec.Decode(&reply) != nil || dec.Decode(&extra) != io.EOF || reply.SchemaVersion != 1 || (reply.Attempt.State != "pending" && reply.Attempt.State != "device_code" && reply.Attempt.State != "completed" && reply.Attempt.State != "unknown") || (reply.Attempt.PiState != "usable" && reply.Attempt.PiState != "missing" && reply.Attempt.PiState != "unknown") || (reply.Attempt.State == "device_code" && (reply.Attempt.VerificationURI != "https://auth.openai.com/codex/device" || !piCode.MatchString(reply.Attempt.UserCode))) || (reply.Attempt.State != "device_code" && (reply.Attempt.VerificationURI != "" || reply.Attempt.UserCode != "")) {
		safe(w, 503, "daemon_unavailable")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(reply)
}
