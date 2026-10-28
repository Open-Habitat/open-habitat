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
	"sync"
	"testing"
	"time"
)

type fake struct {
	t      *testing.T
	log    []string
	token  string
	logged bool
	id     string
	helper string
	fail   string
	huge   bool
	// apiErr is what gh api user returns while logged in, before any login
	// this test installs: rejected for a revoked token, denied for others.
	apiErr error
	// probed runs once when gh api user is asked, as a native change would.
	probed func()
	// held is what gh auth token shows while logged in.
	held string
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
			return nil, noAuth
		}
	case "gh api --hostname github.com user --jq {id: .id, login: .login}":
		if probed := f.probed; probed != nil {
			f.probed = nil
			probed()
		}
		if f.apiErr != nil {
			return nil, f.apiErr
		}
		return []byte(fmt.Sprintf(`{"id":%s,"login":"alice"}`, f.id)), nil
	case "gh config get git_protocol --host github.com":
		return []byte("https\n"), nil
	case "git config --global --get credential.https://github.com.helper":
		if f.helper != "" {
			return []byte(f.helper), nil
		}
		return []byte("!gh auth git-credential\n"), nil
	case "git credential fill":
		if !f.logged {
			return nil, denied
		}
		if c.Output {
			f.t.Fatal("helper secret captured")
		}
	case "gh auth token --hostname github.com":
		if !f.logged || f.held == "" || !c.Output {
			return nil, denied
		}
		return []byte(f.held + "\n"), nil
	case "gh auth login --hostname github.com --with-token --git-protocol https":
		f.logged = true
		f.apiErr = nil
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
func TestAbsentDiagnosticStrict(t *testing.T) {
	for _, tc := range []struct {
		text   string
		absent bool
	}{
		{"You are not logged into any GitHub hosts. To log in, run: gh auth login\n", true},
		{"authentication failed", false},
		{"You are not logged into any GitHub hosts. To log in, run: gh auth login\nsecret", false},
		{"You are not logged into any GitHub hosts. To log in, run: gh auth login\nnetwork error", false},
		{"You are not logged into any accounts on github.com\n", true},
		{"You are not logged into any accounts on ghe.example.com\n", false},
	} {
		if got := absentDiagnostic([]byte(tc.text)); got != tc.absent {
			t.Fatalf("unexpected absence signal: %q", tc.text)
		}
	}
}

// The texts are gh 2.45.0's and 2.46.0's own stderr for gh api user against
// a revoked token, an unreadable keyring token and two network failures.
func TestRejectedDiagnosticStrict(t *testing.T) {
	for _, tc := range []struct {
		text     string
		rejected bool
	}{
		{"gh: Bad credentials (HTTP 401)\n", true},
		{"gh: Requires authentication (HTTP 401)\n", false},
		{"error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com\n", false},
		{`Get "https://api.github.com/user": proxyconnect tcp: dial tcp 127.0.0.1:9: connect: connection refused` + "\n", false},
		{"gh: Bad credentials (HTTP 401)\nsecret", false},
		{"gh: Bad credentials (HTTP 403)\n", false},
	} {
		if got := rejectedDiagnostic([]byte(tc.text)); got != tc.rejected {
			t.Fatalf("unexpected rejection signal: %q", tc.text)
		}
	}
}

func TestStatusFreshSyntheticIdentityAndErrors(t *testing.T) {
	a, f, _ := fixture(t, true)
	f.logged = true
	if got := a.Status(context.Background()); got != "connected" {
		t.Fatal(got)
	}
	f.id = "43"
	if got := a.Status(context.Background()); got != "disconnected" {
		t.Fatal(got)
	}
	f.id = "not-json"
	if got := a.Status(context.Background()); got != "unknown" {
		t.Fatal(got)
	}
	f.id = "42"
	f.fail = "gh api --hostname github.com user --jq {id: .id, login: .login}"
	if got := a.Status(context.Background()); got != "unknown" {
		t.Fatal(got)
	}
	f.fail = ""
	f.apiErr = rejected
	if got := a.Status(context.Background()); got != "expired" {
		t.Fatal(got)
	}
	f.apiErr = nil
	f.fail = "gh api --hostname github.com user --jq {id: .id, login: .login}"
	f.fail = "gh config get git_protocol --host github.com"
	if got := a.Status(context.Background()); got != "partial" {
		t.Fatal(got)
	}
	f.fail = ""
	f.logged = false
	if got := a.Status(context.Background()); got != "disconnected" {
		t.Fatal(got)
	}
	// Only explicit native absence, not an arbitrary error, proves no login.
	for _, cmd := range f.log {
		if strings.Contains(cmd, f.token) || strings.Contains(cmd, "auth login") || strings.Contains(cmd, "auth logout") {
			t.Fatal("unsafe status command", cmd)
		}
	}
}

func TestStatusStorageAndUIDIsolation(t *testing.T) {
	a, f, home := fixture(t, false)
	f.logged = true
	if got := a.Status(context.Background()); got != "connected" {
		t.Fatal(got)
	}
	other, otherFake, otherHome := fixture(t, false)
	otherFake.logged = true
	otherFake.id = "99"
	if got := other.Status(context.Background()); got != "disconnected" {
		t.Fatal(got)
	}
	if home == otherHome {
		t.Fatal("shared home")
	}
	// Alter only the second home. A status check must not borrow the first
	// home's valid credential storage even with identical subject and UID.
	otherFake.id = "42"
	if err := os.Chmod(filepath.Join(otherHome, ".config"), 0755); err != nil {
		t.Fatal(err)
	}
	if got := other.Status(context.Background()); got != "partial" {
		t.Fatal(got)
	}
	if got := a.Status(context.Background()); got != "connected" {
		t.Fatal(got)
	}
}

func TestStatusTimeout(t *testing.T) {
	home := t.TempDir()
	a, err := New(home, "42", stalledRunner{}, nil)
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	if got := a.Status(context.Background()); got != "unknown" || time.Since(start) > 3*time.Second {
		t.Fatalf("timeout: %s (%v)", got, time.Since(start))
	}
}

func TestStatusCanceledLeaderDoesNotCancelWaiter(t *testing.T) {
	a, f, home := fixture(t, true)
	f.logged = true
	r := &blockingStatus{fake: f, entered: make(chan struct{}), release: make(chan struct{})}
	a, err := New(home, "42", r, attest(true))
	if err != nil {
		t.Fatal(err)
	}
	leaderCtx, cancel := context.WithCancel(context.Background())
	leader := make(chan string, 1)
	go func() { leader <- a.Status(leaderCtx) }()
	<-r.entered
	waiter := make(chan string, 1)
	go func() { waiter <- a.Status(context.Background()) }()
	// Both requests have joined the flight before the leader is canceled.
	a.flightMu.Lock()
	if a.flight == nil {
		t.Fatal("no flight")
	}
	a.flightMu.Unlock()
	cancel()
	if got := <-leader; got != "unknown" {
		t.Fatal(got)
	}
	close(r.release)
	if got := <-waiter; got != "connected" {
		t.Fatal(got)
	}
}

type blockingStatus struct {
	fake             *fake
	entered, release chan struct{}
	once             sync.Once
}

func (s *blockingStatus) Run(ctx context.Context, c Command) ([]byte, error) {
	if c.Program == "gh" && len(c.Args) > 1 && c.Args[0] == "auth" && c.Args[1] == "status" {
		s.once.Do(func() { close(s.entered) })
		select {
		case <-s.release:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return s.fake.Run(ctx, c)
}

func TestStatusTimeoutAfterIdentity(t *testing.T) {
	a, f, home := fixture(t, true)
	f.logged = true
	r := &stallAfterIdentity{fake: f}
	a, err := New(home, "42", r, attest(true))
	if err != nil {
		t.Fatal(err)
	}
	if got := a.Status(context.Background()); got != "unknown" {
		t.Fatal(got)
	}
}

type stallAfterIdentity struct{ fake *fake }

func (s *stallAfterIdentity) Run(ctx context.Context, c Command) ([]byte, error) {
	if c.Program == "gh" && len(c.Args) > 1 && c.Args[0] == "config" {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	return s.fake.Run(ctx, c)
}

type stalledRunner struct{}

func (stalledRunner) Run(ctx context.Context, _ Command) ([]byte, error) {
	<-ctx.Done()
	return nil, ctx.Err()
}

func TestInstallReobserveAndDisconnect(t *testing.T) {
	for _, keyring := range []bool{true, false} {
		t.Run(fmt.Sprint(keyring), func(t *testing.T) {
			a, f, _ := fixture(t, keyring)
			r, e := a.Install(context.Background(), f.token, false)
			if e != nil || r.Phase != Installed {
				t.Fatalf("%+v %v", r, e)
			}
			if !reflect.DeepEqual(f.log[len(f.log)-7:], []string{"gh auth login --hostname github.com --with-token --git-protocol https", "gh auth setup-git --hostname github.com", "gh auth status --hostname github.com", "gh api --hostname github.com user --jq {id: .id, login: .login}", "gh config get git_protocol --host github.com", "git config --global --get credential.https://github.com.helper", "git credential fill"}) {
				t.Fatal(f.log)
			}
			r, e = a.Install(context.Background(), f.token, false)
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

// A login gh keeps makes the handed-over token unused only when gh positively
// holds another one; the same token, or one gh cannot show, may be in use.
func TestKeptLoginReportsUnusedTokenOnlyWhenGhHoldsAnother(t *testing.T) {
	for _, tc := range []struct {
		name   string
		held   string
		fail   bool
		unused bool
	}{
		{"other", "gho_older-native-token", false, true},
		{"same", "unique-synthetic-sentinel", false, false},
		{"unreadable", "gho_older-native-token", true, false},
		{"empty", "", false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, f, _ := fixture(t, true)
			f.logged, f.held = true, tc.held
			if tc.fail {
				f.fail = "gh auth token --hostname github.com"
			}
			unused, e := a.Consumer()(context.Background(), f.token, false)
			if e != nil || unused != tc.unused || containsCommand(f.log, "gh auth login --hostname github.com --with-token --git-protocol https") {
				t.Fatal(unused, e, f.log)
			}
		})
	}
	// A fresh install uses the token.
	a, f, _ := fixture(t, true)
	f.held = "gho_older-native-token"
	if unused, e := a.Consumer()(context.Background(), f.token, false); e != nil || unused {
		t.Fatal(unused, e)
	}
	// A refused install reports nothing unused.
	a, f, _ = fixture(t, true)
	f.fail = "gh auth login --hostname github.com --with-token --git-protocol https"
	if unused, e := a.Consumer()(context.Background(), f.token, false); e == nil || unused {
		t.Fatal(unused, e)
	}
}

// An explicit reconnect puts the new token in place of gh's working login of
// the same account; an ordinary sign-in keeps that login (above). It replaces
// only gh's sole account, positively holding another token, whose files are
// still those it classified; otherwise it keeps the login as a sign-in does.
func TestExplicitReconnectReplacesOwnLogin(t *testing.T) {
	login := "gh auth login --hostname github.com --with-token --git-protocol https"
	ownFixture := func(t *testing.T) (*Adapter, *fake, string) {
		a, f, home := fixture(t, false)
		if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte(staleHosts), 0600); err != nil {
			t.Fatal(err)
		}
		f.logged, f.held = true, "gho_older-native-token"
		return a, f, home
	}
	a, f, _ := ownFixture(t)
	r, e := a.Install(context.Background(), f.token, true)
	if e != nil || r.Phase != Replaced || r.Unused || r.Storage != ProtectedFile || !containsCommand(f.log, login) || containsCommand(f.log, "gh auth logout --hostname github.com --user alice") {
		t.Fatal(r, e, f.log)
	}
	// The daemon's answer: the token is in use, so the gateway revokes nothing.
	a, f, _ = ownFixture(t)
	if unused, e := a.Consumer()(context.Background(), f.token, true); e != nil || unused || !containsCommand(f.log, login) {
		t.Fatal(unused, e, f.log)
	}
	for name, tc := range map[string]struct {
		setup  func(*fake, string)
		unused bool
	}{
		"same-token": {func(f *fake, _ string) { f.held = f.token }, false},
		"unreadable": {func(f *fake, _ string) { f.fail = "gh auth token --hostname github.com" }, false},
		// gh auth login would overwrite bob's entry if the token were his.
		"another-stored-account": {func(f *fake, home string) {
			if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte(strings.Replace(staleHosts, "    users:\n", "    users:\n        bob:\n            oauth_token: works\n", 1)), 0600); err != nil {
				t.Fatal(err)
			}
		}, true},
	} {
		t.Run(name, func(t *testing.T) {
			a, f, home := ownFixture(t)
			tc.setup(f, home)
			if r, e := a.Install(context.Background(), f.token, true); e != nil || r.Phase != Reobserved || r.Unused != tc.unused || containsCommand(f.log, login) {
				t.Fatal(r, e, f.log)
			}
		})
	}
	// The person switches or logs in natively while GitHub answers.
	a, f, home := ownFixture(t)
	f.probed = func() {
		if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte(strings.ReplaceAll(staleHosts, "stale", "fresh-native")), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if r, e := a.Install(context.Background(), f.token, true); e != nil || r.Phase != Reobserved || !r.Unused {
		t.Fatal(r, e)
	}
	for _, cmd := range f.log {
		if strings.Contains(cmd, "auth login") || strings.Contains(cmd, "auth logout") {
			t.Fatal("replaced a login it could not attribute", f.log)
		}
	}
	// Another account's login stays a refusal, reconnect or not.
	a, f, _ = ownFixture(t)
	f.id = "43"
	if r, e := a.Install(context.Background(), f.token, true); e == nil || containsCommand(f.log, login) {
		t.Fatal(r, e, f.log)
	}
}
func TestFreshInstallWithAbsoluteHelper(t *testing.T) {
	a, f, _ := fixture(t, false)
	f.helper = "!/usr/bin/gh auth git-credential\n"
	r, err := a.Install(context.Background(), f.token, false)
	if err != nil || r.Phase != Installed || r.Storage != ProtectedFile ||
		!containsCommand(f.log, "git credential fill") {
		t.Fatalf("absolute helper install: %+v %v", r, err)
	}
}

func TestGitHelperExactFormsAcrossObservationAndDisconnect(t *testing.T) {
	cases := []struct {
		name   string
		helper string
		accept bool
	}{
		{"relative", "!gh auth git-credential\n", true},
		{"absolute", "!/usr/bin/gh auth git-credential\n", true},
		{"other-path", "!/tmp/gh auth git-credential\n", false},
		{"other-bin", "!/bin/gh auth git-credential\n", false},
		{"path-prefix", "!prefix/usr/bin/gh auth git-credential\n", false},
		{"extra-argument", "!/usr/bin/gh auth git-credential --extra\n", false},
		{"shell-substitution", "!/usr/bin/gh auth git-credential $(id)\n", false},
		{"shell-chain", "!/usr/bin/gh auth git-credential; id\n", false},
		{"leading-space", " !/usr/bin/gh auth git-credential\n", false},
		{"trailing-space", "!/usr/bin/gh auth git-credential \n", false},
		{"extra-line", "!/usr/bin/gh auth git-credential\n!other\n", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a, f, _ := fixture(t, true)
			f.helper = tc.helper
			f.logged = true
			_, storage, ok := a.observe(context.Background())
			if ok != tc.accept || (tc.accept && storage != Keyring) {
				t.Fatalf("observation: storage=%s ok=%v", storage, ok)
			}
			// A rejected helper must not reach Git credential fill, which
			// would execute the shell command stored in Git config.
			if !tc.accept && containsCommand(f.log, "git credential fill") {
				t.Fatal("executed untrusted credential helper")
			}
			f.log = nil
			installed, installErr := a.Install(context.Background(), f.token, false)
			if (installErr == nil) != tc.accept || (tc.accept && installed.Phase != Reobserved) {
				t.Fatalf("reobserve: %+v %v", installed, installErr)
			}
			if !f.logged || containsCommand(f.log, "gh auth logout --hostname github.com --user alice") ||
				containsCommand(f.log, "git credential fill") != tc.accept {
				t.Fatal("unexpected reobserve commands", f.log)
			}
			f.log = nil
			r, err := a.Disconnect(context.Background(), true, true)
			if (err == nil) != tc.accept || r.HelperInert != tc.accept {
				t.Fatalf("disconnect: %+v %v", r, err)
			}
			if containsCommand(f.log, "git credential fill") != tc.accept {
				t.Fatal("unexpected credential fill after disconnect", f.log)
			}
		})
	}
}

func containsCommand(log []string, command string) bool {
	for _, c := range log {
		if c == command {
			return true
		}
	}
	return false
}

func TestConcurrentSameIDSerializes(t *testing.T) {
	a, f, _ := fixture(t, true)
	var wg sync.WaitGroup
	results := make(chan Result, 16)
	for range 16 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, err := a.Install(context.Background(), f.token, false)
			if err != nil {
				t.Errorf("install: %v", err)
			}
			results <- r
		}()
	}
	wg.Wait()
	close(results)
	installed := 0
	for r := range results {
		if r.Phase == Installed {
			installed++
		} else if r.Phase != Reobserved {
			t.Errorf("phase: %s", r.Phase)
		}
	}
	if installed != 1 {
		t.Fatalf("installed %d times", installed)
	}
	logins := 0
	for _, cmd := range f.log {
		if strings.HasPrefix(cmd, "gh auth login ") {
			logins++
		}
	}
	if logins != 1 {
		t.Fatalf("gh login %d times", logins)
	}
}

func TestExistingWrongOrPartialAuthIsNeverOverwritten(t *testing.T) {
	for _, tc := range []string{"wrong-id", "partial-helper", "api-unavailable", "api-denied"} {
		t.Run(tc, func(t *testing.T) {
			a, f, _ := fixture(t, true)
			f.logged = true
			switch tc {
			case "wrong-id":
				f.id = "43"
			case "partial-helper":
				f.fail = "git config --global --get credential.https://github.com.helper"
			case "api-unavailable":
				f.fail = "gh api --hostname github.com user --jq {id: .id, login: .login}"
			case "api-denied":
				// Network failure, unreadable keyring or unknown wording.
				f.apiErr = denied
			}
			if _, err := a.Install(context.Background(), f.token, false); err == nil {
				t.Fatal("accepted existing invalid login")
			}
			if !f.logged {
				t.Fatal("removed existing account")
			}
			for _, cmd := range f.log {
				if strings.Contains(cmd, "auth login") || strings.Contains(cmd, "auth logout") {
					t.Fatal("mutated existing account", f.log)
				}
			}
		})
	}
}

const staleHosts = "github.com:\n    users:\n        alice:\n            oauth_token: stale\n    git_protocol: https\n    oauth_token: stale\n    user: alice\n"

// A token GitHub rejects is replaced by the fresh one when it is gh's only
// github.com account and nothing changed gh's files since it was rejected.
func TestRevokedLoginIsReplaced(t *testing.T) {
	revokedFixture := func(t *testing.T, hosts string) (*Adapter, *fake, string) {
		a, f, home := fixture(t, false)
		if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte(hosts), 0600); err != nil {
			t.Fatal(err)
		}
		f.logged = true
		f.apiErr = rejected
		return a, f, home
	}
	a, f, _ := revokedFixture(t, staleHosts)
	r, e := a.Install(context.Background(), f.token, false)
	if e != nil || r.Phase != Installed || r.Storage != ProtectedFile {
		t.Fatal(r, e, f.log)
	}
	for name, setup := range map[string]func(*fake, string){
		// gh auth login would overwrite bob's working entry if he signed in.
		"another-stored-account": func(f *fake, home string) {
			if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte(strings.Replace(staleHosts, "    users:\n", "    users:\n        bob:\n            oauth_token: works\n", 1)), 0600); err != nil {
				t.Fatal(err)
			}
		},
		"legacy-single-token": func(f *fake, home string) {
			if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte("github.com:\n    oauth_token: stale\n    user: alice\n"), 0600); err != nil {
				t.Fatal(err)
			}
		},
		// The person logs in natively while GitHub answers about the old token.
		"native-login-meanwhile": func(f *fake, home string) {
			f.probed = func() {
				if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte(strings.ReplaceAll(staleHosts, "stale", "fresh-native")), 0600); err != nil {
					t.Fatal(err)
				}
			}
		},
	} {
		t.Run(name, func(t *testing.T) {
			a, f, home := revokedFixture(t, staleHosts)
			setup(f, home)
			if r, e := a.Install(context.Background(), f.token, false); e == nil || r.Phase != Partial {
				t.Fatal(r, e)
			}
			for _, cmd := range f.log {
				if strings.Contains(cmd, "auth login") || strings.Contains(cmd, "auth logout") {
					t.Fatal("mutated a login it could not attribute", f.log)
				}
			}
		})
	}
}

// A login made natively after ours (gh's files moved) is not ours to remove,
// even when the observation then sees another account.
func TestNativeChangeAfterInstallBlocksCleanup(t *testing.T) {
	a, f, home := fixture(t, false)
	f.id = "43"
	f.probed = func() {
		if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte(strings.ReplaceAll(staleHosts, "stale", "native")), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if r, e := a.Install(context.Background(), f.token, false); e == nil || r.CleanupOK || !f.logged {
		t.Fatal(r, e, f.log)
	}
}

// A failed gh auth login installed nothing: the login gh shows afterwards,
// even the person's own, was made by someone else and is never logged out.
func TestFailedLoginNeverCleansUp(t *testing.T) {
	a, f, home := fixture(t, false)
	if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte(staleHosts), 0600); err != nil {
		t.Fatal(err)
	}
	f.logged = true
	f.apiErr = rejected
	f.fail = "gh auth login --hostname github.com --with-token --git-protocol https"
	f.probed = func() { f.probed = func() { f.apiErr = nil } } // works when observed afterwards
	if r, e := a.Install(context.Background(), f.token, false); e == nil || r.Phase != Partial || r.CleanupOK {
		t.Fatal(r, e)
	}
	for _, cmd := range f.log {
		if strings.Contains(cmd, "auth logout") {
			t.Fatal("removed a login it did not install", f.log)
		}
	}
}

func TestFailures(t *testing.T) {
	for _, failed := range []string{"gh auth login --hostname github.com --with-token --git-protocol https", "gh auth setup-git --hostname github.com", "gh auth status --hostname github.com", "gh api --hostname github.com user --jq {id: .id, login: .login}", "gh config get git_protocol --host github.com", "git config --global --get credential.https://github.com.helper", "git credential fill"} {
		t.Run(failed, func(t *testing.T) {
			a, f, _ := fixture(t, false)
			f.fail = failed
			r, e := a.Install(context.Background(), f.token, false)
			if e == nil || strings.Contains(e.Error(), f.token) || r.Phase != Partial {
				t.Fatal(r, e)
			}
		})
	}
}
func TestWrongIDCleanupAndStorage(t *testing.T) {
	a, f, home := fixture(t, false)
	f.id = "43"
	r, e := a.Install(context.Background(), f.token, false)
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
		_, e = a.Install(context.Background(), f.token, false)
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
			r, e := a.Install(context.Background(), f.token, false)
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

// The snapshot's status is remembered only while its native inputs stay put:
// a change to gh's token file, Git's global configuration or a mutation
// through the adapter is visible in the very next answer.
func TestObservedStatusFollowsNativeInputs(t *testing.T) {
	a, f, home := fixture(t, false)
	f.logged = true
	calls := func() int {
		n := 0
		for _, c := range f.log {
			if c == "gh api --hostname github.com user --jq {id: .id, login: .login}" {
				n++
			}
		}
		return n
	}
	if got := a.ObservedStatus(context.Background()); got != "connected" {
		t.Fatal(got)
	}
	if got := a.ObservedStatus(context.Background()); got != "connected" || calls() != 1 {
		t.Fatalf("unchanged inputs must not ask GitHub again: %s after %d calls", got, calls())
	}
	// The remembered observation names the person's own login.
	if got := a.ObservedConnection(context.Background()); got != (Observation{State: "connected", Login: "alice"}) || calls() != 1 {
		t.Fatalf("own login: %+v after %d calls", got, calls())
	}
	// Another login on this machine rewrites hosts.yml.
	f.id = "43"
	if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte("github.com:\n  oauth_token: fake-other\n  user: other\n"), 0600); err != nil {
		t.Fatal(err)
	}
	// Another account's login is not the person's, so its name is not told.
	if got := a.ObservedConnection(context.Background()); got != (Observation{State: "disconnected"}) || calls() != 2 {
		t.Fatalf("hosts.yml change: %+v after %d calls", got, calls())
	}
	// A Git credential helper change lives in ~/.gitconfig, not in gh's files.
	f.id = "42"
	f.helper = "!/tmp/untrusted helper\n"
	if err := os.WriteFile(filepath.Join(home, ".gitconfig"), []byte("[credential]\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if got := a.ObservedStatus(context.Background()); got != "partial" || calls() != 3 {
		t.Fatalf("gitconfig change: %s after %d calls", got, calls())
	}
	// A mutation through the adapter is never answered from before it.
	f.helper = ""
	// The fake changes no files, so only the mutation itself can invalidate.
	if _, err := a.Disconnect(context.Background(), true, true); err != nil || f.logged {
		t.Fatal("disconnect", err)
	}
	if got := a.ObservedStatus(context.Background()); got != "disconnected" {
		t.Fatalf("after mutation: %s", got)
	}
	// Revocation on github.com has no local input: an old observation is
	// answered once more while a background recheck replaces it.
	f.logged = true
	if got := a.ObservedStatus(context.Background()); got != "disconnected" {
		t.Fatal(got)
	}
	a.flightMu.Lock()
	a.observed.at = time.Now().Add(-observedRecheck - time.Second)
	a.flightMu.Unlock()
	if got := a.ObservedStatus(context.Background()); got != "disconnected" {
		t.Fatalf("stale answer expected once: %s", got)
	}
	deadline := time.Now().Add(3 * time.Second)
	for {
		a.flightMu.Lock()
		state := a.observed.obs.State
		a.flightMu.Unlock()
		if state == "connected" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("background recheck did not replace the observation")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if got := a.ObservedStatus(context.Background()); got != "connected" {
		t.Fatal(got)
	}
}

// Git reads ~/.gitconfig through a dotfiles symlink and follows include.path;
// an edit in either target is a credential input like the file itself.
func TestObservedStatusFollowsSymlinkedAndIncludedGitConfig(t *testing.T) {
	a, f, home := fixture(t, false)
	f.logged = true
	dotfiles := filepath.Join(home, "dotfiles")
	if err := os.Mkdir(dotfiles, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dotfiles, "gitconfig"), []byte("[include]\n\tpath = credentials.inc\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dotfiles, "credentials.inc"), []byte("[credential]\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(dotfiles, "gitconfig"), filepath.Join(home, ".gitconfig")); err != nil {
		t.Fatal(err)
	}
	if got := a.ObservedStatus(context.Background()); got != "connected" {
		t.Fatal(got)
	}
	f.helper = "!/tmp/untrusted helper\n"
	if err := os.WriteFile(filepath.Join(dotfiles, "credentials.inc"), []byte("[credential]\n\thelper = untrusted\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if got := a.ObservedStatus(context.Background()); got != "partial" {
		t.Fatalf("included file edit: %s", got)
	}
	f.helper = ""
	if err := os.WriteFile(filepath.Join(dotfiles, "gitconfig"), []byte("[credential]\n\thelper = !gh auth git-credential\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if got := a.ObservedStatus(context.Background()); got != "connected" {
		t.Fatalf("symlink target edit: %s", got)
	}
}

// Locking a keyring writes no file, so a keyring-backed answer is never kept.
func TestObservedStatusDoesNotKeepKeyringAnswers(t *testing.T) {
	a, f, _ := fixture(t, true)
	f.logged = true
	for range 2 {
		if got := a.ObservedStatus(context.Background()); got != "connected" {
			t.Fatal(got)
		}
	}
	n := 0
	for _, c := range f.log {
		if strings.HasPrefix(c, "gh api --hostname github.com user") {
			n++
		}
	}
	if n != 2 {
		t.Fatalf("keyring-backed status answered from memory: %d observations", n)
	}
}

// A caller whose inputs changed while an older observation was in flight
// gets an observation that began after the change, not the older answer.
func TestObservedStatusDoesNotJoinAnOlderFlight(t *testing.T) {
	_, f, home := fixture(t, false)
	f.logged = true
	r := &blockAfterIdentity{fake: f, entered: make(chan struct{}), release: make(chan struct{})}
	a, err := New(home, "42", r, attest(false))
	if err != nil {
		t.Fatal(err)
	}
	older := make(chan string, 1)
	go func() { older <- a.Status(context.Background()) }()
	<-r.entered // the older flight has read identity 42
	f.id = "43"
	if err := os.WriteFile(filepath.Join(home, ".config", "gh", "hosts.yml"), []byte("github.com:\n  oauth_token: fake-other\n  user: other\n"), 0600); err != nil {
		t.Fatal(err)
	}
	newer := make(chan string, 1)
	go func() { newer <- a.ObservedStatus(context.Background()) }()
	time.Sleep(50 * time.Millisecond)
	close(r.release)
	if got := <-older; got != "connected" {
		t.Fatalf("older flight: %s", got)
	}
	if got := <-newer; got != "disconnected" {
		t.Fatalf("caller after the change got %s", got)
	}
}

type blockAfterIdentity struct {
	mu               sync.Mutex
	fake             *fake
	entered, release chan struct{}
	once             sync.Once
}

func (s *blockAfterIdentity) Run(ctx context.Context, c Command) ([]byte, error) {
	if c.Program == "gh" && len(c.Args) > 0 && c.Args[0] == "config" {
		first := false
		s.once.Do(func() { first = true; close(s.entered) })
		if first {
			<-s.release
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.fake.Run(ctx, c)
}

// fakeGH reproduces gh 2.45.0's observable behaviour for a stale login: auth
// status exits 0 and prints "token is invalid" whatever GitHub would answer,
// and only gh api user's stderr tells a revoked token from a working login
// of another account, a network failure or an unreadable keyring token.
const fakeGH = `#!/bin/sh
state=$(cat "$HOME/state" 2>/dev/null)
case "$*" in
"auth status --hostname github.com")
	if [ -z "$state" ]; then
		echo "You are not logged into any GitHub hosts. To log in, run: gh auth login" >&2
		exit 1
	fi
	echo github.com
	echo "  X Failed to log in to github.com account alice ($HOME/.config/gh/hosts.yml)"
	echo "  - The token in $HOME/.config/gh/hosts.yml is invalid."
	exit 0 ;;
"api --hostname github.com user --jq {id: .id, login: .login}")
	case "$state" in
	fresh) echo '{"id":42,"login":"alice"}' ;;
	foreign) echo '{"id":43,"login":"mallory"}' ;;
	revoked) echo '{"message":"Bad credentials","status":"401"}'; echo "gh: Bad credentials (HTTP 401)" >&2; exit 1 ;;
	locked) echo '{"message":"Requires authentication","status":"401"}'; echo "gh: Requires authentication (HTTP 401)" >&2; exit 1 ;;
	*) printf 'error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com\n' >&2; exit 1 ;;
	esac ;;
"auth login --hostname github.com --with-token --git-protocol https")
	echo login >>"$HOME/log"
	[ "$(cat)" = unique-synthetic-sentinel ] || exit 1
	[ "$state" = offline ] && exit 1
	printf 'github.com:\n    users:\n        alice:\n            oauth_token: fresh\n    git_protocol: https\n    oauth_token: fresh\n    user: alice\n' >"$HOME/.config/gh/hosts.yml"
	echo fresh >"$HOME/state" ;;
"auth logout --hostname github.com --user "*)
	echo logout >>"$HOME/log"
	rm -f "$HOME/state" ;;
"auth setup-git --hostname github.com") ;;
"config get git_protocol --host github.com") echo https ;;
*) exit 1 ;;
esac
`

const fakeGit = `#!/bin/sh
case "$*" in
"config --global --get credential.https://github.com.helper") echo '!gh auth git-credential' ;;
"credential fill") cat >/dev/null; [ "$(cat "$HOME/state" 2>/dev/null)" = fresh ] ;;
*) exit 1 ;;
esac
`

func TestExecutorReplacesOnlyARevokedLogin(t *testing.T) {
	bin := t.TempDir()
	for name, script := range map[string]string{"gh": fakeGH, "git": fakeGit} {
		if err := os.WriteFile(filepath.Join(bin, name), []byte(script), 0700); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("PATH", bin)
	for _, tc := range []struct {
		name, state string
		install     bool
	}{
		{"revoked", "revoked", true},
		{"revoked-beside-another-account", "revoked", false},
		{"offline", "offline", false},
		{"locked", "locked", false},
		{"foreign", "foreign", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, _, home := fixture(t, false)
			a.run = Executor{Home: home}
			if err := os.WriteFile(filepath.Join(home, "state"), []byte(tc.state+"\n"), 0600); err != nil {
				t.Fatal(err)
			}
			hosts := filepath.Join(home, ".config", "gh", "hosts.yml")
			stale := staleHosts
			if tc.name == "revoked-beside-another-account" {
				stale = strings.Replace(stale, "    users:\n", "    users:\n        bob:\n", 1)
			}
			if err := os.WriteFile(hosts, []byte(stale), 0600); err != nil {
				t.Fatal(err)
			}
			before, _ := os.ReadFile(hosts)
			want := map[string]string{"revoked": "expired", "revoked-beside-another-account": "expired", "offline": "unknown", "locked": "unknown", "foreign": "disconnected"}[tc.name]
			if got := a.Status(context.Background()); got != want {
				t.Fatalf("status %s, want %s", got, want)
			}
			r, err := a.Install(context.Background(), "unique-synthetic-sentinel", false)
			log, _ := os.ReadFile(filepath.Join(home, "log"))
			after, _ := os.ReadFile(hosts)
			if tc.install {
				if err != nil || r.Phase != Installed || r.Storage != ProtectedFile || string(log) != "login\n" {
					t.Fatal(r, err, string(log))
				}
				if got := a.Status(context.Background()); got != "connected" {
					t.Fatal(got)
				}
				return
			}
			if err == nil || r.Phase != Partial || len(log) != 0 || string(after) != string(before) {
				t.Fatal("touched a login it could not classify", r, err, string(log))
			}
		})
	}
}

// A token GitHub stops accepting changes no file on this machine; gh keeps
// offering it to every push. The settings row must stop saying connected
// within one recheck, say expired rather than "no login", and one GitHub
// sign-in must bring the connection back.
func TestTokenRevokedAtGitHubShowsExpiredAndSignInReconnects(t *testing.T) {
	bin := t.TempDir()
	for name, script := range map[string]string{"gh": fakeGH, "git": fakeGit} {
		if err := os.WriteFile(filepath.Join(bin, name), []byte(script), 0700); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("PATH", bin)
	a, _, home := fixture(t, false)
	a.run = Executor{Home: home}
	if err := os.Remove(filepath.Join(home, ".config", "gh", "hosts.yml")); err != nil {
		t.Fatal(err)
	}
	if r, err := a.Install(context.Background(), "unique-synthetic-sentinel", false); err != nil || r.Phase != Installed {
		t.Fatal("first sign-in", r, err)
	}
	if got := a.ObservedStatus(context.Background()); got != "connected" {
		t.Fatal(got)
	}
	// GitHub revokes the token. hosts.yml and Git's configuration stay as
	// they were, so only the periodic recheck can notice.
	if err := os.WriteFile(filepath.Join(home, "state"), []byte("revoked\n"), 0600); err != nil {
		t.Fatal(err)
	}
	a.flightMu.Lock()
	a.observed.at = time.Now().Add(-observedRecheck - time.Second)
	a.flightMu.Unlock()
	a.ObservedStatus(context.Background())
	deadline := time.Now().Add(5 * time.Second)
	for got := a.ObservedStatus(context.Background()); got != "expired"; got = a.ObservedStatus(context.Background()) {
		if time.Now().After(deadline) {
			t.Fatalf("revoked token still reported as %s", got)
		}
		time.Sleep(20 * time.Millisecond)
	}
	// The reconnect is an ordinary GitHub sign-in: its token replaces the
	// rejected one.
	if r, err := a.Install(context.Background(), "unique-synthetic-sentinel", false); err != nil || r.Phase != Installed {
		t.Fatal("reconnect", r, err)
	}
	if got := a.ObservedStatus(context.Background()); got != "connected" {
		t.Fatal(got)
	}
	log, _ := os.ReadFile(filepath.Join(home, "log"))
	if string(log) != "login\nlogin\n" {
		t.Fatalf("unexpected gh mutations %q", log)
	}
}
