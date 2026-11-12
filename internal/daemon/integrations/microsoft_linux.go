//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/unix"

	"github.com/open-habitat/open-habitat/internal/integrationapps"
)

// MicrosoftApp is a public, single-tenant Entra client. TenantID is the
// organisation's Directory (tenant) ID and the only login audience: personal
// Microsoft accounts and other organisations cannot sign in.
type MicrosoftApp struct {
	ClientID string `json:"client_id"`
	TenantID string `json:"tenant_id"`
}

// microsoftApps are the operator's usable Entra applications by level.
func (env Env) microsoftApps() map[Level]MicrosoftApp {
	cfg, ok := env.config()
	out := map[Level]MicrosoftApp{}
	if !ok {
		return out
	}
	for _, x := range []struct {
		app     *MicrosoftApp
		section string
		level   Level
	}{{cfg.Microsoft, "microsoft", LevelFull}, {cfg.MicrosoftNoSend, "microsoft_nosend", LevelNoSend}, {cfg.MicrosoftDrafts, "microsoft_drafts", LevelDrafts}, {cfg.MicrosoftRead, "microsoft_read", LevelRead}} {
		if x.app != nil && integrationapps.Usable(x.section, map[string]string{"client_id": x.app.ClientID, "tenant_id": x.app.TenantID}) {
			out[x.level] = *x.app
		}
	}
	return out
}

// microsoftLevels in the page's order.
var microsoftLevels = []Level{LevelFull, LevelNoSend, LevelDrafts, LevelRead}

// microsoftLevelScopes are the Graph permissions each level's application
// has, the set its administrator consents to. NoSend is the full level
// without Mail.Send, the one permission that sends mail. Drafts sends
// nothing: mail is drafted, calendars and files only read, since an event
// sends invitations and a file grant can create a public sharing link.
// Every level lists the person's teams and channels by name, which only
// finds their files and changes nothing.
var microsoftLevelScopes = map[Level]string{
	LevelFull:   microsoftScopes + " " + microsoftMCPScopes + " " + microsoftTeamsScopes,
	LevelNoSend: "openid profile offline_access User.Read Files.ReadWrite.All Sites.ReadWrite.All Mail.ReadWrite Calendars.ReadWrite Contacts.ReadWrite " + microsoftTeamsScopes,
	LevelDrafts: "openid profile offline_access User.Read Files.Read.All Sites.Read.All Mail.ReadWrite Calendars.Read Contacts.Read " + microsoftTeamsScopes,
	LevelRead:   "openid profile offline_access User.Read Files.Read.All Sites.Read.All Mail.Read Calendars.Read Contacts.Read " + microsoftTeamsScopes,
}

// microsoftAccountApp is the configured application an account's native
// configs were signed in with, and its level. When none of them is, it is
// the broadest configured one, which Align then reports as app_changed.
func microsoftAccountApp(env Env, n microsoftNative) (MicrosoftApp, Level, bool) {
	apps := env.microsoftApps()
	client := n.mcpClient
	if client == "" && len(n.clients) > 0 {
		client = n.clients[0]
	}
	for _, l := range microsoftLevels {
		if a, ok := apps[l]; ok && client != "" && strings.EqualFold(a.ClientID, client) {
			return a, l, true
		}
	}
	for _, l := range microsoftLevels {
		if a, ok := apps[l]; ok {
			return a, l, true
		}
	}
	return MicrosoftApp{}, "", false
}

// microsoftAppOf reads the account's native configs for microsoftAccountApp.
func microsoftAppOf(env Env, address string) (MicrosoftApp, Level, bool) {
	n, err := microsoftReadNative(env, address)
	if err != nil {
		return MicrosoftApp{}, "", false
	}
	return microsoftAccountApp(env, n)
}

const microsoftDir = ".config/rclone/open-habitat-microsoft"
const microsoftMCPDir = ".config/ms-365-mcp-server/open-habitat"
const microsoftScopes = "openid profile User.Read offline_access Files.ReadWrite.All Sites.ReadWrite.All"
const microsoftMCPScopes = "User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite"

// microsoftTeamsScopes find the libraries of the person's teams and
// channels (microsoft_files_linux.go); their files are read through the
// files and sites grants.
const microsoftTeamsScopes = "Team.ReadBasic.All Channel.ReadBasic.All"

// microsoftRequest is what a sign-in asks of the tenant. microsoftScopes and
// microsoftMCPScopes are the full level the administrator consents to, but a
// request naming a permission the tenant has not consented to fails as a
// whole. Graph's .default asks for exactly what the tenant consented to the
// application, so an organisation that consented to less connects with that,
// and the services show what is missing.
const microsoftRequest = "openid profile offline_access https://graph.microsoft.com/.default"

// microsoftRules are the services' levels in Graph's own permission names.
// A level is what the token can do, never only what the catalog sets up:
// Files.* reaches every library the person can, and Sites.* their OneDrive,
// though only Files.ReadWrite.All gets roots and Sites.ReadWrite.All the
// followed libraries synced; and Mail.Send sends whatever else is missing.
var microsoftRules = grantRules{
	"onedrive":   {{[]string{"Files.ReadWrite.All"}, AccessFull}, {[]string{"Sites.ReadWrite.All"}, AccessFull}, {[]string{"Files.Read.All"}, AccessRead}, {[]string{"Sites.Read.All"}, AccessRead}},
	"sharepoint": {{[]string{"Sites.ReadWrite.All"}, AccessFull}, {[]string{"Files.ReadWrite.All"}, AccessFull}, {[]string{"Sites.Read.All"}, AccessRead}, {[]string{"Files.Read.All"}, AccessRead}},
	"mail":       {{[]string{"Mail.Send"}, AccessFull}, {[]string{"Mail.ReadWrite"}, AccessDrafts}, {[]string{"Mail.Read"}, AccessRead}},
	"calendar":   {{[]string{"Calendars.ReadWrite"}, AccessFull}, {[]string{"Calendars.Read"}, AccessRead}},
	"contacts":   {{[]string{"Contacts.ReadWrite"}, AccessFull}, {[]string{"Contacts.Read"}, AccessRead}},
}

// Entra adds these to every grant; they are identity, not permissions.
var microsoftIdentity = map[string]bool{"openid": true, "profile": true, "email": true, "offline_access": true}

// microsoftGranted normalizes a token's scopes to Graph's short names. Entra
// may qualify them even when the request used short names; another
// resource's scope is never a Graph permission.
func microsoftGranted(scopes []string) map[string]bool {
	out := map[string]bool{}
	for s := range scopeSet(scopes, func(s string) string { return s }) {
		if short, ok := strings.CutPrefix(s, "https://graph.microsoft.com/"); ok {
			out[short] = true
		} else if !strings.Contains(s, "/") {
			out[s] = true
		}
	}
	return out
}

// microsoftGrantOf shows the grant against what the sign-in's level asked.
func microsoftGrantOf(granted map[string]bool, level Level) *Grant {
	requested, ok := microsoftLevelScopes[level]
	if !ok {
		requested = microsoftLevelScopes[LevelFull]
	}
	return grantOf(granted, strings.Fields(requested), microsoftIdentity)
}

// microsoftLevelOf is the level whose services' access the grant gives
// exactly; a grant an organisation narrowed otherwise is none of them.
func microsoftLevelOf(services []Service) Level {
	match := func(want func(id string) Access) bool {
		for _, s := range services {
			if s.Access != want(s.ID) {
				return false
			}
		}
		return len(services) > 0
	}
	switch {
	case match(func(string) Access { return AccessFull }):
		return LevelFull
	case match(func(id string) Access {
		if id == "mail" {
			return AccessDrafts
		}
		return AccessFull
	}):
		return LevelNoSend
	case match(func(id string) Access {
		if id == "mail" {
			return AccessDrafts
		}
		return AccessRead
	}):
		return LevelDrafts
	case match(func(string) Access { return AccessRead }):
		return LevelRead
	}
	return ""
}

// microsoftAllowed is the Outlook server's --allowed-scopes for a grant:
// its own scopes the grant holds, a read scope where only that was granted.
// Files and sites scopes enable the file tools' search and reading; the server
// is offered no file tool that writes, whatever the level.
// The server then offers no tool the grant cannot run, and its silent token
// requests never ask for a permission the tenant did not consent to.
func microsoftAllowed(granted map[string]bool) string {
	out := []string{"User.Read"}
	for _, s := range [][2]string{{"Mail.ReadWrite", "Mail.Read"}, {"Mail.Send", ""}, {"Calendars.ReadWrite", "Calendars.Read"}, {"Contacts.ReadWrite", "Contacts.Read"}, {"Files.ReadWrite.All", "Files.Read.All"}, {"Sites.ReadWrite.All", "Sites.Read.All"}} {
		if granted[s[0]] {
			out = append(out, s[0])
		} else if s[1] != "" && granted[s[1]] {
			out = append(out, s[1])
		}
	}
	return strings.Join(out, " ")
}

type microsoft struct {
	native sync.Mutex
	client *http.Client

	alignMu sync.Mutex
	refused map[string]microsoftRefusal // by address; see Align
}

func (*microsoft) Provider() Provider { return Microsoft }
func (*microsoft) Login() LoginKind   { return DeviceCode }
func (*microsoft) Services() []string {
	return []string{"onedrive", "sharepoint", "mail", "calendar", "contacts"}
}
func (m *microsoft) Available(env Env) bool { return m.ToolsInstalled(env) && m.AppConfigured(env) }
func (*microsoft) mirrorsRead()             {}

// Levels: each is one Entra application of the operator's.
func (*microsoft) Levels(env Env) []LevelOption {
	apps := env.microsoftApps()
	var out []LevelOption
	for _, l := range microsoftLevels {
		_, ok := apps[l]
		out = append(out, appLevel(l, ok))
	}
	return out
}

func (*microsoft) Level(_ Env, _ string, services []Service) Level {
	return microsoftLevelOf(services)
}
func (*microsoft) Tools() []string {
	return []string{"rclone", "ms-365-mcp-server", "pi", "microsoft-native"}
}
func (m *microsoft) ToolsInstalled(env Env) bool { return MissingTools(m, env) == nil }
func (*microsoft) AppConfigured(env Env) bool    { return len(env.microsoftApps()) > 0 }
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
				if _, err := readFileAt(fd, n, maxMicrosoftConfigRead); err != nil {
					return nil, err
				}
				accounts[a] = true
			}
		}
	}

	// Pending and rollback stores keep the account as their directory name.
	// A daemon interruption never hides an authorized native cache behind a
	// random name that explicit account removal cannot find.
	for _, store := range []string{microsoftMCPDir, microsoftMCPDir + "/.pending", microsoftMCPDir + "/.previous"} {
		names, mcp, err := listHomeDir(env.Home, store)
		if err != nil {
			return nil, err
		}
		if mcp < 0 {
			continue
		}
		for _, a := range names {
			if !ValidAddress(a) {
				continue
			}
			dir, err := openHomeDir(env.Home, false, splitPath(store+"/"+a)...)
			if err != nil {
				unix.Close(mcp)
				return nil, err
			}
			_, err = readFileAt(dir, ".token-cache.json", 256<<10)
			unix.Close(dir)
			if err == nil {
				accounts[a] = true
			} else if !errors.Is(err, os.ErrNotExist) {
				unix.Close(mcp)
				return nil, err
			}
		}
		unix.Close(mcp)
	}

	var out []string
	for a := range accounts {
		out = append(out, a)
	}
	sort.Strings(out)
	return out, nil
}

func microsoftMCPCommand(env Env, app MicrosoftApp, rel, address, allowed string, args ...string) (Command, bool) {
	tool, ok := env.Tool("ms-365-mcp-server")
	if !ok {
		return Command{}, false
	}
	c := Command{Path: tool, Args: append(microsoftMCPArgs(allowed), args...), Env: []string{
		"MS365_MCP_CLIENT_ID=" + app.ClientID, "MS365_MCP_TENANT_ID=" + app.TenantID,
		"MS365_MCP_USE_KEYTAR=false", "MS365_MCP_TOKEN_CACHE_PATH=" + filepath.Join(env.Home, rel, ".token-cache.json"),
		"MS365_MCP_SELECTED_ACCOUNT_PATH=" + filepath.Join(env.Home, rel, ".selected-account.json"),
		"MS365_MCP_EXPECTED_USERNAME=" + address,
	}}
	return c, true
}

// microsoftMCPArgs are the Outlook server's arguments for a grant. Only the
// listed tools are offered, and --allowed-scopes then hides those the grant
// cannot run. Organisation mode is needed for search-query and the
// SharePoint site tools; the rest of the list runs the same without it.
func microsoftMCPArgs(allowed string) []string {
	return []string{"--org-mode", "--enabled-tools", microsoftMCPTools, "--allowed-scopes", allowed}
}

// microsoftOutlookTools are what the pinned server's mail, calendar and
// contacts presets enable. A version bump that changes the presets fails
// TestMicrosoftMCPToolsPinnedServer, so the list is reviewed rather than
// widened silently.
var microsoftOutlookTools = []string{
	"list-mail-messages", "list-mail-folders", "list-mail-child-folders", "create-mail-folder",
	"create-mail-child-folder", "update-mail-folder", "delete-mail-folder",
	"list-mail-folder-messages", "get-mail-message", "send-mail", "create-draft-email",
	"delete-mail-message", "move-mail-message", "update-mail-message", "add-mail-attachment",
	"create-mail-attachment-upload-session", "list-mail-attachments", "delete-mail-attachment",
	"forward-mail-message", "reply-mail-message", "reply-all-mail-message", "create-forward-draft",
	"create-reply-draft", "create-reply-all-draft", "send-draft-message", "list-mail-rules",
	"create-mail-rule", "update-mail-rule", "delete-mail-rule", "list-focused-inbox-overrides",
	"create-focused-inbox-override", "update-focused-inbox-override", "delete-focused-inbox-override",
	"get-mail-message-mime", "get-mail-attachment-content", "get-mailbox-settings",
	"update-mailbox-settings", "copy-mail-message", "list-mail-folder-messages-delta",
	"list-outlook-categories", "create-outlook-category", "get-mail-tips",
	"list-supported-time-zones", "list-supported-languages", "download-bytes",
	"download-bytes-to-file", "get-upload-url", "upload-attachment-from-file", "read-mail-text",
	"list-calendar-events", "get-calendar-event", "create-calendar-event", "update-calendar-event",
	"delete-calendar-event", "accept-calendar-event", "decline-calendar-event",
	"tentatively-accept-calendar-event", "list-specific-calendar-events",
	"get-specific-calendar-event", "create-specific-calendar-event", "update-specific-calendar-event",
	"delete-specific-calendar-event", "get-calendar-view", "get-specific-calendar-view",
	"get-schedule", "list-calendar-event-instances", "list-calendars", "create-calendar",
	"update-calendar", "delete-calendar", "find-meeting-times", "get-room", "get-room-list",
	"list-room-list-rooms", "get-room-list-room", "update-place", "cancel-calendar-event",
	"forward-calendar-event", "snooze-calendar-event-reminder", "dismiss-calendar-event-reminder",
	"add-calendar-event-attachment", "create-calendar-event-attachment-upload-session",
	"list-calendar-events-delta", "list-calendar-view-delta", "list-my-calendar-permissions",
	"create-my-calendar-permission", "update-my-calendar-permission", "delete-my-calendar-permission",
	"list-outlook-contacts", "get-outlook-contact", "create-outlook-contact",
	"update-outlook-contact", "delete-outlook-contact", "list-contact-folder-child-folders",
	"create-contact-child-folder", "list-contact-folders", "create-contact-folder",
	"update-contact-folder", "delete-contact-folder", "list-contact-folder-contacts",
	"create-contact-in-folder",
}

// microsoftFileTools find and read the person's Microsoft 365 files:
// search-query searches every site, team and shared item the person can
// open, the others narrow to one site, drive or folder, and the Outlook
// list's download-bytes-to-file fetches one file. None of them writes to the
// cloud; upload, move, share and delete come later and separately. Their
// scope metadata is patched at build time (ms-365-mcp-server-scopes.json).
var microsoftFileTools = []string{
	"search-query", "search-onedrive-files", "search-sharepoint-sites", "list-sharepoint-site-drives",
	"get-drive-root-item", "list-folder-files", "get-drive-item", "get-download-url",
}

var microsoftMCPTools = "^(?:" + strings.Join(append(slices.Clone(microsoftOutlookTools), microsoftFileTools...), "|") + ")$"

type microsoftHTTPStatus int

func (microsoftHTTPStatus) Error() string { return string(ToolFailed) }

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
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return ServerUnreachable
	}
	defer res.Body.Close()
	data, err := io.ReadAll(io.LimitReader(res.Body, (256<<10)+1))
	if err != nil && ctx.Err() != nil {
		return microsoftResponseError{res.StatusCode, "not_applicable", "not_applicable", ctx.Err()}
	}
	if form == nil {
		// Preserve HTTP status even for HTML, malformed or oversized Graph
		// failures. Decoding the success shape first used to erase that evidence.
		code, message := "not_applicable", "not_applicable"
		if res.StatusCode != http.StatusOK {
			code, message = "redacted", "redacted"
			if err == nil && len(data) <= 256<<10 {
				code, message = microsoftGraphError(data)
			}
			return microsoftResponseError{res.StatusCode, code, message, microsoftHTTPStatus(res.StatusCode)}
		}
		if err != nil || len(data) > 256<<10 || json.Unmarshal(data, out) != nil {
			return microsoftResponseError{res.StatusCode, code, message, ToolFailed}
		}
	} else if err != nil || len(data) > 256<<10 || json.Unmarshal(data, out) != nil {
		// OAuth polling errors have structured bodies on HTTP 400.
		return ToolFailed
	}
	return nil
}
func microsoftAuthority(app MicrosoftApp) string {
	return "https://login.microsoftonline.com/" + app.TenantID + "/oauth2/v2.0/"
}
func microsoftConsent(app MicrosoftApp, level Level) ConsentRequired {
	// The application's own tenant: its administrator is the only one who
	// can consent to a single-tenant app. The consent is to the level's set.
	scopes, ok := microsoftLevelScopes[level]
	if !ok {
		scopes = microsoftLevelScopes[LevelFull]
	}
	var named []string
	seen := map[string]bool{}
	for _, s := range strings.Fields(scopes) {
		if !microsoftIdentity[s] && !seen[s] {
			named, seen[s] = append(named, s), true
		}
	}
	return ConsentRequired{URL: "https://login.microsoftonline.com/" + url.PathEscape(app.TenantID) + "/v2.0/adminconsent?" + url.Values{"client_id": {app.ClientID}, "scope": {"openid profile offline_access " + strings.Join(named, " ")}, "redirect_uri": {"https://login.microsoftonline.com/common/oauth2/nativeclient"}}.Encode()}
}
func microsoftAuthFailure(app MicrosoftApp, level Level, code string, numbers []int) error {
	for _, n := range numbers {
		switch n {
		case 65001, 65004, 90094:
			return microsoftConsent(app, level)
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
	log              *slog.Logger
	started          time.Time
	accepted         func(string) error
	unavailableSites []string
	skippedSites     []microsoftDiscoveryError
	// siteLookups are the lookup forms other than the composite ID that
	// opened a site, one per site, for the journal.
	siteLookups []string
	// teamsLeftOut says why Teams files are missing from the folder step,
	// teamsNotOffered names the teams left out whole (at most 32 names), and
	// teamsOmitted counts them. bounds are the limits that left them out.
	teamsLeftOut     string
	teamsNotOffered  []string
	teamsOmitted     int
	bounds           []string
	entry            *microsoft
	env              Env
	app              MicrosoftApp
	level            Level
	expected         string
	device           string
	prompt           Prompt
	interval         time.Duration
	token            []byte
	config           []byte
	address, staging string
	// allowed is the Outlook server's --allowed-scopes for this grant.
	allowed string
	// granted is the token's Graph permissions, kept with each cloud root.
	granted []string
}

func (m *microsoft) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	return m.StartLevelLogin(ctx, env, address, "")
}

// StartLevelLogin signs in with the level's application. A renewal without
// a level keeps the application the account was signed in with.
func (m *microsoft) StartLevelLogin(ctx context.Context, env Env, address string, level Level) (Login, error) {
	if !m.Available(env) {
		return nil, ToolFailed
	}
	if level == "" && address != "" {
		_, level, _ = microsoftAppOf(env, address)
	} else if level == "" {
		level = firstLevel(m.Levels(env))
	}
	app, ok := env.microsoftApps()[level]
	if !ok {
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
	if err := m.request(ctx, microsoftAuthority(app)+"devicecode", url.Values{"client_id": {app.ClientID}, "scope": {microsoftRequest}}, "", &d); err != nil {
		return nil, err
	}
	if d.Error != "" {
		return nil, microsoftAuthFailure(app, level, d.Error, d.Codes)
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
	p := Prompt{Flow: "files", VerificationURI: d.URI, UserCode: d.UserCode, ExpiresAt: time.Now().Add(time.Duration(d.Expires) * time.Second)}
	if !validPrompt(DeviceCode, p) || (d.URI != "https://microsoft.com/devicelogin" && d.URI != "https://login.microsoftonline.com/common/oauth2/deviceauth" && d.URI != "https://login.microsoft.com/device") {
		return nil, ToolFailed
	}
	return &microsoftLogin{started: time.Now(), entry: m, env: env, app: app, level: level, expected: address, device: d.DeviceCode, prompt: p, interval: time.Duration(d.Interval) * time.Second}, nil
}

// transition emits only fixed vocabulary and counters, never provider output.
func (l *microsoftLogin) transition(transition string, pending, slow int) {
	if l.log == nil {
		return
	}
	l.log.Info("integration_login", "provider", "microsoft", "outcome", "observed", "flow", "microsoft", "transition", transition, "elapsed_ms", time.Since(l.started).Milliseconds(), "poll_counts_available", true, "pending_count", pending, "slow_down_count", slow)
}

func (l *microsoftLogin) approved(flow string) error {
	if l.accepted != nil {
		return l.accepted(flow)
	}
	return nil
}
func (l *microsoftLogin) Prompt(context.Context) (Prompt, error) { return l.prompt, nil }
func (l *microsoftLogin) Redirect(context.Context, string) error { return RedirectRejected }
func (l *microsoftLogin) Wait(ctx context.Context) (string, error) {
	return l.WaitWithPrompt(ctx, func(Prompt) error { return ToolFailed })
}
func (l *microsoftLogin) WaitWithPrompt(ctx context.Context, show func(Prompt) error) (addressResult string, resultErr error) {
	phase := "device_token"
	pending, slow := 0, 0
	awaitingApproval := true
	l.transition("polling_started", pending, slow)
	defer func() {
		if resultErr != nil {
			if awaitingApproval && (errors.Is(resultErr, context.DeadlineExceeded) || errors.Is(resultErr, Expired)) {
				l.transition("approval_timeout", pending, slow)
			}
			resultErr = loginPhaseError{phase: phase, err: resultErr}
		}
	}()
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
		if err := microsoftAuthFailure(l.app, l.level, token.Error, token.Codes); err != nil {
			return "", err
		}
		if token.Error == "slow_down" {
			slow++
			l.interval += 5 * time.Second
		} else {
			pending++
		}
		// Keep the first pending observation and each backoff; totals also accompany
		// success/timeout. An unattended approval need not log every five seconds.
		if pending == 1 || token.Error == "slow_down" {
			l.transition("polling_wait", pending, slow)
		}
		token.Error = ""
	}
	if token.Access == "" || token.Refresh == "" || token.Expires <= 0 || token.Expires > 86400 {
		return "", ToolFailed
	}
	// The tenant may have consented to less than the full level. The account
	// connects with what it granted; only the identity read is required.
	scopes := microsoftGranted(strings.Fields(token.Scope))
	if !scopes["User.Read"] {
		return "", ToolFailed
	}
	reaches := false
	for _, id := range l.entry.Services() {
		reaches = reaches || microsoftRules.access(id, scopes) != AccessNone
	}
	if !reaches {
		return "", NothingGranted
	}
	l.allowed = microsoftAllowed(scopes)
	for s := range scopes {
		l.granted = append(l.granted, s)
	}
	sort.Strings(l.granted)
	awaitingApproval = false
	l.transition("token_acquired", pending, slow)
	if err := l.approved("files_discovery"); err != nil {
		return "", err
	}
	l.transition("prompt_replaced", pending, slow)
	phase = "graph_identity"
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
	phase = "graph_discovery"
	if scopes["Files.ReadWrite.All"] || scopes["Files.Read.All"] {
		// A read files grant mirrors its roots one way (level_linux.go).
		if err := l.discover(ctx, token.Access, scopes); err != nil {
			return "", err
		}
	} else {
		// Without a files grant the account keeps Outlook with no cloud
		// roots, as an Exchange-only one.
		l.config = []byte(microsoftConfigHeader)
	}
	// The union grant is imported by the pinned MSAL closure; MSAL creates its
	// own account/refresh records, and the MCP library encrypts its native cache.
	// Only stdin carries the refresh token. Existing published stores are untouched
	// until Commit's replacement/rollback protocol succeeds.
	phase = "outlook_login"
	l.staging = microsoftMCPDir + "/.pending/" + address
	fd, err := openHomeDir(l.env.Home, true, splitPath(l.staging)...)
	if err != nil {
		return "", err
	}
	unix.Close(fd)
	cmd, ok := microsoftMCPCommand(l.env, l.app, l.staging, address, l.allowed)
	if !ok {
		return "", ToolFailed
	}
	adapter, ok := l.env.Tool("microsoft-native")
	if !ok {
		return "", ToolFailed
	}
	cmd.Path, cmd.Args = adapter, nil
	payload, _ := json.Marshal(map[string]string{"client_id": l.app.ClientID, "tenant_id": l.app.TenantID, "address": address, "refresh_token": token.Refresh})
	data, err := l.env.run(ctx, cmd, bytes.NewReader(payload))
	if ctx.Err() != nil {
		return "", ctx.Err()
	}
	var result struct {
		Success bool   `json:"success"`
		Reason  string `json:"reason"`
	}
	if json.Unmarshal(data, &result) != nil {
		return "", ToolFailed
	}
	if result.Reason == "account_mismatch" {
		return "", AccountMismatch
	}
	if err != nil || !result.Success {
		return "", ToolFailed
	}
	phase = "outlook_identity"
	cmd, _ = microsoftMCPCommand(l.env, l.app, l.staging, address, l.allowed, "--list-accounts")
	data, err = l.env.run(ctx, cmd, nil)
	var accounts struct {
		Accounts []struct {
			Username string `json:"username"`
		} `json:"accounts"`
	}
	if err != nil || json.Unmarshal(data, &accounts) != nil || len(accounts.Accounts) != 1 || !strings.EqualFold(accounts.Accounts[0].Username, address) {
		return "", AccountMismatch
	}
	l.transition("native_cache_ready", pending, slow)
	return address, nil
}

func (l *microsoftLogin) Cancel() {
	l.device = ""
	l.token = nil
	l.config = nil
	if l.staging != "" {
		_ = microsoftRemoveFiles(l.env, l.staging)
		if parent, err := openHomeDir(l.env.Home, false, splitPath(filepath.Dir(l.staging))...); err == nil {
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
	old, oldErr := readFileAt(fd, address+".conf", maxMicrosoftConfigRead)
	if oldErr != nil && !errors.Is(oldErr, os.ErrNotExist) {
		return oldErr
	}

	previousRemotes, err := microsoftRemotes(l.env, address)
	if err != nil {
		return err
	}
	// A root whose files the new grant syncs the other way starts over
	// from the person's next choice. One that synced both ways and will not
	// first syncs both ways once more with the old grant, so nothing made
	// locally is left behind; if that fails, nothing changes.
	granted := microsoftGranted(l.granted)
	var turned []string
	for _, r := range previousRemotes {
		writable := microsoftWritable(r.service(), granted)
		if writable == r.Writable {
			continue
		}
		turned = append(turned, r.Name)
		if r.Writable && listingsFailed(l.env.Home, microsoftWork(address, r.Name)) {
			// A critical abort set the pair aside: no pass runs without an
			// explicit resync, and changing now would skip the last one.
			return FinalSyncFailed
		}
		if !r.Writable || !microsoftReady(l.env, address, r) {
			continue
		}
		cmd, ok := microsoftBisync(l.env, address, r)
		if !ok || l.env.runInitialSync(ctx, cmd, r.service()) != nil {
			return FinalSyncFailed
		}
	}
	l.config = microsoftPreserveDirectories(l.config, previousRemotes)
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
	pending, err := openHomeDir(l.env.Home, false, splitPath(microsoftMCPDir+"/.pending")...)
	if err != nil {
		return err
	}
	defer unix.Close(pending)
	backups, err := openHomeDir(l.env.Home, true, splitPath(microsoftMCPDir+"/.previous")...)
	if err != nil {
		return err
	}
	defer unix.Close(backups)
	if oldBackup, err := openHomeDir(l.env.Home, false, splitPath(microsoftMCPDir+"/.previous/"+address)...); err == nil {
		unix.Close(oldBackup)
		// Never overwrite an earlier recoverable native cache.
		return ToolFailed
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	previous, published := false, false
	oldDir, err := openHomeDir(l.env.Home, false, splitPath(microsoftMCPDir+"/"+address)...)
	if err == nil {
		unix.Close(oldDir)
		if err := unix.Renameat(parent, address, backups, address); err != nil {
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
				server, _, err := microsoftServerOf(l.env, address)
				if err != nil {
					keepPartial = true
				} else if server.registered {
					pi, ok := l.env.Tool("pi")
					if !ok {
						keepPartial = true
					} else {
						cleanup, cancel := context.WithTimeout(context.Background(), 10*time.Second)
						_, err := l.env.run(cleanup, Command{Path: pi, Args: []string{"mcp", "remove", server.name}}, nil)
						cancel()
						keepPartial = err != nil
					}
				}
			}
			if published && (previous || !keepPartial) {
				if err := unix.Renameat(parent, address, pending, stageName); err == nil {
					published = false
				}
			}
			// A possibly surviving registration still points at the account
			// path, so restore its previous cache even when cleanup is uncertain.
			// A failed rename leaves an account-named backup discoverable.
			if previous && !published {
				_ = unix.Renameat(backups, address, parent, address)
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
			_ = microsoftRemoveFiles(l.env, microsoftMCPDir+"/.previous/"+address)
			_ = unix.Unlinkat(backups, address, unix.AT_REMOVEDIR)
		}
	}()
	if err := unix.Renameat(pending, stageName, parent, address); err != nil {
		return err
	}
	published = true

	if err := microsoftRegister(ctx, l.env, l.app, address, l.allowed); err != nil {
		return err
	}
	if err := writeFileAt(fd, address+".conf", l.config, 0600); err != nil {
		return err
	}
	// Roots that each had their own token continue their pairs as aliases
	// of the account. What this cannot move, the next start does; until
	// then such a root does not sync (SyncCommand).
	for _, r := range previousRemotes {
		if !microsoftPassRunning(l.env, address, r.Name) {
			_ = microsoftMoveListings(l.env, address, r.Name)
		}
	}
	for _, name := range turned {
		// Listings of the other direction would misreport the root until
		// its next first pass replaces them (which clears them too).
		_ = clearWork(l.env, microsoftWork(address, name))
	}
	return nil
}

// Pi's remove command returns failure for an absent name. Read its native
// store first so an interrupted setup can still be removed idempotently.
func microsoftMCPConfigured(env Env, address string) (bool, error) {
	server, _, err := microsoftServerOf(env, address)
	return server.configured(), err
}

func (m *microsoft) Remove(ctx context.Context, env Env, address string) error {
	m.native.Lock()
	defer m.native.Unlock()
	if !ValidAddress(address) {
		return ToolFailed
	}
	server, _, err := microsoftServerOf(env, address)
	if err != nil {
		return err
	}
	var names []string
	if server.registered {
		names = append(names, server.name)
	}
	if server.legacy != "" {
		names = append(names, server.legacy)
	}
	for _, name := range names {
		pi, ok := env.Tool("pi")
		if !ok {
			return ToolFailed
		}
		if _, err := env.run(ctx, Command{Path: pi, Args: []string{"mcp", "remove", name}}, nil); err != nil {
			return ToolFailed
		}
	}
	for _, store := range []string{microsoftMCPDir, microsoftMCPDir + "/.pending", microsoftMCPDir + "/.previous"} {
		if err := microsoftRemoveFiles(env, store+"/"+address); err != nil {
			return err
		}
		if parent, err := openHomeDir(env.Home, false, splitPath(store)...); err == nil {
			err := unix.Unlinkat(parent, address, unix.AT_REMOVEDIR)
			unix.Close(parent)
			if err != nil && !errors.Is(err, os.ErrNotExist) {
				return err
			}
		} else if !errors.Is(err, os.ErrNotExist) {
			return err
		}
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
	out, _ := m.CheckGrant(ctx, env, address)
	return out
}

// CheckGrant reads the services' states and, from the tenant's answer to
// the Outlook tool's refresh, the grant they run on.
func (m *microsoft) CheckGrant(ctx context.Context, env Env, address string) ([]Service, *Grant) {
	m.native.Lock()
	defer m.native.Unlock()
	out := []Service{{ID: "onedrive", State: StateUnknown}, {ID: "sharepoint", State: StateUnknown}, {ID: "mail", State: StateUnknown}, {ID: "calendar", State: StateUnknown}, {ID: "contacts", State: StateUnknown}}
	// The two native stores refresh independently. A slow file endpoint must
	// not consume Outlook's entire status deadline as library counts grow.
	var probes sync.WaitGroup
	var granted map[string]bool
	probes.Add(1)
	go func() {
		defer probes.Done()
		var state ServiceState
		state, granted = microsoftMCPState(ctx, env, address)
		for i := 2; i < len(out); i++ {
			out[i].State = state
		}
	}()
	remotes, inventoryErr := microsoftRemotes(env, address)
	hasSharePoint := false
	checked := map[int]bool{}
	if inventoryErr == nil {
		// One representative per displayed service: all these native remotes
		// carry the same grant, and sync supervision supplies pair failures.
		for _, r := range remotes {
			i := 0
			if r.Name != "onedrive" {
				i = 1
				hasSharePoint = true
			}
			if checked[i] {
				continue
			}
			checked[i] = true
			cmd, ok := microsoftCommand(env, address, "about", r.Name+":", "--json")
			if !ok {
				continue
			}
			if err, rejected := dropboxStatus(ctx, env, cmd); err == nil {
				// The login works; whether the files sync is what the roots'
				// native state says, as for Google's and Dropbox's.
				ready, started := false, false
				for _, candidate := range remotes {
					if candidate.service() == r.service() {
						ready = ready || microsoftReady(env, address, candidate)
						started = started || microsoftPassStarted(env, address, candidate)
					}
				}
				out[i].State, out[i].Failure = signedInState(ready)
				if !ready && !started {
					out[i].State, out[i].Failure = StateSyncFailed, FoldersNotChosen
				}
			} else if rejected {
				out[i].State = StateLoginExpired
			} else {
				out[i].State = StateUnreachable
			}
		}
	}
	probes.Wait()
	m.alignedView(env, address, out)
	var grant *Grant
	if granted != nil {
		applyAccess(microsoftRules, granted, out)
		_, level, _ := microsoftAppOf(env, address)
		grant = microsoftGrantOf(granted, level)
	}
	// A file service without roots is shown only when the grant says why:
	// otherwise the account simply has no OneDrive or followed libraries.
	shown := func(i int) bool { return out[i].Access != "" && out[i].Access != AccessFull }
	var kept []Service
	for i, s := range out {
		if i == 0 && inventoryErr == nil && len(remotes) == 0 && !shown(0) {
			continue
		}
		if i == 1 && inventoryErr == nil && !hasSharePoint && !shown(1) {
			continue
		}
		kept = append(kept, s)
	}
	return kept, grant
}
func microsoftMCPState(ctx context.Context, env Env, address string) (ServiceState, map[string]bool) {
	state, scopes := microsoftVerify(ctx, env, address)
	switch state {
	case "ok":
		// The tenant's answer names the grant only while it accepts it.
		var granted map[string]bool
		if len(scopes) > 0 {
			granted = microsoftGranted(scopes)
		}
		return StateOK, granted
	case "refused", "outside_tenant":
		return StateLoginExpired, nil
	case "":
		return StateUnknown, nil
	}
	return StateUnreachable, nil
}

// microsoftVerify asks the native adapter whether the Outlook tool's MSAL
// grant still works at the current tenant. The pinned tool's own
// --verify-login reports a refused grant and an outage with the same text;
// the adapter decides from MSAL's error codes and answers ok, refused,
// outside_tenant or unreachable, and with ok the scopes the tenant's token
// response named. It returns "" when the app or tools are not configured.
func microsoftVerify(ctx context.Context, env Env, address string) (string, []string) {
	app, _, ok := microsoftAppOf(env, address)
	if !ok {
		return "", nil
	}
	cmd, ok := microsoftMCPCommand(env, app, microsoftMCPDir+"/"+address, address, microsoftMCPScopes)
	adapter, found := env.Tool("microsoft-native")
	if !ok || !found {
		return "", nil
	}
	cmd.Path, cmd.Args = adapter, []string{"verify"}
	payload, _ := json.Marshal(map[string]string{"client_id": app.ClientID, "tenant_id": app.TenantID, "address": address})
	data, err := env.run(ctx, cmd, bytes.NewReader(payload))
	var result struct {
		State  string   `json:"state"`
		Scopes []string `json:"scopes"`
	}
	if err != nil || json.Unmarshal(data, &result) != nil {
		return "unreachable", nil
	}
	switch result.State {
	case "ok":
		if len(result.Scopes) > 64 {
			result.Scopes = nil
		}
		return "ok", result.Scopes
	case "refused", "outside_tenant":
		return result.State, nil
	}
	return "unreachable", nil
}

func (m *microsoft) Skill(env Env, address string) SkillAccount {
	_, ready := m.SyncCommand(env, address)
	var directories strings.Builder
	mirror := false
	remotes, remotesErr := microsoftRemotes(env, address)
	if remotesErr == nil {
		for _, r := range remotes {
			if microsoftReady(env, address, r) {
				fmt.Fprintf(&directories, "\n- `~/%s/`", r.Directory)
			}
			// The grant reads files only; its roots are one-way mirrors.
			mirror = mirror || !r.Writable
		}
	}
	files := "The OneDrive folders and SharePoint libraries the person chose sync both ways"
	if mirror {
		files = "The OneDrive folders and SharePoint libraries the person chose are one-way mirrors, because this account's access to files is read-only"
	}
	files += fmt.Sprintf(": OneDrive under `~/cloud/onedrive/%s/`, each library under `~/cloud/sharepoint/<organisation>/<site>/<library>/`. Only the directories listed at the end of this section are complete; anything else under those paths is not there yet. Local files that the first sync replaced or removed are kept under `~/.local/share/rclone/microsoft-backups/%s/`.", address, address)
	list := "Synced directories:" + directories.String()
	if !ready {
		if remotesErr == nil && len(remotes) == 0 {
			list = "No OneDrive folder or SharePoint library is synced for this account; Outlook works without one."
		} else {
			list = "The first sync has not finished, so nothing under those paths can be relied on yet. The person finishes the folder choice in Settings → Integrations."
		}
	}
	var services []Service
	uses, search := "Outlook mail, calendars and contacts", ""
	if n, err := microsoftReadNative(env, address); err == nil && n.mcpAllowed != "" {
		// The Outlook server's scopes were derived from the grant at sign-in.
		allowed := microsoftGranted(strings.Fields(n.mcpAllowed))
		for _, id := range []string{"mail", "calendar", "contacts"} {
			services = append(services, Service{ID: id, Access: microsoftRules.access(id, allowed)})
		}
		if !n.mcpOutdated() && microsoftRules.access("onedrive", allowed) != AccessNone {
			uses = "Outlook mail, calendars, contacts and Microsoft 365 files"
			search = "\n\n" + fmt.Sprintf(microsoftSearchSkill, address, address)
			list = strings.Replace(list, "Outlook works without one", "Outlook and file search work without one", 1)
		}
	}
	name, _ := microsoftServerNames(address)
	if server, _, err := microsoftServerOf(env, address); err == nil {
		name = server.current()
	}
	body := fmt.Sprintf(microsoftOutlookSkill, uses, name) + "\n\n" + files + search + "\n\n" + list +
		accessSummary(services, map[string]string{"mail": "Outlook mail", "calendar": "Outlook calendar", "contacts": "Outlook contacts"})
	return SkillAccount{Label: "Microsoft", Kinds: []string{"mail", "calendar", "contacts", "files"}, Synced: ready && !mirror, Mirrored: ready && mirror, Body: body}
}

// microsoftOutlookSkill names the account's server and the one trap its tool
// names hide: the reply and forward tools are Graph's send actions, and only
// the draft tools leave the sending to the person.
const microsoftOutlookSkill = "%s are reached through the Pi MCP server `%s`, which is signed in as this account only; its tool descriptions carry the syntax. " +
	"For mail, `create-draft-email`, `create-reply-draft`, `create-reply-all-draft` and `create-forward-draft` prepare a draft; `send-mail`, `send-draft-message` and the `reply-…` and `forward-…` tools send at once. " +
	"Files and Outlook share one sign-in, so a sign-in problem stops both and the person renews it once in Settings → Integrations. Connecting an account from another organisation may first need that organisation's administrator to approve the app."

// microsoftSearchSkill tells an agent to find files by search and fetch only
// what it needs (Jari 12.11.2026): a full local copy of every library does not
// fit the person's quota, and a recursive grep over a cloud tree that is not
// fully local either misses files or downloads all of them. Jari proofreads
// every change to this text before it reaches the pilots.
const microsoftSearchSkill = "Most of what this account can open is not on this machine, since a full copy of every library would not fit the person's storage. Microsoft's search is how files are found. `search-query` with the entity type `driveItem` searches the names and contents of everything this account can open: OneDrive, every SharePoint site and team, followed or not, and files shared with the person. KQL narrows it, for example `filetype:pdf`, `path:\"https://…\"` or `LastModifiedTime>=2026-01-01`. `search-sharepoint-sites`, `list-sharepoint-site-drives`, `search-onedrive-files` and `list-folder-files` look inside one site, library or folder.\n\n" +
	"To read a file, fetch it with `download-bytes-to-file` (path `/drives/{driveId}/items/{itemId}/content`) to `~/cloud/microsoft-fetched/%s/` followed by the host and decoded path of the item's `webUrl`, for example `~/cloud/microsoft-fetched/%s/contoso.sharepoint.com/sites/Sales/Shared Documents/offer.docx`; when the `webUrl` is not a plain path to the file, use the drive ID and the file name instead. The local path then says where the file lives in the cloud. The tool needs the parent directory to exist and does not overwrite: a file already there is an earlier fetch that may be stale and may hold edits made here. Look at its age, and put a fresh fetch beside it under another name instead of deleting it.\n\n" +
	"Grep and read within what you fetched, and inside the synced directories listed below, which are complete local copies. A recursive grep or find over `~/cloud/` as a whole is the thing to avoid: it sees only what happens to be local, so finding nothing there says nothing about the cloud, and the synced copies can be very large.\n\n" +
	"A fetched file is a local copy that you may edit, but the edit stays here: this server has no tool that uploads, moves, shares or deletes anything in Microsoft 365. When the person wants an edited file back there, tell them where the copy is so they can upload it."

var _ FolderEntry = (*microsoft)(nil)
var _ GrantEntry = (*microsoft)(nil)
var _ LoginEntry = (*microsoft)(nil)
