//go:build linux

package transport

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"io"
	"net"
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
	t.Cleanup(func() { ln.Close() })
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
func raw(t *testing.T, path string, body []byte, length uint32) []byte {
	t.Helper()
	c, e := net.Dial("unix", path)
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	_ = c.SetDeadline(time.Now().Add(time.Second))
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], length)
	_, _ = c.Write(header[:])
	if len(body) > 0 {
		_, _ = c.Write(body)
	}
	_ = c.(*net.UnixConn).CloseWrite()
	response, _ := io.ReadAll(c)
	return response
}
func TestHandoffAndRejections(t *testing.T) {
	_, _, m, calls := fixture(t)
	sink := Sink{testPath: true}
	if e := sink.Deliver(context.Background(), m, m.Subject, "sentinel-secret"); e != nil {
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
	r := request{Version: 1, Nonce: strings.Repeat("a", 32), Provider: "github", Subject: "42", UID: m.UID, Username: m.Username, Token: "sentinel-secret"}
	b, _ := json.Marshal(r)
	if got := raw(t, m.Socket, b, uint32(len(b))); !bytes.Equal(got, []byte{1}) {
		t.Fatalf("response %x", got)
	}
	if got := raw(t, m.Socket, b, uint32(len(b))); len(got) != 0 {
		t.Fatal("replay accepted")
	}
	if calls.Load() != 2 {
		t.Fatal(calls.Load())
	}
	for _, bad := range [][]byte{b[:len(b)-1], append(append([]byte{}, b...), byte('x')), []byte(`{"version":1}`), bytes.Replace(b, []byte(`"version":1`), []byte(`"version":2`), 1), bytes.Replace(b, []byte(`"version":1`), []byte(`"version":1,"version":1`), 1), bytes.Replace(b, []byte(`"token":`), []byte(`"extra":1,"token":`), 1), bytes.Replace(b, []byte(`"subject":"42"`), []byte(`"subject":"43"`), 1), bytes.Replace(b, []byte(`"uid":`+strconv.Itoa(m.UID)), []byte(`"uid":`+strconv.Itoa(m.UID+1)), 1)} {
		if got := raw(t, m.Socket, bad, uint32(len(bad))); len(got) != 0 {
			t.Fatalf("invalid accepted: %x", got)
		}
	}
	if got := raw(t, m.Socket, b[:len(b)-1], uint32(len(b))); len(got) != 0 {
		t.Fatal("truncation accepted")
	}
	if got := raw(t, m.Socket, nil, maxFrame+1); len(got) != 0 {
		t.Fatal("oversize accepted")
	}
	if calls.Load() != 2 {
		t.Fatal("bad input consumed")
	}
}
func TestOneDialAndRedaction(t *testing.T) {
	var attempts int
	sentinel := "sentinel-secret"
	sink := Sink{testPath: true, dial: func(context.Context, string) (net.Conn, error) { attempts++; return nil, io.ErrUnexpectedEOF }}
	m := gateway.Identity{Provider: "github", Subject: "42", UID: os.Geteuid(), Username: "user", Socket: filepath.Join(t.TempDir(), "missing")}
	for i := 0; i < 2; i++ {
		e := sink.Deliver(context.Background(), m, "42", sentinel)
		if e == nil || strings.Contains(e.Error(), sentinel) {
			t.Fatal(e)
		}
	}
	if attempts != 2 {
		t.Fatal(attempts)
	}
}
func TestIdentityAndTimeout(t *testing.T) {
	_, _, m, calls := fixture(t)
	c, e := net.Dial("unix", m.Socket)
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	var size [4]byte
	binary.BigEndian.PutUint32(size[:], 100)
	_, _ = c.Write(size[:])
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
