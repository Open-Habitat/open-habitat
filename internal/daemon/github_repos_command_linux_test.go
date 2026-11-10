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

	"github.com/open-habitat/open-habitat/internal/transport"
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
if [ "$1 $2 $3 $4 $5" = "api --include --method GET /repos/raine/workmux" ]; then
  printf 'HTTP/2.0 404 Not Found\r\nContent-Type: application/json\r\n\r\n{"message":"Not Found"}'
  echo 'gh: Not Found (HTTP 404)' >&2
  exit 1
fi
[ "$1" = api ] && [ "$2" = --method ] && [ "$3" = GET ] || exit 9
id=$(cat "$HOME/fixture-id") || exit 9
case "$4" in
/user) printf '{"id":%s,"login":"synthetic"}\n' "$id" ;;
/user/repos?*) printf '[{"name":"fixture%s","full_name":"org/fixture%s","html_url":"https://github.com/org/fixture%s","private":true,"pushed_at":null,"description":null,"size":3,"default_branch":"main","owner":{"login":"org","type":"Organization"}}]\n' "$id" "$id" "$id" ;;
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
		cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: id}
		run := func(ctx context.Context, args ...string) ([]byte, error) {
			return runRepoGHProgram(ctx, home, program, args...)
		}
		// Fixture home differs from the account home on purpose. The real daemon
		// obtains its validated cfg.Home from the broker, never from a request.
		h := repoCatalogHandler(cfg, func(*http.Request) bool { return true }, run)
		r := httptest.NewRequest("GET", "http://unix"+RepoCatalogPath, nil)
		r.RequestURI = r.URL.RequestURI()
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:"+id))
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user "+id)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 200 || !strings.Contains(w.Body.String(), "org/fixture"+id) || strings.Contains(w.Body.String(), "org/fixture"+map[string]string{"42": "43", "43": "42"}[id]) {
			t.Fatalf("fixture %s: %d %s", id, w.Code, w.Body.String())
		}
		// gh exits 1 on GitHub's 404; its included status still reaches the lookup.
		lookup := repoLookupHandler(cfg, func(*http.Request) bool { return true }, run)
		r = httptest.NewRequest("GET", "http://unix"+RepoLookupPath+"?full_name=raine%2Fworkmux", nil)
		r.RequestURI = r.URL.RequestURI()
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:"+id))
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user "+id)
		w = httptest.NewRecorder()
		lookup.ServeHTTP(w, r)
		if w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"not_found"`) {
			t.Fatalf("lookup %s: %d %s", id, w.Code, w.Body.String())
		}
	}
}
