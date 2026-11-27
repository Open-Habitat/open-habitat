//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestMicrosoftNames(t *testing.T) {
	for _, tc := range []struct {
		name, address, tenant string
		ok                    bool
	}{
		{"person@example.test~" + testTenant, "person@example.test", testTenant, true},
		{"person@example.test~" + strings.ToUpper(testTenant), "", "", false},
		{"person@example.test", "", "", false},
		{"person@example.test~common", "", "", false},
		{"person@example.test~organizations", "", "", false},
		{"person@example.test~contoso.test", "", "", false},
		{"Person@example.test~" + testTenant, "", "", false},
		{"person@example.test~" + testTenant + "~" + testTenant, "", "", false},
		{"~" + testTenant, "", "", false},
		{"person@example.test~" + testTenant + "/x", "", "", false},
	} {
		address, tenant, ok := microsoftSplitName(tc.name)
		if ok != tc.ok || address != tc.address || tenant != tc.tenant {
			t.Errorf("%q: %q %q %v", tc.name, address, tenant, ok)
		}
	}
	// A name is never an address, and an address carrying a GUID is not a
	// name: the two cannot imitate each other.
	if ValidAddress(testName) || validMicrosoftName("person"+testTenant+"@example.test") {
		t.Fatal("name and address overlap")
	}
	if got := microsoftName("Person@Example.test", strings.ToUpper(testTenant)); got != testName {
		t.Fatal(got)
	}
	if microsoftName("person@example.test", "common") != "" {
		t.Fatal("audience keyword named a connection")
	}
}

// signIn connects the synthetic person with the given Graph identity and
// adapter answer, returning the name or the refusal.
func signIn(t *testing.T, env Env, me, expected string) (string, error) {
	t.Helper()
	m := syntheticMicrosoft(t, "person@example.test", "")
	if me != "" {
		base := m.client.Transport
		m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
			if r.URL.Host == "graph.microsoft.com" && r.URL.Path == "/v1.0/me" {
				return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(me))}, nil
			}
			return base.RoundTrip(r)
		})
	}
	l := msLogin(t, m, env, expected)
	// As the catalog's login driver does, a finished attempt cancels.
	defer l.Cancel()
	name, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		return "", err
	}
	return name, l.Commit(context.Background(), name)
}

func importAnswer(t *testing.T, env Env, tenant, local, home string) {
	t.Helper()
	data, _ := json.Marshal(map[string]any{"success": true, "account": map[string]string{"tenant_id": tenant, "local_account_id": local, "home_account_id": home}})
	if err := os.WriteFile(filepath.Join(env.Home, "import-account"), data, 0600); err != nil {
		t.Fatal(err)
	}
}

// Who signed in is decided by Microsoft's immutable identifiers: MSAL's
// account must be in the chosen tenant and be the object Graph named for
// the same token, and a connection's pin is its homeAccountId.
func TestMicrosoftSignInPinsImmutableIdentity(t *testing.T) {
	t.Run("pin written", func(t *testing.T) {
		env := microsoftEnv(t)
		name, err := signIn(t, env, "", "")
		if err != nil || name != testName {
			t.Fatal(name, err)
		}
		_, registered := registeredEntry(t, env, name)
		if registered[microsoftHomeEnv] != testHome || registered[microsoftUsernameEnv] != "" || !strings.HasSuffix(registered["MS365_MCP_TOKEN_CACHE_PATH"], "/"+testName+"/.token-cache.json") {
			t.Fatal(registered)
		}
		b, err := microsoftBinding(env, name)
		if err != nil || !slices.Contains(b.Env, microsoftHomeEnv+"="+testHome) || slices.ContainsFunc(b.Env, func(e string) bool { return strings.HasPrefix(e, microsoftUsernameEnv+"=") }) {
			t.Fatal(b.Env, err)
		}
		// Verification and refresh find the account by the pin.
		if s := (&microsoft{}).Check(context.Background(), env, name); s[len(s)-1].State != StateOK {
			t.Fatal(s)
		}
		payload, _ := os.ReadFile(filepath.Join(env.Home, "verify-payload"))
		var request map[string]any
		if json.Unmarshal(payload, &request) != nil || request["home_account_id"] != testHome || request["address"] != nil || request["tenant_id"] != testTenant {
			t.Fatalf("verify request %s", payload)
		}
	})
	for _, tc := range []struct {
		name, tenant, local string
	}{
		{"another tenant", "00000000-0000-4000-8000-0000000000bb", testObjectID},
		{"another object", testTenant, "00000000-0000-4000-8000-0000000000f9"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := microsoftEnv(t)
			importAnswer(t, env, tc.tenant, tc.local, tc.local+"."+tc.tenant)
			if _, err := signIn(t, env, "", ""); !errors.Is(err, AccountMismatch) {
				t.Fatal(err)
			}
			if a, _ := (&microsoft{}).Accounts(env); len(a) != 0 {
				t.Fatal("refused sign-in left a connection", a)
			}
		})
	}
	// A guest's UPN is not address-shaped and their mail may differ from
	// MSAL's username or be empty: the label falls back, nothing compares.
	for _, tc := range []struct{ name, me, label string }{
		{"guest with mail", `{"id":"` + testObjectID + `","userPrincipalName":"person_home.example#EXT#@example.test","mail":"person@home.example"}`, "person@home.example"},
		{"guest without mail", `{"id":"` + testObjectID + `","userPrincipalName":"person_home.example#EXT#@example.test","mail":null}`, "guest@home.example"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := microsoftEnv(t)
			m := syntheticMicrosoft(t, "person@example.test", "")
			base := m.client.Transport
			m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
				if r.URL.Host == "graph.microsoft.com" && r.URL.Path == "/v1.0/me" {
					return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(tc.me))}, nil
				}
				res, err := base.RoundTrip(r)
				if err == nil && strings.HasSuffix(r.URL.Path, "/token") {
					body, _ := io.ReadAll(res.Body)
					var token map[string]any
					json.Unmarshal(body, &token)
					token["id_token"] = "e30." + base64.RawURLEncoding.EncodeToString([]byte(`{"preferred_username":"Guest@home.example"}`)) + ".sig"
					body, _ = json.Marshal(token)
					res.Body = io.NopCloser(bytes.NewReader(body))
				}
				return res, err
			})
			l := msLogin(t, m, env, "")
			name, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
			if err != nil || name != microsoftName(tc.label, testTenant) {
				t.Fatal(name, err)
			}
			if err := l.Commit(context.Background(), name); err != nil {
				t.Fatal(err)
			}
		})
	}
}

// A renewal must be the pinned account, and keeps the connection's name
// even when Microsoft renamed the user; a new sign-in to an existing name
// that is another account changes nothing.
func TestMicrosoftRenewalComparesThePin(t *testing.T) {
	env := microsoftEnv(t)
	name, err := signIn(t, env, "", "")
	if err != nil {
		t.Fatal(err)
	}
	cache := filepath.Join(env.Home, microsoftMCPDir, name, ".token-cache.json")
	before, _ := os.ReadFile(cache)
	renamed := `{"id":"` + testObjectID + `","userPrincipalName":"renamed@example.test","mail":"renamed@example.test"}`
	if got, err := signIn(t, env, renamed, name); err != nil || got != name {
		t.Fatal("renewal after a rename", got, err)
	}
	other := "00000000-0000-4000-8000-0000000000f9"
	importAnswer(t, env, testTenant, other, other+"."+testTenant)
	otherMe := `{"id":"` + other + `","userPrincipalName":"person@example.test"}`
	if _, err := signIn(t, env, otherMe, name); !errors.Is(err, AccountMismatch) {
		t.Fatal("renewal as another account", err)
	}
	if _, err := signIn(t, env, otherMe, ""); !errors.Is(err, AlreadyConnected) {
		t.Fatal("new sign-in over another account's name", err)
	}
	if _, registered := registeredEntry(t, env, name); registered[microsoftHomeEnv] != testHome {
		t.Fatal("refused sign-in changed the pin", registered)
	}
	if after, _ := os.ReadFile(cache); string(after) != string(before) {
		t.Fatal("refused sign-in replaced the cache")
	}
}

// A connection signed in before immutable pins is compared by address at
// its next sign-in and gains the pin there.
func TestMicrosoftUsernamePinnedConnectionGainsTheImmutablePin(t *testing.T) {
	env := microsoftEnv(t)
	name, err := signIn(t, env, "", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, name, "User.Read", microsoftPin{username: "person@example.test"}); err != nil {
		t.Fatal(err)
	}
	other := `{"id":"` + testObjectID + `","userPrincipalName":"other@example.test"}`
	if _, err := signIn(t, env, other, name); !errors.Is(err, AccountMismatch) {
		t.Fatal("username pin not compared", err)
	}
	if _, err := signIn(t, env, "", name); err != nil {
		t.Fatal(err)
	}
	if _, registered := registeredEntry(t, env, name); registered[microsoftHomeEnv] != testHome || registered[microsoftUsernameEnv] != "" {
		t.Fatal(registered)
	}
}

// The same address at another organisation is another connection, never
// a replacement of the first; a level change of a connection keeps its
// organisation, so a level whose application is elsewhere is refused.
func TestMicrosoftAnotherOrganisationIsAnotherConnection(t *testing.T) {
	env := microsoftLevelEnv(t)
	other := "00000000-0000-4000-8000-0000000000bb"
	env.Config.MicrosoftRead = &MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000002", TenantID: other}
	if _, err := signIn(t, env, "", ""); err != nil {
		t.Fatal(err)
	}
	m := syntheticMicrosoft(t, "person@example.test", "")
	base := m.client.Transport
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		r.URL.Path = strings.Replace(r.URL.Path, "/"+other+"/", "/"+testTenant+"/", 1)
		return base.RoundTrip(r)
	})
	login, err := m.StartLevelLogin(context.Background(), env, "", LevelRead)
	if err != nil {
		t.Fatal(err)
	}
	l := login.(*microsoftLogin)
	l.interval = time.Millisecond
	t.Cleanup(l.Cancel)
	name, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil || name != "person@example.test~"+other {
		t.Fatal(name, err)
	}
	if err := l.Commit(context.Background(), name); err != nil {
		t.Fatal(err)
	}
	if a, _ := m.Accounts(env); !slices.Equal(a, []string{testName, name}) {
		t.Fatal(a)
	}
	if _, err := m.StartLevelLogin(context.Background(), env, testName, LevelRead); err == nil {
		t.Fatal("a level change moved the connection to another tenant")
	}
}

// preNames puts a named connection's stores and entries back in the form
// before names, as an earlier release left them: everything named by the
// address, the entries pinned by username.
func preNames(t *testing.T, env Env, name string) {
	t.Helper()
	address := microsoftAddressOf(name)
	for _, s := range microsoftNameStores {
		from, to := filepath.Join(env.Home, s.dir, s.entry(name)), filepath.Join(env.Home, s.dir, s.entry(address))
		if err := os.Rename(from, to); err != nil && !errors.Is(err, fs.ErrNotExist) {
			t.Fatal(err)
		}
	}
	path := filepath.Join(env.Home, ".pi/agent/mcp.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	text := strings.ReplaceAll(string(data), name, address)
	text = strings.ReplaceAll(text, `"`+microsoftHomeEnv+`": "`+testHome+`"`, `"`+microsoftUsernameEnv+`": "`+address+`"`)
	if err := os.WriteFile(path, []byte(text), 0600); err != nil {
		t.Fatal(err)
	}
	// The listings' stale lock names its session by the old path.
	work := filepath.Join(env.Home, microsoftWork(address, "onedrive"))
	session := filepath.Join(work, "local.."+microsoftAccount+"_")
	if err := os.WriteFile(session+".lck", []byte(`{"Session":"`+session+`","PID":"0","TimeExpires":"2001-01-01T00:00:00Z"}`), 0600); err != nil {
		t.Fatal(err)
	}
}

// installedBeforeNames is a connection from before names with every store
// an earlier release can leave: a cache, an interrupted sign-in's pending
// cache and a rollback copy, an rclone config with OneDrive syncing, its
// listings and first-sync backups, a kept first-pass refusal, and Pi entries.
func installedBeforeNames(t *testing.T, env Env) {
	t.Helper()
	m := syntheticMicrosoft(t, "person@example.test", "")
	name := connectedSyncing(t, env)
	if err := m.testChoose(context.Background(), env, name, []string{"onedrive"}); err != nil {
		t.Fatal(err)
	}
	for _, rel := range []string{microsoftMCPDir + "/.pending/" + name, microsoftMCPDir + "/.previous/" + name, ".local/share/rclone/microsoft-backups/" + name + "/onedrive"} {
		if err := os.MkdirAll(filepath.Join(env.Home, rel), 0700); err != nil {
			t.Fatal(err)
		}
		os.WriteFile(filepath.Join(env.Home, rel, ".token-cache.json"), []byte("kept "+rel), 0600)
	}
	synced := filepath.Join(env.Home, "cloud/onedrive", microsoftAddressOf(name))
	if err := os.MkdirAll(synced, 0700); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(synced, "offer.docx"), []byte("synced file"), 0600)
	if err := os.MkdirAll(filepath.Join(env.Home, refusalDir), 0700); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(env.Home, refusalDir, "microsoft-"+name+".json"), []byte(`{"failure":"quota_unavailable"}`), 0600)
	preNames(t, env, name)
}

// snapshotHome is every file under the home with its bytes, except the test's
// own markers.
func snapshotHome(t *testing.T, env Env) map[string]string {
	t.Helper()
	out := map[string]string{}
	filepath.WalkDir(env.Home, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(env.Home, path)
		if !(strings.HasPrefix(rel, ".") || strings.HasPrefix(rel, "cloud/")) || strings.HasPrefix(rel, ".local/state/open-habitat/sync-at-boot") || strings.HasPrefix(rel, ".agents/") {
			return nil
		}
		data, _ := os.ReadFile(path)
		out[rel] = string(data)
		return nil
	})
	return out
}

// The upgrade renames a connection's stores and entries to its name without
// a sign-in: nothing is copied, tokens and listings keep their bytes, the
// synced directory stays and needs no first sync, a running conversation's
// relay still reaches it, and running the migration again changes nothing.
func TestMicrosoftNameMigrationAtUpgrade(t *testing.T) {
	env := microsoftEnv(t)
	installedBeforeNames(t, env)
	address := "person@example.test"
	before := snapshotHome(t, env)
	var logs lockedBuffer
	m := &microsoft{}
	c := New(env, []Entry{m}, slog.New(slog.NewJSONHandler(&logs, nil)), WithQuota(func() Room { return Room{Free: 1 << 30, OK: true} }))
	c.write.Lock()
	m.migrateNames(context.Background(), env, c.log)
	c.write.Unlock()
	if !strings.Contains(logs.String(), `"outcome":"completed","change":"connection_name"`) {
		t.Fatal(logs.String())
	}
	after := snapshotHome(t, env)
	synced := 0
	for rel, data := range before {
		if strings.HasPrefix(rel, "cloud/") {
			synced++
			if after[rel] != data {
				t.Errorf("synced file %s moved", rel)
			}
			continue
		}
		moved := strings.Replace(rel, address, testName, 1)
		if rel == ".pi/agent/mcp.json" || strings.HasSuffix(rel, ".lck") {
			continue
		}
		if got, ok := after[moved]; !ok || got != data {
			t.Errorf("%s did not move to %s unchanged", rel, moved)
		}
	}
	if synced == 0 {
		t.Fatal("fixture: nothing synced")
	}
	for rel := range after {
		if strings.Contains(rel, address+"/") && !strings.Contains(rel, testName) && !strings.HasPrefix(rel, "cloud/") {
			t.Errorf("left under the address: %s", rel)
		}
	}
	lock, _ := os.ReadFile(filepath.Join(env.Home, microsoftWork(testName, "onedrive"), "local.."+microsoftAccount+"_.lck"))
	if !strings.Contains(string(lock), filepath.Join(env.Home, microsoftWork(testName, "onedrive"))) {
		t.Fatal("stale lock names the old session", string(lock))
	}
	accounts, _ := m.Accounts(env)
	if !slices.Equal(accounts, []string{testName}) {
		t.Fatal(accounts)
	}
	_, registered := registeredEntry(t, env, testName)
	if registered[microsoftUsernameEnv] != address || registered[microsoftHomeEnv] != "" {
		t.Fatal("the username pin did not stay until the next sign-in", registered)
	}
	if _, servers, _ := microsoftPiServers(env); servers["ms-files"] == nil || servers["ms2-files"] != nil {
		t.Fatal("entries renamed", servers)
	}
	cmd, ok := m.SyncCommand(env, testName)
	if !ok || slices.Contains(cmd.Args, "--resync") {
		t.Fatal("synced library resyncs", cmd)
	}
	dirs := m.Directories(env, testName)
	if len(dirs) != 1 || dirs[0].Path != "cloud/onedrive/"+address || !strings.Contains(dirs[0].Work, testName) {
		t.Fatal(dirs)
	}
	if body := m.Skill(env, testName).Body; !strings.Contains(body, "~/cloud/onedrive/"+address+"/") || !strings.Contains(body, "microsoft-fetched/"+address+"/") {
		t.Fatal(body)
	}
	if _, ok := c.refusal(key{Microsoft, testName}); !ok {
		t.Fatal("kept refusal did not move")
	}
	// A conversation started before the upgrade runs its relay with the
	// address; it reaches the renamed connection.
	if b, err := microsoftBinding(env, address); err != nil || b.Account != testName {
		t.Fatal(b.Account, err)
	}
	if m.Misaligned(env, testName) {
		t.Fatal("migrated connection still misaligned")
	}
	settled := snapshotHome(t, env)
	m.migrateNames(context.Background(), env, c.log)
	if again := snapshotHome(t, env); fmtMap(again) != fmtMap(settled) {
		t.Fatal("a second run changed the home")
	}
}

func fmtMap(m map[string]string) string {
	data, _ := json.Marshal(m)
	return string(data)
}

// An interruption after any rename, or before the entries were rewritten,
// is finished at the next check from the files alone, to the same result.
func TestMicrosoftNameMigrationFinishesAnInterruptedRun(t *testing.T) {
	reference := func() map[string]string {
		env := microsoftEnv(t)
		installedBeforeNames(t, env)
		(&microsoft{}).migrateNames(context.Background(), env, slog.New(slog.DiscardHandler))
		return relative(snapshotHome(t, env), env.Home)
	}()
	for step := 0; step <= len(microsoftNameStores); step++ {
		env := microsoftEnv(t)
		installedBeforeNames(t, env)
		address := "person@example.test"
		for _, s := range microsoftNameStores[:step] {
			os.Rename(filepath.Join(env.Home, s.dir, s.entry(address)), filepath.Join(env.Home, s.dir, s.entry(testName)))
			if s.dir == microsoftDir {
				os.Rename(filepath.Join(env.Home, microsoftWork(testName, "onedrive"), "local.."+microsoftAccount+"_.lck"), filepath.Join(env.Home, "lock-aside"))
			}
		}
		m := &microsoft{}
		c := New(env, []Entry{m}, nil)
		keys, _ := m.Accounts(env)
		if len(keys) != 1 {
			t.Fatalf("step %d: interrupted connection listed as %v", step, keys)
		}
		// The next check finds the half-moved connection misaligned and
		// Align finishes it.
		if !m.Misaligned(env, keys[0]) {
			t.Fatalf("step %d: not seen as half moved", step)
		}
		c.write.Lock()
		c.align(context.Background(), m, keys[0])
		c.write.Unlock()
		if step == len(microsoftNameStores) {
			os.Rename(filepath.Join(env.Home, "lock-aside"), filepath.Join(env.Home, microsoftWork(testName, "onedrive"), "local.."+microsoftAccount+"_.lck"))
		}
		got := relative(snapshotHome(t, env), env.Home)
		for rel, want := range reference {
			if strings.HasSuffix(rel, ".lck") && step == len(microsoftNameStores) {
				continue
			}
			if got[rel] != want {
				t.Errorf("step %d: %s differs:\n%q\n%q", step, rel, got[rel], want)
			}
		}
		for rel := range got {
			if _, ok := reference[rel]; !ok {
				t.Errorf("step %d: extra %s", step, rel)
			}
		}
	}
}

// relative replaces the home's path inside file contents, so two homes'
// snapshots compare.
func relative(m map[string]string, home string) map[string]string {
	out := map[string]string{}
	for k, v := range m {
		out[k] = strings.ReplaceAll(v, home, "~")
	}
	return out
}

// A bare address whose files name no tenant, or two, is not guessed: it
// stays under the address, asks for a sign-in, can be removed, and a new
// sign-in replaces it.
func TestMicrosoftNameMigrationLeavesAnUnreadableTenant(t *testing.T) {
	for _, disagree := range []bool{false, true} {
		env := microsoftEnv(t)
		installedBeforeNames(t, env)
		address := "person@example.test"
		if disagree {
			conf := filepath.Join(env.Home, microsoftDir, address+".conf")
			data, _ := os.ReadFile(conf)
			os.WriteFile(conf, []byte(strings.ReplaceAll(string(data), "tenant = "+testTenant, "tenant = 00000000-0000-4000-8000-0000000000bb")), 0600)
		} else {
			os.Remove(filepath.Join(env.Home, ".pi/agent/mcp.json"))
			os.Remove(filepath.Join(env.Home, microsoftDir, address+".conf"))
		}
		before := snapshotHome(t, env)
		m := &microsoft{}
		m.migrateNames(context.Background(), env, slog.New(slog.DiscardHandler))
		if fmtMap(snapshotHome(t, env)) != fmtMap(before) {
			t.Fatal("an unreadable tenant was guessed")
		}
		if keys, _ := m.Accounts(env); !slices.Equal(keys, []string{address}) || m.Misaligned(env, address) {
			t.Fatal(keys)
		}
		// It runs nothing and asks for a sign-in: no tool binding, and its
		// grant is not redeemed with any application.
		if _, err := microsoftBinding(env, address); err == nil {
			t.Fatal("an unresolved connection's tools bind")
		}
		c := New(env, []Entry{m}, nil)
		for _, s := range c.check(context.Background(), m, address).Services {
			if s.State != StateLoginExpired {
				t.Fatal("an unresolved connection does not ask for a sign-in", s)
			}
		}
		if exists(filepath.Join(env.Home, "mcp-checked")) {
			t.Fatal("an unresolved connection's grant was verified")
		}
		// The person signs in again from its card: the new connection
		// replaces the leftover.
		if name, err := signIn(t, env, "", address); err != nil || name != testName {
			t.Fatal(name, err)
		}
		if keys, _ := m.Accounts(env); !slices.Equal(keys, []string{testName}) {
			t.Fatal("leftover not replaced", keys)
		}
		for _, s := range microsoftNameStores[:3] {
			if exists(filepath.Join(env.Home, s.dir, s.entry(address))) {
				t.Fatal("leftover store survived", s.dir)
			}
		}
	}
}

// A pass an earlier daemon still runs defers the rename to a later check.
func TestMicrosoftNameMigrationWaitsForARunningPass(t *testing.T) {
	env := microsoftEnv(t)
	installedBeforeNames(t, env)
	address := "person@example.test"
	work := filepath.Join(env.Home, microsoftWork(address, "onedrive"))
	lock := filepath.Join(work, "local.."+microsoftAccount+"_.lck")
	os.WriteFile(lock, []byte(`{"Session":"x","PID":"1","TimeExpires":"2999-01-01T00:00:00Z"}`), 0600)
	m := &microsoft{}
	m.migrateNames(context.Background(), env, slog.New(slog.DiscardHandler))
	if keys, _ := m.Accounts(env); !slices.Equal(keys, []string{address}) {
		t.Fatal("renamed beside a running pass", keys)
	}
	os.Remove(lock)
	c := New(env, []Entry{m}, nil)
	c.check(context.Background(), m, address)
	if keys, _ := m.Accounts(env); !slices.Equal(keys, []string{testName}) {
		t.Fatal("the next check did not rename", keys)
	}
}

// The browser names a connection by its address and organisation, never by
// its name: the listing shows both, and with one connection of the address
// removing it by its address alone removes the named connection with what
// its address left from before names.
func TestMicrosoftBrowserAddressesConnectionsByAddress(t *testing.T) {
	env := microsoftEnv(t)
	name, err := signIn(t, env, "", "")
	if err != nil {
		t.Fatal(err)
	}
	leftover := filepath.Join(env.Home, microsoftMCPDir, ".pending", "person@example.test")
	os.MkdirAll(leftover, 0700)
	os.WriteFile(filepath.Join(leftover, ".token-cache.json"), []byte("interrupted"), 0600)
	m := &microsoft{}
	if keys, _ := m.Accounts(env); !slices.Equal(keys, []string{name}) {
		t.Fatal("leftover listed beside its connection", keys)
	}
	c := New(env, []Entry{m}, nil)
	h := c.Handler(allow)
	code, list, _ := call(t, h, "GET", ListPath, "", nil)
	if code != 200 || !strings.Contains(fmtAny(list["accounts"]), `"address":"person@example.test"`) || !strings.Contains(fmtAny(list["accounts"]), `"tenant_id":"`+testTenant+`"`) || strings.Contains(fmtAny(list), "~") {
		t.Fatal(code, list)
	}
	code, out, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "microsoft", "address": "person@example.test", "delete_directories": false})
	if code != 200 || !strings.Contains(fmtAny(out["removed"]), `"address":"person@example.test"`) || !strings.Contains(fmtAny(out["removed"]), `"tenant_id":"`+testTenant+`"`) {
		t.Fatal(code, out)
	}
	if keys, _ := m.Accounts(env); len(keys) != 0 || exists(leftover) {
		t.Fatal("not removed", keys)
	}
	if code, _, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "microsoft", "address": name, "delete_directories": false}); code != 400 {
		t.Fatal("the browser named a connection by its internal name", code)
	}
}

func fmtAny(v any) string {
	data, _ := json.Marshal(v)
	return string(data)
}

// hookedEntry lets a test act inside a sign-in's Commit, which the catalog
// runs with its write lock held.
type hookedEntry struct {
	*microsoft
	commit func(inner func(context.Context, string) error, ctx context.Context, name string) error
}

func (e *hookedEntry) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	return e.StartLevelLogin(ctx, env, address, "")
}

func (e *hookedEntry) StartLevelLogin(ctx context.Context, env Env, address string, level Level) (Login, error) {
	login, err := e.microsoft.StartLevelLogin(ctx, env, address, level)
	if err != nil {
		return nil, err
	}
	l := login.(*microsoftLogin)
	l.interval = time.Millisecond
	return &hookedLogin{microsoftLogin: l, commit: e.commit}, nil
}

type hookedLogin struct {
	*microsoftLogin
	commit func(inner func(context.Context, string) error, ctx context.Context, name string) error
}

func (h *hookedLogin) Commit(ctx context.Context, name string) error {
	return h.commit(h.microsoftLogin.Commit, ctx, name)
}

// Renewing a connection from before names through the catalog replaces it
// under its name: the old key's sync client is stopped before Commit removes
// its files, and a cancellation once Commit has replaced it keeps the new
// connection, which is then the only copy.
func TestMicrosoftCatalogRenewalReplacesAnUnresolvedConnection(t *testing.T) {
	for _, cancelAfterCommit := range []bool{false, true} {
		env := microsoftEnv(t)
		installedBeforeNames(t, env)
		address := "person@example.test"
		conf := filepath.Join(env.Home, microsoftDir, address+".conf")
		data, _ := os.ReadFile(conf)
		os.WriteFile(conf, []byte(strings.ReplaceAll(string(data), "tenant = "+testTenant, "tenant = 00000000-0000-4000-8000-0000000000bb")), 0600)
		old := key{Microsoft, address}
		var c *Catalog
		stoppedFirst := false
		e := &hookedEntry{microsoft: syntheticMicrosoft(t, "person@example.test", "")}
		e.commit = func(inner func(context.Context, string) error, ctx context.Context, name string) error {
			stoppedFirst = !c.sync.supervised(old)
			err := inner(ctx, name)
			if cancelAfterCommit {
				c.relay.mu.Lock()
				id := c.relay.current().id
				c.relay.mu.Unlock()
				c.cancelLogin(ownerA, id)
			}
			return err
		}
		c = New(env, []Entry{e}, nil, WithQuota(func() Room { return Room{Free: 1 << 30, OK: true} }))
		ctx, cancel := context.WithCancel(context.Background())
		c.Start(ctx)
		if !c.sync.supervised(old) {
			t.Fatal("fixture: the unresolved connection's files do not sync")
		}
		h := c.Handler(allow)
		if code, out, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft", "address": address}); code != 200 {
			t.Fatal(code, out)
		}
		want := "completed"
		if cancelAfterCommit {
			want = "failed"
		}
		waitState(t, h, ownerA, want)
		waitLoginWorker(t, c)
		if !stoppedFirst {
			t.Error("Commit ran beside the replaced connection's sync client")
		}
		if keys, _ := e.Accounts(env); !slices.Equal(keys, []string{testName}) || exists(conf) {
			t.Errorf("cancel %v: not replaced, or the replacement was discarded: %v", cancelAfterCommit, keys)
		}
		cancel()
		c.Stop()
	}
}
