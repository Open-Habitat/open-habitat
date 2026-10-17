//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/user"
	"strconv"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func repoFixtureConfig(t *testing.T) transport.Config {
	t.Helper()
	if os.Geteuid() == 0 {
		t.Skip("requires mapped unprivileged UID")
	}
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, _ := strconv.Atoi(u.Uid)
	return transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: "42"}
}

func repoGet(path string) *http.Request {
	r := httptest.NewRequest("GET", "http://unix"+path, nil)
	r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
	r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
	r.RequestURI = r.URL.RequestURI()
	return r
}

// nativeRow is a GitHub /user/repos object with the bulk GitHub really sends.
func nativeRow(owner, ownerType, name, pushed string) map[string]any {
	var p any
	if pushed != "" {
		p = pushed
	}
	return map[string]any{"owner": map[string]string{"login": owner, "type": ownerType}, "name": name, "full_name": owner + "/" + name, "html_url": "https://github.com/" + owner + "/" + name, "private": ownerType == "Organization", "description": nil, "pushed_at": p, "size": 2048, "default_branch": "main", "provider_metadata": strings.Repeat("x", 6500)}
}

// The suggestions used to come from the first alphabetical page only, so an
// organisation's repositories past it were never offered. The whole catalog
// is read, newest push first, and carries what the details pane shows.
func TestRepoCatalogReadsBeyondFirstPage(t *testing.T) {
	cfg := repoFixtureConfig(t)
	first := make([]map[string]any, 100)
	for i := range first {
		first[i] = nativeRow("alice", "User", fmt.Sprintf("own%03d", i), "2026-09-01T00:00:00Z")
	}
	second := []map[string]any{
		nativeRow("acme", "Organization", "monorepo", "2026-10-16T08:00:00Z"),
		first[3], // a push during the read moved it to this page as well
		nativeRow("dependabot", "Bot", "skipped", "2026-10-17T00:00:00Z"),
		nativeRow("alice", "User", "never-pushed", ""),
	}
	second[0]["description"] = "line one\nline two"
	pages := [][]map[string]any{first, second}
	var endpoints []string
	h := repoCatalogHandler(cfg, func(*http.Request) bool { return true }, func(_ context.Context, args ...string) ([]byte, error) {
		endpoint := args[len(args)-1]
		if endpoint == "/user" {
			return []byte(`{"id":42,"login":"alice"}`), nil
		}
		endpoints = append(endpoints, endpoint)
		raw, _ := json.Marshal(pages[len(endpoints)-1])
		return raw, nil
	})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, repoGet(RepoCatalogPath))
	var reply struct {
		Complete     bool       `json:"complete"`
		Repositories []repoItem `json:"repositories"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &reply) != nil || strings.Contains(w.Body.String(), "provider_metadata") || strings.Contains(w.Body.String(), "dependabot") {
		t.Fatalf("catalog: %d %s", w.Code, w.Body.String())
	}
	want := []string{
		"/user/repos?affiliation=owner%2Ccollaborator%2Corganization_member&per_page=100&page=1&sort=pushed&direction=desc",
		"/user/repos?affiliation=owner%2Ccollaborator%2Corganization_member&per_page=100&page=2&sort=pushed&direction=desc",
	}
	if strings.Join(endpoints, " ") != strings.Join(want, " ") {
		t.Fatalf("native reads %q", endpoints)
	}
	org := reply.Repositories[0]
	if !reply.Complete || len(reply.Repositories) != 102 || org.FullName != "acme/monorepo" || org.OwnerType != "Organization" || org.SizeKiB != 2048 || org.DefaultBranch == nil || *org.DefaultBranch != "main" || org.Description != "line one line two" {
		t.Fatalf("projection: complete=%v n=%d first=%+v", reply.Complete, len(reply.Repositories), org)
	}
	if last := reply.Repositories[len(reply.Repositories)-1]; last.FullName != "alice/never-pushed" || last.PushedAt != nil {
		t.Fatalf("never-pushed not last: %+v", last)
	}
}

func TestRepoCatalogBoundedAndRefusals(t *testing.T) {
	cfg := repoFixtureConfig(t)
	calls := 0
	page := 0
	full := func(_ context.Context, args ...string) ([]byte, error) {
		calls++
		if args[len(args)-1] == "/user" {
			return []byte(`{"id":42}`), nil
		}
		page++
		rows := make([]map[string]any, 100)
		for i := range rows {
			rows[i] = nativeRow("alice", "User", fmt.Sprintf("p%02dr%03d", page, i), "2026-09-01T00:00:00Z")
		}
		raw, _ := json.Marshal(rows)
		return raw, nil
	}
	w := httptest.NewRecorder()
	repoCatalogHandler(cfg, func(*http.Request) bool { return true }, full).ServeHTTP(w, repoGet(RepoCatalogPath))
	if w.Code != 200 || calls != 1+repoCatalogPages || !strings.Contains(w.Body.String(), `"complete":false`) || strings.Count(w.Body.String(), `"full_name"`) != 100*repoCatalogPages {
		t.Fatalf("bounded catalog: %d calls=%d", w.Code, calls)
	}
	ok := repoCatalogHandler(cfg, func(*http.Request) bool { return true }, full)
	for _, path := range []string{RepoCatalogPath + "?page=1&limit=50", RepoCatalogPath + "?owner=bob"} {
		w := httptest.NewRecorder()
		ok.ServeHTTP(w, repoGet(path))
		if w.Code != 400 {
			t.Fatalf("%s: %d", path, w.Code)
		}
	}
	for _, raw := range []string{`{`, `[{"owner":{"login":"org","type":"User"},"name":"x","full_name":"org/x","html_url":"https://evil.invalid","private":true,"size":1}]`, `[{"owner":{"login":"org","type":"User"},"name":"x","full_name":"org/x","html_url":"https://github.com/org/x","private":true}]`, `[{"owner":{"login":"org","type":"User"},"name":"x","full_name":"org/x","html_url":"https://github.com/org/x","private":true,"size":1,"pushed_at":"yesterday"}]`} {
		bad := repoCatalogHandler(cfg, func(*http.Request) bool { return true }, func(_ context.Context, args ...string) ([]byte, error) {
			if args[len(args)-1] == "/user" {
				return []byte(`{"id":42}`), nil
			}
			return []byte(raw), nil
		})
		w := httptest.NewRecorder()
		bad.ServeHTTP(w, repoGet(RepoCatalogPath))
		if w.Code != 503 || strings.Contains(w.Body.String(), "evil.invalid") {
			t.Fatalf("bad response: %d %s", w.Code, w.Body.String())
		}
	}
	missing := repoCatalogHandler(cfg, func(*http.Request) bool { return true }, func(context.Context, ...string) ([]byte, error) { return nil, errors.New("secret credential") })
	w = httptest.NewRecorder()
	missing.ServeHTTP(w, repoGet(RepoCatalogPath))
	if w.Code != 409 || strings.Contains(w.Body.String(), "credential") {
		t.Fatalf("auth: %d %s", w.Code, w.Body.String())
	}
}

// Jari searched the public raine/workmux and got nothing. An exact name is
// asked from GitHub with the user's own gh, and GitHub's 404 is a plain
// not-found answer; any other failure stays an error.
func TestRepoLookupExactName(t *testing.T) {
	cfg := repoFixtureConfig(t)
	found := `{"owner":{"login":"raine","type":"User"},"name":"workmux","full_name":"raine/workmux","html_url":"https://github.com/raine/workmux","private":false,"description":"tmux workspaces","pushed_at":"2026-10-01T10:00:00Z","size":321,"default_branch":"main"}`
	answer := func(status string, code int, body string) func(context.Context, ...string) ([]byte, error) {
		return func(_ context.Context, args ...string) ([]byte, error) {
			if args[len(args)-1] == "/user" {
				return []byte(`{"id":42}`), nil
			}
			if strings.Join(args, " ") != "api --include --method GET /repos/raine/workmux" {
				t.Fatalf("unexpected args %q", args)
			}
			out := []byte("HTTP/2.0 " + status + "\r\nContent-Type: application/json; charset=utf-8\r\nX-Github-Request-Id: fixture\r\n\r\n" + body)
			if code != 0 {
				return out, &nativeCommandExit{Code: code}
			}
			return out, nil
		}
	}
	path := RepoLookupPath + "?full_name=raine%2Fworkmux"
	for _, c := range []struct {
		name string
		run  func(context.Context, ...string) ([]byte, error)
		code int
		want string
	}{
		{"found", answer("200 OK", 0, found), 200, `"state":"found"`},
		{"not found", answer("404 Not Found", 1, `{"message":"Not Found"}`), 200, `"state":"not_found"`},
		{"server error", answer("502 Bad Gateway", 1, `{}`), 503, "native_source_unavailable"},
		{"refused", answer("403 Forbidden", 1, `{"message":"Resource protected by organization SAML enforcement"}`), 200, `"state":"not_found"`},
		{"200 with failure exit", answer("200 OK", 1, found), 503, "native_source_unavailable"},
		{"no network", func(_ context.Context, args ...string) ([]byte, error) {
			if args[len(args)-1] == "/user" {
				return []byte(`{"id":42}`), nil
			}
			return nil, errors.New("dial tcp: lookup api.github.com")
		}, 503, "native_source_unavailable"},
		{"foreign authorization", func(context.Context, ...string) ([]byte, error) { return []byte(`{"id":43}`), nil }, 409, "github_auth_unavailable"},
	} {
		w := httptest.NewRecorder()
		repoLookupHandler(cfg, func(*http.Request) bool { return true }, c.run).ServeHTTP(w, repoGet(path))
		if w.Code != c.code || !strings.Contains(w.Body.String(), c.want) || strings.Contains(w.Body.String(), "X-Github") {
			t.Fatalf("%s: %d %s", c.name, w.Code, w.Body.String())
		}
	}
	w := httptest.NewRecorder()
	repoLookupHandler(cfg, func(*http.Request) bool { return true }, answer("200 OK", 0, found)).ServeHTTP(w, repoGet(path))
	if !strings.Contains(w.Body.String(), `"repository":{"full_name":"raine/workmux","private":false,"description":"tmux workspaces","html_url":"https://github.com/raine/workmux","pushed_at":"2026-10-01T10:00:00Z","size_kib":321,"default_branch":"main","owner_type":"User"}`) {
		t.Fatalf("projection: %s", w.Body.String())
	}
	for _, bad := range []string{RepoLookupPath + "?full_name=raine/workmux", RepoLookupPath + "?full_name=raine%2F..", RepoLookupPath + "?full_name=raine%2Fworkmux&x=1"} {
		w := httptest.NewRecorder()
		repoLookupHandler(cfg, func(*http.Request) bool { return true }, answer("200 OK", 0, found)).ServeHTTP(w, repoGet(bad))
		if w.Code != 400 {
			t.Fatalf("%s: %d", bad, w.Code)
		}
	}
}
