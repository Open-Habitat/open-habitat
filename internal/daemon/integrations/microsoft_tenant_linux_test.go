//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// connectedWithCommon signs an account in through the current tenant and then
// puts its native configs back to the state an earlier release wrote: every
// remote and the Pi registration on `common`, the stored grant refresh-secret.
func connectedWithCommon(t *testing.T, env Env, client string) string {
	t.Helper()
	m := syntheticMicrosoft(t, "person@example.test", "")
	l := msLogin(t, m, env, "")
	address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	conf := filepath.Join(env.Home, microsoftDir, address+".conf")
	data, err := os.ReadFile(conf)
	if err != nil {
		t.Fatal(err)
	}
	// A blank line inside a section is valid rclone syntax.
	old := strings.ReplaceAll(string(data), "tenant = "+testTenant, "\ntenant = common")
	old = strings.ReplaceAll(old, "client_id = 00000000-0000-0000-0000-000000000001", "client_id = "+client)
	// The roots are aliases of the one account remote that signs in.
	if strings.Count(old, "tenant = common") != 1 || strings.Count(old, "type = alias") != 2 {
		t.Fatal("fixture: expected the account remote with OneDrive and one library")
	}
	if err := os.WriteFile(conf, []byte(old), 0600); err != nil {
		t.Fatal(err)
	}
	registration := fmt.Sprintf(`{"mcpServers":{%q:{"command":"/x","env":{"MS365_MCP_CLIENT_ID":%q,"MS365_MCP_TENANT_ID":"common","MS365_MCP_TOKEN_CACHE_PATH":%q}}}}`, microsoftPlainServer(address), client, microsoftTestCache(env, address))
	if err := os.WriteFile(filepath.Join(env.Home, ".pi/agent/mcp.json"), []byte(registration), 0600); err != nil {
		t.Fatal(err)
	}
	_ = os.Remove(filepath.Join(env.Home, "pi-commands"))
	return address
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

func TestMicrosoftAccountFollowsTheTenantWithoutSigningIn(t *testing.T) {
	env := microsoftEnv(t)
	address := connectedWithCommon(t, env, "00000000-0000-0000-0000-000000000001")
	m, calls := tokenEndpoint(t, 200, `{"access_token":"tenant-access","refresh_token":"tenant-refresh","expires_in":3600}`)
	c := New(env, []Entry{m}, nil)
	// OneDrive syncs: its client reads the file being rewritten.
	k := syncingOneDrive(t, c, env, address)
	before := c.sync.children[k]
	// The remotes' accepted grant decides the Outlook registration; the
	// Outlook grant is not asked through the tenant.
	if err := os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), []byte(`{"state":"unreachable"}`), 0600); err != nil {
		t.Fatal(err)
	}

	account := c.check(context.Background(), m, address)
	if after := c.sync.children[k]; after == nil || after == before {
		t.Fatal("the sync client was not restarted on the rewritten config")
	}
	for _, s := range account.Services {
		if s.State == StateLoginExpired {
			t.Fatal("followed account asks to sign in", account.Services)
		}
	}
	data, _ := os.ReadFile(filepath.Join(env.Home, microsoftDir, address+".conf"))
	config := string(data)
	if strings.Contains(config, "common") || strings.Count(config, "tenant = "+testTenant+"\n") != 1 || strings.Count(config, `"refresh_token":"tenant-refresh"`) != 1 || strings.Contains(config, "refresh-secret") {
		t.Fatal("remotes not on the tenant's grant:\n", config)
	}
	if remotes, err := microsoftRemotes(env, address); err != nil || len(remotes) != 2 {
		t.Fatal("rewrite broke the remotes", remotes, err)
	}
	pi, _ := os.ReadFile(filepath.Join(env.Home, "pi-commands"))
	if !strings.Contains(string(pi), "add\n"+microsoftPlainServer(address)+"\n") || !strings.Contains(string(pi), "MS365_MCP_TENANT_ID="+testTenant) {
		t.Fatal("Pi registration not replaced with the tenant", string(pi))
	}
	if calls.Load() != 1 {
		t.Fatal("refreshes", calls.Load())
	}
	// Once aligned, checks and restarts leave it alone.
	c.check(context.Background(), m, address)
	if m.Misaligned(env, address) || calls.Load() != 1 {
		t.Fatal("aligned account aligned again")
	}
}

func TestMicrosoftTenantRefusalSaysWhyAndKeepsTheConfigs(t *testing.T) {
	for _, tc := range []struct {
		name, reply, client, want string
	}{
		{"expired grant", `{"error":"invalid_grant","error_codes":[700082]}`, "00000000-0000-0000-0000-000000000001", TenantChanged},
		{"other directory", `{"error":"invalid_grant","error_codes":[50020]}`, "00000000-0000-0000-0000-000000000001", OutsideTenant},
		{"another app", "", "00000000-0000-0000-0000-000000000009", AppChanged},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := microsoftEnv(t)
			address := connectedWithCommon(t, env, tc.client)
			conf := filepath.Join(env.Home, microsoftDir, address+".conf")
			before, _ := os.ReadFile(conf)
			m, calls := tokenEndpoint(t, 400, tc.reply)
			c := New(env, []Entry{m}, nil)

			account := c.check(context.Background(), m, address)
			if len(account.Services) == 0 {
				t.Fatal("no services")
			}
			for _, s := range account.Services {
				if s.State != StateLoginExpired || s.Failure != tc.want {
					t.Fatal("refusal not shown", account.Services)
				}
			}
			if after, _ := os.ReadFile(conf); string(after) != string(before) {
				t.Fatal("a refused grant changed the remotes")
			}
			if pi, _ := os.ReadFile(filepath.Join(env.Home, "pi-commands")); len(pi) != 0 {
				t.Fatal("a refused grant changed the Pi registration", string(pi))
			}
			// The refusal stands for this application without asking again.
			c.check(context.Background(), m, address)
			wantCalls := int32(1)
			if tc.want == AppChanged {
				wantCalls = 0
			}
			if calls.Load() != wantCalls {
				t.Fatal("refreshes", calls.Load())
			}

			// A new sign-in writes the current application and clears it.
			l := msLogin(t, syntheticMicrosoft(t, "person@example.test", ""), env, address)
			if _, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil }); err != nil {
				t.Fatal(err)
			}
			if err := l.Commit(context.Background(), address); err != nil {
				t.Fatal(err)
			}
			for _, s := range c.check(context.Background(), m, address).Services {
				if s.State == StateLoginExpired {
					t.Fatal("refusal outlived the new sign-in", s)
				}
			}
		})
	}
}

// A daemon start follows the tenant without anyone opening the page, so
// agents and sync do not wait for a browser.
func TestMicrosoftDaemonStartFollowsTheTenant(t *testing.T) {
	env := microsoftEnv(t)
	address := connectedWithCommon(t, env, "00000000-0000-0000-0000-000000000001")
	m, _ := tokenEndpoint(t, 200, `{"access_token":"tenant-access","refresh_token":"tenant-refresh","expires_in":3600}`)
	c := New(env, []Entry{m}, nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.Start(ctx)
	deadline := time.Now().Add(5 * time.Second)
	for m.Misaligned(env, address) {
		if time.Now().After(deadline) {
			t.Fatal("start did not follow the tenant")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// An unreachable or overloaded tenant decides nothing: the configs stay and the next check
// asks again.
func TestMicrosoftUnreachableTenantIsAskedAgain(t *testing.T) {
	env := microsoftEnv(t)
	address := connectedWithCommon(t, env, "00000000-0000-0000-0000-000000000001")
	var calls atomic.Int32
	m := &microsoft{client: &http.Client{Transport: dropboxTransport(func(*http.Request) (*http.Response, error) {
		if calls.Add(1) == 1 {
			return nil, fmt.Errorf("offline")
		}
		return &http.Response{StatusCode: 503, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"error":"temporarily_unavailable","error_codes":[50196]}`))}, nil
	})}}
	c := New(env, []Entry{m}, nil)
	for i := 0; i < 2; i++ {
		for _, s := range c.check(context.Background(), m, address).Services {
			if s.State == StateLoginExpired {
				t.Fatal("an outage became a refusal", s)
			}
		}
	}
	if calls.Load() != 2 || !m.Misaligned(env, address) {
		t.Fatal("outage was remembered", calls.Load())
	}
	var registration map[string]any
	data, _ := os.ReadFile(filepath.Join(env.Home, ".pi/agent/mcp.json"))
	if json.Unmarshal(data, &registration) != nil || !strings.Contains(string(data), `"common"`) {
		t.Fatal("registration changed", string(data))
	}
}

// A mail-only account has no remotes' grant to redeem: the Outlook tool's
// MSAL grant, asked through the tenant, decides, and an outage decides nothing.
func TestMicrosoftMailOnlyAccountFollowsTheTenantByItsOutlookGrant(t *testing.T) {
	for _, tc := range []struct {
		reply, want string
		follows     bool
	}{
		{`{"state":"refused"}`, TenantChanged, false},
		{`{"state":"outside_tenant"}`, OutsideTenant, false},
		{`{"state":"unreachable"}`, "", false},
		{`{"state":"ok"}`, "", true},
	} {
		t.Run(tc.reply, func(t *testing.T) {
			env := microsoftEnv(t)
			address := connectedWithCommon(t, env, "00000000-0000-0000-0000-000000000001")
			if err := os.Remove(filepath.Join(env.Home, microsoftDir, address+".conf")); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), []byte(tc.reply), 0600); err != nil {
				t.Fatal(err)
			}
			m, calls := tokenEndpoint(t, 500, "")
			c := New(env, []Entry{m}, nil)
			account := c.check(context.Background(), m, address)
			if len(account.Services) == 0 {
				t.Fatal("no services")
			}
			for _, s := range account.Services {
				if s.Failure != tc.want || (tc.want != "" && s.State != StateLoginExpired) {
					t.Fatal("wrong reason", account.Services)
				}
			}
			pi, _ := os.ReadFile(filepath.Join(env.Home, "pi-commands"))
			if registered := strings.Contains(string(pi), "add\n"+microsoftPlainServer(address)+"\n"); registered != tc.follows {
				t.Fatal("registration followed", registered, string(pi))
			}
			// Only an outage leaves it to be asked again.
			if m.Misaligned(env, address) != (tc.want == "" && !tc.follows) || calls.Load() != 0 {
				t.Fatal("misaligned after check", m.Misaligned(env, address), calls.Load())
			}
		})
	}
}
