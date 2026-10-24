//go:build linux

package integrations

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
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

func (*dropbox) Provider() Provider { return Dropbox }
func (*dropbox) Login() LoginKind   { return PastedRedirect }
func (*dropbox) Services() []string { return []string{"dropbox"} }
func (d *dropbox) Available(env Env) bool { return d.ToolsInstalled(env) && d.AppConfigured(env) }
func (*dropbox) ToolsInstalled(env Env) bool {
	_, tool := env.Tool("rclone")
	return tool
}
func (*dropbox) AppConfigured(env Env) bool {
	_, app := env.dropboxApp()
	return app
}
func (*dropbox) Directories(_ Env, address string) []SyncDirectory {
	return []SyncDirectory{{Service: "dropbox", Path: "cloud/dropbox/" + address}}
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
	d.native.Lock()
	defer d.native.Unlock()
	state := StateUnknown
	if cmd, ok := dropboxCommand(env, address, "about", "dropbox:", "--json"); ok {
		if err, expired := dropboxStatus(ctx, env, cmd); err == nil {
			// A saved login without initial bisync listings is not a
			// healthy sync (e.g. daemon stopped at the folder choice).
			if _, ready := d.SyncCommand(env, address); ready {
				state = StateOK
			}
		} else if expired {
			state = StateLoginExpired
		} else {
			state = StateUnreachable
		}
	}
	return []Service{{ID: "dropbox", State: state}}
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
	if !ready {
		return SkillAccount{Label: "Dropbox", Kinds: []string{"files"}, Body: fmt.Sprintf("Dropbox is signed in, but initial sync is not ready. Do not assume files are available under `~/cloud/dropbox/%s/`. Ask the person to sign in again in Settings → Integrations and finish the initial sync choice.", address)}
	}
	return SkillAccount{Label: "Dropbox", Kinds: []string{"files"}, Synced: true, Body: fmt.Sprintf("Dropbox files are ordinary files under `~/cloud/dropbox/%s/`. Read them with filesystem tools, not the repository catalog. This is continuous two-way sync: edits, moves and deletions reach Dropbox and other devices. Write only what the person requested. If a native bisync safeguard stops sync, keep both copies and ask the person/operator to inspect the native rclone state. Do not use `--force`, blindly `--resync`, or remove and reconnect to approve deletions: reconnection is a union and can restore deleted files. Settings → Integrations can renew a rejected login, but does not approve mass deletions.", address)}
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
func (d *dropbox) Folders(_ context.Context, _ Env, _ string) ([]Folder, error) {
	// The existing choice is the drive root, not its recursive contents.
	return []Folder{{ID: "all", Name: "Dropbox", UnknownSize: true, Suggested: true}}, nil
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
	return dropboxCommand(env, address, "bisync", filepath.Join(env.Home, "cloud/dropbox", address), "dropbox:", "--workdir", filepath.Join(env.Home, dropboxWork(address)), "--resilient", "--recover", "--max-lock", "2m", "--max-delete", "50", "--conflict-resolve", "none", "--conflict-loser", "num", "--create-empty-src-dirs", "--refresh-times", "--compare", "size,modtime")
}
func (d *dropbox) ChooseFolders(ctx context.Context, env Env, address string, ids []string) error {
	if len(ids) != 1 || ids[0] != "all" {
		return ToolFailed
	}
	for _, rel := range []string{"cloud/dropbox/" + address, dropboxWork(address), ".local/share/rclone/dropbox-backups/" + address} {
		fd, err := openHomeDir(env.Home, true, splitPath(rel)...)
		if err != nil {
			return err
		}
		unix.Close(fd)
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
func (d *dropbox) SyncCommand(env Env, address string) (Command, bool) {
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
	// rclone bisync is one pass. The supervised child repeats successful passes
	// every minute and exits on failure, leaving backoff to the catalog.
	return Command{Path: "/bin/sh", Args: append([]string{"-c", `while "$@"; do sleep 60; done; exit 1`, "dropbox-sync", cmd.Path}, cmd.Args...)}, true
}

func (d *dropbox) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	app, ok := env.dropboxApp()
	if !ok {
		return nil, ToolFailed
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
	q := url.Values{"client_id": {app.ClientID}, "response_type": {"code"}, "redirect_uri": {dropboxRedirect}, "token_access_type": {"offline"}, "scope": {dropboxScopes}, "state": {state}, "code_challenge": {base64.RawURLEncoding.EncodeToString(hash[:])}, "code_challenge_method": {"S256"}}
	return &dropboxLogin{entry: d, env: env, app: app, expected: address, state: state, verifier: verifier, auth: "https://www.dropbox.com/oauth2/authorize?" + q.Encode(), redirect: make(chan string, 1)}, nil
}

type dropboxLogin struct {
	entry                           *dropbox
	env                             Env
	app                             DropboxApp
	expected, state, verifier, auth string
	redirect                        chan string
	token                           []byte // transient exchange result, written only into rclone's own store
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
	if res.StatusCode != 200 {
		return ToolFailed
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, 64<<10+1))
	if err != nil || len(data) > 64<<10 || json.Unmarshal(data, out) != nil {
		return ToolFailed
	}
	return nil
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
	}
	err := l.entry.request(ctx, "https://api.dropboxapi.com/oauth2/token", url.Values{"grant_type": {"authorization_code"}, "code": {code}, "client_id": {l.app.ClientID}, "client_secret": {l.app.ClientSecret}, "redirect_uri": {dropboxRedirect}, "code_verifier": {l.verifier}}, "", &token)
	if err != nil || token.AccessToken == "" || token.RefreshToken == "" || token.ExpiresIn <= 0 || token.ExpiresIn > 86400 {
		return "", ToolFailed
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
func (l *dropboxLogin) Commit(ctx context.Context, address string) error {
	l.entry.native.Lock()
	defer l.entry.native.Unlock()
	defer func() { l.token = nil }()
	if len(l.token) == 0 || !ValidAddress(address) {
		return ToolFailed
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if _, ok := l.env.Tool("rclone"); !ok {
		return ToolFailed
	}
	// rclone's OAuth client_secret is Sensitive, not IsPassword: unlike
	// password fields it is stored verbatim (oauthutil.OverrideCredentials).
	fd, err := openHomeDir(l.env.Home, true, splitPath(dropboxDir)...)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	config := fmt.Sprintf("[dropbox]\ntype = dropbox\nclient_id = %s\nclient_secret = %s\ntoken = %s\n", l.app.ClientID, l.app.ClientSecret, l.token)
	return writeFileAt(fd, address+".conf", []byte(config), 0600)
}
func (l *dropboxLogin) Cancel() { l.token = nil }

var _ FolderEntry = (*dropbox)(nil)
var _ LoginEntry = (*dropbox)(nil)
