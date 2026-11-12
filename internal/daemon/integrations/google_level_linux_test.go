//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

// googleRevokes is a synthetic Google's record of revocations: the tokens
// revoked, in order, and the status the next revocation answers.
type googleRevokes struct {
	mu      sync.Mutex
	tokens  []string
	status  int
	refused string
}

func (r *googleRevokes) list() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.tokens...)
}

// levelGoogle is a synthetic Google for level sign-ins: each authorization
// exchange issues the next numbered refresh token with scope, and the
// revocation endpoint records what it ends.
func levelGoogle(t *testing.T, g *google, scope *string, revokes *googleRevokes) {
	t.Helper()
	var issued atomic.Int32
	base := g.client.Transport
	g.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		switch r.URL.String() {
		case "https://oauth2.googleapis.com/revoke":
			body, _ := io.ReadAll(r.Body)
			form, _ := url.ParseQuery(string(body))
			revokes.mu.Lock()
			defer revokes.mu.Unlock()
			status := revokes.status
			if status == 0 {
				status = 200
			}
			if status == 200 {
				revokes.tokens = append(revokes.tokens, form.Get("token"))
			}
			reply := "{}"
			if revokes.refused != "" {
				reply = fmt.Sprintf(`{"error":%q}`, revokes.refused)
			}
			return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(reply))}, nil
		case "https://oauth2.googleapis.com/token":
			n := issued.Add(1)
			b, _ := json.Marshal(map[string]any{"access_token": "access-secret", "refresh_token": fmt.Sprintf("refresh-%d", n), "expires_in": 3600, "scope": *scope})
			return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(bytes.NewReader(b))}, nil
		}
		return base.RoundTrip(r)
	})
}

// googleSignIn runs one sign-in at level to its committed native login.
func googleSignIn(t *testing.T, g *google, env Env, address string, level Level) (*googleLogin, error) {
	t.Helper()
	login, err := g.StartLevelLogin(context.Background(), env, address, level)
	if err != nil {
		t.Fatal(err)
	}
	l := login.(*googleLogin)
	if err := l.Redirect(context.Background(), googleRedirect+"?"+url.Values{"state": {l.state}, "code": {"synthetic-code"}}.Encode()); err != nil {
		t.Fatal(err)
	}
	got, err := l.Wait(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return l, l.Commit(context.Background(), got)
}

func googleConfig(t *testing.T, env Env, address string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(env.Home, googleDir, address+".conf"))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

// Google offers Täysi and Vain luku, and shows the drafts level as one it
// does not offer. Vain luku asks for every service's read scope, and Drive
// is a one-way mirror.
func TestGoogleReadLevelMirrorsDrive(t *testing.T) {
	env := googleEnv(t)
	email := "person@example.test"
	g := syntheticGoogle(t, &email, googleScopes)
	scope := googleReadScopes
	levelGoogle(t, g, &scope, &googleRevokes{})
	c := New(env, []Entry{g}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()
	h := c.Handler(allow)

	_, list, _ := call(t, h, "GET", ListPath, "", nil)
	raw, _ := json.Marshal(list["providers"].([]any)[0].(map[string]any)["levels"])
	var levels []LevelOption
	if json.Unmarshal(raw, &levels) != nil || !slices.Equal(levels, []LevelOption{{LevelFull, true, ""}, {LevelDrafts, false, LevelNotOffered}, {LevelRead, true, ""}}) {
		t.Fatal(string(raw))
	}
	if code, out, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google", "level": "drafts"}); code != 409 || out["error"].(map[string]any)["code"] != "level_unavailable" {
		t.Fatal("a level Google does not offer started", code, out)
	}
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google", "level": "read"})
	view := waitState(t, h, ownerA, "open_url")
	auth, _ := url.Parse(view["authorization_url"].(string))
	if auth.Query().Get("scope") != googleReadScopes {
		t.Fatal("read level asked for", auth.Query().Get("scope"))
	}
	id := view["attempt_id"].(string)
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": googleRedirect + "?" + url.Values{"state": {auth.Query().Get("state")}, "code": {"synthetic-code"}}.Encode()})
	waitState(t, h, ownerA, "choose_folders")
	if config := googleConfig(t, env, email); !strings.Contains(config, "scope = drive.readonly\n") {
		t.Fatal(config)
	}
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all"}})
	waitState(t, h, ownerA, "completed")
	waitLoginWorker(t, c)

	mirrors, _ := os.ReadFile(filepath.Join(env.Home, "mirrors"))
	if !strings.Contains(string(mirrors), "google: "+filepath.Join(env.Home, "cloud/google-drive", email)) {
		t.Fatalf("no initial mirror: %q", mirrors)
	}
	if _, err := os.Stat(filepath.Join(env.Home, "resyncs")); err == nil {
		t.Fatal("a read grant ran bisync")
	}
	cmd, ok := g.SyncCommand(env, email)
	if script := strings.Join(cmd.Args, " "); !ok || strings.Contains(script, "'bisync'") || !strings.Contains(script, "'sync' 'google:'") || !c.sync.supervised(key{Google, email}) {
		t.Fatal("mirror not supervised:", script)
	}
	_, list, _ = call(t, h, "GET", ListPath, "", nil)
	account := list["accounts"].([]any)[0].(map[string]any)
	drive := account["services"].([]any)[0].(map[string]any)
	grant := account["grant"].(map[string]any)
	if account["level"] != "read" || drive["access"] != "read" || drive["directory"] != "~/cloud/google-drive/"+email || drive["last_synced_at"] == nil || len(grant["not_granted"].([]any)) != 0 {
		t.Fatal(account)
	}
	if s := g.Skill(env, email); !s.Mirrored || s.Synced || !strings.Contains(s.Body, "one-way mirror") || !strings.Contains(s.Body, "Gmail: read only") {
		t.Fatal(s.Body)
	}
	// A renewal without a level asks for the account's own set again.
	login, err := g.StartLevelLogin(context.Background(), env, email, "")
	if err != nil {
		t.Fatal(err)
	}
	if auth, _ := url.Parse(login.(*googleLogin).auth); auth.Query().Get("scope") != googleReadScopes {
		t.Fatal("renewal changed the level", auth.Query().Get("scope"))
	}
}

// A grant narrowed on the consent page is no level, and what is missing is
// counted from the set its level asked for.
func TestGoogleLevelIsReadFromTheGrant(t *testing.T) {
	env := googleEnv(t)
	email := "person@example.test"
	g := syntheticGoogle(t, &email, googleScopes)
	scope := "openid email " + googleScope + "drive.readonly " + googleScope + "calendar.readonly"
	levelGoogle(t, g, &scope, &googleRevokes{})
	if _, err := googleSignIn(t, g, env, "", LevelRead); err != nil {
		t.Fatal(err)
	}
	services, grant := g.CheckGrant(context.Background(), env, email)
	if g.Level(env, email, services) != "" || grant == nil || !slices.Equal(grant.NotGranted, []string{googleScope + "contacts.readonly", googleScope + "gmail.readonly"}) {
		t.Fatal(services, grant)
	}
	scope = googleScopes
	if _, err := googleSignIn(t, g, env, email, LevelFull); err != nil {
		t.Fatal(err)
	}
	services, grant = g.CheckGrant(context.Background(), env, email)
	if g.Level(env, email, services) != LevelFull || len(grant.NotGranted) != 0 {
		t.Fatal(services, grant)
	}
}

// A level change ends the old grant at Google before the new sign-in, since
// Google's revocation ends every token of the application at once. Where
// Drive stops syncing both ways it first syncs both ways once more; when
// that pass or the revocation fails, nothing changes and no sign-in starts.
func TestGoogleLevelChangeRevokesBeforeSigningIn(t *testing.T) {
	env := googleEnv(t)
	email := "person@example.test"
	g := syntheticGoogle(t, &email, googleScopes)
	scope := googleScopes
	revokes := &googleRevokes{}
	levelGoogle(t, g, &scope, revokes)
	if _, err := googleSignIn(t, g, env, "", LevelFull); err != nil {
		t.Fatal(err)
	}
	if err := g.ChooseFolders(context.Background(), env, email, []string{"all"}); err != nil {
		t.Fatal(err)
	}
	full := googleConfig(t, env, email)
	c := New(env, []Entry{g}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()
	h := c.Handler(allow)
	start := func(level Level) {
		t.Helper()
		if code, out, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google", "address": email, "level": string(level)}); code != 200 {
			t.Fatal(code, out)
		}
	}

	// The same level is a renewal: nothing is revoked first.
	start(LevelFull)
	waitState(t, h, ownerA, "open_url")
	if len(revokes.list()) != 0 {
		t.Fatal("a renewal revoked", revokes.list())
	}

	os.WriteFile(filepath.Join(env.Home, "pass-fail"), nil, 0600)
	start(LevelRead)
	if view := waitState(t, h, ownerA, "failed"); view["failure"] != "final_sync_failed" {
		t.Fatal(view)
	}
	waitLoginWorker(t, c)
	if len(revokes.list()) != 0 || googleConfig(t, env, email) != full {
		t.Fatal("a failed last pass changed the login", revokes.list())
	}
	os.Remove(filepath.Join(env.Home, "pass-fail"))

	revokes.mu.Lock()
	revokes.status = 503
	revokes.mu.Unlock()
	start(LevelRead)
	if view := waitState(t, h, ownerA, "failed"); view["failure"] != "revoke_failed" {
		t.Fatal(view)
	}
	waitLoginWorker(t, c)
	if googleConfig(t, env, email) != full {
		t.Fatal("an unrevoked change replaced the login")
	}
	if _, ok := g.SyncCommand(env, email); !ok || !c.sync.supervised(key{Google, email}) {
		t.Fatal("a refused change stopped the two-way sync")
	}
	revokes.mu.Lock()
	revokes.status = 0
	revokes.mu.Unlock()

	os.Remove(filepath.Join(env.Home, "passes"))
	start(LevelRead)
	view := waitState(t, h, ownerA, "open_url")
	// Both happened before the person was sent to Google.
	if passes, _ := os.ReadFile(filepath.Join(env.Home, "passes")); !strings.HasPrefix(string(passes), "pass\n") || !slices.Equal(revokes.list(), []string{"refresh-1"}) {
		t.Fatalf("passes %q, revoked %v", passes, revokes.list())
	}
	auth, _ := url.Parse(view["authorization_url"].(string))
	if auth.Query().Get("scope") != googleReadScopes {
		t.Fatal(auth.Query().Get("scope"))
	}
	scope = googleReadScopes
	id := view["attempt_id"].(string)
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": googleRedirect + "?" + url.Values{"state": {auth.Query().Get("state")}, "code": {"synthetic-code"}}.Encode()})
	waitState(t, h, ownerA, "choose_folders")
	if names, _ := os.ReadDir(filepath.Join(env.Home, googleWork(email))); len(names) != 0 {
		t.Fatal("two-way listings outlived the change", names)
	}
	if config := googleConfig(t, env, email); !strings.Contains(config, "scope = drive.readonly\n") || !strings.Contains(config, `"refresh_token":"refresh-`) || strings.Contains(config, `"refresh_token":"refresh-1"`) {
		t.Fatal(config)
	}
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all"}})
	waitState(t, h, ownerA, "completed")
	waitLoginWorker(t, c)
	if !slices.Equal(revokes.list(), []string{"refresh-1"}) {
		t.Fatal("the new grant was revoked too", revokes.list())
	}
	if cmd, ok := g.SyncCommand(env, email); !ok || strings.Contains(strings.Join(cmd.Args, " "), "'bisync'") {
		t.Fatal("read level kept syncing both ways")
	}

	// Back to Täysi: a mirror has nothing to sync back, Drive syncs both
	// ways again after the person's choice.
	scope = googleScopes
	os.Remove(filepath.Join(env.Home, "passes"))
	c.sync.stopAll()
	start(LevelFull)
	view = waitState(t, h, ownerA, "open_url")
	if _, err := os.Stat(filepath.Join(env.Home, "passes")); err == nil || len(revokes.list()) != 2 {
		t.Fatal("a mirror synced both ways, or the read grant stayed", revokes.list())
	}
	auth, _ = url.Parse(view["authorization_url"].(string))
	id = view["attempt_id"].(string)
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": googleRedirect + "?" + url.Values{"state": {auth.Query().Get("state")}, "code": {"synthetic-code"}}.Encode()})
	waitState(t, h, ownerA, "choose_folders")
	if _, err := os.Stat(filepath.Join(env.Home, googleWork(email), mirrorDone)); err == nil {
		t.Fatal("the mirror's marker outlived the change")
	}
}

// An account whose grant gave rclone no login is revoked with gog's token.
func TestGoogleLevelChangeWithoutDriveRevokesGogsToken(t *testing.T) {
	env := googleEnv(t)
	email := "person@example.test"
	g := syntheticGoogle(t, &email, googleScopes)
	scope := "openid email " + googleScope + "gmail.modify"
	revokes := &googleRevokes{}
	levelGoogle(t, g, &scope, revokes)
	if _, err := googleSignIn(t, g, env, "", LevelFull); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(env.Home, googleDir, email+".conf")); !os.IsNotExist(err) {
		t.Fatal(err)
	}
	if err := g.endLevel(context.Background(), env, email, LevelRead); err != nil || !slices.Equal(revokes.list(), []string{"refresh-1"}) {
		t.Fatal(err, revokes.list())
	}
	// A grant Google no longer knows is already ended.
	revokes.mu.Lock()
	revokes.status, revokes.refused = 400, "invalid_token"
	revokes.mu.Unlock()
	if err := g.endLevel(context.Background(), env, email, LevelRead); err != nil {
		t.Fatal(err)
	}
	revokes.mu.Lock()
	revokes.refused = "invalid_request"
	revokes.mu.Unlock()
	if err := g.endLevel(context.Background(), env, email, LevelRead); !errors.Is(err, RevokeFailed) {
		t.Fatal(err)
	}
}

// A token gog holds but cannot export cannot be ended, so the change fails.
func TestGoogleLevelChangeFailsWhenTheTokenCannotBeRead(t *testing.T) {
	env := googleEnv(t)
	email := "person@example.test"
	g := syntheticGoogle(t, &email, googleScopes)
	scope := "openid email " + googleScope + "gmail.modify"
	revokes := &googleRevokes{}
	levelGoogle(t, g, &scope, revokes)
	if _, err := googleSignIn(t, g, env, "", LevelFull); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(env.Home, "export-fail"), nil, 0600)
	if err := g.endLevel(context.Background(), env, email, LevelRead); !errors.Is(err, RevokeFailed) || len(revokes.list()) != 0 {
		t.Fatal(err, revokes.list())
	}
}

// A renewal keeps the account's own level: from rclone's Drive scope when
// gog cannot say, and not at all when neither can, rather than guessing.
func TestGoogleRenewalNeverGuessesTheLevel(t *testing.T) {
	env := googleEnv(t)
	email := "person@example.test"
	g := syntheticGoogle(t, &email, googleScopes)
	scope := googleReadScopes
	levelGoogle(t, g, &scope, &googleRevokes{})
	if _, err := googleSignIn(t, g, env, "", LevelRead); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(env.Home, "gog-fail"), nil, 0600)
	login, err := g.StartLevelLogin(context.Background(), env, email, "")
	if err != nil {
		t.Fatal(err)
	}
	if auth, _ := url.Parse(login.(*googleLogin).auth); auth.Query().Get("scope") != googleReadScopes {
		t.Fatal("renewal broadened the account", auth.Query().Get("scope"))
	}
	os.Remove(filepath.Join(env.Home, googleDir, email+".conf"))
	if _, err := g.StartLevelLogin(context.Background(), env, email, ""); err == nil {
		t.Fatal("renewed at a guessed level")
	}
}

// A new connection that turns out to be an account already connected at
// another level is refused: only a level change ends the old grant first.
// At the account's own level it is a renewal.
func TestGoogleNewConnectionToAnExistingAccountKeepsItsLevel(t *testing.T) {
	env := googleEnv(t)
	email := "person@example.test"
	g := syntheticGoogle(t, &email, googleScopes)
	scope := googleScopes
	revokes := &googleRevokes{}
	levelGoogle(t, g, &scope, revokes)
	if _, err := googleSignIn(t, g, env, "", LevelFull); err != nil {
		t.Fatal(err)
	}
	full := googleConfig(t, env, email)
	scope = googleReadScopes
	login, err := g.StartLevelLogin(context.Background(), env, "", LevelRead)
	if err != nil {
		t.Fatal(err)
	}
	l := login.(*googleLogin)
	l.Redirect(context.Background(), googleRedirect+"?"+url.Values{"state": {l.state}, "code": {"synthetic-code"}}.Encode())
	if _, err := l.Wait(context.Background()); !errors.Is(err, AlreadyConnected) {
		t.Fatal(err)
	}
	if googleConfig(t, env, email) != full || len(revokes.list()) != 0 {
		t.Fatal("a refused connection changed the account")
	}
	scope = googleScopes
	if _, err := googleSignIn(t, g, env, "", LevelFull); err != nil {
		t.Fatal("same level connection refused", err)
	}
}
