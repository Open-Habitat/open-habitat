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
	"regexp"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/unix"

	"github.com/open-habitat/open-habitat/internal/integrationapps"
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

// The levels' scope sets: Täysi, and Vain luku for every service. Google
// has no drafts scope without sending (gmail.compose sends too), so there
// is no drafts level.
const googleScopes = "openid email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/contacts"
const googleReadScopes = "openid email https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/contacts.readonly"

func googleLevelScopes(level Level) string {
	if level == LevelRead {
		return googleReadScopes
	}
	return googleScopes
}

// googleAskedLevel is the level whose scope set a grant came from: read
// when it holds only read-level scopes. The two sets share nothing but
// identity, so a grant narrowed on the consent page still names its set.
func googleAskedLevel(granted map[string]bool) Level {
	read := false
	for s := range granted {
		if googleIdentity[s] {
			continue
		}
		if strings.Contains(" "+googleScopes+" ", " "+s+" ") {
			return LevelFull
		}
		read = read || strings.Contains(" "+googleReadScopes+" ", " "+s+" ")
	}
	if read {
		return LevelRead
	}
	return LevelFull
}

const googleGogHome = ".config/gog/open-habitat"

// The file keyring is protected by Unix permissions, just like rclone's tokens.
// Its fixed encryption password is not a security boundary or another secret store.
var googleGogEnv = []string{"GOG_KEYRING_BACKEND=file", "GOG_KEYRING_PASSWORD=open-habitat"}

func (*google) Provider() Provider            { return Google }
func (*google) Login() LoginKind              { return PastedRedirect }
func (*google) mirrorsRead()                  {}
func (*google) Services() []string            { return []string{"drive", "mail", "calendar", "contacts"} }
func (g *google) Available(env Env) bool      { return g.ToolsInstalled(env) && g.AppConfigured(env) }
func (*google) Tools() []string               { return []string{"rclone", "gog"} }
func (g *google) ToolsInstalled(env Env) bool { return MissingTools(g, env) == nil }
func (*google) AppConfigured(env Env) bool {
	_, a := env.googleApp()
	return a
}

// Levels: Täysi and Vain luku from the one application; the drafts level is
// shown as one Google does not offer.
func (g *google) Levels(env Env) []LevelOption {
	ok := g.AppConfigured(env)
	return []LevelOption{appLevel(LevelFull, ok), {ID: LevelDrafts, Reason: LevelNotOffered}, appLevel(LevelRead, ok)}
}

// Level is the level every service's access amounts to, or "" when the
// person or a Workspace left some service out or granted a mixture.
func (*google) Level(_ Env, _ string, services []Service) Level {
	if len(services) == 0 {
		return ""
	}
	want := services[0].Access
	for _, s := range services {
		if s.Access != want {
			return ""
		}
	}
	switch want {
	case AccessFull:
		return LevelFull
	case AccessRead:
		return LevelRead
	}
	return ""
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
	out, _ := g.CheckGrant(ctx, env, address)
	return out
}

// CheckGrant reads the services' states and the grant they run on.
func (g *google) CheckGrant(ctx context.Context, env Env, address string) ([]Service, *Grant) {
	// Checks of different accounts share the read lease; removal/replacement
	// waits for every native process that could still use or refresh credentials.
	g.native.RLock()
	defer g.native.RUnlock()
	lock, _ := g.checks.LoadOrStore(address, &sync.Mutex{})
	check := lock.(*sync.Mutex)
	check.Lock()
	defer check.Unlock()
	granted, known := googleGrant(ctx, env, address)
	reaches := func(service string) bool {
		return !known || googleRules.access(service, granted) != AccessNone
	}
	drive, driveFailure, expired := StateUnknown, "", false
	if c, ok := googleCommand(env, address, "about", "google:", "--json"); ok && reaches("drive") {
		if err, rejected := dropboxStatus(ctx, env, c); err == nil {
			_, ready := g.SyncCommand(env, address)
			drive, driveFailure = signedInState(ready)
			if !ready && googleNotChosen(env, address) {
				drive, driveFailure = StateSyncFailed, FoldersNotChosen
			}
		} else if rejected {
			drive, expired = StateLoginExpired, true
		} else {
			drive = StateUnreachable
		}
	}
	out := []Service{{ID: "drive", State: drive, Failure: driveFailure}, {ID: "mail", State: StateUnknown}, {ID: "calendar", State: StateUnknown}, {ID: "contacts", State: StateUnknown}}
	var grant *Grant
	if known {
		defer applyAccess(googleRules, granted, out)
		grant = grantOf(granted, strings.Fields(googleLevelScopes(googleAskedLevel(granted))), googleIdentity)
	}
	if expired {
		// Both native stores received the same grant. Its rejection is not a
		// network outage in the other three services (Testing tokens expire weekly).
		for i := range out {
			out[i].State = StateLoginExpired
		}
		return out, grant
	}
	if !googleHasToken(env, address) {
		return out, grant
	}
	// Four serial exchanges per account consume the catalog deadline before a
	// second account is reached. Independent read-only service probes run together.
	var wg sync.WaitGroup
	for i, args := range [][]string{{"gmail", "labels", "list"}, {"calendar", "calendars", "--max", "1"}, {"contacts", "list", "--max", "1"}} {
		if !reaches(out[i+1].ID) {
			continue
		}
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
	return out, grant
}

// googleRules are the Google services' levels in Google's own scope names.
// The catalog asks for the first of each; a person may leave any of them out
// on Google's consent page, and an earlier or narrower grant may name others.
// Any scope that sends mail is full: the page never claims less than the
// token can do.
var googleRules = grantRules{
	"drive":    {{[]string{googleScope + "drive"}, AccessFull}, {[]string{googleScope + "drive.readonly"}, AccessRead}},
	"mail":     {{[]string{"https://mail.google.com/"}, AccessFull}, {[]string{googleScope + "gmail.modify"}, AccessFull}, {[]string{googleScope + "gmail.compose"}, AccessFull}, {[]string{googleScope + "gmail.send"}, AccessFull}, {[]string{googleScope + "gmail.readonly"}, AccessRead}},
	"calendar": {{[]string{googleScope + "calendar"}, AccessFull}, {[]string{googleScope + "calendar.readonly"}, AccessRead}},
	"contacts": {{[]string{googleScope + "contacts"}, AccessFull}, {[]string{googleScope + "contacts.readonly"}, AccessRead}},
}

const googleScope = "https://www.googleapis.com/auth/"

// Google adds these to every grant; they are identity, not permissions.
var googleIdentity = map[string]bool{"openid": true, "email": true, "profile": true, googleScope + "userinfo.email": true, googleScope + "userinfo.profile": true}

// googleGrantServices are gog's names for the services a grant reaches.
func googleGrantServices(granted map[string]bool) []string {
	var out []string
	for _, s := range []struct{ service, gog string }{{"mail", "gmail"}, {"calendar", "calendar"}, {"contacts", "contacts"}, {"drive", "drive"}} {
		if googleRules.access(s.service, granted) != AccessNone {
			out = append(out, s.gog)
		}
	}
	return out
}

// googleGrant reads the account's grant from gog's own store, where the
// sign-in imported the scopes Google's token response named. gog answers
// from its files without the network; false when it cannot be read.
func googleGrant(ctx context.Context, env Env, address string) (map[string]bool, bool) {
	c, ok := gogCommand(env, "auth", "list")
	if !ok {
		return nil, false
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	data, err := env.run(ctx, c, nil)
	if err != nil {
		return nil, false
	}
	var list struct {
		Accounts []struct {
			Email  string   `json:"email"`
			Scopes []string `json:"scopes"`
		} `json:"accounts"`
	}
	if json.Unmarshal(data, &list) != nil {
		return nil, false
	}
	for _, a := range list.Accounts {
		if strings.EqualFold(a.Email, address) && len(a.Scopes) > 0 {
			return scopeSet(a.Scopes, func(s string) string { return s }), true
		}
	}
	return nil, false
}

func (g *google) Skill(env Env, address string) SkillAccount {
	_, ready := g.SyncCommand(env, address)
	granted, known := googleGrant(context.Background(), env, address)
	driveAccess := AccessFull
	var services []Service
	if known {
		driveAccess = googleRules.access("drive", granted)
		for _, id := range g.Services() {
			services = append(services, Service{ID: id, Access: googleRules.access(id, granted)})
		}
	}
	body := fmt.Sprintf("Gmail, Calendar, Contacts and Drive are reached with gog. Every command starts\n\n    GOG_KEYRING_BACKEND=file GOG_KEYRING_PASSWORD=open-habitat %s --home ~/.config/gog/open-habitat --account %s --no-input --json\n\nfollowed by the gog command: `gmail`, `calendar`, `contacts`, `drive` for Google-native documents online, and `sheets`, `docs` and `slides` to read and edit Google Sheets, Docs and Slides in place; `--help` has the syntax. The keyring password on that line is a fixed setting of gog's file backend and not a secret. The tokens in the keyring are, which is why `auth tokens export` is left alone.", mustTool(env, "gog"), address)
	body += "\n\nAn error saying an API \"has not been used in project\", \"is disabled\" or \"is not enabled for this OAuth project\" is not missing permission, and the person cannot fix it by signing in again: the server's administrator must enable that API in the Google Cloud project, at " + googleEnableURL(env) + " or the link Google's error names. Tell the person exactly that."
	mirror := ready && googleDriveMirror(env, address)
	backups := fmt.Sprintf(" Local files that the first sync replaced or removed are kept under `~/.local/share/rclone/google-backups/%s/`.", address)
	const native = " Google-native documents and shortcuts are not ordinary files and are left out: reach those online with gog."
	if mirror {
		body += fmt.Sprintf("\n\nOrdinary Drive files are under `~/cloud/google-drive/%s/`, a one-way mirror of Drive because Drive is read-only for this account.", address) + native + backups
	} else if ready {
		body += fmt.Sprintf("\n\nOrdinary Drive files sync both ways under `~/cloud/google-drive/%s/`.", address) + native + backups
	} else if driveAccess != AccessNone {
		body += "\n\nDrive's initial sync is not ready, so local Drive files cannot be relied on yet. The person finishes the folder choice in Settings → Integrations."
	} else {
		body += "\n\nDrive is not granted, so no Drive files are synced."
	}
	body += accessSummary(services, map[string]string{"drive": "Drive", "mail": "Gmail", "calendar": "Calendar", "contacts": "Contacts"})
	return SkillAccount{Label: "Google", Kinds: []string{"mail", "calendar", "contacts", "files"}, Synced: ready && !mirror, Mirrored: mirror, Body: body}
}

// googleAPIs are the APIs gog calls for the scopes the levels request; the
// drive scope covers Sheets, Docs and Slides, but each has its own API that
// the Cloud project must enable.
const googleAPIs = "gmail.googleapis.com,calendar-json.googleapis.com,drive.googleapis.com,people.googleapis.com,sheets.googleapis.com,docs.googleapis.com,slides.googleapis.com"

var googleProjectNumber = regexp.MustCompile(`^([0-9]+)-[^/?#&]+\.apps\.googleusercontent\.com$`)

// googleEnableURL opens the console's enable flow for every API, in the
// client's project when its id names one: an installed client id starts with
// the project number, which is how Google's own "not enabled" errors link it.
func googleEnableURL(env Env) string {
	u := "https://console.cloud.google.com/apis/enableflow?apiid=" + googleAPIs
	if app, ok := env.googleApp(); ok {
		if m := googleProjectNumber.FindStringSubmatch(app.ClientID); m != nil {
			u += "&project=" + m[1]
		}
	}
	return u
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
		for _, n := range []string{address + ".conf", googleFilter(address), googleFilter(address) + ".md5"} {
			if e := unix.Unlinkat(fd, n, 0); e != nil && !errors.Is(e, unix.ENOENT) {
				unix.Close(fd)
				return e
			}
		}
		unix.Close(fd)
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

func (g *google) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	return g.StartLevelLogin(ctx, env, address, "")
}

// StartLevelLogin asks for the level's scope set. A renewal without a level
// asks for the set the account's grant came from.
func (g *google) StartLevelLogin(ctx context.Context, env Env, address string, level Level) (Login, error) {
	app, ok := env.googleApp()
	if !ok || !g.Available(env) {
		return nil, ToolFailed
	}
	if level == "" && address != "" {
		own, known := googleOwnLevel(ctx, env, address)
		switch {
		case known:
			level = own
		case googleHasToken(env, address):
			// Its grant cannot be read: guessing could broaden it.
			return nil, ToolFailed
		default:
			// Nothing of the account is here; it connects anew.
			level = LevelFull
		}
	} else if level == "" {
		level = LevelFull
	}
	if level != LevelFull && level != LevelRead {
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
	q := url.Values{"client_id": {app.ClientID}, "response_type": {"code"}, "redirect_uri": {googleRedirect}, "access_type": {"offline"}, "prompt": {"consent"}, "scope": {googleLevelScopes(level)}, "state": {state}, "code_challenge": {base64.RawURLEncoding.EncodeToString(hash[:])}, "code_challenge_method": {"S256"}}
	if address != "" {
		q.Set("login_hint", address)
	}
	return &googleLogin{entry: g, env: env, app: app, level: level, expected: address, state: state, verifier: verifier, auth: "https://accounts.google.com/o/oauth2/v2/auth?" + q.Encode(), redirect: make(chan string, 1)}, nil
}

type googleLogin struct {
	entry                           *google
	env                             Env
	app                             GoogleApp
	level                           Level
	expected, state, verifier, auth string
	redirect                        chan string
	token                           []byte
	refresh                         string
	granted                         map[string]bool
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
	// Google permits partial consent, and a Workspace may allow less. The
	// account is connected with what was granted and its services show the
	// rest as not granted; a grant that reaches no service connects nothing.
	granted := scopeSet(strings.Fields(token.Scope), func(s string) string { return s })
	if len(googleGrantServices(granted)) == 0 {
		return "", NothingGranted
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
	if l.expected == "" {
		// A new connection that turns out to be an account already here is
		// a renewal, which keeps its level. At another level it would be a
		// level change without the old grant ended first, and ending it now
		// would end this one too: refuse it, and leave the grant unused.
		if accounts, err := l.entry.Accounts(l.env); err != nil {
			return "", ToolFailed
		} else if slices.Contains(accounts, address) {
			if own, known := googleOwnLevel(ctx, l.env, address); !known || own != l.level {
				return "", AlreadyConnected
			}
		}
	}
	l.refresh = token.RefreshToken
	l.granted = granted
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
	// rclone's own scope option says the files' direction: drive syncs both
	// ways, drive.readonly is a one-way mirror.
	before, _ := googleReadNative(l.env, address)
	scope := map[Access]string{AccessFull: "drive", AccessRead: "drive.readonly"}[googleRules.access("drive", l.granted)]
	fd, err := openHomeDir(l.env.Home, false, splitPath(googleDir)...)
	if err != nil {
		return err
	}
	if scope != "" {
		config := fmt.Sprintf("[google]\ntype = drive\nclient_id = %s\nclient_secret = %s\nscope = %s\ntoken = %s\n", l.app.ClientID, l.app.ClientSecret, scope, l.token)
		err = writeFileAt(fd, address+".conf", []byte(config), 0600)
	} else if err = unix.Unlinkat(fd, address+".conf", 0); errors.Is(err, unix.ENOENT) {
		// A grant without Drive retires an earlier one's rclone login. The
		// synced directory and its listings stay for a later Drive grant.
		err = nil
	}
	unix.Close(fd)
	if err != nil {
		return err
	}
	if before.scope != "" && scope != "" && before.scope != scope {
		// The pair's listings, or the mirror's marker, describe the old
		// direction; the person's next choice starts the new one.
		if err := clearWork(l.env, googleWork(address)); err != nil {
			return err
		}
	}
	var scopes []string
	for s := range l.granted {
		scopes = append(scopes, s)
	}
	sort.Strings(scopes)
	// gog keeps the grant's own scopes beside its token; googleGrant reads
	// them back, so no other record of the grant exists.
	data, _ := json.Marshal(map[string]any{"email": address, "refresh_token": l.refresh, "services": googleGrantServices(l.granted), "scopes": scopes})
	c, ok = gogCommand(l.env, "auth", "tokens", "import", "-")
	if !ok {
		return ToolFailed
	}
	_, err = l.env.run(ctx, c, strings.NewReader(string(data)))
	return err
}
func (l *googleLogin) Cancel() { l.token = nil; l.refresh = "" }

// FolderChoiceAfterLogin offers the Drive choice only when the grant let
// rclone sign in and Drive has not synced yet.
func (g *google) FolderChoiceAfterLogin(env Env, address string) (bool, error) {
	if _, ok := googleCommand(env, address, "about"); !ok {
		return false, nil
	}
	_, ready := g.SyncCommand(env, address)
	return !ready, nil
}

// endLevel ends the account's old grant before a sign-in at another level
// (revokeFirstEntry). Google's revocation of any token of the application
// ends the person's whole grant to it, so revoking the replaced login after
// the new sign-in would end the new one too. The same level is a renewal
// and revokes nothing.
func (g *google) endLevel(ctx context.Context, env Env, address string, level Level) error {
	g.native.Lock()
	defer g.native.Unlock()
	if !ValidAddress(address) || (level != LevelFull && level != LevelRead) {
		return ToolFailed
	}
	granted, known := googleGrant(ctx, env, address)
	if known {
		services := make([]Service, 0, 4)
		for _, id := range g.Services() {
			services = append(services, Service{ID: id, Access: googleRules.access(id, granted)})
		}
		if g.Level(env, address, services) == level {
			return nil
		}
	}
	native, _ := googleReadNative(env, address)
	if native.scope == "drive" && level != LevelFull {
		// Drive stops syncing both ways: what was made locally reaches
		// Drive once more with the old grant, or nothing changes.
		if listingsFailed(env.Home, googleWork(address)) {
			return FinalSyncFailed
		}
		if _, syncing := g.SyncCommand(env, address); syncing {
			cmd, ok := googleBisync(env, address)
			if !ok || env.runInitialSync(ctx, cmd, "drive") != nil {
				return FinalSyncFailed
			}
		}
	}
	refresh := native.refresh
	if refresh == "" {
		var err error
		if refresh, err = googleExportRefresh(ctx, env, address); err != nil {
			return err
		}
	}
	return g.revoke(ctx, refresh)
}

// googleOwnLevel is the level of an account's grant: from gog's record of
// it, or else from the Drive scope rclone signed in with. False when neither
// answers.
func googleOwnLevel(ctx context.Context, env Env, address string) (Level, bool) {
	if granted, known := googleGrant(ctx, env, address); known {
		return googleAskedLevel(granted), true
	}
	switch n, _ := googleReadNative(env, address); n.scope {
	case "drive":
		return LevelFull, true
	case "drive.readonly":
		return LevelRead, true
	}
	return "", false
}

// googleExportRefresh reads the account's refresh token from gog's store,
// for an account whose grant gave rclone no login. Empty when there is none.
func googleExportRefresh(ctx context.Context, env Env, address string) (string, error) {
	if !googleHasToken(env, address) {
		return "", nil
	}
	c, ok := gogCommand(env, "auth", "tokens", "export", address, "--out", "/dev/stdout", "--overwrite")
	if !ok {
		return "", RevokeFailed
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	data, err := env.run(ctx, c, nil)
	if err != nil {
		return "", RevokeFailed
	}
	// gog writes the token file to its output and then its own summary.
	var t struct {
		Email   string `json:"email"`
		Refresh string `json:"refresh_token"`
	}
	if json.NewDecoder(strings.NewReader(string(data))).Decode(&t) != nil || !strings.EqualFold(t.Email, address) || t.Refresh == "" {
		// A token is there but cannot be read: it cannot be ended either.
		return "", RevokeFailed
	}
	return t.Refresh, nil
}

// revoke ends the grant a refresh token belongs to at Google. A token Google
// no longer knows is already ended.
func (g *google) revoke(ctx context.Context, refresh string) error {
	if refresh == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth2.googleapis.com/revoke", strings.NewReader(url.Values{"token": {refresh}}.Encode()))
	if err != nil {
		return RevokeFailed
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	if g.client != nil {
		client = g.client
	}
	res, err := client.Do(req)
	if err != nil {
		return RevokeFailed
	}
	defer res.Body.Close()
	data, err := io.ReadAll(io.LimitReader(res.Body, 64<<10+1))
	if res.StatusCode == 200 {
		return nil
	}
	var refused struct {
		Error string `json:"error"`
	}
	if res.StatusCode == 400 && err == nil && len(data) <= 64<<10 && json.Unmarshal(data, &refused) == nil && (refused.Error == "invalid_token" || refused.Error == "invalid_grant") {
		return nil
	}
	return RevokeFailed
}

var _ FolderEntry = (*google)(nil)
var _ LevelEntry = (*google)(nil)
var _ revokeFirstEntry = (*google)(nil)
var _ GrantEntry = (*google)(nil)
var _ LoginEntry = (*google)(nil)
