package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// accessFake models the broker's two sources: authorize and ensure follow
// the union, and admit/withdraw follow the broker's rules. lose makes the
// next write commit and then lose its reply.
type accessFake struct {
	*fakeBroker
	amu        sync.Mutex
	operator   map[string]bool
	runtime    map[string]string
	on         bool
	lose       bool
	refuse     error
	onWithdraw func()
	onAdmit    func()
}

func newAccessFake() *accessFake {
	return &accessFake{fakeBroker: newFakeBroker(), operator: map[string]bool{"42": true}, runtime: map[string]string{"43": "admitted"}, on: true}
}
func (b *accessFake) admitted(id string) bool {
	b.amu.Lock()
	defer b.amu.Unlock()
	return b.operator[id] || b.runtime[id] == "admitted"
}
func (b *accessFake) Exchange(ctx context.Context, r BrokerRequest) (BrokerReply, error) {
	if !b.admitted(r.ID) {
		return BrokerReply{}, BrokerDenied
	}
	return b.fakeBroker.Exchange(ctx, r)
}
func (b *accessFake) ListBound(context.Context) ([]BoundUser, error) {
	return []BoundUser{{ID: "42", Username: "alice"}, {ID: "43", Username: "bob"}}, nil
}
func (b *accessFake) LookupBound(_ context.Context, id string) (bool, error) {
	_, ok := b.routes[id]
	return ok, nil
}
func (b *accessFake) row(id string) []AccessRow {
	route, bound := b.routes[id]
	state := "allowed"
	if bound {
		state = "joined"
	}
	switch {
	case b.operator[id]:
		return []AccessRow{{ID: id, Source: "operator", State: state, Username: route.Username}}
	case b.runtime[id] == "withdrawn":
		return []AccessRow{{ID: id, Source: "site_admin", State: "withdrawn", Username: route.Username, LoginHint: "hint", Actor: "42", At: "2026-10-24T09:30:00Z"}}
	case b.runtime[id] != "":
		return []AccessRow{{ID: id, Source: "site_admin", State: state, Username: route.Username, LoginHint: "hint", Actor: "42", At: "2026-10-24T09:30:00Z"}}
	}
	return []AccessRow{}
}
func (b *accessFake) AccessList(context.Context) (AccessPage, error) {
	b.amu.Lock()
	defer b.amu.Unlock()
	p := AccessPage{Mode: "allowlist", RuntimeAdmission: b.on}
	for _, id := range []string{"42", "43", "44", "45"} {
		p.Rows = append(p.Rows, b.row(id)...)
	}
	return p, nil
}
func (b *accessFake) AccessRead(_ context.Context, id string) (AccessPage, error) {
	b.amu.Lock()
	defer b.amu.Unlock()
	return AccessPage{Mode: "allowlist", RuntimeAdmission: b.on, Rows: b.row(id)}, nil
}
func (b *accessFake) Admit(_ context.Context, id, hint, _ string) (AccessRow, error) {
	if b.onAdmit != nil {
		b.onAdmit()
	}
	b.amu.Lock()
	defer b.amu.Unlock()
	if b.refuse != nil {
		return AccessRow{}, b.refuse
	}
	if !b.on {
		return AccessRow{}, ErrAccessDisabled
	}
	if hint == "" {
		return AccessRow{}, ErrAccessRefused
	}
	b.runtime[id] = "admitted"
	if b.lose {
		b.lose = false
		return AccessRow{}, ErrAccessUncertain
	}
	return b.row(id)[0], nil
}
func (b *accessFake) Withdraw(_ context.Context, id, _ string) (AccessRow, error) {
	if b.onWithdraw != nil {
		b.onWithdraw()
	}
	b.amu.Lock()
	defer b.amu.Unlock()
	if b.refuse != nil {
		return AccessRow{}, b.refuse
	}
	if b.operator[id] {
		return AccessRow{}, ErrOperatorOwned
	}
	if b.lose {
		b.lose = false
		return AccessRow{}, ErrAccessUncertain
	}
	if b.runtime[id] == "" {
		return AccessRow{ID: id, Source: "site_admin", State: "removed"}, nil
	}
	if _, bound := b.routes[id]; !bound {
		delete(b.runtime, id)
		return AccessRow{ID: id, Source: "site_admin", State: "removed"}, nil
	}
	b.runtime[id] = "withdrawn"
	return b.row(id)[0], nil
}

type directoryProvider struct {
	*fakeProvider
	users map[string]GitHubUser
}

func (d directoryProvider) LookupLogin(_ context.Context, login string) (GitHubUser, error) {
	for _, u := range d.users {
		if strings.EqualFold(u.Login, login) {
			if u.Type != "User" {
				return GitHubUser{}, ErrGitHubNotUser
			}
			return u, nil
		}
	}
	return GitHubUser{}, ErrGitHubUserNotFound
}
func (d directoryProvider) LookupID(_ context.Context, id string) (GitHubUser, error) {
	u, ok := d.users[id]
	if !ok {
		return GitHubUser{}, ErrGitHubUserNotFound
	}
	return u, nil
}

// blockingSink holds the token handoff so a withdrawal can run inside it.
type blockingSink struct {
	fakeSink
	during func()
}

func (s *blockingSink) Deliver(ctx context.Context, m Identity, id, token string) error {
	if s.during != nil {
		s.during()
	}
	return s.fakeSink.Deliver(ctx, m, id, token)
}

type accessHarness struct {
	t        *testing.T
	dir      string
	broker   *accessFake
	provider *fakeProvider
	sink     *blockingSink
	auth     *Auth
	h        http.Handler
}

func newAccessHarness(t *testing.T) *accessHarness {
	t.Helper()
	x := &accessHarness{t: t, dir: t.TempDir(), broker: newAccessFake(), provider: &fakeProvider{token: strings.Repeat("Z", 64), id: "42", login: "alice"}, sink: &blockingSink{}}
	x.restart()
	if e := x.auth.changeDefaultLimitFor("", 1<<30); e != nil {
		t.Fatal(e)
	}
	if e := x.auth.changeRole(context.Background(), "42", true); e != nil {
		t.Fatal(e)
	}
	return x
}

// restart builds a new gateway from the same private state files.
func (x *accessHarness) restart() {
	x.t.Helper()
	now := time.Date(2026, 10, 24, 9, 0, 0, 0, time.UTC)
	provider := directoryProvider{x.provider, map[string]GitHubUser{"43": {ID: "43", Login: "bob", Type: "User"}, "44": {ID: "44", Login: "carol", Type: "User"}, "45": {ID: "45", Login: "acme", Type: "Organization"}}}
	a, e := NewAuth(OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: provider, Sink: x.sink, Broker: x.broker, Now: func() time.Time { return now }, SessionFile: filepath.Join(x.dir, "sessions.json"), AdminFile: filepath.Join(x.dir, "administration.json")})
	if e != nil {
		x.t.Fatal(e)
	}
	x.auth, x.h = a, NewWithAuth("", a)
}

// login signs id in and returns its cookie, or nil when refused.
func (x *accessHarness) login(id, name string) *http.Cookie {
	x.t.Helper()
	x.provider.id, x.provider.login = id, name
	state, flow := start(x.t, x.h)
	w := callback(x.h, state, flow)
	if w.Code != 303 {
		return nil
	}
	return w.Result().Cookies()[1]
}
func (x *accessHarness) live(c *http.Cookie) bool {
	return request(x.h, "GET", "/auth/session", c).Code == 200
}
func (x *accessHarness) file(name string) string {
	b, _ := os.ReadFile(filepath.Join(x.dir, name))
	return string(b)
}
func (x *accessHarness) sessionsOf(id string) int {
	x.auth.mu.Lock()
	defer x.auth.mu.Unlock()
	n := 0
	for _, s := range x.auth.sessions {
		if s.identity.Subject == id {
			n++
		}
	}
	return n
}

// Withdrawal records a durable deny and removes the sessions before the
// broker is asked, so that each crash point between the steps stays closed.
func TestWithdrawalOrderAndRestore(t *testing.T) {
	x := newAccessHarness(t)
	bob := x.login("43", "bob")
	if bob == nil {
		t.Fatal("runtime-admitted login")
	}
	x.broker.onWithdraw = func() {
		if !strings.Contains(x.file("administration.json"), `"denied":["43"]`) {
			t.Error("broker asked before the deny was durable")
		}
		if x.sessionsOf("43") != 0 || strings.Contains(x.file("sessions.json"), `"subject":"43"`) {
			t.Error("broker asked before the sessions were removed")
		}
		if !x.broker.admitted("43") {
			t.Error("sessions removed after the broker stopped authorizing")
		}
	}
	row, err := x.auth.withdrawAccess(context.Background(), "42", "43")
	if err != nil || row.State != "withdrawn" {
		t.Fatal(row, err)
	}
	if x.live(bob) || x.login("43", "bob") != nil {
		t.Fatal("withdrawn person still reaches the web")
	}
	x.broker.onWithdraw = nil
	// Restore removes leftovers first and lifts the deny only after the reply.
	x.broker.onAdmit = func() {
		if !strings.Contains(x.file("administration.json"), `"denied":["43"]`) {
			t.Error("deny cleared before the broker confirmed")
		}
	}
	row, err = x.auth.admitAccess(context.Background(), "42", "43")
	if err != nil || row.State != "joined" || strings.Contains(x.file("administration.json"), "denied") {
		t.Fatal(row, err, x.file("administration.json"))
	}
	again := x.login("43", "bob")
	if again == nil || x.live(bob) {
		t.Fatal("restore did not readmit, or revived the old cookie")
	}
	x.auth.mu.Lock()
	for _, s := range x.auth.sessions {
		if s.identity.Subject == "43" && s.identity.UID != 1002 {
			t.Error("restore changed the account", s.identity)
		}
	}
	x.auth.mu.Unlock()
}

// A lost broker reply leaves the subject refused by the gateway, through a
// gateway restart, and nothing repeats the withdrawal.
func TestUncertainWithdrawalStaysClosedAcrossRestart(t *testing.T) {
	x := newAccessHarness(t)
	bob := x.login("43", "bob")
	x.broker.lose = true
	x.broker.amu.Lock()
	x.broker.refuse = nil
	x.broker.amu.Unlock()
	// The fake commits nothing on a lost withdraw: the broker still admits.
	if _, err := x.auth.withdrawAccess(context.Background(), "42", "43"); !errors.Is(err, ErrAccessUncertain) {
		t.Fatal(err)
	}
	if !x.broker.admitted("43") {
		t.Fatal("fixture")
	}
	x.restart()
	if x.live(bob) || x.login("43", "bob") != nil {
		t.Fatal("deny lost across restart")
	}
	view, err := x.auth.accessList(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range view.Entries {
		if e.ID == "43" && (!e.Denied || e.State != "joined") {
			t.Fatal("uncertain withdrawal not visible", e)
		}
	}
	// A crash after the deny but before session removal: the deny alone
	// refuses the old cookie, and restore removes it before readmitting.
	x2 := newAccessHarness(t)
	carolCookie := x2.login("43", "bob")
	x2.auth.mu.Lock()
	if e := x2.auth.setDenyLocked("43", true); e != nil {
		t.Fatal(e)
	}
	x2.auth.mu.Unlock()
	x2.restart()
	if x2.live(carolCookie) {
		t.Fatal("deny without session removal let a cookie through")
	}
	if _, err := x2.auth.admitAccess(context.Background(), "42", "43"); err != nil {
		t.Fatal(err)
	}
	if x2.live(carolCookie) {
		t.Fatal("restore revived a leftover session")
	}
}

// A login whose token handoff is in progress when the withdrawal runs gets
// no session; an open relay ends with the session.
func TestWithdrawalRacesLoginAndRelays(t *testing.T) {
	x := newAccessHarness(t)
	bob := x.login("43", "bob")
	req := httptest.NewRequest("GET", "https://host.test/", nil)
	req.AddCookie(bob)
	s, ok := x.auth.authenticated(req)
	if !ok {
		t.Fatal("session")
	}
	relay, release, ok := x.auth.liveRequest(req, s)
	if !ok {
		t.Fatal("relay")
	}
	defer release()
	x.sink.during = func() {
		x.sink.during = nil
		if _, err := x.auth.withdrawAccess(context.Background(), "42", "43"); err != nil {
			t.Error(err)
		}
	}
	if x.login("43", "bob") != nil {
		t.Fatal("login racing a withdrawal created a session")
	}
	if x.sink.calls != 2 {
		t.Fatal("handoff did not run inside the race", x.sink.calls)
	}
	if relay.Err() == nil {
		t.Fatal("relay outlived the withdrawal")
	}
	if x.sessionsOf("43") != 0 {
		t.Fatal("session left")
	}
}

func TestWithdrawalRefusalsLeaveNoTrace(t *testing.T) {
	x := newAccessHarness(t)
	alice := x.login("42", "alice")
	// Root's site.json owns 42: refused before any deny or sign-out.
	if _, err := x.auth.withdrawAccess(context.Background(), "42", "42"); !errors.Is(err, ErrOperatorOwned) {
		t.Fatal(err)
	}
	if !x.live(alice) || strings.Contains(x.file("administration.json"), "denied") {
		t.Fatal("refused withdrawal touched the administrator")
	}
	// Root admitted 43 between the read and the withdraw: the definite
	// refusal lifts the deny again.
	x.login("43", "bob")
	x.broker.refuse = ErrOperatorOwned
	if _, err := x.auth.withdrawAccess(context.Background(), "42", "43"); !errors.Is(err, ErrOperatorOwned) {
		t.Fatal(err)
	}
	if strings.Contains(x.file("administration.json"), "denied") {
		t.Fatal("deny left after a definite refusal")
	}
	x.broker.refuse = nil
	// A never-bound admission leaves nothing, not even a deny.
	if _, err := x.auth.admitAccess(context.Background(), "42", "44"); err != nil {
		t.Fatal(err)
	}
	row, err := x.auth.withdrawAccess(context.Background(), "42", "44")
	if err != nil || row.State != "removed" || strings.Contains(x.file("administration.json"), "denied") {
		t.Fatal(row, err)
	}
	// An organisation is not a person.
	if _, err = x.auth.admitAccess(context.Background(), "42", "45"); err == nil {
		t.Fatal("admitted an organisation id")
	}
	// A non-administrator caller changes nothing.
	if _, err = x.auth.admitAccess(context.Background(), "43", "44"); !errors.Is(err, errAdminDenied) {
		t.Fatal(err)
	}
	x.broker.on = false
	if _, err = x.auth.admitAccess(context.Background(), "42", "44"); !errors.Is(err, ErrAccessDisabled) {
		t.Fatal(err)
	}
}

func accessPost(h http.Handler, c *http.Cookie, csrf, path, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("POST", "https://host.test"+path, strings.NewReader(body))
	r.AddCookie(c)
	r.Header.Set("Origin", "https://host.test")
	r.Header.Set("X-Agent-Host-CSRF", csrf)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestAccessBrowserAPI(t *testing.T) {
	x := newAccessHarness(t)
	alice := x.login("42", "alice")
	csrf := extractCSRF(t, request(x.h, "GET", "/auth/session", alice).Body.String())
	bob := x.login("43", "bob")
	bobCSRF := extractCSRF(t, request(x.h, "GET", "/auth/session", bob).Body.String())
	if w := accessPost(x.h, bob, bobCSRF, accessPath+"/remove", `{"id":"43"}`); w.Code != 403 {
		t.Fatal("non-administrator withdrew", w.Code)
	}
	if w := accessPost(x.h, alice, "wrong", accessPath+"/remove", `{"id":"43"}`); w.Code != 403 || !x.live(bob) {
		t.Fatal("CSRF bypass", w.Code)
	}
	w := accessPost(x.h, alice, csrf, accessPath+"/lookup", `{"login":"carol"}`)
	var found struct{ ID, Login string }
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &found) != nil || found.ID != "44" {
		t.Fatal(w.Code, w.Body.String())
	}
	if w = accessPost(x.h, alice, csrf, accessPath+"/lookup", `{"login":"acme"}`); w.Code != 409 || !strings.Contains(w.Body.String(), "github_not_user") {
		t.Fatal("organisation", w.Code, w.Body.String())
	}
	if w = accessPost(x.h, alice, csrf, accessPath+"/remove", `{"id":"42"}`); w.Code != 409 || !strings.Contains(w.Body.String(), "operator_owned") {
		t.Fatal(w.Code, w.Body.String())
	}
	x.broker.lose = true
	if w = accessPost(x.h, alice, csrf, accessPath+"/remove", `{"id":"43"}`); w.Code != 503 || !strings.Contains(w.Body.String(), "outcome_uncertain") {
		t.Fatal("uncertain withdrawal shown as", w.Code, w.Body.String())
	}
	if x.live(bob) {
		t.Fatal("uncertain withdrawal left the session")
	}
	if w = accessPost(x.h, alice, csrf, accessPath+"/remove", `{"id":"43"}`); w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"withdrawn"`) {
		t.Fatal("explicit repeat", w.Code, w.Body.String())
	}
	if w = accessPost(x.h, alice, csrf, accessPath+"/add", `{"id":"44","login":"carol"}`); w.Code != 400 {
		t.Fatal("extra field", w.Code)
	}
	list := request(x.h, "GET", accessPath, alice)
	if list.Code != 200 || !strings.Contains(list.Body.String(), `"runtime_admission":true`) {
		t.Fatal(list.Code, list.Body.String())
	}
	// Root's control socket has the same rules.
	if _, err := x.auth.AdminControl(context.Background(), []byte(`{"operation":"access_remove","subject":"42"}`)); AdminControlError(err) != "operator_owned" {
		t.Fatal(err)
	}
	b, err := x.auth.AdminControl(context.Background(), []byte(`{"operation":"access_add","subject":"43"}`))
	if err != nil || !strings.Contains(string(b), `"state":"joined"`) {
		t.Fatal(string(b), err)
	}
	if b, err = x.auth.AdminControl(context.Background(), []byte(`{"operation":"show"}`)); err != nil || strings.Contains(string(b), "denied") {
		t.Fatal(string(b), err)
	}
}

// Last-seen comes from live sessions only: an ended session, even a recently
// used one, says nothing, and the newest renewal wins.
func TestAccessListLastSeen(t *testing.T) {
	x := newAccessHarness(t)
	alice := x.login("42", "alice")
	now := time.Date(2026, 10, 24, 9, 0, 0, 0, time.UTC)
	day := 24 * time.Hour
	bob := Identity{Provider: "github", Subject: "43", Username: "bob"}
	x.auth.mu.Lock()
	x.auth.sessions["older"] = session{identity: bob, created: now.Add(-30 * day), idle: now.Add(-20*day + sessionIdle), absolute: now.Add(300 * day)}
	x.auth.sessions["newer"] = session{identity: bob, created: now.Add(-30 * day), idle: now.Add(-2*day + sessionIdle), absolute: now.Add(300 * day)}
	x.auth.sessions["ended"] = session{identity: bob, created: now.Add(-time.Hour), idle: now.Add(-time.Hour + sessionIdle), absolute: now.Add(-time.Minute)}
	x.auth.mu.Unlock()
	w := request(x.h, "GET", accessPath, alice)
	var view struct {
		Entries []struct {
			ID       string  `json:"id"`
			LastSeen *string `json:"last_seen"`
		} `json:"entries"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &view) != nil {
		t.Fatal(w.Code, w.Body.String())
	}
	seen := map[string]string{}
	for _, e := range view.Entries {
		if e.LastSeen != nil {
			seen[e.ID] = *e.LastSeen
		}
	}
	if seen["42"] != "2026-10-24T09:00:00Z" || seen["43"] != "2026-10-22T09:00:00Z" {
		t.Fatal(seen)
	}
}
