package main

import (
	"context"
	"errors"
	"net/url"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/gateway"
	"github.com/Open-Habitat/open-habitat/internal/integrationapps"
)

// The synthetic host's integrations file, as the broker keeps it: Google and
// Microsoft start set by root, so every other spec finds them in use, and
// Dropbox is the production entry, whose rclone the host lacks. The fixture
// Google and Microsoft entries are available exactly while their app is set,
// as the daemon reads the real file. /fixture/integration-apps switches
// root's browser_setup, delays the broker's writes so the waiting state can
// be seen, loses the next write's reply after committing it, or refuses the
// next write as host maintenance would.
type fixtureApps struct {
	mu    sync.Mutex
	apps  map[string]gateway.IntegrationApp
	off   bool
	delay time.Duration
	lose  bool
	busy  bool
}

func newFixtureApps() *fixtureApps {
	return &fixtureApps{apps: map[string]gateway.IntegrationApp{
		"google":    {Provider: "google", ClientID: "704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com", Usable: true, Source: "operator"},
		"microsoft": {Provider: "microsoft", ClientID: "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3", TenantID: "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903", Usable: true, Source: "operator"},
	}}
}

var appFixture = newFixtureApps()

// set reports whether provider's app is in the file.
func (f *fixtureApps) set(provider string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	_, ok := f.apps[provider]
	return ok
}

func (f *fixtureApps) fixture(q url.Values) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for key, values := range q {
		v := values[0]
		switch {
		case key == "setup" && (v == "on" || v == "off"):
			f.off = v == "off"
		case key == "delay":
			ms, err := strconv.Atoi(v)
			if err != nil || ms < 0 || ms > 5000 {
				return errors.New("bad delay")
			}
			f.delay = time.Duration(ms) * time.Millisecond
		case key == "lose" && v == "1":
			f.lose = true
		case key == "busy" && v == "1":
			f.busy = true
		case key == "clear" && slices.Contains(integrationapps.Providers, v):
			delete(f.apps, v)
		default:
			return errors.New("unknown integration-apps fixture")
		}
	}
	return nil
}

func (f *fixtureApps) pageLocked() gateway.IntegrationApps {
	page := gateway.IntegrationApps{BrowserSetup: !f.off, Apps: []gateway.IntegrationApp{}}
	for _, p := range integrationapps.Providers {
		if a, ok := f.apps[p]; ok {
			page.Apps = append(page.Apps, a)
		}
	}
	return page
}

func (b *fixtureBroker) IntegrationList(context.Context) (gateway.IntegrationApps, error) {
	appFixture.mu.Lock()
	defer appFixture.mu.Unlock()
	return appFixture.pageLocked(), nil
}

func (b *fixtureBroker) writeApp(ctx context.Context, provider string, fields map[string]string, actor string) (gateway.IntegrationApps, error) {
	appFixture.mu.Lock()
	delay := appFixture.delay
	appFixture.mu.Unlock()
	select {
	case <-ctx.Done():
		return gateway.IntegrationApps{}, gateway.ErrIntegrationUncertain
	case <-time.After(delay):
	}
	appFixture.mu.Lock()
	defer appFixture.mu.Unlock()
	switch {
	case appFixture.off:
		return gateway.IntegrationApps{}, gateway.ErrBrowserSetupOff
	case appFixture.busy:
		appFixture.busy = false
		return gateway.IntegrationApps{}, gateway.ErrHostBusy
	case fields != nil && !integrationapps.Valid(provider, fields):
		return gateway.IntegrationApps{}, gateway.ErrIntegrationRefused
	}
	if fields == nil {
		delete(appFixture.apps, provider)
	} else {
		appFixture.apps[provider] = gateway.IntegrationApp{Provider: provider, ClientID: fields["client_id"], TenantID: fields["tenant_id"], Usable: true, Source: "site_admin", Actor: actor, At: time.Now().UTC().Truncate(time.Second).Format(time.RFC3339)}
	}
	if appFixture.lose {
		appFixture.lose = false
		return gateway.IntegrationApps{}, gateway.ErrIntegrationUncertain
	}
	return appFixture.pageLocked(), nil
}

func (b *fixtureBroker) SetIntegrationApp(ctx context.Context, provider string, fields map[string]string, actor string) (gateway.IntegrationApps, error) {
	return b.writeApp(ctx, provider, fields, actor)
}

func (b *fixtureBroker) ClearIntegrationApp(ctx context.Context, provider, actor string) (gateway.IntegrationApps, error) {
	return b.writeApp(ctx, provider, nil, actor)
}
