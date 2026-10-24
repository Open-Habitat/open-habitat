package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const (
	fakeGoogleID     = "704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com"
	fakeGoogleSecret = "GOCSPX-gateway-sentinel"
)

// integrationFake is the broker's integration surface: it records what was
// relayed and can refuse, or commit and lose its reply.
type integrationFake struct {
	*accessFake
	apps    map[string]IntegrationApp
	setup   bool
	refuse  error
	lose    bool
	relayed []map[string]string
	actors  []string
}

func (b *integrationFake) page() IntegrationApps {
	out := IntegrationApps{BrowserSetup: b.setup}
	for _, p := range []string{"google", "microsoft", "dropbox"} {
		if a, ok := b.apps[p]; ok {
			out.Apps = append(out.Apps, a)
		}
	}
	return out
}
func (b *integrationFake) IntegrationList(context.Context) (IntegrationApps, error) {
	return b.page(), nil
}
func (b *integrationFake) write(provider string, fields map[string]string, actor string) (IntegrationApps, error) {
	b.relayed, b.actors = append(b.relayed, fields), append(b.actors, actor)
	if b.refuse != nil {
		return IntegrationApps{}, b.refuse
	}
	if fields == nil {
		delete(b.apps, provider)
	} else {
		b.apps[provider] = IntegrationApp{Provider: provider, ClientID: fields["client_id"], Usable: true, Source: "site_admin", Actor: actor, At: "2026-10-24T12:00:00Z"}
	}
	if b.lose {
		b.lose = false
		return IntegrationApps{}, ErrIntegrationUncertain
	}
	return b.page(), nil
}
func (b *integrationFake) SetIntegrationApp(_ context.Context, provider string, fields map[string]string, actor string) (IntegrationApps, error) {
	return b.write(provider, fields, actor)
}
func (b *integrationFake) ClearIntegrationApp(_ context.Context, provider, actor string) (IntegrationApps, error) {
	return b.write(provider, nil, actor)
}

func newIntegrationHarness(t *testing.T, log *bytes.Buffer) (*accessHarness, *integrationFake) {
	t.Helper()
	x := newAccessHarness(t)
	fake := &integrationFake{accessFake: x.broker, apps: map[string]IntegrationApp{}, setup: true}
	now := time.Date(2026, 10, 24, 9, 0, 0, 0, time.UTC)
	a, e := NewAuth(OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: x.provider, Sink: x.sink, Broker: fake, Now: func() time.Time { return now }, SessionFile: filepath.Join(x.dir, "sessions.json"), AdminFile: filepath.Join(x.dir, "administration.json"), Log: slog.New(slog.NewJSONHandler(log, nil))})
	if e != nil {
		t.Fatal(e)
	}
	x.auth, x.h = a, NewWithAuth("", a)
	return x, fake
}

func googleBody(secret string) string {
	return `{"provider":"google","fields":{"client_id":"` + fakeGoogleID + `","client_secret":"` + secret + `"}}`
}

// Only a current administrator with the session's CSRF proof reaches the
// broker; what is relayed is exactly the validated section, and the actor
// is the administrator's id, never a value from the request.
func TestIntegrationAppsAdministratorRelay(t *testing.T) {
	var logged bytes.Buffer
	x, broker := newIntegrationHarness(t, &logged)
	alice := x.login("42", "alice")
	csrf := extractCSRF(t, request(x.h, "GET", "/auth/session", alice).Body.String())
	bob := x.login("43", "bob")
	bobCSRF := extractCSRF(t, request(x.h, "GET", "/auth/session", bob).Body.String())
	if w := request(x.h, "GET", integrationAppsPath, bob); w.Code != 403 {
		t.Fatal("non-administrator listed", w.Code)
	}
	if w := accessPost(x.h, bob, bobCSRF, integrationAppsPath+"/set", googleBody(fakeGoogleSecret)); w.Code != 403 || len(broker.relayed) != 0 {
		t.Fatal("non-administrator set", w.Code)
	}
	if w := accessPost(x.h, alice, "wrong", integrationAppsPath+"/set", googleBody(fakeGoogleSecret)); w.Code != 403 || len(broker.relayed) != 0 {
		t.Fatal("CSRF bypass", w.Code)
	}
	for _, body := range []string{
		`{"provider":"google","fields":{"client_id":"abc","client_secret":"x"}}`,
		`{"provider":"slack","fields":{"client_id":"a","client_secret":"b"}}`,
		googleBody(fakeGoogleSecret)[:len(googleBody(fakeGoogleSecret))-1] + `,"actor":"1"}`,
		`{"provider":"google"}`,
	} {
		if w := accessPost(x.h, alice, csrf, integrationAppsPath+"/set", body); w.Code != 400 {
			t.Fatal("invalid set relayed", body, w.Code)
		}
	}
	if w := accessPost(x.h, alice, csrf, integrationAppsPath+"/clear", googleBody(fakeGoogleSecret)); w.Code != 400 {
		t.Fatal("clear with fields", w.Code)
	}
	if len(broker.relayed) != 0 {
		t.Fatal("invalid request reached the broker")
	}
	w := accessPost(x.h, alice, csrf, integrationAppsPath+"/set", googleBody(fakeGoogleSecret))
	var view struct {
		SchemaVersion int  `json:"schema_version"`
		BrowserSetup  bool `json:"browser_setup"`
		Apps          []struct{ Provider, ClientID, Actor string }
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &view) != nil || len(view.Apps) != 1 || view.Apps[0].Actor != "42" {
		t.Fatal(w.Code, w.Body.String())
	}
	if len(broker.relayed) != 1 || broker.relayed[0]["client_secret"] != fakeGoogleSecret || broker.actors[0] != "42" {
		t.Fatal("relay", broker.relayed, broker.actors)
	}
	// The role is checked as current: a demoted administrator's still-live
	// session can no longer write.
	if e := x.auth.changeRole(context.Background(), "42", false); e != nil {
		t.Fatal(e)
	}
	if w = accessPost(x.h, alice, csrf, integrationAppsPath+"/clear", `{"provider":"google"}`); w.Code != 403 || len(broker.relayed) != 1 {
		t.Fatal("demoted administrator cleared", w.Code)
	}
	if strings.Contains(logged.String(), fakeGoogleSecret) || !strings.Contains(logged.String(), `"provider":"google"`) {
		t.Fatalf("gateway log: %s", logged.String())
	}
}

// Each broker outcome reaches the browser and root's control socket as one
// fixed code; a lost reply is uncertain, not a failure, and is not retried.
func TestIntegrationAppsOutcomes(t *testing.T) {
	var logged bytes.Buffer
	x, broker := newIntegrationHarness(t, &logged)
	alice := x.login("42", "alice")
	csrf := extractCSRF(t, request(x.h, "GET", "/auth/session", alice).Body.String())
	for err, code := range map[error]string{ErrBrowserSetupOff: "browser_setup_disabled", ErrHostBusy: "host_busy", ErrIntegrationsFile: "integrations_file_invalid", ErrIntegrationRefused: "integration_refused"} {
		broker.refuse = err
		if w := accessPost(x.h, alice, csrf, integrationAppsPath+"/set", googleBody(fakeGoogleSecret)); w.Code != 409 || !strings.Contains(w.Body.String(), code) {
			t.Fatal(code, w.Code, w.Body.String())
		}
		if _, e := x.auth.AdminControl(context.Background(), []byte(`{"operation":"integration_clear","provider":"google"}`)); AdminControlError(e) != code {
			t.Fatal("control", code, e)
		}
	}
	broker.refuse, broker.lose = nil, true
	before := len(broker.relayed)
	if w := accessPost(x.h, alice, csrf, integrationAppsPath+"/set", googleBody(fakeGoogleSecret)); w.Code != 503 || !strings.Contains(w.Body.String(), "outcome_uncertain") || len(broker.relayed) != before+1 {
		t.Fatal("lost reply", w.Code, w.Body.String())
	}
	// Root's control socket writes as root.
	b, err := x.auth.AdminControl(context.Background(), []byte(`{"operation":"integration_set","provider":"dropbox","fields":{"client_id":"p3n8vq1zt6ka0rw","client_secret":"h2m5c9xj4ub7ye1"}}`))
	if err != nil || !strings.Contains(string(b), `"actor":"root"`) || strings.Contains(string(b), "h2m5c9xj4ub7ye1") {
		t.Fatal(string(b), err)
	}
	if _, err = x.auth.AdminControl(context.Background(), []byte(`{"operation":"integration_set","provider":"dropbox","fields":{"client_id":"same","client_secret":"same"}}`)); AdminControlError(err) != "invalid_request" {
		t.Fatal("invalid control set", err)
	}
	if b, err = x.auth.AdminControl(context.Background(), []byte(`{"operation":"integration_list"}`)); err != nil || !strings.Contains(string(b), `"browser_setup":true`) {
		t.Fatal(string(b), err)
	}
}
