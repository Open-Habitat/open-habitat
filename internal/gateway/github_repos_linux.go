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

	"github.com/Open-Habitat/open-habitat/internal/udssecure"
)

const githubReposPath = "/api/v1/onboarding/github/repos"

// A thousand projected repositories with full descriptions.
const catalogReplyLimit = 2 << 20

func (a *Auth) githubRepos(w http.ResponseWriter, r *http.Request) {
	// Fixed reasons only: never log native bytes, credentials or repository data.
	fail := func(status int, code, reason string) {
		if a.log != nil {
			a.log.WarnContext(r.Context(), "github_repo_catalog", "outcome", "rejected", "reason", reason)
		}
		safe(w, status, code)
	}
	// No browser-supplied identity, owner, credential, page or alternate endpoint.
	if r.Method != "GET" || !a.exact(r, githubReposPath) || r.URL.EscapedPath() != githubReposPath || r.RequestURI != githubReposPath || !browserHTTP(r) || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		fail(400, "invalid_request", "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		fail(401, "authentication_required", "authentication_required")
		return
	}
	target := s.identity
	dial := a.snapshotDial
	if dial == nil {
		if udssecure.Mapped(target.Socket, target.UID) != nil {
			fail(503, "daemon_unavailable", "socket_untrusted")
			return
		}
		dial = func(ctx context.Context, p string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 3 * time.Second}).DialContext(ctx, "unix", p)
		}
	}
	// The daemon reads up to ten native pages within its own 30 s budget.
	ctx, cancel := context.WithTimeout(r.Context(), 35*time.Second)
	defer cancel()
	conn, err := dial(ctx, target.Socket)
	if err != nil {
		fail(503, "daemon_unavailable", "dial_failed")
		return
	}
	defer conn.Close()
	uc, ok := conn.(*net.UnixConn)
	peer := a.snapshotPeerUID
	if peer == nil {
		peer = daemonUID
	}
	if !ok || (a.snapshotPeerUID == nil && a.snapshotDial == nil && (peer(uc) != 0 || udssecure.Mapped(target.Socket, target.UID) != nil)) || ((a.snapshotPeerUID != nil || a.snapshotDial != nil) && peer(uc) != target.UID) {
		fail(503, "daemon_unavailable", "peer_untrusted")
		return
	}
	_ = conn.SetDeadline(time.Now().Add(35 * time.Second))
	stop := context.AfterFunc(ctx, func() { _ = conn.SetDeadline(time.Now()) })
	defer stop()
	req, err := http.NewRequestWithContext(ctx, "GET", "http://unix"+githubReposPath, nil)
	if err != nil {
		fail(503, "daemon_unavailable", "request_build_failed")
		return
	}
	req.Close = true
	if req.Write(conn) != nil {
		fail(503, "daemon_unavailable", "request_write_failed")
		return
	}
	reader := bufio.NewReader(&io.LimitedReader{R: conn, N: catalogReplyLimit + 8192})
	res, err := http.ReadResponse(reader, req)
	if err != nil {
		fail(503, "daemon_unavailable", "response_read_failed")
		return
	}
	defer res.Body.Close()
	if res.ProtoMajor != 1 || res.ProtoMinor != 1 || (res.StatusCode != 200 && res.StatusCode != 503 && res.StatusCode != 409) || len(res.Header.Values("Content-Type")) != 1 || res.Header.Get("Content-Type") != "application/json" || len(res.Header.Values("Content-Length")) != 1 || res.ContentLength < 1 || res.ContentLength > catalogReplyLimit || len(res.TransferEncoding) != 0 {
		fail(503, "daemon_unavailable", "response_framing_invalid")
		return
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, catalogReplyLimit+1))
	if err != nil || int64(len(b)) != res.ContentLength {
		fail(503, "daemon_unavailable", "response_body_invalid")
		return
	}
	var tail [1]byte
	if n, e := reader.Read(tail[:]); n != 0 || e != io.EOF {
		fail(503, "daemon_unavailable", "response_trailing_data")
		return
	}
	if res.StatusCode == 409 {
		fail(409, "github_auth_unavailable", "github_auth_unavailable")
		return
	}
	if res.StatusCode == 503 {
		fail(503, "native_source_unavailable", "native_source_unavailable")
		return
	}
	var reply struct {
		SchemaVersion int    `json:"schema_version"`
		Login         string `json:"login,omitempty"`
		Complete      bool   `json:"complete"`
		Repositories  []struct {
			FullName      string  `json:"full_name"`
			Private       *bool   `json:"private"`
			Description   *string `json:"description"`
			HTMLURL       string  `json:"html_url"`
			PushedAt      *string `json:"pushed_at"`
			SizeKiB       *int64  `json:"size_kib"`
			DefaultBranch *string `json:"default_branch"`
			OwnerType     string  `json:"owner_type"`
		} `json:"repositories"`
	}
	d := json.NewDecoder(strings.NewReader(string(b)))
	d.DisallowUnknownFields()
	var extra any
	if !catalogNoDuplicates(b) || d.Decode(&reply) != nil || d.Decode(&extra) != io.EOF || reply.SchemaVersion != 1 || (reply.Login != "" && !catalogOwner(reply.Login)) || reply.Repositories == nil || len(reply.Repositories) > 1000 {
		fail(503, "daemon_unavailable", "catalog_invalid")
		return
	}
	for _, item := range reply.Repositories {
		parts := strings.Split(item.FullName, "/")
		if len(parts) != 2 || !catalogOwner(parts[0]) || !catalogName(parts[1]) || item.HTMLURL != "https://github.com/"+item.FullName || item.Private == nil || item.Description == nil || len(*item.Description) > 500 || strings.ContainsAny(*item.Description, "\r\n\x00") {
			fail(503, "daemon_unavailable", "repository_invalid")
			return
		}
		if item.SizeKiB == nil || *item.SizeKiB < 0 || *item.SizeKiB > 9007199254740991 || (item.OwnerType != "User" && item.OwnerType != "Organization") || (item.DefaultBranch != nil && (*item.DefaultBranch == "" || len(*item.DefaultBranch) > 255 || strings.IndexFunc(*item.DefaultBranch, func(r rune) bool { return r < 0x20 || r == 0x7f }) >= 0)) {
			fail(503, "daemon_unavailable", "repository_metadata_invalid")
			return
		}
		if item.PushedAt != nil && !catalogTimestamp(*item.PushedAt) {
			fail(503, "daemon_unavailable", "repository_timestamp_invalid")
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
func catalogTimestamp(s string) bool {
	stamp, err := time.Parse(time.RFC3339, s)
	return err == nil && stamp.Format(time.RFC3339) == s
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
