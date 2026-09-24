//go:build linux

package transport

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/maintainer/native-agent-host/internal/gateway"
)

func shortDir(t *testing.T) string {
	t.Helper()
	d, e := os.MkdirTemp("/tmp", "nah-uds-")
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { _ = os.RemoveAll(d) })
	return d
}
func fixture(t *testing.T) (*Server, *net.UnixListener, gateway.Identity, *atomic.Int32) {
	t.Helper()
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(shortDir(t), "sock")
	ln, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { _ = ln.Close() })
	cfg := Config{GatewayUID: os.Getuid(), UID: os.Geteuid(), Username: u.Username, Home: u.HomeDir, Socket: path, Provider: "github", Subject: "42"}
	calls := new(atomic.Int32)
	s, e := newServer(cfg, func(_ context.Context, token string) error {
		if token != "sentinel-secret" {
			t.Error("unexpected token")
		}
		calls.Add(1)
		return nil
	}, true)
	if e != nil {
		t.Fatal(e)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = s.Serve(ctx, ln) }()
	return s, ln, gateway.Identity{Provider: "github", Subject: "42", UID: cfg.UID, Username: cfg.Username, Socket: path}, calls
}
func raw(t *testing.T, path, method, uri, headers string, body []byte) int {
	t.Helper()
	c, e := net.Dial("unix", path)
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	_ = c.SetDeadline(time.Now().Add(time.Second))
	_, e = fmt.Fprintf(c, "%s %s HTTP/1.1\r\nHost: unix\r\n%s\r\n", method, uri, headers)
	if e != nil {
		t.Fatal(e)
	}
	_, _ = c.Write(body)
	res, e := http.ReadResponse(bufio.NewReader(c), nil)
	if e != nil {
		return 0
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 1024))
	return res.StatusCode
}
func payload(m gateway.Identity, nonce string) []byte {
	b, _ := json.Marshal(request{1, nonce, "github", "42", m.UID, m.Username, "sentinel-secret"})
	return b
}
func send(t *testing.T, m gateway.Identity, b []byte) int {
	t.Helper()
	return raw(t, m.Socket, "POST", Path, fmt.Sprintf("Content-Type: application/json\r\nContent-Length: %d\r\n", len(b)), b)
}
func TestJITBindingFailsClosedWithoutRootOwnedConfig(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, err := strconv.Atoi(u.Uid)
	if err != nil {
		t.Fatal(err)
	}
	cfg := Config{GatewayUID: uid, UID: os.Geteuid(), Username: u.Username, Home: u.HomeDir, Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: "42", BindingFile: "/etc/native-agent-host/daemon-" + u.Username + ".json"}
	if validate(cfg, false) == nil {
		t.Fatal("accepted absent or untrusted binding")
	}
	cfg.BindingFile = "/tmp/daemon-" + u.Username + ".json"
	if validate(cfg, false) == nil {
		t.Fatal("accepted untrusted binding path")
	}
}

func TestHandoffAndRejections(t *testing.T) {
	_, _, m, calls := fixture(t)
	sink := Sink{testPath: true}
	if e := sink.Deliver(context.Background(), m, "42", "sentinel-secret"); e != nil {
		t.Fatal(e)
	}
	if calls.Load() != 1 {
		t.Fatal(calls.Load())
	}
	m.Subject = "43"
	if sink.Deliver(context.Background(), m, "42", "sentinel-secret") == nil {
		t.Fatal("mapping accepted")
	}
	m.Subject = "42"
	m.UID++
	if sink.Deliver(context.Background(), m, "42", "sentinel-secret") == nil {
		t.Fatal("target accepted")
	}
	m.UID--
	b := payload(m, strings.Repeat("a", 32))
	if got := send(t, m, b); got != 204 {
		t.Fatalf("status %d", got)
	}
	if got := send(t, m, b); got == 204 {
		t.Fatal("replay accepted")
	}
	for _, bad := range [][]byte{b[:len(b)-1], append(append([]byte{}, b...), byte('x')), []byte(`{"version":1}`), bytes.Replace(b, []byte(`"version":1`), []byte(`"version":2`), 1), bytes.Replace(b, []byte(`"version":1`), []byte(`"version":1,"version":1`), 1), bytes.Replace(b, []byte(`"token":`), []byte(`"extra":1,"token":`), 1), bytes.Replace(b, []byte(`"subject":"42"`), []byte(`"subject":"43"`), 1), bytes.Replace(b, []byte(`"uid":`+strconv.Itoa(m.UID)), []byte(`"uid":`+strconv.Itoa(m.UID+1)), 1)} {
		if got := send(t, m, bad); got == 204 {
			t.Fatalf("invalid accepted: %s", bad)
		}
	}
	for _, tc := range []struct{ method, uri, headers string }{{"GET", Path, ""}, {"POST", Path + "?x=1", ""}, {"POST", Path + "/", ""}, {"POST", Path, "Content-Type: text/plain\r\n"}, {"POST", Path, "Content-Type: application/json\r\nContent-Type: application/json\r\n"}, {"POST", Path, "Content-Type: application/json\r\nTransfer-Encoding: chunked\r\n"}} {
		headers := tc.headers
		if !strings.Contains(headers, "Transfer-Encoding") {
			headers += fmt.Sprintf("Content-Length: %d\r\n", len(b))
		}
		if got := raw(t, m.Socket, tc.method, tc.uri, headers, b); got == 204 {
			t.Fatalf("accepted %s %s %s", tc.method, tc.uri, headers)
		}
	}
	if got := raw(t, m.Socket, "POST", Path, fmt.Sprintf("Content-Type: application/json\r\nContent-Length: %d\r\n", maxBody+1), nil); got == 204 {
		t.Fatal("oversize accepted")
	}
	if calls.Load() != 2 {
		t.Fatal("bad input consumed", calls.Load())
	}
}
func TestOneDialAndRedaction(t *testing.T) {
	var attempts int
	sink := Sink{testPath: true, dial: func(context.Context, string) (net.Conn, error) { attempts++; return nil, io.ErrUnexpectedEOF }}
	m := gateway.Identity{Provider: "github", Subject: "42", UID: os.Geteuid(), Username: "user", Socket: filepath.Join(t.TempDir(), "missing")}
	for i := 0; i < 2; i++ {
		e := sink.Deliver(context.Background(), m, "42", "sentinel-secret")
		if e == nil || strings.Contains(e.Error(), "sentinel-secret") {
			t.Fatal(e)
		}
	}
	if attempts != 2 {
		t.Fatal(attempts)
	}
}
func TestPartialRequestDeadline(t *testing.T) {
	_, _, m, calls := fixture(t)
	c, e := net.Dial("unix", m.Socket)
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	_, _ = io.WriteString(c, "POST "+Path+" HTTP/1.1\r\nHost: unix\r\nContent-Length: 100\r\nContent-Type: application/json\r\n\r\n{")
	_ = c.SetReadDeadline(time.Now().Add(20 * time.Millisecond))
	var buf [1]byte
	_, e = c.Read(buf[:])
	if ne, ok := e.(net.Error); !ok || !ne.Timeout() {
		t.Fatalf("expected deadline: %v", e)
	}
	if calls.Load() != 0 {
		t.Fatal("partial consumed")
	}
}

func TestConsumerFailureReplayAndCapacity(t *testing.T) {
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(shortDir(t), "sock")
	ln, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	cfg := Config{GatewayUID: os.Getuid(), UID: os.Geteuid(), Username: u.Username, Home: u.HomeDir, Socket: path, Provider: "github", Subject: "42"}
	calls := new(atomic.Int32)
	s, e := newServer(cfg, func(context.Context, string) error { calls.Add(1); return fmt.Errorf("sentinel-secret native failure") }, true)
	if e != nil {
		t.Fatal(e)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() { _ = s.Serve(ctx, ln) }()
	m := gateway.Identity{Provider: "github", Subject: "42", UID: cfg.UID, Username: cfg.Username, Socket: path}
	b := payload(m, strings.Repeat("b", 32))
	if got := send(t, m, b); got == 204 {
		t.Fatal("consumer failed")
	}
	if got := send(t, m, b); got == 204 {
		t.Fatal("replayed failure")
	}
	if calls.Load() != 1 {
		t.Fatal(calls.Load())
	}
	s.mu.Lock()
	for len(s.seen) < 4096 {
		s.seen[fmt.Sprintf("%032x", len(s.seen))] = struct{}{}
	}
	s.mu.Unlock()
	if got := send(t, m, payload(m, strings.Repeat("c", 32))); got == 204 || calls.Load() != 1 {
		t.Fatal("capacity failed open")
	}
}
func TestForgedPeerHeaderAndFraming(t *testing.T) {
	_, _, m, calls := fixture(t)
	b := payload(m, strings.Repeat("d", 32))
	base := fmt.Sprintf("Content-Type: application/json\r\nContent-Length: %d\r\nX-Agent-Host-Identity: forged\r\n", len(b))
	for _, h := range []string{"Content-Type: application/json\r\nTransfer-Encoding: chunked\r\nContent-Length: 0\r\n", base + fmt.Sprintf("Content-Length: %d\r\n", len(b)), "Content-Type: application/json\r\nContent-Length: 0\r\n"} {
		if raw(t, m.Socket, "POST", Path, h, b) == 204 {
			t.Fatalf("ambiguous framing accepted: %q", h)
		}
	}
	if calls.Load() != 0 {
		t.Fatal("forged header consumed")
	}
}
func TestSuccessResponseMustEnd(t *testing.T) {
	_, _, m, _ := fixture(t)
	// One dial, but a malicious same-UID peer sends a second response after 204.
	sink := Sink{testPath: true, dial: func(ctx context.Context, _ string) (net.Conn, error) {
		client, server := net.Pipe()
		go func() {
			defer server.Close()
			_, _ = io.Copy(io.Discard, io.LimitReader(server, 2048))
			_, _ = io.WriteString(server, "HTTP/1.1 204 No Content\r\n\r\nHTTP/1.1 204 No Content\r\n\r\n")
		}()
		return client, nil
	}}
	// A non-Unix injected connection cannot provide kernel credentials.
	if sink.Deliver(context.Background(), m, "42", "sentinel-secret") == nil {
		t.Fatal("non-Unix peer accepted")
	}
}
func TestResponseBoundsAndExactSuccess(t *testing.T) {
	_, _, m, _ := fixture(t)
	for _, reply := range []string{
		"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n",
		"HTTP/1.1 302 Found\r\nLocation: http://example.com/\r\nContent-Length: 0\r\n\r\n",
		"HTTP/1.1 204 No Content\r\n\r\nHTTP/1.1 204 No Content\r\n\r\n",
		"HTTP/1.1 204 No Content\r\nX-Pad: " + strings.Repeat("x", maxHeaders+1024) + "\r\n\r\n",
	} {
		path := filepath.Join(shortDir(t), "fake")
		ln, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
		if e != nil {
			t.Fatal(e)
		}
		done := make(chan struct{})
		go func() {
			defer close(done)
			c, e := ln.AcceptUnix()
			if e != nil {
				return
			}
			defer c.Close()
			_ = c.SetDeadline(time.Now().Add(time.Second))
			r, e := http.ReadRequest(bufio.NewReader(c))
			if e != nil {
				return
			}
			_, _ = io.Copy(io.Discard, r.Body)
			_ = r.Body.Close()
			_, _ = io.WriteString(c, reply)
		}()
		sink := Sink{testPath: true, dial: func(ctx context.Context, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", path)
		}}
		if e := sink.Deliver(context.Background(), m, "42", "sentinel-secret"); e == nil || strings.Contains(e.Error(), "sentinel-secret") {
			t.Fatalf("response accepted or leaked: %q", reply[:20])
		}
		_ = ln.Close()
		<-done
	}
}
