//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/integrationapps"
)

// Synthetic organisations: testTenant is the operator's own (Own Ltd),
// clientOne and clientTwo are client organisations.
const (
	clientOne    = "00000000-0000-4000-8000-0000000000c1"
	clientTwo    = "00000000-0000-4000-8000-0000000000c2"
	sharedClient = "00000000-0000-0000-0000-000000000003"
)

// sharedEnv is microsoftEnv with the operator's shared full-level
// application owned by testTenant and the allowed list own, clientOne,
// clientTwo. The own organisation keeps its single-tenant full section.
func sharedEnv(t *testing.T) Env {
	env := microsoftEnv(t)
	env.Config.MicrosoftShared = &MicrosoftApp{ClientID: sharedClient, TenantID: testTenant}
	env.Config.MicrosoftTenants = []integrationapps.Tenant{{ID: clientOne, Label: "Client One"}, {ID: testTenant, Label: "Own Ltd"}, {ID: clientTwo, Label: "Client Two"}}
	return env
}

// anyTenant is the synthetic Entra answering at every tenant's authority,
// recording the authority and client id each device code was asked for.
func anyTenant(t *testing.T, asked *[]string) *microsoft {
	m := syntheticMicrosoft(t, "person@example.test", "")
	base := m.client.Transport
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if strings.Contains(r.URL.Host, "microsoftonline") {
			parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/"), "/", 2)
			if strings.HasSuffix(r.URL.Path, "/devicecode") && asked != nil {
				_ = r.ParseForm()
				*asked = append(*asked, parts[0]+" "+r.Form.Get("client_id"))
			}
			r.URL.Path = "/" + testTenant + "/" + parts[1]
		}
		return base.RoundTrip(r)
	})
	return m
}

func signInAt(t *testing.T, m *microsoft, env Env, tenant string, level Level) (string, error) {
	t.Helper()
	login, err := m.StartOrganisationLogin(context.Background(), env, "", tenant, level)
	if err != nil {
		return "", err
	}
	l := login.(*microsoftLogin)
	l.interval = time.Millisecond
	defer l.Cancel()
	name, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		return "", err
	}
	return name, l.Commit(context.Background(), name)
}

// The table: each single-tenant section fills its own cell, each allowed
// organisation gets the shared application at every level still empty, the
// operator's own organisation comes first whatever the list's order, and an
// organisation that is not listed gets nothing from the shared ones.
func TestMicrosoftOrganisationTable(t *testing.T) {
	levels := func(org MicrosoftOrganisation) []bool {
		var out []bool
		for _, l := range org.Levels {
			out = append(out, l.Available)
		}
		return out
	}
	t.Run("single-tenant sections only", func(t *testing.T) {
		env := microsoftLevelEnv(t)
		table := env.microsoftTable()
		if len(table.orgs) != 1 || table.orgs[0].TenantID != testTenant || !table.orgs[0].Own || table.orgs[0].Label != "" || !slices.Equal(levels(table.orgs[0]), []bool{true, false, false, true}) {
			t.Fatalf("%+v", table.orgs)
		}
		if !slices.Equal(table.levels(), (&microsoft{}).Levels(microsoftLevelEnv(t))) || table.defaultTenant(LevelRead) != testTenant {
			t.Fatal("levels")
		}
		// Sections at two tenants: each level signs in where its section
		// is, as before organisations could be chosen.
		env.Config.MicrosoftRead = &MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000002", TenantID: strings.ToUpper(clientOne)}
		table = env.microsoftTable()
		if len(table.orgs) != 2 || table.defaultTenant(LevelRead) != clientOne || table.defaultTenant(LevelFull) != testTenant {
			t.Fatalf("%+v", table.orgs)
		}
		// A single-tenant section keeps root's bytes as its authority.
		if app, _ := table.cell(clientOne, LevelRead); app.TenantID != strings.ToUpper(clientOne) {
			t.Fatal(app)
		}
	})
	t.Run("shared and listed", func(t *testing.T) {
		env := sharedEnv(t)
		env.Config.MicrosoftSharedRead = &MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000002", TenantID: testTenant}
		table := env.microsoftTable()
		var ids []string
		for _, o := range table.orgs {
			ids = append(ids, o.TenantID)
		}
		if !slices.Equal(ids, []string{testTenant, clientOne, clientTwo}) || !table.orgs[0].Own || table.orgs[1].Own || table.orgs[1].Label != "Client One" {
			t.Fatalf("order %v %+v", ids, table.orgs)
		}
		// The own organisation's single-tenant section keeps the full level;
		// the shared read application fills its read level.
		if app, _ := table.cell(testTenant, LevelFull); app.ClientID != env.Config.Microsoft.ClientID {
			t.Fatal("own full", app)
		}
		if app, _ := table.cell(testTenant, LevelRead); app.ClientID != "00000000-0000-0000-0000-000000000002" || app.TenantID != testTenant {
			t.Fatal("own read", app)
		}
		// A client signs in at its own authority with the shared client id;
		// a level without a shared application is missing there.
		if app, _ := table.cell(clientOne, LevelFull); app != (MicrosoftApp{ClientID: sharedClient, TenantID: clientOne}) {
			t.Fatal("client full", app)
		}
		if !slices.Equal(levels(table.orgs[1]), []bool{true, false, false, true}) {
			t.Fatalf("client levels %+v", table.orgs[1])
		}
		if _, ok := table.cell("00000000-0000-4000-8000-0000000000dd", LevelFull); ok {
			t.Fatal("an unlisted organisation got the shared application")
		}
	})
	t.Run("owner not listed", func(t *testing.T) {
		env := sharedEnv(t)
		env.Config.Microsoft = nil
		env.Config.MicrosoftTenants = []integrationapps.Tenant{{ID: clientOne, Label: "Client One"}}
		table := env.microsoftTable()
		if len(table.orgs) != 1 || table.orgs[0].TenantID != clientOne || table.orgs[0].Own {
			t.Fatalf("%+v", table.orgs)
		}
	})
	t.Run("operator's file", func(t *testing.T) {
		file := `{"microsoft_shared":{"client_id":"` + sharedClient + `","tenant_id":"` + testTenant + `"},"microsoft_tenants":{"` + strings.ToUpper(clientOne) + `":"Client One"}}`
		cfg, err := parseConfig([]byte(file), nil)
		if err != nil || cfg.MicrosoftShared == nil || len(cfg.MicrosoftTenants) != 1 || cfg.MicrosoftTenants[0].ID != clientOne {
			t.Fatalf("%+v %v", cfg, err)
		}
		// A list the broker would refuse is refused whole; the shared
		// application then serves nobody.
		broken := strings.Replace(file, `"Client One"}`, `"Client One","organizations":"Everyone"}`, 1)
		if cfg, err = parseConfig([]byte(broken), nil); err != nil || cfg.MicrosoftTenants != nil || len((Env{Config: cfg}).microsoftTable().cells) != 0 {
			t.Fatalf("%+v %v", cfg, err)
		}
	})
}

// One address connected in three organisations is three connections: three
// names, three caches, three entry prefixes, each signed in at its own
// organisation's authority, and none overwrites another.
func TestMicrosoftSameAddressInSeveralOrganisations(t *testing.T) {
	env := sharedEnv(t)
	var asked []string
	m := anyTenant(t, &asked)
	var names []string
	snapshots := map[string]string{}
	for _, tenant := range []string{testTenant, clientOne, clientTwo} {
		name, err := signInAt(t, m, env, tenant, "")
		if err != nil || name != microsoftName("person@example.test", tenant) {
			t.Fatal(tenant, name, err)
		}
		names = append(names, name)
		for _, n := range names {
			data, err := os.ReadFile(filepath.Join(env.Home, microsoftMCPDir, n, ".token-cache.json"))
			if err != nil {
				t.Fatal(n, err)
			}
			if before, ok := snapshots[n]; ok && before != string(data) {
				t.Fatal("a later organisation's sign-in changed", n)
			}
			snapshots[n] = string(data)
		}
	}
	if !slices.Equal(asked, []string{testTenant + " " + env.Config.Microsoft.ClientID, clientOne + " " + sharedClient, clientTwo + " " + sharedClient}) {
		t.Fatal("authorities", asked)
	}
	accounts, err := m.Accounts(env)
	if err != nil || len(accounts) != 3 {
		t.Fatal(accounts, err)
	}
	prefixes := map[string]bool{}
	for _, name := range names {
		raw, vars := registeredEntry(t, env, name)
		if vars["MS365_MCP_TENANT_ID"] != microsoftTenantOf(name) {
			t.Fatal("entries name another tenant", name, vars)
		}
		_, servers, _ := microsoftPiServers(env)
		prefixes[microsoftServerIn(env, servers, name).areas["files"]] = true
		if _, err := microsoftBinding(env, name); err != nil {
			t.Fatal("binding", name, err)
		}
		// The agent reads which organisation each prefix is.
		if label := env.microsoftTable().label(microsoftTenantOf(name)); !strings.Contains(raw, "person@example.test ("+label+")") {
			t.Fatal("description", raw)
		}
	}
	if len(prefixes) != 3 {
		t.Fatal("entry prefixes", prefixes)
	}
	// The browser names each by its address and organisation; the address
	// alone is ambiguous and removes nothing. Removing one leaves the
	// others' stores and entries.
	c := New(env, []Entry{m}, nil)
	h := c.Handler(allow)
	_, list, _ := call(t, h, "GET", ListPath, "", nil)
	var tenants []string
	for _, a := range list["accounts"].([]any) {
		tenants = append(tenants, a.(map[string]any)["tenant_id"].(string)+" "+a.(map[string]any)["organisation"].(string))
	}
	if !slices.Equal(tenants, []string{testTenant + " Own Ltd", clientOne + " Client One", clientTwo + " Client Two"}) {
		t.Fatal(tenants)
	}
	remove := map[string]any{"action": "remove", "provider": "microsoft", "address": "person@example.test", "delete_directories": false}
	if code, out, _ := call(t, h, "DELETE", AccountsPath, "", remove); code != 409 || out["error"].(map[string]any)["code"] != "organisation_required" {
		t.Fatal(code, out)
	}
	if code, out, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft", "address": "person@example.test"}); code != 409 || out["error"].(map[string]any)["code"] != "organisation_required" {
		t.Fatal(code, out)
	}
	remove["tenant_id"] = strings.ToUpper(clientOne)
	if code, out, raw := call(t, h, "DELETE", AccountsPath, "", remove); code != 200 || out["removed"].(map[string]any)["tenant_id"] != clientOne {
		t.Fatal(code, raw)
	}
	for _, n := range []string{names[0], names[2]} {
		if data, err := os.ReadFile(filepath.Join(env.Home, microsoftMCPDir, n, ".token-cache.json")); err != nil || string(data) != snapshots[n] {
			t.Fatal("removal touched", n, err)
		}
		if _, err := microsoftBinding(env, n); err != nil {
			t.Fatal("removal unbound", n, err)
		}
	}
}

// A new connection is made only in an organisation the operator's file
// serves at the level: an unlisted organisation and a level it has no
// application for are refused before any request to Microsoft, and the
// browser cannot name an authority.
func TestMicrosoftUnlistedOrganisationIsRefused(t *testing.T) {
	env := sharedEnv(t)
	// The read level exists, at the own organisation only.
	env.Config.MicrosoftRead = &MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000002", TenantID: testTenant}
	unlisted := "00000000-0000-4000-8000-0000000000dd"
	m := offline(t)
	if _, err := m.StartOrganisationLogin(context.Background(), env, "", unlisted, ""); err == nil {
		t.Fatal("signed in at an unlisted organisation")
	}
	if m.OrganisationAvailable(env, unlisted, "") || m.OrganisationAvailable(env, clientOne, LevelRead) || !m.OrganisationAvailable(env, clientOne, "") || !m.OrganisationAvailable(env, strings.ToUpper(clientOne), LevelFull) {
		t.Fatal("availability")
	}
	c := New(env, []Entry{m}, nil)
	h := c.Handler(allow)
	_, list, _ := call(t, h, "GET", ListPath, "", nil)
	orgs := list["providers"].([]any)[0].(map[string]any)["organisations"].([]any)
	if len(orgs) != 3 || orgs[0].(map[string]any)["tenant_id"] != testTenant || orgs[0].(map[string]any)["own"] != true || orgs[1].(map[string]any)["label"] != "Client One" {
		t.Fatal(orgs)
	}
	for _, body := range []map[string]any{
		{"action": "start", "provider": "microsoft", "tenant_id": unlisted},
		{"action": "start", "provider": "microsoft", "tenant_id": clientOne, "level": "read"},
	} {
		if code, out, _ := call(t, h, "POST", LoginPath, ownerA, body); code != 409 || out["error"].(map[string]any)["code"] != "organisation_unavailable" {
			t.Fatal(body, code, out)
		}
	}
	for _, body := range []map[string]any{
		{"action": "start", "provider": "microsoft", "tenant_id": "organizations"},
		{"action": "start", "provider": "microsoft", "tenant_id": "clientone.onmicrosoft.com"},
	} {
		if code, _, _ := call(t, h, "POST", LoginPath, ownerA, body); code != 400 {
			t.Fatal(body, code)
		}
	}
}

// Taking an organisation off the list stops its connections at the next
// call: their tools no longer bind and their card says tenant_removed,
// while their files, the person's other organisations and the grant stay;
// adding it back resumes them without a sign-in.
func TestMicrosoftRemovedOrganisationStopsAndResumes(t *testing.T) {
	env := sharedEnv(t)
	m := anyTenant(t, nil)
	own, err := signInAt(t, m, env, testTenant, "")
	if err != nil {
		t.Fatal(err)
	}
	client, err := signInAt(t, m, env, clientOne, "")
	if err != nil {
		t.Fatal(err)
	}
	mcp := func() string { b, _ := os.ReadFile(filepath.Join(env.Home, ".pi/agent/mcp.json")); return string(b) }
	cache := func() string {
		b, _ := os.ReadFile(filepath.Join(env.Home, microsoftMCPDir, client, ".token-cache.json"))
		return string(b)
	}
	before := cache()
	listed := env.Config.MicrosoftTenants
	env.Config.MicrosoftTenants = []integrationapps.Tenant{listed[1], listed[2]}
	// The entries' description drops the label at the next check; nothing
	// else of them changes and the tenant stays the connection's.
	if !(&microsoft{}).Misaligned(env, client) {
		t.Fatal("a removed label does not rewrite the description")
	}
	c := New(env, []Entry{m}, nil)
	if _, err := microsoftBinding(env, client); err == nil {
		t.Fatal("a removed organisation's tools still bind")
	}
	if _, err := microsoftBinding(env, own); err != nil {
		t.Fatal("the own organisation stopped", err)
	}
	account := c.check(context.Background(), offline(t), client)
	for _, s := range account.Services {
		if s.State != StateLoginExpired || s.Failure != TenantRemoved {
			t.Fatal(account.Services)
		}
	}
	if account.TenantID != clientOne || account.Organisation != "" {
		t.Fatal("account", account.TenantID, account.Organisation)
	}
	if _, err := offline(t).StartLevelLogin(context.Background(), env, client, ""); err == nil {
		t.Fatal("a removed organisation's renewal signed in")
	}
	if cache() != before {
		t.Fatal("removal changed the stored sign-in")
	}
	env.Config.MicrosoftTenants = listed
	c.env = env
	if _, err := microsoftBinding(env, client); err != nil {
		t.Fatal("added back does not bind", err)
	}
	account = c.check(context.Background(), offline(t), client)
	if account.Organisation != "Client One" {
		t.Fatal(account.Organisation)
	}
	for _, s := range account.Services {
		if s.Failure == TenantRemoved {
			t.Fatal("added back still refused", s)
		}
	}
	if !strings.Contains(mcp(), clientOne) {
		t.Fatal("entries lost the organisation")
	}
}

// With one organisation nothing changes: an unlisted single-tenant
// connection's entries and skill name the address alone, as before, and a
// start without an organisation signs in where it did.
func TestMicrosoftSingleOrganisationUnchanged(t *testing.T) {
	env := microsoftEnv(t)
	var asked []string
	m := anyTenant(t, &asked)
	name, err := signInAt(t, m, env, "", "")
	if err != nil || name != testName || !slices.Equal(asked, []string{testTenant + " " + env.Config.Microsoft.ClientID}) {
		t.Fatal(name, err, asked)
	}
	raw, _ := registeredEntry(t, env, name)
	var e struct{ Description string }
	if json.Unmarshal([]byte(raw), &e) != nil || e.Description != strings.ReplaceAll(microsoftAreaDescriptions["files"], "%s", "person@example.test") {
		t.Fatal(raw)
	}
	if s := m.Skill(env, name); s.Label != "Microsoft" {
		t.Fatal(s.Label)
	}
	if m.Misaligned(env, name) {
		t.Fatal("an unchanged installation rewrites its entries")
	}
	c := New(env, []Entry{m}, nil)
	h := c.Handler(allow)
	_, list, _ := call(t, h, "GET", ListPath, "", nil)
	orgs := list["providers"].([]any)[0].(map[string]any)["organisations"].([]any)
	if len(orgs) != 1 || orgs[0].(map[string]any)["label"] != nil {
		t.Fatal(orgs)
	}
	// One connection per address: the browser may still name it by its
	// address alone. A tenant id on another provider is refused.
	if key, err := c.accountKey(m, "person@example.test", ""); err != nil || key != name {
		t.Fatal(key, err)
	}
	if code, _, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "imap", "address": "person@example.test", "tenant_id": testTenant, "delete_directories": false}); code != 400 {
		t.Fatal(code)
	}
}

// Microsoft's answer that the person has no account in the chosen
// organisation, or has not accepted its invitation, is its own refusal.
func TestMicrosoftNotInOrganisation(t *testing.T) {
	for _, code := range []string{"50020", "50034", "90072"} {
		env := microsoftEnv(t)
		m := syntheticMicrosoft(t, "person@example.test", `{"error":"invalid_grant","error_codes":[`+code+`]}`)
		l := msLogin(t, m, env, "")
		if _, err := l.Wait(context.Background()); !errors.Is(err, NotInOrganisation) || loginFailure(err) != "not_in_organisation" {
			t.Fatal(code, err)
		}
	}
}

// A connection an earlier release left syncing stops syncing when its
// organisation is no longer served: the next check stops the running sync
// and reconcile does not start it again; served once more, it resumes.
func TestMicrosoftRemovedOrganisationStopsItsSync(t *testing.T) {
	env := microsoftEnv(t)
	name := connectedSyncing(t, env)
	if err := syntheticMicrosoft(t, "person@example.test", "").testChoose(context.Background(), env, name, []string{"onedrive"}); err != nil {
		t.Fatal(err)
	}
	m := offline(t)
	c := New(env, []Entry{m}, nil)
	k := syncingOneDrive(t, c, env, name)
	served := env.Config
	moved := env.Config
	moved.Microsoft = &MicrosoftApp{ClientID: env.Config.Microsoft.ClientID, TenantID: clientOne}
	env.Config = moved
	c.env = env
	c.check(context.Background(), m, name)
	if c.sync.supervised(k) {
		t.Fatal("a removed organisation still syncs after a check")
	}
	c.write.Lock()
	c.reconcile()
	c.write.Unlock()
	if c.sync.supervised(k) {
		t.Fatal("reconcile restarted a removed organisation's sync")
	}
	env.Config = served
	c.env = env
	c.write.Lock()
	c.reconcile()
	c.write.Unlock()
	if !c.sync.supervised(k) {
		t.Fatal("served again, the sync did not resume")
	}
}
