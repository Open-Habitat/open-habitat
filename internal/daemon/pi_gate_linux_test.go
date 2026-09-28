//go:build linux

package daemon

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os/user"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
)

func TestPiGateBlocksBeforeNativeRead(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, err := strconv.Atoi(u.Uid)
	if err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42", Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock"}
	calls, checks := 0, 0
	state := "missing"
	status := func(context.Context) string { checks++; return state }
	native := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = w.Write([]byte("private-workspace-name"))
	})
	h := piGate(cfg, func(*http.Request) bool { return true }, status, native)
	request := func(id string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
		r.Header.Set("X-Agent-Host-Identity", id)
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := request(opaque("wid_", "github:other")); w.Code != 403 || calls != 0 || checks != 0 {
		t.Fatalf("cross user: %d %d %d", w.Code, calls, checks)
	}
	for _, s := range []string{"missing", "unknown", "unavailable"} {
		state = s
		w := request(opaque("wid_", "github:42"))
		if w.Code != 428 || calls != 0 || strings.Contains(w.Body.String(), "private-workspace-name") {
			t.Fatalf("%s: %d %s", s, w.Code, w.Body.String())
		}
	}
	state = "usable"
	if w := request(opaque("wid_", "github:42")); w.Code != 200 || calls != 1 {
		t.Fatalf("usable: %d %d", w.Code, calls)
	}
	state = "missing" // native logout or refresh failure is never cached
	if w := request(opaque("wid_", "github:42")); w.Code != 428 || calls != 1 || checks != 5 {
		t.Fatalf("stale tab: %d %d %d", w.Code, calls, checks)
	}
	// A slow native refresh cannot hold the handler past its request budget.
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	slow := piGate(cfg, func(*http.Request) bool { return true }, func(ctx context.Context) string { <-ctx.Done(); return "unknown" }, native)
	sr := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil).WithContext(ctx)
	sr.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
	sr.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
	sw := httptest.NewRecorder()
	slow.ServeHTTP(sw, sr)
	if sw.Code != 428 || calls != 1 {
		t.Fatalf("canceled: %d native calls=%d", sw.Code, calls)
	}
	sh := PiStatusHandler(cfg, func(*http.Request) bool { return true }, status)
	r := httptest.NewRequest("GET", "http://unix/api/v1/onboarding/pi/status", nil)
	r.RequestURI = "/api/v1/onboarding/pi/status"
	r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
	r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
	w := httptest.NewRecorder()
	sh.ServeHTTP(w, r)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"missing"`) || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("status: %d %s", w.Code, w.Body.String())
	}
}
