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
	"net/url"
	"strings"
	"time"

	"github.com/maintainer/native-agent-host/internal/udssecure"
)

const githubObservePath = "/api/v1/onboarding/github/checkout"

func (a *Auth) githubObserve(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" || !a.exact(r, githubObservePath, "full_name") || r.URL.EscapedPath() != githubObservePath || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		safe(w, 400, "invalid_request")
		return
	}
	name := r.URL.Query().Get("full_name")
	parts := strings.Split(name, "/")
	if len(parts) != 2 || !catalogOwner(parts[0]) || !catalogName(parts[1]) || r.RequestURI != githubObservePath+"?full_name="+url.QueryEscape(name) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
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
			return (&net.Dialer{Timeout: 3 * time.Second}).DialContext(ctx, "unix", p)
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	conn, e := dial(ctx, target.Socket)
	if e != nil {
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
	_ = conn.SetDeadline(time.Now().Add(12 * time.Second))
	stop := context.AfterFunc(ctx, func() { _ = conn.SetDeadline(time.Now()) })
	defer stop()
	req, e := http.NewRequestWithContext(ctx, "GET", "http://unix"+githubObservePath+"?full_name="+url.QueryEscape(name), nil)
	if e != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	req.Close = true
	if req.Write(conn) != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	reader := bufio.NewReader(&io.LimitedReader{R: conn, N: 8192})
	res, e := http.ReadResponse(reader, req)
	if e != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	if res.StatusCode != 200 || res.ProtoMajor != 1 || res.ProtoMinor != 1 || len(res.Header.Values("Content-Type")) != 1 || res.Header.Get("Content-Type") != "application/json" || len(res.TransferEncoding) != 0 || len(res.Header.Values("Content-Length")) != 1 || res.ContentLength < 1 || res.ContentLength > 4096 {
		safe(w, 503, "daemon_unavailable")
		return
	}
	b, e := io.ReadAll(io.LimitReader(res.Body, 4097))
	if e != nil || int64(len(b)) != res.ContentLength {
		safe(w, 503, "daemon_unavailable")
		return
	}
	var tail [1]byte
	if n, e := reader.Read(tail[:]); n != 0 || e != io.EOF {
		safe(w, 503, "daemon_unavailable")
		return
	}
	var reply struct {
		SchemaVersion int    `json:"schema_version"`
		FullName      string `json:"full_name"`
		State         string `json:"state"`
	}
	d := json.NewDecoder(bytes.NewReader(b))
	d.DisallowUnknownFields()
	var extra any
	if !catalogNoDuplicates(b) || d.Decode(&reply) != nil || d.Decode(&extra) != io.EOF || reply.SchemaVersion != 1 || reply.FullName != name || (reply.State != "absent" && reply.State != "confirmed" && reply.State != "conflict" && reply.State != "unavailable") {
		safe(w, 503, "daemon_unavailable")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(reply)
}
