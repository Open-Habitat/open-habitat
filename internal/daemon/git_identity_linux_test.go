//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGitIdentityFreshAndNeverOverwrite(t *testing.T) {
	cfg, home := cloneFixture(t)
	cfg.Home = home
	gh := func(_ context.Context, args ...string) ([]byte, error) {
		if strings.Contains(args[len(args)-1], "emails") {
			return []byte(`[{"email":"alice@example.invalid","verified":true},{"email":"unverified@example.invalid","verified":false}]`), nil
		}
		return []byte(`{"id":42,"login":"alice","name":"Alice Example"}`), nil
	}
	git := func(ctx context.Context, args ...string) ([]byte, error) {
		return runIdentityGit(ctx, home, "/usr/bin/git", args...)
	}
	h := gitIdentityHandler(cfg, func(*http.Request) bool { return true }, gh, git)
	request := func(method, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://unix"+GitIdentityPath, strings.NewReader(body))
		r.RequestURI = GitIdentityPath
		if method == "POST" {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	w := request("GET", "")
	if w.Code != 200 {
		t.Fatalf("get: %d %s", w.Code, w.Body)
	}
	var initial gitIdentity
	if err := json.Unmarshal(w.Body.Bytes(), &initial); err != nil {
		t.Fatal(err)
	}
	if initial.SuggestedName != "Alice Example" || initial.SuggestedEmail != "42+alice@users.noreply.github.com" || len(initial.Emails) != 2 {
		t.Fatalf("suggestions: %+v", initial)
	}
	w = request("POST", `{"name":"Alice Example","email":"42+alice@users.noreply.github.com","mode":"onboarding"}`)
	if w.Code != 200 {
		t.Fatalf("write: %d %s", w.Code, w.Body)
	}
	n, e := gitValue(context.Background(), git, "user.name")
	if e != nil || n != "Alice Example" {
		t.Fatalf("git name: %q %v", n, e)
	}
	m, e := gitValue(context.Background(), git, "user.email")
	if e != nil || m != initial.SuggestedEmail {
		t.Fatalf("git email: %q %v", m, e)
	}
	w = request("POST", `{"name":"Other","email":"alice@example.invalid","mode":"onboarding"}`)
	if w.Code != 409 {
		t.Fatalf("overwrite: %d", w.Code)
	}
	n, _ = gitValue(context.Background(), git, "user.name")
	if n != "Alice Example" {
		t.Fatal("overwritten")
	}
	w = request("POST", `{"name":"Alice Edited","email":"alice@example.invalid","mode":"settings"}`)
	if w.Code != 200 {
		t.Fatalf("settings: %d %s", w.Code, w.Body)
	}
	if _, e := os.Stat(filepath.Join(home, ".gitconfig")); e != nil {
		t.Fatal(e)
	}
	n, _ = gitValue(context.Background(), git, "user.name")
	if n != "Alice Edited" {
		t.Fatalf("settings name: %q", n)
	}
}
