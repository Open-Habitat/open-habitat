//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"testing"
)

// Synthetic followed sites whose composite IDs /me/followedSites returns.
const (
	lookupMoved    = "contoso.sharepoint.com,11111111-1111-4111-8111-111111111111,11111111-1111-4111-8111-111111111112"
	lookupResolved = "contoso.sharepoint.com,11111111-1111-4111-8111-111111111111,11111111-1111-4111-8111-111111111113"
	lookupGone     = "contoso.sharepoint.com,22222222-2222-4222-8222-222222222221,22222222-2222-4222-8222-222222222222"
	lookupClosed   = "contoso.sharepoint.com,33333333-3333-4333-8333-333333333331,33333333-3333-4333-8333-333333333332"
	lookupSame     = "contoso.sharepoint.com,44444444-4444-4444-8444-444444444441,44444444-4444-4444-8444-444444444442"
	lookupOddURL   = "contoso.sharepoint.com,55555555-5555-4555-8555-555555555551,55555555-5555-4555-8555-555555555552"
	lookupRefused  = "contoso.sharepoint.com,66666666-6666-4666-8666-666666666661,66666666-6666-4666-8666-666666666662"
)

// lookupGraph answers Graph for a mixed list of followed sites. paths records
// every Graph request path, so a test can tell which fallbacks ran.
func lookupGraph(t *testing.T, sites []string, override map[string]int) (*microsoft, *[]string) {
	t.Helper()
	urls := map[string]string{
		lookupMoved:       "https://contoso.sharepoint.com/sites/siirretty",
		lookupGone:        "https://contoso.sharepoint.com/sites/poistettu",
		lookupClosed:      "https://contoso.sharepoint.com/sites/suljettu",
		lookupSame:        "https://contoso.sharepoint.com/sites/kirjastoton",
		lookupOddURL:      "https://contoso.sharepoint.com/sites/../me",
		lookupRefused:     "https://contoso.sharepoint.com/sites/kielletty",
		testMicrosoftSite: "https://contoso.sharepoint.com/sites/team",
	}
	notFound := `{"error":{"code":"itemNotFound","message":"The resource could not be found."}}`
	answers := map[string]func() (int, string){
		"/v1.0/me/followedSites": func() (int, string) {
			var value []map[string]string
			for _, id := range sites {
				value = append(value, map[string]string{"id": id, "displayName": "Sivusto " + id[len(id)-2:], "webUrl": urls[id]})
			}
			data, _ := json.Marshal(map[string]any{"value": value})
			return 200, string(data)
		},
		"/v1.0/sites/" + lookupMoved + "/drives":              func() (int, string) { return 404, notFound },
		"/v1.0/sites/contoso.sharepoint.com:/sites/siirretty": func() (int, string) { return 200, fmt.Sprintf(`{"id":%q}`, lookupResolved) },
		"/v1.0/sites/" + lookupResolved + "/drives": func() (int, string) {
			return 200, `{"value":[{"id":"moved-drive","name":"Asiakirjat","driveType":"documentLibrary"}]}`
		},
		"/v1.0/sites/" + lookupGone + "/drives":                 func() (int, string) { return 404, notFound },
		"/v1.0/sites/contoso.sharepoint.com:/sites/poistettu":   func() (int, string) { return 404, notFound },
		"/v1.0/sites/" + lookupClosed + "/drives":               func() (int, string) { return 403, `{"error":{"code":"accessDenied"}}` },
		"/v1.0/sites/" + lookupSame + "/drives":                 func() (int, string) { return 404, notFound },
		"/v1.0/sites/contoso.sharepoint.com:/sites/kirjastoton": func() (int, string) { return 200, fmt.Sprintf(`{"id":%q}`, strings.ToUpper(lookupSame)) },
		"/v1.0/sites/" + lookupOddURL + "/drives":               func() (int, string) { return 404, notFound },
		"/v1.0/sites/" + lookupRefused + "/drives":              func() (int, string) { return 404, notFound },
		"/v1.0/sites/contoso.sharepoint.com:/sites/kielletty":   func() (int, string) { return 403, `{"error":{"code":"accessDenied"}}` },
	}
	m := syntheticMicrosoft(t, "person@example.test", "")
	base := m.client.Transport
	var paths []string
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		paths = append(paths, r.URL.Path)
		answer, ok := answers[r.URL.Path]
		if !ok {
			return base.RoundTrip(r)
		}
		code, body := answer()
		if c, ok := override[r.URL.Path]; ok {
			code, body = c, `{}`
		}
		return &http.Response{StatusCode: code, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
	})
	return m, &paths
}

func lookupDiscover(t *testing.T, m *microsoft) (*microsoftLogin, error) {
	t.Helper()
	l := &microsoftLogin{entry: m, env: microsoftEnv(t), address: "person@example.test"}
	return l, l.discover(context.Background(), "access-secret", map[string]bool{"Sites.ReadWrite.All": true})
}

// A followed site whose composite ID 404s but whose webUrl resolves to the
// site's current ID gets its libraries offered under that ID.
func TestMicrosoftFollowedSiteFallsBackToWebURL(t *testing.T) {
	m, paths := lookupGraph(t, []string{lookupMoved}, nil)
	l, err := lookupDiscover(t, m)
	if err != nil {
		t.Fatal(err)
	}
	if len(l.skippedSites) != 0 || len(l.unavailableSites) != 0 {
		t.Fatal("resolvable site reported as left out")
	}
	if !strings.Contains(string(l.config), "drive_id = moved-drive") {
		t.Fatal("resolved site's library not offered")
	}
	if !slices.Equal(l.siteLookups, []string{siteLookupWebURL}) {
		t.Fatal("fallback lookup not recorded", l.siteLookups)
	}
	if !slices.Contains(*paths, "/v1.0/sites/contoso.sharepoint.com:/sites/siirretty") {
		t.Fatal("webUrl lookup not path-addressed", *paths)
	}
	if !strings.Contains(string(l.config), "/"+microsoftSegment(lookupResolved+"-Sivusto 12")+"/") {
		t.Fatal("resolved site not named by its resolved ID")
	}
}

// A mixed list: the resolvable and reachable sites open; a genuinely missing
// site, one closed to the person (403, no fallback), one whose libraries 404
// under its own ID, one with an unusable webUrl and one whose lookup is
// refused are left out, each with the lookup form that decided it.
func TestMicrosoftFollowedSiteLookupMixedList(t *testing.T) {
	sites := []string{lookupMoved, lookupGone, lookupClosed, lookupSame, lookupOddURL, lookupRefused, testMicrosoftSite}
	m, paths := lookupGraph(t, sites, nil)
	l, err := lookupDiscover(t, m)
	if err != nil {
		t.Fatal(err)
	}
	for _, drive := range []string{"primary-drive", "moved-drive", "library-drive"} {
		if !strings.Contains(string(l.config), "drive_id = "+drive) {
			t.Fatal("reachable root lost", drive)
		}
	}
	want := []struct{ step, lookup, status string }{
		{"site_by_url", siteLookupWebURL, "404"},
		{"site_drives", siteLookupID, "403"},
		{"site_drives", siteLookupSameID, "404"},
		{"site_drives", siteLookupID, "404"},
		{"site_by_url", siteLookupWebURL, "403"},
	}
	if len(l.skippedSites) != len(want) || len(l.unavailableSites) != len(want) {
		t.Fatal("left-out notice wrong", l.unavailableSites)
	}
	for i, w := range want {
		log, _ := json.Marshal(l.skippedSites[i].diagnostic())
		for _, part := range []string{`"step","` + w.step + `"`, `"site_lookup","` + w.lookup + `"`, `"http_status",` + w.status, `"site_host","same_as_reachable_site"`} {
			if !strings.Contains(string(log), part) {
				t.Fatal("diagnostic", i, "lacks", part, string(log))
			}
		}
		for _, secret := range append([]string{"contoso", "Sivusto", "siirretty", "poistettu", "access-secret"}, sites...) {
			if strings.Contains(string(log), secret) {
				t.Fatal("unsafe skip diagnostic", string(log))
			}
		}
	}
	for _, p := range *paths {
		if strings.Contains(p, "suljettu") || strings.Contains(p, ":/me") || strings.Contains(p, "/me:") {
			t.Fatal("fallback ran where it must not", p)
		}
	}
	if !slices.Equal(l.siteLookups, []string{siteLookupWebURL}) {
		t.Fatal("fallback lookup not recorded", l.siteLookups)
	}
}

// Only 403 and 404 leave a site out; any other answer to the webUrl lookup
// or to the resolved site's libraries fails discovery rather than silently
// offering a partial inventory.
func TestMicrosoftFollowedSiteLookupOtherFailuresFail(t *testing.T) {
	for _, path := range []string{"/v1.0/sites/contoso.sharepoint.com:/sites/siirretty", "/v1.0/sites/" + lookupResolved + "/drives"} {
		for _, status := range []int{401, 429, 500} {
			t.Run(fmt.Sprint(path, status), func(t *testing.T) {
				m, _ := lookupGraph(t, []string{lookupMoved}, map[string]int{path: status})
				if _, err := lookupDiscover(t, m); err == nil {
					t.Fatal("fallback failure ignored")
				}
			})
		}
	}
	m, _ := lookupGraph(t, []string{lookupMoved}, nil)
	m.client.Transport = func(base http.RoundTripper) http.RoundTripper {
		return dropboxTransport(func(r *http.Request) (*http.Response, error) {
			if r.URL.Path == "/v1.0/sites/contoso.sharepoint.com:/sites/siirretty" {
				return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"id":"contoso.sharepoint.com/../me"}`))}, nil
			}
			return base.RoundTrip(r)
		})
	}(m.client.Transport)
	if _, err := lookupDiscover(t, m); err == nil {
		t.Fatal("invalid resolved site ID used")
	}
}

func TestMicrosoftSiteByURL(t *testing.T) {
	for in, want := range map[string]string{
		"https://contoso.sharepoint.com":                       "https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com?$select=id",
		"https://contoso.sharepoint.com/":                      "https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com?$select=id",
		"https://contoso.sharepoint.com/sites/team":            "https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/team?$select=id",
		"https://contoso.sharepoint.com/sites/team/":           "https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/team?$select=id",
		"https://contoso.sharepoint.com/teams/a%20b/sub?x=1#y": "https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/teams/a%20b/sub?$select=id",
		"https://contoso.sharepoint.com/sites/%C3%A4l%C3%A4":   "https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/%C3%A4l%C3%A4?$select=id",
	} {
		if got, ok := microsoftSiteByURL(in); !ok || got != want {
			t.Errorf("%s: %q %v", in, got, ok)
		}
	}
	for _, in := range []string{
		"", "http://contoso.sharepoint.com/sites/team", "https://user@contoso.sharepoint.com/sites/team",
		"https://contoso.sharepoint.com:444/sites/team", "https://contoso.sharepoint.com/sites/../me",
		"https://contoso.sharepoint.com/sites/%2E%2E/me", "https://contoso.sharepoint.com/sites/./team",
		"https://contoso.sharepoint.com/sites//team", "https://contoso.sharepoint.com/sites/a:b",
		"https://contoso.sharepoint.com/sites/a%2Fb", "https://contoso.sharepoint.com/sites/a%2Fb c", "https://contoso.sharepoint.com/sites/a%5Cb",
		"https://-contoso.sharepoint.com/sites/team", "https://contoso_x.sharepoint.com/sites/team",
		"https://graph.microsoft.com@contoso.sharepoint.com/x", "contoso.sharepoint.com/sites/team",
	} {
		if got, ok := microsoftSiteByURL(in); ok {
			t.Errorf("%s accepted as %q", in, got)
		}
	}
}
