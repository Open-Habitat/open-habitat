//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

const (
	testTeamFollowed = "11111111-1111-4111-8111-111111111111" // its site is also followed
	testTeamOwn      = "22222222-2222-4222-8222-222222222222"
	testTeamClosed   = "33333333-3333-4333-8333-333333333333" // its site answers 403
	testTeamSite     = "contoso.sharepoint.com,44444444-4444-4444-8444-444444444444,55555555-5555-4555-8555-555555555555"
)

var testTeamsScopes = map[string]bool{"Files.ReadWrite.All": true, "Sites.ReadWrite.All": true, "Team.ReadBasic.All": true, "Channel.ReadBasic.All": true}

// syntheticTeams answers Graph as a tenant where the person has joined three
// teams: one whose site they also follow, one with standard, private and
// shared channels (two of them unreachable), and one whose site is closed.
// Any request it does not expect fails the test; requests are recorded.
func syntheticTeams(t *testing.T, override map[string]func() (int, string)) (*microsoft, *[]string) {
	t.Helper()
	m := syntheticMicrosoft(t, "person@example.test", "")
	base := m.client.Transport
	var asked []string
	channel := func(id string) string { return "/v1.0/teams/" + testTeamOwn + "/channels/" + id + "/filesFolder" }
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		asked = append(asked, r.URL.Path)
		status, body := 200, ""
		if f, ok := override[r.URL.Path]; ok {
			status, body = f()
		} else {
			switch r.URL.Path {
			case "/v1.0/me/joinedTeams":
				body = fmt.Sprintf(`{"value":[{"id":%q,"displayName":"Seurattu tiimi"},{"id":%q,"displayName":"Esimerkkitiimi"},{"id":%q,"displayName":"Suljettu tiimi"}]}`, testTeamFollowed, testTeamOwn, testTeamClosed)
			case "/v1.0/groups/" + testTeamFollowed + "/sites/root":
				body = fmt.Sprintf(`{"id":%q,"displayName":"Team","webUrl":"https://contoso.sharepoint.com/sites/team"}`, testMicrosoftSite)
			case "/v1.0/teams/" + testTeamFollowed + "/channels":
				body = `{"value":[{"id":"19:general1@thread.tacv2","displayName":"General","membershipType":"standard"}]}`
			case "/v1.0/groups/" + testTeamOwn + "/sites/root":
				body = fmt.Sprintf(`{"id":%q,"displayName":"Esimerkkitiimi","webUrl":"https://contoso.sharepoint.com/sites/esimerkki"}`, testTeamSite)
			case "/v1.0/sites/" + testTeamSite + "/drives":
				body = `{"value":[{"id":"team-drive","name":"Asiakirjat","driveType":"documentLibrary"}]}`
			case "/v1.0/teams/" + testTeamOwn + "/channels":
				body = `{"value":[
					{"id":"19:general2@thread.tacv2","displayName":"General","membershipType":"standard"},
					{"id":"19:private1@thread.tacv2","displayName":"Suunnittelu","membershipType":"private"},
					{"id":"19:shared1@thread.tacv2","displayName":"Yhteistyö","membershipType":"shared"},
					{"id":"19:again1@thread.tacv2","displayName":"Toinen polku","membershipType":"shared"},
					{"id":"19:denied1@thread.tacv2","displayName":"Kielletty","membershipType":"private"},
					{"id":"19:gone1@thread.tacv2","displayName":"Poistunut","membershipType":"private"}]}`
			case channel("19:private1@thread.tacv2"):
				body = `{"webUrl":"https://contoso.sharepoint.com/sites/esimerkki-suunnittelu/Shared%20Documents","parentReference":{"driveId":"b!private-drive","driveType":"documentLibrary"}}`
			case channel("19:shared1@thread.tacv2"):
				body = `{"webUrl":"https://contoso.sharepoint.com/sites/esimerkki-yhteistyo/Shared%20Documents","parentReference":{"driveId":"b!shared-drive","driveType":"documentLibrary"}}`
			case channel("19:again1@thread.tacv2"):
				// The same library reached through another channel is offered once.
				body = `{"webUrl":"https://contoso.sharepoint.com/sites/esimerkki-yhteistyo/Shared%20Documents","parentReference":{"driveId":"b!shared-drive","driveType":"documentLibrary"}}`
			case channel("19:denied1@thread.tacv2"):
				status, body = 403, `{"error":{"code":"accessDenied","message":"private@example.test"}}`
			case channel("19:gone1@thread.tacv2"):
				status, body = 404, `{"error":{"code":"itemNotFound"}}`
			case "/v1.0/groups/" + testTeamClosed + "/sites/root":
				status, body = 403, `{"error":{"code":"accessDenied"}}`
			case "/v1.0/teams/" + testTeamClosed + "/channels":
				body = `{"value":[]}`
			default:
				return base.RoundTrip(r)
			}
		}
		return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
	})
	return m, &asked
}

// teamFolders writes the discovered config where the account keeps it and
// lists what the folder step would offer.
func teamFolders(t *testing.T, m *microsoft, l *microsoftLogin) []Folder {
	t.Helper()
	env := microsoftEnv(t)
	dir := filepath.Join(env.Home, microsoftDir)
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, l.address+".conf"), l.config, 0600); err != nil {
		t.Fatal(err)
	}
	folders, err := m.Folders(context.Background(), env, l.address)
	if err != nil {
		t.Fatal(err)
	}
	return folders
}

func TestMicrosoftTeamsDiscovery(t *testing.T) {
	m, asked := syntheticTeams(t, nil)
	l := &microsoftLogin{entry: m, address: "person@example.test", token: []byte(`{"access_token":"access-secret"}`)}
	if err := l.discover(context.Background(), "access-secret", testTeamsScopes); err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, f := range teamFolders(t, m, l) {
		names = append(names, f.Name)
	}
	// The followed site is offered once, under its followed name; a standard
	// channel adds nothing beside its team's library; a library reached
	// through two channels is offered once.
	want := []string{"OneDrive", "SharePoint · Team · Documents", "Teams · Esimerkkitiimi · Asiakirjat", "Teams · Esimerkkitiimi · Suunnittelu", "Teams · Esimerkkitiimi · Yhteistyö"}
	if !slices.Equal(names, want) {
		t.Fatalf("folders %q", names)
	}
	if !slices.Equal(l.unavailableSites, []string{"Esimerkkitiimi · Kielletty", "Esimerkkitiimi · Poistunut", "Suljettu tiimi"}) || len(l.skippedSites) != 3 {
		t.Fatalf("left out %q", l.unavailableSites)
	}
	if l.teamsLeftOut != "" {
		t.Fatal(l.teamsLeftOut)
	}
	followed := 0
	for _, p := range *asked {
		if p == "/v1.0/sites/"+testMicrosoftSite+"/drives" {
			followed++
		}
		if strings.Contains(p, "general") {
			t.Fatal("standard channel's files asked separately", p)
		}
	}
	if followed != 1 {
		t.Fatal("followed site listed", followed, "times")
	}
	for _, drive := range []string{"drive_id = b!private-drive", "drive_id = b!shared-drive", "drive_id = team-drive"} {
		if strings.Count(string(l.config), drive+"\n") != 1 {
			t.Fatalf("%s not offered exactly once\n%s", drive, l.config)
		}
	}
}

// A provider name is shown, never written as config syntax.
func TestMicrosoftTeamNameNeverBecomesConfig(t *testing.T) {
	m, _ := syntheticTeams(t, map[string]func() (int, string){
		"/v1.0/me/joinedTeams": func() (int, string) {
			return 200, fmt.Sprintf(`{"value":[{"id":%q,"displayName":"x\ntoken = injected\n[onedrive]"}]}`, testTeamOwn)
		},
		"/v1.0/teams/" + testTeamOwn + "/channels": func() (int, string) {
			return 200, `{"value":[{"id":"19:private1@thread.tacv2","displayName":"a = b ; # [c]","membershipType":"private"}]}`
		},
	})
	l := &microsoftLogin{entry: m, address: "person@example.test"}
	if err := l.discover(context.Background(), "access-secret", testTeamsScopes); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(l.config), "injected") || strings.Contains(string(l.config), "a = b") {
		t.Fatalf("provider text in config\n%s", l.config)
	}
	var names []string
	for _, f := range teamFolders(t, m, l) {
		names = append(names, f.Name)
	}
	if !slices.Contains(names, "Teams · Teams · a = b ; # [c]") {
		t.Fatalf("%q", names)
	}
}

func TestMicrosoftTeamsLeftOut(t *testing.T) {
	for _, tc := range []struct {
		name     string
		scopes   map[string]bool
		override map[string]func() (int, string)
		want     string
		// asks is whether any Teams endpoint may be asked.
		asks, channels bool
	}{
		{"team-scope-missing", map[string]bool{"Files.ReadWrite.All": true, "Sites.ReadWrite.All": true}, nil, teamsNotGranted, false, false},
		{"channel-scope-missing", map[string]bool{"Files.ReadWrite.All": true, "Sites.ReadWrite.All": true, "Team.ReadBasic.All": true}, nil, teamsChannelsNotGranted, true, false},
		{"broader-scopes", map[string]bool{"Files.Read.All": true, "Sites.Read.All": true, "Directory.Read.All": true}, nil, "", true, true},
		{"team-list-refused", testTeamsScopes, map[string]func() (int, string){"/v1.0/me/joinedTeams": func() (int, string) { return 403, `{"error":{"code":"accessDenied"}}` }}, teamsRefused, true, false},
		{"team-list-paged", testTeamsScopes, map[string]func() (int, string){"/v1.0/me/joinedTeams": func() (int, string) {
			return 200, fmt.Sprintf(`{"value":[{"id":%q,"displayName":"Esimerkkitiimi"}],"@odata.nextLink":"https://graph.microsoft.com/v1.0/next"}`, testTeamOwn)
		}}, teamsTooMany, true, true},
		{"no-sites-grant", map[string]bool{"Files.ReadWrite.All": true, "Team.ReadBasic.All": true, "Channel.ReadBasic.All": true}, nil, "", false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			m, asked := syntheticTeams(t, tc.override)
			l := &microsoftLogin{entry: m, address: "person@example.test"}
			if err := l.discover(context.Background(), "access-secret", tc.scopes); err != nil {
				t.Fatal(err)
			}
			if l.teamsLeftOut != tc.want {
				t.Fatalf("left out %q, want %q", l.teamsLeftOut, tc.want)
			}
			teams := slices.ContainsFunc(*asked, func(p string) bool { return strings.Contains(p, "joinedTeams") })
			channels := slices.ContainsFunc(*asked, func(p string) bool { return strings.HasSuffix(p, "/channels") })
			if teams != tc.asks || channels != tc.channels {
				t.Fatalf("asked %q", *asked)
			}
			if !strings.Contains(string(l.config), "[onedrive]") {
				t.Fatal("the account's own roots lost")
			}
		})
	}
}

// Teams that do not fit the config's bounds are left out and said; the
// account's own roots still connect.
func TestMicrosoftTeamsBeyondBoundsLeaveOthersConnected(t *testing.T) {
	m, _ := syntheticTeams(t, nil)
	// Every section repeats the token; a large one leaves room for few.
	token := `{"access_token":"` + strings.Repeat("a", 15<<10) + `"}`
	l := &microsoftLogin{entry: m, address: "person@example.test", token: []byte(token)}
	if err := l.discover(context.Background(), "access-secret", testTeamsScopes); err != nil {
		t.Fatal(err)
	}
	if l.teamsLeftOut != teamsTooMany || len(l.config) > maxMicrosoftConfig {
		t.Fatal(l.teamsLeftOut, len(l.config))
	}
	if !strings.Contains(string(l.config), "drive_id = primary-drive") || !strings.Contains(string(l.config), "drive_id = library-drive") {
		t.Fatal("own roots lost")
	}
	// A team is added whole or not at all.
	if strings.Contains(string(l.config), "drive_id = team-drive") != strings.Contains(string(l.config), "drive_id = b!private-drive") {
		t.Fatalf("team split\n%d", strings.Count(string(l.config), "[sp-"))
	}
}

// A malformed team or channel identifier never reaches a Graph path.
func TestMicrosoftTeamIdentifiersValidatedBeforeRequest(t *testing.T) {
	for _, tc := range []struct{ path, body, step string }{
		{"/v1.0/me/joinedTeams", `{"value":[{"id":"../me","displayName":"x"}]}`, "team_id"},
		{"/v1.0/teams/" + testTeamOwn + "/channels", `{"value":[{"id":"19:x@thread.tacv2/../../me","displayName":"x","membershipType":"private"}]}`, "channel_id"},
		{"/v1.0/teams/" + testTeamOwn + "/channels/19:private1@thread.tacv2/filesFolder", `{"webUrl":"https://contoso.sharepoint.com/x","parentReference":{"driveId":"../me","driveType":"documentLibrary"}}`, "site_drive_metadata"},
		{"/v1.0/teams/" + testTeamOwn + "/channels/19:private1@thread.tacv2/filesFolder", `{"webUrl":"http://contoso.sharepoint.com/x","parentReference":{"driveId":"b!x","driveType":"documentLibrary"}}`, "channel_url"},
	} {
		t.Run(tc.step, func(t *testing.T) {
			body := tc.body
			m, _ := syntheticTeams(t, map[string]func() (int, string){tc.path: func() (int, string) { return 200, body }})
			l := &microsoftLogin{entry: m, address: "person@example.test"}
			err := l.discover(context.Background(), "access-secret", testTeamsScopes)
			var detail microsoftDiscoveryError
			if !errors.As(err, &detail) || detail.step != tc.step || len(l.config) != 0 {
				t.Fatalf("%v %+v", err, detail)
			}
		})
	}
}

// The browser learns why Teams files are missing, beside the folders.
func TestMicrosoftTeamsLeftOutReachesLoginView(t *testing.T) {
	env := microsoftEnv(t)
	c := testCatalog(t, env.Home, nil)
	a := &attempt{provider: Microsoft, owner: ownerA, state: "choose_folders", teamsLeftOut: teamsNotGranted}
	c.relay.a = a
	v := c.relay.view(ownerA, time.Now())
	data, _ := json.Marshal(v)
	if !strings.Contains(string(data), `"teams_left_out":"not_granted"`) {
		t.Fatal(string(data))
	}
}
