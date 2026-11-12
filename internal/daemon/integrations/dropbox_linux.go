//go:build linux

package integrations

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/unix"
)

// Dropbox uses a daemon-completed PKCE exchange (ADR 0026), not rclone's
// shared TCP listener. Only rclone's native config and bisync listings persist.
type dropbox struct {
	// Status commands can refresh rclone's token too. Serialize them with
	// replacement/removal so a late status read cannot recreate a login.
	native sync.Mutex
	client *http.Client // synthetic provider transport in tests; nil in production
}

const dropboxDir = ".config/rclone/open-habitat-dropbox"
const dropboxRedirect = "http://localhost:53682/"
const dropboxScopes = "account_info.read files.metadata.read files.metadata.write files.content.read files.content.write sharing.read sharing.write"

// dropboxReadScopes are the read level's request to the Full Dropbox
// application: Dropbox issues a token with exactly the scopes a sign-in asks.
const dropboxReadScopes = "account_info.read files.metadata.read files.content.read"

// The local roots. An App folder application sees its own folder as the
// root, so its files must never meet the whole Dropbox's in one directory,
// nor another App folder application's: an account the operator's new App
// folder application signs in again gets a root of its own, named by the
// application (dropboxAppFolderDirOf).
func dropboxFullDir(address string) string      { return "cloud/dropbox/" + address }
func dropboxAppFolderDir(address string) string { return "cloud/dropbox-app-folder/" + address }
func dropboxAppFolderDirOf(address, clientID string) string {
	h := sha256.Sum256([]byte(clientID))
	return dropboxAppFolderDir(address) + "." + hex.EncodeToString(h[:4])
}

// dropboxNative is what an account's rclone config says: its application,
// token and, from the sign-in, the local root (rclone's description) and the
// grant (grantKey).
type dropboxNative struct {
	clientID, clientSecret, token string
	directory                     string
	granted                       []string
	hasGrant                      bool
}

// access is the files' access from the grant. A login written before the
// grant was kept could only have been the full set.
func (n dropboxNative) access() Access {
	if !n.hasGrant {
		return AccessFull
	}
	return dropboxRules.access("dropbox", scopeSet(n.granted, func(s string) string { return s }))
}

func (n dropboxNative) appFolder(address string) bool {
	return n.directory != dropboxFullDir(address)
}

// dropboxReadNative reads the account's rclone config. A root other than the
// two the daemon writes is refused rather than synced.
func dropboxReadNative(env Env, address string) (dropboxNative, error) {
	var n dropboxNative
	if !ValidAddress(address) {
		return n, ToolFailed
	}
	fd, err := openHomeDir(env.Home, false, splitPath(dropboxDir)...)
	if err != nil {
		return n, err
	}
	data, err := readFileAt(fd, address+".conf", 64<<10)
	unix.Close(fd)
	if err != nil {
		return n, err
	}
	n.directory = dropboxFullDir(address)
	for _, line := range strings.Split(string(data), "\n") {
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		value = strings.TrimSpace(value)
		switch strings.TrimSpace(key) {
		case "client_id":
			n.clientID = value
		case "client_secret":
			n.clientSecret = value
		case "token":
			n.token = value
		case "description":
			n.directory = value
		case grantKey:
			n.granted, n.hasGrant = strings.Fields(value), true
		}
	}
	if d := n.directory; d != dropboxFullDir(address) && d != dropboxAppFolderDir(address) && d != dropboxAppFolderDirOf(address, n.clientID) {
		return n, ToolFailed
	}
	return n, nil
}

func (*dropbox) Provider() Provider            { return Dropbox }
func (*dropbox) Login() LoginKind              { return PastedRedirect }
func (*dropbox) Services() []string            { return []string{"dropbox"} }
func (d *dropbox) Available(env Env) bool      { return d.ToolsInstalled(env) && d.AppConfigured(env) }
func (*dropbox) Tools() []string               { return []string{"rclone"} }
func (d *dropbox) ToolsInstalled(env Env) bool { return MissingTools(d, env) == nil }
func (*dropbox) AppConfigured(env Env) bool    { return len(env.dropboxApps()) > 0 }
func (*dropbox) mirrorsRead()                  {}

// Levels: Full Dropbox, the application's own folder, and reading only.
func (*dropbox) Levels(env Env) []LevelOption {
	apps := env.dropboxApps()
	var out []LevelOption
	for _, l := range []Level{LevelFull, LevelAppFolder, LevelRead} {
		_, ok := apps[l]
		out = append(out, appLevel(l, ok))
	}
	return out
}

// Level is the App folder level when the sign-in's application was the App
// folder one, otherwise the files' access the grant gives.
func (*dropbox) Level(env Env, address string, services []Service) Level {
	n, err := dropboxReadNative(env, address)
	if err != nil || len(services) != 1 {
		return ""
	}
	switch {
	case n.appFolder(address):
		return LevelAppFolder
	case services[0].Access == AccessFull:
		return LevelFull
	case services[0].Access == AccessRead:
		return LevelRead
	}
	return ""
}

func (*dropbox) Directories(env Env, address string) []SyncDirectory {
	n, err := dropboxReadNative(env, address)
	if err != nil {
		return nil
	}
	return []SyncDirectory{{Service: "dropbox", Path: n.directory, Work: dropboxWork(address)}}
}
func (*dropbox) Accounts(env Env) ([]string, error) {
	names, fd, err := listHomeDir(env.Home, dropboxDir)
	if err != nil || fd < 0 {
		return nil, err
	}
	defer unix.Close(fd)
	var accounts []string
	for _, name := range names {
		address, ok := strings.CutSuffix(name, ".conf")
		if !ok || !ValidAddress(address) {
			continue
		}
		if _, err := readFileAt(fd, name, 64<<10); err != nil {
			return nil, err
		}
		accounts = append(accounts, address)
	}
	return accounts, nil
}
func dropboxWork(address string) string { return dropboxDir + "/bisync/" + address }
func dropboxCommand(env Env, address string, args ...string) (Command, bool) {
	tool, ok := env.Tool("rclone")
	if !ok || !ValidAddress(address) {
		return Command{}, false
	}
	fd, err := openHomeDir(env.Home, false, splitPath(dropboxDir)...)
	if err != nil {
		return Command{}, false
	}
	_, err = readFileAt(fd, address+".conf", 64<<10)
	unix.Close(fd)
	if err != nil {
		return Command{}, false
	}
	return Command{Path: tool, Args: append([]string{"--config", filepath.Join(env.Home, dropboxDir, address+".conf")}, args...)}, true
}
func (d *dropbox) Check(ctx context.Context, env Env, address string) []Service {
	out, _ := d.CheckGrant(ctx, env, address)
	return out
}

// CheckGrant reads the service's state and its grant. A Dropbox token
// carries no readable scopes, so the grant is what the token response named
// at sign-in, kept next to the token in rclone's config. The person cannot
// leave scopes out on Dropbox's consent page, so what was asked is the
// level's set the grant reaches.
func (d *dropbox) CheckGrant(ctx context.Context, env Env, address string) ([]Service, *Grant) {
	services := d.check(ctx, env, address)
	n, err := dropboxReadNative(env, address)
	if _, ok := dropboxCommand(env, address); !ok || err != nil {
		return services, nil
	}
	granted := scopeSet(strings.Fields(dropboxScopes), func(s string) string { return s })
	if n.hasGrant {
		granted = scopeSet(n.granted, func(s string) string { return s })
	}
	services[0].Access = dropboxRules.access("dropbox", granted)
	requested := dropboxScopes
	if services[0].Access != AccessFull {
		requested = dropboxReadScopes
	}
	return services, grantOf(granted, strings.Fields(requested), nil)
}

// dropboxRules: the full set syncs both ways, reading alone is a mirror.
var dropboxRules = grantRules{"dropbox": {{strings.Fields(dropboxScopes), AccessFull}, {[]string{"files.content.read"}, AccessRead}}}

func (d *dropbox) check(ctx context.Context, env Env, address string) []Service {
	d.native.Lock()
	defer d.native.Unlock()
	service := Service{ID: "dropbox", State: StateUnknown}
	if cmd, ok := dropboxCommand(env, address, "about", "dropbox:", "--json"); ok {
		if err, expired := dropboxStatus(ctx, env, cmd); err == nil {
			// A saved login without initial bisync listings is not a
			// healthy sync (e.g. daemon stopped at the folder choice).
			_, ready := d.SyncCommand(env, address)
			service.State, service.Failure = signedInState(ready)
		} else if expired {
			service.State = StateLoginExpired
		} else {
			service.State = StateUnreachable
		}
	}
	return []Service{service}
}

// rclone exit codes do not distinguish OAuth rejection from network failures.
// Inspect only bounded native status diagnostics; never return or log them.
func dropboxStatus(ctx context.Context, env Env, c Command) (error, bool) {
	c.Args = append(c.Args, "--use-json-log")
	cmd := env.command(ctx, c)
	out, diagnostics := &boundedOutput{limit: 64 << 10}, &boundedOutput{limit: 64 << 10}
	cmd.Stdout, cmd.Stderr = out, diagnostics
	err := cmd.Run()
	killGroup(cmd)
	if diagnostics.overflow || out.overflow {
		return ToolFailed, false
	}
	for _, line := range strings.Split(string(diagnostics.data), "\n") {
		var event struct {
			Level   string `json:"level"`
			Message string `json:"msg"`
		}
		if json.Unmarshal([]byte(line), &event) != nil || event.Level != "error" {
			continue
		}
		for _, code := range []string{"invalid_grant", "invalid_access_token", "expired_access_token"} {
			if strings.Contains(event.Message, code) {
				return ToolFailed, true
			}
		}
	}
	return err, false
}
func (d *dropbox) Skill(env Env, address string) SkillAccount {
	_, ready := d.SyncCommand(env, address)
	n, err := dropboxReadNative(env, address)
	dir := dropboxFullDir(address)
	if err == nil {
		dir = n.directory
	}
	if !ready {
		return SkillAccount{Label: "Dropbox", Kinds: []string{"files"}, Body: fmt.Sprintf("Dropbox is signed in, but its initial sync is not ready, so files under `~/%s/` may be missing or partial. The person finishes it in Settings → Integrations by signing in again and making the sync choice.", dir)}
	}
	scope := ""
	if n.appFolder(address) {
		scope = " The account reaches only this application's own folder in Dropbox (`Apps/<application>`), not the rest of the person's Dropbox."
	}
	backups := fmt.Sprintf(" Local files that the first sync replaced or removed are kept under `~/.local/share/rclone/dropbox-backups/%s/`.", address)
	if n.access() != AccessFull {
		return SkillAccount{Label: "Dropbox", Kinds: []string{"files"}, Mirrored: true, Body: fmt.Sprintf("Dropbox files are ordinary files under `~/%s/`, a one-way mirror of Dropbox because the account is read-only.%s%s", dir, scope, backups)}
	}
	return SkillAccount{Label: "Dropbox", Kinds: []string{"files"}, Synced: true, Body: fmt.Sprintf("Dropbox files are ordinary files under `~/%s/`, synced both ways.%s%s", dir, scope, backups)}
}
func (d *dropbox) Remove(_ context.Context, env Env, address string) error {
	d.native.Lock()
	defer d.native.Unlock()
	fd, err := openHomeDir(env.Home, false, splitPath(dropboxDir)...)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	// The catalog stops the client before removal: a refresh cannot recreate
	// the native config, and the local data can subsequently be trashed safely.
	if err := unix.Unlinkat(fd, address+".conf", 0); err != nil {
		return err
	}
	names, work, err := listHomeDir(env.Home, dropboxWork(address))
	if err != nil {
		return err
	}
	if work >= 0 {
		defer unix.Close(work)
		for _, n := range names {
			// bisync's working directory holds native listings, logs and lock files.
			// Unlink never follows a symlink or recurses into a person's directories.
			if err := unix.Unlinkat(work, n, 0); err != nil {
				return err
			}
		}
	}
	return nil
}
func (d *dropbox) Folders(_ context.Context, env Env, address string) ([]Folder, error) {
	// The existing choice is the drive root, not its recursive contents.
	name := "Dropbox"
	if n, err := dropboxReadNative(env, address); err == nil && n.appFolder(address) {
		name = "Dropbox › Apps"
	}
	return []Folder{{ID: "all", Name: name, UnknownSize: true, Suggested: true}}, nil
}
func (d *dropbox) MeasureFolders(ctx context.Context, env Env, address string, ids []string) (uint64, error) {
	d.native.Lock()
	defer d.native.Unlock()
	if len(ids) != 1 || ids[0] != "all" {
		return 0, ToolFailed
	}
	c, ok := dropboxCommand(env, address, "size", "dropbox:", "--json")
	if !ok {
		return 0, ToolFailed
	}
	return env.measureSize(ctx, c, "dropbox")
}
func dropboxBisync(env Env, address string) (Command, bool) {
	n, err := dropboxReadNative(env, address)
	if err != nil {
		return Command{}, false
	}
	c, ok := dropboxCommand(env, address)
	if !ok {
		return Command{}, false
	}
	return bisyncCommand(c, env, n.directory, "dropbox:", dropboxWork(address)), true
}
func (d *dropbox) ChooseFolders(ctx context.Context, env Env, address string, ids []string) error {
	if len(ids) != 1 || ids[0] != "all" {
		return ToolFailed
	}
	n, err := dropboxReadNative(env, address)
	if err != nil {
		return err
	}
	if n.access() == AccessRead {
		fd, err := openHomeDir(env.Home, true, splitPath(n.directory)...)
		if err != nil {
			return err
		}
		unix.Close(fd)
		cmd, ok := dropboxCommand(env, address)
		if !ok {
			return ToolFailed
		}
		return initialMirror(ctx, env, mirrorCommand(cmd, env, "dropbox:", n.directory), dropboxWork(address), ".local/share/rclone/dropbox-backups/"+address, "dropbox")
	}
	if n.access() != AccessFull {
		return ToolFailed
	}
	for _, rel := range []string{n.directory, dropboxWork(address), ".local/share/rclone/dropbox-backups/" + address} {
		fd, err := openHomeDir(env.Home, true, splitPath(rel)...)
		if err != nil {
			return err
		}
		unix.Close(fd)
	}
	if err := unmarkMirrored(env, dropboxWork(address)); err != nil {
		return err
	}
	cmd, ok := dropboxBisync(env, address)
	if !ok {
		return ToolFailed
	}
	// Only an explicit first choice resyncs. Prefer cloud versions on the
	// initial union. Differing local files go to the local backup directory.
	// Ordinary restarts NEVER resync after a corrupt/missing listing.
	// Initial copies can have equal size/time but different contents. Compare
	// their hashes once; steady passes use native size/time change detection
	// with rclone's default transfer verification, not a full local rehash each minute.
	cmd.Args = append(cmd.Args, "--resync", "--resync-mode", "path2", "--compare", "size,modtime,checksum", "--backup-dir1", filepath.Join(env.Home, ".local/share/rclone/dropbox-backups", address))
	return env.runInitialSync(ctx, cmd, "dropbox")
}

// interruptedPasses names the work directory of a chosen first pass that a
// stop interrupted; resumeInitial runs that same choice again.
func (*dropbox) interruptedPasses(env Env, address string) []string {
	if work := dropboxWork(address); interruptedResync(env, work) {
		return []string{work}
	}
	return nil
}
func (d *dropbox) resumeInitial(ctx context.Context, env Env, address string, _ []string) error {
	if !interruptedResync(env, dropboxWork(address)) {
		return nil
	}
	return d.ChooseFolders(ctx, env, address, []string{"all"})
}
func (*dropbox) passService(string) string { return "dropbox" }
func (d *dropbox) SyncCommand(env Env, address string) (Command, bool) {
	n, err := dropboxReadNative(env, address)
	if err != nil {
		return Command{}, false
	}
	switch n.access() {
	case AccessRead:
		cmd, ok := dropboxCommand(env, address)
		if !ok || !mirrorReady(env.Home, dropboxWork(address)) {
			return Command{}, false
		}
		return syncLoop([]syncPass{{Work: dropboxWork(address), Cmd: mirrorCommand(cmd, env, "dropbox:", n.directory), Done: filepath.Join(env.Home, dropboxWork(address), mirrorDone)}}), true
	case AccessFull:
	default:
		return Command{}, false
	}
	names, fd, err := listHomeDir(env.Home, dropboxWork(address))
	if err != nil || fd < 0 {
		return Command{}, false
	}
	unix.Close(fd)
	one, two := false, false
	for _, n := range names {
		one = one || strings.HasSuffix(n, ".path1.lst")
		two = two || strings.HasSuffix(n, ".path2.lst")
	}
	if !one || !two {
		return Command{}, false
	}
	cmd, ok := dropboxBisync(env, address)
	if !ok {
		return Command{}, false
	}
	return syncLoop([]syncPass{{Work: dropboxWork(address), Cmd: cmd}}), true
}

func (d *dropbox) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	return d.StartLevelLogin(ctx, env, address, "")
}

// StartLevelLogin asks the level's application for the level's scopes. A
// renewal without a level keeps the account's own: its root and its grant.
func (d *dropbox) StartLevelLogin(ctx context.Context, env Env, address string, level Level) (Login, error) {
	if level == "" && address != "" {
		n, err := dropboxReadNative(env, address)
		switch {
		case err != nil:
			// A config the daemon cannot read is renewed as a new one.
			level = firstLevel(d.Levels(env))
		case n.appFolder(address):
			level = LevelAppFolder
		case n.access() == AccessRead:
			level = LevelRead
		default:
			level = LevelFull
		}
	} else if level == "" {
		level = firstLevel(d.Levels(env))
	}
	app, ok := env.dropboxApps()[level]
	if !ok {
		return nil, ToolFailed
	}
	scopes := dropboxScopes
	if level == LevelRead {
		scopes = dropboxReadScopes
	}
	random := func() (string, error) {
		var b [32]byte
		_, err := rand.Read(b[:])
		return base64.RawURLEncoding.EncodeToString(b[:]), err
	}
	state, err := random()
	if err != nil {
		return nil, err
	}
	verifier, err := random()
	if err != nil {
		return nil, err
	}
	hash := sha256.Sum256([]byte(verifier))
	q := url.Values{"client_id": {app.ClientID}, "response_type": {"code"}, "redirect_uri": {dropboxRedirect}, "token_access_type": {"offline"}, "scope": {scopes}, "state": {state}, "code_challenge": {base64.RawURLEncoding.EncodeToString(hash[:])}, "code_challenge_method": {"S256"}}
	return &dropboxLogin{entry: d, env: env, app: app, level: level, requested: strings.Fields(scopes), expected: address, state: state, verifier: verifier, auth: "https://www.dropbox.com/oauth2/authorize?" + q.Encode(), redirect: make(chan string, 1)}, nil
}

type dropboxLogin struct {
	entry                           *dropbox
	env                             Env
	app                             DropboxApp
	level                           Level
	requested, granted              []string
	expected, state, verifier, auth string
	redirect                        chan string
	token                           []byte // transient exchange result, written only into rclone's own store
	// refresh is the new grant's refresh token, kept only to revoke the
	// grant when the commit refuses it.
	refresh string
	// revokeFailed is set when a replaced login could not be revoked.
	revokeFailed bool
}

func (l *dropboxLogin) Prompt(context.Context) (Prompt, error) {
	return Prompt{AuthorizationURL: l.auth, RedirectPrefix: dropboxRedirect, ExpiresAt: time.Now().Add(5 * time.Minute)}, nil
}
func (l *dropboxLogin) Redirect(_ context.Context, raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "http" || u.Host != "localhost:53682" || u.Path != "/" || u.Fragment != "" || u.User != nil {
		return RedirectRejected
	}
	q, err := url.ParseQuery(u.RawQuery)
	if err != nil || len(q["state"]) != 1 || q.Get("state") != l.state || len(q["code"]) != 1 || q.Get("code") == "" || q.Get("error") != "" {
		return RedirectRejected
	}
	select {
	case l.redirect <- q.Get("code"):
		return nil
	default:
		return RedirectRejected
	}
}

// request posts a form, or an empty body, and decodes the reply into out
// unless out is nil.
func (d *dropbox) request(ctx context.Context, endpoint string, form url.Values, bearer string, out any) error {
	var body io.Reader
	if form != nil {
		body = strings.NewReader(form.Encode())
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, body)
	if err != nil {
		return ToolFailed
	}
	if form != nil {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	client := &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	if d.client != nil {
		client = d.client
	}
	res, err := client.Do(req)
	if err != nil {
		return ToolFailed
	}
	defer res.Body.Close()
	data, err := io.ReadAll(io.LimitReader(res.Body, 64<<10+1))
	if res.StatusCode != 200 {
		var refused struct {
			Error string `json:"error"`
		}
		if res.StatusCode == 400 && err == nil && len(data) <= 64<<10 && json.Unmarshal(data, &refused) == nil && refused.Error == "invalid_grant" {
			return errGrantRefused
		}
		return ToolFailed
	}
	if err != nil || len(data) > 64<<10 || out != nil && json.Unmarshal(data, out) != nil {
		return ToolFailed
	}
	return nil
}

// errGrantRefused is the token endpoint refusing a refresh token: revoked,
// expired or otherwise ended.
var errGrantRefused = fmt.Errorf("%w: grant refused", ToolFailed)

// revoke ends a Dropbox grant at Dropbox: the refresh token and every access
// token issued from it. A fresh access token is redeemed first, since the
// stored one may have expired; a grant Dropbox already refuses is ended.
func (d *dropbox) revoke(ctx context.Context, app DropboxApp, refresh string) error {
	if refresh == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	var fresh struct {
		AccessToken string `json:"access_token"`
	}
	err := d.request(ctx, "https://api.dropboxapi.com/oauth2/token", url.Values{"grant_type": {"refresh_token"}, "refresh_token": {refresh}, "client_id": {app.ClientID}, "client_secret": {app.ClientSecret}}, "", &fresh)
	if errors.Is(err, errGrantRefused) {
		return nil
	}
	if err != nil || fresh.AccessToken == "" {
		return ToolFailed
	}
	return d.request(ctx, "https://api.dropboxapi.com/2/auth/token/revoke", nil, fresh.AccessToken, nil)
}
func (l *dropboxLogin) Wait(ctx context.Context) (string, error) {
	var code string
	select {
	case code = <-l.redirect:
	case <-ctx.Done():
		return "", ctx.Err()
	}
	var token struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int64  `json:"expires_in"`
		Scope        string `json:"scope"`
	}
	err := l.entry.request(ctx, "https://api.dropboxapi.com/oauth2/token", url.Values{"grant_type": {"authorization_code"}, "code": {code}, "client_id": {l.app.ClientID}, "client_secret": {l.app.ClientSecret}, "redirect_uri": {dropboxRedirect}, "code_verifier": {l.verifier}}, "", &token)
	if err != nil || token.AccessToken == "" || token.RefreshToken == "" || token.ExpiresIn <= 0 || token.ExpiresIn > 86400 {
		return "", ToolFailed
	}
	// The token's own scopes are the grant, kept with the token for the
	// level and the files' direction. Dropbox issues what was asked; a reply
	// without scopes is that.
	l.refresh, l.granted = token.RefreshToken, l.requested
	if token.Scope != "" {
		l.granted = strings.Fields(token.Scope)
	}
	if a := dropboxRules.access("dropbox", scopeSet(l.granted, func(s string) string { return s })); a != AccessFull && a != AccessRead {
		l.revokeNew(ctx)
		return "", NothingGranted
	}
	var account struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
	}
	if l.entry.request(ctx, "https://api.dropboxapi.com/2/users/get_current_account", nil, token.AccessToken, &account) != nil {
		return "", ToolFailed
	}
	address := strings.ToLower(account.Email)
	if !account.EmailVerified || !ValidAddress(address) {
		return "", ToolFailed
	}
	if l.expected != "" && l.expected != address {
		return "", AccountMismatch
	}
	l.token, _ = json.Marshal(map[string]any{"access_token": token.AccessToken, "refresh_token": token.RefreshToken, "token_type": "bearer", "expiry": time.Now().Add(time.Duration(token.ExpiresIn) * time.Second).UTC().Format(time.RFC3339)})
	return address, nil
}

// Commit runs under the catalog's write lock with this account's sync stopped.
// A login it replaces whose files sync both ways and would no longer, or
// would sync another root, first syncs both ways once more with the old
// grant, so nothing made locally is left behind; if that pass fails nothing
// changes and the new grant is revoked. The replaced login is then revoked
// at Dropbox, since a narrower level is real only once the broader token
// stops working.
func (l *dropboxLogin) Commit(ctx context.Context, address string) (result error) {
	l.entry.native.Lock()
	defer l.entry.native.Unlock()
	defer func() { l.token = nil }()
	// A grant the commit refuses is ended rather than left valid unused.
	defer func() {
		if result != nil {
			l.revokeNew(ctx)
		}
	}()
	if len(l.token) == 0 || !ValidAddress(address) {
		return ToolFailed
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if _, ok := l.env.Tool("rclone"); !ok {
		return ToolFailed
	}
	writable := dropboxRules.access("dropbox", scopeSet(l.granted, func(s string) string { return s })) == AccessFull
	old, oldErr := dropboxReadNative(l.env, address)
	replaced := oldErr == nil
	directory := dropboxFullDir(address)
	// The operator replaced the App folder application: the new one's
	// folder is another root, and the old one may no longer exist.
	appReplaced := false
	if l.level == LevelAppFolder {
		directory = dropboxAppFolderDir(address)
		switch {
		case replaced && old.appFolder(address) && strings.EqualFold(old.clientID, l.app.ClientID):
			directory = old.directory
		case replaced && old.appFolder(address):
			directory, appReplaced = dropboxAppFolderDirOf(address, l.app.ClientID), true
		}
	}
	changed := replaced && (old.directory != directory || (old.access() == AccessFull) != writable)
	if changed && !appReplaced && old.access() == AccessFull && listingsFailed(l.env.Home, dropboxWork(address)) {
		// A critical abort set the pair aside; no pass can run without an
		// explicit resync, and changing now would skip the last two-way one.
		return FinalSyncFailed
	}
	if _, syncing := l.entry.SyncCommand(l.env, address); changed && syncing && old.access() == AccessFull {
		cmd, ok := dropboxBisync(l.env, address)
		// A replaced application's last pass is attempted, not required: its
		// directory stays as it is, and the application may be gone.
		if (!ok || l.env.runInitialSync(ctx, cmd, "dropbox") != nil) && !appReplaced {
			return FinalSyncFailed
		}
	}
	// rclone's OAuth client_secret is Sensitive, not IsPassword: unlike
	// password fields it is stored verbatim (oauthutil.OverrideCredentials).
	fd, err := openHomeDir(l.env.Home, true, splitPath(dropboxDir)...)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	config := fmt.Sprintf("[dropbox]\ntype = dropbox\nclient_id = %s\nclient_secret = %s\ntoken = %s\n", l.app.ClientID, l.app.ClientSecret, l.token)
	if directory != dropboxFullDir(address) {
		config += "description = " + directory + "\n"
	}
	config += grantLine(l.granted)
	if err := writeFileAt(fd, address+".conf", []byte(config), 0600); err != nil {
		return err
	}
	l.refresh = ""
	if changed {
		// The pair's listings, or the mirror's marker, describe the old
		// direction and root; the person's next choice starts the new one.
		if err := clearWork(l.env, dropboxWork(address)); err != nil {
			return err
		}
	}
	if replaced {
		var t struct {
			Refresh string `json:"refresh_token"`
		}
		_ = json.Unmarshal([]byte(old.token), &t)
		if l.entry.revoke(ctx, DropboxApp{ClientID: old.clientID, ClientSecret: old.clientSecret}, t.Refresh) != nil {
			l.revokeFailed = true
		}
	}
	return nil
}

// RevokeFailed reports that the login this one replaced could not be ended
// at Dropbox; it works until it expires or the person revokes it there.
func (l *dropboxLogin) RevokeFailed() bool { return l.revokeFailed }

// Cancel drops the exchange's result. A grant that was issued but never
// committed is revoked: nothing would ever use it.
func (l *dropboxLogin) Cancel() {
	l.token = nil
	l.revokeNew(context.Background())
}

func (l *dropboxLogin) revokeNew(ctx context.Context) {
	if l.refresh != "" {
		_ = l.entry.revoke(context.WithoutCancel(ctx), l.app, l.refresh)
		l.refresh = ""
	}
}

var _ FolderEntry = (*dropbox)(nil)
var _ LevelEntry = (*dropbox)(nil)
var _ GrantEntry = (*dropbox)(nil)
var _ LoginEntry = (*dropbox)(nil)
