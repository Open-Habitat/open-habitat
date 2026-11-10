//go:build linux

package nativegitlab

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/unix"

	"github.com/open-habitat/open-habitat/internal/nativegitlab/gitlabfake"
)

type fixture struct {
	t     *testing.T
	home  string
	file  string
	store *Store
	srv   *gitlabfake.Server
	base  Base
	api   *Client
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	home := t.TempDir()
	if err := os.Chmod(home, 0o700); err != nil {
		t.Fatal(err)
	}
	srv, err := gitlabfake.Start(t.TempDir(), []gitlabfake.Account{
		{ID: 7, Username: "ada", Tokens: []gitlabfake.Token{{Value: "glpat-ada-0001", ExpiresAt: "2027-10-27"}, {Value: "glpat-ada-0002"}, {Value: "glpat-ada-readonly", Scopes: []string{"read_api"}}}},
		{ID: 8, Username: "bob", Tokens: []gitlabfake.Token{{Value: "glpat-bob-0001"}}},
	}, []gitlabfake.Project{
		{ID: 101, Path: "ada/notes", Description: "Notes"},
		{ID: 102, Path: "konepaja/verkkokauppa/infra/terraform", Members: []int64{7}, Visibility: "internal"},
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(srv.Close)
	store, err := NewStore(home, filepath.Join(home, ".config"))
	if err != nil {
		t.Fatal(err)
	}
	return &fixture{t: t, home: home, file: filepath.Join(home, ".config", "glab-cli", "config.yml"), store: store, srv: srv, base: mustBase(t, srv.URL), api: NewClientWithRoots(srv.Roots)}
}

func (f *fixture) write(content string) {
	f.t.Helper()
	if err := os.MkdirAll(filepath.Dir(f.file), 0o750); err != nil {
		f.t.Fatal(err)
	}
	if err := os.WriteFile(f.file, []byte(content), 0o600); err != nil {
		f.t.Fatal(err)
	}
}

func (f *fixture) read() string {
	f.t.Helper()
	b, err := os.ReadFile(f.file)
	if err != nil {
		f.t.Fatal(err)
	}
	return string(b)
}

func TestConnectCreatesGlabsFileWithOnlyItsEntry(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	if l, err := f.store.Logins(); err != nil || len(l) != 0 {
		t.Fatal(l, err)
	}
	if _, err := os.Stat(filepath.Join(f.home, ".config")); !os.IsNotExist(err) {
		t.Fatal("a read created a directory")
	}
	login, info, outcome, err := f.store.Connect(ctx, f.api, f.base, "glpat-ada-0001")
	if err != nil || outcome != "written" || !login.Usable() || login.User != "ada" || login.Key != f.base.Authority() {
		t.Fatal(login, outcome, err)
	}
	if !info.Known || info.Push != PushYes || info.ExpiresAt != "2027-10-27" || strings.Join(info.Scopes, ",") != "read_api,write_repository" {
		t.Fatalf("%+v", info)
	}
	st, err := os.Stat(f.file)
	if err != nil || st.Mode().Perm() != 0o600 {
		t.Fatal(st, err)
	}
	want := "hosts:\n    " + f.base.Authority() + ":\n        use_keyring: \"false\"\n        token: glpat-ada-0001\n        api_host: " + f.base.Authority() + "\n        api_protocol: https\n        git_protocol: https\n        user: ada\n"
	if got := f.read(); got != want {
		t.Fatalf("file:\n%s\nwant:\n%s", got, want)
	}
	// A repeated connect after a lost reply observes, never rewrites.
	before, _ := os.Stat(f.file)
	if _, _, outcome, err := f.store.Connect(ctx, f.api, f.base, "glpat-ada-0001"); err != nil || outcome != "unchanged" {
		t.Fatal(outcome, err)
	}
	if after, _ := os.Stat(f.file); !after.ModTime().Equal(before.ModTime()) {
		t.Fatal("repeat rewrote the file")
	}
	// glab keeps one account per server: another token, or another
	// account, for the same server is refused.
	for _, tok := range []string{"glpat-ada-0002", "glpat-bob-0001"} {
		if _, _, _, err := f.store.Connect(ctx, f.api, f.base, tok); err != ErrExists {
			t.Errorf("%s: %v", tok, err)
		}
	}
	if tok, err := f.store.Token(login.Target()); err != nil || tok != "glpat-ada-0001" {
		t.Fatal(tok, err)
	}
}

// glab's own blank entry for the server is filled in place: every comment,
// global setting and per-host default survives.
func TestConnectFillsGlabsBlankEntryAndKeepsTheRest(t *testing.T) {
	f := newFixture(t)
	blank := strings.ReplaceAll(string(blankConfig(t)), "gitlab.com:\n", f.base.Authority()+":\n")
	blank = strings.Replace(blank, "api_host: gitlab.com", "api_host: "+f.base.Authority(), 1)
	f.write(blank + "    other.example.org:\n        token: glpat-other\n        user: zed\n")
	if _, _, _, err := f.store.Connect(context.Background(), f.api, f.base, "glpat-ada-0001"); err != nil {
		t.Fatal(err)
	}
	got := f.read()
	for _, keep := range []string{"# What protocol to use when performing Git operations.", "telemetry: true", "glamour_style: dark", "container_registry_domains: gitlab.com,gitlab.com:443,registry.gitlab.com", "custom_headers: []", "other.example.org:\n        token: glpat-other"} {
		if !strings.Contains(got, keep) {
			t.Errorf("lost %q", keep)
		}
	}
	logins, err := f.store.Logins()
	if err != nil || len(logins) != 2 {
		t.Fatal(logins, err)
	}
	for _, l := range logins {
		if l.Key == f.base.Authority() && (!l.Usable() || l.User != "ada") {
			t.Fatalf("%+v", l)
		}
	}
	if strings.Count(got, f.base.Authority()+":\n") != 1 {
		t.Fatal("entry duplicated:\n" + got)
	}
}

func TestConnectRefusesAnEntryItCouldNotUse(t *testing.T) {
	f := newFixture(t)
	key := f.base.Authority()
	f.write("hosts:\n    " + key + ":\n        skip_tls_verify: \"true\"\n        git_protocol: ssh\n")
	before := f.read()
	if _, _, _, err := f.store.Connect(context.Background(), f.api, f.base, "glpat-ada-0001"); err != ErrUnsupported {
		t.Fatal(err)
	}
	if f.read() != before {
		t.Fatal("file changed")
	}
	// Signed in by glab with a keyring: one account per server.
	f.write("hosts:\n    " + key + ":\n        use_keyring: \"true\"\n        user: ada\n")
	if _, _, _, err := f.store.Connect(context.Background(), f.api, f.base, "glpat-ada-0001"); err != ErrExists {
		t.Fatal(err)
	}
	// The same token glab holds for another server.
	f.write("hosts:\n    other.example.org:\n        token: glpat-ada-0001\n        user: ada\n")
	if _, _, _, err := f.store.Connect(context.Background(), f.api, f.base, "glpat-ada-0001"); err != ErrExists {
		t.Fatal(err)
	}
}

func TestConnectVerifiesBeforeWriting(t *testing.T) {
	f := newFixture(t)
	f.srv.SetToken(7, gitlabfake.Token{Value: "glpat-expired", Expired: true})
	f.srv.SetToken(7, gitlabfake.Token{Value: "glpat-revoked", Revoked: true})
	f.srv.SetToken(7, gitlabfake.Token{Value: "glpat-write-only", Scopes: []string{"write_repository"}})
	f.srv.SetToken(7, gitlabfake.Token{Value: "glpat-user-only", Scopes: []string{"read_user"}})
	ctx := context.Background()
	for tok, want := range map[string]error{"glpat-expired": ErrExpired, "glpat-revoked": ErrRejected, "glpat-unknown": ErrRejected, "glpat-write-only": ErrScope, "glpat-user-only": ErrScope, "bad token": ErrInvalidToken} {
		if _, _, _, err := f.store.Connect(ctx, f.api, f.base, tok); err != want {
			t.Errorf("%s: %v, want %v", tok, err, want)
		}
	}
	if _, err := os.Stat(f.file); !os.IsNotExist(err) {
		t.Fatal("a refused connect wrote glab's file")
	}
	// The system trust store does not hold the fixture's CA.
	if _, _, _, err := f.store.Connect(ctx, NewClient(), f.base, "glpat-ada-0001"); err != ErrUntrustedTLS {
		t.Fatal(err)
	}
}

func TestTokenDescriptions(t *testing.T) {
	f := newFixture(t)
	f.srv.SetToken(7, gitlabfake.Token{Value: "glpat-fine", Fine: true, ExpiresAt: "2027-01-25"})
	f.srv.SetToken(7, gitlabfake.Token{Value: "glpat-api", Scopes: []string{"api"}})
	f.srv.SetToken(7, gitlabfake.Token{Value: "glpat-old-server", NoSelf: true})
	ctx := context.Background()
	for tok, want := range map[string]TokenInfo{
		"glpat-ada-readonly": {Known: true, Scopes: []string{"read_api"}, Push: PushNo},
		"glpat-fine":         {Known: true, Scopes: []string{}, Fine: true, ExpiresAt: "2027-01-25", Push: PushUnknown},
		"glpat-api":          {Known: true, Scopes: []string{"api"}, Push: PushYes},
		"glpat-old-server":   {Push: PushUnknown},
	} {
		_, info, err := f.api.Verify(ctx, f.base, tok)
		if err != nil || info.Known != want.Known || info.Push != want.Push || info.Fine != want.Fine || info.ExpiresAt != want.ExpiresAt || strings.Join(info.Scopes, ",") != strings.Join(want.Scopes, ",") {
			t.Errorf("%s: %+v %v", tok, info, err)
		}
	}
}

func TestReplaceAndRemove(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	f.write("git_protocol: ssh\nhosts:\n    " + f.base.Authority() + ":\n        token: glpat-ada-0001\n        user: ada\n        git_protocol: ssh\n        container_registry_domains: x\n")
	logins, err := f.store.Logins()
	if err != nil || len(logins) != 1 || !logins[0].Usable() {
		t.Fatal(logins, err)
	}
	target := logins[0].Target()
	if _, _, _, err := f.store.Replace(ctx, f.api, target, "glpat-bob-0001"); err != ErrAccountMismatch {
		t.Fatal(err)
	}
	if _, _, outcome, err := f.store.Replace(ctx, f.api, target, "glpat-ada-0001"); err != nil || outcome != "unchanged" {
		t.Fatal(outcome, err)
	}
	if _, _, outcome, err := f.store.Replace(ctx, f.api, target, "glpat-ada-0002"); err != nil || outcome != "written" {
		t.Fatal(outcome, err)
	}
	if got := f.read(); !strings.Contains(got, "token: glpat-ada-0002") || !strings.Contains(got, "git_protocol: ssh\n        container_registry_domains: x") {
		t.Fatal(got)
	}
	// A changed identity is refused, not edited.
	if _, err := f.store.Remove(Target{Key: target.Key, Base: target.Base, User: "bob"}); err != ErrChanged {
		t.Fatal(err)
	}
	release, err := f.store.Hold(target.Key)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.store.Remove(target); err != ErrInUse {
		t.Fatal(err)
	}
	release()
	if outcome, err := f.store.Remove(target); err != nil || outcome != "written" {
		t.Fatal(outcome, err)
	}
	got := f.read()
	if strings.Contains(got, "token:") || !strings.Contains(got, "user: ada") || !strings.Contains(got, "container_registry_domains: x") {
		t.Fatal("logout should remove only the token:\n" + got)
	}
	if outcome, err := f.store.Remove(target); err != nil || outcome != "absent" {
		t.Fatal(outcome, err)
	}
	if logins, _ := f.store.Logins(); len(logins) != 0 {
		t.Fatal(logins)
	}
	// The logged-out entry is filled again by a later connect.
	if _, _, outcome, err := f.store.Connect(ctx, f.api, f.base, "glpat-ada-0001"); err != nil || outcome != "written" {
		t.Fatal(outcome, err)
	}
	if got := f.read(); strings.Count(got, "git_protocol: ssh") != 2 {
		t.Fatal("the person's git_protocol was replaced:\n" + got)
	}
}

func TestUnsafeFileIsUnavailable(t *testing.T) {
	f := newFixture(t)
	f.write("hosts: {}\n")
	if err := os.Chmod(f.file, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := f.store.Logins(); err != ErrUnavailable {
		t.Fatal(err)
	}
	os.Chmod(f.file, 0o600)
	os.Remove(f.file)
	if err := os.Symlink("/etc/passwd", f.file); err != nil {
		t.Fatal(err)
	}
	if _, err := f.store.Logins(); err != ErrUnavailable {
		t.Fatal(err)
	}
	if _, _, _, err := f.store.Connect(context.Background(), f.api, f.base, "glpat-ada-0001"); err != ErrUnavailable {
		t.Fatal(err)
	}
}

// glab serializes credential writes with an flock on config.lock; a held
// lock is waited for, then refused, never ignored.
func TestGlabLockIsHonoured(t *testing.T) {
	f := newFixture(t)
	f.write("hosts: {}\n")
	f.store.files.LockTimeout = 200 * time.Millisecond
	fd, err := unix.Open(filepath.Join(filepath.Dir(f.file), "config.lock"), unix.O_RDWR|unix.O_CREAT, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(fd)
	if err := unix.Flock(fd, unix.LOCK_EX); err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := f.store.Connect(context.Background(), f.api, f.base, "glpat-ada-0001"); err != ErrBusy {
		t.Fatal(err)
	}
	unix.Flock(fd, unix.LOCK_UN)
	if _, _, _, err := f.store.Connect(context.Background(), f.api, f.base, "glpat-ada-0001"); err != nil {
		t.Fatal(err)
	}
}

// glab uses ~/.config/glab-cli when its config.yml exists there, whatever
// XDG_CONFIG_HOME says; otherwise $XDG_CONFIG_HOME/glab-cli.
func TestGlabPathSelection(t *testing.T) {
	f := newFixture(t)
	xdg := filepath.Join(f.home, "xdg")
	store, err := NewStore(f.home, xdg)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := store.Connect(context.Background(), f.api, f.base, "glpat-ada-0001"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(xdg, "glab-cli", "config.yml")); err != nil {
		t.Fatal("not in XDG:", err)
	}
	f.write("hosts:\n    legacy.example.org:\n        token: glpat-legacy\n        user: lee\n")
	logins, err := store.Logins()
	if err != nil || len(logins) != 1 || logins[0].Key != "legacy.example.org" {
		t.Fatal(logins, err)
	}
}
