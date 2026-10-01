//go:build linux

package daemon

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/maintainer/native-agent-host/internal/transport"
)

func cloneFixture(t *testing.T) (transport.Config, string) {
	t.Helper()
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	uid, _ := strconv.Atoi(u.Uid)
	home := t.TempDir()
	return transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: "42"}, home
}
func cloneRequest(body string) *http.Request {
	r := httptest.NewRequest("POST", "http://unix"+RepoClonePath, strings.NewReader(body))
	r.RequestURI = r.URL.RequestURI()
	r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
	r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
	return r
}
func TestCloneRefusalsAndPartial(t *testing.T) {
	cfg, home := cloneFixture(t)
	calls := 0
	run := func(_ context.Context, program, cwd, fd string, args ...string) ([]byte, error) {
		calls++
		if program == "gh" {
			if args[len(args)-1] == "/user" {
				return []byte(`{"id":42}`), nil
			}
			return []byte(`{"name":"repo","full_name":"org/repo","owner":{"login":"org"},"clone_url":"https://github.com/org/repo.git"}`), nil
		}
		return nil, errors.New("synthetic failed clone")
	}
	h := repoCloneHandler(cfg, func(*http.Request) bool { return true }, home, "gh", "git", run)
	for _, body := range []string{`{"full_name":"org/repo","url":"https://evil"}`, `{"full_name":"org/../repo"}`, `{"full_name":"org/repo","full_name":"org/repo"}`, `{"full_name":"org/repo","uid":1}`} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, cloneRequest(body))
		if w.Code != 400 || calls != 0 {
			t.Fatalf("invalid %s: %d calls %d", body, w.Code, calls)
		}
	}
	w := httptest.NewRecorder()
	if e := os.Symlink(t.TempDir(), filepath.Join(home, "src")); e != nil {
		t.Fatal(e)
	}
	w = httptest.NewRecorder()
	h.ServeHTTP(w, cloneRequest(`{"full_name":"org/repo"}`))
	if w.Code != 409 {
		t.Fatalf("symlink %d", w.Code)
	}
	os.Remove(filepath.Join(home, "src"))
	w = httptest.NewRecorder()
	h.ServeHTTP(w, cloneRequest(`{"full_name":"org/repo"}`))
	if w.Code != 409 || !strings.Contains(w.Body.String(), "checkout_uncertain") {
		t.Fatalf("partial %d %s", w.Code, w.Body.String())
	}
	if _, e := os.Stat(filepath.Join(home, "src", "repo")); e != nil {
		t.Fatal(e)
	}
	before := calls
	w = httptest.NewRecorder()
	h.ServeHTTP(w, cloneRequest(`{"full_name":"org/repo"}`))
	if w.Code != 409 || calls != before+2 || !strings.Contains(w.Body.String(), "checkout_exists") {
		t.Fatalf("collision %d %s calls %d", w.Code, w.Body.String(), calls)
	}
}

func TestCloneCommandPinnedCheckout(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, "checkout")
	if e := os.Mkdir(dir, 0700); e != nil {
		t.Fatal(e)
	}
	fd, e := os.Open(dir)
	if e != nil {
		t.Fatal(e)
	}
	defer fd.Close()
	// This tests actual subprocess cwd/descriptor plumbing without a provider.
	out, e := cloneCommand(context.Background(), "/bin/pwd", home, strconv.Itoa(int(fd.Fd())))
	if e != nil || strings.TrimSpace(string(out)) != dir {
		t.Fatalf("pinned cwd: %q %v", out, e)
	}
}

func TestCloneSyntheticNativeGitCheckout(t *testing.T) {
	cfg, home := cloneFixture(t)
	bare := filepath.Join(t.TempDir(), "bare.git")
	if b, e := exec.Command("/usr/bin/git", "init", "--bare", bare).CombinedOutput(); e != nil {
		t.Fatalf("git init: %s %v", b, e)
	}
	script := filepath.Join(t.TempDir(), "git-fixture")
	content := "#!/bin/sh\nif [ \"$1\" = clone ]; then\n /usr/bin/git clone -- '" + bare + "' . || exit 1\n exec /usr/bin/git remote set-url origin https://github.com/org/repo.git\nfi\nexec /usr/bin/git \"$@\"\n"
	if e := os.WriteFile(script, []byte(content), 0700); e != nil {
		t.Fatal(e)
	}
	runner := func(ctx context.Context, program, cwd, fd string, args ...string) ([]byte, error) {
		if program == "gh" {
			if args[len(args)-1] == "/user" {
				return []byte(`{"id":42}`), nil
			}
			return []byte(`{"name":"repo","full_name":"org/repo","owner":{"login":"org"},"clone_url":"https://github.com/org/repo.git"}`), nil
		}
		return cloneCommand(ctx, program, cwd, fd, args...)
	}
	h := repoCloneHandler(cfg, func(*http.Request) bool { return true }, home, "gh", script, runner)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, cloneRequest(`{"full_name":"org/repo"}`))
	if w.Code != 200 {
		t.Fatalf("checkout %d %s", w.Code, w.Body.String())
	}
	w = httptest.NewRecorder()
	h.ServeHTTP(w, cloneRequest(`{"full_name":"org/repo"}`))
	if w.Code != 409 || !strings.Contains(w.Body.String(), "checkout_exists") {
		t.Fatalf("repeat %d %s", w.Code, w.Body.String())
	}
}

func TestCloneCancellationAndMetadataRefusal(t *testing.T) {
	cfg, home := cloneFixture(t)
	for _, variant := range []string{"foreign", "url", "cancel", "permission"} {
		t.Run(variant, func(t *testing.T) {
			fixture := func(ctx context.Context, program, cwd, fd string, args ...string) ([]byte, error) {
				if program == "gh" {
					if args[len(args)-1] == "/user" {
						if variant == "foreign" {
							return []byte(`{"id":43}`), nil
						}
						return []byte(`{"id":42}`), nil
					}
					if variant == "url" {
						return []byte(`{"name":"repo","full_name":"org/repo","owner":{"login":"org"},"clone_url":"https://evil.invalid/repo.git"}`), nil
					}
					return []byte(`{"name":"repo","full_name":"org/repo","owner":{"login":"org"},"clone_url":"https://github.com/org/repo.git"}`), nil
				}
				if variant != "cancel" {
					t.Fatal("unexpected git")
				}
				<-ctx.Done()
				return nil, ctx.Err()
			}
			src := filepath.Join(home, variant)
			if e := os.Mkdir(src, 0700); e != nil {
				t.Fatal(e)
			}
			if variant == "permission" {
				if e := os.Chmod(src, 0777); e != nil {
					t.Fatal(e)
				}
			}
			h := repoCloneHandler(cfg, func(*http.Request) bool { return true }, src, "gh", "git", fixture)
			r := cloneRequest(`{"full_name":"org/repo"}`)
			if variant == "cancel" {
				ctx, cancel := context.WithCancel(r.Context())
				r = r.WithContext(ctx)
				cancel()
			}
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code == 200 {
				t.Fatal("accepted", variant)
			}
			if variant == "cancel" {
				if _, e := os.Lstat(filepath.Join(src, "src", "repo")); e != nil {
					t.Log("canceled before reservation")
				}
			}
			if variant == "url" || variant == "foreign" {
				if _, e := os.Lstat(filepath.Join(src, "src")); !os.IsNotExist(e) {
					t.Fatalf("mutated on refusal: %v", e)
				}
			}
		})
	}
}

func TestCloneRenameDuringVerificationNeverSucceeds(t *testing.T) {
	cfg, home := cloneFixture(t)
	renamed := false
	run := func(_ context.Context, program, cwd, fd string, args ...string) ([]byte, error) {
		if program == "gh" {
			if args[len(args)-1] == "/user" {
				return []byte(`{"id":42}`), nil
			}
			return []byte(`{"name":"repo","full_name":"org/repo","owner":{"login":"org"},"clone_url":"https://github.com/org/repo.git"}`), nil
		}
		if args[0] == "clone" {
			if e := os.Mkdir(filepath.Join(home, "src", "repo", ".git"), 0700); e != nil {
				t.Fatal(e)
			}
			return nil, nil
		}
		if args[0] == "rev-parse" {
			return []byte("true\n"), nil
		}
		if args[0] == "remote" {
			return []byte("https://github.com/org/repo.git\n"), nil
		}
		if args[0] == "status" {
			if e := os.Rename(filepath.Join(home, "src"), filepath.Join(home, "moved")); e != nil {
				t.Fatal(e)
			}
			renamed = true
			return nil, nil
		}
		t.Fatalf("unexpected %q", args)
		return nil, errors.New("unexpected")
	}
	h := repoCloneHandler(cfg, func(*http.Request) bool { return true }, home, "gh", "git", run)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, cloneRequest(`{"full_name":"org/repo"}`))
	if !renamed || w.Code != 409 || !strings.Contains(w.Body.String(), "checkout_uncertain") {
		t.Fatalf("rename %d %s", w.Code, w.Body.String())
	}
}
