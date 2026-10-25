//go:build linux

package gateway

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
)

const (
	viewTestA = "vaaaaaaaaaaaaaaaaaaaaaaaaaa"
	viewTestB = "vbbbbbbbbbbbbbbbbbbbbbbbbbb"
)

// viewDesk is a signed-in app with an editor and a view origin, and a daemon
// stand-in for the export-read route that records every request reaching it.
type viewDesk struct {
	*editorDesk
	seen chan *http.Request
}

func newViewDesk(t *testing.T) *viewDesk {
	t.Helper()
	seen := make(chan *http.Request, 64)
	files := map[string]string{
		"/view-export/" + viewTestA + "/":                  `{"schema_version":1,"view":{"entry":"site/index.html"}}`,
		"/view-export/" + viewTestA + "/site/index.html":   "<script src=app.js></script>",
		"/view-export/" + viewTestA + "/site/app.js":       "1",
		"/view-export/" + viewTestA + "/site/data.bin":     "\x00",
		"/view-export/" + viewTestA + "/site/index.svg":    "<svg/>",
		"/view-export/" + viewTestA + "/site/kuva (1).png": "png",
		"/view-export/" + viewTestB + "/secret/index.html": "other view",
	}
	daemon := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen <- r.Clone(context.Background())
		body, ok := files[r.URL.Path]
		if !ok {
			w.WriteHeader(404)
			io.WriteString(w, `{"schema_version":1,"error":{"code":"view_file_not_found"}}`)
			return
		}
		// A daemon header must never decide how a view host presents bytes.
		w.Header().Set("Content-Type", "text/html")
		http.SetCookie(w, &http.Cookie{Name: viewCookie, Value: "from-daemon"})
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		io.WriteString(w, body)
	})
	d := newEditorDesk(t, daemon)
	d.a.cfg.ViewOrigin = "https://oh-view-*.test"
	d.server.Client().CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return &viewDesk{d, seen}
}

func (d *viewDesk) host(id string) string {
	return strings.TrimPrefix(d.a.viewOrigin(Identity{Provider: "github", Subject: "42"}, id), "https://")
}

func (d *viewDesk) mintView(id string) *url.URL {
	d.t.Helper()
	res := d.do("POST", "host.test", "/auth/view", `{"view_id":"`+id+`"}`, appWrite)
	var v struct{ URL string }
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&v) != nil {
		d.t.Fatalf("mint view: %d", res.StatusCode)
	}
	u, err := url.Parse(v.URL)
	if err != nil || u.Host != d.host(id) || u.Path != viewHandoffRoute {
		d.t.Fatalf("view url %q", v.URL)
	}
	return u
}

func (d *viewDesk) openView(id string) *http.Cookie {
	d.t.Helper()
	u := d.mintView(id)
	res := d.do("GET", u.Host, u.RequestURI(), "", nil)
	if res.StatusCode != 303 || res.Header.Get("Location") != "/" {
		d.t.Fatalf("redeem view: %d %v", res.StatusCode, res.Header)
	}
	for _, c := range res.Cookies() {
		if c.Name == viewCookie {
			return c
		}
	}
	d.t.Fatal("no view cookie")
	return nil
}

func withCookie(c *http.Cookie) func(*http.Request) {
	return func(r *http.Request) { r.AddCookie(c) }
}

func (d *viewDesk) drain() int {
	n := 0
	for {
		select {
		case <-d.seen:
			n++
		default:
			return n
		}
	}
}

func assertViewCSP(t *testing.T, res *http.Response, what string) {
	t.Helper()
	csp := res.Header.Get("Content-Security-Policy")
	if !strings.HasPrefix(csp, "sandbox allow-scripts;") || strings.Contains(csp, "allow-same-origin") || !strings.Contains(csp, "connect-src 'none'") || !strings.Contains(csp, "frame-ancestors https://host.test") || !strings.Contains(csp, "form-action 'none'") || res.Header.Get("X-Content-Type-Options") != "nosniff" || res.Header.Get("Cache-Control") != "no-store" {
		t.Fatalf("%s: view CSP missing or weakened: %d %q", what, res.StatusCode, csp)
	}
}

func TestViewHandoffSessionAndCookieIsolation(t *testing.T) {
	d := newViewDesk(t)
	host := d.host(viewTestA)
	// Minting is an app write and the view ID is the only input.
	if res := d.do("POST", "host.test", "/auth/view", `{"view_id":"`+viewTestA+`"}`, appCookie); res.StatusCode != 403 {
		t.Fatalf("mint without CSRF: %d", res.StatusCode)
	}
	if res := d.do("POST", "host.test", "/auth/view", `{"view_id":"../x"}`, appWrite); res.StatusCode != 400 {
		t.Fatalf("mint with a bad view ID: %d", res.StatusCode)
	}
	u := d.mintView(viewTestA)
	// The token is bound to its view's host: another view host cannot use it.
	if res := d.do("GET", d.host(viewTestB), u.RequestURI(), "", nil); res.StatusCode != 401 {
		t.Fatalf("token redeemed on another view host: %d", res.StatusCode)
	}
	cookie := d.openView(viewTestA)
	if !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteNoneMode || cookie.Path != "/" || cookie.Domain != "" || !strings.HasPrefix(cookie.Name, "__Host-") {
		t.Fatalf("view cookie attributes: %+v", cookie)
	}
	if res := d.do("GET", u.Host, u.RequestURI(), "", nil); res.StatusCode != 401 {
		t.Fatalf("second redemption: %d", res.StatusCode)
	}
	d.drain()
	// The app and editor cookies authorize nothing on a view host, and the
	// view cookie authorizes nothing on the app, the editor or another view.
	for name, edit := range map[string]func(*http.Request){
		"app cookie":    appCookie,
		"editor cookie": withCookie(&http.Cookie{Name: editorCookie, Value: cookie.Value}),
		"no cookie":     nil,
	} {
		res := d.do("GET", host, "/site/index.html", "", edit)
		assertViewCSP(t, res, name)
		if res.StatusCode != 401 {
			t.Fatalf("%s on a view host: %d", name, res.StatusCode)
		}
	}
	if res := d.do("GET", d.host(viewTestB), "/secret/index.html", "", withCookie(cookie)); res.StatusCode != 401 {
		t.Fatalf("view cookie on another view's host: %d", res.StatusCode)
	}
	if res := d.do("GET", "host.test", "/api/v1/views", "", withCookie(&http.Cookie{Name: cookieName, Value: cookie.Value})); res.StatusCode != 401 {
		t.Fatalf("view session as an app session: %d", res.StatusCode)
	}
	if res := d.do("GET", editorTestHost, "/", "", withCookie(&http.Cookie{Name: editorCookie, Value: cookie.Value})); res.StatusCode != 401 {
		t.Fatalf("view session as an editor session: %d", res.StatusCode)
	}
	if n := d.drain(); n != 0 {
		t.Fatalf("%d unauthorized requests reached the daemon", n)
	}
	// The relayed request is the gateway's own: no browser cookie or header.
	res := d.do("GET", host, "/site/app.js?v=2", "", func(r *http.Request) {
		r.AddCookie(cookie)
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
		r.Header.Set("Authorization", "Bearer x")
	})
	if body, _ := io.ReadAll(res.Body); res.StatusCode != 200 || string(body) != "1" || res.Header.Get("Content-Type") != "text/javascript; charset=utf-8" || res.Header.Get("Set-Cookie") != "" {
		t.Fatalf("view file: %d %q %v", res.StatusCode, body, res.Header)
	}
	got := <-d.seen
	if got.URL.Path != "/view-export/"+viewTestA+"/site/app.js" || got.URL.RawQuery != "" || got.Header.Get("Cookie") != "" || got.Header.Get("Authorization") != "" {
		t.Fatalf("daemon saw %s %v", got.URL, got.Header)
	}
	// Ending the app session ends its view sessions.
	d.a.mu.Lock()
	delete(d.a.sessions, "browser")
	d.a.mu.Unlock()
	if res := d.do("GET", host, "/site/app.js", "", withCookie(cookie)); res.StatusCode != 401 {
		t.Fatalf("view after the app session ended: %d", res.StatusCode)
	}
}

func TestViewHostServesOnlyItsExportWithSandboxEverywhere(t *testing.T) {
	d := newViewDesk(t)
	host := d.host(viewTestA)
	cookie := d.openView(viewTestA)
	d.drain()
	// The root goes to the export's entry so its relative links resolve.
	res := d.do("GET", host, "/", "", withCookie(cookie))
	assertViewCSP(t, res, "root")
	if res.StatusCode != 302 || res.Header.Get("Location") != "/site/index.html" {
		t.Fatalf("root: %d %q", res.StatusCode, res.Header.Get("Location"))
	}
	res = d.do("GET", host, "/site/index.html", "", withCookie(cookie))
	assertViewCSP(t, res, "entry")
	if res.StatusCode != 200 || res.Header.Get("Content-Type") != "text/html; charset=utf-8" {
		t.Fatalf("entry: %d %v", res.StatusCode, res.Header)
	}
	if csp := res.Header.Get("Content-Security-Policy"); !strings.Contains(csp, "script-src https://"+host+" 'unsafe-inline'") || strings.Contains(csp, "*") {
		t.Fatalf("sources must name exactly this view host: %q", csp)
	}
	// Names as browsers send them, with characters Go would have escaped.
	for path, want := range map[string]string{"/site/data.bin": "application/octet-stream", "/site/index.svg": "image/svg+xml", "/site/kuva%20(1).png": "image/png"} {
		res := d.do("GET", host, path, "", withCookie(cookie))
		assertViewCSP(t, res, path)
		if res.StatusCode != 200 || res.Header.Get("Content-Type") != want {
			t.Fatalf("%s: %d %q", path, res.StatusCode, res.Header.Get("Content-Type"))
		}
	}
	d.drain()
	// Traversal, encoded separators, hidden names and another export's path
	// never leave the gateway as anything but a path inside this export.
	for _, path := range []string{"/../" + viewTestB + "/secret/index.html", "/site/%2e%2e/%2e%2e/" + viewTestB + "/secret/index.html", "/site%2Fapp.js", "/.git/config", "/site/.env", "/site//app.js", "/site/a\\..\\b"} {
		res := d.do("GET", host, path, "", withCookie(cookie))
		assertViewCSP(t, res, path)
		if res.StatusCode != 404 && res.StatusCode != 400 {
			t.Fatalf("%s: %d", path, res.StatusCode)
		}
	}
	for {
		select {
		case r := <-d.seen:
			if !strings.HasPrefix(r.URL.Path, "/view-export/"+viewTestA+"/") || strings.Contains(r.URL.Path, "..") {
				t.Fatalf("daemon was asked for %q", r.URL.Path)
			}
			continue
		default:
		}
		break
	}
	// A missing file, a write, an upgrade and the reserved namespace are
	// errors that still carry the sandbox.
	for _, tc := range []struct{ method, path string }{{"GET", "/site/missing.html"}, {"POST", "/site/index.html"}, {"GET", "/_open-habitat/frame"}, {"GET", "/_open-habitat/handoff?token=x"}} {
		res := d.do(tc.method, host, tc.path, "", withCookie(cookie))
		assertViewCSP(t, res, tc.method+" "+tc.path)
		if res.StatusCode < 400 {
			t.Fatalf("%s %s: %d", tc.method, tc.path, res.StatusCode)
		}
	}
}

func TestViewOriginConfigurationAndAbsence(t *testing.T) {
	for _, tc := range []struct {
		view, editor string
		ok           bool
	}{
		{"https://oh-view-*.example.org", "https://oh-code-*.example.org", true},
		{"https://oh-view-*.example.org", "", true},
		{"https://oh-code-*.example.org", "https://oh-code-*.example.org", false},
		{"https://oh-*.example.org", "https://oh-code-*.example.org", true},
		{"https://*-code.example.org", "https://*-code.example.org", false},
		{"https://view.example.org", "", false},
		{"https://oh-view-*.example.org:8443", "", false},
		{"http://oh-view-*.example.org", "", false},
		{"https://*.example.org", "", true},
		{"https://*.host.test", "", false},
		{"https://*", "", false},
	} {
		if got := validViewOrigin("https://app.host.test", tc.editor, tc.view); got != tc.ok {
			t.Errorf("validViewOrigin(%q, editor %q) = %v", tc.view, tc.editor, got)
		}
	}
	// Without a view origin nothing is offered and view hosts do not exist.
	h, a := proxyFixture(t, http.NotFoundHandler())
	a.random = rand.Reader
	a.log = CallbackLogger(io.Discard)
	if w := proxyCall(h, "GET", "/api/v1/views", ""); w.Code != 204 {
		t.Fatalf("view list without a view origin: %d", w.Code)
	}
	if w := proxyCall(h, "POST", "/auth/view", `{"view_id":"`+viewTestA+`"}`); w.Code != 404 {
		t.Fatalf("handoff without a view origin: %d", w.Code)
	}
	r := httptest.NewRequest("GET", "https://oh-view-"+strings.Repeat("a", 52)+".test/", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusMisdirectedRequest {
		t.Fatalf("view host without a view origin: %d", w.Code)
	}
}
