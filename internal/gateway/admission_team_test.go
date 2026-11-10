package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// teamFake adds the broker's team source to accessFake: a member record
// admits like the other sources, and an observation follows the broker's
// rules for active, none and unknown.
type teamFake struct {
	*accessFake
	tmu        sync.Mutex
	teams      []TeamSource
	members    map[string]string
	observed   [][]TeamObservation
	loseSignIn bool
}

func newTeamFake() *teamFake {
	b := &teamFake{accessFake: newAccessFake(), members: map[string]string{}}
	b.teams = []TeamSource{{OrgID: "700", Org: "Example-Org", Slug: "habitat", TeamID: "900", Actor: "42", At: "2026-11-02T09:00:00Z"}}
	b.fakeBroker.routes["61"] = BrokerRoute{UID: 1061, Username: "anna", Socket: "/run/open-habitat/users/anna/daemon.sock"}
	if b.fakeBroker.unbound == nil {
		b.fakeBroker.unbound = map[string]bool{}
	}
	b.fakeBroker.unbound["61"] = true
	return b
}
func (b *teamFake) member(id string) string {
	b.tmu.Lock()
	defer b.tmu.Unlock()
	return b.members[id]
}
func (b *teamFake) Exchange(ctx context.Context, r BrokerRequest) (BrokerReply, error) {
	if !b.accessFake.admitted(r.ID) && b.member(r.ID) != "member" {
		return BrokerReply{}, BrokerDenied
	}
	return b.accessFake.fakeBroker.Exchange(ctx, r)
}
func (b *teamFake) Teams(context.Context) ([]TeamSource, error) {
	b.tmu.Lock()
	defer b.tmu.Unlock()
	return append([]TeamSource{}, b.teams...), nil
}
func (b *teamFake) AddTeam(_ context.Context, orgID, org, slug, actor string) ([]TeamSource, error) {
	b.tmu.Lock()
	defer b.tmu.Unlock()
	b.teams = append(b.teams, TeamSource{OrgID: orgID, Org: org, Slug: slug, Actor: actor, At: "2026-11-02T10:00:00Z"})
	return append([]TeamSource{}, b.teams...), nil
}
func (b *teamFake) RemoveTeam(_ context.Context, orgID, slug, _ string) ([]TeamSource, error) {
	b.tmu.Lock()
	defer b.tmu.Unlock()
	kept := []TeamSource{}
	for _, t := range b.teams {
		if t.OrgID != orgID || t.Slug != slug {
			kept = append(kept, t)
		}
	}
	b.teams = kept
	return append([]TeamSource{}, b.teams...), nil
}
func (b *teamFake) TeamSignIn(_ context.Context, id, _ string, observed []TeamObservation) error {
	b.tmu.Lock()
	defer b.tmu.Unlock()
	b.observed = append(b.observed, observed)
	if b.loseSignIn {
		return ErrAccessUncertain
	}
	state := "none"
	for _, o := range observed {
		if o.State == "active" {
			state = "active"
			break
		}
		if o.State == "unknown" {
			state = "unknown"
		}
	}
	prev := b.members[id]
	switch {
	case state == "active":
		b.members[id] = "member"
	case prev == "":
	case state == "unknown" && prev == "member":
		b.members[id] = "unconfirmed"
	case state == "none":
		b.members[id] = "left"
	}
	return nil
}
func (b *teamFake) Forget(_ context.Context, id, _ string) (AccessRow, error) {
	b.tmu.Lock()
	defer b.tmu.Unlock()
	delete(b.members, id)
	return AccessRow{ID: id, Source: "team", State: "removed"}, nil
}
func (b *teamFake) AccessList(ctx context.Context) (AccessPage, error) {
	page, err := b.accessFake.AccessList(ctx)
	b.tmu.Lock()
	defer b.tmu.Unlock()
	for id, state := range b.members {
		row := AccessRow{ID: id, Source: "team", State: "allowed", LoginHint: "anna", At: "2026-11-02T09:30:00Z", TeamState: state, Teams: []string{"900"}}
		if state != "member" {
			row.State = state
		}
		page.Rows = append(page.Rows, row)
	}
	return page, err
}

// teamProvider answers membership by login and records the token it was
// asked with.
type teamProvider struct {
	directoryProvider
	mu      sync.Mutex
	answers map[string]string
	tokens  []string
}

func (p *teamProvider) CheckTeam(_ context.Context, token, login string, t TeamSource) TeamObservation {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.tokens = append(p.tokens, token)
	state := p.answers[login]
	if state == "" {
		state = "none"
	}
	return TeamObservation{OrgID: t.OrgID, Slug: t.Slug, TeamID: t.TeamID, State: state}
}
func (p *teamProvider) answer(login, state string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.answers[login] = state
}
func (p *teamProvider) LookupOrg(_ context.Context, org string) (GitHubOrg, error) {
	if strings.EqualFold(org, "example-org") {
		return GitHubOrg{ID: "700", Login: "Example-Org"}, nil
	}
	if org == "down" {
		return GitHubOrg{}, ErrGitHubLookup
	}
	return GitHubOrg{}, ErrGitHubOrgNotFound
}

func newTeamHarness(t *testing.T) (*accessHarness, *teamFake, *teamProvider) {
	t.Helper()
	x := &accessHarness{t: t, dir: t.TempDir(), provider: &fakeProvider{token: strings.Repeat("T", 64), id: "42", login: "alice"}, sink: &blockingSink{}}
	broker := newTeamFake()
	x.broker = broker.accessFake
	provider := &teamProvider{directoryProvider: directoryProvider{x.provider, map[string]GitHubUser{"42": {ID: "42", Login: "alice", Type: "User"}, "43": {ID: "43", Login: "bob", Type: "User"}, "61": {ID: "61", Login: "anna", Type: "User"}}}, answers: map[string]string{}}
	now := time.Date(2026, 11, 2, 9, 0, 0, 0, time.UTC)
	a, e := NewAuth(OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: provider, Sink: x.sink, Broker: broker, Now: func() time.Time { return now }, SessionFile: filepath.Join(x.dir, "sessions.json"), AdminFile: filepath.Join(x.dir, "administration.json"), SiteKeyFile: filepath.Join(x.dir, "site-ai-key.json")})
	if e != nil {
		t.Fatal(e)
	}
	x.auth, x.h = a, NewWithAuth("", a)
	if e := x.auth.changeDefaultLimitFor("", 1<<30); e != nil {
		t.Fatal(e)
	}
	if e := x.auth.changeRole(context.Background(), "42", true); e != nil {
		t.Fatal(e)
	}
	return x, broker, provider
}

// loginCode signs id in and returns the callback's refusal code, or "" when
// it signed in.
func loginCode(x *accessHarness, id, name string) string {
	x.provider.id, x.provider.login = id, name
	state, flow := start(x.t, x.h)
	w := callback(x.h, state, flow)
	if w.Code == 303 {
		return ""
	}
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	return body.Error.Code
}

// The admission decisions: a member signs in and gets an account, a
// non-member is refused with a message that names no team, an unanswered
// membership question is refused honestly, a leaver is refused at the next
// sign-in while an open session stays, and someone admitted one by one
// keeps access when leaving.
func TestTeamAdmissionAtSignIn(t *testing.T) {
	x, broker, provider := newTeamHarness(t)
	provider.answer("anna", "active")
	anna := x.login("61", "anna")
	if anna == nil || broker.member("61") != "member" || x.sink.identity.Username != "anna" {
		t.Fatal("member not admitted", broker.member("61"))
	}
	for _, token := range provider.tokens {
		if token != strings.Repeat("T", 64) {
			t.Fatal("membership not asked with the sign-in token")
		}
	}
	if strings.Contains(x.file("sessions.json"), strings.Repeat("T", 64)) || strings.Contains(x.file("administration.json"), strings.Repeat("T", 64)) {
		t.Fatal("token stored")
	}
	// A stranger: refused with the generic code, nothing recorded.
	if loc := loginCode(x, "62", "stranger"); loc != "identity_mapping_denied" {
		t.Fatal(loc)
	}
	if broker.member("62") != "" {
		t.Fatal("stranger recorded")
	}
	// GitHub does not answer: refused honestly, the member kept unconfirmed.
	provider.answer("anna", "unknown")
	if loc := loginCode(x, "61", "anna"); loc != "membership_unavailable" {
		t.Fatal(loc)
	}
	if broker.member("61") != "unconfirmed" || !x.live(anna) {
		t.Fatal("outage recorded as leaving, or cut the open session", broker.member("61"))
	}
	// Leaving: refused at the next sign-in; the open session is not cut.
	provider.answer("anna", "active")
	if x.login("61", "anna") == nil {
		t.Fatal("rejoined member refused")
	}
	provider.answer("anna", "none")
	if loc := loginCode(x, "61", "anna"); loc != "identity_mapping_denied" {
		t.Fatal(loc)
	}
	if broker.member("61") != "left" || !x.live(anna) {
		t.Fatal("leaver not recorded, or session cut")
	}
	// Both reasons: bob is admitted one by one and keeps access.
	provider.answer("bob", "active")
	if x.login("43", "bob") == nil {
		t.Fatal("bob refused")
	}
	provider.answer("bob", "none")
	if x.login("43", "bob") == nil || broker.member("43") != "left" {
		t.Fatal("individual admission lost with the team")
	}
}

// A lost broker reply to the observation stops the sign-in: the member
// record from an earlier sign-in must not admit without this one's answer.
func TestTeamSignInRecordUncertain(t *testing.T) {
	x, broker, provider := newTeamHarness(t)
	provider.answer("anna", "active")
	if x.login("61", "anna") == nil {
		t.Fatal("member refused")
	}
	provider.answer("anna", "none")
	broker.tmu.Lock()
	broker.loseSignIn = true
	broker.tmu.Unlock()
	if loc := loginCode(x, "61", "anna"); loc == "" {
		t.Fatal("signed in on a stale member record", loc)
	}
	// An installation without teams asks GitHub nothing.
	broker.tmu.Lock()
	broker.teams, broker.loseSignIn, broker.observed = nil, false, nil
	broker.tmu.Unlock()
	provider.tokens = nil
	if x.login("43", "bob") == nil || len(provider.tokens) != 0 || len(broker.observed) != 0 {
		t.Fatal("teamless installation asked GitHub")
	}
}

// The access page adds and removes a team, names it on each member's row,
// and dismisses a leaver's notice; every write is an administrator's.
func TestTeamAccessBrowserAPI(t *testing.T) {
	x, broker, provider := newTeamHarness(t)
	alice := x.login("42", "alice")
	csrf := extractCSRF(t, request(x.h, "GET", "/auth/session", alice).Body.String())
	bob := x.login("43", "bob")
	bobCSRF := extractCSRF(t, request(x.h, "GET", "/auth/session", bob).Body.String())
	if w := accessPost(x.h, bob, bobCSRF, accessPath+"/teams/add", `{"team":"Example-Org/other"}`); w.Code != 403 {
		t.Fatal("non-administrator added a team", w.Code)
	}
	for body, want := range map[string]string{
		`{"team":"no-slash"}`:              "invalid_team",
		`{"team":"Example-Org/Two Words"}`: "invalid_team",
		`{"team":"ghost/team"}`:            "github_org_not_found",
		`{"team":"down/team"}`:             "github_lookup_unavailable",
	} {
		if w := accessPost(x.h, alice, csrf, accessPath+"/teams/add", body); !strings.Contains(w.Body.String(), want) {
			t.Fatal(body, w.Code, w.Body.String())
		}
	}
	if w := accessPost(x.h, alice, csrf, accessPath+"/teams/add", `{"team":"Example-Org/habitat","id":"1"}`); w.Code != 400 {
		t.Fatal("extra field accepted", w.Code)
	}
	w := accessPost(x.h, alice, csrf, accessPath+"/teams/add", `{"team":"https://github.com/orgs/example-org/teams/Ops"}`)
	var teams struct {
		Teams []teamView `json:"teams"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &teams) != nil || len(teams.Teams) != 2 || teams.Teams[1].Org != "Example-Org" || teams.Teams[1].Slug != "ops" || teams.Teams[1].OrgID != "700" || teams.Teams[1].Pinned {
		t.Fatal(w.Code, w.Body.String())
	}
	provider.answer("anna", "active")
	if x.login("61", "anna") == nil {
		t.Fatal("member refused")
	}
	view := request(x.h, "GET", accessPath, alice)
	var list accessView
	if json.Unmarshal(view.Body.Bytes(), &list) != nil || len(list.Teams) != 2 {
		t.Fatal(view.Body.String())
	}
	found := false
	for _, e := range list.Entries {
		if e.ID == "61" {
			found = e.Source == "team" && e.TeamState == "member" && len(e.Teams) == 1 && e.Teams[0] == "Example-Org/habitat"
		}
	}
	if !found {
		t.Fatal("member row", view.Body.String())
	}
	provider.answer("anna", "none")
	loginCode(x, "61", "anna")
	if w := accessPost(x.h, alice, csrf, accessPath+"/forget", `{"id":"61"}`); w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"removed"`) || broker.member("61") != "" {
		t.Fatal(w.Code, w.Body.String())
	}
	if w := accessPost(x.h, alice, csrf, accessPath+"/teams/remove", `{"org_id":"700","slug":"ops"}`); w.Code != 200 || strings.Contains(w.Body.String(), `"ops"`) {
		t.Fatal(w.Code, w.Body.String())
	}
	if w := accessPost(x.h, bob, bobCSRF, accessPath+"/teams/remove", `{"org_id":"700","slug":"habitat"}`); w.Code != 403 {
		t.Fatal(w.Code)
	}
}

// CheckTeam reads fixed GitHub endpoints with the person's token: only an
// active membership is active, a pending invitation and a confirmed absence
// are none, and anything GitHub refuses or fails to answer is unknown.
func TestGitHubCheckTeam(t *testing.T) {
	type answer struct {
		status int
		body   string
	}
	pinned := TeamSource{OrgID: "700", Org: "Example-Org", Slug: "habitat", TeamID: "900"}
	unpinned := TeamSource{OrgID: "700", Org: "Example-Org", Slug: "habitat"}
	membership := "https://api.github.com/organizations/700/team/900/memberships/anna"
	org := "https://api.github.com/user/memberships/orgs/Example-Org"
	team := "https://api.github.com/orgs/Example-Org/teams/habitat"
	for _, tc := range []struct {
		name    string
		source  TeamSource
		answers map[string]answer
		state   string
		teamID  string
	}{
		{"active", pinned, map[string]answer{membership: {200, `{"state":"active","role":"member"}`}}, "active", "900"},
		{"pending", pinned, map[string]answer{membership: {200, `{"state":"pending"}`}}, "none", "900"},
		{"not in team, in org", pinned, map[string]answer{membership: {404, ``}, org: {200, `{"state":"active","organization":{"id":700}}`}}, "none", "900"},
		{"not in org", pinned, map[string]answer{membership: {404, ``}, org: {404, ``}}, "none", "900"},
		{"org renamed to another", pinned, map[string]answer{membership: {404, ``}, org: {200, `{"state":"active","organization":{"id":701}}`}}, "unknown", "900"},
		{"app restricted", pinned, map[string]answer{membership: {403, `{"message":"OAuth App access restrictions"}`}}, "unknown", "900"},
		{"org restricted", pinned, map[string]answer{membership: {404, ``}, org: {403, ``}}, "unknown", "900"},
		{"outage", pinned, map[string]answer{membership: {502, ``}}, "unknown", "900"},
		{"pins on first sight", unpinned, map[string]answer{team: {200, `{"id":900,"organization":{"id":700}}`}, membership: {200, `{"state":"active"}`}}, "active", "900"},
		{"slug in another org", unpinned, map[string]answer{team: {200, `{"id":900,"organization":{"id":701}}`}}, "unknown", ""},
		{"team invisible", unpinned, map[string]answer{team: {404, ``}, org: {404, ``}}, "none", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := GitHubProvider{ClientID: "client", ClientSecret: "secret", Client: &http.Client{Transport: providerRoundTrip(func(r *http.Request) (*http.Response, error) {
				if r.Header.Get("Authorization") != "Bearer person-token" || r.Method != "GET" {
					return nil, errors.New("bad request")
				}
				a, ok := tc.answers[r.URL.String()]
				if !ok {
					return nil, errors.New("unexpected " + r.URL.String())
				}
				return &http.Response{StatusCode: a.status, Body: io.NopCloser(strings.NewReader(a.body)), Header: make(http.Header)}, nil
			})}}
			o := p.CheckTeam(context.Background(), "person-token", "anna", tc.source)
			if o.State != tc.state || o.TeamID != tc.teamID || o.OrgID != "700" || o.Slug != "habitat" {
				t.Fatalf("%+v", o)
			}
		})
	}
}

func TestParseTeam(t *testing.T) {
	for raw, want := range map[string]string{
		"Example-Org/habitat":                           "Example-Org/habitat",
		" @Example-Org/Habitat ":                        "Example-Org/habitat",
		"https://github.com/orgs/Example-Org/teams/ops": "Example-Org/ops",
		"Example-Org":                                   "",
		"Example-Org/two words":                         "",
		"https://github.com/Example-Org/habitat":        "",
		"a/b/c":                                         "",
	} {
		org, slug, ok := parseTeam(raw)
		if got := org + "/" + slug; ok != (want != "") || ok && got != want {
			t.Fatal(raw, got, ok)
		}
	}
}
