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
	// Even with an XDG Git config present, this flow targets ~/.gitconfig.
	xdg := filepath.Join(home, ".config", "git")
	if err := os.MkdirAll(xdg, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(xdg, "config"), []byte("[core]\n\teditor = vi\n"), 0600); err != nil {
		t.Fatal(err)
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
	// A long-running clone holds the ~/src writer for its whole transfer. It
	// must block neither reading nor confirming the Git identity: onboarding
	// asks for the identity while the site's default repositories clone.
	if !cloneWriter.TryLock("workspace_clone_running") {
		t.Fatal("clone lock busy")
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
	w = request("POST", `{"name":"Alice Example","email":"typed@example.invalid","mode":"onboarding"}`)
	cloneWriter.Unlock()
	if w.Code != 200 {
		t.Fatalf("write during a clone: %d %s", w.Code, w.Body)
	}
	n, e := gitValue(context.Background(), git, "user.name")
	if e != nil || n != "Alice Example" {
		t.Fatalf("git name: %q %v", n, e)
	}
	m, e := gitValue(context.Background(), git, "user.email")
	if e != nil || m != "typed@example.invalid" {
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
	contents, e := os.ReadFile(filepath.Join(xdg, "config"))
	if e != nil || !strings.Contains(string(contents), "editor = vi") || strings.Contains(string(contents), "Alice") {
		t.Fatalf("XDG config changed: %q %v", contents, e)
	}
	n, _ = gitValue(context.Background(), git, "user.name")
	if n != "Alice Edited" {
		t.Fatalf("settings name: %q", n)
	}
	// Identity writes still exclude each other: the onboarding check and its
	// write must not interleave with another write.
	gitIdentityWriter.Lock()
	w = request("POST", `{"name":"Other","email":"alice@example.invalid","mode":"settings"}`)
	gitIdentityWriter.Unlock()
	if w.Code != 409 || !strings.Contains(w.Body.String(), "workspace_identity_running") {
		t.Fatalf("concurrent write: %d %s", w.Code, w.Body)
	}
}

func TestGitIdentityXDGExistingIsNotShadowedByOnboarding(t *testing.T) {
	cfg, home := cloneFixture(t)
	cfg.Home = home
	dir := filepath.Join(home, ".config", "git")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "config"), []byte("[user]\n\tname = XDG Person\n\temail = xdg@example.invalid\n"), 0600); err != nil {
		t.Fatal(err)
	}
	gh := func(context.Context, ...string) ([]byte, error) {
		return []byte(`{"id":42,"login":"alice","name":"Alice"}`), nil
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
		t.Fatalf("GET: %d %s", w.Code, w.Body)
	}
	var initial gitIdentity
	if err := json.Unmarshal(w.Body.Bytes(), &initial); err != nil {
		t.Fatal(err)
	}
	if initial.Name != "XDG Person" || initial.Email != "xdg@example.invalid" || initial.Source != "~/.config/git/config" {
		t.Fatalf("existing identity: %+v", initial)
	}
	w = request("POST", `{"name":"Alice","email":"42+alice@users.noreply.github.com","mode":"onboarding"}`)
	if w.Code != 409 {
		t.Fatalf("existing XDG overwritten: %d %s", w.Code, w.Body)
	}
	if _, err := os.Stat(filepath.Join(home, ".gitconfig")); !os.IsNotExist(err) {
		t.Fatalf("created override for existing XDG identity: %v", err)
	}
}
