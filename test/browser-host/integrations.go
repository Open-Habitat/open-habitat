package main

import (
	"context"
	"errors"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/open-habitat/open-habitat/internal/daemon"
	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/nativegitea/giteafake"
	"github.com/open-habitat/open-habitat/internal/nativegitlab/gitlabfake"
)

// The synthetic host's integration catalog is the product's IMAP entry run
// against test/fixtures/integrations/himalaya, plus a Google entry with a
// pasted redirect and a Microsoft entry with a device code. These replace the
// native OAuth entries so the browser relays, Google's folder choice and sync
// supervision can be exercised end to end; they never ship.
// Their "tools" are records under the disposable home, like a real tool's
// token store, so the catalog reads accounts from files exactly as it does in
// production. Tests steer them through /fixture/integrations.

// integrationControl is process-wide within one host, like the scenario.
type integrationControl struct {
	mu sync.Mutex
	// outcome decides how the next device-code login ends: "" waits for
	// "approve", or "consent" and "blocked" fail at once.
	outcome string
	approve chan struct{}
	// expired lists providers whose logins the fixture reports as expired.
	expired map[integrations.Provider]bool
	// narrowed lists providers whose grant the fixture reports as narrower:
	// no files, mail drafts without sending, the calendar read only.
	narrowed map[integrations.Provider]bool
	// bigDrive lists providers whose files are larger than the home: the
	// whole drive with an estimate over the room, and folders whose sizes
	// are counted while the person chooses, once "count" says so.
	bigDrive map[integrations.Provider]bool
	count    chan struct{}
}

var integrationFixture = &integrationControl{approve: make(chan struct{}, 1), count: make(chan struct{}), expired: map[integrations.Provider]bool{}, narrowed: map[integrations.Provider]bool{}, bigDrive: map[integrations.Provider]bool{}}

// The big drive's folders as the stand-in counts them: the whole 60 GiB
// against the fixture home's 34.7 GB of room, photos alone too large.
var bigDriveSizes = map[string]uint64{"all": 60 << 30, "work": 3 << 30, "photos": 40 << 30}

func (c *integrationControl) set(q url.Values) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	switch q.Get("action") {
	case "approve":
		select {
		case c.approve <- struct{}{}:
		default:
		}
	case "outcome":
		c.outcome = q.Get("value")
	case "expire":
		c.expired[integrations.Provider(q.Get("provider"))] = true
	case "narrow":
		c.narrowed[integrations.Provider(q.Get("provider"))] = true
	case "bigdrive":
		c.bigDrive[integrations.Provider(q.Get("provider"))] = true
	case "count":
		close(c.count)
		c.count = make(chan struct{})
	case "reset":
		c.outcome, c.expired, c.narrowed, c.bigDrive = "", map[integrations.Provider]bool{}, map[integrations.Provider]bool{}, map[integrations.Provider]bool{}
	default:
		return false
	}
	return true
}

func fixtureIntegrations(home, repoRoot, self string, gitea *giteafake.Server, gitlab *gitlabfake.Server) (*integrations.Catalog, daemon.Forges) {
	tools := map[string]string{"himalaya": filepath.Join(repoRoot, "test/fixtures/integrations/himalaya"), "curl": filepath.Join(repoRoot, "test/fixtures/integrations/curl"), "pi": filepath.Join(repoRoot, "test/fixtures/integrations/pi-mcp")}
	rclone := filepath.Join(repoRoot, "test/fixtures/integrations/rclone")
	env := integrations.Env{Home: home, FixtureTools: true,
		// The production Dropbox entry observes the broker's file on demand,
		// as the daemon does.
		LoadConfig: func() (integrations.Config, error) {
			c := appFixture.config(tools, rclone)
			// tea is offered only while /fixture/gitea has enabled it.
			if giteaEnabled.Load() {
				c.Tools["tea"] = "/usr/bin/true"
			}
			// glab likewise while /fixture/gitlab has enabled it.
			if gitlabEnabled.Load() {
				c.Tools["glab"] = "/usr/bin/true"
			}
			return c, nil
		},
		// Synthetic DAV names resolve to a documentation address the fixture
		// curl never dials.
		Resolve: func(context.Context, string) ([]netip.Addr, error) {
			return []netip.Addr{netip.MustParseAddr("192.0.2.10")}, nil
		}}
	// Provider stand-ins must replace, not shadow behind, native entries as
	// those ship. Catalog selection is by provider, with the first entry winning.
	entries := slices.DeleteFunc(integrations.Production(), func(e integrations.Entry) bool {
		return e.Provider() == integrations.Google || e.Provider() == integrations.Microsoft
	})
	entries = append(entries,
		&levelFixture{&fixtureEntry{provider: integrations.Google, login: integrations.PastedRedirect, services: []string{"mail", "calendar", "contacts", "drive"}, files: "drive", dir: "google-drive",
			addresses: []string{"person.home@example.test", "person.second@example.test"},
			folders:   []integrations.Folder{{ID: "own", Name: "Oma Drive", Bytes: 4617089843, Suggested: true}, {ID: "shared", Name: "Jaettu kanssani", Bytes: 1932735283, Suggested: true}, {ID: "photos", Name: "Kuvat", Bytes: 33500744908}}},
			googleLevels},
		&levelFixture{&fixtureEntry{provider: integrations.Microsoft, login: integrations.DeviceCode, services: []string{"mail", "calendar", "contacts", "onedrive"}, files: "onedrive", dir: "onedrive",
			addresses: []string{"person@work.example.test", "person.second@work.example.test"},
			folders:   []integrations.Folder{{ID: "me", Name: "OneDrive – Esimerkki Oy", Bytes: 4509715660, Suggested: true}, {ID: "sales", Name: "SharePoint · Myynti › Asiakirjat", Bytes: 1932735283, Suggested: true}, {ID: "admin", Name: "SharePoint · Hallinto › Sopimukset", Bytes: 644245094}}},
			microsoftLevels},
	)
	// The prototype's home: 50 GB quota with 15.3 GB of other files.
	room := func() integrations.Room {
		return integrations.Room{Free: 50<<30 - 16428249907, Limit: 50 << 30, OK: true}
	}
	adapter := giteaFixtureAdapter(env, gitea, self)
	opts := []integrations.Option{integrations.WithQuota(room), integrations.WithTrash(func(rel string) error {
		return daemon.TrashCloudDirectory(home, rel)
	})}
	if adapter != nil {
		opts = append(opts, integrations.WithGitea(adapter))
	}
	gl := gitlabFixtureAdapter(env, gitlab, self)
	if gl != nil {
		opts = append(opts, integrations.WithGitLab(gl))
	}
	return integrations.New(env, entries, nil, opts...), daemon.Forges{Gitea: adapter, GitLab: gl}
}

type fixtureEntry struct {
	provider  integrations.Provider
	login     integrations.LoginKind
	services  []string
	files     string
	dir       string
	addresses []string
	folders   []integrations.Folder
}

func (f *fixtureEntry) store(env integrations.Env) string {
	return filepath.Join(env.Home, ".config/fixture-integrations", string(f.provider))
}

func (f *fixtureEntry) Provider() integrations.Provider     { return f.provider }
func (f *fixtureEntry) Login() integrations.LoginKind       { return f.login }
func (f *fixtureEntry) Services() []string                  { return f.services }
func (f *fixtureEntry) Available(env integrations.Env) bool { return f.AppConfigured(env) }

// The stand-ins need the operator's app as the native entries do; their
// "tools" are always there.
func (f *fixtureEntry) ToolsInstalled(integrations.Env) bool { return true }
func (f *fixtureEntry) AppConfigured(integrations.Env) bool {
	return appFixture.set(string(f.provider))
}
func (f *fixtureEntry) Accounts(env integrations.Env) ([]string, error) {
	entries, err := os.ReadDir(f.store(env))
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	var out []string
	for _, e := range entries {
		out = append(out, e.Name())
	}
	return out, err
}

func (f *fixtureEntry) Check(ctx context.Context, env integrations.Env, address string) []integrations.Service {
	// A tool's status call takes a moment; the page shows "Tarkistetaan".
	select {
	case <-time.After(300 * time.Millisecond):
	case <-ctx.Done():
	}
	integrationFixture.mu.Lock()
	expired := integrationFixture.expired[f.provider]
	integrationFixture.mu.Unlock()
	_, chosen := f.SyncCommand(env, address)
	var out []integrations.Service
	for _, s := range f.services {
		state, failure := integrations.StateOK, ""
		if expired {
			state = integrations.StateLoginExpired
		} else if s == f.files && !chosen && f.big() {
			// As the native entry says of files that never had a first pass.
			state, failure = integrations.StateSyncFailed, integrations.FoldersNotChosen
		}
		out = append(out, integrations.Service{ID: s, State: state, Failure: failure})
	}
	return out
}

// CheckGrant reports a narrower grant only while the fixture narrows it;
// otherwise the grant is not read, as with an unreadable native store.
func (f *fixtureEntry) CheckGrant(ctx context.Context, env integrations.Env, address string) ([]integrations.Service, *integrations.Grant) {
	out := f.Check(ctx, env, address)
	integrationFixture.mu.Lock()
	narrowed := integrationFixture.narrowed[f.provider]
	integrationFixture.mu.Unlock()
	if !narrowed {
		return out, nil
	}
	access := map[string]integrations.Access{f.files: integrations.AccessNone, "mail": integrations.AccessDrafts, "calendar": integrations.AccessRead, "contacts": integrations.AccessFull}
	for i := range out {
		out[i].Access = access[out[i].ID]
		if out[i].Access == integrations.AccessNone {
			out[i].State = integrations.StateUnknown
		}
	}
	return out, &integrations.Grant{Granted: []string{"Calendars.Read", "Contacts.ReadWrite", "Mail.ReadWrite", "User.Read"}, NotGranted: []string{"Calendars.ReadWrite", "Files.ReadWrite.All", "Mail.Send", "Sites.ReadWrite.All"}}
}

func (f *fixtureEntry) Remove(_ context.Context, env integrations.Env, address string) error {
	return os.Remove(filepath.Join(f.store(env), address))
}

func (f *fixtureEntry) Skill(_ integrations.Env, address string) integrations.SkillAccount {
	return integrations.SkillAccount{Label: "synthetic " + string(f.provider), Kinds: []string{"mail", "calendar", "contacts", "files"}, Synced: true,
		Body: "Synthetic fixture account; files in `~/cloud/" + f.dir + "/" + address + "/`."}
}

func (f *fixtureEntry) Directories(env integrations.Env, address string) []integrations.SyncDirectory {
	// As the native Microsoft entry: only files an earlier release left
	// syncing have a directory (seedAgentFiles); the rest are searched.
	if _, synced := f.SyncCommand(env, address); f.provider == integrations.Microsoft && !synced {
		return nil
	}
	return []integrations.SyncDirectory{{Service: f.files, Path: "cloud/" + f.dir + "/" + address}}
}

// FolderChoiceAfterLogin follows the native entries: Microsoft offers no
// folder step, since agents search its files; the others offer one until
// their files sync.
func (f *fixtureEntry) FolderChoiceAfterLogin(env integrations.Env, address string) (bool, error) {
	if f.provider == integrations.Microsoft {
		return false, nil
	}
	_, synced := f.SyncCommand(env, address)
	return !synced, nil
}

func (f *fixtureEntry) SyncCommand(env integrations.Env, address string) (integrations.Command, bool) {
	b, err := os.ReadFile(filepath.Join(f.store(env), address))
	if err != nil || len(b) == 0 {
		return integrations.Command{}, false
	}
	// A stand-in sync client: it keeps the directory and stays running,
	// under the product daemon's UMask=0077.
	dir := filepath.Join(env.Home, "cloud", f.dir, address)
	return integrations.Command{Path: "/bin/sh", Args: []string{"-c", `umask 077 && mkdir -p "$1" && exec sleep 86400`, "sync", dir}}, true
}

func (f *fixtureEntry) big() bool {
	integrationFixture.mu.Lock()
	defer integrationFixture.mu.Unlock()
	return integrationFixture.bigDrive[f.provider]
}

func (f *fixtureEntry) Folders(context.Context, integrations.Env, string) ([]integrations.Folder, error) {
	if f.big() {
		return []integrations.Folder{
			{ID: "all", Name: "Koko Google Drive", Bytes: 62 << 30, Estimated: true, Whole: true, Suggested: true},
			{ID: "work", Name: "Työ", UnknownSize: true},
			{ID: "photos", Name: "Kuvat", UnknownSize: true},
		}, nil
	}
	return f.folders, nil
}

// SizeFolders counts the big drive's folders once the test says "count".
func (f *fixtureEntry) SizeFolders(ctx context.Context, _ integrations.Env, _ string, report func(string, uint64)) {
	if !f.big() {
		return
	}
	integrationFixture.mu.Lock()
	count := integrationFixture.count
	integrationFixture.mu.Unlock()
	select {
	case <-count:
	case <-ctx.Done():
		return
	}
	for _, id := range []string{"work", "photos", "all"} {
		report(id, bigDriveSizes[id])
	}
}

// MeasureFolders is the count after a choice made before SizeFolders
// finished.
func (f *fixtureEntry) MeasureFolders(_ context.Context, _ integrations.Env, _ string, ids []string) (uint64, error) {
	sizes := bigDriveSizes
	if !f.big() {
		sizes = map[string]uint64{}
		for _, folder := range f.folders {
			sizes[folder.ID] = folder.Bytes
		}
	}
	var total uint64
	for _, id := range ids {
		n, ok := sizes[id]
		if !ok {
			return 0, integrations.ToolFailed
		}
		total += n
	}
	return total, nil
}

func (f *fixtureEntry) ChooseFolders(_ context.Context, env integrations.Env, address string, ids []string) error {
	return os.WriteFile(filepath.Join(f.store(env), address), []byte(strings.Join(ids, "\n")), 0o600)
}

func (f *fixtureEntry) StartLogin(ctx context.Context, env integrations.Env, address string) (integrations.Login, error) {
	if err := os.MkdirAll(f.store(env), 0o700); err != nil {
		return nil, err
	}
	if address == "" {
		existing, _ := f.Accounts(env)
		for _, a := range f.addresses {
			if !slices.Contains(existing, a) {
				address = a
				break
			}
		}
	}
	if address == "" {
		return nil, integrations.ToolFailed
	}
	return &fixtureLogin{entry: f, env: env, address: address, pasted: make(chan string, 1)}, nil
}

type fixtureLogin struct {
	entry   *fixtureEntry
	env     integrations.Env
	address string
	pasted  chan string
	// level is the account level the stand-in grants (levelFixture).
	level integrations.Level
}

func (l *fixtureLogin) Prompt(context.Context) (integrations.Prompt, error) {
	if l.entry.login == integrations.DeviceCode {
		integrationFixture.mu.Lock()
		outcome := integrationFixture.outcome
		integrationFixture.mu.Unlock()
		switch outcome {
		case "consent":
			return integrations.Prompt{}, integrations.ConsentRequired{URL: "https://login.microsoftonline.com/esimerkki.onmicrosoft.com/v2.0/adminconsent?client_id=00000000-0000-0000-0000-00000000feed"}
		case "blocked":
			return integrations.Prompt{}, integrations.DeviceCodeBlocked
		}
		return integrations.Prompt{VerificationURI: "https://login.microsoft.com/device", UserCode: "K7QM2PXDW", ExpiresAt: time.Now().Add(15 * time.Minute)}, nil
	}
	return integrations.Prompt{AuthorizationURL: "https://accounts.example.test/o/oauth2/auth?client_id=fixture&state=lab", RedirectPrefix: "http://127.0.0.1", ExpiresAt: time.Now().Add(5 * time.Minute)}, nil
}

func (l *fixtureLogin) Redirect(_ context.Context, raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Query().Get("state") != "lab" {
		// The real tools refuse a foreign state and end the login.
		return integrations.RedirectRejected
	}
	l.pasted <- raw
	return nil
}

func (l *fixtureLogin) Wait(ctx context.Context) (string, error) {
	if l.entry.login == integrations.DeviceCode {
		select {
		case <-integrationFixture.approve:
		case <-ctx.Done():
			return "", ctx.Err()
		}
	} else {
		select {
		case <-l.pasted:
		case <-ctx.Done():
			return "", ctx.Err()
		}
	}
	// The tool stores its token; the fixture stores an empty record until
	// folders are chosen.
	path := filepath.Join(l.entry.store(l.env), l.address)
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		if err := os.WriteFile(path, nil, 0o600); err != nil {
			return "", err
		}
	}
	if l.level != "" {
		// The stand-in's grant: what the level's application was granted.
		dir := l.entry.store(l.env) + "-level"
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return "", err
		}
		if err := os.WriteFile(filepath.Join(dir, l.address), []byte(l.level), 0o600); err != nil {
			return "", err
		}
	}
	integrationFixture.mu.Lock()
	delete(integrationFixture.expired, l.entry.provider)
	integrationFixture.mu.Unlock()
	return l.address, nil
}

// levelFixture is a stand-in with account levels: each level is offered
// while the broker's file holds its application's section, a level without
// a section is one the provider does not offer, and an account's grant is
// the one its sign-in's level was given.
type levelFixture struct {
	*fixtureEntry
	levels fixtureLevels
}

type fixtureLevels struct {
	// order is the levels the page shows, broadest first.
	order    []integrations.Level
	sections map[integrations.Level]string
	granted  map[integrations.Level][]string
}

var microsoftLevels = fixtureLevels{
	order:    []integrations.Level{integrations.LevelFull, integrations.LevelNoSend, integrations.LevelDrafts, integrations.LevelRead},
	sections: map[integrations.Level]string{integrations.LevelFull: "microsoft", integrations.LevelNoSend: "microsoft_nosend", integrations.LevelDrafts: "microsoft_drafts", integrations.LevelRead: "microsoft_read"},
	granted: map[integrations.Level][]string{
		integrations.LevelFull:   {"Calendars.ReadWrite", "Contacts.ReadWrite", "Files.ReadWrite.All", "Mail.ReadWrite", "Mail.Send", "Sites.ReadWrite.All", "User.Read"},
		integrations.LevelNoSend: {"Calendars.ReadWrite", "Contacts.ReadWrite", "Files.ReadWrite.All", "Mail.ReadWrite", "Sites.ReadWrite.All", "User.Read"},
		integrations.LevelDrafts: {"Calendars.Read", "Contacts.Read", "Files.Read.All", "Mail.ReadWrite", "Sites.Read.All", "User.Read"},
		integrations.LevelRead:   {"Calendars.Read", "Contacts.Read", "Files.Read.All", "Mail.Read", "Sites.Read.All", "User.Read"},
	},
}

// Google's levels share its one application; it has no drafts level.
var googleLevels = fixtureLevels{
	order:    []integrations.Level{integrations.LevelFull, integrations.LevelDrafts, integrations.LevelRead},
	sections: map[integrations.Level]string{integrations.LevelFull: "google", integrations.LevelRead: "google"},
	granted: map[integrations.Level][]string{
		integrations.LevelFull: {"https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/contacts", "https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/gmail.modify"},
		integrations.LevelRead: {"https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/contacts.readonly", "https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/gmail.readonly"},
	},
}

func (f *levelFixture) Levels(integrations.Env) []integrations.LevelOption {
	var out []integrations.LevelOption
	for _, l := range f.levels.order {
		section, offered := f.levels.sections[l]
		switch {
		case !offered:
			out = append(out, integrations.LevelOption{ID: l, Reason: integrations.LevelNotOffered})
		case appFixture.set(section):
			out = append(out, integrations.LevelOption{ID: l, Available: true})
		default:
			out = append(out, integrations.LevelOption{ID: l, Reason: integrations.LevelApplicationMissing})
		}
	}
	return out
}

func (f *levelFixture) Available(env integrations.Env) bool { return f.AppConfigured(env) }
func (f *levelFixture) AppConfigured(env integrations.Env) bool {
	for _, o := range f.Levels(env) {
		if o.Available {
			return true
		}
	}
	return false
}

func (f *levelFixture) levelOf(env integrations.Env, address string) integrations.Level {
	b, err := os.ReadFile(filepath.Join(f.store(env)+"-level", address))
	if err != nil {
		return ""
	}
	return integrations.Level(b)
}

func (f *levelFixture) StartLogin(ctx context.Context, env integrations.Env, address string) (integrations.Login, error) {
	return f.StartLevelLogin(ctx, env, address, "")
}

func (f *levelFixture) StartLevelLogin(ctx context.Context, env integrations.Env, address string, level integrations.Level) (integrations.Login, error) {
	if level == "" && address != "" {
		level = f.levelOf(env, address)
	}
	if level == "" {
		for _, o := range f.Levels(env) {
			if o.Available {
				level = o.ID
				break
			}
		}
	}
	login, err := f.fixtureEntry.StartLogin(ctx, env, address)
	if err == nil {
		login.(*fixtureLogin).level = level
	}
	return login, err
}

// CheckGrant reads a narrowed grant as the plain stand-in does; otherwise
// the grant of the account's level, when its sign-in recorded one.
func (f *levelFixture) CheckGrant(ctx context.Context, env integrations.Env, address string) ([]integrations.Service, *integrations.Grant) {
	out, grant := f.fixtureEntry.CheckGrant(ctx, env, address)
	level := f.levelOf(env, address)
	if grant != nil || level == "" {
		return out, grant
	}
	granted := f.levels.granted[level]
	for i := range out {
		switch {
		case level == integrations.LevelFull:
			out[i].Access = integrations.AccessFull
		case (level == integrations.LevelDrafts || level == integrations.LevelNoSend) && out[i].ID == "mail":
			out[i].Access = integrations.AccessDrafts
		case level == integrations.LevelNoSend:
			out[i].Access = integrations.AccessFull
		default:
			out[i].Access = integrations.AccessRead
		}
	}
	return out, &integrations.Grant{Granted: granted, NotGranted: []string{}}
}

func (f *levelFixture) Remove(ctx context.Context, env integrations.Env, address string) error {
	_ = os.Remove(filepath.Join(f.store(env)+"-level", address))
	return f.fixtureEntry.Remove(ctx, env, address)
}

func (f *levelFixture) Level(env integrations.Env, address string, services []integrations.Service) integrations.Level {
	level := f.levelOf(env, address)
	for _, s := range services {
		if s.Access == "" || s.Access == integrations.AccessNone {
			return ""
		}
	}
	return level
}

func (l *fixtureLogin) Cancel() {}

// seedAgentFiles connects the stand-in Microsoft account at the Täysi level
// with its OneDrive chosen, and puts a few files, one of them an agent's, in
// its synced folder, for Agentin käytössä (agent-resources-view). A link out
// of the folder and a pipe show that the folder read lists neither.
func seedAgentFiles(home string) error {
	const address = "person@work.example.test"
	store := filepath.Join(home, ".config/fixture-integrations/microsoft")
	for _, dir := range []string{store, store + "-level"} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return err
		}
	}
	if err := os.WriteFile(filepath.Join(store, address), []byte("me"), 0o600); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(store+"-level", address), []byte(integrations.LevelFull), 0o600); err != nil {
		return err
	}
	root := filepath.Join(home, "cloud/onedrive", address)
	if err := os.MkdirAll(filepath.Join(root, "Raportit"), 0o700); err != nil {
		return err
	}
	stamp := time.Date(2026, 11, 5, 9, 30, 0, 0, time.UTC)
	for name, body := range map[string]string{
		"Projektisuunnitelma.docx": strings.Repeat("x", 86016),
		"Raportit/viikko-45.md":    "# Viikko 45\n",
		"Raportit/viikko-46.md":    "# Viikko 46 (agentin luonnos)\n",
	} {
		path := filepath.Join(root, name)
		if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
			return err
		}
		if err := os.Chtimes(path, stamp, stamp); err != nil {
			return err
		}
	}
	_ = os.Remove(filepath.Join(root, "avaimet"))
	if err := os.Symlink(filepath.Join(home, ".ssh"), filepath.Join(root, "avaimet")); err != nil {
		return err
	}
	return nil
}
