//go:build linux

package gateway

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/maintainer/native-agent-host/internal/udssecure"
)

const githubClonePath = "/api/v1/onboarding/github/clone"

func (a *Auth) githubClone(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" || !a.exact(r, githubClonePath) || r.URL.EscapedPath() != githubClonePath || r.RequestURI != githubClonePath || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength < 1 || r.ContentLength > 256 || len(r.TransferEncoding) != 0 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if denied := a.authorizeWrite(r, s); denied != "" {
		safe(w, 403, denied)
		return
	}
	body, e := io.ReadAll(io.LimitReader(r.Body, 257))
	var input struct {
		FullName string `json:"full_name"`
	}
	if e != nil || int64(len(body)) != r.ContentLength || !catalogNoDuplicates(body) {
		safe(w, 400, "invalid_request")
		return
	}
	d := json.NewDecoder(bytes.NewReader(body))
	d.DisallowUnknownFields()
	var extra any
	if d.Decode(&input) != nil || d.Decode(&extra) != io.EOF {
		safe(w, 400, "invalid_request")
		return
	}
	parts := strings.Split(input.FullName, "/")
	if len(parts) != 2 || !catalogOwner(parts[0]) || !catalogName(parts[1]) {
		safe(w, 400, "invalid_request")
		return
	}
	payload, _ := json.Marshal(input)
	target := s.identity
	dial := a.snapshotDial
	if dial == nil {
		if udssecure.Mapped(target.Socket, target.UID) != nil {
			safe(w, 503, "daemon_unavailable")
			return
		}
		dial = func(ctx context.Context, p string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 3 * time.Second}).DialContext(ctx, "unix", p)
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), 95*time.Second)
	defer cancel()
	conn, e := dial(ctx, target.Socket)
	if e != nil {
		safe(w, 503, "checkout_uncertain")
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
	_ = conn.SetDeadline(time.Now().Add(95 * time.Second))
	stop := context.AfterFunc(ctx, func() { _ = conn.SetDeadline(time.Now()) })
	defer stop()
	req, e := http.NewRequestWithContext(ctx, "POST", "http://unix"+githubClonePath, bytes.NewReader(payload))
	if e != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	req.Close = true
	if req.Write(conn) != nil {
		safe(w, 503, "checkout_uncertain")
		return
	}
	reader := bufio.NewReader(&io.LimitedReader{R: conn, N: 8192})
	res, e := http.ReadResponse(reader, req)
	if e != nil {
		safe(w, 503, "checkout_uncertain")
		return
	}
	defer res.Body.Close()
	if res.ProtoMajor != 1 || res.ProtoMinor != 1 || len(res.Header.Values("Content-Type")) != 1 || res.Header.Get("Content-Type") != "application/json" || len(res.TransferEncoding) != 0 || len(res.Header.Values("Content-Length")) != 1 || res.ContentLength < 1 || res.ContentLength > 4096 {
		safe(w, 503, "checkout_uncertain")
		return
	}
	b, e := io.ReadAll(io.LimitReader(res.Body, 4097))
	if e != nil || int64(len(b)) != res.ContentLength {
		safe(w, 503, "checkout_uncertain")
		return
	}
	var tail [1]byte
	if n, e := reader.Read(tail[:]); n != 0 || e != io.EOF {
		safe(w, 503, "checkout_uncertain")
		return
	}
	if res.StatusCode != 200 {
		codes := map[int]map[string]bool{400: {"invalid_request": true}, 403: {"cross_user_denied": true}, 409: {"github_auth_unavailable": true, "checkout_unavailable": true, "checkout_exists": true, "checkout_uncertain": true}, 503: {"native_source_unavailable": true}}
		var failure struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		if !catalogNoDuplicates(b) || json.Unmarshal(b, &failure) != nil || !codes[res.StatusCode][failure.Error.Code] {
			safe(w, 503, "checkout_uncertain")
			return
		}
		safe(w, res.StatusCode, failure.Error.Code)
		return
	}
	var reply struct {
		SchemaVersion int    `json:"schema_version"`
		FullName      string `json:"full_name"`
		State         string `json:"state"`
	}
	d = json.NewDecoder(bytes.NewReader(b))
	d.DisallowUnknownFields()
	if !catalogNoDuplicates(b) || d.Decode(&reply) != nil || d.Decode(&extra) != io.EOF || reply.SchemaVersion != 1 || reply.FullName != input.FullName || reply.State != "cloned" {
		safe(w, 503, "checkout_uncertain")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(reply)
}
