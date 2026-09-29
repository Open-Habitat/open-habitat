//go:build linux

package daemon

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"os/user"
	"strconv"
	"strings"
	"testing"

	"github.com/maintainer/native-agent-host/internal/transport"
)

func TestRepoCatalogBoundedNativeProjection(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires mapped unprivileged UID")
	}
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, _ := strconv.Atoi(u.Uid)
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: "42"}
	calls := 0
	run := func(_ context.Context, args ...string) ([]byte, error) {
		calls++
		if strings.Join(args, " ") == "api --method GET /user" {
			return []byte(`{"id":42,"login":"alice"}`), nil
		}
		if strings.Join(args, " ") != "api --method GET /user/repos?affiliation=owner%2Ccollaborator%2Corganization_member&per_page=2&page=1&sort=full_name&direction=asc" {
			t.Fatalf("unexpected args: %q", args)
		}
		return []byte(`[{"owner":{"login":"org"},"name":"private","full_name":"org/private","html_url":"https://github.com/org/private","private":true,"description":"fixture","secret":"NEVER"},{"owner":{"login":"bob"},"name":"collab","full_name":"bob/collab","html_url":"https://github.com/bob/collab","private":false,"description":null}]`), nil
	}
	h := repoCatalogHandler(cfg, func(*http.Request) bool { return true }, run)
	req := httptest.NewRequest("GET", "http://unix"+RepoCatalogPath+"?page=1&limit=2", nil)
	req.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
	req.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
	req.RequestURI = req.URL.RequestURI()
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != 200 || calls != 2 || strings.Contains(w.Body.String(), "NEVER") || !strings.Contains(w.Body.String(), `"has_more":true`) || !strings.Contains(w.Body.String(), `"full_name":"org/private"`) || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("response %d %s calls=%d", w.Code, w.Body.String(), calls)
	}
	for _, path := range []string{RepoCatalogPath + "?page=0&limit=2", RepoCatalogPath + "?page=1&limit=2&owner=bob", RepoCatalogPath + "?page=1&limit=2&limit=3", RepoCatalogPath + "?limit=2&page=1"} {
		r := httptest.NewRequest("GET", "http://unix"+path, nil)
		r.Header = req.Header.Clone()
		r.RequestURI = r.URL.RequestURI()
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 400 {
			t.Fatalf("%s: %d", path, w.Code)
		}
	}
	r := req.Clone(context.Background())
	r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:43"))
	w = httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 403 || calls != 2 {
		t.Fatalf("forged identity: %d calls %d", w.Code, calls)
	}
	for _, raw := range []string{`{`, `[{"owner":{"login":"org"},"name":"private","full_name":"org/private","html_url":"https://evil.invalid","private":true}]`, `[{"owner":{"login":"org"},"name":"private","full_name":"org/private","html_url":"https://github.com/org/private"}]`} {
		bad := repoCatalogHandler(cfg, func(*http.Request) bool { return true }, func(_ context.Context, args ...string) ([]byte, error) {
			if len(args) == 4 {
				return []byte(`{"id":42}`), nil
			}
			return []byte(raw), nil
		})
		w := httptest.NewRecorder()
		bad.ServeHTTP(w, req)
		if w.Code != 503 || strings.Contains(w.Body.String(), "https://evil.invalid") {
			t.Fatalf("bad response: %d %s", w.Code, w.Body.String())
		}
	}
	missing := repoCatalogHandler(cfg, func(*http.Request) bool { return true }, func(context.Context, ...string) ([]byte, error) { return nil, errors.New("secret credential") })
	w = httptest.NewRecorder()
	missing.ServeHTTP(w, req)
	if w.Code != 409 || strings.Contains(w.Body.String(), "credential") {
		t.Fatalf("auth: %d %s", w.Code, w.Body.String())
	}
}
