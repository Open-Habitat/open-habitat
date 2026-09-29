//go:build linux

package daemon

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/maintainer/native-agent-host/internal/transport"
)

// A real subprocess, but only a disposable synthetic gh fixture and credential.
func TestRepoCatalogSyntheticGHProcess(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires unprivileged mapped UID")
	}
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	uid, _ := strconv.Atoi(u.Uid)
	base := t.TempDir()
	program := filepath.Join(base, "gh")
	script := `#!/bin/sh
[ "$GH_PROMPT_DISABLED" = 1 ] || exit 9
[ -z "$GH_TOKEN" ] || exit 9
[ "$1" = api ] && [ "$2" = --method ] && [ "$3" = GET ] || exit 9
id=$(cat "$HOME/fixture-id") || exit 9
case "$4" in
/user) printf '{"id":%s,"login":"synthetic"}\n' "$id" ;;
/user/repos?*) printf '[{"owner":{"login":"org"},"name":"fixture%s","full_name":"org/fixture%s","html_url":"https://github.com/org/fixture%s","private":true,"pushed_at":null,"description":null}]\n' "$id" "$id" "$id" ;;
*) exit 9 ;;
esac
`
	if e := os.WriteFile(program, []byte(script), 0700); e != nil {
		t.Fatal(e)
	}
	for _, id := range []string{"42", "43"} {
		home := filepath.Join(base, "home"+id)
		if e := os.Mkdir(home, 0700); e != nil {
			t.Fatal(e)
		}
		if e := os.WriteFile(filepath.Join(home, "fixture-id"), []byte(id), 0600); e != nil {
			t.Fatal(e)
		}
		cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: id}
		run := func(ctx context.Context, args ...string) ([]byte, error) {
			return runRepoGHProgram(ctx, home, program, args...)
		}
		// Fixture home differs from the account home on purpose. The real daemon
		// obtains its validated cfg.Home from the broker, never from a request.
		h := repoCatalogHandler(cfg, func(*http.Request) bool { return true }, run)
		r := httptest.NewRequest("GET", "http://unix"+RepoCatalogPath+"?page=1&limit=2", nil)
		r.RequestURI = r.URL.RequestURI()
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:"+id))
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user "+id)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 200 || !strings.Contains(w.Body.String(), "org/fixture"+id) || strings.Contains(w.Body.String(), "org/fixture"+map[string]string{"42": "43", "43": "42"}[id]) {
			t.Fatalf("fixture %s: %d %s", id, w.Code, w.Body.String())
		}
	}
}
