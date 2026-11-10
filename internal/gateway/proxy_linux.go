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
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/udssecure"
	"golang.org/x/sys/unix"
)

const proxyBodyLimit int64 = 32 << 20
const proxyRequestLimit int64 = 66000

// streamWriteTimeout bounds one write of a proxied stream to the browser.
var streamWriteTimeout = 10 * time.Second

type idleReadConn struct{ net.Conn }

func (c idleReadConn) Read(p []byte) (int, error) {
	if err := c.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
		return 0, err
	}
	return c.Conn.Read(p)
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

// dialDaemon connects to the session's mapped daemon socket. The caller has
// already checked the socket's binding with udssecure.Mapped.
func (a *Auth) dialDaemon(ctx context.Context, target Identity) (net.Conn, error) {
	dial := a.snapshotDial
	if dial == nil {
		dial = func(ctx context.Context, path string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, "unix", path)
		}
	}
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
	return conn, nil
}

// These fixed names describe routes without recording a browser-supplied URL.
func proxyOperation(path string) string {
	switch path {
	case "/api/v1/snapshot":
		return "snapshot"
	case "/api/v1/onboarding/pi/attempt":
		return "pi_attempt"
	case "/api/v1/onboarding/github/repos":
		return "github_repos"
	case githubClonesPath, githubCloneEventsPath:
		return "github_clones"
	case integrationGiteaPath, integrationGiteaRepos:
		return "integrations_gitea"
	case integrationGitLabPath, integrationGitLabRepos, integrationGitLabTokens:
		return "integrations_gitlab"
	default:
		// Classify the route, never log the browser-supplied session ID.
		if strings.HasSuffix(path, "/regenerate_title") && conversationPath.MatchString(path) {
			return "conversation_title"
		}
		return "daemon_request"
	}
}

// proxy builds a new request rather than cloning the browser request: only the
// session's mapped socket and the explicitly selected headers cross the boundary.
func (a *Auth) proxy(w http.ResponseWriter, r *http.Request, s session, stream bool) {
	target := s.identity
	failure := func(reason string) {
		if a.log != nil {
			a.log.Warn("daemon_route", "outcome", "failed", "operation", proxyOperation(r.URL.Path), "reason", reason, "user", target.Username)
		}
	}
	if a.snapshotDial == nil && udssecure.Mapped(target.Socket, target.UID) != nil {
		failure("socket_binding_unavailable")
		safe(w, 503, "daemon_unavailable")
		return
	}
	transport := &http.Transport{
		MaxResponseHeaderBytes: 64 << 10,
		DisableKeepAlives:      true,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			conn, err := a.dialDaemon(ctx, target)
			if err != nil {
				return nil, err
			}
			if stream {
				return idleReadConn{conn}, nil
			}
			return conn, nil
		},
	}
	defer transport.CloseIdleConnections()
	ctx := r.Context()
	if stream {
		liveCtx, release, ok := a.liveRequest(r, s)
		if !ok {
			safe(w, 401, "authentication_required")
			return
		}
		defer release()
		ctx = liveCtx
	}
	// No fixed socket deadline for streams: a healthy stream may remain open.
	// Request context cancellation closes the transport connection; finite reads
	// get ample headroom beyond the daemon's onboarding and native I/O budgets.
	if !stream {
		var cancel context.CancelFunc
		ceiling := 60 * time.Second
		// Allow the daemon's five-minute attachment body budget plus saving
		// and response time. All other finite routes retain their own limits.
		if r.URL.Path == "/api/v1/attachments" && r.Method == http.MethodPost {
			ceiling = 6 * time.Minute
			// Context cancellation alone cannot interrupt a blocked read of
			// the browser body by the transport's request writer.
			_ = http.NewResponseController(w).SetReadDeadline(time.Now().Add(ceiling))
		}
		if r.URL.Path == "/api/v1/workspaces/github/publish" && r.Method == http.MethodPost {
			ceiling = 46 * time.Minute
		}
		// Pi answers a compaction once its summary is written; the daemon
		// waits for that up to ten minutes (compaction_linux.go).
		if r.Method == http.MethodPost && compactPath.MatchString(r.URL.Path) {
			ceiling = 11 * time.Minute
		}
		ctx, cancel = context.WithTimeout(ctx, ceiling)
		defer cancel()
	}
	// A zero-length POST must be sent without chunked framing: the daemon
	// rejects transfer encoding on body-less control and onboarding routes.
	var body io.ReadCloser = http.NoBody
	requestLimit := proxyRequestLimit
	if r.URL.Path == editorFilesPrefix+"file" && r.Method == http.MethodPut {
		requestLimit = 8 << 20
	}
	if r.URL.Path == workspaceIconSuggestionsPath && r.Method == http.MethodPost {
		requestLimit = workspaceIconSuggestionsLimit
	}
	if r.URL.Path == "/api/v1/attachments" && r.Method == http.MethodPost {
		requestLimit = 20 << 20
	}
	if r.URL.Path == integrationGiteaPath || r.URL.Path == integrationGitLabPath {
		requestLimit = giteaRequestLimit
	}
	if r.ContentLength < 0 || r.ContentLength > requestLimit {
		safe(w, 400, "invalid_request")
		return
	}
	if r.Method != http.MethodGet && r.ContentLength > 0 && r.Body != nil {
		body = http.MaxBytesReader(w, r.Body, requestLimit)
	}
	req, err := http.NewRequestWithContext(ctx, r.Method, "http://unix"+r.URL.RequestURI(), body)
	if err != nil {
		failure("request_construction_failed")
		safe(w, 503, "daemon_unavailable")
		return
	}
	if body != http.NoBody {
		req.ContentLength = r.ContentLength
		if typ := r.Header.Get("Content-Type"); typ != "" {
			req.Header.Set("Content-Type", typ)
		}
	}
	if id := diagnostic.RequestID(r.Context()); id != "" {
		req.Header.Set(diagnostic.RequestIDHeader, id)
	}
	if r.URL.Path == githubDisconnectPath && recentGitHubSignIn(s, a.now()) {
		req.Header.Set("X-Agent-Host-Recent-Login", "1")
	}
	if c, e := r.Cookie(cookieName); e == nil && (r.URL.Path == piAttemptPath || r.URL.Path == "/api/v1/pi/claude-login" || r.URL.Path == integrationLoginPath) {
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
		// A browser disconnect cancels the upstream context; it is not a
		// daemon failure. Our own finite-request timeout is still reported.
		if r.Context().Err() == nil && (!stream || ctx.Err() == nil) {
			failure("daemon_exchange_failed")
		}
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	if stream && res.StatusCode == 200 {
		if r.URL.Path == githubCloneEventsPath && res.Header.Get("Content-Type") != "text/event-stream; charset=utf-8" {
			safe(w, 503, "checkout_uncertain")
			return
		}
		flusher, ok := w.(http.Flusher)
		controller := http.NewResponseController(w)
		if !ok {
			safe(w, 503, "daemon_unavailable")
			return
		}
		// The deadline bounds each write to a stalled browser and is cleared
		// while the daemon is quiet. Left armed, HTTP/2 resets an idle stream
		// when it passes even with no write pending (HTTP/1.1 only fails the
		// next write), so a browser on h2 lost its event stream between
		// heartbeats and reconnected every few seconds.
		armed := func() bool {
			err := controller.SetWriteDeadline(time.Now().Add(streamWriteTimeout))
			return err == nil || errors.Is(err, http.ErrNotSupported)
		}
		idle := func() bool {
			err := controller.SetWriteDeadline(time.Time{})
			return err == nil || errors.Is(err, http.ErrNotSupported)
		}
		if !armed() {
			safe(w, 503, "daemon_unavailable")
			return
		}
		w.Header().Set("Content-Type", res.Header.Get("Content-Type"))
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.WriteHeader(res.StatusCode)
		flusher.Flush()
		if !idle() {
			return
		}
		buf := make([]byte, 32<<10)
		var forwarded int64
		for {
			n, readErr := res.Body.Read(buf)
			forwarded += int64(n)
			if r.URL.Path == githubCloneEventsPath && forwarded > 512<<10 {
				return // Only this subscription ends; the browser resubscribes.
			}
			if ctx.Err() != nil {
				return
			}
			if n > 0 {
				if !armed() {
					return
				}
				if _, err := w.Write(buf[:n]); err != nil {
					return
				}
				flusher.Flush()
				if !idle() {
					return
				}
			}
			if readErr != nil {
				return
			}
		}
	}
	// Buffer finite responses before writing headers: an oversized or broken
	// daemon response must not leave a successful but truncated JSON document.
	responseLimit := proxyBodyLimit
	switch {
	case strings.HasPrefix(r.URL.Path, editorFilesPrefix):
		responseLimit = 8 << 20
	case r.URL.Path == integrationGiteaPath, r.URL.Path == integrationGitLabPath, r.URL.Path == integrationGitLabTokens:
		responseLimit = giteaChangeLimit
	case r.URL.Path == integrationGiteaRepos, r.URL.Path == integrationGitLabRepos:
		responseLimit = giteaReposLimit
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, responseLimit+1))
	if err != nil || int64(len(data)) > responseLimit {
		if r.Context().Err() == nil && (!stream || ctx.Err() == nil) {
			failure("daemon_response_unavailable")
		}
		safe(w, 503, "daemon_unavailable")
		return
	}
	for _, name := range []string{"Content-Disposition", "X-Content-Type-Options"} {
		if value := res.Header.Get(name); value != "" {
			w.Header().Set(name, value)
		}
	}
	if typ := res.Header.Get("Content-Type"); typ != "" {
		w.Header().Set("Content-Type", typ)
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(res.StatusCode)
	_, _ = w.Write(data)
}
