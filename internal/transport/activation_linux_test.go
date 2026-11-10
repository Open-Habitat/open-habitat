//go:build linux

package transport

import (
	"context"
	"github.com/open-habitat/open-habitat/internal/gateway"
	"io"
	"net"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSocketReplacementRejected(t *testing.T) {
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(shortDir(t), "sock")
	first, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if e != nil {
		t.Fatal(e)
	}
	defer first.Close()
	first.SetUnlinkOnClose(false)
	cfg := Config{GatewayUID: os.Getuid(), UID: os.Geteuid(), Username: u.Username, Home: u.HomeDir, Socket: path, Provider: "github", Subject: "42"}
	if e = checkListener(cfg, first, true, true); e != nil {
		t.Fatal(e)
	}
	if e = os.Remove(path); e != nil {
		t.Fatal(e)
	}
	second, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if e != nil {
		t.Fatal(e)
	}
	defer second.Close()
	if checkListener(cfg, first, true, true) == nil {
		t.Fatal("replaced path accepted")
	}
}

func TestSharedHTTPHealthAndHandoff(t *testing.T) {
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
	count := 0
	server, e := newServer(cfg, func(_ context.Context, token string, _ bool) (bool, error) {
		if token != "sentinel-secret" {
			t.Error("wrong token")
		}
		count++
		return false, nil
	}, true)
	if e != nil {
		t.Fatal(e)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { _, _ = io.WriteString(w, `{"status":"ok"}`) })
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- server.ServeMux(ctx, ln, mux) }()
	client := &http.Client{Transport: &http.Transport{DialContext: func(_ context.Context, _, _ string) (net.Conn, error) { return net.Dial("unix", path) }}}
	req, e := http.NewRequest("GET", "http://unix/healthz", nil)
	if e != nil {
		t.Fatal(e)
	}
	res, e := client.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	b, e := io.ReadAll(res.Body)
	_ = res.Body.Close()
	if e != nil || res.StatusCode != 200 || strings.Contains(string(b), "sentinel-secret") {
		t.Fatalf("health status %d", res.StatusCode)
	}
	m := gateway.Identity{Provider: cfg.Provider, Subject: cfg.Subject, UID: cfg.UID, Username: cfg.Username, Socket: path}
	if got := send(t, m, payload(m, strings.Repeat("a", 32))); got != 200 {
		t.Fatalf("handoff status %d", got)
	}
	if count != 1 {
		t.Fatalf("consumed %d", count)
	}
	cancel()
	select {
	case e := <-done:
		if e != nil {
			t.Fatal(e)
		}
	case <-time.After(7 * time.Second):
		t.Fatal("shutdown hung")
	}
}
