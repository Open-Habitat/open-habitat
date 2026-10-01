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

	"github.com/maintainer/native-agent-host/internal/transport"
)

func TestPiStatusIsOnboardingOnly(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, err := strconv.Atoi(u.Uid)
	if err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42", Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock"}
	checks := 0
	status := func(context.Context) string { checks++; return "missing" }
	sh := PiStatusHandler(cfg, func(*http.Request) bool { return true }, status)
	r := httptest.NewRequest("GET", "http://unix/api/v1/onboarding/pi/status", nil)
	r.RequestURI = "/api/v1/onboarding/pi/status"
	r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
	r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
	w := httptest.NewRecorder()
	sh.ServeHTTP(w, r)
	if w.Code != 200 || checks != 1 || !strings.Contains(w.Body.String(), `"state":"missing"`) || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("status: %d %s", w.Code, w.Body.String())
	}
}
