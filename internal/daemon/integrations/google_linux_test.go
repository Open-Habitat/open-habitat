//go:build linux

package integrations

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/unix"
)

func fakeGog(t *testing.T) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "gog")
	script := `#!/bin/sh
set -eu
[ "$1" = --home ]; home=$2; shift 2
[ "$GOG_KEYRING_BACKEND" = file ]; [ "$GOG_KEYRING_PASSWORD" = open-habitat ]
[ "$1" = --no-input ]; [ "$2" = --json ]; shift 2
case "$1 $2 ${3:-}" in
 "auth credentials set") cat >/dev/null;;
 "auth tokens import")
 data=$(cat); email=$(printf '%s' "$data" | sed 's/.*"email":"\([^"]*\)".*/\1/')
 name=$(printf 'token:default:%s' "$email" | base64 -w0 | tr '+/' '-_' | tr -d '=')
 printf 'native-encrypted-token' >"$home/data/keyring/_gogcli_key_v1_$name"
 printf '%s' "$data" >"$home/data/imported-$name";;
 "auth tokens export")
 [ ! -f "$HOME/export-fail" ]
 [ "$5" = --out ] && [ "$6" = /dev/stdout ] && [ "$7" = --overwrite ]
 name=$(printf 'token:default:%s' "$4" | base64 -w0 | tr '+/' '-_' | tr -d '=')
 cat "$home/data/imported-$name"; printf '{"exported":true}';;
 "auth list ")
 [ ! -f "$HOME/gog-fail" ]
 printf '{"accounts":['; sep=
 for f in "$home"/data/imported-*; do
  [ -f "$f" ] && [ -f "$home/data/keyring/_gogcli_key_v1_${f##*/imported-}" ] || continue
  printf '%s' "$sep"; cat "$f"; sep=,
 done
 printf ']}';;
 *)
 if [ -f "$HOME/block-probes" ]; then
  touch "$HOME/probe-$2-$3"
  while [ ! -f "$HOME/release-probes" ]; do sleep 0.01; done
 fi
 [ ! -f "$HOME/gog-fail" ]; echo '{}';;
esac
`
	if err := os.WriteFile(p, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	return p
}
func googleEnv(t *testing.T) Env {
	return Env{Home: newHome(t), FixtureTools: true, Config: Config{Tools: map[string]string{"rclone": fakeRclone(t), "gog": fakeGog(t)}, Google: &GoogleApp{ClientID: "app-key.apps.googleusercontent.com", ClientSecret: "app-secret"}}}
}
func syntheticGoogle(t *testing.T, email *string, scopes string) *google {
	t.Helper()
	return &google{client: &http.Client{Transport: dropboxTransport(func(r *http.Request) (*http.Response, error) {
		var body string
		switch r.URL.String() {
		case "https://oauth2.googleapis.com/token":
			r.ParseForm()
			if r.Form.Get("code") != "synthetic-code" || r.Form.Get("client_id") != "app-key.apps.googleusercontent.com" || r.Form.Get("client_secret") != "app-secret" || r.Form.Get("redirect_uri") != "http://localhost" || len(r.Form.Get("code_verifier")) != 43 {
				t.Error("bad token exchange")
			}
			b, _ := json.Marshal(map[string]any{"access_token": "access-secret", "refresh_token": "refresh-secret", "expires_in": 3600, "scope": scopes})
			body = string(b)
		case "https://www.googleapis.com/oauth2/v2/userinfo":
			if r.Method != "GET" || r.Header.Get("Authorization") != "Bearer access-secret" {
				t.Error("bad userinfo request")
			}
			body = fmt.Sprintf(`{"email":%q,"verified_email":true}`, *email)
		default:
			t.Fatalf("unexpected endpoint %s", r.URL)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}}
}
func googlePaste(t *testing.T, view map[string]any) string {
	t.Helper()
	u, err := url.Parse(view["authorization_url"].(string))
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	if u.Host != "accounts.google.com" || q.Get("access_type") != "offline" || q.Get("prompt") != "consent" || q.Get("code_challenge_method") != "S256" || q.Get("redirect_uri") != googleRedirect || q.Get("scope") != googleScopes {
		t.Fatal("bad authorization prompt")
	}
	return googleRedirect + "?" + url.Values{"state": {q.Get("state")}, "code": {"synthetic-code"}}.Encode()
}
func TestGoogleConnectSyncRestartAndRemove(t *testing.T) {
	env := googleEnv(t)
	email := "PERSON@example.test"
	d := syntheticGoogle(t, &email, googleScopes)
	c := New(env, []Entry{d}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()
	h := c.Handler(allow)
	code, _, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google"})
	if code != 200 {
		t.Fatal(code)
	}
	view := waitState(t, h, ownerA, "open_url")
	paste := googlePaste(t, view)
	id := view["attempt_id"].(string)
	for _, raw := range []string{strings.Replace(paste, "localhost", "localhost:1", 1), strings.Replace(paste, "state=", "state=wrong", 1), strings.Replace(paste, "/?", "/other?", 1)} {
		// The entry rejects even a loopback URL that the generic relay accepts.
		login, _ := d.StartLogin(ctx, env, "")
		if login.Redirect(ctx, raw) == nil {
			t.Fatal("wrong state/port/path accepted")
		}
	}
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": paste})
	view = waitState(t, h, ownerA, "choose_folders")
	if view["directory"] != "~/cloud/google-drive/person@example.test" {
		t.Fatal(view)
	}
	config := filepath.Join(env.Home, googleDir, "person@example.test.conf")
	data, err := os.ReadFile(config)
	if err != nil || !bytes.Contains(data, []byte(`"refresh_token":"refresh-secret"`)) || !bytes.Contains(data, []byte("client_secret = app-secret\n")) {
		t.Fatalf("native config: %v", err)
	}
	st, _ := os.Stat(config)
	if st.Mode().Perm() != 0600 {
		t.Fatal("config not private")
	}
	_, _, raw := call(t, h, "GET", ListPath, "", nil)
	if strings.Contains(raw, "secret") {
		t.Fatal("token crossed browser contract")
	}
	// Quota admission now runs in the background after folder approval.
	c.quota = func() Room { return Room{Free: 2048, OK: true} }
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all"}})
	waitState(t, h, ownerA, "completed")
	waitLoginWorker(t, c)
	k := key{Google, "person@example.test"}
	if !c.sync.supervised(k) {
		t.Fatal("not supervised")
	}
	if _, err := os.Stat(filepath.Join(env.Home, BootSignal)); err != nil {
		t.Fatal(err)
	}
	skill, err := os.ReadFile(filepath.Join(env.Home, SkillDir, "SKILL.md"))
	if err != nil || !bytes.Contains(skill, []byte("~/cloud/google-drive/person@example.test/")) || !bytes.Contains(skill, []byte("In a folder that syncs both ways")) {
		t.Fatalf("skill: %v", err)
	}
	cmd, ok := d.SyncCommand(env, k.address)
	if !ok || strings.Contains(strings.Join(cmd.Args, " "), "--resync") {
		t.Fatal("ordinary run can resync")
	}
	assertBisyncSafety(t, cmd)
	// Execute one actual supervised pass, then stop and rederive from native files.
	deadline := time.Now().Add(3 * time.Second)
	for {
		if _, err := os.Stat(filepath.Join(env.Home, "passes")); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("no normal pass")
		}
		time.Sleep(10 * time.Millisecond)
	}
	c.sync.stopAll()
	c.write.Lock()
	c.reconcile()
	c.write.Unlock()
	if !c.sync.supervised(k) {
		t.Fatal("restart lost native account")
	}
	// Removal stops the process before unlink, preserves data by default and
	// removes credentials, native listings, skill and boot signal.
	local := filepath.Join(env.Home, "cloud/google-drive", k.address, "keep.txt")
	os.WriteFile(local, []byte("personal file"), 0600)
	code, out, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "google", "address": k.address, "delete_directories": false})
	if code != 200 {
		t.Fatalf("remove: %d %v", code, out)
	}
	if c.sync.supervised(k) {
		t.Fatal("client survived remove")
	}
	for _, p := range []string{config, filepath.Join(env.Home, BootSignal), filepath.Join(env.Home, SkillDir, "SKILL.md")} {
		if _, err := os.Stat(p); !os.IsNotExist(err) {
			t.Fatalf("remained: %s", p)
		}
	}
	if _, err := os.Stat(local); err != nil {
		t.Fatal("local file removed")
	}
	if _, ok := d.SyncCommand(env, k.address); ok {
		t.Fatal("removed native state still syncs")
	}
}

func TestGoogleIdentityConsentAndRedirect(t *testing.T) {
	for _, tc := range []struct {
		name, email, scopes string
		want                error
	}{
		{"identity mismatch", "other@example.test", googleScopes, AccountMismatch},
		{"partial consent", "person@example.test", "openid email https://www.googleapis.com/auth/drive", nil},
		{"nothing granted", "person@example.test", "openid email", NothingGranted},
		{"complete", "person@example.test", googleScopes, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := googleEnv(t)
			g := syntheticGoogle(t, &tc.email, tc.scopes)
			login, err := g.StartLogin(context.Background(), env, "person@example.test")
			if err != nil {
				t.Fatal(err)
			}
			l := login.(*googleLogin)
			prompt, _ := l.Prompt(context.Background())
			u, _ := url.Parse(prompt.AuthorizationURL)
			hash := sha256.Sum256([]byte(l.verifier))
			if u.Query().Get("code_challenge") != base64.RawURLEncoding.EncodeToString(hash[:]) {
				t.Fatal("PKCE")
			}
			paste := googleRedirect + "?" + url.Values{"state": {l.state}, "code": {"synthetic-code"}}.Encode()
			for _, bad := range []string{strings.Replace(paste, "localhost", "localhost.evil.test", 1), strings.Replace(paste, "localhost", "localhost:80", 1), paste + "&state=duplicate", paste + "#fragment", strings.Replace(paste, "state=", "state=bad", 1)} {
				if l.Redirect(context.Background(), bad) == nil {
					t.Fatal("accepted invalid redirect")
				}
			}
			if err := l.Redirect(context.Background(), paste); err != nil {
				t.Fatal(err)
			}
			if l.Redirect(context.Background(), paste) == nil {
				t.Fatal("duplicate")
			}
			address, err := l.Wait(context.Background())
			if err != tc.want {
				t.Fatalf("wait: %v", err)
			}
			accounts, _ := g.Accounts(env)
			if len(accounts) != 0 {
				t.Fatal("Wait persisted credentials")
			}
			if err == nil {
				if err := l.Commit(context.Background(), address); err != nil {
					t.Fatal(err)
				}
				if !googleHasToken(env, address) {
					t.Fatal("no native gog key")
				}
			}
		})
	}
}
func TestGoogleTwoAccountsAndExpiredDrive(t *testing.T) {
	env := googleEnv(t)
	email := "one@example.test"
	g := syntheticGoogle(t, &email, googleScopes)
	for _, a := range []string{"one@example.test", "two@example.test"} {
		email = a
		login, _ := g.StartLogin(context.Background(), env, "")
		l := login.(*googleLogin)
		l.Redirect(context.Background(), googleRedirect+"?"+url.Values{"state": {l.state}, "code": {"synthetic-code"}}.Encode())
		got, err := l.Wait(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if err := l.Commit(context.Background(), got); err != nil {
			t.Fatal(err)
		}
		if err := g.ChooseFolders(context.Background(), env, a, []string{"all"}); err != nil {
			t.Fatal(err)
		}
	}
	accounts, err := g.Accounts(env)
	if err != nil || len(accounts) != 2 {
		t.Fatalf("accounts %v %v", accounts, err)
	}
	os.WriteFile(filepath.Join(env.Home, "status-error"), []byte("{\"level\":\"error\",\"msg\":\"invalid_grant\"}\n"), 0600)
	if got := g.Check(context.Background(), env, email); got[0].State != StateLoginExpired || got[1].State != StateLoginExpired || got[2].State != StateLoginExpired || got[3].State != StateLoginExpired {
		t.Fatalf("status %v", got)
	}
	if err := g.Remove(context.Background(), env, "one@example.test"); err != nil {
		t.Fatal(err)
	}
	if googleHasToken(env, "one@example.test") || !googleHasToken(env, "two@example.test") {
		t.Fatal("removal crossed accounts")
	}
	accounts, err = g.Accounts(env)
	if err != nil || len(accounts) != 1 || accounts[0] != "two@example.test" {
		t.Fatal(accounts, err)
	}
}
func TestGoogleNativeStoreSafetyAndInterruptedCommit(t *testing.T) {
	env := googleEnv(t)
	email := "person@example.test"
	g := syntheticGoogle(t, &email, googleScopes)
	l0, _ := g.StartLogin(context.Background(), env, "")
	l := l0.(*googleLogin)
	l.Redirect(context.Background(), googleRedirect+"?"+url.Values{"state": {l.state}, "code": {"synthetic-code"}}.Encode())
	l.Wait(context.Background())
	// Fail the import after rclone's token has been written. No new account may
	// survive the failed/cancelled connection, nor be absent-but-still-usable.
	broken := filepath.Join(t.TempDir(), "gog")
	os.WriteFile(broken, []byte("#!/bin/sh\ncase \"$*\" in *import*) exit 1;; esac\ncat >/dev/null\n"), 0700)
	env.Config.Tools["gog"] = broken
	l.env = env
	if l.Commit(context.Background(), email) == nil {
		t.Fatal("import failure hidden")
	}
	if accounts, err := g.Accounts(env); err != nil || len(accounts) != 0 {
		t.Fatal(accounts, err)
	}
	// Inventory refuses a symlink rather than treating credentials outside its
	// native directory as an account; removal unlinks only the native key itself.
	keyring := filepath.Join(env.Home, googleGogHome, "data/keyring")
	outside := filepath.Join(t.TempDir(), "outside")
	os.WriteFile(outside, []byte("keep"), 0600)
	if err := os.Symlink(outside, filepath.Join(keyring, googleTokenNames(email)[0])); err != nil {
		t.Fatal(err)
	}
	if _, err := g.Accounts(env); err == nil {
		t.Fatal("symlink inventory accepted")
	}
	if err := g.Remove(context.Background(), env, email); err != nil {
		t.Fatal(err)
	}
	if data, _ := os.ReadFile(outside); string(data) != "keep" {
		t.Fatal("followed symlink")
	}
}

// Both accounts must reach every service before either account's probes are
// released. This catches provider-wide serialization as well as serial probes.
func TestGoogleChecksDoNotQueueAccountsBehindNetwork(t *testing.T) {
	env := googleEnv(t)
	g := &google{}
	fd, err := googleKeyring(env, true)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range []string{"one@example.test", "two@example.test"} {
		if err := writeFileAt(fd, googleTokenNames(a)[0], []byte("native-key"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	unix.Close(fd)
	fd, err = openHomeDir(env.Home, true, splitPath(googleDir)...)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range []string{"one@example.test", "two@example.test"} {
		if err := writeFileAt(fd, a+".conf", []byte("native-config"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	unix.Close(fd)
	rclone := filepath.Join(t.TempDir(), "rclone")
	if err := os.WriteFile(rclone, []byte(`#!/bin/sh
set -eu
touch "$HOME/drive-start-$(basename "$2")"
while [ ! -f "$HOME/release-drive" ]; do sleep 0.01; done
echo '{}'
`), 0700); err != nil {
		t.Fatal(err)
	}
	env.Config.Tools["rclone"] = rclone
	os.WriteFile(filepath.Join(env.Home, "block-probes"), nil, 0600)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	done := make(chan []Service, 2)
	for _, a := range []string{"one@example.test", "two@example.test"} {
		go func() { done <- g.Check(ctx, env, a) }()
	}

	driveDeadline := time.Now().Add(2 * time.Second)
	driveStarted := false
	for time.Now().Before(driveDeadline) {
		names, _ := filepath.Glob(filepath.Join(env.Home, "drive-start-*"))
		if len(names) == 2 {
			driveStarted = true
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	os.WriteFile(filepath.Join(env.Home, "release-drive"), nil, 0600)
	deadline := time.Now().Add(2 * time.Second)
	started := false
	for time.Now().Before(deadline) {
		names, _ := filepath.Glob(filepath.Join(env.Home, "probe-*"))
		if len(names) == 6 {
			started = true
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	os.WriteFile(filepath.Join(env.Home, "release-probes"), nil, 0600)
	for range 2 {
		for _, s := range <-done {
			if s.ID != "drive" && s.State != StateOK {
				t.Errorf("service %v", s)
			}
			// Signed in, never a first pass: name it, never "unknown".
			if s.ID == "drive" && (s.State != StateSyncFailed || s.Failure != FoldersNotChosen) {
				t.Errorf("drive without first sync %v", s)
			}
		}
	}
	if !started || !driveStarted {
		t.Fatal("account checks queued behind another account/service")
	}
}

// The skill names gog's Sheets, Docs and Slides commands and sends an API
// that is not enabled to the administrator, in the client's own project when
// its id names one.
func TestGoogleSkillSendsDisabledAPIToAdministrator(t *testing.T) {
	env := googleEnv(t)
	if u := googleEnableURL(env); strings.Contains(u, "project=") || !strings.Contains(u, "sheets.googleapis.com,docs.googleapis.com,slides.googleapis.com") {
		t.Fatal(u)
	}
	env.Config.Google.ClientID = "704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com"
	body := (&google{}).Skill(env, "p@example.test").Body
	for _, want := range []string{"`sheets`, `docs` and `slides`", "not enabled for this OAuth project", "administrator must enable", "apiid=" + googleAPIs + "&project=704213598812"} {
		if !strings.Contains(body, want) {
			t.Fatalf("skill lacks %q:\n%s", want, body)
		}
	}
}
