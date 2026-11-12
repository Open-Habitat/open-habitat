//go:build linux

// Package integrations is the catalog of native tools that bring a person's
// mail, calendars, contacts and cloud files to their agents (ADR 0026). It runs
// inside the person's daemon, as that person. Each tool keeps its login in its
// own store in the home, each status is read from the tool when asked, and the
// host keeps no record of connections: whether an account exists is decided by
// the tool's own files under a catalog-owned name, so a person can still set up
// other accounts of the same tools by hand without the catalog touching them.
package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/netip"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"sync"
	"time"

	"github.com/open-habitat/open-habitat/internal/core"
	"github.com/open-habitat/open-habitat/internal/storagequota"
	"golang.org/x/sys/unix"

	"github.com/open-habitat/open-habitat/internal/integrationapps"
)

type Provider string

const (
	IMAP      Provider = "imap"
	CalDAV    Provider = "caldav"
	CardDAV   Provider = "carddav"
	Google    Provider = "google"
	Microsoft Provider = "microsoft"
	Dropbox   Provider = "dropbox"
)

// providerOrder is the order of the page's provider tiles and accounts.
var providerOrder = []Provider{Google, Microsoft, Atlassian, Trello, IMAP, CalDAV, CardDAV, Dropbox}

type LoginKind string

const (
	AppPassword    LoginKind = "app_password"
	PastedRedirect LoginKind = "pasted_redirect"
	DeviceCode     LoginKind = "device_code"
)

type ServiceState string

const (
	StateOK                  ServiceState = "ok"
	StateSyncing             ServiceState = "syncing"
	StateSyncFailed          ServiceState = "sync_failed"
	StateCredentialsRejected ServiceState = "credentials_rejected"
	StateLoginExpired        ServiceState = "login_expired"
	StateUnreachable         ServiceState = "unreachable"
	StateSyncRestarting      ServiceState = "sync_restarting"
	StateQuotaFull           ServiceState = "quota_full"
	StateUnknown             ServiceState = "unknown"
	// StatePendingFirstSync is a service the catalog does not ask about while
	// a first native pass of the same provider runs: its tool shares the
	// pass's native lock and token, so the state is read after the pass. It
	// is not "unknown", which says a check was made and failed.
	StatePendingFirstSync ServiceState = "pending_first_sync"
)

// InitialSyncIncomplete is a sync_failed service whose login works but whose
// first native pass never finished and is not being resumed (resume_linux.go),
// for example because the daemon stopped before the pass started. Ordinary
// sync never resyncs on its own; signing in again offers the initial choice.
const InitialSyncIncomplete = "initial_sync_incomplete"

// FoldersNotChosen is a sync_failed service whose login works but whose files
// never had a first pass: the person left them out, or the first choice was
// refused before anything was copied. Signing in again offers the choice.
const FoldersNotChosen = "not_chosen"

// signedInState is a file service's state after its tool accepted the login.
func signedInState(ready bool) (ServiceState, string) {
	if ready {
		return StateOK, ""
	}
	return StateSyncFailed, InitialSyncIncomplete
}

// Service is one service of an account as its tool reports it. Directory is
// home-relative ("~/cloud/…") and only set for synced files.
type Service struct {
	ID        string        `json:"id"`
	State     ServiceState  `json:"state"`
	Directory string        `json:"directory,omitempty"`
	Progress  *SyncProgress `json:"progress,omitempty"`
	Failure   string        `json:"failure,omitempty"`
	// LastSyncedAt is when the latest successful pass ended, from rclone's
	// own committed listings; for several libraries, the oldest of them.
	LastSyncedAt string `json:"last_synced_at,omitempty"`
	// NeededBytes and FreeBytes are a quota_insufficient refusal's counted
	// size of the chosen files and the room it did not fit.
	NeededBytes uint64 `json:"needed_bytes,omitempty"`
	FreeBytes   uint64 `json:"free_bytes,omitempty"`
	// Access is what the provider's grant allows this service, when the
	// grant can be read (grant_linux.go).
	Access Access `json:"access,omitempty"`
}

type Account struct {
	Provider  Provider  `json:"provider"`
	Address   string    `json:"address"`
	Services  []Service `json:"services"`
	CheckedAt string    `json:"checked_at"`
	// AppleID is set when the account's stored server is Apple's
	// (apple_linux.go): the page shows it in that Apple ID's card.
	AppleID string `json:"apple_id,omitempty"`
	// Grant is the provider's grant in its own scope names, when it can be
	// read; the services carry what it allows.
	Grant *Grant `json:"grant,omitempty"`
	// Level is the account level the grant amounts to, when it is one.
	Level Level `json:"level,omitempty"`
}

// Env is everything an entry may use: the person's home and the operator's
// installation-wide configuration.
type Env struct {
	Home   string
	Config Config
	// LoadConfig observes the installation on demand. Nil uses Config for fixtures.
	LoadConfig func() (Config, error)
	// FixtureTools admits tools that root does not own. Only same-UID tests
	// and the synthetic browser host set it; the product never does.
	FixtureTools bool
	// Resolve replaces the system resolver for a host the daemon sends DAV
	// credentials to. Only same-UID tests and the synthetic browser host set
	// it; every address it returns still passes the dial-time rule.
	Resolve func(ctx context.Context, host string) ([]netip.Addr, error)
}

// Entry is one catalog entry: a native tool, how it logs in, how its status
// is read and what the personal-data skill says about it. Entries are product
// code because each needs login glue for its tool.
type Entry interface {
	Provider() Provider
	Login() LoginKind
	Services() []string
	// Available reports whether the entry's tool is installed and, for an
	// AppEntry, the operator's application is registered; an unavailable
	// entry is shown but cannot be connected.
	Available(env Env) bool
	// Accounts lists the addresses the tool holds under catalog-owned names.
	// It reads files only, starts nothing and never touches the network.
	Accounts(env Env) ([]string, error)
	// Check reads each service's state for one account from the tool.
	Check(ctx context.Context, env Env, address string) []Service
	// Remove deletes the tool's login and configuration for the account.
	// Synced directories are left to the catalog.
	Remove(ctx context.Context, env Env, address string) error
	// Skill describes the account for the personal-data skill.
	Skill(env Env, address string) SkillAccount
}

// GrantEntry reads the provider's grant along with the services' states.
// Each service then carries its Access, and the grant its scope names.
type GrantEntry interface {
	Entry
	CheckGrant(ctx context.Context, env Env, address string) ([]Service, *Grant)
}

// AppEntry is an entry that also needs the operator's application
// registration. Every installation ships the tools, so on a correct
// installation only the registration can be missing.
type AppEntry interface {
	Entry
	ToolsInstalled(env Env) bool
	AppConfigured(env Env) bool
}

// ToolEntry names the installed tools an entry runs.
type ToolEntry interface{ Tools() []string }

// MissingTools lists, in the entry's order, the tools the installation does
// not provide as trusted executables. The names are product constants.
func MissingTools(e Entry, env Env) []string {
	t, ok := e.(ToolEntry)
	if !ok {
		return nil
	}
	var out []string
	for _, name := range t.Tools() {
		if _, ok := env.Tool(name); !ok {
			out = append(out, name)
		}
	}
	return out
}

// UnavailableReason says what an unavailable entry lacks: the operator's
// application registration, or its installed tool. Empty when available.
func UnavailableReason(e Entry, env Env) string {
	if e.Available(env) {
		return ""
	}
	if a, ok := e.(AppEntry); ok && a.ToolsInstalled(env) && !a.AppConfigured(env) {
		return "app_credentials_required"
	}
	return "tool_unavailable"
}

// PasswordAccount is what a person types for an app-password account.
type PasswordAccount struct {
	Address, Server, Security, Username, Password string
	Port                                          int
	SMTPServer, SMTPSecurity, URL                 string
	SMTPPort                                      int
	// SMTPUsername is set only where the provider signs SMTP in under
	// another name than IMAP: iCloud Mail takes the address's name part
	// for IMAP and the full address for SMTP.
	SMTPUsername string
	// AppleID names the Apple account an iCloud Mail account was connected
	// with, which may be another address than the mail address.
	AppleID string
}

// PasswordEntry connects an account from an app password the person types;
// the daemon writes it into the tool's own configuration.
type PasswordEntry interface {
	Entry
	ValidAccount(PasswordAccount) bool
	Connect(ctx context.Context, env Env, account PasswordAccount) error
	ChangePassword(ctx context.Context, env Env, address, password string) error
}

// LoginEntry runs a tool's own login and relays it through the browser as a
// device code or as a redirect address the person pastes back.
type LoginEntry interface {
	Entry
	// StartLogin starts the tool's login. A non-empty address signs that
	// existing account in again.
	StartLogin(ctx context.Context, env Env, address string) (Login, error)
}

// Login is one running tool login. Prompt is called once, then Redirect (for
// a pasted redirect) and Wait; Cancel may be called at any time.
type Login interface {
	Prompt(ctx context.Context) (Prompt, error)
	Redirect(ctx context.Context, raw string) error
	Wait(ctx context.Context) (string, error)
	Cancel()
}

// Prompt is what the person needs from the tool: a device code and its page,
// or the provider's authorization address and the loopback prefix it ends on.
type Prompt struct {
	// Completed is a native login that finished without browser interaction
	// (for example, Pi renewed the existing grant). No URL is invented.
	Completed                        bool
	Flow                             string // Microsoft device grant: files or outlook.
	VerificationURI, UserCode        string
	AuthorizationURL, RedirectPrefix string
	ExpiresAt                        time.Time
}

// SyncDirectory is a home-relative directory a sync client keeps, such as
// "cloud/google-drive/person@example.test".
// SyncDirectory is a synced service's home-relative local directory and,
// once its first pass has committed listings, the bisync working directory
// whose listings tell when it last synced.
type SyncDirectory struct{ Service, Path, Work string }

// Command is a tool invocation. Path is absolute; Env adds to the minimal
// environment every tool gets.
type Command struct {
	Path string
	Args []string
	Env  []string
	// Passes names the working directories of a syncLoop's passes in the
	// order of its stderr markers; empty for any other command.
	Passes []string
}

// SyncEntry keeps an account's files in a directory under ~/cloud with a
// continuous sync client that the daemon supervises.
type SyncEntry interface {
	Entry
	Directories(env Env, address string) []SyncDirectory
	// SyncCommand returns the account's sync client, or false while the
	// account has no folders chosen to sync.
	SyncCommand(env Env, address string) (Command, bool)
}

// Folder is a provider-side folder the person can choose to sync. Estimated
// is a size the provider's own accounting gives rather than one counted from
// the files; Whole is the choice that contains every other folder listed.
type Folder struct {
	ID, Name    string
	Bytes       uint64
	UnknownSize bool
	Estimated   bool
	Whole       bool
	Suggested   bool
}

// FolderEntry lets the person choose which folders to sync after signing in.
type FolderEntry interface {
	SyncEntry
	Folders(ctx context.Context, env Env, address string) ([]Folder, error)
	ChooseFolders(ctx context.Context, env Env, address string, ids []string) error
}

// FolderSizer counts the listed folders' sizes while the person is still
// choosing, so the choice shows what each takes. It reports each folder it
// counted and returns when done or when ctx ends; a folder it did not report
// keeps the size Folders gave it.
type FolderSizer interface {
	SizeFolders(ctx context.Context, env Env, address string, report func(id string, bytes uint64))
}

// Failure is a fixed outcome code. Native error text never becomes one.
type Failure string

func (f Failure) Error() string { return string(f) }

const (
	CredentialsRejected Failure = "credentials_rejected"
	ServerUnreachable   Failure = "server_unreachable"
	EndpointRejected    Failure = "endpoint_rejected"
	AccountExists       Failure = "account_exists"
	AccountMissing      Failure = "account_missing"
	Expired             Failure = "expired"
	PermissionRefused   Failure = "permission_refused"
	RedirectRejected    Failure = "redirect_rejected"
	DeviceCodeBlocked   Failure = "device_code_blocked"
	AccountMismatch     Failure = "account_mismatch"
	ToolFailed          Failure = "tool_failed"
	Cancelled           Failure = "cancelled"
	// NothingGranted is a grant that reaches none of the entry's services.
	NothingGranted Failure = "nothing_granted"
	// FinalSyncFailed is a level change whose last two-way pass with the
	// old grant failed; nothing changed and the new grant was revoked.
	FinalSyncFailed Failure = "final_sync_failed"
	// RevokeFailed is a level change whose old grant could not be ended at
	// the provider before the new sign-in; nothing changed.
	RevokeFailed Failure = "revoke_failed"
	// AlreadyConnected is a new connection to an account already here at
	// another level, which only a level change of that account may make.
	AlreadyConnected Failure = "already_connected"
)

// ConsentRequired is a tenant that needs its administrator to approve the
// operator's application. URL is the consent link the tool itself printed.
type ConsentRequired struct{ URL string }

func (ConsentRequired) Error() string { return "consent_required" }

var addressPattern = regexp.MustCompile(`^[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$`)
var addressDots = regexp.MustCompile(`\.\.|^\.|\.@|@\.|\.$`)
var toolName = regexp.MustCompile(`^[a-z0-9-]{1,32}$`)

// ValidAddress admits the lowercase email addresses that name accounts in
// file names and directories. Anything else is refused before a tool sees it.
func ValidAddress(s string) bool {
	return len(s) <= 254 && addressPattern.MatchString(s) && !addressDots.MatchString(s)
}

// ConfigPath is the installation-wide integrations configuration.
const ConfigPath = integrationapps.Path

// Config is the operator's integrations configuration.
type Config struct {
	// Tools maps a catalog tool name to the absolute path of its pinned
	// executable. Host apply publishes it from the release's integrations
	// profile; the application sections are the operator's.
	Tools     map[string]string `json:"tools"`
	Dropbox   *DropboxApp       `json:"dropbox,omitempty"`
	Google    *GoogleApp        `json:"google,omitempty"`
	Microsoft *MicrosoftApp     `json:"microsoft,omitempty"`
	// The applications of a provider's narrower account levels (level_linux.go).
	MicrosoftNoSend  *MicrosoftApp `json:"microsoft_nosend,omitempty"`
	MicrosoftDrafts  *MicrosoftApp `json:"microsoft_drafts,omitempty"`
	MicrosoftRead    *MicrosoftApp `json:"microsoft_read,omitempty"`
	DropboxAppFolder *DropboxApp   `json:"dropbox_app_folder,omitempty"`
}

// DropboxApp identifies the operator's scoped Dropbox application, not a person.
type DropboxApp struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

// config is the operator's configuration now.
func (env Env) config() (Config, bool) {
	if env.LoadConfig != nil {
		cfg, err := env.LoadConfig()
		return cfg, err == nil
	}
	return env.Config, true
}

// dropboxApps are the operator's usable Dropbox applications by level: the
// Full Dropbox application serves the full and the read level, which differ
// only in the scopes a sign-in asks for, and the App folder application the
// app folder level.
func (env Env) dropboxApps() map[Level]DropboxApp {
	cfg, ok := env.config()
	out := map[Level]DropboxApp{}
	if !ok {
		return out
	}
	usable := func(a *DropboxApp, section string) bool {
		return a != nil && integrationapps.Usable(section, map[string]string{"client_id": a.ClientID, "client_secret": a.ClientSecret})
	}
	if usable(cfg.Dropbox, "dropbox") {
		out[LevelFull], out[LevelRead] = *cfg.Dropbox, *cfg.Dropbox
	}
	if usable(cfg.DropboxAppFolder, "dropbox_app_folder") {
		out[LevelAppFolder] = *cfg.DropboxAppFolder
	}
	return out
}

// LoadConfig reads ConfigPath. Untrusted files and malformed JSON fail closed;
// individual configuration entries are decoded independently so an operator's
// newer provider or broken entry cannot disable unrelated integrations.
func LoadConfig(log *slog.Logger) (Config, error) {
	return loadConfig(ConfigPath, log)
}

func loadConfig(path string, log *slog.Logger) (Config, error) {
	data, err := core.ReadOperatorFile(path, 16384)
	if errors.Is(err, core.ErrOperatorFileMissing) {
		return Config{}, nil
	}
	if err != nil {
		return Config{}, err
	}
	return parseConfig(data, log)
}

func parseConfig(data []byte, log *slog.Logger) (Config, error) {
	var entries map[string]json.RawMessage
	if err := decodeStrict(data, &entries); err != nil || entries == nil {
		return Config{}, errors.New("invalid integrations configuration")
	}
	ignored := func(entry, reason string) {
		if log != nil {
			log.Warn("integrations_config", "outcome", "ignored", "entry", entry, "reason", reason)
		}
	}
	var cfg Config
	for name, raw := range entries {
		switch name {
		case "tools":
			var tools map[string]json.RawMessage
			if err := decodeStrict(raw, &tools); err != nil || tools == nil {
				ignored("tools", "invalid_entry")
				continue
			}
			cfg.Tools = make(map[string]string)
			for name, raw := range tools {
				var path string
				if err := decodeStrict(raw, &path); err != nil || !toolName.MatchString(name) || !filepath.IsAbs(path) || filepath.Clean(path) != path {
					// Neither tool names nor paths are safe diagnostic content.
					ignored("tools", "invalid_tool")
					continue
				}
				cfg.Tools[name] = path
			}
		case "dropbox", "dropbox_app_folder":
			var app DropboxApp
			if err := decodeStrict(raw, &app); err != nil || !integrationapps.Usable(name, map[string]string{"client_id": app.ClientID, "client_secret": app.ClientSecret}) {
				ignored(name, "invalid_entry")
				continue
			}
			if name == "dropbox" {
				cfg.Dropbox = &app
			} else {
				cfg.DropboxAppFolder = &app
			}
		case "google":
			var app GoogleApp
			if err := decodeStrict(raw, &app); err != nil {
				ignored("google", "invalid_entry")
				continue
			}
			cfg.Google = &app
			if _, ok := (Env{Config: cfg}).googleApp(); !ok {
				cfg.Google = nil
				ignored("google", "invalid_entry")
			}
		case "microsoft", "microsoft_nosend", "microsoft_drafts", "microsoft_read":
			var app MicrosoftApp
			if err := decodeStrict(raw, &app); err != nil || !integrationapps.Usable(name, map[string]string{"client_id": app.ClientID, "tenant_id": app.TenantID}) {
				ignored(name, "invalid_entry")
				continue
			}
			switch name {
			case "microsoft":
				cfg.Microsoft = &app
			case "microsoft_nosend":
				cfg.MicrosoftNoSend = &app
			case "microsoft_drafts":
				cfg.MicrosoftDrafts = &app
			default:
				cfg.MicrosoftRead = &app
			}
		default:
			// Unknown keys can contain arbitrary operator input; never log them.
			ignored("unknown", "unknown_entry")
		}
	}
	return cfg, nil
}

// Tool returns the operator's pinned executable for name when it can be
// trusted: absolute, a root-owned regular executable in root-owned
// directories that nobody else can write. Fixture environments skip the
// ownership and write-permission requirements.
func (env Env) Tool(name string) (string, bool) {
	cfg := env.Config
	if env.LoadConfig != nil {
		var err error
		cfg, err = env.LoadConfig()
		if err != nil {
			return "", false
		}
	}
	path := cfg.Tools[name]
	if path == "" || !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return "", false
	}
	var st unix.Stat_t
	if unix.Stat(path, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0111 == 0 {
		return "", false
	}
	// A checkout's umask decides a fixture's mode, so fixtures are trusted
	// as found; an operator's tool must be root's alone.
	if env.FixtureTools {
		return path, true
	}
	if st.Uid != 0 || st.Mode&0022 != 0 {
		return "", false
	}
	for dir := filepath.Dir(path); ; dir = filepath.Dir(dir) {
		var d unix.Stat_t
		if unix.Stat(dir, &d) != nil || d.Uid != 0 || d.Mode&0022 != 0 {
			return "", false
		}
		if dir == "/" {
			break
		}
	}
	return path, true
}

// Production is the catalog the product ships.
func Production() []Entry {
	return []Entry{&himalaya{}, &dav{CalDAV}, &dav{CardDAV}, &dropbox{}, &google{}, &microsoft{}, &atlassian{}, &trello{}}
}

// Catalog drives the entries for one person: listing and checking accounts,
// connecting and removing them, relaying logins, supervising sync and keeping
// the personal-data skill in step with what the tools hold.
type Catalog struct {
	env        Env
	entries    []Entry
	log        *slog.Logger
	now        func() time.Time
	signInWait time.Duration
	// quota reports the room the home has now.
	quota func() Room
	// trash moves a home-relative directory to the person's Trash.
	trash func(rel string) error

	// write serializes everything that changes the tools' files, the skill
	// and the supervised set, so a removal cannot race a login completing.
	write    sync.Mutex
	stopping bool // guarded by write; shutdown must not restart retained clients
	sync     *Supervisor
	relay    relay

	// resumePoll is how often a resume looks again at a pass that another
	// process or login holds; resumeFirst..resumeMax back off a provider
	// that could not be reached.
	resumePoll, resumeFirst, resumeMax time.Duration

	// apple are the endpoints of the Apple (iCloud) connection.
	apple AppleHosts

	// gitea is the native adapter for tea's logins (gitea_linux.go); nil
	// leaves Gitea out of the catalog. giteaWrite serializes its writes.
	gitea      *GiteaAdapter
	giteaWrite sync.Mutex
	// gitlab is the native adapter for glab's logins (gitlab_linux.go);
	// nil leaves GitLab out. gitlabWrite serializes its writes.
	gitlab      *GitLabAdapter
	gitlabWrite sync.Mutex
}

type Option func(*Catalog)

// WithTrash supplies the daemon's freedesktop Trash for removed directories.
func WithTrash(trash func(rel string) error) Option {
	return func(c *Catalog) { c.trash = trash }
}

// Room is the space left for the person's files: Free under the home quota,
// or on the filesystem when no quota applies (Limit is then zero). OK is false
// when neither could be read.
type Room struct {
	Free, Limit uint64
	Full, OK    bool
}

// WithQuota replaces the kernel quota reader; tests and the synthetic host.
func WithQuota(quota func() Room) Option {
	return func(c *Catalog) { c.quota = quota }
}

// WithResumeTiming shortens the interrupted-first-pass resume waits; tests only.
func WithResumeTiming(poll, first, max time.Duration) Option {
	return func(c *Catalog) { c.resumePoll, c.resumeFirst, c.resumeMax = poll, first, max }
}

// WithClock replaces the wall clock; tests only.
func WithClock(now func() time.Time) Option { return func(c *Catalog) { c.now = now } }

// WithSyncBackoff shortens the supervisor's restart backoff; tests only.
func WithSyncBackoff(first, max time.Duration) Option {
	return func(c *Catalog) { c.sync.first, c.sync.max = first, max }
}

func New(env Env, entries []Entry, log *slog.Logger, opts ...Option) *Catalog {
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	c := &Catalog{env: env, entries: entries, log: log, now: time.Now, signInWait: 60 * time.Second, quota: kernelQuota, resumePoll: 30 * time.Second, resumeFirst: time.Minute, resumeMax: 30 * time.Minute, apple: appleHosts}
	c.trash = func(string) error { return errors.New("trash unavailable") }
	c.sync = newSupervisor(env, log)
	for _, o := range opts {
		o(c)
	}
	return c
}

func kernelQuota() Room {
	if q, err := storagequota.Read(uint32(os.Geteuid())); err == nil && q.Limit > 0 {
		if q.Usage >= q.Limit {
			return Room{Limit: q.Limit, Full: true, OK: true}
		}
		return Room{Free: q.Limit - q.Usage, Limit: q.Limit, OK: true}
	}
	if fs, err := storagequota.Capacity(); err == nil {
		return Room{Free: fs.Free, Full: fs.Free == 0, OK: true}
	}
	return Room{}
}

// Start brings the home into step with what the tools hold when the daemon
// starts: sync clients for every syncing account, the boot signal and the
// skill, and the first passes a stop interrupted resume in the background.
// It stops the sync clients when ctx ends.
func (c *Catalog) Start(ctx context.Context) {
	c.write.Lock()
	c.reconcile()
	queue := c.interruptedQueue()
	c.write.Unlock()
	go func() {
		c.alignAll(ctx)
		c.resumeInterrupted(ctx, queue)
		c.recoverMicrosoft(ctx)
	}()
	go func() {
		<-ctx.Done()
		c.relay.cancelAll()
		c.write.Lock()
		c.stopping = true
		c.sync.stopAll()
		c.write.Unlock()
	}()
}

func (c *Catalog) entry(p Provider) Entry {
	for _, e := range c.entries {
		if e.Provider() == p {
			return e
		}
	}
	return nil
}

type listed struct {
	entry   Entry
	address string
}

// accounts lists every catalog-owned account from the tools' files, in the
// page's order. unread names the providers whose files could not be read: an
// unreadable inventory is not an empty one, so callers must not act on those
// providers' apparent absence.
func (c *Catalog) accounts() (out []listed, unread map[Provider]bool) {
	unread = map[Provider]bool{}
	for _, p := range providerOrder {
		e := c.entry(p)
		if e == nil {
			continue
		}
		addresses, err := e.Accounts(c.env)
		if err != nil {
			c.log.Warn("integration_list", "provider", string(p), "outcome", "failed", "reason", "native_unavailable")
			unread[p] = true
			continue
		}
		sort.Strings(addresses)
		for _, a := range addresses {
			if validCatalogAddress(e.Provider(), a) {
				out = append(out, listed{e, a})
			}
		}
	}
	return out, unread
}

var errInventory = errors.New("inventory unavailable")

// has reports whether the tool holds the account; an unreadable inventory
// is an error, never a "no".
func (c *Catalog) has(e Entry, address string) (bool, error) {
	addresses, err := e.Accounts(c.env)
	if err != nil {
		return false, errInventory
	}
	for _, a := range addresses {
		if a == address {
			return true, nil
		}
	}
	return false, nil
}

// alignAll brings every account whose native configuration names an earlier
// application of the operator to the current one, once per daemon start.
func (c *Catalog) alignAll(ctx context.Context) {
	accounts, _ := c.accounts()
	for _, a := range accounts {
		if e, ok := a.entry.(AlignEntry); ok && e.Misaligned(c.env, a.address) {
			c.write.Lock()
			c.align(ctx, e, a.address)
			c.write.Unlock()
		}
	}
}

// align runs one account's Align with its sync client stopped only while a
// file it reads changes. The caller holds c.write.
func (c *Catalog) align(ctx context.Context, e AlignEntry, address string) {
	if c.stopping || ctx.Err() != nil || !e.Misaligned(c.env, address) {
		return
	}
	k := key{e.Provider(), address}
	stopped := false
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	err := e.Align(ctx, c.env, address, func() { c.sync.stop(k); stopped = true })
	cancel()
	outcome := "aligned"
	if err != nil {
		outcome = "deferred"
	} else if e.Misaligned(c.env, address) {
		outcome = "incomplete"
	}
	// An aligned registration may offer the agent other tools, which the
	// skill describes.
	if stopped || outcome == "aligned" {
		c.reconcile()
	}
	c.log.Info("integration_align", "provider", string(e.Provider()), "outcome", outcome)
}

// check reads one account's state live. Sync supervision and a full quota
// override what the tool says about its files, since the client is not
// running then whatever the tool last recorded.
func (c *Catalog) check(ctx context.Context, e Entry, address string) Account {
	// A configuration left on an earlier application follows the current
	// one first. A busy catalog, or a sign-in or first pass of the same
	// provider that runs without c.write, leaves that to the next check.
	if al, ok := e.(AlignEntry); ok && al.Misaligned(c.env, address) && c.write.TryLock() {
		c.relay.mu.Lock()
		a := c.relay.attempts[e.Provider()]
		busy := a != nil && !finished(a.state)
		c.relay.mu.Unlock()
		if !busy {
			c.align(ctx, al, address)
		}
		c.write.Unlock()
	}
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	// A native initial pass may hold the provider's mutex for hours. Never
	// queue status probes behind it or refresh its token concurrently.
	c.relay.mu.Lock()
	a := c.relay.attempts[e.Provider()]
	nativeBusy := a != nil && a.provider == e.Provider() && !finished(a.state) && a.state == "completing"
	initial := a != nil && a.provider == e.Provider() && a.address == address && a.syncing && a.state != "completed"
	// A sign-in completes under the same lock without a first pass; only a
	// pass promises a check after it.
	held := StateUnknown
	if a != nil && a.syncing && (initial || nativeBusy) {
		held = StatePendingFirstSync
	}
	var progress *SyncProgress
	failed := false
	var refused firstPassRefusal
	if initial {
		progress, failed = a.progress, a.state == "failed"
		if failed {
			refused, _ = refusalOf(a.failure)
		}
	}
	failure := refused.Failure
	resume := c.relay.resume[key{e.Provider(), address}]
	c.relay.mu.Unlock()
	var services []Service
	var grant *Grant
	// A first pass that failed holds nothing native any more: the tool is
	// asked as usual, and only the file service carries the failure below.
	// While it runs, the services it does not copy say they are checked
	// after it; the files it copies become syncing below.
	if (initial && !failed) || nativeBusy {
		for _, id := range e.Services() {
			services = append(services, Service{ID: id, State: held})
		}
	} else if g, ok := e.(GrantEntry); ok {
		services, grant = g.CheckGrant(ctx, c.env, address)
		resumeView(resume, services)
	} else {
		services = e.Check(ctx, c.env, address)
		// The tool sees only that the first pass never finished; the daemon
		// knows whether it is about to resume it or tried and failed.
		resumeView(resume, services)
	}
	if s, ok := e.(SyncEntry); ok {
		_, mirrors := e.(mirrorEntry)
		full := c.quota().Full
		k := key{e.Provider(), address}
		restarting, passes := c.sync.restarting(k), c.sync.passes(k)
		dirs := s.Directories(c.env, address)
		for i := range services {
			matched, synced, aborted := false, true, false
			var oldest time.Time
			var pass passState
			if a := services[i].Access; a == AccessNone || a == AccessRead && !mirrors {
				// A read grant's files sync only where the entry mirrors them.
				continue
			}
			for _, d := range dirs {
				if d.Service != services[i].ID {
					continue
				}
				matched = true
				services[i].Directory = "~/" + d.Path
				t, ok := time.Time{}, false
				if d.Work != "" {
					t, ok = lastSynced(c.env.Home, d.Work)
				}
				if !ok {
					synced = false
					aborted = aborted || d.Work != "" && listingsFailed(c.env.Home, d.Work)
				} else if oldest.IsZero() || t.Before(oldest) {
					oldest = t
				}
				// A running library is the service's current pass; a failed
				// one stays the service's failure until it next succeeds.
				p := passes[d.Work]
				if p.Running {
					pass.Running, pass.Progress = true, p.Progress
				}
				if p.Failure != "" && (pass.Failure == "" || rank(p.Failure) > rank(pass.Failure)) {
					pass.Failure = p.Failure
				}
			}
			if !matched {
				continue
			}
			if synced {
				services[i].LastSyncedAt = oldest.UTC().Format(time.RFC3339)
			}
			switch {
			case initial:
				services[i].State = StateSyncing
				if progress != nil && progress.Service == services[i].ID {
					services[i].Progress = progress
				}
				if failed {
					services[i].State = StateSyncFailed
				}
			case full:
				services[i].State, services[i].Failure = StateQuotaFull, ""
			case aborted && (services[i].State == StateOK || services[i].Failure == InitialSyncIncomplete):
				// Not an unfinished first sync: signing in again would resync,
				// which can bring back files deleted meanwhile.
				services[i].State, services[i].Failure = StateSyncFailed, NeedsResync
			case services[i].State == StateOK:
				// The login works; what the loop saw of its passes says
				// whether the files actually sync.
				if pass.Failure != "" {
					services[i].State, services[i].Failure = StateSyncRestarting, pass.Failure
				} else if restarting {
					services[i].State = StateSyncRestarting
				}
				if pass.Running {
					p := pass.Progress
					p.Service = services[i].ID
					services[i].Progress = &p
				}
			}
		}
	}
	// A just-selected Microsoft library may not have native listing pairs yet,
	// so Directories deliberately omits it. Attribute native counters to the
	// command's actual service, never the already-ready sibling directory.
	if initial && progress != nil {
		for i := range services {
			if services[i].ID == progress.Service {
				services[i].State, services[i].Progress = StateSyncing, progress
				if failed {
					services[i].State = StateSyncFailed
				}
			}
		}
	}

	if initial {
		for i := range services {
			if services[i].State == StateSyncFailed {
				services[i].Failure = failure
				if failure != "" {
					services[i].NeededBytes, services[i].FreeBytes = refused.NeededBytes, refused.FreeBytes
				}
			}
		}
	} else if r, ok := c.refusal(key{e.Provider(), address}); ok {
		// Files whose first pass never ran or never finished after a
		// refused choice say why, also after a restart.
		for i := range services {
			if s := &services[i]; s.State == StateSyncFailed && (s.Failure == FoldersNotChosen || s.Failure == InitialSyncIncomplete) {
				s.Failure, s.NeededBytes, s.FreeBytes = r.Failure, r.NeededBytes, r.FreeBytes
			}
		}
	}
	out := Account{Provider: e.Provider(), Address: address, Services: services, CheckedAt: c.now().UTC().Format(time.RFC3339), Grant: grant}
	if le, ok := e.(LevelEntry); ok && grant != nil {
		out.Level = le.Level(c.env, address, services)
	}
	out.AppleID, _ = c.appleMember(e, address)
	return out
}

// reconcile makes the supervised sync clients, the boot signal and the
// personal-data skill match the accounts the tools hold. The caller holds
// c.write.
func (c *Catalog) reconcile() SkillState {
	if c.stopping {
		return SkillFailed
	}
	accounts, unread := c.accounts()
	// A provider whose files cannot be read keeps the clients it has. An
	// account in its first pass gets no client beside the pass.
	c.relay.mu.Lock()
	blocked := map[key]bool{}
	for _, a := range c.relay.attempts {
		if a.syncing && a.state != "completed" {
			blocked[key{a.provider, a.address}] = true
		}
	}
	c.relay.mu.Unlock()
	desired := c.sync.running(unread)
	for k := range blocked {
		delete(desired, k)
	}
	for _, a := range accounts {
		if blocked[key{a.entry.Provider(), a.address}] {
			continue
		}
		if s, ok := a.entry.(SyncEntry); ok && s.Available(c.env) {
			if cmd, ok := s.SyncCommand(c.env, a.address); ok {
				desired[key{a.entry.Provider(), a.address}] = cmd
			}
		}
	}
	c.sync.reconcile(desired)
	if err := setBootSignal(c.env.Home, len(desired) > 0); err != nil {
		c.log.Warn("integration_boot_signal", "outcome", "failed", "reason", "home_unwritable")
	}
	if len(unread) > 0 {
		// Rewriting the skill from a partial inventory would drop accounts
		// that still exist.
		c.log.Warn("integration_skill", "outcome", "skipped", "reason", "inventory_unavailable")
		return SkillFailed
	}
	state := writeSkill(c.env.Home, skillAccounts(c.env, accounts))
	if state != SkillCurrent && state != SkillNone {
		c.log.Warn("integration_skill", "outcome", string(state), "reason", "skill_not_written")
	}
	return state
}

func skillAccounts(env Env, accounts []listed) []SkillAccount {
	var out []SkillAccount
	for _, a := range accounts {
		s := a.entry.Skill(env, a.address)
		s.Provider, s.Address = a.entry.Provider(), a.address
		out = append(out, s)
	}
	return out
}

func decodeStrict(data []byte, target any) error {
	dec := json.NewDecoder(bytesReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(target); err != nil {
		return err
	}
	if dec.Decode(new(any)) != io.EOF {
		return errors.New("trailing data")
	}
	return nil
}
