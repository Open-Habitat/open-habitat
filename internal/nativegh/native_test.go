//go:build linux

package nativegh

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

type fake struct {
	t      *testing.T
	log    []string
	token  string
	logged bool
	id     string
	fail   string
	huge   bool
}

func (f *fake) Run(_ context.Context, c Command) ([]byte, error) {
	key := c.Program + " " + strings.Join(c.Args, " ")
	f.log = append(f.log, key)
	for _, s := range append(append([]string{}, c.Args...), os.Environ()...) {
		if strings.Contains(s, f.token) {
			f.t.Fatal("token in arguments/environment")
		}
	}
	if c.Stdin != nil {
		b, _ := io.ReadAll(c.Stdin)
		if key == "gh auth login --hostname github.com --with-token --git-protocol https" && string(b) != f.token {
			f.t.Fatal("stdin token missing")
		}
	}
	if f.fail == key {
		return nil, errors.New("secret raw child error")
	}
	if f.huge {
		return []byte(strings.Repeat("x", 9000)), nil
	}
	switch key {
	case "gh auth status --hostname github.com":
		if !f.logged {
			return nil, denied
		}
	case "gh api user --jq {id: .id, login: .login}":
		return []byte(fmt.Sprintf(`{"id":%s,"login":"alice"}`, f.id)), nil
	case "gh config get git_protocol --host github.com":
		return []byte("https\n"), nil
	case "git config --global --get credential.https://github.com.helper":
		return []byte("!gh auth git-credential\n"), nil
	case "git credential fill":
		if !f.logged {
			return nil, denied
		}
		if c.Output {
			f.t.Fatal("helper secret captured")
		}
	case "gh auth login --hostname github.com --with-token --git-protocol https":
		f.logged = true
	case "gh auth logout --hostname github.com --user alice":
		f.logged = false
	}
	return nil, nil
}

type attest bool

func (a attest) Keyring(context.Context, string) bool { return bool(a) }
func fixture(t *testing.T, keyring bool) (*Adapter, *fake, string) {
	t.Helper()
	home := t.TempDir()
	if err := os.Chmod(home, 0700); err != nil {
		t.Fatal(err)
	}
	if !keyring {
		for _, p := range []string{filepath.Join(home, ".config"), filepath.Join(home, ".config", "gh")} {
			if err := os.Mkdir(p, 0700); err != nil {
				t.Fatal(err)
			}
		}
		if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte("github.com:\n  oauth_token: fake-not-a-token\n"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	f := &fake{t: t, token: "unique-synthetic-sentinel", id: "42"}
	a, e := New(home, "42", f, attest(keyring))
	if e != nil {
		t.Fatal(e)
	}
	return a, f, home
}
func TestInstallReobserveAndDisconnect(t *testing.T) {
	for _, keyring := range []bool{true, false} {
		t.Run(fmt.Sprint(keyring), func(t *testing.T) {
			a, f, _ := fixture(t, keyring)
			r, e := a.Install(context.Background(), f.token)
			if e != nil || r.Phase != Installed {
				t.Fatalf("%+v %v", r, e)
			}
			if !reflect.DeepEqual(f.log[len(f.log)-7:], []string{"gh auth login --hostname github.com --with-token --git-protocol https", "gh auth setup-git --hostname github.com", "gh auth status --hostname github.com", "gh api user --jq {id: .id, login: .login}", "gh config get git_protocol --host github.com", "git config --global --get credential.https://github.com.helper", "git credential fill"}) {
				t.Fatal(f.log)
			}
			r, e = a.Install(context.Background(), f.token)
			if e != nil || r.Phase != Reobserved {
				t.Fatal(r, e)
			}
			before := len(f.log)
			if _, e = a.Disconnect(context.Background(), false, true); e == nil || len(f.log) != before {
				t.Fatal("precondition ignored")
			}
			r, e = a.Disconnect(context.Background(), true, true)
			if e != nil || r.Phase != Absent || !r.HelperInert || r.RevokesOAuthToken {
				t.Fatal(r, e)
			}
		})
	}
}
func TestFailures(t *testing.T) {
	for _, failed := range []string{"gh auth login --hostname github.com --with-token --git-protocol https", "gh auth setup-git --hostname github.com", "gh auth status --hostname github.com", "gh api user --jq {id: .id, login: .login}", "gh config get git_protocol --host github.com", "git config --global --get credential.https://github.com.helper", "git credential fill"} {
		t.Run(failed, func(t *testing.T) {
			a, f, _ := fixture(t, false)
			f.fail = failed
			r, e := a.Install(context.Background(), f.token)
			if e == nil || strings.Contains(e.Error(), f.token) || r.Phase != Partial {
				t.Fatal(r, e)
			}
		})
	}
}
func TestWrongIDCleanupAndStorage(t *testing.T) {
	a, f, home := fixture(t, false)
	f.id = "43"
	r, e := a.Install(context.Background(), f.token)
	if e == nil || !r.CleanupOK || f.logged {
		t.Fatal(r, e)
	}
	for _, mutate := range []func(string) error{
		func(p string) error { return os.Chmod(p, 0644) },
		func(p string) error { return os.Remove(p) },
		func(p string) error {
			if e := os.Remove(p); e != nil {
				return e
			}
			return os.Symlink("/tmp/nowhere", p)
		},
	} {
		a, f, home = fixture(t, false)
		p := filepath.Join(home, ".config", "gh", "hosts.yml")
		if e := mutate(p); e != nil {
			t.Fatal(e)
		}
		_, e = a.Install(context.Background(), f.token)
		if e == nil {
			t.Fatal("unsafe storage accepted")
		}
	}
}

func TestUnsafeDirectoriesAndCleanupFailure(t *testing.T) {
	for _, name := range []string{"config-mode", "gh-symlink", "outside-home", "cleanup-failure"} {
		t.Run(name, func(t *testing.T) {
			a, f, home := fixture(t, false)
			switch name {
			case "config-mode":
				if e := os.Chmod(filepath.Join(home, ".config"), 0755); e != nil {
					t.Fatal(e)
				}
			case "gh-symlink":
				p := filepath.Join(home, ".config", "gh")
				alt := filepath.Join(home, "other")
				if e := os.Rename(p, alt); e != nil {
					t.Fatal(e)
				}
				if e := os.Symlink(alt, p); e != nil {
					t.Fatal(e)
				}
			case "outside-home":
				p := filepath.Join(home, ".config", "gh")
				if e := os.RemoveAll(p); e != nil {
					t.Fatal(e)
				}
				if e := os.Symlink(t.TempDir(), p); e != nil {
					t.Fatal(e)
				}
			case "cleanup-failure":
				f.id = "43"
				f.fail = "gh auth logout --hostname github.com --user alice"
			}
			r, e := a.Install(context.Background(), f.token)
			if e == nil || r.Phase != Partial || name == "cleanup-failure" && r.CleanupOK {
				t.Fatal(r, e)
			}
		})
	}
}
func TestDisconnectPartialAndNoTokenLeak(t *testing.T) {
	a, f, _ := fixture(t, true)
	f.logged = true
	f.fail = "gh auth logout --hostname github.com --user alice"
	r, e := a.Disconnect(context.Background(), true, true)
	if e == nil || r.Phase != Partial || r.HelperInert || r.RevokesOAuthToken || strings.Contains(e.Error(), f.token) {
		t.Fatal(r, e)
	}
}
func TestExecutorBoundedAndTimeout(t *testing.T) {
	home := t.TempDir()
	e := Executor{Home: home}
	for _, tc := range []struct{ name, script string }{{"large", "#!/bin/sh\nyes x | head -c 100000\n"}, {"timeout", "#!/bin/sh\nsleep 30\n"}} {
		t.Run(tc.name, func(t *testing.T) {
			p := filepath.Join(home, tc.name)
			if err := os.WriteFile(p, []byte(tc.script), 0700); err != nil {
				t.Fatal(err)
			}
			ctx := context.Background()
			if tc.name == "timeout" {
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, 20*time.Millisecond)
				defer cancel()
			}
			_, err := e.Run(ctx, Command{Program: p, Output: true})
			if err == nil || err.Error() != denied.Error() {
				t.Fatal(err)
			}
		})
	}
}
