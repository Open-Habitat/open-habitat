//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
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
	"github.com/open-habitat/open-habitat/internal/msmcp"
)

// MicrosoftApp is a public Entra client as one organisation signs in with
// it. TenantID is that organisation's Directory (tenant) ID and the only
// login audience: personal Microsoft accounts and other organisations
// cannot sign in. In a section of the operator's file it is the
// single-tenant application's organisation, or the shared application's
// owning tenant, which is never an authority on its own account
// (microsoftTable).
type MicrosoftApp struct {
	ClientID string `json:"client_id"`
	TenantID string `json:"tenant_id"`
}

// microsoftLevels in the page's order.
var microsoftLevels = []Level{LevelFull, LevelNoSend, LevelDrafts, LevelRead}

// microsoftLevelScopes are the Graph permissions each level's application
// has, the set its administrator consents to (integrationapps).
var microsoftLevelScopes = map[Level]string{
	LevelFull:   integrationapps.MicrosoftLevelScopes["full"],
	LevelNoSend: integrationapps.MicrosoftLevelScopes["nosend"],
	LevelDrafts: integrationapps.MicrosoftLevelScopes["drafts"],
	LevelRead:   integrationapps.MicrosoftLevelScopes["read"],
}

const microsoftDir = ".config/rclone/open-habitat-microsoft"
const microsoftMCPDir = ".config/ms-365-mcp-server/open-habitat"
const microsoftScopes = integrationapps.MicrosoftFilesScopes
const microsoftMCPScopes = integrationapps.MicrosoftOutlookScopes
const microsoftTeamsScopes = integrationapps.MicrosoftTeamsScopes

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
// Files and sites scopes enable reads, and their ReadWrite.All variants
// enable writes. A level's application name grants no additional capability.
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

	// mux is the person's one Microsoft process (ADR 0039), set when the
	// catalog starts serving it.
	muxMu sync.Mutex
	mux   *msmcp.Server
}

// release makes the shared Microsoft process let go of a removed connection.
func (m *microsoft) release(address string) {
	m.muxMu.Lock()
	mux := m.mux
	m.muxMu.Unlock()
	if mux != nil {
		mux.Release(address)
	}
}

// Native verification rotates the same cache that the MCP child uses; reconnect
// replaces its encryption key too. Stop the child before either writer runs so
// it cannot spend an old refresh token or overwrite the newly published cache.
// Callers hold native across the operation and resume.
func (m *microsoft) pause(ctx context.Context) (func(), error) {
	m.muxMu.Lock()
	mux := m.mux
	m.muxMu.Unlock()
	if mux == nil {
		return func() {}, nil
	}
	return mux.Pause(ctx)
}

func (*microsoft) Provider() Provider { return Microsoft }
func (*microsoft) Login() LoginKind   { return DeviceCode }
func (*microsoft) Services() []string {
	return []string{"onedrive", "sharepoint", "mail", "calendar", "contacts"}
}
func (m *microsoft) Available(env Env) bool { return m.ToolsInstalled(env) && m.AppConfigured(env) }
func (*microsoft) mirrorsRead()             {}

// Levels: each is one Entra application of the operator's, available where
// any organisation has it (Organisations says which).
func (*microsoft) Levels(env Env) []LevelOption {
	return env.microsoftTable().levels()
}

// Organisations are the organisations a connection can be made in, the
// operator's own first.
func (*microsoft) Organisations(env Env) []MicrosoftOrganisation {
	return env.microsoftTable().orgs
}

func (*microsoft) Level(env Env, key string, services []Service) Level {
	if n, err := microsoftReadNative(env, key); err == nil && n.mcpFilesOnly {
		return microsoftFilesOnlyLevel(env, key, n, services)
	}
	return microsoftLevelOf(services)
}

// microsoftFilesOnlyLevel is the level of a connection without a mailbox.
// Its files alone cannot tell the levels apart (drafts and read both read
// files), so it is the level of the application it signed in with, while
// the files' access is what that level gives.
func microsoftFilesOnlyLevel(env Env, key string, n microsoftNative, services []Service) Level {
	_, level, reason, ok := microsoftAccountApp(env, key, n)
	if !ok || reason != "" {
		return ""
	}
	want := AccessRead
	if level == LevelFull || level == LevelNoSend {
		want = AccessFull
	}
	files := false
	for _, s := range services {
		if s.ID == "onedrive" || s.ID == "sharepoint" {
			if s.Access != want {
				return ""
			}
			files = true
		}
	}
	if !files {
		return ""
	}
	return level
}
func (*microsoft) Tools() []string {
	return []string{"rclone", "ms-365-mcp-server", "pi", "microsoft-native"}
}
func (m *microsoft) ToolsInstalled(env Env) bool { return MissingTools(m, env) == nil }
func (*microsoft) AppConfigured(env Env) bool    { return len(env.microsoftTable().cells) > 0 }

// Accounts lists the connections by name. A bare address is a store from
// before names whose migration has not run or could not read its tenant;
// beside a named connection of the same address it is that connection's
// leftover, removed with it, and not listed.
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
			if a, ok := strings.CutSuffix(n, ".conf"); ok && validMicrosoftAccount(a) {
				if _, err := readFileAt(fd, n, maxMicrosoftConfigRead); err != nil {
					return nil, err
				}
				accounts[a] = true
			}
		}
	}

	// Pending and rollback stores keep the connection's name as their
	// directory name. A daemon interruption never hides an authorized native
	// cache behind a random name that explicit removal cannot find.
	for _, store := range []string{microsoftMCPDir, microsoftMCPDir + "/.pending", microsoftMCPDir + "/.previous"} {
		names, mcp, err := listHomeDir(env.Home, store)
		if err != nil {
			return nil, err
		}
		if mcp < 0 {
			continue
		}
		for _, a := range names {
			if !validMicrosoftAccount(a) {
				continue
			}
			dir, err := openHomeDir(env.Home, false, splitPath(store+"/"+a)...)
			if errors.Is(err, os.ErrNotExist) {
				// An abandoned login's Cancel removed its staging after
				// the listing.
				continue
			}
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

	named := map[string]bool{}
	for a := range accounts {
		if validMicrosoftName(a) {
			named[microsoftAddressOf(a)] = true
		}
	}
	var out []string
	for a := range accounts {
		if ValidAddress(a) && named[a] {
			continue
		}
		out = append(out, a)
	}
	sort.Strings(out)
	return out, nil
}

func microsoftMCPCommand(env Env, app MicrosoftApp, rel, allowed string, pin microsoftPin, args ...string) (Command, bool) {
	tool, ok := env.Tool("ms-365-mcp-server")
	if !ok || !pin.valid() {
		return Command{}, false
	}
	c := Command{Path: tool, Args: append(microsoftMCPArgs(allowed), args...), Env: []string{
		"MS365_MCP_CLIENT_ID=" + app.ClientID, "MS365_MCP_TENANT_ID=" + app.TenantID,
		"MS365_MCP_USE_KEYTAR=false", "MS365_MCP_TOKEN_CACHE_PATH=" + filepath.Join(env.Home, rel, ".token-cache.json"),
		"MS365_MCP_SELECTED_ACCOUNT_PATH=" + filepath.Join(env.Home, rel, ".selected-account.json"),
	}}
	for k, v := range pin.env() {
		c.Env = append(c.Env, k+"="+v)
	}
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
// contacts presets enable, less the tools the test reviewed and left out
// (microsoftExcludedOutlookTools). A version bump that changes the presets fails
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

// File tools use the account's consented grant, not its level's name.
// Their scope metadata is patched at build time (ms-365-mcp-server-scopes.json);
// --allowed-scopes excludes writes for read-only grants.
var microsoftFileTools = []string{
	"search-query", "search-onedrive-files", "search-sharepoint-sites", "list-sharepoint-site-drives",
	"get-drive-root-item", "list-folder-files", "get-drive-item", "get-download-url",
}

var microsoftFileWriteTools = []string{
	"upload-file-content", "create-upload-session", "create-onedrive-folder", "move-rename-onedrive-item",
	"copy-drive-item", "delete-onedrive-file", "share-drive-item", "create-drive-item-share-link",
}

var microsoftMCPTools = "^(?:" + strings.Join(slices.Concat(microsoftOutlookTools, microsoftFileTools, microsoftFileWriteTools), "|") + ")$"

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
	// The sign-in's tenant: its administrator is the one who consents, to a
	// single-tenant app of their own or to a shared one for their
	// organisation. The consent is to the level's set.
	return ConsentRequired{URL: integrationapps.MicrosoftConsentURL(app.TenantID, app.ClientID, string(level))}
}
func microsoftAuthFailure(app MicrosoftApp, level Level, code string, numbers []int) error {
	for _, n := range numbers {
		switch n {
		case 65001, 65004, 90094:
			return microsoftConsent(app, level)
		case 53003, 530032:
			return DeviceCodeBlocked
		case 50020, 50034, 90072:
			return NotInOrganisation
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
	// restart are the roots whose sync this sign-in turned to the other
	// direction (Commit); their first pass in the new direction follows.
	restart []string
	entry   *microsoft
	env     Env
	app     MicrosoftApp
	level   Level
	// expected is the connection a renewal signs in again (a name, or a
	// bare address from before names), and pin the identity it must be.
	expected string
	pin      microsoftPin
	device   string
	prompt   Prompt
	interval time.Duration
	token    []byte
	config   []byte
	// address is the connection's label, name its name, and home the
	// homeAccountId MSAL recorded for the sign-in, its new pin.
	address, name, home string
	staging             string
	// allowed is the Outlook server's --allowed-scopes for this grant.
	allowed string
	// granted is the token's Graph permissions, kept with each cloud root.
	granted []string
	// mailbox is the mailbox probe's answer for this sign-in.
	mailbox microsoftMailbox
}

// microsoftMailbox is what the organisation answered when the sign-in asked
// for the account's inbox.
type microsoftMailbox int

const (
	// mailboxUndecided: the grant has no mail, or the answer was not one
	// that decides (an outage, a timeout, throttling, a refusal).
	mailboxUndecided microsoftMailbox = iota
	mailboxPresent
	mailboxAbsent
)

func (b microsoftMailbox) String() string {
	return [...]string{"undecided", "present", "absent"}[b]
}

// microsoftNoMailbox are Graph's answers to an inbox read that mean the
// account has no Exchange Online mailbox in the tenant: a B2B guest's usual
// answer, and an unlicensed member's. Only these decide; any other failure
// leaves the connection as it would have been without the probe.
var microsoftNoMailbox = map[int]map[string]bool{
	http.StatusNotFound:     {"MailboxNotEnabledForRESTAPI": true, "MailboxNotFound": true, "ErrorNonExistentMailbox": true, "ResourceNotFound": true},
	http.StatusUnauthorized: {"OrganizationFromTenantGuidNotFound": true},
}

// microsoftMailboxProbeTimeout bounds the probe; an organisation that does
// not answer in time leaves the sign-in as it would have been without it.
var microsoftMailboxProbeTimeout = 15 * time.Second

// probeMailbox asks Graph once for the account's inbox with the sign-in's
// own access token. It never fails the sign-in: an answer that does not
// decide is mailboxUndecided.
func (m *microsoft) probeMailbox(ctx context.Context, access string) (microsoftMailbox, int, string) {
	ctx, cancel := context.WithTimeout(ctx, microsoftMailboxProbeTimeout)
	defer cancel()
	var inbox struct {
		ID string `json:"id"`
	}
	err := m.request(ctx, "https://graph.microsoft.com/v1.0/me/mailFolders/inbox?$select=id", nil, access, &inbox)
	if err == nil {
		if inbox.ID == "" {
			return mailboxUndecided, http.StatusOK, "not_applicable"
		}
		return mailboxPresent, http.StatusOK, "not_applicable"
	}
	var response microsoftResponseError
	if errors.As(err, &response) {
		if microsoftNoMailbox[response.status][response.code] {
			return mailboxAbsent, response.status, response.code
		}
		return mailboxUndecided, response.status, response.code
	}
	return mailboxUndecided, 0, "not_applicable"
}

func (m *microsoft) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	return m.StartLevelLogin(ctx, env, address, "")
}

// microsoftCell is the operator's application of the tenant at the level.
func microsoftCell(env Env, tenant string, level Level) (MicrosoftApp, bool) {
	return env.microsoftTable().cell(tenant, level)
}

// StartLevelLogin signs in with the level's application. A new connection
// signs in at the first organisation with an application at the level
// (StartOrganisationLogin chooses another).
func (m *microsoft) StartLevelLogin(ctx context.Context, env Env, key string, level Level) (Login, error) {
	return m.StartOrganisationLogin(ctx, env, key, "", level)
}

// OrganisationAvailable says whether a new connection can be made in the
// organisation at the level (the broadest it has when level is empty).
func (*microsoft) OrganisationAvailable(env Env, tenant string, level Level) bool {
	t := env.microsoftTable()
	if level == "" {
		level = firstLevel(microsoftOrgLevels(t, tenant))
	}
	_, ok := t.cell(tenant, level)
	return ok
}

func microsoftOrgLevels(t microsoftTable, tenant string) []LevelOption {
	for _, org := range t.orgs {
		if org.TenantID == strings.ToLower(tenant) {
			return org.Levels
		}
	}
	return nil
}

// StartOrganisationLogin signs in with the application of the organisation
// and level. A renewal keeps the connection's organisation: its sign-in goes
// to the name's tenant, at the level the connection was signed in with when
// none is given, and is refused when the operator has no application there.
// A new connection signs in at tenant, or with none given at the first
// organisation with the level; without a level it takes the broadest the
// organisation has. A bare address from before names whose tenant could not
// be read signs in like a new connection and is replaced by it.
func (m *microsoft) StartOrganisationLogin(ctx context.Context, env Env, key, tenant string, level Level) (Login, error) {
	if !m.Available(env) {
		return nil, ToolFailed
	}
	table := env.microsoftTable()
	var app MicrosoftApp
	var pin microsoftPin
	ok := false
	if key != "" {
		if !validMicrosoftAccount(key) {
			return nil, ToolFailed
		}
		n, err := microsoftReadNative(env, key)
		if err != nil {
			return nil, err
		}
		_, own, _, found := microsoftAccountApp(env, key, n)
		if level == "" && found {
			level = own
		}
		pin = n.pin(key)
		if own := microsoftTenantOf(key); own != "" {
			app, ok = table.cell(own, level)
		} else {
			if level == "" {
				level = firstLevel(table.levels())
			}
			app, ok = table.cell(table.defaultTenant(level), level)
		}
	} else {
		switch {
		case tenant != "" && level == "":
			level = firstLevel(microsoftOrgLevels(table, tenant))
		case level == "":
			level = firstLevel(table.levels())
		}
		if tenant == "" {
			tenant = table.defaultTenant(level)
		}
		app, ok = table.cell(tenant, level)
	}
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
	return &microsoftLogin{started: time.Now(), entry: m, env: env, app: app, level: level, expected: key, pin: pin, device: d.DeviceCode, prompt: p, interval: time.Duration(d.Interval) * time.Second}, nil
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
		IDToken string `json:"id_token"`
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
		ID   string `json:"id"`
		Mail string `json:"mail"`
		UPN  string `json:"userPrincipalName"`
	}
	if err := l.entry.request(ctx, "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName", nil, token.Access, &me); err != nil {
		return "", err
	}
	if !microsoftObjectID.MatchString(me.ID) {
		return "", ToolFailed
	}
	// The address is the connection's label, never who signed in: the UPN
	// when it is address-shaped (a guest's #EXT# UPN is not), then the mail
	// address, then the id token's preferred_username, which is MSAL's
	// username.
	address := strings.ToLower(me.UPN)
	if !ValidAddress(address) {
		address = strings.ToLower(me.Mail)
	}
	if !ValidAddress(address) {
		address = microsoftPreferredUsername(token.IDToken)
	}
	if !ValidAddress(address) {
		return "", ToolFailed
	}
	// A guest usually has no mailbox in the client's tenant whatever mail
	// permissions the application was granted. Asked once, while the
	// sign-in's token is at hand; Commit registers the files area alone
	// when the tenant says there is none.
	l.mailbox = mailboxUndecided
	// Without files the connection has nothing to keep, so it is asked only
	// when the grant reaches both.
	if microsoftRules.access("mail", scopes) != AccessNone && microsoftRules.access("onedrive", scopes) != AccessNone {
		phase = "mailbox_probe"
		var status int
		var code string
		l.mailbox, status, code = l.entry.probeMailbox(ctx, token.Access)
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		if l.log != nil {
			// Fixed vocabulary and allowlisted Graph codes only.
			l.log.Info("integration_login", "provider", "microsoft", "outcome", "observed", "flow", "microsoft", "transition", "mailbox_probe", "mailbox", l.mailbox.String(), "http_status", status, "graph_code", code)
		}
	}
	tenant := strings.ToLower(l.app.TenantID)
	name := microsoftName(address, tenant)
	renewal := l.expected != ""
	if validMicrosoftName(l.expected) {
		// A renewal keeps the connection's first label; the pin decides.
		name = l.expected
	}
	if name == "" || microsoftTenantOf(name) != tenant {
		return "", ToolFailed
	}
	if microsoftNamePending(l.env, address) {
		// The connection of this address from before names is renamed by
		// the next check; a sign-in beside it would leave two.
		return "", ToolFailed
	}
	pin := l.pin
	if !renewal {
		// The same address may be connected in several organisations: each
		// is its own name with its own stores and entry prefix.
		accounts, err := l.entry.Accounts(l.env)
		if err != nil {
			return "", err
		}
		// A new sign-in to a connection that is already here may only be
		// the same Microsoft account.
		if slices.Contains(accounts, name) {
			n, err := microsoftReadNative(l.env, name)
			if err != nil {
				return "", err
			}
			pin = n.pin(name)
		}
	}
	l.address, l.name = address, name
	l.token, _ = json.Marshal(map[string]any{"access_token": token.Access, "refresh_token": token.Refresh, "token_type": "Bearer", "expiry": time.Now().Add(time.Duration(token.Expires) * time.Second).UTC().Format(time.RFC3339)})
	// Agents search and fetch files through the Outlook server's file tools,
	// so a sign-in neither lists libraries nor offers a choice of folders
	// (Jari 14.11.2026). Commit carries over only the roots that already sync.
	l.config = []byte(microsoftConfigHeader)
	// The union grant is imported by the pinned MSAL closure; MSAL creates its
	// own account/refresh records, and the MCP library encrypts its native cache.
	// Only stdin carries the refresh token. Existing published stores are untouched
	// until Commit's replacement/rollback protocol succeeds.
	phase = "outlook_login"
	l.staging = microsoftMCPDir + "/.pending/" + name
	fd, err := openHomeDir(l.env.Home, true, splitPath(l.staging)...)
	if err != nil {
		return "", err
	}
	unix.Close(fd)
	adapter, ok := l.env.Tool("microsoft-native")
	if !ok {
		return "", ToolFailed
	}
	// The adapter runs with the staging cache's environment; it reads no pin.
	cmd, ok := microsoftMCPCommand(l.env, l.app, l.staging, l.allowed, microsoftPin{username: address})
	if !ok {
		return "", ToolFailed
	}
	cmd.Path, cmd.Args = adapter, nil
	payload, _ := json.Marshal(map[string]string{"client_id": l.app.ClientID, "tenant_id": l.app.TenantID, "refresh_token": token.Refresh})
	data, err := l.env.run(ctx, cmd, bytes.NewReader(payload))
	if ctx.Err() != nil {
		return "", ctx.Err()
	}
	var result struct {
		Success bool   `json:"success"`
		Reason  string `json:"reason"`
		Account struct {
			TenantID       string `json:"tenant_id"`
			LocalAccountID string `json:"local_account_id"`
			HomeAccountID  string `json:"home_account_id"`
		} `json:"account"`
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
	// Who signed in is decided by immutable identifiers from the tenant's own
	// answers: MSAL's account is in the chosen tenant and is the object
	// Graph /me named for the same token.
	got := result.Account
	home := microsoftPin{home: got.HomeAccountID}
	if !strings.EqualFold(got.TenantID, tenant) || !strings.EqualFold(got.LocalAccountID, me.ID) || !home.valid() {
		return "", AccountMismatch
	}
	if (pin.home != "" && pin.home != got.HomeAccountID) || (pin.home == "" && pin.username != "" && pin.username != address) {
		if renewal {
			return "", AccountMismatch
		}
		return "", AlreadyConnected
	}
	l.home = got.HomeAccountID
	phase = "outlook_identity"
	cmd, _ = microsoftMCPCommand(l.env, l.app, l.staging, l.allowed, home, "--list-accounts")
	data, err = l.env.run(ctx, cmd, nil)
	var accounts struct {
		Accounts []struct {
			ID string `json:"id"`
		} `json:"accounts"`
	}
	if err != nil || json.Unmarshal(data, &accounts) != nil || len(accounts.Accounts) != 1 || accounts.Accounts[0].ID != l.home {
		return "", AccountMismatch
	}
	l.transition("native_cache_ready", pending, slow)
	return name, nil
}

// microsoftObjectID is a directory object id as Graph returns it.
var microsoftObjectID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// microsoftPreferredUsername is the id token's preferred_username, the name
// MSAL records as the account's username, lowercased, or "". The token came
// from the tenant's token endpoint over TLS in the same answer as the grant;
// it labels the connection and decides nothing.
func microsoftPreferredUsername(idToken string) string {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 || len(parts[1]) > 16<<10 {
		return ""
	}
	payload, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(parts[1], "="))
	if err != nil {
		return ""
	}
	var claims struct {
		PreferredUsername string `json:"preferred_username"`
	}
	if json.Unmarshal(payload, &claims) != nil {
		return ""
	}
	return strings.ToLower(claims.PreferredUsername)
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

// microsoftRemoveFiles empties a store. A file already gone is removed: an
// abandoned login's Cancel empties its staging while a removal of the same
// account empties it too, and neither may fail on the other's work.
func microsoftRemoveFiles(env Env, rel string) error {
	names, fd, err := listHomeDir(env.Home, rel)
	if err != nil || fd < 0 {
		return err
	}
	defer unix.Close(fd)
	for _, n := range names {
		if err := unix.Unlinkat(fd, n, 0); err != nil && !errors.Is(err, unix.ENOENT) {
			return err
		}
	}
	return nil
}
func (l *microsoftLogin) Commit(ctx context.Context, address string) (result error) {
	l.entry.native.Lock()
	defer l.entry.native.Unlock()
	defer l.Cancel()
	if address != l.name || !validMicrosoftName(address) || l.home == "" || len(l.config) == 0 || l.staging == "" || ctx.Err() != nil {
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
	// The roots that already sync stay, with the new token and grant; no
	// sign-in adds one. Without a files grant rclone has nothing to sync with.
	granted := microsoftGranted(l.granted)
	var kept []microsoftRemote
	if granted["Files.ReadWrite.All"] || granted["Files.Read.All"] {
		for _, r := range previousRemotes {
			if microsoftKept(l.env, address, r) {
				kept = append(kept, r)
			}
		}
	}
	// A root whose files the new grant syncs the other way runs its first
	// pass again in the new direction once the sign-in is in place (restart).
	// One that synced both ways and will not first syncs both ways once more
	// with the old grant, so nothing made locally is left behind; if that
	// fails, nothing changes.
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
	// A turned root that synced runs its first pass again in the new
	// direction: its files are local, so the pass copies little. The startup
	// repair's selection records it in the config, so a stop or a failure of
	// that pass leaves the root kept and the next start runs it again. A
	// turned root whose own first pass never finished is left out (its files
	// stay), since its pass in the new direction could be a whole download.
	l.restart = nil
	for i := range kept {
		r := &kept[i]
		if !slices.Contains(turned, r.Name) || !microsoftReady(l.env, address, *r) {
			continue
		}
		r.RecoverySelected = true
		l.restart = append(l.restart, r.Name)
	}
	if len(kept) > 0 {
		if l.config, err = microsoftKeptConfig(l.app, l.granted, l.token, kept); err != nil {
			return err
		}
	}
	registration, _, err := microsoftServerOf(l.env, address)
	if err != nil {
		return err
	}
	hadServer := registration.configured()
	// The probe's answer decides the areas; one that did not decide keeps
	// what the connection had (all five for a new one), so a probe failure
	// never takes tools away and an outage at a guest's renewal does not
	// bring back mail tools that can only fail.
	filesOnly := registration.filesOnly()
	switch l.mailbox {
	case mailboxAbsent:
		filesOnly = true
	case mailboxPresent:
		filesOnly = false
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
	resume, err := l.entry.pause(ctx)
	if err != nil {
		return ToolFailed
	}
	defer resume()
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
				cleanup, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				keepPartial = microsoftUnregister(cleanup, l.env, address) != nil
				cancel()
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
		// A store of the address from before names that could not be
		// renamed is what this sign-in replaces.
		if result == nil {
			_ = microsoftRemoveLeftover(context.WithoutCancel(ctx), l.env, address)
		}
	}()
	if err := unix.Renameat(pending, stageName, parent, address); err != nil {
		return err
	}
	published = true

	if err := microsoftRegister(ctx, l.env, l.app, address, l.allowed, microsoftPin{home: l.home}, filesOnly); err != nil {
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
	if !validMicrosoftAccount(address) {
		return ToolFailed
	}
	resume, err := m.pause(ctx)
	if err != nil {
		return ToolFailed
	}
	defer resume()
	// The entries go first, so the daemon's endpoint refuses the account
	// from now on; then the shared Microsoft process lets go of it before
	// its native cache is deleted.
	if err := microsoftUnregister(ctx, env, address); err != nil {
		return ToolFailed
	}
	m.release(address)
	if err := microsoftRemoveStores(env, address); err != nil {
		return err
	}
	return microsoftRemoveLeftover(ctx, env, address)
}

// microsoftRemoveStores deletes a connection's native stores: its caches,
// its roots' listings and its rclone config. Its entries are already gone.
func microsoftRemoveStores(env Env, address string) error {
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

// microsoftRemoveLeftover deletes what the connection's address left from
// before names: the stores of a bare address whose tenant cannot be read
// or is the connection's own (a migration interrupted half way). A bare
// address that names another tenant is another connection's and stays.
func microsoftRemoveLeftover(ctx context.Context, env Env, name string) error {
	address, tenant, ok := microsoftSplitName(name)
	if !ok {
		return nil
	}
	if bare, _ := microsoftBareTenant(env, address); bare != "" && bare != tenant {
		return nil
	}
	if err := microsoftUnregister(ctx, env, address); err != nil {
		return err
	}
	return microsoftRemoveStores(env, address)
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
		var failure string
		resume, err := m.pause(ctx)
		if err != nil {
			// Busy or not serving is not a response from the tenant.
			state = StateUnknown
		} else {
			state, failure, granted = microsoftMCPState(ctx, env, address)
			resume()
		}
		for i := 2; i < len(out); i++ {
			out[i].State, out[i].Failure = state, failure
		}
	}()
	all, inventoryErr := microsoftRemotes(env, address)
	// Only roots that had a first pass are the account's synced files; one
	// an earlier release's folder step offered and nobody chose is nothing.
	var remotes []microsoftRemote
	for _, r := range all {
		if microsoftKept(env, address, r) {
			remotes = append(remotes, r)
		}
	}
	synced := [2]bool{}
	if inventoryErr == nil {
		// One representative per displayed service: all these native remotes
		// carry the same grant, and sync supervision supplies pair failures.
		for _, r := range remotes {
			i := 0
			if r.service() == "sharepoint" {
				i = 1
			}
			if synced[i] {
				continue
			}
			synced[i] = true
			cmd, ok := microsoftCommand(env, address, "about", r.Name+":", "--json")
			if !ok {
				continue
			}
			if err, rejected := dropboxStatus(ctx, env, cmd); err == nil {
				// The login works; whether the files sync is what the roots'
				// native state says, as for Google's and Dropbox's.
				ready := false
				for _, candidate := range remotes {
					if candidate.service() == r.service() {
						ready = ready || microsoftReady(env, address, candidate)
					}
				}
				out[i].State, out[i].Failure = signedInState(ready)
			} else if rejected {
				out[i].State = StateLoginExpired
			} else {
				out[i].State = StateUnreachable
			}
		}
	}
	probes.Wait()
	// Files nothing syncs are reached on demand through the Outlook server's
	// file tools, so their state is that server's sign-in.
	for i := 0; i < 2; i++ {
		if inventoryErr == nil && !synced[i] {
			out[i].State, out[i].Failure = out[2].State, out[2].Failure
		}
	}
	m.alignedView(env, address, out)
	var grant *Grant
	if granted != nil {
		applyAccess(microsoftRules, granted, out)
		_, level, _, _ := microsoftAppOf(env, address)
		grant = microsoftGrantOf(granted, level)
	}
	// OneDrive's row ("OneDrive and SharePoint") stands for the files agents
	// search and fetch, shown once the tenant's answer says what the grant
	// allows; a separate SharePoint row only for synced libraries, or when
	// the grant says why there is none.
	shown := func(i int) bool { return out[i].Access != "" && out[i].Access != AccessFull }
	// A connection registered without a mailbox has its files alone: mail,
	// calendar and contacts are not its services, and the files row stays
	// even before the grant is read, since it is all the card has.
	filesOnly := false
	if n, err := microsoftReadNative(env, address); err == nil {
		filesOnly = n.mcpFilesOnly
	}
	var kept []Service
	for i, s := range out {
		if filesOnly && i >= 2 {
			continue
		}
		if i == 0 && !filesOnly && inventoryErr == nil && !synced[0] && out[0].Access == "" {
			continue
		}
		if i == 1 && inventoryErr == nil && !synced[1] && !shown(1) {
			continue
		}
		kept = append(kept, s)
	}
	return kept, grant
}
func microsoftMCPState(ctx context.Context, env Env, address string) (ServiceState, string, map[string]bool) {
	state, scopes := microsoftVerify(ctx, env, address, true)
	switch state {
	case "ok":
		// The tenant's answer names the grant only while it accepts it.
		var granted map[string]bool
		if len(scopes) > 0 {
			granted = microsoftGranted(scopes)
		}
		return StateOK, "", granted
	case "refused":
		return StateLoginExpired, "", nil
	case "outside_tenant":
		return StateLoginExpired, OutsideTenant, nil
	case "":
		return StateUnknown, "", nil
	}
	return StateUnreachable, "", nil
}

// microsoftVerify asks the native adapter whether the Outlook tool's MSAL
// grant still works at the connection's tenant. The pinned tool's own
// --verify-login reports a refused grant and an outage with the same text;
// the adapter decides from MSAL's error codes and answers ok, refused,
// outside_tenant or unreachable, and with ok the scopes the tenant's token
// response named. The adapter is given the tenant as its authority and the
// connection's pin, by which it finds the account in the cache. It returns
// "" when the app or tools are not configured, or the operator has no
// application at the connection's tenant now.
func microsoftVerify(ctx context.Context, env Env, address string, checkTools bool) (string, []string) {
	n, err := microsoftReadNative(env, address)
	if err != nil {
		return "unreachable", nil
	}
	app, _, reason, ok := microsoftAccountApp(env, address, n)
	if !ok || reason != "" {
		// A connection that cannot run is not redeemed with another
		// application; alignedView says why.
		return "", nil
	}
	pin := n.pin(address)
	cmd, ok := microsoftMCPCommand(env, app, microsoftMCPDir+"/"+address, microsoftMCPScopes, pin)
	adapter, found := env.Tool("microsoft-native")
	if !ok || !found {
		return "", nil
	}
	cmd.Path, cmd.Args = adapter, []string{"verify"}
	allowed := n.mcpAllowed
	if allowed == "" {
		allowed = microsoftMCPScopes
	}
	request := map[string]any{"client_id": app.ClientID, "tenant_id": app.TenantID}
	if pin.home != "" {
		request["home_account_id"] = pin.home
	} else {
		request["address"] = pin.username
	}
	if checkTools {
		request["tool_options"] = map[string]any{"orgMode": true, "enabledTools": microsoftMCPTools, "allowedScopes": allowed}
	}
	payload, _ := json.Marshal(request)
	data, err := env.run(ctx, cmd, bytes.NewReader(payload))
	var result struct {
		State  string   `json:"state"`
		Scopes []string `json:"scopes"`
	}
	if err != nil || json.Unmarshal(data, &result) != nil {
		if ctx.Err() != nil {
			return "", nil // caller's budget expired; no provider conclusion
		}
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

func (m *microsoft) Skill(env Env, key string) SkillAccount {
	// Synced directories and fetched files are named by the address; the
	// connection's own stores by its name.
	address := microsoftAddressOf(key)
	_, ready := m.SyncCommand(env, key)
	var directories strings.Builder
	mirror, syncs := false, false
	if remotes, err := microsoftRemotes(env, key); err == nil {
		for _, r := range remotes {
			if !microsoftKept(env, key, r) {
				continue
			}
			syncs = true
			if microsoftReady(env, key, r) {
				fmt.Fprintf(&directories, "\n- `~/%s/`", r.Directory)
			}
			// The grant reads files only; its roots are one-way mirrors.
			mirror = mirror || !r.Writable
		}
	}
	// Only an account whose libraries an earlier release synced has local
	// copies to describe; every other one reaches its files by search alone.
	files, list := "", ""
	if syncs {
		files = "The OneDrive folders and SharePoint libraries the person chose sync both ways"
		if mirror {
			files = "The OneDrive folders and SharePoint libraries the person chose are one-way mirrors, because this account's access to files is read-only"
		}
		files += fmt.Sprintf(": OneDrive under `~/cloud/onedrive/%s/`, each library under `~/cloud/sharepoint/<organisation>/<site>/<library>/`. Only the directories listed at the end of this section are complete; anything else under those paths is not there yet. Local files that the first sync replaced or removed are kept under `~/.local/share/rclone/microsoft-backups/%s/`.", address, key)
		list = "\n\nSynced directories:" + directories.String()
		if !ready {
			list = "\n\nThe first sync has not finished, so nothing under those paths can be relied on yet."
		}
		files = "\n\n" + files
	}
	var services []Service
	uses, search := "Outlook mail, calendars and contacts", ""
	n, nerr := microsoftReadNative(env, key)
	filesOnly := nerr == nil && n.mcpFilesOnly
	if filesOnly {
		// The files area alone: no mail, calendar or contacts to describe.
		if n.mcpAllowed != "" {
			allowed := microsoftGranted(strings.Fields(n.mcpAllowed))
			search = "\n\n" + microsoftSearchSkill(address, syncs, microsoftWritable("sharepoint", allowed))
		}
	} else if nerr == nil && n.mcpAllowed != "" {
		// The Outlook server's scopes were derived from the grant at sign-in.
		allowed := microsoftGranted(strings.Fields(n.mcpAllowed))
		for _, id := range []string{"mail", "calendar", "contacts"} {
			services = append(services, Service{ID: id, Access: microsoftRules.access(id, allowed)})
		}
		if !n.mcpOutdated() && microsoftRules.access("onedrive", allowed) != AccessNone {
			uses = "Outlook mail, calendars, contacts and Microsoft 365 files"
			search = "\n\n" + microsoftSearchSkill(address, syncs, microsoftWritable("sharepoint", allowed))
		}
	}
	index := 1
	if server, _, err := microsoftServerOf(env, key); err == nil && server.index > 0 {
		index = server.index
	}
	areas, kinds := microsoftAreasSkill(uses, index), []string{"mail", "calendar", "contacts", "files"}
	if filesOnly {
		areas, kinds = microsoftFilesAreaSkill(index), []string{"files"}
	}
	body := areas + files + search + list +
		accessSummary(services, map[string]string{"mail": "Outlook mail", "calendar": "Outlook calendar", "contacts": "Outlook contacts"})
	// The same address may be connected in several organisations; the
	// allowed list's name tells the agent which one this is.
	label := "Microsoft"
	if org := microsoftOrganisationLabel(env, key); org != "" {
		label += " (" + org + ")"
	}
	return SkillAccount{Label: label, Kinds: kinds, Synced: ready && !mirror, Mirrored: ready && mirror, Body: body}
}

// microsoftFilesAreaSkill describes a connection without a mailbox: its one
// files area, and why there is no mail, calendar or contacts to look for.
func microsoftFilesAreaSkill(index int) string {
	files := microsoftAreaEntryName(index, "files")
	return fmt.Sprintf("Microsoft 365 files are reached through one Pi MCP area, `%s`, signed in as this account only. The account has no mailbox in this organisation (usual for a guest account), so it has no Outlook mail, calendar or contacts here; do not look for them under this account. ", files) +
		fmt.Sprintf("`describeNamespace(%q)` lists its tools and `searchTools(query, {namespace: %q})` searches them; their tool descriptions carry the syntax. ", files, files) +
		"Deleting and sharing a file first ask the person in the browser; when they do not allow it, the call is not made and you are told so. " +
		"A sign-in problem stops the files, and the person renews it in Settings → Integrations; if the organisation has since given the account a mailbox, that renewal also brings its mail, calendar and contacts."
}

// microsoftAreasSkill names the account's five areas and says to pick one
// before searching (research recommendation 2): a search across all areas
// still ranks mail-folder deletion high for a file-folder query, a search
// inside the files area never shows it. It also names the one trap the
// mail tools' names hide: the reply and forward tools send at once.
func microsoftAreasSkill(uses string, index int) string {
	name := func(area string) string { return "`" + microsoftAreaEntryName(index, area) + "`" }
	return fmt.Sprintf("%s are reached through five Pi MCP areas, each signed in as this account only: %s for mail, %s for the calendar, %s for contacts, %s for OneDrive and SharePoint files, and %s for arranging the mailbox (mail folders, calendars and contact folders, calendar sharing, Focused Inbox) when the person asks for that. ", uses, name("mail"), name("calendar"), name("contacts"), name("files"), name("admin")) +
		fmt.Sprintf("Pick the area first: `describeNamespace(%q)` lists its tools and `searchTools(query, {namespace: %q})` searches only that area; a mail folder is not a file folder. Their tool descriptions carry the syntax. ", microsoftAreaEntryName(index, "files"), microsoftAreaEntryName(index, "files")) +
		"For mail, `create-draft-email`, `create-reply-draft`, `create-reply-all-draft` and `create-forward-draft` prepare a draft; `send-mail`, `send-draft-message` and the `reply-…` and `forward-…` tools send at once. Deleting, sending and sharing a calendar or file first ask the person in the browser; when they do not allow it, the call is not made and you are told so. " +
		"Files and Outlook share one sign-in, so a sign-in problem stops both and the person renews it once in Settings → Integrations. Connecting an account from another organisation may first need that organisation's administrator to approve the app."
}

// microsoftSearchSkill tells an agent to find files by search and fetch only
// what it needs (Jari 12.11.2026): a full local copy of every library does not
// fit the person's quota, and a recursive grep over a cloud tree that is not
// fully local either misses files or downloads all of them. Since 14.11.2026
// a sign-in syncs nothing, so only an account whose libraries an earlier
// release synced (syncs) hears of synced directories. Jari proofreads every
// change to this text before it reaches the pilots.
func microsoftSearchSkill(address string, syncs, writable bool) string {
	local := "Most of what this account can open is not on this machine, since a full copy of every library would not fit the person's storage."
	grep := "Grep and read within what you fetched, and inside the synced directories listed below, which are complete local copies. A recursive grep or find over `~/cloud/` as a whole is the thing to avoid: it sees only what happens to be local, so finding nothing there says nothing about the cloud, and the synced copies can be very large."
	if !syncs {
		local = "None of this account's files are copied to this machine, since a full copy of every library would not fit the person's storage."
		grep = "Grep and read within what you fetched. A recursive grep or find over `~/cloud/` as a whole is the thing to avoid: it sees only what happens to be local, so finding nothing there says nothing about the cloud."
	}
	write := "This account's files grant is read-only. To enable file writes, first have the administrator consent to the Full application's delegated Graph Files.ReadWrite.All and Sites.ReadWrite.All permissions in Entra if they are missing. Then the person changes the Microsoft account to Full (or Everything but sending mail, whose application also needs those permissions) in Settings → Integrations and signs in again. After an administrator changes consent, sign in again even if Settings already shows Full: the agent's tools use the grant recorded at sign-in. Do not promise that a local edit has been uploaded."
	if writable {
		write = "This account's file grant permits writes through the files area, without syncing whole libraries. Resolve the target driveId and parent folder's driveItemId with the search and browsing tools; a downloaded path alone is not a cloud destination. Inspect the tool schema before calling. " +
			"Prefer `create-upload-session` for files on disk: use driveItemId `<parentId>:/<filename>:` for a new file and body `{\"item\":{\"@microsoft.graph.conflictBehavior\":\"fail\"}}` (or `rename` for a separate copy). It returns a secret pre-authenticated uploadUrl, not a completed upload. PUT the local bytes to that URL without an Authorization header, in sequential chunks with Content-Length and Content-Range; non-final chunks must be multiples of 320 KiB and each request less than 60 MiB. Keep the URL out of messages and logs. Check the final driveItem response before saying it is saved. " +
			"For content under 2 MiB, `upload-file-content` takes a base64 string as body and a target driveItemId; it silently replaces an existing target. Use it only when the person explicitly requested replacement of that exact file; for a new file use an upload session with conflictBehavior fail or rename instead. Never silently overwrite a file or retry an uncertain write: first read the destination to determine what happened. " +
			"`create-onedrive-folder` creates a folder under the parent item (body name, folder: {}, and @microsoft.graph.conflictBehavior: fail); `move-rename-onedrive-item` changes name or parentReference.id; `copy-drive-item` copies to parentReference.driveId/id and an optional name. Resolve name conflicts rather than silently replacing, and a copy's accepted response is not proof the asynchronous copy finished. `delete-onedrive-file`, `share-drive-item` and `create-drive-item-share-link` ask the person in the browser first; do not bypass that confirmation with a direct request."
	}
	return local + " Microsoft's search is how files are found. `search-query` with the entity type `driveItem` searches the names and contents of everything this account can open: OneDrive, every SharePoint site and team, followed or not, and files shared with the person. KQL narrows it, for example `filetype:pdf`, `path:\"https://…\"` or `LastModifiedTime>=2026-01-01`. `search-sharepoint-sites`, `list-sharepoint-site-drives`, `search-onedrive-files` and `list-folder-files` look inside one site, library or folder.\n\n" +
		fmt.Sprintf("To read a file, fetch it with `download-bytes-to-file` (path `/drives/{driveId}/items/{itemId}/content`) to `~/cloud/microsoft-fetched/%s/` followed by the host and decoded path of the item's `webUrl`, for example `~/cloud/microsoft-fetched/%s/contoso.sharepoint.com/sites/Sales/Shared Documents/offer.docx`; when the `webUrl` is not a plain path to the file, use the drive ID and the file name instead. The local path then says where the file lives in the cloud. The tool needs the parent directory to exist and does not overwrite: a file already there is an earlier fetch that may be stale and may hold edits made here. Look at its age, and put a fresh fetch beside it under another name instead of deleting it.\n\n", address, address) +
		grep + "\n\n" +
		"A fetched file is a local copy: editing it does not upload it. " + write
}

var _ resumableEntry = (*microsoft)(nil)
var _ GrantEntry = (*microsoft)(nil)
var _ LoginEntry = (*microsoft)(nil)
