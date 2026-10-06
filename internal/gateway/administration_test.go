package gateway

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
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
	if code := adminPut(h, cookie, session.CSRF, `{"subject":"43","administrator":true}`); code != 204 {
		t.Fatalf("role update: %d", code)
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
	if code := adminPut(h, cookie, session.CSRF, `{"subject":"43","administrator":false}`); code != 503 {
		t.Fatalf("broker failure: %d", code)
	}
	broker.down = false
	if code := adminPut(h, cookie, session.CSRF, `{"subject":"42","administrator":false}`); code != 204 {
		t.Fatalf("self removal: %d", code)
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
