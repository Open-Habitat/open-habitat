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
 touch "$HOME/mcp-checked"
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
 add) printf '{"mcpServers":{"%s":{}}}' "$3" >"$HOME/.pi/agent/mcp.json"
 if [ -f "$HOME/block-rollback" ]; then
  mkdir -p "$HOME/.config/ms-365-mcp-server/open-habitat/.pending/person@example.test"
  echo barrier >"$HOME/.config/ms-365-mcp-server/open-habitat/.pending/person@example.test/barrier"
 fi
 [ ! -f "$HOME/pi-add-fail" ];;
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

// Entra's v2 endpoint can return resource-qualified Graph permissions.
func TestMicrosoftQualifiedGraphScopes(t *testing.T) {
	for _, resource := range []string{"https://graph.microsoft.com/", "https://other.example.test/"} {
		t.Run(resource, func(t *testing.T) {
			env := microsoftEnv(t)
			m := syntheticMicrosoft(t, "person@example.test", "")
			base := m.client.Transport
			m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
				res, err := base.RoundTrip(r)
				if err == nil && strings.HasSuffix(r.URL.Path, "/token") {
					res.Body.Close()
					body := fmt.Sprintf(`{"access_token":"access-secret","refresh_token":"refresh-secret","expires_in":3600,"scope":%q}`, resource+"User.Read "+resource+"Files.ReadWrite.All "+resource+"Sites.ReadWrite.All")
					res.Body = io.NopCloser(strings.NewReader(body))
				}
				return res, err
			})
			l := msLogin(t, m, env, "")
			prompted := false
			_, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { prompted = true; return nil })
			if resource == "https://graph.microsoft.com/" {
				if err != nil || !prompted {
					t.Fatal("valid Graph grant did not reach Outlook login", err)
				}
			} else if err == nil || prompted {
				t.Fatal("accepted another resource's grant")
			}
		})
	}
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
	if a, _ := m.Accounts(env); len(a) != 1 || a[0] != address {
		t.Fatal("native pending grant is not recoverable by account", a)
	}
	if _, err := os.Stat(filepath.Join(env.Home, microsoftDir, address+".conf")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("file config published before commit", err)
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

func TestMicrosoftReloginPreservesDirectoriesAndDoesNotResyncHealthyPairs(t *testing.T) {
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
	if err := connect().Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		t.Fatal(err)
	}
	if err := m.ChooseFolders(context.Background(), env, address, []string{remotes[1].Name}); err != nil {
		t.Fatal(err)
	}
	listing := filepath.Join(env.Home, microsoftWork(address, remotes[1].Name), "local..dropbox.path1.lst")
	if err := os.WriteFile(listing, []byte("healthy native listing: do not reinitialize"), 0600); err != nil {
		t.Fatal(err)
	}
	l := connect()
	l.config = []byte(strings.ReplaceAll(string(l.config), remotes[1].Directory, remotes[1].Directory+"-renamed"))
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	current, err := microsoftRemotes(env, address)
	if err != nil || current[1].Directory != remotes[1].Directory {
		t.Fatal("cloud rename moved a live local sync root", current, err)
	}
	choice, err := m.FolderChoiceAfterLogin(env, address)
	if err != nil || !choice {
		t.Fatal("existing sync hides newly available libraries")
	}
	folders, err := m.Folders(context.Background(), env, address)
	if err != nil || folders[0].Suggested || !folders[1].Suggested {
		t.Fatal("relogin forgot existing selection", folders, err)
	}
	if err := m.ChooseFolders(context.Background(), env, address, []string{current[0].Name, current[1].Name}); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(listing)
	if err != nil || string(data) != "healthy native listing: do not reinitialize" {
		t.Fatal("healthy pair was resynced", err)
	}
	// A fresh selection can also stop one existing pair, without removing data.
	if err := m.ChooseFolders(context.Background(), env, address, []string{current[0].Name}); err != nil {
		t.Fatal(err)
	}
	if microsoftReady(env, address, current[1].Name) {
		t.Fatal("deselected pair still enabled")
	}
	if _, err := os.Stat(filepath.Join(env.Home, current[1].Directory)); err != nil {
		t.Fatal("deselection removed local files", err)
	}
}

func TestMicrosoftMailOnlyLicenceCompletesWithoutFolderChoice(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	base := m.client.Transport
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path == "/v1.0/me/drive" {
			return &http.Response{StatusCode: 404, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"error":{"code":"itemNotFound"}}`))}, nil
		}
		if r.URL.Path == "/v1.0/me/followedSites" {
			return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"value":[]}`))}, nil
		}
		return base.RoundTrip(r)
	})
	c := New(env, []Entry{m}, nil)
	ctx, cancel := context.WithCancel(context.Background())
	c.Start(ctx)
	defer func() { cancel(); c.relay.cancelAll(); c.sync.stopAll() }()
	h := c.Handler(allow)
	code, _, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft"})
	if code != 200 {
		t.Fatal(code)
	}
	waitState(t, h, ownerA, "completed")
	address := "person@example.test"
	services := m.Check(context.Background(), env, address)
	if len(services) != 3 || services[0].ID != "mail" || services[0].State != StateOK {
		t.Fatal(services)
	}
	if _, ready := m.SyncCommand(env, address); ready {
		t.Fatal("invented a file connection")
	}
	if err := m.Remove(context.Background(), env, address); err != nil {
		t.Fatal(err)
	}
}

func TestMicrosoftStatusDoesNotStarveOutlookOrScaleWithLibraries(t *testing.T) {
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
	configPath := filepath.Join(env.Home, microsoftDir, address+".conf")
	config, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatal(err)
	}
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		t.Fatal(err)
	}
	extra := string(config[strings.Index(string(config), "[sp-"):])
	extra = strings.ReplaceAll(extra, remotes[1].Name, "sp-012345678901234567890123")
	extra = strings.ReplaceAll(extra, remotes[1].Directory, remotes[1].Directory+"-extra")
	if err := os.WriteFile(configPath, append(config, []byte(extra)...), 0600); err != nil {
		t.Fatal(err)
	}
	wrapper := filepath.Join(t.TempDir(), "rclone")
	script := "#!/bin/sh\nset -eu\nif [ \"$3\" = about ]; then\n while [ ! -f \"$HOME/mcp-checked\" ]; do sleep 0.01; done\n echo \"$4\" >>\"$HOME/about-calls\"\nfi\nexec '" + env.Config.Tools["rclone"] + "' \"$@\"\n"
	if err := os.WriteFile(wrapper, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	env.Config.Tools["rclone"] = wrapper
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	services := m.Check(ctx, env, address)
	if services[2].State != StateOK {
		t.Fatal("file check starved Outlook", services)
	}
	calls, err := os.ReadFile(filepath.Join(env.Home, "about-calls"))
	if err != nil || strings.Count(string(calls), "\n") != 2 {
		t.Fatal("probe count grows with library count", string(calls), err)
	}
}

func TestMicrosoftFailedPairDoesNotStarveOtherLibraries(t *testing.T) {
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
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		t.Fatal(err)
	}
	if err := m.ChooseFolders(context.Background(), env, address, []string{remotes[0].Name, remotes[1].Name}); err != nil {
		t.Fatal(err)
	}
	wrapper := filepath.Join(t.TempDir(), "rclone")
	script := `#!/bin/sh
set -eu
if [ "$3" = bisync ]; then
 echo "$5" >>"$HOME/attempted-pairs"
 [ "$5" != onedrive: ] || exit 7
fi
exec '` + env.Config.Tools["rclone"] + `' "$@"
`
	if err := os.WriteFile(wrapper, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	env.Config.Tools["rclone"] = wrapper
	cmd, ok := m.SyncCommand(env, address)
	if !ok {
		t.Fatal("no sync")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if _, err := env.run(ctx, cmd, nil); err == nil {
		t.Fatal("failed pair lost its safeguard")
	}
	pairs, err := os.ReadFile(filepath.Join(env.Home, "attempted-pairs"))
	if err != nil || !strings.Contains(string(pairs), remotes[1].Name+":") {
		t.Fatal("unrelated library starved", string(pairs), err)
	}
}

type fastMicrosoftEntry struct {
	*microsoft
	failFolders bool
}

func (e *fastMicrosoftEntry) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	login, err := e.microsoft.StartLogin(ctx, env, address)
	if err == nil {
		login.(*microsoftLogin).interval = time.Millisecond
	}
	return login, err
}
func (e *fastMicrosoftEntry) Folders(ctx context.Context, env Env, address string) ([]Folder, error) {
	if e.failFolders {
		return nil, ToolFailed
	}
	return e.microsoft.Folders(ctx, env, address)
}
func TestMicrosoftInterruptedRenewalRestoresRetainedSync(t *testing.T) {
	for _, action := range []string{"cancel", "expiry", "folder-error", "shutdown"} {
		t.Run(action, func(t *testing.T) {
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
			if err := m.ChooseFolders(context.Background(), env, address, []string{"onedrive"}); err != nil {
				t.Fatal(err)
			}
			e := &fastMicrosoftEntry{microsoft: m, failFolders: action == "folder-error"}
			opts := []Option{WithQuota(func() Room { return Room{Free: 2048, OK: true} })}
			if action == "expiry" {
				opts = append(opts, WithClock(func() time.Time { return time.Now().Add(-loginLifetime + time.Second) }))
			}
			c := New(env, []Entry{e}, nil, opts...)
			ctx, cancel := context.WithCancel(context.Background())
			c.Start(ctx)
			defer func() { cancel(); c.relay.cancelAll(); c.sync.stopAll() }()
			if !c.sync.supervised(key{Microsoft, address}) {
				t.Fatal("initial native sync not supervised")
			}
			if err := c.startLogin(ownerA, e, address); err != nil {
				t.Fatal(err)
			}
			h := c.Handler(allow)
			if action == "folder-error" {
				waitState(t, h, ownerA, "failed")
			} else {
				waitState(t, h, ownerA, "choose_folders")
				if c.sync.supervised(key{Microsoft, address}) {
					t.Fatal("native refresher not stopped during replacement choice")
				}
				if action == "cancel" {
					if err := c.cancelLogin(ownerA, c.relay.a.id); err != nil {
						t.Fatal(err)
					}
				}
				if action == "shutdown" {
					cancel()
				}
			}
			c.relay.mu.Lock()
			done := c.relay.a.done
			c.relay.mu.Unlock()
			select {
			case <-done:
			case <-time.After(5 * time.Second):
				t.Fatal("renewal did not finish")
			}
			if action == "shutdown" {
				deadline := time.Now().Add(3 * time.Second)
				for {
					c.write.Lock()
					stopped := c.stopping
					c.write.Unlock()
					if stopped {
						break
					}
					if time.Now().After(deadline) {
						t.Fatal("shutdown did not stop catalog")
					}
					time.Sleep(time.Millisecond)
				}
				if c.sync.supervised(key{Microsoft, address}) {
					t.Fatal("late cleanup resurrected a shutdown client")
				}
			} else if !c.sync.supervised(key{Microsoft, address}) {
				t.Fatal("retained account lost sync after", action)
			}
		})
	}
}

func TestMicrosoftNativeRecoveryStoresAreAccountDiscoverableAndRemovable(t *testing.T) {
	for _, store := range []string{".pending", ".previous"} {
		t.Run(store, func(t *testing.T) {
			env := microsoftEnv(t)
			m := &microsoft{}
			address := "person@example.test"
			dir := filepath.Join(env.Home, microsoftMCPDir, store, address)
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			for _, name := range []string{".token-cache.json", ".cache-key", ".selected-account.json"} {
				if err := os.WriteFile(filepath.Join(dir, name), []byte("recoverable native store"), 0600); err != nil {
					t.Fatal(err)
				}
			}
			accounts, err := m.Accounts(env)
			if err != nil || len(accounts) != 1 || accounts[0] != address {
				t.Fatal("hidden authorized store", accounts, err)
			}
			if err := m.Remove(context.Background(), env, address); err != nil {
				t.Fatal(err)
			}
			if _, err := os.Stat(dir); !errors.Is(err, os.ErrNotExist) {
				t.Fatal("native recovery credentials survived removal", err)
			}
		})
	}
}
func TestMicrosoftPartialExistingCacheSurvivesUncertainRegistrationAndIsRemoved(t *testing.T) {
	for _, blockRollback := range []bool{false, true} {
		t.Run(fmt.Sprint(blockRollback), func(t *testing.T) {
			env := microsoftEnv(t)
			m := syntheticMicrosoft(t, "person@example.test", "")
			address := "person@example.test"
			dir := filepath.Join(env.Home, microsoftMCPDir, address)
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			for _, name := range []string{".token-cache.json", ".cache-key", ".selected-account.json"} {
				if err := os.WriteFile(filepath.Join(dir, name), []byte("previous native bytes"), 0600); err != nil {
					t.Fatal(err)
				}
			}
			l := msLogin(t, m, env, "")
			if _, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil }); err != nil {
				t.Fatal(err)
			}
			markers := []string{"pi-add-fail", "pi-remove-fail"}
			if blockRollback {
				markers = append(markers, "block-rollback")
			}
			for _, marker := range markers {
				if err := os.WriteFile(filepath.Join(env.Home, marker), nil, 0600); err != nil {
					t.Fatal(err)
				}
			}
			if err := l.Commit(context.Background(), address); err == nil {
				t.Fatal("accepted uncertain registration")
			}
			previous := dir
			if blockRollback {
				previous = filepath.Join(env.Home, microsoftMCPDir, ".previous", address)
			}
			key, err := os.ReadFile(filepath.Join(previous, ".cache-key"))
			if err != nil || string(key) != "previous native bytes" {
				t.Fatal("lost previous native cache", err)
			}
			accounts, err := m.Accounts(env)
			if err != nil || len(accounts) != 1 {
				t.Fatal("partial cache disappeared", accounts, err)
			}
			if err := os.Remove(filepath.Join(env.Home, "pi-remove-fail")); err != nil {
				t.Fatal(err)
			}
			if err := m.Remove(context.Background(), env, address); err != nil {
				t.Fatal(err)
			}
			for _, store := range []string{"", ".pending", ".previous"} {
				if _, err := os.Stat(filepath.Join(env.Home, microsoftMCPDir, store, address, ".token-cache.json")); !errors.Is(err, os.ErrNotExist) {
					t.Fatal("authorized store survived explicit removal", store, err)
				}
			}
		})
	}
}
func TestMicrosoftRemovalFencesAnAttemptBeforeItsIdentityIsPublished(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	e := &fastMicrosoftEntry{microsoft: m}
	if err := os.WriteFile(filepath.Join(env.Home, "hold-mcp"), nil, 0600); err != nil {
		t.Fatal(err)
	}
	c := New(env, []Entry{e}, nil)
	ctx, cancel := context.WithCancel(context.Background())
	c.Start(ctx)
	defer func() { cancel(); c.relay.cancelAll(); c.sync.stopAll() }()
	if err := c.startLogin(ownerA, e, ""); err != nil {
		t.Fatal(err)
	}
	h := c.Handler(allow)
	deadline := time.Now().Add(3 * time.Second)
	for {
		_, v, _ := call(t, h, "GET", LoginPath, ownerA, nil)
		if v["user_code"] == "ABCD12345" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal(v)
		}
		time.Sleep(time.Millisecond)
	}
	address := "person@example.test"
	// Model the instant after MSAL persists, before Wait has returned identity.
	if err := os.WriteFile(filepath.Join(env.Home, microsoftMCPDir, ".pending", address, ".token-cache.json"), []byte("native pending grant"), 0600); err != nil {
		t.Fatal(err)
	}
	code, out, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "microsoft", "address": address, "delete_directories": false})
	if code != 200 {
		t.Fatal(code, out)
	}
	c.relay.mu.Lock()
	done := c.relay.a.done
	c.relay.mu.Unlock()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("removal did not cancel in-flight native writer")
	}
	if accounts, err := m.Accounts(env); err != nil || len(accounts) != 0 {
		t.Fatal("login recreated removed account", accounts, err)
	}
}
