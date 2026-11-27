//go:build linux

package integrations

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
)

// connectedSyncing signs the synthetic person in at the tenant and gives
// the connection the OneDrive and library roots of an earlier release.
func connectedSyncing(t *testing.T, env Env) string {
	t.Helper()
	m := syntheticMicrosoft(t, "person@example.test", "")
	l := msLogin(t, m, env, "")
	name, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), name); err != nil {
		t.Fatal(err)
	}
	earlierRoots(t, m, env, name, LevelFull, earlierFullGrant)
	_ = os.Remove(filepath.Join(env.Home, "pi-commands"))
	return name
}

// syncingOneDrive makes the account's OneDrive pair ready and supervised.
func syncingOneDrive(t *testing.T, c *Catalog, env Env, address string) key {
	t.Helper()
	work := filepath.Join(env.Home, microsoftWork(address, "onedrive"))
	if err := os.MkdirAll(work, 0700); err != nil {
		t.Fatal(err)
	}
	for _, side := range []string{"path1", "path2"} {
		if err := os.WriteFile(filepath.Join(work, "local..onedrive."+side+".lst"), []byte("native listing\n"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	c.write.Lock()
	c.reconcile()
	c.write.Unlock()
	t.Cleanup(c.sync.stopAll)
	k := key{Microsoft, address}
	if !c.sync.supervised(k) {
		t.Fatal("fixture: OneDrive not supervised")
	}
	return k
}

// offline is a Microsoft entry that fails the test on any request: nothing
// here may ask a tenant.
func offline(t *testing.T) *microsoft {
	t.Helper()
	return &microsoft{client: &http.Client{Transport: dropboxTransport(func(r *http.Request) (*http.Response, error) {
		t.Errorf("unexpected request to %s", r.URL.Host)
		return nil, fmt.Errorf("offline")
	})}}
}

// tokenEndpoint answers refresh grants at /<tenant>/oauth2/v2.0/token with
// reply and counts them; every other OAuth or Graph request fails the test.
func tokenEndpoint(t *testing.T, status int, reply string) (*microsoft, *atomic.Int32) {
	t.Helper()
	var calls atomic.Int32
	return &microsoft{client: &http.Client{Transport: dropboxTransport(func(r *http.Request) (*http.Response, error) {
		_ = r.ParseForm()
		if r.URL.Host != "login.microsoftonline.com" || r.URL.Path != "/"+testTenant+"/oauth2/v2.0/token" {
			t.Errorf("refresh went to %s", r.URL)
		}
		if r.Form.Get("grant_type") != "refresh_token" || r.Form.Get("refresh_token") != "refresh-secret" || r.Form.Get("client_id") != "00000000-0000-0000-0000-000000000001" || r.Form.Get("client_secret") != "" {
			t.Errorf("refresh form %v", r.Form)
		}
		calls.Add(1)
		return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(reply))}, nil
	})}}, &calls
}

// Changing the operator's tenant does not move a connection: nothing is
// redeemed anywhere, the files stay as they are, the card says the
// organisation is no longer available here and its tools stop at the next
// call. Putting the tenant back resumes it without a sign-in.
func TestMicrosoftTenantChangeMovesNothingAndReportsTenantRemoved(t *testing.T) {
	env := microsoftEnv(t)
	name := connectedSyncing(t, env)
	m := offline(t)
	c := New(env, []Entry{m}, nil)
	snapshot := func() map[string]string {
		out := map[string]string{}
		for _, rel := range []string{microsoftDir + "/" + name + ".conf", ".pi/agent/mcp.json"} {
			data, err := os.ReadFile(filepath.Join(env.Home, rel))
			if err != nil {
				t.Fatal(err)
			}
			out[rel] = string(data)
		}
		return out
	}
	before := snapshot()
	if _, err := microsoftBinding(env, name); err != nil {
		t.Fatal("fixture: binding", err)
	}

	moved := env.Config
	moved.Microsoft = &MicrosoftApp{ClientID: env.Config.Microsoft.ClientID, TenantID: "00000000-0000-4000-8000-0000000000bb"}
	env.Config = moved
	c.env = env
	if m.Misaligned(env, name) {
		t.Fatal("a removed tenant asked Align to act")
	}
	account := c.check(context.Background(), m, name)
	if len(account.Services) == 0 {
		t.Fatal("no services")
	}
	for _, s := range account.Services {
		if s.State != StateLoginExpired || s.Failure != TenantRemoved {
			t.Fatal("tenant_removed not shown", account.Services)
		}
	}
	if account.Address != "person@example.test" {
		t.Fatal("contract address", account.Address)
	}
	if fmt.Sprint(snapshot()) != fmt.Sprint(before) {
		t.Fatal("a removed tenant changed the connection's files")
	}
	if _, err := microsoftBinding(env, name); err == nil {
		t.Fatal("a removed tenant's tools still bind")
	}
	if _, err := m.StartLevelLogin(context.Background(), env, name, ""); err == nil {
		t.Fatal("a renewal signed in at another tenant")
	}

	env.Config = microsoftEnv(t).Config
	env.Config.Tools = moved.Tools
	c.env = env
	for _, s := range c.check(context.Background(), m, name).Services {
		if s.Failure == TenantRemoved {
			t.Fatal("tenant added back still refused", s)
		}
	}
	if _, err := microsoftBinding(env, name); err != nil {
		t.Fatal("tenant added back does not bind", err)
	}
}

// Another application at the same tenant asks for a sign-in, which goes to
// the connection's own tenant and repairs it.
func TestMicrosoftAppChangedAtTheTenantSignsInAgain(t *testing.T) {
	env := microsoftEnv(t)
	name := connectedSyncing(t, env)
	m := offline(t)
	c := New(env, []Entry{m}, nil)
	conf := filepath.Join(env.Home, microsoftDir, name+".conf")
	data, _ := os.ReadFile(conf)
	if err := os.WriteFile(conf, []byte(strings.ReplaceAll(string(data), "client_id = 00000000-0000-0000-0000-000000000001", "client_id = 00000000-0000-0000-0000-000000000009")), 0600); err != nil {
		t.Fatal(err)
	}
	for _, s := range c.check(context.Background(), m, name).Services {
		if s.State != StateLoginExpired || s.Failure != AppChanged {
			t.Fatal("app_changed not shown", s)
		}
	}
	l := msLogin(t, syntheticMicrosoft(t, "person@example.test", ""), env, name)
	got, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil || got != name {
		t.Fatal(got, err)
	}
	if err := l.Commit(context.Background(), got); err != nil {
		t.Fatal(err)
	}
	for _, s := range c.check(context.Background(), m, name).Services {
		if s.State == StateLoginExpired {
			t.Fatal("app_changed outlived the new sign-in", s)
		}
	}
}

// The verification's outside_tenant answer says signing in cannot help.
func TestMicrosoftOutsideTenantIsShown(t *testing.T) {
	env := microsoftEnv(t)
	name := connectedSyncing(t, env)
	if err := os.Remove(filepath.Join(env.Home, microsoftDir, name+".conf")); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), []byte(`{"state":"outside_tenant"}`), 0600); err != nil {
		t.Fatal(err)
	}
	m := offline(t)
	c := New(env, []Entry{m}, nil)
	for _, s := range c.check(context.Background(), m, name).Services {
		if s.State != StateLoginExpired || s.Failure != OutsideTenant {
			t.Fatal("outside_tenant not shown", s)
		}
	}
}
