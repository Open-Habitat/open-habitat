package main

import (
	"context"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/daemon/integrations"
)

// The synthetic host's integration catalog is the product's IMAP entry run
// against test/fixtures/integrations/himalaya, plus a Google entry with a
// pasted redirect and a Microsoft entry with a device code. Those two stand in
// for entries that are not built yet, so the browser relays, the folder
// choice and sync supervision can be exercised end to end; they never ship.
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
}

var integrationFixture = &integrationControl{approve: make(chan struct{}, 1), expired: map[integrations.Provider]bool{}}

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
	case "reset":
		c.outcome, c.expired = "", map[integrations.Provider]bool{}
	default:
		return false
	}
	return true
}

func fixtureIntegrations(home, repoRoot string) *integrations.Catalog {
	env := integrations.Env{Home: home, Config: integrations.Config{Tools: map[string]string{"himalaya": filepath.Join(repoRoot, "test/fixtures/integrations/himalaya")}}, FixtureTools: true}
	entries := append(integrations.Production(),
		&fixtureEntry{provider: integrations.Google, login: integrations.PastedRedirect, services: []string{"mail", "calendar", "contacts", "drive"}, files: "drive", dir: "google-drive",
			addresses: []string{"person.home@example.test", "person.second@example.test"},
			folders:   []integrations.Folder{{ID: "own", Name: "Oma Drive", Bytes: 4617089843, Suggested: true}, {ID: "shared", Name: "Jaettu kanssani", Bytes: 1932735283, Suggested: true}, {ID: "photos", Name: "Kuvat", Bytes: 33500744908}}},
		&fixtureEntry{provider: integrations.Microsoft, login: integrations.DeviceCode, services: []string{"mail", "calendar", "contacts", "onedrive"}, files: "onedrive", dir: "onedrive",
			addresses: []string{"person@work.example.test", "person.second@work.example.test"},
			folders:   []integrations.Folder{{ID: "me", Name: "OneDrive – Esimerkki Oy", Bytes: 4509715660, Suggested: true}, {ID: "sales", Name: "SharePoint · Myynti › Asiakirjat", Bytes: 1932735283, Suggested: true}, {ID: "admin", Name: "SharePoint · Hallinto › Sopimukset", Bytes: 644245094}}},
	)
	// The prototype's home: 50 GB quota with 15.3 GB of other files.
	room := func() integrations.Room {
		return integrations.Room{Free: 50<<30 - 16428249907, Limit: 50 << 30, OK: true}
	}
	return integrations.New(env, entries, nil, integrations.WithQuota(room), integrations.WithTrash(func(rel string) error {
		return os.RemoveAll(filepath.Join(home, rel))
	}))
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

func (f *fixtureEntry) Provider() integrations.Provider { return f.provider }
func (f *fixtureEntry) Login() integrations.LoginKind   { return f.login }
func (f *fixtureEntry) Services() []string              { return f.services }
func (f *fixtureEntry) Available(integrations.Env) bool { return true }
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
	var out []integrations.Service
	for _, s := range f.services {
		state := integrations.StateOK
		if expired {
			state = integrations.StateLoginExpired
		}
		out = append(out, integrations.Service{ID: s, State: state})
	}
	return out
}

func (f *fixtureEntry) Remove(_ context.Context, env integrations.Env, address string) error {
	return os.Remove(filepath.Join(f.store(env), address))
}

func (f *fixtureEntry) Skill(_ integrations.Env, address string) integrations.SkillAccount {
	return integrations.SkillAccount{Label: "synthetic " + string(f.provider), Kinds: []string{"mail", "calendar", "contacts", "files"}, Synced: true,
		Body: "Synthetic fixture account; files in `~/cloud/" + f.dir + "/" + address + "/`."}
}

func (f *fixtureEntry) Directories(_ integrations.Env, address string) []integrations.SyncDirectory {
	return []integrations.SyncDirectory{{Service: f.files, Path: "cloud/" + f.dir + "/" + address}}
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

func (f *fixtureEntry) Folders(context.Context, integrations.Env, string) ([]integrations.Folder, error) {
	return f.folders, nil
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
	integrationFixture.mu.Lock()
	delete(integrationFixture.expired, l.entry.provider)
	integrationFixture.mu.Unlock()
	return l.address, nil
}

func (l *fixtureLogin) Cancel() {}
