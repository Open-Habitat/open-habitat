//go:build linux

package integrations

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/unix"

	"github.com/Open-Habitat/open-habitat/internal/integrationapps"
)

// GoogleApp is the operator's installed/desktop OAuth client, not a user grant.
type GoogleApp struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

func (env Env) googleApp() (GoogleApp, bool) {
	cfg := env.Config
	if env.LoadConfig != nil {
		var err error
		cfg, err = env.LoadConfig()
		if err != nil {
			return GoogleApp{}, false
		}
	}
	if cfg.Google == nil {
		return GoogleApp{}, false
	}
	a := *cfg.Google
	return a, integrationapps.Usable("google", map[string]string{"client_id": a.ClientID, "client_secret": a.ClientSecret})
}

type google struct {
	native sync.RWMutex
	checks sync.Map     // address -> *sync.Mutex; native refresh exclusion per account, not a connection store
	client *http.Client // synthetic provider transport; production always uses fixed HTTPS endpoints
}

const googleRedirect = "http://localhost"
const googleScopes = "openid email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/contacts"
const googleGogHome = ".config/gog/open-habitat"

// The file keyring is protected by Unix permissions, just like rclone's tokens.
// Its fixed encryption password is not a security boundary or another secret store.
var googleGogEnv = []string{"GOG_KEYRING_BACKEND=file", "GOG_KEYRING_PASSWORD=open-habitat"}

func (*google) Provider() Provider            { return Google }
func (*google) Login() LoginKind              { return PastedRedirect }
func (*google) Services() []string            { return []string{"drive", "mail", "calendar", "contacts"} }
func (g *google) Available(env Env) bool      { return g.ToolsInstalled(env) && g.AppConfigured(env) }
func (*google) Tools() []string               { return []string{"rclone", "gog"} }
func (g *google) ToolsInstalled(env Env) bool { return MissingTools(g, env) == nil }
func (*google) AppConfigured(env Env) bool {
	_, a := env.googleApp()
	return a
}
func (*google) Directories(_ Env, address string) []SyncDirectory {
	return []SyncDirectory{{Service: "drive", Path: "cloud/google-drive/" + address, Work: googleWork(address)}}
}
func gogCommand(env Env, args ...string) (Command, bool) {
	tool, ok := env.Tool("gog")
	if !ok {
		return Command{}, false
	}
	return Command{Path: tool, Args: append([]string{"--home", filepath.Join(env.Home, googleGogHome), "--no-input", "--json"}, args...), Env: googleGogEnv}, true
}

// gog's pinned file keyring stores the default token under these two native
// keys (the second is its legacy alias). No host connection record is needed.
func googleTokenNames(address string) []string {
	var out []string
	for _, key := range []string{"token:default:" + address, "token:" + address} {
		out = append(out, "_gogcli_key_v1_"+base64.RawURLEncoding.EncodeToString([]byte(key)))
	}
	return out
}
func googleKeyring(env Env, create bool) (int, error) {
	return openHomeDir(env.Home, create, splitPath(googleGogHome+"/data/keyring")...)
}
func googleHasToken(env Env, address string) bool {
	fd, err := googleKeyring(env, false)
	if err != nil {
		return false
	}
	defer unix.Close(fd)
	_, err = readFileAt(fd, googleTokenNames(address)[0], 64<<10)
	return err == nil
}
func (g *google) Check(ctx context.Context, env Env, address string) []Service {
	// Checks of different accounts share the read lease; removal/replacement
	// waits for every native process that could still use or refresh credentials.
	g.native.RLock()
	defer g.native.RUnlock()
	lock, _ := g.checks.LoadOrStore(address, &sync.Mutex{})
	check := lock.(*sync.Mutex)
	check.Lock()
	defer check.Unlock()
	drive, driveFailure, expired := StateUnknown, "", false
	if c, ok := googleCommand(env, address, "about", "google:", "--json"); ok {
		if err, rejected := dropboxStatus(ctx, env, c); err == nil {
			_, ready := g.SyncCommand(env, address)
			drive, driveFailure = signedInState(ready)
		} else if rejected {
			drive, expired = StateLoginExpired, true
		} else {
			drive = StateUnreachable
		}
	}
	out := []Service{{ID: "drive", State: drive, Failure: driveFailure}, {ID: "mail", State: StateUnknown}, {ID: "calendar", State: StateUnknown}, {ID: "contacts", State: StateUnknown}}
	if expired {
		// Both native stores received the same grant. Its rejection is not a
		// network outage in the other three services (Testing tokens expire weekly).
		for i := range out {
			out[i].State = StateLoginExpired
		}
		return out
	}
	if !googleHasToken(env, address) {
		return out
	}
	// Four serial exchanges per account consume the catalog deadline before a
	// second account is reached. Independent read-only service probes run together.
	var wg sync.WaitGroup
	for i, args := range [][]string{{"gmail", "labels", "list"}, {"calendar", "calendars", "--max", "1"}, {"contacts", "list", "--max", "1"}} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if c, ok := gogCommand(env, append([]string{"--account", address}, args...)...); ok {
				if _, err := env.run(ctx, c, nil); err == nil {
					out[i+1].State = StateOK
				} else {
					out[i+1].State = StateUnreachable
				}
			}
		}()
	}
	wg.Wait()
	return out
}
func (g *google) Skill(env Env, address string) SkillAccount {
	_, ready := g.SyncCommand(env, address)
	body := fmt.Sprintf("Use `GOG_KEYRING_BACKEND=file GOG_KEYRING_PASSWORD=open-habitat %s --home ~/.config/gog/open-habitat --account %s --no-input --json` followed by the gog command. Use `gmail` (drafts first), `calendar`, `contacts`, and `drive` for online Google-native documents. The keyring password is a fixed native file-backend setting, not a secret. Never export or print tokens. Consult the tool's --help for syntax.", mustTool(env, "gog"), address)
	if ready {
		body += fmt.Sprintf("\n\nOrdinary Drive files sync continuously both ways under `~/cloud/google-drive/%s/`. Edits, moves and deletions reach the cloud. Google-native documents and shortcuts are excluded from filesystem sync: use gog online for those. Write only what the person requested. Native bisync safeguards must not be bypassed with --force, blind --resync or remove/reconnect: reconnection is a cloud-preferred union, not deletion approval. Initial conflicting local versions are backed up under `~/.local/share/rclone/google-backups/%s/`.", address, address)
	} else {
		body += "\n\nDrive initial sync is not ready. Finish the initial folder choice in Settings → Integrations; do not assume local files are available."
	}
	return SkillAccount{Label: "Google", Kinds: []string{"mail", "calendar", "contacts", "files"}, Synced: ready, Body: body}
}
func mustTool(env Env, name string) string {
	p, ok := env.Tool(name)
	if !ok {
		return name
	}
	return p
}
func (g *google) Remove(_ context.Context, env Env, address string) error {
	g.native.Lock()
	defer g.native.Unlock()
	return g.remove(env, address)
}
func (g *google) remove(env Env, address string) error {
	if !ValidAddress(address) {
		return ToolFailed
	}
	// Unlink native keys directly: removal must work even with an absent tool or
	// expired grant, and must never need to decrypt/export a refresh token.
	fd, err := googleKeyring(env, false)
	if err == nil {
		for _, n := range googleTokenNames(address) {
			if e := unix.Unlinkat(fd, n, 0); e != nil && !errors.Is(e, unix.ENOENT) {
				unix.Close(fd)
				return e
			}
		}
		unix.Close(fd)
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	fd, err = openHomeDir(env.Home, false, splitPath(googleDir)...)
	if err == nil {
		err = unix.Unlinkat(fd, address+".conf", 0)
		unix.Close(fd)
		if err != nil && !errors.Is(err, unix.ENOENT) {
			return err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	names, fd, err := listHomeDir(env.Home, googleWork(address))
	if err != nil {
		return err
	}
	if fd >= 0 {
		defer unix.Close(fd)
		for _, n := range names {
			if err := unix.Unlinkat(fd, n, 0); err != nil {
				return err
			}
		}
	}
	return nil
}

func (g *google) StartLogin(_ context.Context, env Env, address string) (Login, error) {
	app, ok := env.googleApp()
	if !ok || !g.Available(env) {
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
	q := url.Values{"client_id": {app.ClientID}, "response_type": {"code"}, "redirect_uri": {googleRedirect}, "access_type": {"offline"}, "prompt": {"consent"}, "scope": {googleScopes}, "state": {state}, "code_challenge": {base64.RawURLEncoding.EncodeToString(hash[:])}, "code_challenge_method": {"S256"}}
	if address != "" {
		q.Set("login_hint", address)
	}
	return &googleLogin{entry: g, env: env, app: app, expected: address, state: state, verifier: verifier, auth: "https://accounts.google.com/o/oauth2/v2/auth?" + q.Encode(), redirect: make(chan string, 1)}, nil
}

type googleLogin struct {
	entry                           *google
	env                             Env
	app                             GoogleApp
	expected, state, verifier, auth string
	redirect                        chan string
	token                           []byte
	refresh                         string
}

func (l *googleLogin) Prompt(context.Context) (Prompt, error) {
	return Prompt{AuthorizationURL: l.auth, RedirectPrefix: googleRedirect, ExpiresAt: time.Now().Add(5 * time.Minute)}, nil
}
func (l *googleLogin) Redirect(_ context.Context, raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "http" || u.Host != "localhost" || (u.Path != "" && u.Path != "/") || u.User != nil || u.Fragment != "" {
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
func (g *google) request(ctx context.Context, endpoint string, form url.Values, bearer string, out any) error {
	method := http.MethodGet
	var body io.Reader
	if form != nil {
		method = http.MethodPost
		body = strings.NewReader(form.Encode())
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
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
	if g.client != nil {
		client = g.client
	}
	res, err := client.Do(req)
	if err != nil {
		return ToolFailed
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return ToolFailed
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, (64<<10)+1))
	if err != nil || len(data) > 64<<10 || json.Unmarshal(data, out) != nil {
		return ToolFailed
	}
	return nil
}
func (l *googleLogin) Wait(ctx context.Context) (string, error) {
	var code string
	select {
	case code = <-l.redirect:
	case <-ctx.Done():
		return "", ctx.Err()
	}
	var token struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int64  `json:"expires_in"`
		Scope        string `json:"scope"`
	}
	if l.entry.request(ctx, "https://oauth2.googleapis.com/token", url.Values{"grant_type": {"authorization_code"}, "code": {code}, "client_id": {l.app.ClientID}, "client_secret": {l.app.ClientSecret}, "redirect_uri": {googleRedirect}, "code_verifier": {l.verifier}}, "", &token) != nil || token.AccessToken == "" || token.RefreshToken == "" || token.ExpiresIn <= 0 || token.ExpiresIn > 86400 {
		return "", ToolFailed
	}
	// Google permits partial consent. Never advertise services the grant lacks.
	scopes := map[string]bool{}
	for _, s := range strings.Fields(token.Scope) {
		scopes[s] = true
	}
	for _, s := range strings.Fields(googleScopes) {
		if s != "openid" && s != "email" && !scopes[s] {
			return "", ToolFailed
		}
	}
	var account struct {
		Email    string `json:"email"`
		Verified bool   `json:"verified_email"`
	}
	if l.entry.request(ctx, "https://www.googleapis.com/oauth2/v2/userinfo", nil, token.AccessToken, &account) != nil {
		return "", ToolFailed
	}
	address := strings.ToLower(account.Email)
	if !account.Verified || !ValidAddress(address) {
		return "", ToolFailed
	}
	if l.expected != "" && address != l.expected {
		return "", AccountMismatch
	}
	l.refresh = token.RefreshToken
	l.token, _ = json.Marshal(map[string]any{"access_token": token.AccessToken, "refresh_token": token.RefreshToken, "token_type": "Bearer", "expiry": time.Now().Add(time.Duration(token.ExpiresIn) * time.Second).UTC().Format(time.RFC3339)})
	return address, nil
}
func (l *googleLogin) Commit(ctx context.Context, address string) (result error) {
	l.entry.native.Lock()
	defer l.entry.native.Unlock()
	defer l.Cancel()
	if len(l.token) == 0 || l.refresh == "" || !ValidAddress(address) || ctx.Err() != nil {
		return ToolFailed
	}
	accounts, err := l.entry.Accounts(l.env)
	if err != nil {
		return err
	}
	existing := false
	for _, a := range accounts {
		existing = existing || a == address
	}
	defer func() {
		if result != nil && !existing {
			_ = l.entry.remove(l.env, address)
		}
	}()
	// Prepare and verify the directories before invoking native tools. Both stores
	// are the person's own, with no credentials in argv or inherited environment.
	for _, rel := range []string{googleDir, googleGogHome + "/data", googleGogHome + "/data/keyring"} {
		fd, err := openHomeDir(l.env.Home, true, splitPath(rel)...)
		if err != nil {
			return err
		}
		unix.Close(fd)
	}
	creds, _ := json.Marshal(map[string]any{"installed": map[string]string{"client_id": l.app.ClientID, "client_secret": l.app.ClientSecret}})
	c, ok := gogCommand(l.env, "auth", "credentials", "set", "-", "--insecure")
	if !ok {
		return ToolFailed
	}
	if _, err := l.env.run(ctx, c, strings.NewReader(string(creds))); err != nil {
		return ToolFailed
	}
	// Publish both native stores under the catalog lock. Roll back a new account
	// on failure/cancellation; an existing account remains visible for repair.
	fd, err := openHomeDir(l.env.Home, false, splitPath(googleDir)...)
	if err != nil {
		return err
	}
	config := fmt.Sprintf("[google]\ntype = drive\nclient_id = %s\nclient_secret = %s\nscope = drive\ntoken = %s\n", l.app.ClientID, l.app.ClientSecret, l.token)
	err = writeFileAt(fd, address+".conf", []byte(config), 0600)
	unix.Close(fd)
	if err != nil {
		return err
	}
	data, _ := json.Marshal(map[string]any{"email": address, "refresh_token": l.refresh, "services": []string{"gmail", "calendar", "contacts", "drive"}, "scopes": strings.Fields(googleScopes)})
	c, ok = gogCommand(l.env, "auth", "tokens", "import", "-")
	if !ok {
		return ToolFailed
	}
	_, err = l.env.run(ctx, c, strings.NewReader(string(data)))
	return err
}
func (l *googleLogin) Cancel() { l.token = nil; l.refresh = "" }

var _ FolderEntry = (*google)(nil)
var _ LoginEntry = (*google)(nil)
