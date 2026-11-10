//go:build linux

package nativegitea_test

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/unix"

	"github.com/open-habitat/open-habitat/internal/nativegitea"
	"github.com/open-habitat/open-habitat/internal/nativegitea/giteafake"
)

// teaFixture runs the real tea the integrations profile ships, as a mapped
// user's shell or agent would: HOME, the minimal PATH and nothing else but
// the synthetic server's CA. The ordinary test run has no tea binary;
// scripts/test-tea-interop.sh builds this test and runs it against one.
type teaFixture struct {
	t        *testing.T
	tea      string
	home     string
	xdg      string
	srv      *giteafake.Server
	store    *nativegitea.Store
	teaFile  string
	extraEnv []string
}

func newTeaFixture(t *testing.T, xdg bool) *teaFixture {
	t.Helper()
	tea := os.Getenv("OH_TEA_BINARY")
	if tea == "" {
		t.Skip("OH_TEA_BINARY names a shipped tea; run scripts/test-tea-interop.sh")
	}
	home := t.TempDir()
	if err := os.Chmod(home, 0o700); err != nil {
		t.Fatal(err)
	}
	srv, err := giteafake.Start(t.TempDir(), []giteafake.Account{{ID: 7, Login: "ada", Token: "tok-ada-0001"}, {ID: 8, Login: "bob", Token: "tok-bob-0002"}}, []giteafake.Repo{
		{ID: 101, Owner: "ada", Name: "notes", Private: true},
		{ID: 103, Owner: "bob", Name: "plans", Private: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(srv.Close)
	f := &teaFixture{t: t, tea: tea, home: home, srv: srv, teaFile: filepath.Join(home, ".config", "tea", "config.yml")}
	if xdg {
		f.xdg = filepath.Join(home, "xdg")
		f.teaFile = filepath.Join(f.xdg, "tea", "config.yml")
	}
	// The daemon's paths for a mapped account (integrations.NewGitea);
	// tea, given only HOME, chooses the same default.
	config := filepath.Join(home, ".config")
	if xdg {
		config = f.xdg
	}
	f.store, err = nativegitea.NewStore(home, config)
	if err != nil {
		t.Fatal(err)
	}
	return f
}

func (f *teaFixture) env() []string {
	env := []string{"HOME=" + f.home, "PATH=/usr/bin:/bin", "SSL_CERT_FILE=" + f.srv.CAFile}
	if f.xdg != "" {
		env = append(env, "XDG_CONFIG_HOME="+f.xdg)
	}
	return append(env, f.extraEnv...)
}

func (f *teaFixture) run(args ...string) string {
	f.t.Helper()
	out, err := f.start(args...).CombinedOutput()
	if err != nil {
		f.t.Fatalf("tea %v: %v\n%s", args, err, out)
	}
	return string(out)
}

func (f *teaFixture) start(args ...string) *exec.Cmd {
	cmd := exec.Command(f.tea, args...)
	cmd.Dir = f.home
	cmd.Env = f.env()
	return cmd
}

func (f *teaFixture) connect(token string) nativegitea.Login {
	f.t.Helper()
	b, err := nativegitea.ParseBase(f.srv.URL)
	if err != nil {
		f.t.Fatal(err)
	}
	login, _, err := f.store.Connect(context.Background(), nativegitea.NewClientWithRoots(f.srv.Roots), b, token)
	if err != nil {
		f.t.Fatal(err)
	}
	return login
}

func (f *teaFixture) logins() map[string]nativegitea.Login {
	f.t.Helper()
	logins, err := f.store.Logins()
	if err != nil {
		f.t.Fatalf("Habitat cannot read tea's file: %v", err)
	}
	byName := map[string]nativegitea.Login{}
	for _, l := range logins {
		byName[l.Name] = l
	}
	return byName
}

type teaLogin struct {
	Name, URL, User string
}

func (f *teaFixture) teaLogins() map[string]teaLogin {
	f.t.Helper()
	var list []teaLogin
	if err := json.Unmarshal([]byte(f.run("login", "list", "--output", "json")), &list); err != nil {
		f.t.Fatal(err)
	}
	byName := map[string]teaLogin{}
	for _, l := range list {
		byName[l.Name] = l
	}
	return byName
}

// Habitat's connection is a login tea uses as its own, tea's own login is
// one Habitat's helper answers for, and each keeps the other's entries when
// it rewrites the file, under one shared lock.
func TestShippedTeaSharesHabitatsLogins(t *testing.T) {
	for _, xdg := range []bool{false, true} {
		t.Run(map[bool]string{false: "default", true: "xdg"}[xdg], func(t *testing.T) {
			f := newTeaFixture(t, xdg)
			ada := f.connect("tok-ada-0001")

			// tea reads and authenticates with the login Habitat wrote.
			if got := f.teaLogins()[ada.Name]; got.URL != f.srv.URL || got.User != "ada" {
				t.Fatalf("tea's view of Habitat's login: %+v", got)
			}
			if out := f.run("repos", "list", "--login", ada.Name, "--output", "json"); !strings.Contains(out, "notes") || strings.Contains(out, "plans") {
				t.Fatalf("tea with Habitat's token: %s", out)
			}

			// tea's own login, with the token from its environment (never
			// argv), is a login Habitat reads and its helper answers for.
			// Habitat's lock, held as its edits hold it, makes tea wait.
			lock, err := os.OpenFile(f.teaFile+".lock", os.O_CREATE|os.O_RDWR, 0o600)
			if err != nil {
				t.Fatal(err)
			}
			if err := unix.Flock(int(lock.Fd()), unix.LOCK_EX); err != nil {
				t.Fatal(err)
			}
			before, _ := os.ReadFile(f.teaFile)
			f.extraEnv = []string{"GITEA_SERVER_TOKEN=tok-bob-0002"}
			add := f.start("login", "add", "--name", "bobs", "--url", f.srv.URL)
			f.extraEnv = nil
			var out bytes.Buffer
			add.Stdout, add.Stderr = &out, &out
			if err := add.Start(); err != nil {
				t.Fatal(err)
			}
			time.Sleep(time.Second)
			if now, _ := os.ReadFile(f.teaFile); !bytes.Equal(now, before) {
				t.Fatal("tea wrote while Habitat held the lock")
			}
			_ = unix.Flock(int(lock.Fd()), unix.LOCK_UN)
			lock.Close()
			if err := add.Wait(); err != nil {
				t.Fatalf("tea login add: %v\n%s", err, out.String())
			}
			logins := f.logins()
			bobs := logins["bobs"]
			if bobs.Kind != nativegitea.KindPAT || bobs.User != "bob" || bobs.Owned || bobs.URL != f.srv.URL {
				t.Fatalf("Habitat's view of tea's login: %+v", bobs)
			}
			if got := logins[ada.Name]; !got.Owned || got.OwnedID != 7 || got.User != "ada" {
				t.Fatalf("tea's rewrite lost Habitat's login: %+v", got)
			}
			b, _ := nativegitea.ParseBase(f.srv.URL)
			for user, want := range map[string]string{"ada": "tok-ada-0001", "bob": "tok-bob-0002"} {
				c, err := f.store.Credential(nativegitea.CredentialRequest{Protocol: "https", Host: b.Authority(), Path: user + "/x.git", Username: user}, "")
				if err != nil || c.Password != want || c.Username != user {
					t.Fatalf("helper for %s: %+v %v", user, c, err)
				}
			}

			// Each removes only its own entry; the other's stays usable.
			f.run("login", "delete", "bobs")
			if logins := f.logins(); len(logins) != 1 || !logins[ada.Name].Owned {
				t.Fatalf("after tea's delete: %+v", logins)
			}
			f.extraEnv = []string{"GITEA_SERVER_TOKEN=tok-bob-0002"}
			f.run("login", "add", "--name", "bobs", "--url", f.srv.URL)
			f.extraEnv = nil
			if _, err := f.store.Remove(ada.Target()); err != nil {
				t.Fatal(err)
			}
			if got := f.teaLogins(); len(got) != 1 || got["bobs"].User != "bob" {
				t.Fatalf("after Habitat's disconnect: %+v", got)
			}
			if out := f.run("repos", "list", "--login", "bobs", "--output", "json"); !strings.Contains(out, "plans") {
				t.Fatalf("tea after Habitat's rewrite: %s", out)
			}

			// Both write one file only; tea keeps no second token copy.
			_ = filepath.WalkDir(f.home, func(path string, d os.DirEntry, err error) error {
				if err != nil || d.IsDir() || path == f.teaFile || path == f.teaFile+".lock" {
					return nil
				}
				t.Errorf("unexpected file in HOME: %s", path)
				return nil
			})
			if st, err := os.Stat(f.teaFile); err != nil || st.Mode().Perm() != 0o600 {
				t.Fatalf("tea's file mode: %v %v", st, err)
			}
		})
	}
}

// A person whose tea predates the XDG location keeps ~/.tea/tea.yml; both
// sides then use that file and neither creates the XDG one.
func TestShippedTeaLegacyLocation(t *testing.T) {
	f := newTeaFixture(t, false)
	legacy := filepath.Join(f.home, ".tea", "tea.yml")
	if err := os.Mkdir(filepath.Dir(legacy), 0o700); err != nil {
		t.Fatal(err)
	}
	f.extraEnv = []string{"GITEA_SERVER_TOKEN=tok-bob-0002"}
	// tea uses the legacy file only when it exists; an empty logins list is
	// what a person's earlier tea leaves after deleting its last login.
	if err := os.WriteFile(legacy, []byte("logins: []\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	f.run("login", "add", "--name", "bobs", "--url", f.srv.URL)
	f.extraEnv = nil
	ada := f.connect("tok-ada-0001")
	if got := f.teaLogins(); got[ada.Name].User != "ada" || got["bobs"].User != "bob" {
		t.Fatalf("tea's view: %+v", got)
	}
	if b, _ := os.ReadFile(legacy); !strings.Contains(string(b), "tok-ada-0001") {
		t.Fatal("Habitat did not write the legacy file tea uses")
	}
	if _, err := os.Stat(f.teaFile); !os.IsNotExist(err) {
		t.Fatalf("an XDG file appeared beside the legacy one: %v", err)
	}
}
