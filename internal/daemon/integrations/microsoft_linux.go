//go:build linux

package integrations

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/unix"
)

// MicrosoftApp is a public Entra client. TenantID is the login audience (common
// for both work and personal accounts), not the operator's home tenant.
type MicrosoftApp struct {
	ClientID string `json:"client_id"`
	TenantID string `json:"tenant_id"`
}

var microsoftID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func (env Env) microsoftApp() (MicrosoftApp, bool) {
	cfg := env.Config
	if env.LoadConfig != nil {
		var err error
		cfg, err = env.LoadConfig()
		if err != nil {
			return MicrosoftApp{}, false
		}
	}
	if cfg.Microsoft == nil {
		return MicrosoftApp{}, false
	}
	a := *cfg.Microsoft
	if a.TenantID == "" {
		a.TenantID = "common"
	}
	return a, microsoftID.MatchString(a.ClientID) && (a.TenantID == "common" || a.TenantID == "consumers" || a.TenantID == "organizations" || microsoftID.MatchString(a.TenantID))
}

const microsoftDir = ".config/rclone/open-habitat-microsoft"
const microsoftMCPDir = ".config/ms-365-mcp-server/open-habitat"
const microsoftScopes = "User.Read offline_access Files.ReadWrite.All Sites.ReadWrite.All"
const microsoftMCPScopes = "User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite"

type microsoft struct {
	native sync.Mutex
	client *http.Client
}

func (*microsoft) Provider() Provider { return Microsoft }
func (*microsoft) Login() LoginKind   { return DeviceCode }
func (*microsoft) Services() []string {
	return []string{"onedrive", "sharepoint", "mail", "calendar", "contacts"}
}
func (*microsoft) Available(env Env) bool {
	_, a := env.microsoftApp()
	_, r := env.Tool("rclone")
	_, m := env.Tool("ms-365-mcp-server")
	_, p := env.Tool("pi")
	return a && r && m && p
}
func (*microsoft) Accounts(env Env) ([]string, error) {
	// The native stores are a union: an interrupted commit or manual cleanup
	// of one tool must leave the account visible for repair/removal.
	accounts := map[string]bool{}
	names, fd, err := listHomeDir(env.Home, microsoftDir)
	if err != nil {
		return nil, err
	}
	if fd >= 0 {
		defer unix.Close(fd)
		for _, n := range names {
			if a, ok := strings.CutSuffix(n, ".conf"); ok && ValidAddress(a) {
				if _, err := readFileAt(fd, n, 64<<10); err != nil {
					return nil, err
				}
				accounts[a] = true
			}
		}
	}
	names, mcp, err := listHomeDir(env.Home, microsoftMCPDir)
	if err != nil {
		return nil, err
	}
	if mcp >= 0 {
		defer unix.Close(mcp)
		for _, a := range names {
			if !ValidAddress(a) {
				continue
			}
			dir, err := openHomeDir(env.Home, false, splitPath(microsoftMCPDir+"/"+a)...)
			if err != nil {
				return nil, err
			}
			_, err = readFileAt(dir, ".token-cache.json", 256<<10)
			unix.Close(dir)
			if err == nil {
				accounts[a] = true
			} else if !errors.Is(err, os.ErrNotExist) {
				return nil, err
			}
		}
	}
	var out []string
	for a := range accounts {
		out = append(out, a)
	}
	sort.Strings(out)
	return out, nil
}

func microsoftMCPCommand(env Env, app MicrosoftApp, rel, address string, args ...string) (Command, bool) {
	// Derive the personal-account authority from rclone's native drive type;
	// never create a second account/audience record.
	if remotes, err := microsoftRemotes(env, address); err == nil {
		for _, r := range remotes {
			if r.Name == "onedrive" && r.DriveType == "personal" {
				app.TenantID = "consumers"
			}
		}
	}
	tool, ok := env.Tool("ms-365-mcp-server")
	if !ok {
		return Command{}, false
	}
	c := Command{Path: tool, Args: append([]string{"--preset", "mail,calendar,contacts", "--allowed-scopes", microsoftMCPScopes}, args...), Env: []string{
		"MS365_MCP_CLIENT_ID=" + app.ClientID, "MS365_MCP_TENANT_ID=" + app.TenantID,
		"MS365_MCP_USE_KEYTAR=false", "MS365_MCP_TOKEN_CACHE_PATH=" + filepath.Join(env.Home, rel, ".token-cache.json"),
		"MS365_MCP_SELECTED_ACCOUNT_PATH=" + filepath.Join(env.Home, rel, ".selected-account.json"),
		"MS365_MCP_EXPECTED_USERNAME=" + address,
	}}
	return c, true
}

// request keeps provider responses bounded and never exposes native error text.
func (m *microsoft) request(ctx context.Context, endpoint string, form url.Values, bearer string, out any) error {
	method := "GET"
	var body io.Reader
	if form != nil {
		method = "POST"
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
	if m.client != nil {
		client = m.client
	}
	res, err := client.Do(req)
	if err != nil {
		return ServerUnreachable
	}
	defer res.Body.Close()
	data, err := io.ReadAll(io.LimitReader(res.Body, (256<<10)+1))
	if err != nil || len(data) > 256<<10 || json.Unmarshal(data, out) != nil {
		return ToolFailed
	}
	// OAuth polling errors have structured bodies on HTTP 400.
	if res.StatusCode != 200 && form == nil {
		return ToolFailed
	}
	return nil
}
func microsoftAuthority(app MicrosoftApp) string {
	return "https://login.microsoftonline.com/" + app.TenantID + "/oauth2/v2.0/"
}
func microsoftConsent(app MicrosoftApp) ConsentRequired {
	return ConsentRequired{URL: "https://login.microsoftonline.com/organizations/v2.0/adminconsent?" + url.Values{"client_id": {app.ClientID}, "scope": {microsoftScopes + " " + microsoftMCPScopes}, "redirect_uri": {"https://login.microsoftonline.com/common/oauth2/nativeclient"}}.Encode()}
}
func microsoftAuthFailure(app MicrosoftApp, code string, numbers []int) error {
	for _, n := range numbers {
		switch n {
		case 65001, 65004, 90094:
			return microsoftConsent(app)
		case 53003, 530032:
			return DeviceCodeBlocked
		}
	}
	switch code {
	case "authorization_pending":
		return nil
	case "expired_token":
		return Expired
	case "authorization_declined", "access_denied":
		return CredentialsRejected
	case "slow_down":
		return nil
	}
	return ToolFailed
}

type microsoftLogin struct {
	entry            *microsoft
	env              Env
	app              MicrosoftApp
	expected         string
	device           string
	prompt           Prompt
	interval         time.Duration
	token            []byte
	config           []byte
	address, staging string
}

func (m *microsoft) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	app, ok := env.microsoftApp()
	if !ok || !m.Available(env) {
		return nil, ToolFailed
	}
	var d struct {
		DeviceCode string `json:"device_code"`
		UserCode   string `json:"user_code"`
		URI        string `json:"verification_uri"`
		Expires    int    `json:"expires_in"`
		Interval   int    `json:"interval"`
		Error      string `json:"error"`
		Codes      []int  `json:"error_codes"`
	}
	if err := m.request(ctx, microsoftAuthority(app)+"devicecode", url.Values{"client_id": {app.ClientID}, "scope": {microsoftScopes}}, "", &d); err != nil {
		return nil, err
	}
	if d.Error != "" {
		return nil, microsoftAuthFailure(app, d.Error, d.Codes)
	}
	if d.DeviceCode == "" || d.Expires < 1 || d.Expires > 900 {
		return nil, ToolFailed
	}
	if d.Interval < 1 {
		d.Interval = 5
	}
	if d.Interval > 30 {
		return nil, ToolFailed
	}
	p := Prompt{VerificationURI: d.URI, UserCode: d.UserCode, ExpiresAt: time.Now().Add(time.Duration(d.Expires) * time.Second)}
	if !validPrompt(DeviceCode, p) || (d.URI != "https://microsoft.com/devicelogin" && d.URI != "https://login.microsoftonline.com/common/oauth2/deviceauth" && d.URI != "https://login.microsoft.com/device") {
		return nil, ToolFailed
	}
	return &microsoftLogin{entry: m, env: env, app: app, expected: address, device: d.DeviceCode, prompt: p, interval: time.Duration(d.Interval) * time.Second}, nil
}
func (l *microsoftLogin) Prompt(context.Context) (Prompt, error) { return l.prompt, nil }
func (l *microsoftLogin) Redirect(context.Context, string) error { return RedirectRejected }
func (l *microsoftLogin) Wait(ctx context.Context) (string, error) {
	return l.WaitWithPrompt(ctx, func(Prompt) error { return ToolFailed })
}
func (l *microsoftLogin) WaitWithPrompt(ctx context.Context, show func(Prompt) error) (string, error) {
	var token struct {
		Access  string `json:"access_token"`
		Refresh string `json:"refresh_token"`
		Expires int    `json:"expires_in"`
		Scope   string `json:"scope"`
		Error   string `json:"error"`
		Codes   []int  `json:"error_codes"`
	}
	for {
		timer := time.NewTimer(l.interval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return "", ctx.Err()
		case <-timer.C:
		}
		if err := l.entry.request(ctx, microsoftAuthority(l.app)+"token", url.Values{"client_id": {l.app.ClientID}, "grant_type": {"urn:ietf:params:oauth:grant-type:device_code"}, "device_code": {l.device}}, "", &token); err != nil {
			return "", err
		}
		if token.Error == "" {
			break
		}
		if err := microsoftAuthFailure(l.app, token.Error, token.Codes); err != nil {
			return "", err
		}
		if token.Error == "slow_down" {
			l.interval += 5 * time.Second
		}
		token.Error = ""
	}
	if token.Access == "" || token.Refresh == "" || token.Expires <= 0 || token.Expires > 86400 {
		return "", ToolFailed
	}
	scopes := map[string]bool{}
	for _, s := range strings.Fields(token.Scope) {
		scopes[s] = true
	}
	for _, s := range []string{"User.Read", "Files.ReadWrite.All"} {
		if !scopes[s] {
			return "", ToolFailed
		}
	}
	var me struct {
		Mail string `json:"mail"`
		UPN  string `json:"userPrincipalName"`
	}
	if err := l.entry.request(ctx, "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", nil, token.Access, &me); err != nil {
		return "", err
	}
	address := strings.ToLower(me.UPN)
	if !ValidAddress(address) {
		address = strings.ToLower(me.Mail)
	}
	if !ValidAddress(address) {
		return "", ToolFailed
	}
	if l.expected != "" && l.expected != address {
		return "", AccountMismatch
	}
	l.address = address
	l.token, _ = json.Marshal(map[string]any{"access_token": token.Access, "refresh_token": token.Refresh, "token_type": "Bearer", "expiry": time.Now().Add(time.Duration(token.Expires) * time.Second).UTC().Format(time.RFC3339)})
	if err := l.discover(ctx, token.Access, scopes["Sites.ReadWrite.All"]); err != nil {
		return "", err
	}
	// Each native client obtains its own refresh token. No host token cache,
	// MSAL cache-format imitation, or cross-client refresh-token sharing.
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return "", err
	}
	l.staging = microsoftMCPDir + "/.login-" + hex.EncodeToString(random[:])
	fd, err := openHomeDir(l.env.Home, true, splitPath(l.staging)...)
	if err != nil {
		return "", err
	}
	unix.Close(fd)
	cmd, ok := microsoftMCPCommand(l.env, l.app, l.staging, address, "--login")
	if !ok {
		return "", ToolFailed
	}
	tool, err := l.env.StartLineTool(ctx, cmd)
	if err != nil {
		return "", err
	}
	defer tool.Stop()
	prompted, verified := false, false
	for line := range tool.Lines() {
		var result struct {
			Success bool `json:"success"`
		}
		if json.Unmarshal([]byte(line), &result) == nil && result.Success {
			verified = true
		}
		if strings.Contains(line, "AADSTS65001") || strings.Contains(line, "AADSTS90094") {
			return "", microsoftConsent(l.app)
		}
		if strings.Contains(line, "AADSTS53003") {
			return "", DeviceCodeBlocked
		}
		if match := microsoftDeviceLine.FindStringSubmatch(line); match != nil {
			if prompted {
				return "", ToolFailed
			}
			prompted = true
			if err := show(Prompt{VerificationURI: match[1], UserCode: match[2], ExpiresAt: time.Now().Add(15 * time.Minute)}); err != nil {
				return "", err
			}
		}
	}
	if ctx.Err() != nil {
		return "", ctx.Err()
	}
	if !prompted || !verified || tool.Err() != nil {
		return "", ToolFailed
	}
	cmd, _ = microsoftMCPCommand(l.env, l.app, l.staging, address, "--list-accounts")
	data, err := l.env.run(ctx, cmd, nil)
	var accounts struct {
		Accounts []struct {
			Username string `json:"username"`
		} `json:"accounts"`
	}
	if err != nil || json.Unmarshal(data, &accounts) != nil || len(accounts.Accounts) != 1 || !strings.EqualFold(accounts.Accounts[0].Username, address) {
		return "", AccountMismatch
	}
	return address, nil
}

var microsoftDeviceLine = regexp.MustCompile(`open the page (https://(?:login\.microsoft\.com/device|microsoft\.com/devicelogin)) and enter the code ([A-Z0-9-]{4,16})`)

func (l *microsoftLogin) Cancel() {
	l.device = ""
	l.token = nil
	l.config = nil
	if l.staging != "" {
		_ = microsoftRemoveFiles(l.env, l.staging)
		if parent, err := openHomeDir(l.env.Home, false, splitPath(microsoftMCPDir)...); err == nil {
			_ = unix.Unlinkat(parent, filepath.Base(l.staging), unix.AT_REMOVEDIR)
			unix.Close(parent)
		}
		l.staging = ""
	}
}
func microsoftRemoveFiles(env Env, rel string) error {
	names, fd, err := listHomeDir(env.Home, rel)
	if err != nil || fd < 0 {
		return err
	}
	defer unix.Close(fd)
	for _, n := range names {
		if err := unix.Unlinkat(fd, n, 0); err != nil {
			return err
		}
	}
	return nil
}
func microsoftServerName(address string) string {
	return "habitat-microsoft-" + hex.EncodeToString([]byte(address))
}
func (l *microsoftLogin) Commit(ctx context.Context, address string) (result error) {
	l.entry.native.Lock()
	defer l.entry.native.Unlock()
	defer l.Cancel()
	if address != l.address || !ValidAddress(address) || len(l.config) == 0 || l.staging == "" || ctx.Err() != nil {
		return ToolFailed
	}
	fd, err := openHomeDir(l.env.Home, true, splitPath(microsoftDir)...)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	old, oldErr := readFileAt(fd, address+".conf", 64<<10)
	if oldErr != nil && !errors.Is(oldErr, os.ErrNotExist) {
		return oldErr
	}

	hadServer, err := microsoftMCPConfigured(l.env, address)
	if err != nil {
		return err
	}
	parent, err := openHomeDir(l.env.Home, false, splitPath(microsoftMCPDir)...)
	if err != nil {
		return err
	}
	defer unix.Close(parent)
	stage, err := openHomeDir(l.env.Home, false, splitPath(l.staging)...)
	if err != nil {
		return err
	}
	defer unix.Close(stage)
	// Check the native cache before publishing it. A key and its two encrypted
	// files form one unit: copying them individually could strand an existing
	// login under a replaced key after an interrupted repair.
	for _, name := range []string{".cache-key", ".token-cache.json", ".selected-account.json"} {
		if _, err := readFileAt(stage, name, 256<<10); err != nil {
			return err
		}
	}
	stageName := filepath.Base(l.staging)
	backupName := stageName + "-previous"
	previous, published := false, false
	oldDir, err := openHomeDir(l.env.Home, false, splitPath(microsoftMCPDir+"/"+address)...)
	if err == nil {
		unix.Close(oldDir)
		if err := unix.Renameat(parent, address, parent, backupName); err != nil {
			return err
		}
		previous = true
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	defer func() {
		if result != nil {
			// pi mcp add can have written its native config before cancellation.
			// Remove a newly introduced entry with a separate cleanup deadline.
			// If cleanup cannot be established, retain the native cache so the
			// partial account remains visible for explicit repair/removal.
			keepPartial := false
			if !hadServer {
				configured, err := microsoftMCPConfigured(l.env, address)
				if err != nil {
					keepPartial = true
				} else if configured {
					pi, ok := l.env.Tool("pi")
					if !ok {
						keepPartial = true
					} else {
						cleanup, cancel := context.WithTimeout(context.Background(), 10*time.Second)
						_, err := l.env.run(cleanup, Command{Path: pi, Args: []string{"mcp", "remove", microsoftServerName(address)}}, nil)
						cancel()
						keepPartial = err != nil
					}
				}
			}
			if published && !keepPartial {
				if err := unix.Renameat(parent, address, parent, stageName); err != nil {
					keepPartial = true
				}
			}
			if previous && !keepPartial {
				_ = unix.Renameat(parent, backupName, parent, address)
			}
			if oldErr == nil {
				_ = writeFileAt(fd, address+".conf", old, 0600)
			} else {
				_ = unix.Unlinkat(fd, address+".conf", 0)
			}
			// If the new cache remains published, Cancel must not remove it.
			if keepPartial && published {
				l.staging = ""
			}
		} else {
			l.staging = ""
		}
		// Only a successful replacement retires the old cache. If restoring
		// it failed, keep the recoverable native directory rather than
		// deleting the last copy while reporting an unsuccessful repair.
		if previous && result == nil {
			_ = microsoftRemoveFiles(l.env, microsoftMCPDir+"/"+backupName)
			_ = unix.Unlinkat(parent, backupName, unix.AT_REMOVEDIR)
		}
	}()
	if err := unix.Renameat(parent, stageName, parent, address); err != nil {
		return err
	}
	published = true

	pi, ok := l.env.Tool("pi")
	if !ok {
		return ToolFailed
	}
	mcp, _ := microsoftMCPCommand(l.env, l.app, microsoftMCPDir+"/"+address, address)
	args := []string{"mcp", "add", microsoftServerName(address)}
	for _, e := range mcp.Env {
		args = append(args, "--env", e)
	}
	args = append(args, "--", mcp.Path)
	args = append(args, mcp.Args...)
	if _, err := l.env.run(ctx, Command{Path: pi, Args: args}, nil); err != nil {
		return ToolFailed
	}
	return writeFileAt(fd, address+".conf", l.config, 0600)
}

// Pi's remove command returns failure for an absent name. Read its native
// store first so an interrupted setup can still be removed idempotently.
func microsoftMCPConfigured(env Env, address string) (bool, error) {
	fd, err := openHomeDir(env.Home, false, ".pi", "agent")
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, "mcp.json", 1<<20)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	var config struct {
		Servers map[string]json.RawMessage `json:"mcpServers"`
	}
	if json.Unmarshal(data, &config) != nil {
		return false, ToolFailed
	}
	_, ok := config.Servers[microsoftServerName(address)]
	return ok, nil
}

func (m *microsoft) Remove(ctx context.Context, env Env, address string) error {
	m.native.Lock()
	defer m.native.Unlock()
	if !ValidAddress(address) {
		return ToolFailed
	}
	configured, err := microsoftMCPConfigured(env, address)
	if err != nil {
		return err
	}
	if configured {
		pi, ok := env.Tool("pi")
		if !ok {
			return ToolFailed
		}
		if _, err := env.run(ctx, Command{Path: pi, Args: []string{"mcp", "remove", microsoftServerName(address)}}, nil); err != nil {
			return ToolFailed
		}
	}
	if err := microsoftRemoveFiles(env, microsoftMCPDir+"/"+address); err != nil {
		return err
	}
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return err
	}
	for _, r := range remotes {
		if err := microsoftRemoveFiles(env, microsoftWork(address, r.Name)); err != nil {
			return err
		}
	}
	fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	err = unix.Unlinkat(fd, address+".conf", 0)
	if errors.Is(err, unix.ENOENT) {
		return nil
	}
	return err
}
func (m *microsoft) Check(ctx context.Context, env Env, address string) []Service {
	m.native.Lock()
	defer m.native.Unlock()
	out := []Service{{ID: "onedrive", State: StateUnknown}, {ID: "sharepoint", State: StateUnknown}, {ID: "mail", State: StateUnknown}, {ID: "calendar", State: StateUnknown}, {ID: "contacts", State: StateUnknown}}
	remotes, inventoryErr := microsoftRemotes(env, address)
	hasSharePoint := false
	if inventoryErr == nil {
		for _, r := range remotes {
			i := 0
			if r.Name != "onedrive" {
				i = 1
				hasSharePoint = true
			}
			cmd, ok := microsoftCommand(env, address, "about", r.Name+":", "--json")
			if !ok {
				continue
			}
			if err, rejected := dropboxStatus(ctx, env, cmd); err == nil {
				if microsoftReady(env, address, r.Name) {
					out[i].State = StateOK
				}
			} else if rejected {
				out[i].State = StateLoginExpired
			} else {
				out[i].State = StateUnreachable
			}
		}
	}
	if app, ok := env.microsoftApp(); ok {
		if cmd, ok := microsoftMCPCommand(env, app, microsoftMCPDir+"/"+address, address, "--verify-login"); ok {
			data, err := env.run(ctx, cmd, nil)
			var v struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			state := StateUnreachable
			if err == nil && json.Unmarshal(data, &v) == nil {
				if v.Success {
					state = StateOK
				} else if strings.Contains(v.Message, "No valid token found") || strings.Contains(v.Message, "no token received") || strings.Contains(v.Message, "invalid_grant") {
					state = StateLoginExpired
				}
			}
			for i := 2; i < len(out); i++ {
				out[i].State = state
			}
		}
	}
	if inventoryErr == nil && len(remotes) > 0 && !hasSharePoint {
		// Personal accounts and work accounts with no followed libraries do
		// not have a SharePoint connection whose health could be unknown.
		out = append(out[:1], out[2:]...)
	}
	return out
}
func (m *microsoft) Skill(env Env, address string) SkillAccount {
	_, ready := m.SyncCommand(env, address)
	var directories strings.Builder
	if remotes, err := microsoftRemotes(env, address); err == nil {
		for _, r := range remotes {
			if microsoftReady(env, address, r.Name) {
				fmt.Fprintf(&directories, "\n- `~/%s/`", r.Directory)
			}
		}
	}
	if !ready {
		directories.WriteString("\nInitial sync is not ready; finish the folder choice in Settings → Integrations.")
	}
	return SkillAccount{Label: "Microsoft", Kinds: []string{"mail", "calendar", "contacts", "files"}, Synced: ready, Body: fmt.Sprintf("Use the Pi MCP server `%s` for Outlook mail (drafts first), calendars and contacts. It is pinned to this account; never switch its identity or export tokens. The server's own tool descriptions provide syntax. Selected OneDrive files sync both ways under `~/cloud/onedrive/%s/`; selected SharePoint libraries under `~/cloud/sharepoint/<organisation>/<site>/<library>/`. Only directories shown in Settings → Integrations are ready. Edits, moves and deletions reach the cloud: write only what the person requested. If rclone's native bisync safeguards stop sync, preserve both sides; never bypass them with --force or blind --resync. Reconnecting does not approve deletions. Initial conflicting local versions are backed up under `~/.local/share/rclone/microsoft-backups/%s/`. Two device codes are normal: first cloud files, then Outlook. Other work tenants may require their administrator's consent to the operator's app.", microsoftServerName(address), address, address) + "\n\nReady sync directories:" + directories.String()}
}

var _ FolderEntry = (*microsoft)(nil)
var _ LoginEntry = (*microsoft)(nil)
