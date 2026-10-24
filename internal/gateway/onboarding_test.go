package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func onboardingPut(h http.Handler, c *http.Cookie, csrf, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("PUT", "https://host.test/api/v1/server/onboarding", strings.NewReader(body))
	r.AddCookie(c)
	r.Header.Set("Origin", "https://host.test")
	r.Header.Set("X-Agent-Host-CSRF", csrf)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func errorCode(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var reply struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if json.Unmarshal(w.Body.Bytes(), &reply) != nil {
		t.Fatalf("not an error envelope: %s", w.Body.String())
	}
	return reply.Error.Code
}

// signedIn returns an administrator's cookie and CSRF on a persisted state file.
func signedIn(t *testing.T) (http.Handler, *Auth, *http.Cookie, string, string) {
	t.Helper()
	h, a, _, _, _ := fixture(t)
	path := filepath.Join(t.TempDir(), "administration.json")
	if e := a.loadAdministration(path); e != nil {
		t.Fatal(e)
	}
	// Login needs a default quota for the account it may create.
	if e := a.changeDefaultLimitFor("", 1024*1024); e != nil {
		t.Fatal(e)
	}
	a.broker = &adminBroker{Broker: a.broker}
	state, flow := start(t, h)
	cookie := callback(h, state, flow).Result().Cookies()[1]
	var session struct {
		CSRF string `json:"csrf"`
	}
	if e := json.Unmarshal(request(h, "GET", "/auth/session", cookie).Body.Bytes(), &session); e != nil {
		t.Fatal(e)
	}
	if e := a.changeRole(context.Background(), "42", true); e != nil {
		t.Fatal(e)
	}
	return h, a, cookie, session.CSRF, path
}

const onboardingBody = `{"repositories":{"mode":"auto","defaults":["example-org/product","example-org/infra"]},"integrations":[{"provider":"dropbox","required":false},{"provider":"google","required":true}],"ai_account":{"offer":"claude"}}`

func withExpected(body string, version int) string {
	return fmt.Sprintf(`{"expected_version":%d,%s`, version, strings.TrimPrefix(body, "{"))
}

func TestOnboardingRoundTripBrowserAndControl(t *testing.T) {
	h, a, cookie, csrf, path := signedIn(t)
	w := request(h, "GET", "/api/v1/server/onboarding", cookie)
	var got onboardingReply
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got) != nil || got.Version != 0 || got.Repositories.Mode != "preselected" || got.Integrations == nil || len(got.Integrations) != 0 || got.AIAccount.Offer != "all" {
		t.Fatalf("default onboarding: %d %s", w.Code, w.Body.String())
	}
	w = onboardingPut(h, cookie, csrf, withExpected(onboardingBody, 0))
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got) != nil || got.Version != 1 {
		t.Fatalf("browser write: %d %s", w.Code, w.Body.String())
	}
	// Integrations are kept in catalog order, not the order they were given.
	if got.Integrations[0].Provider != "google" || !got.Integrations[0].Required || got.Integrations[1].Provider != "dropbox" {
		t.Fatalf("integration order: %+v", got.Integrations)
	}
	// Root sees the browser's write and writes the next version through the same writer.
	b, e := a.AdminControl(context.Background(), []byte(`{"operation":"onboarding_show"}`))
	var control onboardingConfig
	if e != nil || json.Unmarshal(b, &control) != nil || control.Version != 1 || control.Repositories.Defaults[1] != "example-org/infra" {
		t.Fatalf("control read: %s %v", b, e)
	}
	b, e = a.AdminControl(context.Background(), []byte(`{"operation":"onboarding_update","expected_version":1,"document":{"repositories":{"mode":"skip","defaults":[]},"integrations":[],"ai_account":{"offer":"all"}}}`))
	if e != nil || json.Unmarshal(b, &control) != nil || control.Version != 2 {
		t.Fatalf("control write: %s %v", b, e)
	}
	w = request(h, "GET", "/api/v1/server/onboarding", cookie)
	if json.Unmarshal(w.Body.Bytes(), &got) != nil || got.Version != 2 || got.Repositories.Mode != "skip" || len(got.Integrations) != 0 {
		t.Fatalf("browser read after control write: %s", w.Body.String())
	}
	// A browser write naming the version it read before the control write is a conflict.
	if w = onboardingPut(h, cookie, csrf, withExpected(onboardingBody, 1)); w.Code != 409 || errorCode(t, w) != "version_conflict" {
		t.Fatalf("stale browser write: %d %s", w.Code, w.Body.String())
	}
	// The record survives a restart, and the settings view root's host apply
	// reads does not carry it.
	fresh := &Auth{}
	if e := fresh.loadAdministration(path); e != nil {
		t.Fatal(e)
	}
	if c, ok := fresh.onboardingView(); !ok || c.Version != 2 || c.Repositories.Mode != "skip" {
		t.Fatalf("restart lost onboarding: %+v", c)
	}
	b, _ = a.AdminControl(context.Background(), []byte(`{"operation":"show"}`))
	if strings.Contains(string(b), "onboarding") {
		t.Fatalf("settings show carries onboarding: %s", b)
	}
}

// The browser and root's control socket reject the same documents with the
// same reason, and neither writes anything.
func TestOnboardingRejectionsIdenticalOnBothPaths(t *testing.T) {
	h, a, cookie, csrf, _ := signedIn(t)
	defaults := make([]string, 21)
	for i := range defaults {
		defaults[i] = fmt.Sprintf(`"example-org/repo-%d"`, i)
	}
	doc := func(mode, defaults, integrations, offer string) string {
		return fmt.Sprintf(`{"repositories":{"mode":%q,"defaults":[%s]},"integrations":[%s],"ai_account":{"offer":%q}}`, mode, defaults, integrations, offer)
	}
	cases := []struct {
		name, document string
		expected       int
		reason         string
		status         int
	}{
		{"version conflict", doc("auto", "", "", "all"), 3, "version_conflict", 409},
		{"invalid name", doc("auto", `"example-org/../x"`, "", "all"), 0, "invalid_repository_name", 400},
		{"owner with leading hyphen", doc("auto", `"-org/x"`, "", "all"), 0, "invalid_repository_name", 400},
		{"no slash", doc("auto", `"example-org"`, "", "all"), 0, "invalid_repository_name", 400},
		{"too many defaults", doc("auto", strings.Join(defaults, ","), "", "all"), 0, "too_many_defaults", 400},
		{"duplicate default", doc("auto", `"example-org/x","Example-Org/X"`, "", "all"), 0, "duplicate_default", 400},
		{"same destination", doc("auto", `"team-a/docs","team-b/Docs"`, "", "all"), 0, "duplicate_destination", 400},
		{"unknown provider", doc("auto", "", `{"provider":"slack","required":false}`, "all"), 0, "unknown_provider", 400},
		{"duplicate provider", doc("auto", "", `{"provider":"google","required":false},{"provider":"google","required":true}`, "all"), 0, "duplicate_provider", 400},
		{"unknown mode", doc("always", "", "", "all"), 0, "invalid_mode", 400},
		{"unknown offer", doc("auto", "", "", "gemini"), 0, "invalid_offer", 400},
		{"site key without a key", doc("auto", "", "", "site_key"), 0, "site_key_unavailable", 400},
		{"missing defaults", `{"repositories":{"mode":"auto"},"integrations":[],"ai_account":{"offer":"all"}}`, 0, "invalid_document", 400},
		{"missing required", doc("auto", "", `{"provider":"google"}`, "all"), 0, "invalid_document", 400},
		{"null required", doc("auto", "", `{"provider":"google","required":null}`, "all"), 0, "invalid_document", 400},
		{"unknown field", `{"repositories":{"mode":"auto","defaults":[]},"integrations":[],"ai_account":{"offer":"all"},"steps":[]}`, 0, "invalid_document", 400},
	}
	for _, c := range cases {
		w := onboardingPut(h, cookie, csrf, withExpected(c.document, c.expected))
		if w.Code != c.status || errorCode(t, w) != c.reason {
			t.Errorf("%s: browser %d %s", c.name, w.Code, w.Body.String())
		}
		for _, op := range []string{"onboarding_check", "onboarding_update"} {
			_, e := a.AdminControl(context.Background(), []byte(fmt.Sprintf(`{"operation":%q,"expected_version":%d,"document":%s}`, op, c.expected, c.document)))
			if e == nil || AdminControlError(e) != c.reason {
				t.Errorf("%s: control %s: %v", c.name, op, e)
			}
		}
	}
	if c, _ := a.onboardingView(); c.Version != 0 {
		t.Fatalf("a rejected document was written: %+v", c)
	}
}

func TestOnboardingBrowserWriteNeedsAdministratorAndCSRF(t *testing.T) {
	h, a, cookie, csrf, _ := signedIn(t)
	if w := onboardingPut(h, cookie, "wrong", withExpected(onboardingBody, 0)); w.Code != 403 || errorCode(t, w) != "csrf_denied" {
		t.Fatalf("csrf: %d %s", w.Code, w.Body.String())
	}
	if w := onboardingPut(h, cookie, csrf, onboardingBody); w.Code != 400 || errorCode(t, w) != "invalid_document" {
		t.Fatalf("missing expected_version: %d %s", w.Code, w.Body.String())
	}
	// A show reply's version is not a write precondition; expected_version is.
	if w := onboardingPut(h, cookie, csrf, withExpected(`{"version":0,`+strings.TrimPrefix(onboardingBody, "{"), 0)); w.Code != 400 {
		t.Fatalf("version field accepted: %d %s", w.Code, w.Body.String())
	}
	if e := a.changeRole(context.Background(), "42", false); e != nil {
		t.Fatal(e)
	}
	if w := onboardingPut(h, cookie, csrf, withExpected(onboardingBody, 0)); w.Code != 403 || errorCode(t, w) != "admin_required" {
		t.Fatalf("ordinary write: %d %s", w.Code, w.Body.String())
	}
	if w := request(h, "GET", "/api/v1/server/onboarding", cookie); w.Code != 403 {
		t.Fatalf("ordinary admin read: %d", w.Code)
	}
	// Removal between the role check and the write is caught under the writer lock.
	if _, e := a.updateOnboardingFor("42", 0, defaultOnboarding().onboardingDocument); !errors.Is(e, errAdminDenied) {
		t.Fatalf("removed administrator wrote: %v", e)
	}
	if request(h, "GET", "/api/v1/onboarding/site", cookie).Code != 200 {
		t.Fatal("person read refused for an ordinary person")
	}
	if request(h, "GET", "/api/v1/onboarding/site").Code != 401 {
		t.Fatal("person read without a session")
	}
}

// The person-side read carries the steps and the offer, never the defaults.
func TestSiteOnboardingOmitsDefaults(t *testing.T) {
	h, a, cookie, _, _ := signedIn(t)
	if _, e := a.updateOnboardingFor("", 0, onboardingDocument{
		Repositories: onboardingRepositories{Mode: "auto", Defaults: []string{"example-org/secret-infra"}},
		Integrations: []onboardingIntegration{{Provider: "microsoft", Required: true}},
		AIAccount:    onboardingAIAccount{Offer: "deepseek_key"},
	}); e != nil {
		t.Fatal(e)
	}
	w := request(h, "GET", "/api/v1/onboarding/site", cookie)
	if w.Code != 200 || strings.Contains(w.Body.String(), "secret-infra") || strings.Contains(w.Body.String(), "defaults") {
		t.Fatalf("person read: %d %s", w.Code, w.Body.String())
	}
	var v map[string]any
	if json.Unmarshal(w.Body.Bytes(), &v) != nil {
		t.Fatal(w.Body.String())
	}
	want := `{"ai_account":{"offer":"deepseek_key"},"integrations":[{"provider":"microsoft","required":true}],"repositories":{"mode":"auto"},"schema_version":1}`
	if b, _ := json.Marshal(v); string(b) != want {
		t.Fatalf("person read shape: %s", b)
	}
}

// host apply converges names, default quotas and roles through the control
// operations; none of them touches the onboarding configuration.
func TestHostApplyOperationsLeaveOnboardingUnchanged(t *testing.T) {
	_, a, _, _, path := signedIn(t)
	if _, e := a.updateOnboardingFor("", 0, onboardingDocument{
		Repositories: onboardingRepositories{Mode: "skip", Defaults: []string{"example-org/product"}},
		Integrations: []onboardingIntegration{},
		AIAccount:    onboardingAIAccount{Offer: "chatgpt"},
	}); e != nil {
		t.Fatal(e)
	}
	before, _ := a.onboardingView()
	for _, op := range []string{
		`{"operation":"show"}`,
		`{"operation":"name","name":"Applied host"}`,
		`{"operation":"default_limit","default_limit_bytes":1073741824}`,
		`{"operation":"role","subject":"43","administrator":true}`,
		`{"operation":"role","subject":"43","administrator":false}`,
	} {
		if _, e := a.AdminControl(context.Background(), []byte(op)); e != nil {
			t.Fatalf("%s: %v", op, e)
		}
	}
	after, _ := a.onboardingView()
	b1, _ := json.Marshal(before)
	b2, _ := json.Marshal(after)
	if string(b1) != string(b2) {
		t.Fatalf("apply operations changed onboarding: %s -> %s", b1, b2)
	}
	fresh := &Auth{}
	if e := fresh.loadAdministration(path); e != nil {
		t.Fatal(e)
	}
	if c, _ := fresh.onboardingView(); c.Version != before.Version || c.Repositories.Defaults[0] != "example-org/product" {
		t.Fatalf("persisted onboarding changed: %+v", c)
	}
}

func TestStoredOnboardingMustBeCanonical(t *testing.T) {
	path := filepath.Join(t.TempDir(), "administration.json")
	for _, record := range []string{
		`{"version":1,"name":"","administrators":[],"onboarding":{"version":1,"repositories":{"mode":"auto","defaults":[]},"integrations":[{"provider":"dropbox","required":false},{"provider":"google","required":false}],"ai_account":{"offer":"all"}}}`,
		`{"version":1,"name":"","administrators":[],"onboarding":{"version":0,"repositories":{"mode":"auto","defaults":[]},"integrations":[],"ai_account":{"offer":"all"}}}`,
		`{"version":1,"name":"","administrators":[],"onboarding":{"version":1,"repositories":{"mode":"auto","defaults":[]},"integrations":[],"ai_account":{"offer":"site_key"}}}`,
	} {
		if e := os.WriteFile(path, []byte(record), 0600); e != nil {
			t.Fatal(e)
		}
		if e := (&Auth{}).loadAdministration(path); e == nil {
			t.Fatalf("accepted %s", record)
		}
	}
}
