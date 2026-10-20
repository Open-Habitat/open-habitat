//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func microsoftEnv(t *testing.T) Env {
	t.Helper()
	tool := filepath.Join(t.TempDir(), "ms365")
	script := `#!/bin/sh
set -eu
[ "$MS365_MCP_USE_KEYTAR" = false ]
[ "$MS365_MCP_CLIENT_ID" = 00000000-0000-0000-0000-000000000001 ]
case " $* " in
 *' --login '*)
 echo 'To sign in, use a web browser to open the page https://login.microsoft.com/device and enter the code ABCD12345 to authenticate.'
 [ ! -f "$HOME/mcp-fail" ]
 while [ -f "$HOME/hold-mcp" ]; do sleep 0.02; done
 printf 'native encrypted cache' >"$MS365_MCP_TOKEN_CACHE_PATH"
 printf 'native key' >"$(dirname "$MS365_MCP_TOKEN_CACHE_PATH")/.cache-key"
 printf 'native selection' >"$MS365_MCP_SELECTED_ACCOUNT_PATH"
 echo '{"success":true}';;
 *' --list-accounts '*) printf '{"accounts":[{"username":"%s"}]}' "$MS365_MCP_EXPECTED_USERNAME";;
 *' --verify-login '*)
 test -f "$MS365_MCP_TOKEN_CACHE_PATH"
 if [ -f "$HOME/mcp-status-result" ]; then cat "$HOME/mcp-status-result"; else echo '{"success":true}'; fi;;
 *) exit 81;;
esac
`
	if err := os.WriteFile(tool, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	pi := filepath.Join(t.TempDir(), "pi")
	if err := os.WriteFile(pi, []byte(`#!/bin/sh
set -eu
printf '%s\n' "$@" >>"$HOME/pi-commands"
mkdir -p "$HOME/.pi/agent"
case "$2" in
 add) printf '{"mcpServers":{"%s":{}}}' "$3" >"$HOME/.pi/agent/mcp.json"; [ ! -f "$HOME/pi-add-fail" ];;
 remove) [ ! -f "$HOME/pi-remove-fail" ]; printf '{"mcpServers":{}}' >"$HOME/.pi/agent/mcp.json";;
esac
`), 0700); err != nil {
		t.Fatal(err)
	}
	return Env{Home: newHome(t), FixtureTools: true, Config: Config{Tools: map[string]string{"rclone": fakeRclone(t), "ms-365-mcp-server": tool, "pi": pi}, Microsoft: &MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000001", TenantID: "common"}}}
}
func syntheticMicrosoft(t *testing.T, upn, failure string) *microsoft {
	t.Helper()
	return &microsoft{client: &http.Client{Transport: dropboxTransport(func(r *http.Request) (*http.Response, error) {
		var body string
		status := 200
		if strings.Contains(r.URL.Host, "microsoftonline") {
			if r.Method != "POST" {
				t.Error("OAuth method")
			}
			_ = r.ParseForm()
			if r.Form.Get("client_id") != "00000000-0000-0000-0000-000000000001" || r.Form.Get("client_secret") != "" {
				t.Error("public client credentials")
			}
			switch r.URL.Path {
			case "/common/oauth2/v2.0/devicecode":
				body = `{"device_code":"device-secret","user_code":"FIRST1234","verification_uri":"https://microsoft.com/devicelogin","expires_in":900,"interval":1}`
			case "/common/oauth2/v2.0/token":
				if r.Form.Get("device_code") != "device-secret" || r.Form.Get("grant_type") != "urn:ietf:params:oauth:grant-type:device_code" {
					t.Error("device exchange")
				}
				body = `{"access_token":"access-secret","refresh_token":"refresh-secret","expires_in":3600,"scope":"User.Read Files.ReadWrite.All Sites.ReadWrite.All"}`
				if failure != "" {
					body = failure
					status = 400
				}
			default:
				t.Errorf("unexpected OAuth %s", r.URL)
			}
		} else {
			if r.URL.Host != "graph.microsoft.com" || r.Header.Get("Authorization") != "Bearer access-secret" {
				t.Errorf("unexpected Graph %s", r.URL)
			}
			switch r.URL.Path {
			case "/v1.0/me":
				body = fmt.Sprintf(`{"mail":%q,"userPrincipalName":%q}`, upn, upn)
			case "/v1.0/me/drive":
				body = `{"id":"primary-drive","name":"OneDrive","driveType":"business"}`
			case "/v1.0/me/followedSites":
				body = `{"value":[{"id":"tenant,site,web","displayName":"Team","webUrl":"https://tenant.sharepoint.com/sites/team"}]}`
			case "/v1.0/sites/tenant,site,web/drives":
				body = `{"value":[{"id":"library-drive","name":"Documents","driveType":"documentLibrary"}]}`
			default:
				t.Errorf("unexpected Graph %s", r.URL)
			}
		}
		return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
	})}}
}
func msLogin(t *testing.T, m *microsoft, env Env, expected string) *microsoftLogin {
	t.Helper()
	login, err := m.StartLogin(context.Background(), env, expected)
	if err != nil {
		t.Fatal(err)
	}
	l := login.(*microsoftLogin)
	l.interval = time.Millisecond
	t.Cleanup(l.Cancel)
	return l
}
func TestMicrosoftNativeStoresSelectionAndRemoval(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	l := msLogin(t, m, env, "")
	second := false
	address, err := l.WaitWithPrompt(context.Background(), func(p Prompt) error {
		second = true
		if p.UserCode != "ABCD12345" || !validPrompt(DeviceCode, p) {
			t.Error("second native prompt")
		}
		return nil
	})
	if err != nil || !second {
		t.Fatal(address, err, second)
	}
	if a, _ := m.Accounts(env); len(a) != 0 {
		t.Fatal("published before identity and commit")
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	accounts, err := m.Accounts(env)
	if err != nil || len(accounts) != 1 || accounts[0] != address {
		t.Fatal(accounts, err)
	}
	folders, err := m.Folders(context.Background(), env, address)
	if err != nil || len(folders) != 2 {
		t.Fatal(folders, err)
	}
	if _, ready := m.SyncCommand(env, address); ready {
		t.Fatal("synced without folder choice")
	}
	if err := m.ChooseFolders(context.Background(), env, address, []string{folders[1].ID}); err != nil {
		t.Fatal(err)
	}
	cmd, ready := m.SyncCommand(env, address)
	if !ready || strings.Contains(strings.Join(cmd.Args, " "), "--resync") || strings.Contains(strings.Join(cmd.Args, " "), "'onedrive:'") {
		t.Fatal("selection or restart safety", cmd)
	}
	services := m.Check(context.Background(), env, address)
	if services[0].State == StateOK || services[1].State != StateOK || services[2].State != StateOK {
		t.Fatal(services)
	}
	data, err := os.ReadFile(filepath.Join(env.Home, "pi-commands"))
	if err != nil || !strings.Contains(string(data), "MS365_MCP_EXPECTED_USERNAME="+address) || strings.Contains(string(data), "secret") {
		t.Fatal("native MCP setup", err)
	}
	skill := m.Skill(env, address)
	if !skill.Synced || !strings.Contains(skill.Body, "drafts first") {
		t.Fatal(skill)
	}
	if err := m.Remove(context.Background(), env, address); err != nil {
		t.Fatal(err)
	}
	if a, _ := m.Accounts(env); len(a) != 0 {
		t.Fatal(a)
	}
	if _, err := os.Stat(filepath.Join(env.Home, microsoftMCPDir, address, ".token-cache.json")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("retained native token", err)
	}
	if _, err := os.Stat(filepath.Join(env.Home, "cloud/sharepoint")); err != nil {
		t.Fatal("removed local data", err)
	}
}
func TestMicrosoftConsentBlockedMismatchAndCancel(t *testing.T) {
	for _, test := range []struct {
		name, body string
		want       error
	}{
		{"consent", `{"error":"invalid_grant","error_codes":[65001]}`, ConsentRequired{}},
		{"policy", `{"error":"access_denied","error_codes":[53003]}`, DeviceCodeBlocked},
		{"expiry", `{"error":"expired_token"}`, Expired},
	} {
		t.Run(test.name, func(t *testing.T) {
			env := microsoftEnv(t)
			m := syntheticMicrosoft(t, "person@example.test", test.body)
			l := msLogin(t, m, env, "")
			_, err := l.Wait(context.Background())
			if test.name == "consent" {
				var c ConsentRequired
				if !errors.As(err, &c) || !strings.Contains(c.URL, "/organizations/v2.0/adminconsent?") {
					t.Fatal(err)
				}
			} else if !errors.Is(err, test.want) {
				t.Fatal(err)
			}
			if a, _ := m.Accounts(env); len(a) != 0 {
				t.Fatal(a)
			}
		})
	}
	t.Run("mismatch", func(t *testing.T) {
		env := microsoftEnv(t)
		m := syntheticMicrosoft(t, "other@example.test", "")
		l := msLogin(t, m, env, "person@example.test")
		if _, err := l.Wait(context.Background()); !errors.Is(err, AccountMismatch) {
			t.Fatal(err)
		}
	})
	t.Run("second-login-failure", func(t *testing.T) {
		env := microsoftEnv(t)
		_ = os.WriteFile(filepath.Join(env.Home, "mcp-fail"), nil, 0600)
		m := syntheticMicrosoft(t, "person@example.test", "")
		l := msLogin(t, m, env, "")
		if _, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil }); err == nil {
			t.Fatal("accepted failed native login")
		}
		l.Cancel()
		if a, _ := m.Accounts(env); len(a) != 0 {
			t.Fatal(a)
		}
	})
	t.Run("cancel", func(t *testing.T) {
		env := microsoftEnv(t)
		m := syntheticMicrosoft(t, "person@example.test", "")
		l := msLogin(t, m, env, "")
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if _, err := l.Wait(ctx); !errors.Is(err, context.Canceled) {
			t.Fatal(err)
		}
	})
}
func TestMicrosoftRefusesUntrustedPathsAndSelection(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	l := msLogin(t, m, env, "")
	a, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), a); err != nil {
		t.Fatal(err)
	}
	if err := m.ChooseFolders(context.Background(), env, a, []string{"../escape"}); err == nil {
		t.Fatal("accepted forged remote")
	}
	config := filepath.Join(env.Home, microsoftDir, a+".conf")
	if err := os.WriteFile(config, []byte("[sp-012345678901234567890123]\ndescription = cloud/sharepoint/org--"+a+"/../outside\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := microsoftRemotes(env, a); err == nil {
		t.Fatal("accepted traversal")
	}
	if err := os.Remove(config); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(env.Home, "outside"), config); err != nil {
		t.Fatal(err)
	}
	if _, err := m.Accounts(env); err == nil {
		t.Fatal("followed token symlink")
	}
}
func TestMicrosoftConfigIsolation(t *testing.T) {
	env := microsoftEnv(t)
	env.Config.Microsoft.ClientID = "bad\nkey"
	if (&microsoft{}).Available(env) {
		t.Fatal("invalid app available")
	}
	data, _ := json.Marshal(Config{Tools: map[string]string{}, Microsoft: &MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000001", TenantID: "common"}})
	var cfg Config
	if err := decodeStrict(data, &cfg); err != nil {
		t.Fatal("new known config rejected", err)
	}
}

func TestMicrosoftCatalogRelaysBothCodesAndSupervisesChoice(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	hold := filepath.Join(env.Home, "hold-mcp")
	if err := os.WriteFile(hold, nil, 0600); err != nil {
		t.Fatal(err)
	}
	c := New(env, []Entry{m}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
	ctx, cancel := context.WithCancel(context.Background())
	c.Start(ctx)
	defer func() { cancel(); c.relay.cancelAll(); c.sync.stopAll() }()
	h := c.Handler(allow)
	code, _, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft"})
	if code != 200 {
		t.Fatal(code)
	}
	first := waitState(t, h, ownerA, "device_code")
	if first["user_code"] != "FIRST1234" {
		t.Fatal(first)
	}
	id := first["attempt_id"].(string)
	deadline := time.Now().Add(10 * time.Second)
	for {
		_, v, raw := call(t, h, "GET", LoginPath, ownerA, nil)
		if strings.Contains(raw, "secret") {
			t.Fatal("credential crossed relay")
		}
		if v["state"] == "failed" {
			t.Fatal(v)
		}
		if v["user_code"] == "ABCD12345" {
			if v["attempt_id"] != id {
				t.Fatal("lost attempt identity")
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("second code never relayed", v)
		}
		time.Sleep(20 * time.Millisecond)
	}
	_, other, _ := call(t, h, "GET", LoginPath, ownerB, nil)
	if other["state"] != "none" {
		t.Fatal("other session saw code", other)
	}
	if err := os.Remove(hold); err != nil {
		t.Fatal(err)
	}
	choice := waitState(t, h, ownerA, "choose_folders")
	if choice["address"] != "person@example.test" {
		t.Fatal(choice)
	}
	c.quota = func() Room { return Room{Free: 1, OK: true} }
	code, _, _ = call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"onedrive"}})
	if code != 422 {
		t.Fatal("quota accepted", code)
	}
	c.quota = func() Room { return Room{Free: 2048, OK: true} }
	code, _, _ = call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"onedrive"}})
	if code != 200 {
		t.Fatal(code)
	}
	waitState(t, h, ownerA, "completed")
	if !c.sync.supervised(key{Microsoft, "person@example.test"}) {
		t.Fatal("chosen sync not supervised")
	}
	if _, err := os.Stat(filepath.Join(env.Home, BootSignal)); err != nil {
		t.Fatal(err)
	}
	code, out, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "microsoft", "address": "person@example.test", "delete_directories": false})
	if code != 200 {
		t.Fatal(code, out)
	}
	if c.sync.supervised(key{Microsoft, "person@example.test"}) {
		t.Fatal("removed sync still running")
	}
	if _, err := os.Stat(filepath.Join(env.Home, BootSignal)); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("retained boot signal", err)
	}
}

func TestMicrosoftPersonalAccountUsesConsumersAndNoSharePointDiscovery(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@outlook.test", "")
	base := m.client.Transport
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path == "/v1.0/me/drive" {
			return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"id":"personal-drive","name":"OneDrive","driveType":"personal"}`))}, nil
		}
		if strings.Contains(r.URL.Path, "followedSites") {
			t.Fatal("consumer SharePoint discovery")
		}
		return base.RoundTrip(r)
	})
	l := msLogin(t, m, env, "")
	address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if l.app.TenantID != "consumers" {
		t.Fatal("wrong native authority")
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	config, err := os.ReadFile(filepath.Join(env.Home, microsoftDir, address+".conf"))
	if err != nil || !strings.Contains(string(config), "tenant = consumers\n") {
		t.Fatal("wrong rclone refresh authority", err)
	}
	app, _ := env.microsoftApp()
	cmd, ok := microsoftMCPCommand(env, app, microsoftMCPDir+"/"+address, address, "--verify-login")
	if !ok || !strings.Contains(strings.Join(cmd.Env, "\n"), "MS365_MCP_TENANT_ID=consumers") {
		t.Fatal("restart lost consumer authority")
	}
}

func TestMicrosoftPartialNativeStoreStaysVisibleAndRemovable(t *testing.T) {
	env := microsoftEnv(t)
	m := &microsoft{}
	address := "person@example.test"
	dir := filepath.Join(env.Home, microsoftMCPDir, address)
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".token-cache.json"), []byte("native encrypted cache"), 0600); err != nil {
		t.Fatal(err)
	}
	accounts, err := m.Accounts(env)
	if err != nil || len(accounts) != 1 || accounts[0] != address {
		t.Fatal("partial connection disappeared", accounts, err)
	}
	// Pi has no server entry yet: native `pi mcp remove` would exit 1. Removal
	// must not depend on a registration that an interrupted commit never made.
	if err := m.Remove(context.Background(), env, address); err != nil {
		t.Fatal(err)
	}
	if err := m.Remove(context.Background(), env, address); err != nil {
		t.Fatal("non-idempotent removal", err)
	}
}

func TestMicrosoftFailedCommitPreservesPreviousNativeKeyAndCleansNewRegistration(t *testing.T) {
	for _, existing := range []bool{false, true} {
		t.Run(fmt.Sprint(existing), func(t *testing.T) {
			env := microsoftEnv(t)
			m := syntheticMicrosoft(t, "person@example.test", "")
			connect := func() *microsoftLogin {
				l := msLogin(t, m, env, "")
				if _, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil }); err != nil {
					t.Fatal(err)
				}
				return l
			}
			address := "person@example.test"
			if existing {
				if err := connect().Commit(context.Background(), address); err != nil {
					t.Fatal(err)
				}
			}
			l := connect()
			if err := os.WriteFile(filepath.Join(env.Home, l.staging, ".cache-key"), []byte("replacement key"), 0600); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(env.Home, "pi-add-fail"), nil, 0600); err != nil {
				t.Fatal(err)
			}
			if err := l.Commit(context.Background(), address); err == nil {
				t.Fatal("accepted failed registration")
			}
			accounts, err := m.Accounts(env)
			if err != nil {
				t.Fatal(err)
			}
			if existing {
				key, err := os.ReadFile(filepath.Join(env.Home, microsoftMCPDir, address, ".cache-key"))
				if err != nil || string(key) != "native key" {
					t.Fatal("previous key lost", err)
				}
				if len(accounts) != 1 {
					t.Fatal("previous connection disappeared", accounts)
				}
			} else {
				if len(accounts) != 0 {
					t.Fatal("failed new account published", accounts)
				}
				configured, err := microsoftMCPConfigured(env, address)
				if err != nil || configured {
					t.Fatal("orphan MCP registration", configured, err)
				}
			}
		})
	}
}

func TestMicrosoftUncertainNativeCleanupRemainsVisible(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	l := msLogin(t, m, env, "")
	address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	for _, marker := range []string{"pi-add-fail", "pi-remove-fail"} {
		if err := os.WriteFile(filepath.Join(env.Home, marker), nil, 0600); err != nil {
			t.Fatal(err)
		}
	}
	if err := l.Commit(context.Background(), address); err == nil {
		t.Fatal("accepted uncertain native write")
	}
	accounts, err := m.Accounts(env)
	if err != nil || len(accounts) != 1 {
		t.Fatal("uncertain native state hidden", accounts, err)
	}
	if err := os.Remove(filepath.Join(env.Home, "pi-remove-fail")); err != nil {
		t.Fatal(err)
	}
	if err := m.Remove(context.Background(), env, address); err != nil {
		t.Fatal("cannot recover partial state", err)
	}
}

func TestMicrosoftOutageIsNotARejectedLogin(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	l := msLogin(t, m, env, "")
	address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		message string
		state   ServiceState
	}{
		{"Login successful but Graph API access failed: fetch failed", StateUnreachable},
		{"Login failed: No valid token found", StateLoginExpired},
	} {
		data, _ := json.Marshal(map[string]any{"success": false, "message": test.message})
		if err := os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), data, 0600); err != nil {
			t.Fatal(err)
		}
		if services := m.Check(context.Background(), env, address); services[2].State != test.state {
			t.Fatal(services)
		}
	}
}
