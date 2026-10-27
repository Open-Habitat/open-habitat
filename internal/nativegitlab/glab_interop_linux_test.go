//go:build linux

package nativegitlab_test

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/nativegitlab"
	"github.com/Open-Habitat/open-habitat/internal/nativegitlab/gitlabfake"
)

// glabFixture runs the real glab the integrations profile ships, as a mapped
// user's shell or agent would: HOME, the minimal PATH and nothing else but
// the synthetic server's CA (and no keyring, as in the daemon's
// environment). The ordinary test run has no glab binary;
// scripts/test-glab-interop.sh builds this test and runs it against one.
type glabFixture struct {
	t     *testing.T
	glab  string
	home  string
	srv   *gitlabfake.Server
	store *nativegitlab.Store
	base  nativegitlab.Base
}

func newGlabFixture(t *testing.T) *glabFixture {
	t.Helper()
	glab := os.Getenv("OH_GLAB_BINARY")
	if glab == "" {
		t.Skip("OH_GLAB_BINARY names a shipped glab; run scripts/test-glab-interop.sh")
	}
	home := t.TempDir()
	if err := os.Chmod(home, 0o700); err != nil {
		t.Fatal(err)
	}
	srv, err := gitlabfake.Start(t.TempDir(), []gitlabfake.Account{
		{ID: 7, Username: "ada", Tokens: []gitlabfake.Token{{Value: "glpat-ada-0001"}}},
		{ID: 8, Username: "bob", Tokens: []gitlabfake.Token{{Value: "glpat-bob-0001"}}},
	}, []gitlabfake.Project{{ID: 101, Path: "konepaja/infra/terraform", Members: []int64{7, 8}}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(srv.Close)
	store, err := nativegitlab.NewStore(home, filepath.Join(home, ".config"))
	if err != nil {
		t.Fatal(err)
	}
	base, err := nativegitlab.ParseBase(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	return &glabFixture{t: t, glab: glab, home: home, srv: srv, store: store, base: base}
}

func (f *glabFixture) run(stdin string, args ...string) (string, error) {
	f.t.Helper()
	cmd := exec.Command(f.glab, args...)
	cmd.Env = []string{"HOME=" + f.home, "PATH=/usr/bin:/bin", "SSL_CERT_FILE=" + f.srv.CAFile, "GLAB_CHECK_UPDATE=false", "GLAB_SEND_TELEMETRY=false", "GLAB_NO_PROMPT=true", "GITLAB_HOST=" + f.base.String()}
	cmd.Dir = f.home
	cmd.Stdin = strings.NewReader(stdin)
	var out, errb bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &errb
	err := cmd.Run()
	if err != nil {
		f.t.Logf("glab %v: %v\n%s", args, err, errb.String())
	}
	return out.String(), err
}

func (f *glabFixture) user() string {
	f.t.Helper()
	out, err := f.run("", "api", "user")
	if err != nil {
		return ""
	}
	var u struct {
		Username string `json:"username"`
	}
	if json.Unmarshal([]byte(out), &u) != nil {
		f.t.Fatalf("glab api user: %q", out)
	}
	return u.Username
}

// A connection Habitat makes is glab's own login: glab reads it from the
// same file, and glab's later writes keep it.
func TestShippedGlabUsesHabitatsLogin(t *testing.T) {
	f := newGlabFixture(t)
	if _, _, _, err := f.store.Connect(context.Background(), nativegitlab.NewClientWithRoots(f.srv.Roots), f.base, "glpat-ada-0001"); err != nil {
		t.Fatal(err)
	}
	if got := f.user(); got != "ada" {
		t.Fatalf("glab sees %q", got)
	}
	if _, err := f.run("", "config", "set", "--global", "editor", "vi"); err != nil {
		t.Fatal(err)
	}
	logins, err := f.store.Logins()
	if err != nil || len(logins) != 1 || !logins[0].Usable() || logins[0].User != "ada" {
		t.Fatalf("after glab's write: %+v %v", logins, err)
	}
	if got := f.user(); got != "ada" {
		t.Fatalf("glab sees %q after its own write", got)
	}
	// Habitat's disconnect is glab's logout: glab no longer authenticates.
	if _, err := f.store.Remove(logins[0].Target()); err != nil {
		t.Fatal(err)
	}
	if got := f.user(); got == "ada" {
		t.Fatal("glab still authenticates after the disconnect")
	}
}

// A login the person makes with glab itself is a usable connection.
func TestShippedGlabLoginIsAConnection(t *testing.T) {
	f := newGlabFixture(t)
	if _, err := f.run("glpat-bob-0001\n", "auth", "login", "--stdin", "--hostname", f.base.Authority(), "--api-protocol", "https", "--git-protocol", "https"); err != nil {
		t.Fatal(err)
	}
	logins, err := f.store.Logins()
	if err != nil || len(logins) != 1 {
		t.Fatalf("%+v %v", logins, err)
	}
	l := logins[0]
	if !l.Usable() || l.User != "bob" || l.Key != f.base.Authority() {
		t.Fatalf("%+v", l)
	}
	cred, err := f.store.Credential(nativegitlab.CredentialRequest{Protocol: "https", Host: f.base.Authority(), Path: "konepaja/infra/terraform.git", Username: "bob"})
	if err != nil || cred.Password != "glpat-bob-0001" {
		t.Fatal(cred.Username, err)
	}
	// glab keeps one account per server: Habitat refuses a second.
	if _, _, _, err := f.store.Connect(context.Background(), nativegitlab.NewClientWithRoots(f.srv.Roots), f.base, "glpat-ada-0001"); err != nativegitlab.ErrExists {
		t.Fatal(err)
	}
}
