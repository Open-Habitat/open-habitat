//go:build linux

package integrations

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type dropboxTransport func(*http.Request) (*http.Response, error)

func (f dropboxTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// dropboxRevoked is the refresh token the synthetic Dropbox last revoked.
var dropboxRevoked atomic.Value

func fakeRclone(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "rclone")
	// A fake native store and pass runner, not a daemon connection registry.
	script := `#!/bin/sh
set -eu
[ "$HOME" != / ]
[ "$1" = --config ]; config=$2; shift 2
[ -f "$config" ]
command=$1; shift
case "$command" in
about)
 if [ -f "$HOME/status-error" ]; then cat "$HOME/status-error" >&2; exit 7; fi
 if [ -f "$HOME/drive-about" ]; then cat "$HOME/drive-about"; else echo '{"used":1,"total":10000}'; fi;;
lsjson)
 if [ -f "$HOME/drive-top" ]; then cat "$HOME/drive-top"; else exit 90; fi;;
size)
 # drive-sizes holds "path<TAB>bytes" lines; "<path>@root" is the files at
 # the path itself (--max-depth 1).
 if [ ! -f "$HOME/drive-sizes" ]; then echo '{"count":2,"bytes":1024}'; exit 0; fi
 key=$1; case " $* " in *" --max-depth 1 "*) key="$1@root";; esac
 echo "$key" >> "$HOME/size-calls"
 while [ -f "$HOME/hold-size" ]; do sleep 0.02; done
 n=$(awk -F '\t' -v k="$key" '$1==k{print $2}' "$HOME/drive-sizes")
 [ -n "$n" ] || exit 7
 echo "{\"count\":1,\"bytes\":$n}";;
bisync)
 echo "$*" >> "$HOME/bisync-args"
 resync=false; work=''
 while [ "$#" -gt 0 ]; do
  case "$1" in --workdir) work=$2; shift;; --resync) resync=true;; --force) exit 91;; esac
  shift
 done
 if "$resync"; then
  # Like rclone, refuse a pair whose lock is still there, unless it expired.
  for lock in "$work"/*.lck; do [ ! -e "$lock" ] || grep -q '"TimeExpires":"20[01]' "$lock" || exit 92; done
  echo "$work" >> "$HOME/resyncs"
  while [ -f "$HOME/hold-resync" ]; do sleep 0.02; done
  [ ! -f "$HOME/resync-fail" ] || exit 7
  printf 'native listing\n' > "$work/local..dropbox.path1.lst"
  printf 'native listing\n' > "$work/local..dropbox.path2.lst"
 else
  [ -f "$work/local..dropbox.path1.lst" ]
  while [ -f "$HOME/hold-pass" ]; do sleep 0.02; done
  [ ! -f "$HOME/pass-fail" ] || exit 7
  echo pass >> "$HOME/passes"
 fi;;
sync)
 echo "$1 $2" >> "$HOME/mirrors"
 [ ! -f "$HOME/mirror-fail" ] || exit 7
 mkdir -p "$2";;
*) exit 90;;
esac
`
	if err := os.WriteFile(path, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	return path
}
func dropboxEnv(t *testing.T) Env {
	return Env{Home: newHome(t), FixtureTools: true, Config: Config{Tools: map[string]string{"rclone": fakeRclone(t)}, Dropbox: &DropboxApp{ClientID: "app-key", ClientSecret: "app-secret"}}}
}
func syntheticDropbox(t *testing.T, email *string, exchanges *atomic.Int32) *dropbox {
	t.Helper()
	return &dropbox{client: &http.Client{Transport: dropboxTransport(func(r *http.Request) (*http.Response, error) {
		t.Helper()
		var body string
		switch r.URL.String() {
		case "https://api.dropboxapi.com/oauth2/token":
			if err := r.ParseForm(); err != nil {
				t.Fatal(err)
			}
			if r.Form.Get("grant_type") == "refresh_token" {
				// Revoking a replaced login redeems it first.
				if r.Form.Get("client_secret") == "" || r.Form.Get("refresh_token") == "" {
					t.Errorf("invalid refresh fields")
				}
				body = `{"access_token":"revoking-` + r.Form.Get("refresh_token") + `","token_type":"bearer","expires_in":14400}`
				break
			}
			exchanges.Add(1)
			if r.Form.Get("code") != "synthetic-code" || r.Form.Get("client_id") != "app-key" || r.Form.Get("client_secret") != "app-secret" || r.Form.Get("redirect_uri") != "http://localhost:53682/" || r.Form.Get("grant_type") != "authorization_code" || len(r.Form.Get("code_verifier")) != 43 {
				t.Errorf("invalid exchange fields")
			}
			body = `{"access_token":"access-secret","refresh_token":"refresh-secret","token_type":"bearer","expires_in":14400}`
		case "https://api.dropboxapi.com/2/users/get_current_account":
			if r.Header.Get("Authorization") != "Bearer access-secret" {
				t.Error("missing bearer")
			}
			body = fmt.Sprintf(`{"email":%q,"email_verified":true}`, *email)
		case "https://api.dropboxapi.com/2/auth/token/revoke":
			dropboxRevoked.Store(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer revoking-"))
			body = "null"
		default:
			t.Fatalf("unexpected network destination: %s", r.URL)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}}
}
func dropboxPaste(t *testing.T, view map[string]any) string {
	t.Helper()
	auth, err := url.Parse(view["authorization_url"].(string))
	if err != nil {
		t.Fatal(err)
	}
	q := auth.Query()
	if auth.Host != "www.dropbox.com" || q.Get("token_access_type") != "offline" || q.Get("code_challenge_method") != "S256" || q.Get("redirect_uri") != dropboxRedirect || q.Get("state") == "" {
		t.Fatalf("bad authorization prompt: %s", auth)
	}
	return dropboxRedirect + "?" + url.Values{"state": {q.Get("state")}, "code": {"synthetic-code"}}.Encode()
}
func TestDropboxConnectSyncRestartAndRemove(t *testing.T) {
	env := dropboxEnv(t)
	email := "PERSON@example.test"
	var exchanges atomic.Int32
	d := syntheticDropbox(t, &email, &exchanges)
	c := New(env, []Entry{d}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()
	h := c.Handler(allow)
	code, _, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "dropbox"})
	if code != 200 {
		t.Fatal(code)
	}
	view := waitState(t, h, ownerA, "open_url")
	paste := dropboxPaste(t, view)
	id := view["attempt_id"].(string)
	for _, raw := range []string{strings.Replace(paste, "localhost:53682", "localhost:53683", 1), strings.Replace(paste, "state=", "state=wrong", 1), strings.Replace(paste, "/?", "/other?", 1)} {
		// The entry rejects even a loopback URL that the generic relay accepts.
		login, _ := d.StartLogin(ctx, env, "")
		if login.Redirect(ctx, raw) == nil {
			t.Fatal("wrong state/port/path accepted")
		}
	}
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": paste})
	view = waitState(t, h, ownerA, "choose_folders")
	if view["directory"] != "~/cloud/dropbox/person@example.test" {
		t.Fatal(view)
	}
	config := filepath.Join(env.Home, dropboxDir, "person@example.test.conf")
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
	k := key{Dropbox, "person@example.test"}
	if !c.sync.supervised(k) {
		t.Fatal("not supervised")
	}
	if _, err := os.Stat(filepath.Join(env.Home, BootSignal)); err != nil {
		t.Fatal(err)
	}
	skill, err := os.ReadFile(filepath.Join(env.Home, SkillDir, "SKILL.md"))
	if err != nil || !bytes.Contains(skill, []byte("~/cloud/dropbox/person@example.test/")) || !bytes.Contains(skill, []byte("In a folder that syncs both ways")) {
		t.Fatalf("skill: %v", err)
	}
	cmd, ok := d.SyncCommand(env, k.address)
	if !ok || strings.Contains(strings.Join(cmd.Args, " "), "--resync") {
		t.Fatal("ordinary run can resync")
	}
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
	local := filepath.Join(env.Home, "cloud/dropbox", k.address, "keep.txt")
	os.WriteFile(local, []byte("personal file"), 0600)
	code, out, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "dropbox", "address": k.address, "delete_directories": false})
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

func TestDropboxPKCEStateAndAccountMismatch(t *testing.T) {
	env := dropboxEnv(t)
	email := "another@example.test"
	var exchanges atomic.Int32
	d := syntheticDropbox(t, &email, &exchanges)
	login, err := d.StartLogin(context.Background(), env, "original@example.test")
	if err != nil {
		t.Fatal(err)
	}
	l := login.(*dropboxLogin)
	prompt, _ := l.Prompt(context.Background())
	u, _ := url.Parse(prompt.AuthorizationURL)
	hash := sha256.Sum256([]byte(l.verifier))
	if u.Query().Get("code_challenge") != base64.RawURLEncoding.EncodeToString(hash[:]) {
		t.Fatal("PKCE mismatch")
	}
	wrong := dropboxRedirect + "?state=wrong&code=synthetic-code"
	if l.Redirect(context.Background(), wrong) == nil || exchanges.Load() != 0 {
		t.Fatal("invalid state exchanged")
	}
	good := dropboxRedirect + "?" + url.Values{"state": {l.state}, "code": {"synthetic-code"}}.Encode()
	if err := l.Redirect(context.Background(), good); err != nil {
		t.Fatal(err)
	}
	if _, err := l.Wait(context.Background()); err != AccountMismatch {
		t.Fatalf("mismatch: %v", err)
	}
	if accounts, err := d.Accounts(env); err != nil || len(accounts) != 0 {
		t.Fatal("mismatched credentials persisted")
	}
}

func TestDropboxAvailabilityAndUnsafeHomes(t *testing.T) {
	env := dropboxEnv(t)
	d := &dropbox{}
	if !d.Available(env) || UnavailableReason(d, env) != "" {
		t.Fatal("fixture unavailable")
	}
	cfg := env.Config
	env.Config.Dropbox = nil
	if d.Available(env) || UnavailableReason(d, env) != "app_credentials_required" {
		t.Fatal("available without operator app")
	}
	env.Config = cfg
	env.Config.Tools["rclone"] = "/missing/rclone"
	if d.Available(env) || UnavailableReason(d, env) != "tool_unavailable" {
		t.Fatal("available without rclone")
	}
	// The administrator's row names the tool, so it must be the one missing.
	if m := MissingTools(d, env); len(m) != 1 || m[0] != "rclone" || MissingTools(&google{}, env)[0] != "rclone" {
		t.Fatalf("missing tools %v", m)
	}
	env.Config.Tools["rclone"] = fakeRclone(t)
	outside := t.TempDir()
	os.MkdirAll(filepath.Join(env.Home, ".config"), 0700)
	os.Symlink(outside, filepath.Join(env.Home, ".config/rclone"))
	if _, err := d.Accounts(env); err == nil {
		t.Fatal("symlinked config trusted")
	}
	l := &dropboxLogin{entry: d, env: env, app: *env.Config.Dropbox, token: []byte(`{"access_token":"secret"}`)}
	if err := l.Commit(context.Background(), "p@example.test"); err == nil {
		t.Fatal("wrote through config symlink")
	}
	entries, _ := os.ReadDir(outside)
	if len(entries) != 0 {
		t.Fatal("outside home changed")
	}
}

// Optional proof against the operator-pinned rclone, with an alias backend in
// a disposable home. No provider, tokens or real files are involved.
func TestDropboxNativeBisync(t *testing.T) {
	tool := os.Getenv("OH_TEST_RCLONE")
	if tool == "" {
		t.Skip("set OH_TEST_RCLONE to the disposable rclone v1.71.2 executable")
	}
	env := dropboxEnv(t)
	env.Config.Tools["rclone"] = tool
	d := &dropbox{}
	address := "p@example.test"
	local := filepath.Join(env.Home, "cloud/dropbox", address)
	remote := filepath.Join(env.Home, "synthetic-provider")
	for _, p := range []string{local, remote, filepath.Join(env.Home, dropboxDir)} {
		if err := os.MkdirAll(p, 0700); err != nil {
			t.Fatal(err)
		}
	}
	write := func(p, s string) {
		t.Helper()
		if err := os.WriteFile(p, []byte(s), 0600); err != nil {
			t.Fatal(err)
		}
	}
	read := func(p string) string {
		t.Helper()
		b, err := os.ReadFile(p)
		if err != nil {
			t.Fatal(err)
		}
		return string(b)
	}
	write(filepath.Join(env.Home, dropboxDir, address+".conf"), "[dropbox]\ntype = alias\nremote = "+remote+"\n")
	write(filepath.Join(local, "collision.txt"), "original local")
	write(filepath.Join(remote, "collision.txt"), "original cloud")
	write(filepath.Join(remote, "download.txt"), "cloud file")
	// Enough files to distinguish one deliberate deletion from the 50%
	// mass-deletion fence.
	for i := 0; i < 20; i++ {
		write(filepath.Join(remote, fmt.Sprintf("filler-%02d.txt", i)), "unchanged")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := d.ChooseFolders(ctx, env, address, []string{"all"}); err != nil {
		t.Fatal(err)
	}
	if read(filepath.Join(local, "download.txt")) != "cloud file" || read(filepath.Join(local, "collision.txt")) != "original cloud" {
		t.Fatal("initial download failed")
	}
	backup := filepath.Join(env.Home, ".local/share/rclone/dropbox-backups", address, "collision.txt")
	if read(backup) != "original local" {
		t.Fatal("initial union discarded a local version")
	}
	if _, ok := d.SyncCommand(env, address); !ok {
		t.Fatal("real native listings not recognized")
	}
	write(filepath.Join(local, "upload.txt"), "new local")
	write(filepath.Join(remote, "other.txt"), "new cloud")
	cmd, ok := dropboxBisync(env, address)
	if !ok {
		t.Fatal("no native command")
	}
	if _, err := env.run(ctx, cmd, nil); err != nil {
		t.Fatal(err)
	}
	if read(filepath.Join(remote, "upload.txt")) != "new local" || read(filepath.Join(local, "other.txt")) != "new cloud" {
		t.Fatal("two-way pass failed")
	}
	if err := os.Remove(filepath.Join(local, "filler-00.txt")); err != nil {
		t.Fatal(err)
	}
	if _, err := env.run(ctx, cmd, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(remote, "filler-00.txt")); !os.IsNotExist(err) {
		t.Fatal("deliberate local deletion did not reach cloud")
	}
	write(filepath.Join(local, "collision.txt"), "edited locally")
	write(filepath.Join(remote, "collision.txt"), "edited in cloud")
	if _, err := env.run(ctx, cmd, nil); err != nil {
		t.Fatal(err)
	}
	versions := map[string]bool{}
	_ = filepath.WalkDir(local, func(path string, entry os.DirEntry, err error) error {
		if err == nil && !entry.IsDir() {
			b, e := os.ReadFile(path)
			if e == nil {
				versions[string(b)] = true
			}
		}
		return err
	})
	if !versions["edited locally"] || !versions["edited in cloud"] {
		t.Fatal("two-way conflict discarded a version")
	}
	// Missing/corrupt listings must not cause an implicit resync.
	entries, err := os.ReadDir(filepath.Join(env.Home, dropboxWork(address)))
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if strings.Contains(e.Name(), ".lst") {
			os.Remove(filepath.Join(env.Home, dropboxWork(address), e.Name()))
		}
	}
	if _, err := env.run(ctx, cmd, nil); err == nil {
		t.Fatal("missing state silently resynced")
	}
	if read(filepath.Join(remote, "upload.txt")) != "new local" {
		t.Fatal("failed pass damaged provider")
	}
	// Reinitialize explicitly, then a catastrophic deletion is refused.
	if err := d.ChooseFolders(ctx, env, address, []string{"all"}); err != nil {
		t.Fatal(err)
	}
	files, _ := os.ReadDir(local)
	for _, f := range files {
		os.Remove(filepath.Join(local, f.Name()))
	}
	if _, err := env.run(ctx, cmd, nil); err == nil {
		t.Fatal("mass deletion propagated")
	}
	if read(filepath.Join(remote, "upload.txt")) != "new local" {
		t.Fatal("deletion safeguard failed")
	}
}

func TestDropboxInterruptedFirstChoiceCanBeRetried(t *testing.T) {
	env := dropboxEnv(t)
	email := "person@example.test"
	var exchanges atomic.Int32
	d := syntheticDropbox(t, &email, &exchanges)
	// Native login persisted, but the daemon died before the person chose sync.
	if err := os.MkdirAll(filepath.Join(env.Home, dropboxDir), 0700); err != nil {
		t.Fatal(err)
	}
	config := filepath.Join(env.Home, dropboxDir, email+".conf")
	if err := os.WriteFile(config, []byte("[dropbox]\ntype = dropbox\ntoken = {}\n"), 0600); err != nil {
		t.Fatal(err)
	}
	c := New(env, []Entry{d}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()
	if c.sync.supervised(key{Dropbox, email}) {
		t.Fatal("uninitialized bisync started")
	}
	if d.Check(ctx, env, email)[0].State == StateOK {
		t.Fatal("uninitialized sync presented as healthy")
	}
	h := c.Handler(allow)
	retry := func() string {
		t.Helper()
		code, _, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "dropbox", "address": email})
		if code != 200 {
			t.Fatal(code)
		}
		view := waitState(t, h, ownerA, "open_url")
		id := view["attempt_id"].(string)
		call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": dropboxPaste(t, view)})
		waitState(t, h, ownerA, "choose_folders")
		return id
	}
	id := retry()
	call(t, h, "DELETE", LoginPath, ownerA, map[string]any{"action": "cancel", "attempt_id": id})
	waitState(t, h, ownerA, "failed")
	id = retry() // waits for predecessor cleanup; existing native login must survive
	if _, err := os.Stat(config); err != nil {
		t.Fatal("cancelling retry removed an existing login")
	}
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all"}})
	waitState(t, h, ownerA, "completed")
	waitLoginWorker(t, c)
	if !c.sync.supervised(key{Dropbox, email}) {
		t.Fatal("retry did not initialize sync")
	}
}

func TestDropboxNativeOAuthSecret(t *testing.T) {
	tool := os.Getenv("OH_TEST_RCLONE")
	if tool == "" {
		t.Skip("set OH_TEST_RCLONE to the disposable rclone v1.71.2 executable")
	}
	env := dropboxEnv(t)
	env.Config.Tools["rclone"] = tool
	d := &dropbox{}
	address := "p@example.test"
	l := &dropboxLogin{entry: d, env: env, app: *env.Config.Dropbox, token: []byte(`{"access_token":"expired-synthetic","refresh_token":"synthetic-refresh","expiry":"2000-01-01T00:00:00Z","token_type":"bearer"}`)}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	var correct atomic.Bool
	endpoint := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		id, secret, ok := r.BasicAuth()
		if !ok {
			id, secret = r.Form.Get("client_id"), r.Form.Get("client_secret")
		}
		if id == "app-key" && secret == "app-secret" && r.Form.Get("refresh_token") == "synthetic-refresh" && r.Form.Get("grant_type") == "refresh_token" {
			correct.Store(true)
		}
		// Never return a token: rclone must stop at this local endpoint, before
		// any authorized request can reach an actual Dropbox API.
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		io.WriteString(w, `{"error":"invalid_grant"}`)
	}))
	defer endpoint.Close()
	config := filepath.Join(env.Home, dropboxDir, address+".conf")
	f, err := os.OpenFile(config, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Fprintln(f, "token_url = "+endpoint.URL)
	f.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd, ok := dropboxCommand(env, address, "about", "dropbox:", "--json")
	if !ok {
		t.Fatal("missing config")
	}
	if _, err := env.run(ctx, cmd, nil); err == nil {
		t.Fatal("rejected refresh unexpectedly succeeded")
	}
	if !correct.Load() {
		t.Fatal("rclone did not use the exact app secret written to its native store")
	}
}

func TestDropboxInitialSyncRefusesSymlinkedDataAndBackup(t *testing.T) {
	for _, rel := range []string{"cloud/dropbox", dropboxDir + "/bisync", ".local/share/rclone/dropbox-backups"} {
		t.Run(rel, func(t *testing.T) {
			env := dropboxEnv(t)
			d := &dropbox{}
			address := "p@example.test"
			if err := os.MkdirAll(filepath.Join(env.Home, dropboxDir), 0700); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(env.Home, dropboxDir, address+".conf"), []byte("[dropbox]\ntype=dropbox\n"), 0600); err != nil {
				t.Fatal(err)
			}
			outside := t.TempDir()
			link := filepath.Join(env.Home, rel)
			if err := os.MkdirAll(filepath.Dir(link), 0700); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink(outside, link); err != nil {
				t.Fatal(err)
			}
			if err := d.ChooseFolders(context.Background(), env, address, []string{"all"}); err == nil {
				t.Fatal("synced through a symlink")
			}
			entries, _ := os.ReadDir(outside)
			if len(entries) != 0 {
				t.Fatal("outside directory changed")
			}
		})
	}
}

func TestDropboxPartialListingsAreNotInitializedSync(t *testing.T) {
	env := dropboxEnv(t)
	d := &dropbox{}
	address := "p@example.test"
	work := filepath.Join(env.Home, dropboxWork(address))
	if err := os.MkdirAll(work, 0700); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(env.Home, dropboxDir, address+".conf"), []byte("[dropbox]\ntype = dropbox\n"), 0600)
	for _, suffix := range []string{"-new", "-old", "-err"} {
		for _, side := range []string{"1", "2"} {
			os.WriteFile(filepath.Join(work, "pair.path"+side+".lst"+suffix), nil, 0600)
		}
	}
	if _, ready := d.SyncCommand(env, address); ready {
		t.Fatal("partial or error listings initialized ordinary sync")
	}
	if d.Check(context.Background(), env, address)[0].State == StateOK {
		t.Fatal("partial listings presented as healthy")
	}
	skill := d.Skill(env, address)
	if skill.Synced || !strings.Contains(skill.Body, "initial sync is not ready") {
		t.Fatal("skill claims pending files are synced")
	}
	for _, side := range []string{"1", "2"} {
		os.WriteFile(filepath.Join(work, "pair.path"+side+".lst"), nil, 0600)
	}
	if _, ready := d.SyncCommand(env, address); !ready {
		t.Fatal("committed listings not recognized")
	}
}

// The test server's interrupted first pass: a release restart killed the
// initial resync, leaving only bisync's "-new" listings and a stale lock. The
// login still works, so the card must say why sync is not running, never
// "unknown", and the browser contract carries the reason.
func TestDropboxInterruptedInitialSyncIsNamed(t *testing.T) {
	env := dropboxEnv(t)
	d := &dropbox{}
	address := "p@example.test"
	work := filepath.Join(env.Home, dropboxWork(address))
	if err := os.MkdirAll(work, 0700); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(env.Home, dropboxDir, address+".conf"), []byte("[dropbox]\ntype = dropbox\n"), 0600)
	for _, name := range []string{"pair.path1.lst-new", "pair.path2.lst-new", "pair.lck"} {
		os.WriteFile(filepath.Join(work, name), nil, 0600)
	}
	c := New(env, []Entry{d}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
	code, out, _ := call(t, c.Handler(allow), "GET", ListPath, "", nil)
	if code != 200 {
		t.Fatalf("list: %d %v", code, out)
	}
	service := out["accounts"].([]any)[0].(map[string]any)["services"].([]any)[0].(map[string]any)
	if service["state"] != string(StateSyncFailed) || service["failure"] != InitialSyncIncomplete {
		t.Fatalf("interrupted first sync not named: %v", service)
	}
	for _, side := range []string{"1", "2"} {
		os.WriteFile(filepath.Join(work, "pair.path"+side+".lst"), nil, 0600)
	}
	if s := d.Check(context.Background(), env, address)[0]; s.State != StateOK || s.Failure != "" {
		t.Fatalf("completed first sync not healthy: %+v", s)
	}
}

func TestDropboxRejectedGrantIsNotANetworkOutage(t *testing.T) {
	env := dropboxEnv(t)
	d := &dropbox{}
	address := "p@example.test"
	os.MkdirAll(filepath.Join(env.Home, dropboxDir), 0700)
	os.WriteFile(filepath.Join(env.Home, dropboxDir, address+".conf"), []byte("[dropbox]\ntype = dropbox\n"), 0600)
	for _, tc := range []struct {
		reason string
		want   ServiceState
	}{
		{"invalid_grant", StateLoginExpired}, {"invalid_access_token", StateLoginExpired}, {"expired_access_token", StateLoginExpired},
		{"dial tcp: network unreachable", StateUnreachable}, {"invalid_client", StateUnreachable},
	} {
		t.Run(tc.reason, func(t *testing.T) {
			diagnostic := fmt.Sprintf("{\"level\":\"error\",\"msg\":%q}\n", tc.reason+" synthetic-opaque-secret")
			os.WriteFile(filepath.Join(env.Home, "status-error"), []byte(diagnostic), 0600)
			c := New(env, []Entry{d}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
			code, out, raw := call(t, c.Handler(allow), "GET", ListPath, "", nil)
			if code != 200 {
				t.Fatalf("list: %d %v", code, out)
			}
			accounts := out["accounts"].([]any)
			services := accounts[0].(map[string]any)["services"].([]any)
			if services[0].(map[string]any)["state"] != string(tc.want) {
				t.Fatalf("status was not classified: %v", out)
			}
			if strings.Contains(raw, "synthetic-opaque-secret") || strings.Contains(raw, tc.reason) {
				t.Fatal("native diagnostic crossed browser contract")
			}
		})
	}
}
