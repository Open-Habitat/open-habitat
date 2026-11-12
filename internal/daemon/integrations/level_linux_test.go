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
	"sync/atomic"
	"testing"
	"time"
)

// levelDropbox is a synthetic Dropbox for level sign-ins: each authorization
// exchange issues the next numbered refresh token for whichever application
// asked, with scope (empty: the reply names none).
func levelDropbox(t *testing.T, d *dropbox, scope *string) {
	t.Helper()
	var issued atomic.Int32
	base := d.client.Transport
	d.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != "https://api.dropboxapi.com/oauth2/token" {
			return base.RoundTrip(r)
		}
		body, _ := io.ReadAll(r.Body)
		form, _ := url.ParseQuery(string(body))
		if form.Get("grant_type") != "authorization_code" {
			r.Body = io.NopCloser(bytes.NewReader(body))
			return base.RoundTrip(r)
		}
		n := issued.Add(1)
		reply := fmt.Sprintf(`{"access_token":"access-secret","refresh_token":"refresh-%d","token_type":"bearer","expires_in":14400`, n)
		if *scope != "" {
			reply += fmt.Sprintf(`,"scope":%q`, *scope)
		}
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(reply + "}"))}, nil
	})
}

// dropboxSignIn runs one sign-in at level to its committed native login.
func dropboxSignIn(t *testing.T, d *dropbox, env Env, address string, level Level) (*dropboxLogin, error) {
	t.Helper()
	login, err := d.StartLevelLogin(context.Background(), env, address, level)
	if err != nil {
		t.Fatal(err)
	}
	l := login.(*dropboxLogin)
	if err := l.Redirect(context.Background(), dropboxRedirect+"?"+url.Values{"state": {l.state}, "code": {"synthetic-code"}}.Encode()); err != nil {
		t.Fatal(err)
	}
	got, err := l.Wait(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return l, l.Commit(context.Background(), got)
}

func dropboxConfig(t *testing.T, env Env, address string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(env.Home, dropboxDir, address+".conf"))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

// The read level asks the Full Dropbox application for reading only, and its
// files are a one-way mirror the account's grant decides, not the request.
func TestDropboxReadLevelMirrorsOneWay(t *testing.T) {
	env := dropboxEnv(t)
	email := "person@example.test"
	var exchanges atomic.Int32
	d := syntheticDropbox(t, &email, &exchanges)
	scope := dropboxReadScopes
	levelDropbox(t, d, &scope)
	c := New(env, []Entry{d}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()
	h := c.Handler(allow)

	_, list, _ := call(t, h, "GET", ListPath, "", nil)
	raw, _ := json.Marshal(list["providers"].([]any)[0].(map[string]any)["levels"])
	var levels []LevelOption
	if json.Unmarshal(raw, &levels) != nil || !slices.Equal(levels, []LevelOption{{LevelFull, true, ""}, {LevelAppFolder, false, LevelApplicationMissing}, {LevelRead, true, ""}}) {
		t.Fatal(string(raw))
	}
	if code, out, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "dropbox", "level": "app_folder"}); code != 409 || out["error"].(map[string]any)["code"] != "level_unavailable" {
		t.Fatal("unregistered level started", code, out)
	}
	if code, _, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "dropbox", "level": "drafts"}); code != 409 {
		t.Fatal("a level Dropbox does not offer started", code)
	}

	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "dropbox", "level": "read"})
	view := waitState(t, h, ownerA, "open_url")
	auth, _ := url.Parse(view["authorization_url"].(string))
	if auth.Query().Get("scope") != dropboxReadScopes || auth.Query().Get("client_id") != "app-key" {
		t.Fatal("read level asked for", auth.Query())
	}
	id := view["attempt_id"].(string)
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": dropboxPaste(t, view)})
	waitState(t, h, ownerA, "choose_folders")
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"all"}})
	waitState(t, h, ownerA, "completed")
	waitLoginWorker(t, c)

	mirrors, _ := os.ReadFile(filepath.Join(env.Home, "mirrors"))
	if !strings.Contains(string(mirrors), "dropbox: "+filepath.Join(env.Home, "cloud/dropbox", email)) {
		t.Fatalf("no initial mirror: %q", mirrors)
	}
	if _, err := os.Stat(filepath.Join(env.Home, "resyncs")); err == nil {
		t.Fatal("a read grant ran bisync")
	}
	cmd, ok := d.SyncCommand(env, email)
	if script := strings.Join(cmd.Args, " "); !ok || strings.Contains(script, "'bisync'") || !strings.Contains(script, "'sync' 'dropbox:'") || !c.sync.supervised(key{Dropbox, email}) {
		t.Fatal("mirror not supervised:", script)
	}
	_, list, _ = call(t, h, "GET", ListPath, "", nil)
	account := list["accounts"].([]any)[0].(map[string]any)
	service := account["services"].([]any)[0].(map[string]any)
	if account["level"] != "read" || service["access"] != "read" || service["directory"] != "~/cloud/dropbox/"+email || service["last_synced_at"] == nil {
		t.Fatal(account)
	}
	if s := d.Skill(env, email); !s.Mirrored || s.Synced || !strings.Contains(s.Body, "one-way mirror") {
		t.Fatal(s.Body)
	}
}

// A level change that stops a two-way sync first syncs both ways once with
// the old grant, then mirrors, and the replaced login is revoked at Dropbox.
// When that last two-way pass fails nothing changes and the new grant is
// revoked instead.
func TestDropboxLevelChangeSyncsBothWaysOnceAndRevokes(t *testing.T) {
	env := dropboxEnv(t)
	email := "person@example.test"
	var exchanges atomic.Int32
	d := syntheticDropbox(t, &email, &exchanges)
	scope := ""
	levelDropbox(t, d, &scope)
	if _, err := dropboxSignIn(t, d, env, "", LevelFull); err != nil {
		t.Fatal(err)
	}
	if err := d.ChooseFolders(context.Background(), env, email, []string{"all"}); err != nil {
		t.Fatal(err)
	}
	work := filepath.Join(env.Home, dropboxWork(email))
	full := dropboxConfig(t, env, email)

	scope = dropboxReadScopes
	os.WriteFile(filepath.Join(env.Home, "pass-fail"), nil, 0600)
	dropboxRevoked.Store("")
	if _, err := dropboxSignIn(t, d, env, email, LevelRead); !errors.Is(err, FinalSyncFailed) {
		t.Fatal(err)
	}
	if dropboxConfig(t, env, email) != full || dropboxRevoked.Load() != "refresh-2" {
		t.Fatal("refused change kept the new grant or lost the old", dropboxRevoked.Load())
	}
	if _, ok := d.SyncCommand(env, email); !ok {
		t.Fatal("refused change stopped the two-way sync")
	}

	os.Remove(filepath.Join(env.Home, "pass-fail"))
	if _, err := dropboxSignIn(t, d, env, email, LevelRead); err != nil {
		t.Fatal(err)
	}
	passes, _ := os.ReadFile(filepath.Join(env.Home, "passes"))
	if string(passes) != "pass\n" || dropboxRevoked.Load() != "refresh-1" {
		t.Fatalf("passes %q, revoked %v", passes, dropboxRevoked.Load())
	}
	if names, _ := os.ReadDir(work); len(names) != 0 {
		t.Fatal("two-way listings outlived the change", names)
	}
	if config := dropboxConfig(t, env, email); !strings.Contains(config, `"refresh_token":"refresh-3"`) || !strings.Contains(config, grantKey+" = "+dropboxReadScopes+"\n") {
		t.Fatal(config)
	}
	if _, ok := d.SyncCommand(env, email); ok {
		t.Fatal("the mirror started before the person chose it")
	}
	if err := d.ChooseFolders(context.Background(), env, email, []string{"all"}); err != nil {
		t.Fatal(err)
	}
	if cmd, ok := d.SyncCommand(env, email); !ok || strings.Contains(strings.Join(cmd.Args, " "), "'bisync'") {
		t.Fatal("read level kept syncing both ways")
	}
	// A renewal without a level keeps the account's own.
	l, err := dropboxSignIn(t, d, env, email, "")
	if err != nil || l.level != LevelRead {
		t.Fatal(l.level, err)
	}
}

// The App folder level is its own application, synced into its own local
// root: the whole Dropbox's files never meet the application folder's.
func TestDropboxAppFolderLevelHasItsOwnRoot(t *testing.T) {
	env := dropboxEnv(t)
	env.Config.DropboxAppFolder = &DropboxApp{ClientID: "folder-key", ClientSecret: "folder-secret"}
	email := "person@example.test"
	var exchanges atomic.Int32
	d := syntheticDropbox(t, &email, &exchanges)
	scope := ""
	levelDropbox(t, d, &scope)
	if _, err := dropboxSignIn(t, d, env, "", LevelFull); err != nil {
		t.Fatal(err)
	}
	if err := d.ChooseFolders(context.Background(), env, email, []string{"all"}); err != nil {
		t.Fatal(err)
	}
	login, err := d.StartLevelLogin(context.Background(), env, email, LevelAppFolder)
	if err != nil {
		t.Fatal(err)
	}
	if auth, _ := url.Parse(login.(*dropboxLogin).auth); auth.Query().Get("client_id") != "folder-key" || auth.Query().Get("scope") != dropboxScopes {
		t.Fatal(auth)
	}
	if _, err := dropboxSignIn(t, d, env, email, LevelAppFolder); err != nil {
		t.Fatal(err)
	}
	if passes, _ := os.ReadFile(filepath.Join(env.Home, "passes")); string(passes) != "pass\n" {
		t.Fatal("old root not synced once more", string(passes))
	}
	config := dropboxConfig(t, env, email)
	if !strings.Contains(config, "client_id = folder-key\n") || !strings.Contains(config, "description = cloud/dropbox-app-folder/"+email+"\n") {
		t.Fatal(config)
	}
	if dirs := d.Directories(env, email); len(dirs) != 1 || dirs[0].Path != "cloud/dropbox-app-folder/"+email {
		t.Fatal(dirs)
	}
	if err := d.ChooseFolders(context.Background(), env, email, []string{"all"}); err != nil {
		t.Fatal(err)
	}
	resyncs, _ := os.ReadFile(filepath.Join(env.Home, "resyncs"))
	if strings.Count(string(resyncs), "\n") != 2 {
		t.Fatal("app folder root not chosen afresh", string(resyncs))
	}
	services, grant := d.CheckGrant(context.Background(), env, email)
	if services[0].Access != AccessFull || grant == nil || d.Level(env, email, services) != LevelAppFolder {
		t.Fatal(services, grant)
	}
	if body := d.Skill(env, email).Body; !strings.Contains(body, "~/cloud/dropbox-app-folder/"+email+"/") || !strings.Contains(body, "own folder") {
		t.Fatal(body)
	}
	// The operator replaces the App folder application: its folder is another
	// root, so the account gets a directory of its own and starts afresh,
	// and the old one stays as it is.
	os.WriteFile(filepath.Join(env.Home, "cloud/dropbox-app-folder", email, "kept.txt"), []byte("mine"), 0600)
	env.Config.DropboxAppFolder = &DropboxApp{ClientID: "folder-key-2", ClientSecret: "folder-secret-2"}
	if _, err := dropboxSignIn(t, d, env, email, ""); err != nil {
		t.Fatal(err)
	}
	dirs := d.Directories(env, email)
	if len(dirs) != 1 || dirs[0].Path != dropboxAppFolderDirOf(email, "folder-key-2") {
		t.Fatal(dirs)
	}
	if _, ok := d.SyncCommand(env, email); ok {
		t.Fatal("the new application's folder synced against the old one's listings")
	}
	if _, err := os.Stat(filepath.Join(env.Home, "cloud/dropbox-app-folder", email, "kept.txt")); err != nil {
		t.Fatal("old application's directory touched", err)
	}
	config = dropboxConfig(t, env, email)
	// A root the daemon never writes is not synced.
	os.WriteFile(filepath.Join(env.Home, dropboxDir, email+".conf"), []byte(strings.Replace(config, "description = cloud/dropbox-app-folder", "description = cloud/elsewhere", 1)), 0600)
	if _, ok := d.SyncCommand(env, email); ok || d.Directories(env, email) != nil {
		t.Fatal("foreign root synced")
	}
}

// microsoftLevelEnv has the full level's application and the read level's.
func microsoftLevelEnv(t *testing.T) Env {
	env := microsoftEnv(t)
	env.Config.MicrosoftRead = &MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000002", TenantID: testTenant}
	return env
}

const microsoftReadGrant = "User.Read Files.Read.All Sites.Read.All Mail.Read Calendars.Read Contacts.Read"

// A Microsoft level is its own Entra application; the account's level and
// what was not granted are read from the grant against the level its
// application asks for, and a read files grant mirrors its roots.
func TestMicrosoftReadLevelIsItsApplicationAndMirrors(t *testing.T) {
	env := microsoftLevelEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	microsoftGrantToken(t, m, microsoftReadGrant, true)
	var asked []string
	base := m.client.Transport
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if strings.HasSuffix(r.URL.Path, "/devicecode") {
			_ = r.ParseForm()
			asked = append(asked, r.Form.Get("client_id"))
		}
		return base.RoundTrip(r)
	})
	if got := m.Levels(env); !slices.Equal(got, []LevelOption{{LevelFull, true, ""}, {LevelNoSend, false, LevelApplicationMissing}, {LevelDrafts, false, LevelApplicationMissing}, {LevelRead, true, ""}}) {
		t.Fatal(got)
	}
	login, err := m.StartLevelLogin(context.Background(), env, "", LevelRead)
	if err != nil {
		t.Fatal(err)
	}
	l := login.(*microsoftLogin)
	l.interval = 1
	t.Cleanup(l.Cancel)
	address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(asked, []string{"00000000-0000-0000-0000-000000000002"}) {
		t.Fatal("asked", asked)
	}
	remotes, err := microsoftRemotes(env, address)
	if err != nil || len(remotes) != 2 || remotes[0].Writable || remotes[1].Writable {
		t.Fatal("read grant's roots", remotes, err)
	}
	if err := m.ChooseFolders(context.Background(), env, address, []string{"onedrive"}); err != nil {
		t.Fatal(err)
	}
	if mirrors, _ := os.ReadFile(filepath.Join(env.Home, "mirrors")); !strings.HasPrefix(string(mirrors), "onedrive: "+filepath.Join(env.Home, "cloud/onedrive", address)) {
		t.Fatalf("%q", mirrors)
	}
	if cmd, ok := m.SyncCommand(env, address); !ok || strings.Contains(strings.Join(cmd.Args, " "), "'bisync'") {
		t.Fatal("read root syncs both ways")
	}
	if m.Misaligned(env, address) {
		t.Fatal("the read level's application read as another application")
	}
	if s := m.Skill(env, address); !s.Mirrored || s.Synced || !strings.Contains(s.Body, "one-way mirror") || strings.Contains(s.Body, "sync both ways") {
		t.Fatal(s.Body)
	}

	verify := func(scopes string) ([]Service, *Grant) {
		reply, _ := json.Marshal(map[string]any{"state": "ok", "scopes": strings.Fields(scopes)})
		os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), reply, 0600)
		return m.CheckGrant(context.Background(), env, address)
	}
	services, grant := verify(microsoftReadGrant + " " + microsoftTeamsScopes)
	if m.Level(env, address, services) != LevelRead || grant == nil || len(grant.NotGranted) != 0 {
		t.Fatal(services, grant)
	}
	// An account the full application signed in shows what its grant is:
	// reading only when that is all it was granted, with the rest missing.
	config := filepath.Join(env.Home, microsoftDir, address+".conf")
	data, _ := os.ReadFile(config)
	os.WriteFile(config, bytes.ReplaceAll(data, []byte("client_id = 00000000-0000-0000-0000-000000000002"), []byte("client_id = 00000000-0000-0000-0000-000000000001")), 0600)
	services, grant = verify(microsoftReadGrant)
	if m.Level(env, address, services) != LevelRead || grant == nil || !slices.Contains(grant.NotGranted, "Mail.Send") {
		t.Fatal(services, grant)
	}
	services, _ = verify("User.Read Files.Read.All Mail.ReadWrite Calendars.Read Contacts.Read")
	if m.Level(env, address, services) != LevelDrafts {
		t.Fatal(accessOf(services))
	}
	services, _ = verify("User.Read Files.Read.All Mail.ReadWrite Calendars.ReadWrite Contacts.Read")
	if m.Level(env, address, services) != "" {
		t.Fatal("a narrowed grant named a level", accessOf(services))
	}
}

const microsoftNoSendGrant = "User.Read Files.ReadWrite.All Sites.ReadWrite.All Mail.ReadWrite Calendars.ReadWrite Contacts.ReadWrite"

// Everything but sending is its own application: the full level without
// Mail.Send. Its files sync both ways, its mail reads as drafts, the Outlook
// server is never allowed to send, and the level is read back from the grant.
func TestMicrosoftNoSendLevelIsItsApplicationAndNeverSends(t *testing.T) {
	env := microsoftEnv(t)
	env.Config.MicrosoftNoSend = &MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000003", TenantID: testTenant}
	m := syntheticMicrosoft(t, "person@example.test", "")
	microsoftGrantToken(t, m, microsoftNoSendGrant, true)
	var asked []string
	base := m.client.Transport
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if strings.HasSuffix(r.URL.Path, "/devicecode") {
			_ = r.ParseForm()
			asked = append(asked, r.Form.Get("client_id"))
		}
		return base.RoundTrip(r)
	})
	if got := m.Levels(env); !slices.Equal(got, []LevelOption{{LevelFull, true, ""}, {LevelNoSend, true, ""}, {LevelDrafts, false, LevelApplicationMissing}, {LevelRead, false, LevelApplicationMissing}}) {
		t.Fatal(got)
	}
	login, err := m.StartLevelLogin(context.Background(), env, "", LevelNoSend)
	if err != nil {
		t.Fatal(err)
	}
	l := login.(*microsoftLogin)
	l.interval = 1
	t.Cleanup(l.Cancel)
	address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(asked, []string{"00000000-0000-0000-0000-000000000003"}) {
		t.Fatal("asked", asked)
	}
	if strings.Contains(" "+l.allowed+" ", " Mail.Send ") || !strings.Contains(l.allowed, "Calendars.ReadWrite") || !strings.Contains(l.allowed, "Mail.ReadWrite") {
		t.Fatal("allowed scopes", l.allowed)
	}
	remotes, err := microsoftRemotes(env, address)
	if err != nil || len(remotes) != 2 || !remotes[0].Writable || !remotes[1].Writable {
		t.Fatal("no-send grant's roots", remotes, err)
	}
	if m.Misaligned(env, address) {
		t.Fatal("the no-send level's application read as another application")
	}
	reply, _ := json.Marshal(map[string]any{"state": "ok", "scopes": strings.Fields(microsoftNoSendGrant + " " + microsoftTeamsScopes)})
	os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), reply, 0600)
	services, grant := m.CheckGrant(context.Background(), env, address)
	if m.Level(env, address, services) != LevelNoSend || grant == nil || len(grant.NotGranted) != 0 {
		t.Fatal(accessOf(services), grant)
	}
	for _, s := range services {
		want := AccessFull
		if s.ID == "mail" {
			want = AccessDrafts
		}
		if s.Access != want {
			t.Fatal(s.ID, s.Access)
		}
	}
}

// A change from the full level to reading syncs both ways once more with
// the old grant before the roots turn into mirrors.
func TestMicrosoftLevelChangeSyncsBothWaysOnce(t *testing.T) {
	env := microsoftLevelEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	l := msLogin(t, m, env, "")
	address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	if err := m.ChooseFolders(context.Background(), env, address, []string{"onedrive"}); err != nil {
		t.Fatal(err)
	}
	microsoftGrantToken(t, m, microsoftReadGrant, true)
	change := func() error {
		login, err := m.StartLevelLogin(context.Background(), env, address, LevelRead)
		if err != nil {
			t.Fatal(err)
		}
		l := login.(*microsoftLogin)
		l.interval = 1
		defer l.Cancel()
		if _, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil }); err != nil {
			t.Fatal(err)
		}
		return l.Commit(context.Background(), address)
	}
	os.WriteFile(filepath.Join(env.Home, "pass-fail"), nil, 0600)
	if err := change(); !errors.Is(err, FinalSyncFailed) {
		t.Fatal(err)
	}
	if remotes, _ := microsoftRemotes(env, address); !remotes[0].Writable || !microsoftReady(env, address, remotes[0]) {
		t.Fatal("a refused change touched the two-way pair")
	}
	os.Remove(filepath.Join(env.Home, "pass-fail"))
	if err := change(); err != nil {
		t.Fatal(err)
	}
	if passes, _ := os.ReadFile(filepath.Join(env.Home, "passes")); string(passes) != "pass\n" {
		t.Fatalf("final two-way passes %q", passes)
	}
	remotes, _ := microsoftRemotes(env, address)
	if remotes[0].Writable || microsoftReady(env, address, remotes[0]) {
		t.Fatal("root kept its two-way listings")
	}
	if n, _ := microsoftReadNative(env, address); !slices.Contains(n.clients, "00000000-0000-0000-0000-000000000002") {
		t.Fatal("roots not on the read level's application", n.clients)
	}
	if choose, _ := m.FolderChoiceAfterLogin(env, address); !choose {
		t.Fatal("the mirror needs the person's choice")
	}
}

// A pair a critical abort set aside cannot sync both ways once more, so a
// level change away from it is refused rather than skipping that pass.
func TestDropboxLevelChangeRefusesAnAbortedPair(t *testing.T) {
	env := dropboxEnv(t)
	email := "person@example.test"
	var exchanges atomic.Int32
	d := syntheticDropbox(t, &email, &exchanges)
	scope := ""
	levelDropbox(t, d, &scope)
	if _, err := dropboxSignIn(t, d, env, "", LevelFull); err != nil {
		t.Fatal(err)
	}
	if err := d.ChooseFolders(context.Background(), env, email, []string{"all"}); err != nil {
		t.Fatal(err)
	}
	work := filepath.Join(env.Home, dropboxWork(email))
	for _, side := range []string{"path1", "path2"} {
		if err := os.Rename(filepath.Join(work, "local..dropbox."+side+".lst"), filepath.Join(work, "local..dropbox."+side+".lst-err")); err != nil {
			t.Fatal(err)
		}
	}
	scope = dropboxReadScopes
	if _, err := dropboxSignIn(t, d, env, email, LevelRead); !errors.Is(err, FinalSyncFailed) {
		t.Fatal(err)
	}
	if !listingsFailed(env.Home, dropboxWork(email)) {
		t.Fatal("the aborted pair's evidence was removed")
	}
}

// The last two-way pass of a level change may take longer than the pasted
// address's exchange is allowed; the exchange's timeout does not end it.
func TestDropboxFinalPassOutlastsTheExchangeTimeout(t *testing.T) {
	env := dropboxEnv(t)
	email := "person@example.test"
	var exchanges atomic.Int32
	d := syntheticDropbox(t, &email, &exchanges)
	scope := ""
	levelDropbox(t, d, &scope)
	if _, err := dropboxSignIn(t, d, env, "", LevelFull); err != nil {
		t.Fatal(err)
	}
	if err := d.ChooseFolders(context.Background(), env, email, []string{"all"}); err != nil {
		t.Fatal(err)
	}
	scope = dropboxReadScopes
	c := New(env, []Entry{d}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
	c.signInWait = 200 * time.Millisecond
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	defer c.sync.stopAll()
	h := c.Handler(allow)
	os.WriteFile(filepath.Join(env.Home, "hold-pass"), nil, 0600)
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "dropbox", "address": email, "level": "read"})
	view := waitState(t, h, ownerA, "open_url")
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": view["attempt_id"], "redirect_url": dropboxPaste(t, view)})
	time.Sleep(500 * time.Millisecond)
	os.Remove(filepath.Join(env.Home, "hold-pass"))
	waitState(t, h, ownerA, "choose_folders")
	if passes, _ := os.ReadFile(filepath.Join(env.Home, "passes")); !strings.Contains(string(passes), "pass") {
		t.Fatal("no final pass")
	}
}
