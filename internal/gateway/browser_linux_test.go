//go:build linux

package gateway

import (
	"bufio"
	"crypto/tls"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/wsframe"
)

func dialBrowserView(t *testing.T, server *httptest.Server, origin, target string) *terminalBrowser {
	t.Helper()
	c, err := tls.Dial("tcp", server.Listener.Addr().String(), &tls.Config{InsecureSkipVerify: true})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { c.Close() })
	key, _ := wsframe.NewKey()
	head := "GET " + target + " HTTP/1.1\r\nHost: host.test\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: " + key + "\r\nCookie: " + cookieName + "=browser\r\n"
	if origin != "" {
		head += "Origin: " + origin + "\r\n"
	}
	io.WriteString(c, head+"\r\n")
	r := bufio.NewReader(c)
	res, err := http.ReadResponse(r, nil)
	if err != nil {
		t.Fatal(err)
	}
	return &terminalBrowser{c: c, r: r, res: res}
}

// The viewer relay is the shell's: exact Origin, the session's CSRF as the
// first message before the daemon is dialled, then frames unchanged to the
// daemon's own viewer path, and a cap per session.
func TestBrowserViewRelayChecksOriginAndCSRFBeforeTheDaemon(t *testing.T) {
	server, _, d := terminalFixture(t)
	for _, origin := range []string{"", "https://evil.test"} {
		if b := dialBrowserView(t, server, origin, browserViewPath); b.res.StatusCode != 403 {
			t.Errorf("origin %q: %d", origin, b.res.StatusCode)
		}
	}
	if b := dialBrowserView(t, server, "https://host.test", browserViewPath+"?mode=control"); b.res.StatusCode != 400 {
		t.Errorf("query: %d", b.res.StatusCode)
	}
	b := dialBrowserView(t, server, "https://host.test", browserViewPath)
	if b.res.StatusCode != 101 {
		t.Fatalf("upgrade %d", b.res.StatusCode)
	}
	b.send(wsframe.OpBinary, "RFB 003.008\n")
	f, err := b.read(3 * time.Second)
	if code, reason := closeCode(f); err != nil || code != 4403 || reason != "csrf_denied" {
		t.Fatalf("close %d %q %v", code, reason, err)
	}
	if d.reached.Load() != 0 {
		t.Fatal("an unproven viewer reached the daemon")
	}
	b = dialBrowserView(t, server, "https://host.test", browserViewPath)
	b.send(wsframe.OpText, `{"type":"auth","csrf":"token"}`)
	b.send(wsframe.OpBinary, "RFB 003.008\n")
	f, err = b.read(3 * time.Second)
	if err != nil || f.Op != wsframe.OpBinary || string(f.Payload) != "RFB 003.008\n" {
		t.Fatalf("relay %+v %v", f, err)
	}
	d.mu.Lock()
	q := d.queries
	d.mu.Unlock()
	if len(q) != 1 || q[0] != "" {
		t.Fatalf("daemon got %q", q)
	}
}

func TestBrowserViewersAreCappedPerSession(t *testing.T) {
	server, _, _ := terminalFixture(t)
	for i := 0; i < browserViewLimit; i++ {
		b := dialBrowserView(t, server, "https://host.test", browserViewPath)
		if b.res.StatusCode != 101 {
			t.Fatalf("viewer %d: %d", i, b.res.StatusCode)
		}
		b.send(wsframe.OpText, `{"type":"auth","csrf":"token"}`)
	}
	if b := dialBrowserView(t, server, "https://host.test", browserViewPath); b.res.StatusCode != 429 {
		t.Fatalf("over the cap: %d", b.res.StatusCode)
	}
	// Viewers take no terminal's place.
	if b := dialTerminal(t, server, "browser", "https://host.test", shellQuery); b.res.StatusCode != 101 {
		t.Fatalf("terminal beside viewers: %d", b.res.StatusCode)
	}
}

func TestBrowserRoutesNeedTheSessionAndCSRFForWrites(t *testing.T) {
	var seen []string
	host, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.Method+" "+r.URL.RequestURI())
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{}`))
	}))
	id := strings.Repeat("A", 32)
	for _, tc := range []struct {
		method, path, body string
		csrf               bool
		status             int
	}{
		{"GET", browserPath, "", false, 200},
		{"GET", browserWindowPath + "?id=" + id, "", false, 200},
		{"GET", browserWindowPath + "?id=../x", "", false, 400},
		{"GET", browserWindowPath + "?id=" + id + "&id=" + id, "", false, 400},
		{"POST", browserStartPath, "", true, 200},
		{"POST", browserStartPath, "", false, 403},
		{"POST", browserStartPath, "{}", true, 400},
		{"POST", browserControlPath, `{"control":"person"}`, true, 200},
		{"POST", browserControlPath, `{"control":"person"}`, false, 403},
		{"GET", browserControlPath, "", false, 400},
	} {
		r := httptest.NewRequest(tc.method, "https://host.test"+tc.path, strings.NewReader(tc.body))
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
		if tc.method == "POST" {
			r.Header.Set("Origin", "https://host.test")
			if tc.csrf {
				r.Header.Set("X-Agent-Host-CSRF", "token")
			}
			if tc.body != "" {
				r.Header.Set("Content-Type", "application/json")
			}
		}
		w := httptest.NewRecorder()
		host.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Errorf("%s %s csrf=%v: %d, want %d", tc.method, tc.path, tc.csrf, w.Code, tc.status)
		}
	}
	if len(seen) != 4 {
		t.Fatalf("daemon reached %d times: %v", len(seen), seen)
	}
}
