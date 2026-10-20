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
 printf 'native encrypted cache' >"$MS365_MCP_TOKEN_CACHE_PATH"
 printf 'native key' >"$(dirname "$MS365_MCP_TOKEN_CACHE_PATH")/.cache-key"
 printf 'native selection' >"$MS365_MCP_SELECTED_ACCOUNT_PATH"
 echo '{"success":true}';;
 *' --list-accounts '*) printf '{"accounts":[{"username":"%s"}]}' "$MS365_MCP_EXPECTED_USERNAME";;
 *' --verify-login '*) test -f "$MS365_MCP_TOKEN_CACHE_PATH"; echo '{"success":true}';;
 *) exit 81;;
esac
`
	if err := os.WriteFile(tool, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	pi := filepath.Join(t.TempDir(), "pi")
	if err := os.WriteFile(pi, []byte("#!/bin/sh\nprintf '%s\\n' \"$@\" >>\"$HOME/pi-commands\"\n"), 0700); err != nil {
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
