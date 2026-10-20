//go:build linux

package gateway

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

var editorTestOrigin = (&Auth{cfg: OAuthConfig{EditorOrigin: "https://code.test"}}).editorPersonOrigin(Identity{Provider: "github", Subject: "42"})
var editorTestHost = strings.TrimPrefix(editorTestOrigin, "https://")

// editorDesk is a signed-in app session ("browser") with an editor origin
// and a daemon that records what reaches it.
type editorDesk struct {
	t      *testing.T
	h      http.Handler
	a      *Auth
	server *httptest.Server
	now    *time.Time
	seen   chan *http.Request
}

func newEditorDesk(t *testing.T, daemon http.Handler) *editorDesk {
	t.Helper()
	seen := make(chan *http.Request, 64)
	if daemon == nil {
		daemon = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			seen <- r.Clone(context.Background())
			http.SetCookie(w, &http.Cookie{Name: editorCookie, Value: "from-code-server"})
			w.Header().Set("X-Frame-Options", "DENY")
			io.WriteString(w, "code-server:"+r.URL.RequestURI())
		})
	}
	h, a := proxyFixture(t, daemon)
	now := time.Now()
	a.now = func() time.Time { return now }
	a.random = rand.Reader
	a.broker = newFakeBroker()
	a.log = CallbackLogger(io.Discard)
	a.cfg.EditorOrigin = "https://code.test"
	h = NewWithAuth("", a)
	server := httptest.NewTLSServer(h)
	t.Cleanup(server.Close)
	return &editorDesk{t: t, h: h, a: a, server: server, now: &now, seen: seen}
}

// do sends a request to host ("host.test" is the app, "code.test" the editor)
// over the test server's real TLS listener.
func (d *editorDesk) do(method, host, path, body string, edit func(*http.Request)) *http.Response {
	d.t.Helper()
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req, _ := http.NewRequest(method, d.server.URL+path, reader)
	req.Host = host
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if edit != nil {
		edit(req)
	}
	res, err := d.server.Client().Do(req)
	if err != nil {
		d.t.Fatal(err)
	}
	d.t.Cleanup(func() { res.Body.Close() })
	return res
}

func appCookie(r *http.Request) { r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"}) }
func appWrite(r *http.Request) {
	appCookie(r)
	r.Header.Set("Origin", "https://host.test")
	r.Header.Set("X-Agent-Host-CSRF", "token")
}
func editorWrite(r *http.Request) { r.Header.Set("Origin", editorTestOrigin) }

func (d *editorDesk) mint() string {
	d.t.Helper()
	res := d.do("POST", "host.test", "/auth/editor", "", appWrite)
	var v struct{ Token, Origin string }
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&v) != nil || v.Origin != editorTestOrigin || len(v.Token) != 43 {
		d.t.Fatalf("mint: %d %+v", res.StatusCode, v)
	}
	return v.Token
}

func (d *editorDesk) redeem(token string) *http.Cookie {
	d.t.Helper()
	res := d.do("POST", editorTestHost, "/_open-habitat/handoff", `{"token":"`+token+`"}`, editorWrite)
	if res.StatusCode != 204 {
		d.t.Fatalf("redeem: %d", res.StatusCode)
	}
	for _, c := range res.Cookies() {
		if c.Name == editorCookie {
			return c
		}
	}
	d.t.Fatal("no editor cookie")
	return nil
}

func TestEditorHandoffIsSingleUseAndBound(t *testing.T) {
	d := newEditorDesk(t, nil)
	// Minting is an app write: Origin and CSRF are both required.
	if res := d.do("POST", "host.test", "/auth/editor", "", appCookie); res.StatusCode != 403 {
		t.Fatalf("mint without CSRF: %d", res.StatusCode)
	}
	token := d.mint()
	// Only the editor's own pages redeem it.
	if res := d.do("POST", editorTestHost, "/_open-habitat/handoff", `{"token":"`+token+`"}`, func(r *http.Request) { r.Header.Set("Origin", "https://host.test") }); res.StatusCode != 403 {
		t.Fatalf("redeem from the app origin: %d", res.StatusCode)
	}
	cookie := d.redeem(token)
	if res := d.do("POST", editorTestHost, "/_open-habitat/handoff", `{"token":"`+d.mint()+`"}`, editorWrite); res.Header.Get("Clear-Site-Data") != `"storage", "cache"` {
		t.Fatalf("a new editor session left the origin's storage: %v", res.Header)
	}
	if !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode || cookie.Path != "/" || cookie.Domain != "" {
		t.Fatalf("editor cookie attributes: %+v", cookie)
	}
	if res := d.do("POST", editorTestHost, "/_open-habitat/handoff", `{"token":"`+token+`"}`, editorWrite); res.StatusCode != 401 {
		t.Fatalf("second redemption: %d", res.StatusCode)
	}
	late := d.mint()
	*d.now = d.now.Add(editorGrantLifetime + time.Second)
	if res := d.do("POST", editorTestHost, "/_open-habitat/handoff", `{"token":"`+late+`"}`, editorWrite); res.StatusCode != 401 {
		t.Fatalf("expired token: %d", res.StatusCode)
	}
	// Ending the app session ends the editor session it created.
	withCookie := func(r *http.Request) { r.AddCookie(cookie) }
	if res := d.do("GET", editorTestHost, "/_open-habitat/session", "", withCookie); res.StatusCode != 204 {
		t.Fatalf("editor session: %d", res.StatusCode)
	}
	if res := d.do("POST", "host.test", "/auth/logout", "", appWrite); res.StatusCode != 204 {
		t.Fatalf("logout: %d", res.StatusCode)
	}
	if res := d.do("GET", editorTestHost, "/_open-habitat/session", "", withCookie); res.StatusCode != 401 {
		t.Fatalf("editor session after logout: %d", res.StatusCode)
	}
}

// Neither origin's cookie is authority on the other, and the editor origin
// never serves the app: its paths reach code-server, not the gateway's own.
func TestEditorOriginIsolation(t *testing.T) {
	d := newEditorDesk(t, nil)
	cookie := d.redeem(d.mint())
	if res := d.do("GET", editorTestHost, "/stable/workbench.js", "", appCookie); res.StatusCode != 401 || len(d.seen) != 0 {
		t.Fatalf("app cookie on the editor origin: %d", res.StatusCode)
	}
	if res := d.do("GET", "host.test", "/api/v1/snapshot", "", func(r *http.Request) { r.AddCookie(cookie) }); res.StatusCode != 401 {
		t.Fatalf("editor cookie on the app origin: %d", res.StatusCode)
	}
	res := d.do("GET", editorTestHost, "/auth/session?x=1", "", func(r *http.Request) {
		r.AddCookie(cookie)
		r.Header.Set("Accept", "*/*")
		r.Header.Set("X-Agent-Host-Session", "forged")
		r.Header.Set("X-Agent-Host-Recent-Login", "1")
		r.Header.Set("Authorization", "Bearer x")
		r.Header.Set("Origin", editorTestOrigin)
	})
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode != 200 || string(body) != "code-server:/editor-relay/auth/session?x=1" {
		t.Fatalf("editor path: %d %q", res.StatusCode, body)
	}
	got := <-d.seen
	for name := range got.Header {
		switch name {
		case "Accept", "Accept-Encoding", "User-Agent", "Content-Length", "Connection": // the last two are the transport's own
		default:
			t.Errorf("header %s crossed to the daemon", name)
		}
	}
	if got.Header.Get("User-Agent") != "Go-http-client/1.1" && got.Header.Get("User-Agent") != "" {
		t.Errorf("browser User-Agent crossed: %q", got.Header.Get("User-Agent"))
	}
	// code-server's own cookies and frame denial do not reach the browser;
	// the editor host may be framed by the app origin, the app by nobody.
	if len(res.Cookies()) != 0 || res.Header.Get("X-Frame-Options") != "" || !strings.Contains(strings.Join(res.Header.Values("Content-Security-Policy"), ";"), "frame-ancestors 'self' https://host.test") {
		t.Fatalf("editor response headers: %v", res.Header)
	}
	app := d.do("GET", "host.test", "/healthz", "", nil)
	if app.Header.Get("Content-Security-Policy") != "frame-ancestors 'none'" || app.Header.Get("X-Frame-Options") != "DENY" {
		t.Fatalf("app frame headers: %v", app.Header)
	}
	frame := d.do("GET", editorTestHost, "/_open-habitat/frame?workspace_id=ws_example123", "", nil)
	html, _ := io.ReadAll(frame.Body)
	if frame.StatusCode != 200 || !strings.Contains(string(html), `content="https://host.test"`) || frame.Header.Get("X-Frame-Options") != "" {
		t.Fatalf("frame page: %d %v", frame.StatusCode, frame.Header)
	}
	// A write or an upgrade from any other origin is refused before the relay.
	for _, edit := range []func(*http.Request){
		func(r *http.Request) {
			r.Method = "POST"
			r.AddCookie(cookie)
			r.Header.Set("Origin", "https://host.test")
		},
		func(r *http.Request) {
			r.AddCookie(cookie)
			r.Header.Set("Connection", "Upgrade")
			r.Header.Set("Upgrade", "websocket")
			r.Header.Set("Origin", "https://evil.test")
		},
	} {
		if res := d.do("GET", editorTestHost, "/stable/x", "", edit); res.StatusCode != 403 {
			t.Fatalf("cross-origin write or upgrade: %d", res.StatusCode)
		}
	}
	if len(d.seen) != 0 {
		t.Fatal("a refused request reached the daemon")
	}
}

func TestEditorAbsentWithoutConfiguration(t *testing.T) {
	d := newEditorDesk(t, nil)
	d.a.cfg.EditorOrigin = ""
	d.server.Config.Handler = NewWithAuth("", d.a)
	if res := d.do("POST", "host.test", "/auth/editor", "", appWrite); res.StatusCode != 404 {
		t.Fatalf("mint without an editor origin: %d", res.StatusCode)
	}
	if res := d.do("GET", editorTestHost, "/_open-habitat/frame", "", nil); res.Header.Get("X-Frame-Options") != "DENY" {
		t.Fatalf("unconfigured editor host served: %v", res.Header)
	}
	for editor, ok := range map[string]bool{"https://host.test": false, "http://code.test": false, "https://code.test/x": false, "https://code.test": true, "https://test": false, "https://127.0.0.1": false, "https://*.code.test": false} {
		if validEditorOrigin("https://host.test", editor) != ok {
			t.Errorf("editor origin %q", editor)
		}
	}
}

// An upgraded editor connection is a live channel to code-server: ending the
// app session, by logout or revocation, closes it on both sides.
func TestEditorRelayEndsWithAppSession(t *testing.T) {
	for _, ending := range []string{"logout", "revoke", "expiry"} {
		t.Run(ending, func(t *testing.T) {
			upstreamDone := make(chan struct{})
			d := newEditorDesk(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Upgrade") != "echo" {
					http.Error(w, "upgrade", 400)
					return
				}
				conn, rw, err := http.NewResponseController(w).Hijack()
				if err != nil {
					return
				}
				defer conn.Close()
				io.WriteString(rw, "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: echo\r\n\r\n")
				rw.Flush()
				for {
					line, err := rw.ReadString('\n')
					if err != nil {
						close(upstreamDone)
						return
					}
					io.WriteString(rw, "echo:"+line)
					rw.Flush()
				}
			}))
			cookie := d.redeem(d.mint())
			c, err := tls.Dial("tcp", d.server.Listener.Addr().String(), &tls.Config{InsecureSkipVerify: true})
			if err != nil {
				t.Fatal(err)
			}
			defer c.Close()
			io.WriteString(c, "GET /stable/socket HTTP/1.1\r\nHost: "+editorTestHost+"\r\nConnection: Upgrade\r\nUpgrade: echo\r\nOrigin: "+editorTestOrigin+"\r\nCookie: "+cookie.Name+"="+cookie.Value+"\r\n\r\n")
			br := bufio.NewReader(c)
			res, err := http.ReadResponse(br, nil)
			if err != nil || res.StatusCode != 101 {
				t.Fatalf("upgrade: %v %v", res, err)
			}
			io.WriteString(c, "hello\n")
			if line, err := br.ReadString('\n'); err != nil || line != "echo:hello\n" {
				t.Fatalf("relay: %q %v", line, err)
			}
			switch ending {
			case "logout":
				if res := d.do("POST", "host.test", "/auth/logout", "", appWrite); res.StatusCode != 204 {
					t.Fatalf("logout: %d", res.StatusCode)
				}
			case "revoke":
				if err := d.a.RevokeSubject(context.Background(), "42"); err != nil {
					t.Fatal(err)
				}
			case "expiry":
				d.a.mu.Lock()
				*d.now = d.now.Add(editorSessionLifetime + time.Second)
				d.a.mu.Unlock()
			}
			_ = c.SetReadDeadline(time.Now().Add(4 * time.Second))
			if _, err := br.ReadString('\n'); err == nil {
				t.Fatal("relay still open")
			} else if ne, ok := err.(net.Error); ok && ne.Timeout() {
				t.Fatal("relay survived the session ending")
			}
			select {
			case <-upstreamDone:
			case <-time.After(3 * time.Second):
				t.Fatal("daemon side survived")
			}
		})
	}
}

// A browser may retain A's live document, service worker, and even a copied
// cookie. None can turn A's origin into B's relay when the browser signs in as B.
func TestEditorPersonHostsBindGrantsAndSessions(t *testing.T) {
	d := newEditorDesk(t, nil)
	aliceOrigin := editorTestOrigin
	aliceHost := editorTestHost
	aliceCookie := d.redeem(d.mint())
	d.a.mu.Lock()
	s := d.a.sessions["browser"]
	s.identity.Subject = "99"
	s.identity.Username = "bob"
	d.a.sessions["browser"] = s
	d.a.mu.Unlock()
	bobOrigin := d.a.editorPersonOrigin(s.identity)
	bobHost := strings.TrimPrefix(bobOrigin, "https://")
	if aliceOrigin == bobOrigin {
		t.Fatal("people share an origin")
	}
	mint := func() string {
		res := d.do("POST", "host.test", "/auth/editor", "", appWrite)
		var v struct{ Token, Origin string }
		if json.NewDecoder(res.Body).Decode(&v) != nil || res.StatusCode != 200 || v.Origin != bobOrigin {
			t.Fatalf("Bob mint: %d %+v", res.StatusCode, v)
		}
		return v.Token
	}
	// A's leftover document cannot redeem B's grant on its own origin.
	res := d.do("POST", aliceHost, "/_open-habitat/handoff", `{"token":"`+mint()+`"}`, editorWrite)
	if res.StatusCode != 401 || len(res.Cookies()) != 0 {
		t.Fatalf("cross-person grant: %d", res.StatusCode)
	}
	res = d.do("POST", bobHost, "/_open-habitat/handoff", `{"token":"`+mint()+`"}`, func(r *http.Request) { r.Header.Set("Origin", bobOrigin) })
	if res.StatusCode != 204 || len(res.Cookies()) != 1 {
		t.Fatalf("Bob redeem: %d", res.StatusCode)
	}
	bobCookie := res.Cookies()[0]
	for _, tc := range []struct {
		host   string
		cookie *http.Cookie
		want   int
	}{
		{aliceHost, aliceCookie, 401}, // old parent identity no longer exists
		{aliceHost, bobCookie, 401},   // even a stolen/copied B cookie cannot use A's origin
		{bobHost, aliceCookie, 401},
		{bobHost, bobCookie, 200},
		{"code.test", bobCookie, 400},            // old shared installation fails closed
		{"unexpected.code.test", bobCookie, 400}, // the entire namespace excludes the app
	} {
		res := d.do("GET", tc.host, "/stable/workbench.js", "", func(r *http.Request) { r.AddCookie(tc.cookie) })
		if res.StatusCode != tc.want {
			t.Errorf("%s: %d, want %d", tc.host, res.StatusCode, tc.want)
		}
	}
	if len(d.seen) != 1 {
		t.Fatalf("refused request reached daemon: %d", len(d.seen))
	}
	// B's cookie on B's host still does not authorize writes from A's origin.
	res = d.do("POST", bobHost, "/stable/write", "", func(r *http.Request) { r.AddCookie(bobCookie); r.Header.Set("Origin", aliceOrigin) })
	if res.StatusCode != 403 || len(d.seen) != 1 {
		t.Fatalf("cross-person write: %d", res.StatusCode)
	}
}
