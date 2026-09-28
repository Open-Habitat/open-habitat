//go:build linux

package daemon

import (
	"net/http"
	"net/http/httptest"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
)

func TestPiAttemptSessionOwnershipAndRestart(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires unprivileged UID")
	}
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	node := filepath.Join(home, "fake-node")
	script := `#!/bin/sh
case "$6" in
 status) printf '%s\n' '{"type":"status","state":"missing"}' ;;
 login) printf '%s\n' '{"type":"device_code","verificationUri":"https://auth.openai.com/codex/device","userCode":"ABCD-1234"}'; sleep 1; printf '%s\n' '{"type":"unknown"}' ;;
esac
`
	if err := os.WriteFile(node, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	p := &PiDevice{Home: home, Node: node, Entry: "/synthetic/entry", Manifest: "/synthetic/manifest"}
	cfg := transport.Config{GatewayUID: os.Geteuid(), UID: os.Geteuid(), Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "123", Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock"}
	if err := transport.ValidateConfig(cfg); err != nil {
		t.Fatalf("invalid synthetic route: %v (%+v)", err, cfg)
	}
	a := &piAttempt{device: p}
	request := func(h http.Handler, method, token string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://unix/api/v1/onboarding/pi/attempt", nil)
		r.RequestURI = "/api/v1/onboarding/pi/attempt"
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:123"))
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 123")
		r.Header.Set("X-Agent-Host-Session", token)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	token := strings.Repeat("A", 43)
	other := strings.Repeat("B", 43)
	h := a.handler(cfg, func(*http.Request) bool { return true })
	if w := request(h, "POST", token); w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("start: %d %s", w.Code, w.Body.String())
	}
	if w := request(h, "GET", other); w.Code != 404 {
		t.Fatalf("foreign status: %d", w.Code)
	}
	if w := request(h, "DELETE", other); w.Code != 404 {
		t.Fatalf("foreign cancel: %d", w.Code)
	}
	if w := request(h, "POST", other); w.Code != 409 {
		t.Fatalf("foreign start: %d", w.Code)
	}
	if w := request(h, "GET", token); w.Code != 200 || strings.Contains(w.Body.String(), "SYNTHETIC-REFRESH-SECRET") {
		t.Fatalf("owner status: %d %s", w.Code, w.Body.String())
	}
	if w := request((&piAttempt{device: p}).handler(cfg, func(*http.Request) bool { return true }), "GET", token); w.Code != 404 {
		t.Fatalf("restart: %d", w.Code)
	}
	if w := request(h, "DELETE", token); w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"unknown"`) {
		t.Fatalf("cancel: %d %s", w.Code, w.Body.String())
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		a.mu.Lock()
		done := a.done
		a.mu.Unlock()
		if done {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("native child did not terminate")
		}
		time.Sleep(time.Millisecond)
	}
	if w := request(h, "POST", other); w.Code != 409 {
		t.Fatalf("foreign clobber after reaping: %d %s", w.Code, w.Body.String())
	}
	if w := request(h, "GET", token); w.Code != 200 {
		t.Fatalf("owner result lost after reaping: %d", w.Code)
	}
	if w := request(h, "POST", token); w.Code != 200 {
		t.Fatalf("owner retry after reaping: %d %s", w.Code, w.Body.String())
	}
}
