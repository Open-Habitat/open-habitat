//go:build linux

package gateway

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/binary"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/wsframe"
)

// fakeTerminalDaemon accepts the gateway's upgrade and echoes every data
// frame back, so a test can see what reached it and when it ended.
type fakeTerminalDaemon struct {
	reached atomic.Int32
	mu      sync.Mutex
	queries []string
	ended   chan struct{}
	refuse  int
}

func (d *fakeTerminalDaemon) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	d.reached.Add(1)
	d.mu.Lock()
	d.queries = append(d.queries, r.URL.RawQuery)
	d.mu.Unlock()
	if d.refuse != 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(d.refuse)
		io.WriteString(w, `{"schema_version":1,"error":{"code":"shell_ended","message":"x"}}`)
		return
	}
	if r.Host != "unix" || !wsframe.IsUpgrade(r) {
		w.WriteHeader(400)
		return
	}
	conn, rw, err := http.NewResponseController(w).Hijack()
	if err != nil {
		return
	}
	defer func() {
		conn.Close()
		select {
		case d.ended <- struct{}{}:
		default:
		}
	}()
	conn.Write(wsframe.SwitchingProtocols(r.Header.Get("Sec-WebSocket-Key")))
	for {
		f, err := wsframe.ReadFrame(rw.Reader, 1<<16, true)
		if err != nil || f.Op == wsframe.OpClose {
			return
		}
		if _, err := conn.Write(wsframe.AppendFrame(nil, f.Op, f.Payload, false)); err != nil {
			return
		}
	}
}

type terminalBrowser struct {
	c   net.Conn
	r   *bufio.Reader
	res *http.Response
}

func dialTerminal(t *testing.T, server *httptest.Server, cookie, origin, query string) *terminalBrowser {
	t.Helper()
	c, err := tls.Dial("tcp", server.Listener.Addr().String(), &tls.Config{InsecureSkipVerify: true})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { c.Close() })
	key, _ := wsframe.NewKey()
	head := "GET " + terminalPath + "?" + query + " HTTP/1.1\r\nHost: host.test\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: " + key + "\r\n"
	if cookie != "" {
		head += "Cookie: " + cookieName + "=" + cookie + "\r\n"
	}
	if origin != "" {
		head += "Origin: " + origin + "\r\n"
	}
	io.WriteString(c, head+"\r\n")
	r := bufio.NewReader(c)
	res, err := http.ReadResponse(r, nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode == 101 && !wsframe.ValidResponse(res, key) {
		t.Fatal("bad accept")
	}
	return &terminalBrowser{c: c, r: r, res: res}
}

func (b *terminalBrowser) send(op byte, payload string) error {
	_, err := b.c.Write(wsframe.AppendFrame(nil, op, []byte(payload), true))
	return err
}

func (b *terminalBrowser) read(wait time.Duration) (wsframe.Frame, error) {
	_ = b.c.SetReadDeadline(time.Now().Add(wait))
	return wsframe.ReadFrame(b.r, 1<<16, false)
}

func closeCode(f wsframe.Frame) (uint16, string) {
	if f.Op != wsframe.OpClose || len(f.Payload) < 2 {
		return 0, ""
	}
	return binary.BigEndian.Uint16(f.Payload), string(f.Payload[2:])
}

const shellQuery = "workspace_id=ws_example123&shell=new"

func terminalFixture(t *testing.T) (*httptest.Server, *Auth, *fakeTerminalDaemon) {
	t.Helper()
	d := &fakeTerminalDaemon{ended: make(chan struct{}, 16)}
	h, a := proxyFixture(t, d)
	a.log = CallbackLogger(io.Discard)
	server := httptest.NewTLSServer(h)
	t.Cleanup(server.Close)
	return server, a, d
}

func TestTerminalUpgradeRequiresExactOrigin(t *testing.T) {
	server, _, d := terminalFixture(t)
	for _, origin := range []string{"", "https://evil.test", "https://host.test.evil.test", "http://host.test"} {
		b := dialTerminal(t, server, "browser", origin, shellQuery)
		if b.res.StatusCode != 403 {
			t.Errorf("origin %q: %d", origin, b.res.StatusCode)
		}
	}
	if b := dialTerminal(t, server, "", "https://host.test", shellQuery); b.res.StatusCode != 401 {
		t.Errorf("no session: %d", b.res.StatusCode)
	}
	for _, q := range []string{"workspace_id=ws_example123", "workspace_id=ws_example123&shell=new&shell=1", "workspace_id=ws_example123&shell=new&taskfleet=abcdef12-1", "workspace_id=..%2F&shell=new", "workspace_id=ws_example123&taskfleet=%2Frun%2Fx"} {
		if b := dialTerminal(t, server, "browser", "https://host.test", q); b.res.StatusCode != 400 {
			t.Errorf("query %q: %d", q, b.res.StatusCode)
		}
	}
	if n := d.reached.Load(); n != 0 {
		t.Fatalf("refused upgrades reached the daemon %d times", n)
	}
}

func TestTerminalRelayNeedsCSRFProofBeforeTheDaemon(t *testing.T) {
	for name, first := range map[string]struct {
		op      byte
		payload string
	}{
		"missing":      {wsframe.OpBinary, "ls\r"},
		"wrong token":  {wsframe.OpText, `{"type":"auth","csrf":"other"}`},
		"extra field":  {wsframe.OpText, `{"type":"auth","csrf":"token","x":1}`},
		"resize first": {wsframe.OpText, `{"type":"resize","cols":80,"rows":24}`},
	} {
		t.Run(name, func(t *testing.T) {
			server, _, d := terminalFixture(t)
			b := dialTerminal(t, server, "browser", "https://host.test", shellQuery)
			if b.res.StatusCode != 101 {
				t.Fatalf("upgrade %d", b.res.StatusCode)
			}
			b.send(first.op, first.payload)
			f, err := b.read(3 * time.Second)
			if code, reason := closeCode(f); err != nil || code != 4403 || reason != "csrf_denied" {
				t.Fatalf("close %d %q %v", code, reason, err)
			}
			if d.reached.Load() != 0 {
				t.Fatal("unproven connection reached the daemon")
			}
		})
	}
}

func TestTerminalRelayCarriesFramesAndDaemonRefusals(t *testing.T) {
	server, _, d := terminalFixture(t)
	b := dialTerminal(t, server, "browser", "https://host.test", "workspace_id=ws_example123&taskfleet=77f5c84c2248fcc06660-12")
	b.send(wsframe.OpText, `{"type":"auth","csrf":"token"}`)
	b.send(wsframe.OpBinary, "echo hi\r")
	f, err := b.read(3 * time.Second)
	if err != nil || f.Op != wsframe.OpBinary || string(f.Payload) != "echo hi\r" {
		t.Fatalf("relay: %+v %v", f, err)
	}
	d.mu.Lock()
	q := d.queries
	d.mu.Unlock()
	if len(q) != 1 || q[0] != "workspace_id=ws_example123&taskfleet=77f5c84c2248fcc06660-12" {
		t.Fatalf("daemon query %q", q)
	}
	d.refuse = 404
	b = dialTerminal(t, server, "browser", "https://host.test", shellQuery)
	b.send(wsframe.OpText, `{"type":"auth","csrf":"token"}`)
	f, err = b.read(3 * time.Second)
	if code, reason := closeCode(f); err != nil || code != 4404 || reason != "shell_ended" {
		t.Fatalf("refusal: %d %q %v", code, reason, err)
	}
}

// A relayed terminal is a write channel into the person's shell: it must not
// outlive the browser session that opened it.
func TestTerminalRelayEndsWithSession(t *testing.T) {
	for _, ending := range []string{"logout", "revoke", "idle", "absolute"} {
		t.Run(ending, func(t *testing.T) {
			server, a, d := terminalFixture(t)
			now := time.Now()
			a.now = func() time.Time { return now }
			a.broker = newFakeBroker()
			b := dialTerminal(t, server, "browser", "https://host.test", shellQuery)
			b.send(wsframe.OpText, `{"type":"auth","csrf":"token"}`)
			b.send(wsframe.OpBinary, "x")
			if _, err := b.read(3 * time.Second); err != nil {
				t.Fatal(err)
			}
			switch ending {
			case "logout":
				h := NewWithAuth("", a)
				if w := proxyCall(h, "POST", "/auth/logout", ""); w.Code != 204 {
					t.Fatalf("logout: %d", w.Code)
				}
			case "revoke":
				if err := a.RevokeSubject(context.Background(), "42"); err != nil {
					t.Fatal(err)
				}
			default:
				a.mu.Lock()
				s := a.sessions["browser"]
				if ending == "idle" {
					s.absolute = now.Add(2 * time.Hour)
				} else {
					s.idle = now.Add(2 * time.Hour)
				}
				a.sessions["browser"] = s
				now = now.Add(time.Hour)
				a.mu.Unlock()
			}
			if _, err := b.read(4 * time.Second); err == nil {
				t.Fatal("browser terminal survived the session")
			} else if ne, ok := err.(net.Error); ok && ne.Timeout() {
				t.Fatal("browser terminal still open after the session ended")
			}
			select {
			case <-d.ended:
			case <-time.After(2 * time.Second):
				t.Fatal("daemon connection survived the session")
			}
		})
	}
}

func TestTerminalSessionCap(t *testing.T) {
	server, a, _ := terminalFixture(t)
	a.mu.Lock()
	other := a.sessions["browser"]
	other.csrf = "token2"
	a.sessions["other"] = other
	a.mu.Unlock()
	open := make([]*terminalBrowser, 0, terminalSessionLimit)
	for i := 0; i < terminalSessionLimit; i++ {
		b := dialTerminal(t, server, "browser", "https://host.test", shellQuery)
		if b.res.StatusCode != 101 {
			t.Fatalf("terminal %d: %d", i, b.res.StatusCode)
		}
		b.send(wsframe.OpText, `{"type":"auth","csrf":"token"}`)
		open = append(open, b)
	}
	if b := dialTerminal(t, server, "browser", "https://host.test", shellQuery); b.res.StatusCode != 429 {
		t.Fatalf("over the cap: %d", b.res.StatusCode)
	}
	if b := dialTerminal(t, server, "other", "https://host.test", shellQuery); b.res.StatusCode != 101 {
		t.Fatalf("another session was capped: %d", b.res.StatusCode)
	}
	open[0].c.Close()
	var code int
	for deadline := time.Now().Add(3 * time.Second); time.Now().Before(deadline); time.Sleep(50 * time.Millisecond) {
		if code = dialTerminal(t, server, "browser", "https://host.test", shellQuery).res.StatusCode; code == 101 {
			break
		}
	}
	if code != 101 {
		t.Fatalf("closed terminal kept its place: %d", code)
	}
}
