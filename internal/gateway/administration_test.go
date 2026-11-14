package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

type adminBroker struct {
	Broker
	down bool
}

func (b *adminBroker) ListBound(context.Context) ([]BoundUser, error) {
	if b.down {
		return nil, ErrBrokerUnavailable
	}
	return []BoundUser{{ID: "42", Username: "alice"}, {ID: "43", Username: "bob"}}, nil
}
func (b *adminBroker) LookupBound(_ context.Context, id string) (bool, error) {
	if b.down {
		return false, ErrBrokerUnavailable
	}
	return id == "42" || id == "43", nil
}
func adminPut(h http.Handler, c *http.Cookie, csrf, body string) int {
	r := httptest.NewRequest("PUT", "https://host.test/api/v1/server/administration", strings.NewReader(body))
	r.AddCookie(c)
	r.Header.Set("Origin", "https://host.test")
	r.Header.Set("X-Agent-Host-CSRF", csrf)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w.Code
}
func TestAdministrationAuthorizationAndPersistence(t *testing.T) {
	h, a, p, _, _ := fixture(t)
	path := filepath.Join(t.TempDir(), "administration.json")
	if e := a.loadAdministration(path); e != nil {
		t.Fatal(e)
	}
	if e := a.changeDefaultLimitFor("", 1024*1024); e != nil {
		t.Fatal(e)
	}
	broker := &adminBroker{Broker: a.broker}
	a.broker = broker
	state, flow := start(t, h)
	cookie := callback(h, state, flow).Result().Cookies()[1]
	w := request(h, "GET", "/auth/session", cookie)
	var session struct {
		CSRF string `json:"csrf"`
	}
	if e := json.Unmarshal(w.Body.Bytes(), &session); e != nil {
		t.Fatal(e)
	}
	a.version, a.commit = "1.2.3-test", strings.Repeat("ab", 20)
	info := request(h, "GET", "/api/v1/server", cookie)
	var server struct {
		Version string `json:"version"`
		Commit  string `json:"commit"`
	}
	if info.Code != 200 || json.Unmarshal(info.Body.Bytes(), &server) != nil || server.Version != "1.2.3-test" || server.Commit != a.commit {
		t.Fatalf("ordinary reader did not receive running version: %s", info.Body.String())
	}
	if code := adminPut(h, cookie, session.CSRF, `{"name":"Test host"}`); code != 403 {
		t.Fatalf("ordinary changed name: %d", code)
	}
	if request(h, "GET", "/api/v1/server/administration", cookie).Code != 403 {
		t.Fatal("ordinary read roles")
	}
	if e := a.changeRole(context.Background(), "42", true); e != nil {
		t.Fatal(e)
	}
	if code := adminPut(h, cookie, "wrong", `{"name":"Test host"}`); code != 403 {
		t.Fatalf("csrf bypass: %d", code)
	}
	if code := adminPut(h, cookie, session.CSRF, `{"name":"Test host"}`); code != 204 {
		t.Fatalf("name update: %d", code)
	}
	// Administrators come only from site.json: the browser has no role write.
	if code := adminPut(h, cookie, session.CSRF, `{"subject":"43","administrator":true}`); code != 400 {
		t.Fatalf("browser role write accepted: %d", code)
	}
	if a.isAdministrator("43") {
		t.Fatal("browser granted a role")
	}
	if e := a.changeRole(context.Background(), "43", true); e != nil {
		t.Fatal(e)
	}
	if e := a.changeRole(context.Background(), "44", true); e == nil {
		t.Fatal("unbound subject assigned")
	}
	state2, flow2 := start(t, h)
	p.id = "43"
	p.login = "bob"
	other := callback(h, state2, flow2).Result().Cookies()[1]
	if request(h, "GET", "/api/v1/server/administration", other).Code != 200 {
		t.Fatal("new admin denied")
	}
	broker.down = true
	if e := a.changeRole(context.Background(), "43", true); e == nil {
		t.Fatal("grant without broker lookup")
	}
	broker.down = false
	if e := a.changeRole(context.Background(), "42", false); e != nil {
		t.Fatal(e)
	}
	if code := adminPut(h, cookie, session.CSRF, `{"name":"Denied"}`); code != 403 {
		t.Fatalf("removal not immediate: %d", code)
	}
	if request(h, "GET", "/auth/session", cookie).Code != 200 {
		t.Fatal("native session changed by browser role")
	}
	fresh := &Auth{}
	if e := fresh.loadAdministration(path); e != nil {
		t.Fatal(e)
	}
	if fresh.settings.Name != "Test host" || len(fresh.settings.Administrators) != 1 || fresh.settings.Administrators[0] != "43" {
		t.Fatalf("restart lost state: %+v", fresh.settings)
	}
	if e := os.WriteFile(path, []byte("corrupt"), 0600); e != nil {
		t.Fatal(e)
	}
	if e := fresh.loadAdministration(path); e == nil {
		t.Fatal("corrupt state allowed")
	}
}
func TestAdminControlSharesWriter(t *testing.T) {
	_, a, _, _, _ := fixture(t)
	a.broker = &adminBroker{Broker: a.broker}
	if _, e := a.AdminControl(context.Background(), []byte(`{"operation":"role","subject":"42","administrator":true}`)); e != nil {
		t.Fatal(e)
	}
	if !a.isAdministrator("42") {
		t.Fatal("control role not visible to browser")
	}
	if _, e := a.AdminControl(context.Background(), []byte(`{"operation":"name","name":"Shared host"}`)); e != nil {
		t.Fatal(e)
	}
	if a.settingsView().Name != "Shared host" {
		t.Fatal("control name not visible")
	}
	if _, e := a.AdminControl(context.Background(), []byte(`{"operation":"role","subject":"44","administrator":true}`)); e == nil {
		t.Fatal("unbound role")
	}
}

func TestControlRemovesStaleRoleWithoutBroker(t *testing.T) {
	_, a, _, _, _ := fixture(t)
	broker := &adminBroker{Broker: a.broker}
	a.broker = broker
	if e := a.changeRole(context.Background(), "42", true); e != nil {
		t.Fatal(e)
	}
	broker.down = true
	if _, e := a.AdminControl(context.Background(), []byte(`{"operation":"role","subject":"42","administrator":false}`)); e != nil {
		t.Fatal(e)
	}
	if a.isAdministrator("42") {
		t.Fatal("broker outage preserved removed role")
	}
}

func TestAdministrationLostLiveFileDoesNotRestoreRole(t *testing.T) {
	h, a, _, _, _ := fixture(t)
	path := filepath.Join(t.TempDir(), "administration.json")
	if e := a.loadAdministration(path); e != nil {
		t.Fatal(e)
	}
	if e := a.changeDefaultLimitFor("", 1024*1024); e != nil {
		t.Fatal(e)
	}
	a.broker = &adminBroker{Broker: a.broker}
	if e := a.changeRole(context.Background(), "42", true); e != nil {
		t.Fatal(e)
	}
	state, flow := start(t, h)
	cookie := callback(h, state, flow).Result().Cookies()[1]
	if e := os.Remove(path); e != nil {
		t.Fatal(e)
	}
	if a.isAdministrator("42") {
		t.Fatal("lost state retained admin authority")
	}
	var session struct {
		CSRF string `json:"csrf"`
	}
	if e := json.Unmarshal(request(h, "GET", "/auth/session", cookie).Body.Bytes(), &session); e != nil {
		t.Fatal(e)
	}
	if code := adminPut(h, cookie, session.CSRF, `{"name":"unavailable"}`); code != 503 {
		t.Fatalf("lost state returned %d instead of unavailable", code)
	}
	if _, e := a.AdminControl(context.Background(), []byte(`{"operation":"show"}`)); !errors.Is(e, ErrAdministrationState) {
		t.Fatalf("control showed lost state: %v", e)
	}
	if e := a.changeRole(context.Background(), "42", true); e == nil {
		t.Fatal("lost state silently recreated with stale roles")
	}
	if _, e := os.Stat(path); !os.IsNotExist(e) {
		t.Fatal("lost state recreated")
	}
}

type delayedBody struct {
	entered, release chan struct{}
	bytes            []byte
	once             sync.Once
}

func (b *delayedBody) Read(p []byte) (int, error) {
	if len(b.bytes) == 0 {
		return 0, io.EOF
	}
	b.once.Do(func() { close(b.entered) })
	<-b.release
	n := copy(p, b.bytes)
	b.bytes = b.bytes[n:]
	return n, nil
}
func TestRemovedAdministratorCannotWriteFromInflightRequest(t *testing.T) {
	h, a, _, _, _ := fixture(t)
	a.broker = &adminBroker{Broker: a.broker}
	if e := a.changeRole(context.Background(), "42", true); e != nil {
		t.Fatal(e)
	}
	state, flow := start(t, h)
	cookie := callback(h, state, flow).Result().Cookies()[1]
	var session struct {
		CSRF string `json:"csrf"`
	}
	if e := json.Unmarshal(request(h, "GET", "/auth/session", cookie).Body.Bytes(), &session); e != nil {
		t.Fatal(e)
	}
	body := &delayedBody{entered: make(chan struct{}), release: make(chan struct{}), bytes: []byte(`{"name":"Inflight"}`)}
	r := httptest.NewRequest("PUT", "https://host.test/api/v1/server/administration", nil)
	r.Body = io.NopCloser(body)
	r.AddCookie(cookie)
	r.Header.Set("Origin", "https://host.test")
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("X-Agent-Host-CSRF", session.CSRF)
	done := make(chan int, 1)
	go func() { w := httptest.NewRecorder(); h.ServeHTTP(w, r); done <- w.Code }()
	<-body.entered
	if e := a.changeRole(context.Background(), "42", false); e != nil {
		t.Fatal(e)
	}
	close(body.release)
	if status := <-done; status != 403 {
		t.Fatalf("inflight write after role removal: %d", status)
	}
	if a.isAdministrator("42") || a.settingsView().Name == "Inflight" {
		t.Fatal("inflight request wrote after role removal")
	}
}

// bindingBroker answers LookupBound from the fake broker's own bindings, so a
// subject becomes bound exactly when its first ensure creates the binding.
type bindingBroker struct{ *fakeBroker }

func (b bindingBroker) ListBound(context.Context) ([]BoundUser, error) { return nil, nil }
func (b bindingBroker) LookupBound(_ context.Context, id string) (bool, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	_, ok := b.routes[id]
	return ok && !b.unbound[id], nil
}
func serverAdministrator(t *testing.T, h http.Handler, c *http.Cookie) bool {
	t.Helper()
	w := request(h, "GET", "/api/v1/server", c)
	var v struct {
		Administrator bool `json:"administrator"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil {
		t.Fatalf("server read: %d %s", w.Code, w.Body.String())
	}
	return v.Administrator
}

func TestDeclaredAdministratorGrantedAtBindingSignIn(t *testing.T) {
	h, a, p, _, _ := fixture(t)
	path := filepath.Join(t.TempDir(), "administration.json")
	if e := a.loadAdministration(path); e != nil {
		t.Fatal(e)
	}
	fb := newFakeBroker()
	fb.unbound = map[string]bool{"42": true, "43": true}
	a.broker = bindingBroker{fb}
	control := func(body string) {
		t.Helper()
		if _, e := a.AdminControl(context.Background(), []byte(body)); e != nil {
			t.Fatalf("%s: %v", body, e)
		}
	}
	// Root declares 42 before any binding exists: no role yet.
	control(`{"operation":"role_declared","subject":"42","administrator":true}`)
	if a.isAdministrator("42") {
		t.Fatal("declaration granted before binding")
	}
	var shown struct {
		Pending []string `json:"pending_administrators"`
	}
	b, _ := a.AdminControl(context.Background(), []byte(`{"operation":"show"}`))
	if json.Unmarshal(b, &shown) != nil || len(shown.Pending) != 1 || shown.Pending[0] != "42" {
		t.Fatalf("pending not shown: %s", b)
	}
	// The sign-in that creates 42's binding grants the role at once.
	state, flow := start(t, h)
	cookie := callback(h, state, flow).Result().Cookies()[1]
	if !serverAdministrator(t, h, cookie) {
		t.Fatal("declared administrator not granted at first sign-in")
	}
	// An undeclared person signing in never gains it.
	p.id, p.login = "43", "bob"
	state, flow = start(t, h)
	other := callback(h, state, flow).Result().Cookies()[1]
	if serverAdministrator(t, h, other) || a.isAdministrator("43") {
		t.Fatal("undeclared subject became administrator")
	}
	fresh := &Auth{}
	if e := fresh.loadAdministration(path); e != nil {
		t.Fatal(e)
	}
	if len(fresh.settings.Administrators) != 1 || fresh.settings.Administrators[0] != "42" || len(fresh.settings.PendingAdministrators) != 0 {
		t.Fatalf("grant not persisted: %+v", fresh.settings)
	}
	// Declaring a subject that is already bound grants it immediately.
	control(`{"operation":"role_declared","subject":"43","administrator":true}`)
	if !a.isAdministrator("43") || len(a.settingsView().PendingAdministrators) != 0 {
		t.Fatal("declaration of a bound subject not granted")
	}
	// Withdrawing a pending declaration before the binding means no grant.
	fb.routes["44"] = BrokerRoute{UID: 1003, Username: "carol", Socket: "/run/open-habitat/users/carol/daemon.sock"}
	fb.unbound["44"] = true
	control(`{"operation":"role_declared","subject":"44","administrator":true}`)
	control(`{"operation":"role","subject":"44","administrator":false}`)
	p.id, p.login = "44", "carol"
	state, flow = start(t, h)
	third := callback(h, state, flow).Result().Cookies()[1]
	if serverAdministrator(t, h, third) {
		t.Fatal("withdrawn declaration granted")
	}
	if len(a.settingsView().PendingAdministrators) != 0 {
		t.Fatal("role removal kept the pending declaration")
	}
	for _, body := range []string{`{"operation":"role_declared","subject":"x","administrator":true}`, `{"operation":"role_declared","subject":"45","administrator":false}`} {
		if _, e := a.AdminControl(context.Background(), []byte(body)); e == nil {
			t.Fatalf("accepted %s", body)
		}
	}
}

// The server's default language: the installation's, until an administrator
// chooses in Settings. Sign-in reads it with no session; only an
// administrator writes it.
func TestDefaultLanguage(t *testing.T) {
	h, a, _, _, _ := fixture(t)
	path := filepath.Join(t.TempDir(), "administration.json")
	if e := a.loadAdministration(path); e != nil {
		t.Fatal(e)
	}
	a.broker = &adminBroker{Broker: a.broker}
	read := func() string {
		t.Helper()
		w := request(h, "GET", "/api/v1/site/language")
		var reply struct {
			Version         int    `json:"schema_version"`
			DefaultLanguage string `json:"default_language"`
		}
		if w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" || json.Unmarshal(w.Body.Bytes(), &reply) != nil || reply.Version != 1 {
			t.Fatalf("site language: %d %s", w.Code, w.Body.String())
		}
		return reply.DefaultLanguage
	}
	if got := read(); got != "system" {
		t.Fatalf("unconfigured default: %q", got)
	}
	a.cfg.DefaultLanguage = "fi"
	if got := read(); got != "fi" {
		t.Fatalf("installation default: %q", got)
	}
	if w := request(h, "GET", "/api/v1/site/language?x=1"); w.Code != 400 {
		t.Fatalf("query accepted: %d", w.Code)
	}
	state, flow := start(t, h)
	cookie := callback(h, state, flow).Result().Cookies()[1]
	var session struct {
		CSRF string `json:"csrf"`
	}
	if e := json.Unmarshal(request(h, "GET", "/auth/session", cookie).Body.Bytes(), &session); e != nil {
		t.Fatal(e)
	}
	if code := adminPut(h, cookie, session.CSRF, `{"default_language":"en"}`); code != 403 {
		t.Fatalf("ordinary person set the default: %d", code)
	}
	if e := a.changeRole(context.Background(), "42", true); e != nil {
		t.Fatal(e)
	}
	for _, bad := range []string{`{"default_language":"sv"}`, `{"default_language":null}`, `{"default_language":"en","name":"x"}`} {
		if code := adminPut(h, cookie, session.CSRF, bad); code != 400 {
			t.Fatalf("%s: %d", bad, code)
		}
	}
	if code := adminPut(h, cookie, session.CSRF, `{"default_language":"en"}`); code != 204 {
		t.Fatalf("administrator write: %d", code)
	}
	if got := read(); got != "en" {
		t.Fatalf("administrator's choice did not replace the installation's: %q", got)
	}
	w := request(h, "GET", "/api/v1/server/administration", cookie)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"default_language":"en"`) {
		t.Fatalf("administration view: %d %s", w.Code, w.Body.String())
	}
	for _, language := range []string{"system", "fi", "en", "en-US", "en-GB"} {
		if code := adminPut(h, cookie, session.CSRF, `{"default_language":"`+language+`"}`); code != 204 {
			t.Fatalf("%s administrator write: %d", language, code)
		}
		if got := read(); got != language {
			t.Fatalf("public language = %q, want %q", got, language)
		}
		control, err := a.AdminControl(context.Background(), []byte(`{"operation":"show"}`))
		var settings struct {
			DefaultLanguage string `json:"default_language"`
		}
		if err != nil || json.Unmarshal(control, &settings) != nil || settings.DefaultLanguage != language {
			t.Fatalf("control read lost browser choice: %s, %v", control, err)
		}
		fresh := &Auth{}
		if e := fresh.loadAdministration(path); e != nil || fresh.settings.DefaultLanguage != language {
			t.Fatalf("restart lost the choice: %+v %v", fresh.settings, e)
		}
	}
}
