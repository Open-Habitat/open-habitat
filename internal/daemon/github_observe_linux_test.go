//go:build linux

package daemon

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestObserveCheckoutReadOnly(t *testing.T) {
	cfg, home := cloneFixture(t)
	run := func(_ context.Context, _, _, _ string, args ...string) ([]byte, error) {
		if args[len(args)-1] == "HEAD^{commit}" {
			return []byte("0123456789abcdef0123456789abcdef01234567\n"), nil
		}
		if args[len(args)-1] == "--is-inside-work-tree" {
			return []byte("true\n"), nil
		}
		if args[len(args)-1] == "--porcelain" {
			return nil, nil
		}
		return []byte("https://github.com/alice/repo.git\n"), nil
	}
	check := func(want string) {
		t.Helper()
		if got := observeCheckout(context.Background(), cfg, home, "git", run, "alice/repo"); got != want {
			t.Fatalf("want %s got %s", want, got)
		}
	}
	check("absent")
	if _, e := os.Stat(filepath.Join(home, "src")); !os.IsNotExist(e) {
		t.Fatalf("observation created src: %v", e)
	}
	os.Mkdir(filepath.Join(home, "src"), 0700)
	check("absent")
	os.Mkdir(filepath.Join(home, "src", "repo"), 0700)
	check("conflict")
	os.Mkdir(filepath.Join(home, "src", "repo", ".git"), 0700)
	check("confirmed")
	other := func(_ context.Context, _, _, _ string, args ...string) ([]byte, error) {
		if args[len(args)-1] == "HEAD^{commit}" {
			return []byte("0123456789abcdef0123456789abcdef01234567\n"), nil
		}
		if args[len(args)-1] == "--is-inside-work-tree" {
			return []byte("true\n"), nil
		}
		if args[len(args)-1] == "--porcelain" {
			return nil, nil
		}
		return []byte("https://github.com/bob/repo.git\n"), nil
	}
	if got := observeCheckout(context.Background(), cfg, home, "git", other, "alice/repo"); got != "conflict" {
		t.Fatal(got)
	}
	os.Rename(filepath.Join(home, "src", "repo"), filepath.Join(home, "src", "Repo"))
	check("conflict")
	os.RemoveAll(filepath.Join(home, "src"))
	os.Symlink(home, filepath.Join(home, "src"))
	check("unavailable")
}
func TestObserveSeparateMappedHomes(t *testing.T) {
	cfg, first := cloneFixture(t)
	second := t.TempDir()
	for _, home := range []string{first, second} {
		if err := os.MkdirAll(filepath.Join(home, "src", "repo", ".git"), 0700); err != nil {
			t.Fatal(err)
		}
	}
	run := func(_ context.Context, _, cwd, _ string, args ...string) ([]byte, error) {
		if args[len(args)-1] == "HEAD^{commit}" {
			return []byte("0123456789abcdef0123456789abcdef01234567\n"), nil
		}
		if args[len(args)-1] == "--is-inside-work-tree" {
			return []byte("true\n"), nil
		}
		if args[len(args)-1] == "--porcelain" {
			return nil, nil
		}
		if cwd == first {
			return []byte("https://github.com/alice/repo.git\n"), nil
		}
		return []byte("https://github.com/bob/repo.git\n"), nil
	}
	if got := observeCheckout(context.Background(), cfg, first, "git", run, "alice/repo"); got != "confirmed" {
		t.Fatal(got)
	}
	if got := observeCheckout(context.Background(), cfg, second, "git", run, "alice/repo"); got != "conflict" {
		t.Fatal(got)
	}
	if got := observeCheckout(context.Background(), cfg, first, "git", run, "bob/repo"); got != "conflict" {
		t.Fatal(got)
	}
}
func TestObserveWithNativeGit(t *testing.T) {
	cfg, home := cloneFixture(t)
	git, err := exec.LookPath("git")
	if err != nil {
		t.Skip("git missing")
	}
	path := filepath.Join(home, "src", "repo")
	if err := os.MkdirAll(path, 0700); err != nil {
		t.Fatal(err)
	}
	for _, args := range [][]string{{"init", "-q", path}, {"-C", path, "remote", "add", "origin", "https://github.com/alice/repo.git"}} {
		if out, err := exec.Command(git, args...).CombinedOutput(); err != nil {
			t.Fatalf("git: %v %s", err, out)
		}
	}
	if got := observeCheckout(context.Background(), cfg, home, git, cloneCommand, "alice/repo"); got != "conflict" {
		t.Fatalf("unborn HEAD was confirmed: %s", got)
	}
	commit := exec.Command(git, "-C", path, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-m", "fixture")
	if out, err := commit.CombinedOutput(); err != nil {
		t.Fatalf("seed commit: %v %s", err, out)
	}
	if got := observeCheckout(context.Background(), cfg, home, git, cloneCommand, "alice/repo"); got != "confirmed" {
		t.Fatal(got)
	}
	if _, err := os.Stat(filepath.Join(path, ".git", "index.lock")); !os.IsNotExist(err) {
		t.Fatal("git left lock")
	}
}
func TestObserveRequestIdentityAndShape(t *testing.T) {
	cfg, home := cloneFixture(t)
	h := repoObserveHandler(cfg, func(*http.Request) bool { return true }, home, "git", nil)
	for _, tc := range []struct {
		uri      string
		identity string
		code     int
	}{
		{RepoObservePath + "?full_name=" + url.QueryEscape("alice/repo"), "wid_wrong", 200},
		{RepoObservePath + "?full_name=alice/repo&uid=" + strconv.Itoa(os.Getuid()), "", 400},
		{RepoObservePath + "?full_name=alice%2frepo", "", 400},
		{RepoObservePath + "?full_name=" + url.QueryEscape("../repo"), "", 400},
	} {
		r := httptest.NewRequest("GET", "http://unix"+tc.uri, nil)
		r.RequestURI = tc.uri
		r.Header.Set("X-Agent-Host-Identity", tc.identity)
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != tc.code {
			t.Fatalf("%s: %d %s", tc.uri, w.Code, w.Body.String())
		}
		if strings.Contains(w.Body.String(), home) {
			t.Fatal("path leak")
		}
	}
}
