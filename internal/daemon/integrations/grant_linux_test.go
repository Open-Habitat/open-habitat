//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
)

func accessOf(services []Service) map[string]Access {
	out := map[string]Access{}
	for _, s := range services {
		out[s.ID] = s.Access
	}
	return out
}

// A person may leave Drive out on Google's consent page. The account
// connects with the rest, gog keeps the grant's own scopes, rclone gets no
// login, and the page reads the grant back from gog.
func TestGoogleNarrowerGrantConnectsWithWhatWasGranted(t *testing.T) {
	env := googleEnv(t)
	email := "person@example.test"
	granted := "openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.readonly"
	g := syntheticGoogle(t, &email, granted)
	login, err := g.StartLogin(context.Background(), env, "")
	if err != nil {
		t.Fatal(err)
	}
	l := login.(*googleLogin)
	if err := l.Redirect(context.Background(), googleRedirect+"?"+url.Values{"state": {l.state}, "code": {"synthetic-code"}}.Encode()); err != nil {
		t.Fatal(err)
	}
	address, err := l.Wait(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(env.Home, googleDir, address+".conf")); !os.IsNotExist(err) {
		t.Fatal("rclone signed in without a Drive grant", err)
	}
	if choose, err := g.FolderChoiceAfterLogin(env, address); err != nil || choose {
		t.Fatal("offered a Drive choice without a Drive grant", choose, err)
	}
	accounts, err := g.Accounts(env)
	if err != nil || len(accounts) != 1 || accounts[0] != address {
		t.Fatal(accounts, err)
	}
	services, grant := g.CheckGrant(context.Background(), env, address)
	want := map[string]Access{"drive": AccessNone, "mail": AccessFull, "calendar": AccessRead, "contacts": AccessNone}
	if got := accessOf(services); !maps(got, want) {
		t.Fatalf("access %v", got)
	}
	for _, s := range services {
		if s.Access == AccessNone && s.State != StateUnknown {
			t.Fatalf("probed a service the grant does not reach: %v", s)
		}
	}
	if grant == nil || !slices.Equal(grant.Granted, []string{googleScope + "calendar.readonly", googleScope + "gmail.modify"}) ||
		!slices.Equal(grant.NotGranted, []string{googleScope + "calendar", googleScope + "contacts", googleScope + "drive"}) {
		t.Fatalf("grant %+v", grant)
	}
	skill := g.Skill(env, address).Body
	if !strings.Contains(skill, "Drive: not granted") || !strings.Contains(skill, "Calendar: read only") || strings.Contains(skill, "initial sync is not ready") {
		t.Fatal(skill)
	}

	// The catalog shows the grant and runs no sync for a service without one.
	c := New(env, []Entry{g}, nil)
	account := c.check(context.Background(), g, address)
	if account.Grant == nil || account.Services[0].Directory != "" {
		t.Fatalf("%+v", account)
	}
	data, _ := json.Marshal(account)
	if !strings.Contains(string(data), `"access":"none"`) || !strings.Contains(string(data), `"not_granted":[`) {
		t.Fatal(string(data))
	}
}

// Every service of a full grant reads as full, and an unreadable gog store
// shows no access rather than guessing one.
func TestGoogleFullGrantAndUnreadableGrant(t *testing.T) {
	env := googleEnv(t)
	email := "person@example.test"
	g := syntheticGoogle(t, &email, googleScopes)
	login, _ := g.StartLogin(context.Background(), env, "")
	l := login.(*googleLogin)
	l.Redirect(context.Background(), googleRedirect+"?"+url.Values{"state": {l.state}, "code": {"synthetic-code"}}.Encode())
	address, err := l.Wait(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	if choose, _ := g.FolderChoiceAfterLogin(env, address); !choose {
		t.Fatal("a full grant must offer the Drive choice")
	}
	services, grant := g.CheckGrant(context.Background(), env, address)
	for _, s := range services {
		if s.Access != AccessFull {
			t.Fatalf("%v", services)
		}
	}
	if grant == nil || len(grant.NotGranted) != 0 || len(grant.Granted) != 4 {
		t.Fatalf("%+v", grant)
	}
	os.WriteFile(filepath.Join(env.Home, "gog-fail"), nil, 0600)
	services, grant = g.CheckGrant(context.Background(), env, address)
	if grant != nil || services[1].Access != "" {
		t.Fatalf("guessed a grant: %+v %v", grant, services)
	}
}

func maps(a, b map[string]Access) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if b[k] != v {
			return false
		}
	}
	return true
}

// microsoftGrantToken replaces the device exchange's scope with scope.
func microsoftGrantToken(t *testing.T, m *microsoft, scope string, drive bool) {
	base := m.client.Transport
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if !drive && strings.HasPrefix(r.URL.Path, "/v1.0/me/") && r.URL.Path != "/v1.0/me" {
			t.Errorf("discovered files without a files grant: %s", r.URL.Path)
		}
		res, err := base.RoundTrip(r)
		if err == nil && strings.HasSuffix(r.URL.Path, "/token") {
			res.Body.Close()
			res.Body = io.NopCloser(strings.NewReader(fmt.Sprintf(`{"access_token":"access-secret","refresh_token":"refresh-secret","expires_in":3600,"scope":%q}`, scope)))
		}
		return res, err
	})
}

// An organisation that consented to mail drafts but not to sending or files
// connects with that: no file roots, the Outlook server limited to the grant,
// and the services and grant list say what is missing.
func TestMicrosoftNarrowerGrantConnectsAndLimitsOutlook(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	scopes := "openid profile offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Contacts.ReadWrite"
	microsoftGrantToken(t, m, scopes, false)
	l := msLogin(t, m, env, "")
	address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	const allowed = "User.Read Mail.ReadWrite Calendars.Read Contacts.ReadWrite"
	if l.allowed != allowed {
		t.Fatal(l.allowed)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	commands, _ := os.ReadFile(filepath.Join(env.Home, "pi-commands"))
	if !strings.Contains(string(commands), "--allowed-scopes\n"+allowed+"\n") {
		t.Fatalf("registration not limited to the grant:\n%s", commands)
	}
	if remotes, err := microsoftRemotes(env, address); err != nil || len(remotes) != 0 {
		t.Fatal("file roots without a files grant", remotes, err)
	}
	if dirs := m.Directories(env, address); len(dirs) != 0 {
		t.Fatal(dirs)
	}

	// The tenant's answer to the Outlook tool's refresh names the grant.
	verify, _ := json.Marshal(map[string]any{"state": "ok", "scopes": strings.Fields(strings.ReplaceAll(scopes, "https://graph.microsoft.com/", ""))})
	os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), verify, 0600)
	services, grant := m.CheckGrant(context.Background(), env, address)
	want := map[string]Access{"onedrive": AccessNone, "sharepoint": AccessNone, "mail": AccessDrafts, "calendar": AccessRead, "contacts": AccessFull}
	if got := accessOf(services); !maps(got, want) {
		t.Fatalf("access %v", got)
	}
	if grant == nil || !slices.Equal(grant.NotGranted, []string{"Calendars.ReadWrite", "Channel.ReadBasic.All", "Files.ReadWrite.All", "Mail.Send", "Sites.ReadWrite.All", "Team.ReadBasic.All"}) || slices.Contains(grant.Granted, "openid") {
		t.Fatalf("%+v", grant)
	}

	// Without the tenant's answer the rows are as before: no guessed access
	// and no file rows for an account without roots.
	os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), []byte(`{"state":"unreachable"}`), 0600)
	services, grant = m.CheckGrant(context.Background(), env, address)
	if grant != nil || len(services) != 3 || services[0].Access != "" {
		t.Fatalf("%+v %v", grant, services)
	}

	// The skill reads the registration's scopes, and alignment keeps them.
	server := map[string]any{"mcpServers": map[string]any{microsoftPlainServer(address): map[string]any{"args": []string{"--preset", "mail,calendar,contacts", "--allowed-scopes", allowed}, "env": map[string]string{"MS365_MCP_CLIENT_ID": "00000000-0000-0000-0000-000000000001", "MS365_MCP_TENANT_ID": "00000000-0000-4000-8000-0000000000bb", "MS365_MCP_TOKEN_CACHE_PATH": microsoftTestCache(env, address)}}}}
	data, _ := json.Marshal(server)
	os.WriteFile(filepath.Join(env.Home, ".pi/agent/mcp.json"), data, 0600)
	if body := m.Skill(env, address).Body; !strings.Contains(body, "Outlook mail: read and drafts, sending is not granted") || !strings.Contains(body, "Outlook calendar: read only") {
		t.Fatal(body)
	}
	os.Remove(filepath.Join(env.Home, "mcp-status-result"))
	os.Remove(filepath.Join(env.Home, "pi-commands"))
	if !m.Misaligned(env, address) {
		t.Fatal("tenant change not seen")
	}
	if err := m.Align(context.Background(), env, address, func() {}); err != nil {
		t.Fatal(err)
	}
	commands, _ = os.ReadFile(filepath.Join(env.Home, "pi-commands"))
	if !strings.Contains(string(commands), "--allowed-scopes\n"+allowed+"\n") {
		t.Fatalf("alignment widened the registration:\n%s", commands)
	}
}

// The identity read is required, and a grant reaching no service connects
// nothing.
func TestMicrosoftGrantWithoutServices(t *testing.T) {
	for scope, want := range map[string]error{
		"https://graph.microsoft.com/Mail.ReadWrite": ToolFailed,
		"https://graph.microsoft.com/User.Read":      NothingGranted,
	} {
		t.Run(scope, func(t *testing.T) {
			env := microsoftEnv(t)
			m := syntheticMicrosoft(t, "person@example.test", "")
			microsoftGrantToken(t, m, scope, false)
			l := msLogin(t, m, env, "")
			if _, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil }); !errors.Is(err, want) {
				t.Fatal(err)
			}
		})
	}
}

// A level never claims less than the token can do: sending is full, and
// either files or sites permission reaches both OneDrive and libraries.
func TestMicrosoftAccessNeverUnderclaims(t *testing.T) {
	for granted, want := range map[string]map[string]Access{
		"Mail.Read Mail.Send":                {"mail": AccessFull},
		"Mail.Send":                          {"mail": AccessFull},
		"Mail.ReadWrite":                     {"mail": AccessDrafts},
		"Files.ReadWrite.All":                {"onedrive": AccessFull, "sharepoint": AccessFull},
		"Sites.Read.All":                     {"onedrive": AccessRead, "sharepoint": AccessRead},
		"Files.Read.All Sites.ReadWrite.All": {"onedrive": AccessFull, "sharepoint": AccessFull},
		"Calendars.Read Contacts.ReadWrite":  {"mail": AccessNone, "onedrive": AccessNone},
	} {
		set := map[string]bool{}
		for _, s := range strings.Fields(granted) {
			set[s] = true
		}
		for service, access := range want {
			if got := microsoftRules.access(service, set); got != access {
				t.Errorf("%s %s: %s", granted, service, got)
			}
		}
	}
	if got := googleRules.access("mail", map[string]bool{googleScope + "gmail.readonly": true, googleScope + "gmail.send": true}); got != AccessFull {
		t.Error("gmail send read as", got)
	}
}

func TestMicrosoftAllowedScopes(t *testing.T) {
	for granted, want := range map[string]string{
		"User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite Files.ReadWrite.All Sites.ReadWrite.All": microsoftMCPScopes + " Files.ReadWrite.All Sites.ReadWrite.All",
		"User.Read Mail.Read Mail.ReadWrite Calendars.Read Contacts.Read":                                                   "User.Read Mail.ReadWrite Calendars.Read Contacts.Read",
		"User.Read Mail.Read Files.Read.All Files.ReadWrite.All Sites.Read.All":                                             "User.Read Mail.Read Files.ReadWrite.All Sites.Read.All",
		"User.Read": "User.Read",
	} {
		set := map[string]bool{}
		for _, s := range strings.Fields(granted) {
			set[s] = true
		}
		if got := microsoftAllowed(set); got != want {
			t.Errorf("%s: %s", granted, got)
		}
	}
	if g := microsoftGranted([]string{"https://graph.microsoft.com/Mail.Send", "https://other.example.test/Mail.Read", "Bad Scope", "User.Read"}); len(g) != 2 || !g["Mail.Send"] || !g["User.Read"] {
		t.Fatal(g)
	}
}

// Dropbox's token names its scopes. The full set connects and reads as full,
// the read set as read; one without the files' content connects nothing.
func TestDropboxGrantIsTheTokensScopes(t *testing.T) {
	for scope, want := range map[string]error{dropboxScopes: nil, "": nil, dropboxReadScopes: nil, "account_info.read files.metadata.read": NothingGranted} {
		t.Run(scope, func(t *testing.T) {
			env := dropboxEnv(t)
			email := "person@example.test"
			var exchanges atomic.Int32
			d := syntheticDropbox(t, &email, &exchanges)
			base := d.client.Transport
			d.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
				res, err := base.RoundTrip(r)
				if err == nil && strings.HasSuffix(r.URL.Path, "/oauth2/token") && scope != "" {
					res.Body = io.NopCloser(strings.NewReader(fmt.Sprintf(`{"access_token":"access-secret","refresh_token":"refresh-secret","token_type":"bearer","expires_in":14400,"scope":%q}`, scope)))
				}
				return res, err
			})
			login, _ := d.StartLogin(context.Background(), env, "")
			l := login.(*dropboxLogin)
			if err := l.Redirect(context.Background(), dropboxRedirect+"?"+url.Values{"state": {l.state}, "code": {"synthetic-code"}}.Encode()); err != nil {
				t.Fatal(err)
			}
			address, err := l.Wait(context.Background())
			if err != want {
				t.Fatal(err)
			}
			if err != nil {
				return
			}
			if err := l.Commit(context.Background(), address); err != nil {
				t.Fatal(err)
			}
			// The grant is read back from rclone's config, not the login.
			services, grant := d.CheckGrant(context.Background(), env, address)
			access, level, granted := AccessFull, LevelFull, dropboxScopes
			if scope == dropboxReadScopes {
				access, level, granted = AccessRead, LevelRead, dropboxReadScopes
			}
			if services[0].Access != access || d.Level(env, address, services) != level || grant == nil || len(grant.NotGranted) != 0 || len(grant.Granted) != len(strings.Fields(granted)) {
				t.Fatalf("%v %+v", services, grant)
			}
		})
	}
}
