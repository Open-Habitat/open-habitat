//go:build linux

package gateway

import (
	"bufio"
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"github.com/Open-Habitat/open-habitat/internal/udssecure"
	"github.com/Open-Habitat/open-habitat/internal/wsframe"
)

// The browser shell's routes. The daemon runs the shell as the person; the
// gateway authenticates, checks Origin and CSRF, picks the daemon from the
// session, and relays bytes. A relayed terminal is a live write channel, so it
// is registered with the session and closed when the session ends.
const (
	terminalsPath     = "/api/v1/workspaces/terminals"
	terminalClosePath = "/api/v1/workspaces/terminals/close"
	terminalPath      = "/api/v1/workspaces/terminal"
	// Terminals one browser session may hold open at once.
	terminalSessionLimit = 8
	terminalIdle         = 90 * time.Second
)

var (
	terminalShell     = regexp.MustCompile(`^(new|[1-9][0-9]{0,2})$`)
	terminalTaskfleet = regexp.MustCompile(`^[0-9a-f]{8,64}-[0-9]{1,6}$`)
	daemonErrorCode   = regexp.MustCompile(`^[a-z_]{1,40}$`)
)

func (a *Auth) terminalList(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("workspace_id")
	if r.Method != http.MethodGet || !a.exact(r, terminalsPath, "workspace_id") || r.URL.EscapedPath() != terminalsPath || r.URL.RawQuery != "workspace_id="+id || !workspaceGitID.MatchString(id) || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || r.ProtoMajor != 1 || r.ProtoMinor != 1 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	a.proxy(w, r, s, false)
}

func (a *Auth) terminalClose(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !a.exact(r, terminalClosePath) || r.URL.EscapedPath() != terminalClosePath || r.RequestURI != terminalClosePath || r.ContentLength < 2 || r.ContentLength > 256 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 || len(r.TransferEncoding) != 0 || r.ProtoMajor != 1 || r.ProtoMinor != 1 {
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
	a.proxy(w, r, s, false)
}

// terminalSlot holds one of the session's terminal places.
func (a *Auth) terminalSlot(r *http.Request) (func(), bool) {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return nil, false
	}
	key := a.cookieKey(c.Value)
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.terminals[key] >= terminalSessionLimit {
		return nil, false
	}
	if a.terminals == nil {
		a.terminals = make(map[string]int)
	}
	a.terminals[key]++
	return func() {
		a.mu.Lock()
		defer a.mu.Unlock()
		if a.terminals[key]--; a.terminals[key] <= 0 {
			delete(a.terminals, key)
		}
	}, true
}

// terminal relays one browser terminal to the mapped daemon. Browsers cannot
// set headers on a WebSocket, so the CSRF proof is the first message; the
// gateway reads it before it even dials the daemon, which therefore never
// sees a connection that did not prove it.
func (a *Auth) terminal(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	id, shell, taskfleet := q.Get("workspace_id"), q.Get("shell"), q.Get("taskfleet")
	query, param := "", "shell"
	switch {
	case len(q["shell"]) == 1 && terminalShell.MatchString(shell):
		query = "workspace_id=" + id + "&shell=" + shell
	case len(q["taskfleet"]) == 1 && terminalTaskfleet.MatchString(taskfleet):
		query, param = "workspace_id="+id+"&taskfleet="+taskfleet, "taskfleet"
	}
	if query == "" || r.URL.RawQuery != query || !workspaceGitID.MatchString(id) || !a.exact(r, terminalPath, "workspace_id", param) || r.URL.EscapedPath() != terminalPath || !wsframe.IsUpgrade(r) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	// WebSockets are not subject to CORS and the handshake carries the
	// cookie, so only the exact app origin may open one.
	if r.Header.Get("Origin") != a.cfg.Origin || len(r.Header.Values("Origin")) != 1 {
		safe(w, 403, "origin_denied")
		return
	}
	target := s.identity
	logRelay := func(outcome, reason string) {
		if a.log != nil {
			a.log.Info("terminal_relay", "outcome", outcome, "reason", reason, "user", target.Username)
		}
	}
	if a.snapshotDial == nil && udssecure.Mapped(target.Socket, target.UID) != nil {
		logRelay("failed", "socket_binding_unavailable")
		safe(w, 503, "daemon_unavailable")
		return
	}
	releaseSlot, ok := a.terminalSlot(r)
	if !ok {
		logRelay("refused", "terminal_limit")
		safe(w, 429, "terminal_limit")
		return
	}
	defer releaseSlot()
	ctx, release, ok := a.liveRequest(r, s)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	defer release()
	browser, brw, err := http.NewResponseController(w).Hijack()
	if err != nil {
		return
	}
	defer browser.Close()
	_ = browser.SetDeadline(time.Time{})
	_ = browser.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if _, err := browser.Write(wsframe.SwitchingProtocols(r.Header.Get("Sec-WebSocket-Key"))); err != nil {
		return
	}
	closeBrowser := func(code uint16, reason string) {
		_ = browser.SetWriteDeadline(time.Now().Add(5 * time.Second))
		_, _ = browser.Write(wsframe.AppendFrame(nil, wsframe.OpClose, wsframe.ClosePayload(code, reason), false))
	}
	_ = browser.SetReadDeadline(time.Now().Add(10 * time.Second))
	first, err := wsframe.ReadFrame(brw.Reader, 512, true)
	var proof struct {
		Type string `json:"type"`
		CSRF string `json:"csrf"`
	}
	dec := json.NewDecoder(bytes.NewReader(first.Payload))
	dec.DisallowUnknownFields()
	if err != nil || first.Op != wsframe.OpText || !first.Fin || dec.Decode(&proof) != nil || dec.More() || proof.Type != "auth" || subtle.ConstantTimeCompare([]byte(proof.CSRF), []byte(s.csrf)) != 1 {
		closeBrowser(4403, "csrf_denied")
		logRelay("refused", "csrf_denied")
		return
	}
	dctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	daemon, err := a.dialDaemon(dctx, target)
	cancel()
	if err != nil {
		closeBrowser(4503, "daemon_unavailable")
		logRelay("failed", "daemon_exchange_failed")
		return
	}
	defer daemon.Close()
	key, err := wsframe.NewKey()
	if err != nil {
		closeBrowser(4503, "daemon_unavailable")
		return
	}
	head := "GET " + terminalPath + "?" + query + " HTTP/1.1\r\nHost: unix\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: " + key + "\r\n"
	if rid := diagnostic.RequestID(r.Context()); diagnostic.ValidRequestID(rid) {
		head += diagnostic.RequestIDHeader + ": " + rid + "\r\n"
	}
	_ = daemon.SetDeadline(time.Now().Add(10 * time.Second))
	drd := bufio.NewReader(daemon)
	var res *http.Response
	if _, err = io.WriteString(daemon, head+"\r\n"); err == nil {
		res, err = http.ReadResponse(drd, nil)
	}
	if err != nil {
		closeBrowser(4503, "daemon_unavailable")
		logRelay("failed", "daemon_exchange_failed")
		return
	}
	if !wsframe.ValidResponse(res, key) {
		// Only a fixed daemon error code crosses to the browser.
		code := "daemon_unavailable"
		var body struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		if json.NewDecoder(io.LimitReader(res.Body, 4096)).Decode(&body) == nil && daemonErrorCode.MatchString(body.Error.Code) {
			code = body.Error.Code
		}
		status := res.StatusCode
		if status < 400 || status > 599 {
			status = 503
		}
		res.Body.Close()
		closeBrowser(uint16(4000+status), code)
		logRelay("refused", "daemon_"+fmt.Sprint(status))
		return
	}
	_ = daemon.SetDeadline(time.Time{})
	logRelay("opened", "relaying")
	done := make(chan string, 2)
	go func() { done <- pipe(daemon, brw.Reader, browser, "browser") }()
	go func() { done <- pipe(browser, drd, daemon, "daemon") }()
	reason, running := "session_ended", 2
	select {
	case reason = <-done:
		running--
	case <-ctx.Done():
	}
	// Closing both ends stops the other direction; the tmux session itself
	// keeps running, as it would after an SSH connection drops.
	browser.Close()
	daemon.Close()
	for ; running > 0; running-- {
		<-done
	}
	logRelay("closed", reason)
}

// pipe copies one direction until either side fails or stays silent past the
// idle limit; the daemon pings every 25 seconds, so a healthy pair never does.
func pipe(dst net.Conn, src io.Reader, srcConn net.Conn, from string) string {
	buf := make([]byte, 32<<10)
	for {
		_ = srcConn.SetReadDeadline(time.Now().Add(terminalIdle))
		n, err := src.Read(buf)
		if n > 0 {
			_ = dst.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if _, werr := dst.Write(buf[:n]); werr != nil {
				return from + "_write_failed"
			}
		}
		if err != nil {
			return from + "_closed"
		}
	}
}
