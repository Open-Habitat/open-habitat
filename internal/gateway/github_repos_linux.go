//go:build linux

package gateway

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/maintainer/native-agent-host/internal/udssecure"
)

const githubReposPath = "/api/v1/onboarding/github/repos"

func (a *Auth) githubRepos(w http.ResponseWriter, r *http.Request) {
	// No browser-supplied identity, owner, credential, or alternate endpoint.
	page, limit, ok := catalogQuery(r)
	if !ok || !a.exact(r, githubReposPath, "page", "limit") || r.RequestURI != r.URL.RequestURI() || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
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
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	conn, err := dial(ctx, target.Socket)
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
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
	stop := context.AfterFunc(ctx, func() { _ = conn.SetDeadline(time.Now()) })
	defer stop()
	req, err := http.NewRequestWithContext(ctx, "GET", "http://unix"+githubReposPath+"?page="+strconv.Itoa(page)+"&limit="+strconv.Itoa(limit), nil)
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
	reader := bufio.NewReader(&io.LimitedReader{R: conn, N: 65536})
	res, err := http.ReadResponse(reader, req)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	if res.ProtoMajor != 1 || res.ProtoMinor != 1 || (res.StatusCode != 200 && res.StatusCode != 503 && res.StatusCode != 409) || len(res.Header.Values("Content-Type")) != 1 || res.Header.Get("Content-Type") != "application/json" || len(res.Header.Values("Content-Length")) != 1 || res.ContentLength < 1 || res.ContentLength > 60000 || len(res.TransferEncoding) != 0 {
		safe(w, 503, "daemon_unavailable")
		return
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, 60001))
	if err != nil || int64(len(b)) != res.ContentLength {
		safe(w, 503, "daemon_unavailable")
		return
	}
	var tail [1]byte
	if n, e := reader.Read(tail[:]); n != 0 || e != io.EOF {
		safe(w, 503, "daemon_unavailable")
		return
	}
	if res.StatusCode == 409 {
		safe(w, 409, "github_auth_unavailable")
		return
	}
	if res.StatusCode == 503 {
		safe(w, 503, "native_source_unavailable")
		return
	}
	var reply struct {
		SchemaVersion int  `json:"schema_version"`
		Page          int  `json:"page"`
		Limit         int  `json:"limit"`
		HasMore       bool `json:"has_more"`
		Repositories  []struct {
			FullName    string  `json:"full_name"`
			Private     *bool   `json:"private"`
			Description *string `json:"description"`
			HTMLURL     string  `json:"html_url"`
		} `json:"repositories"`
	}
	d := json.NewDecoder(strings.NewReader(string(b)))
	d.DisallowUnknownFields()
	var extra any
	if !catalogNoDuplicates(b) || d.Decode(&reply) != nil || d.Decode(&extra) != io.EOF || reply.SchemaVersion != 1 || reply.Page != page || reply.Limit != limit || reply.Repositories == nil || len(reply.Repositories) > limit {
		safe(w, 503, "daemon_unavailable")
		return
	}
	for _, item := range reply.Repositories {
		parts := strings.Split(item.FullName, "/")
		if len(parts) != 2 || !catalogOwner(parts[0]) || !catalogName(parts[1]) || item.HTMLURL != "https://github.com/"+item.FullName || item.Private == nil || item.Description == nil || len(*item.Description) > 500 || strings.ContainsAny(*item.Description, "\r\n\x00") {
			safe(w, 503, "daemon_unavailable")
			return
		}
	}
	// Only validated, reconstructed fields are returned; no daemon bytes are copied.
	output, _ := json.Marshal(reply)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(output)))
	_, _ = w.Write(output)
}
func catalogOwner(s string) bool {
	if len(s) < 1 || len(s) > 39 || s[0] == '-' {
		return false
	}
	for _, c := range s {
		if c != '-' && (c < 'a' || c > 'z') && (c < 'A' || c > 'Z') && (c < '0' || c > '9') {
			return false
		}
	}
	return true
}
func catalogName(s string) bool {
	if len(s) < 1 || len(s) > 100 || s == "." || s == ".." {
		return false
	}
	for _, c := range s {
		if c != '.' && c != '_' && c != '-' && (c < 'a' || c > 'z') && (c < 'A' || c > 'Z') && (c < '0' || c > '9') {
			return false
		}
	}
	return true
}
func catalogQuery(r *http.Request) (int, int, bool) {
	q := r.URL.Query()
	if r.Method != "GET" || r.URL.Path != githubReposPath || r.URL.EscapedPath() != githubReposPath || len(q) != 2 || len(q["page"]) != 1 || len(q["limit"]) != 1 {
		return 0, 0, false
	}
	p, e := strconv.Atoi(q.Get("page"))
	l, f := strconv.Atoi(q.Get("limit"))
	if e != nil || f != nil || p < 1 || p > 100 || l < 1 || l > 50 || r.URL.RawQuery != "page="+strconv.Itoa(p)+"&limit="+strconv.Itoa(l) {
		return 0, 0, false
	}
	return p, l, true
}
