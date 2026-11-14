//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"
)

// testMicrosoftRoots is an account config in the form discovery writes,
// with the given roots as name and directory pairs.
func testMicrosoftRoots(pairs ...string) string {
	config := "[" + microsoftAccount + "]\ntype = onedrive\nclient_id = 00000000-0000-0000-0000-000000000001\nregion = global\ntenant = " + testTenant + "\ntoken = {}\n\n"
	for i := 0; i+1 < len(pairs); i += 2 {
		kind := "documentLibrary"
		if pairs[i] == "onedrive" {
			kind = "business"
		}
		config += fmt.Sprintf("[%s]\ntype = alias\nremote = %s,drive_id=drive-%d,drive_type=%s:\ndescription = %s\n\n", pairs[i], microsoftAccount, i, kind, pairs[i+1])
	}
	return config
}

func microsoftEnv(t *testing.T) Env {
	t.Helper()
	tool := filepath.Join(t.TempDir(), "ms365")
	script := `#!/bin/sh
set -eu
[ "$MS365_MCP_USE_KEYTAR" = false ]
case "$MS365_MCP_CLIENT_ID" in 00000000-0000-0000-0000-00000000000[123]) ;; *) exit 79;; esac
case " $* " in
 '  ')
 read -r payload || :
 case "$payload" in *'refresh-secret'*) :;; *) exit 80;; esac
 [ ! -f "$HOME/mcp-fail" ]
 touch "$HOME/import-started"
 while [ -f "$HOME/hold-mcp" ]; do sleep 0.02; done
 printf 'native encrypted cache' >"$MS365_MCP_TOKEN_CACHE_PATH"
 printf 'native key' >"$(dirname "$MS365_MCP_TOKEN_CACHE_PATH")/.cache-key"
 printf 'native selection' >"$MS365_MCP_SELECTED_ACCOUNT_PATH"
 echo '{"success":true}';;
 *' --list-accounts '*) printf '{"accounts":[{"username":"%s"}]}' "$MS365_MCP_EXPECTED_USERNAME";;
 ' verify ')
 read -r payload || :
 case "$payload" in *refresh*) exit 83;; esac
 case "$payload" in *"\"tenant_id\":\"$MS365_MCP_TENANT_ID\""*) :;; *) exit 82;; esac
 test -f "$MS365_MCP_TOKEN_CACHE_PATH"
 touch "$HOME/mcp-checked"
 if [ -f "$HOME/mcp-status-result" ]; then cat "$HOME/mcp-status-result"; else echo '{"state":"ok"}'; fi;;
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
 add) cache=; for a; do case "$a" in MS365_MCP_TOKEN_CACHE_PATH=*) cache=${a#*=};; esac; done
 printf '{"mcpServers":{"%s":{"env":{"MS365_MCP_TOKEN_CACHE_PATH":"%s"}}}}' "$3" "$cache" >"$HOME/.pi/agent/mcp.json"
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
	return Env{Home: newHome(t), FixtureTools: true, Config: Config{Tools: map[string]string{"rclone": fakeRclone(t), "ms-365-mcp-server": tool, "microsoft-native": tool, "pi": pi}, Microsoft: &MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000001", TenantID: testTenant}}}
}

// testTenant is the organisation's Directory (tenant) ID, the only audience.
const testTenant = "00000000-0000-4000-8000-0000000000aa"
const testMicrosoftSite = "contoso.sharepoint.com,2C712604-1370-44E7-A1F5-426573FDA80A,2D2244C3-251A-49EA-93A8-39E1C3A060FE"
const testMicrosoftMissingSite = "contoso.sharepoint.com,2C712604-1370-44E7-A1F5-426573FDA80A,00000000-0000-4000-8000-000000000001"

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
			// The full level's application, or the read or no-send level's (level_linux_test.go).
			if !strings.HasPrefix(r.Form.Get("client_id"), "00000000-0000-0000-0000-00000000000") || r.Form.Get("client_secret") != "" {
				t.Error("public client credentials")
			}
			switch r.URL.Path {
			case "/" + testTenant + "/oauth2/v2.0/devicecode":
				body = `{"device_code":"device-secret","user_code":"FIRST1234","verification_uri":"https://microsoft.com/devicelogin","expires_in":900,"interval":1}`
			case "/" + testTenant + "/oauth2/v2.0/token":
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
				body = fmt.Sprintf(`{"value":[{"id":%q,"displayName":"Team","webUrl":"https://contoso.sharepoint.com/sites/team"}]}`, testMicrosoftSite)
			case "/v1.0/sites/" + testMicrosoftSite + "/drives":
				body = `{"value":[{"id":"library-drive","name":"Documents","driveType":"documentLibrary"}]}`
				// Match the wire path, not just URL.Path (which decodes %2C).
				if r.URL.EscapedPath() != "/v1.0/sites/"+testMicrosoftSite+"/drives" {
					status = 404
					body = `{"error":{"code":"itemNotFound"}}`
				}
			case "/v1.0/sites/contoso.sharepoint.com:/sites/team":
				// The webUrl lookup tried after a 404 finds the same site.
				body = fmt.Sprintf(`{"id":%q}`, testMicrosoftSite)
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
				if err != nil || prompted {
					t.Fatal("valid Graph grant did not reach native import", err)
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
	if err != nil || second {
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
	earlierRoots(t, m, env, address, LevelFull, earlierFullGrant)
	folders, err := m.testFolders(context.Background(), env, address)
	if err != nil || len(folders) != 2 {
		t.Fatal(folders, err)
	}
	if _, ready := m.SyncCommand(env, address); ready {
		t.Fatal("synced without folder choice")
	}
	if err := m.testChoose(context.Background(), env, address, []string{folders[1].ID}); err != nil {
		t.Fatal(err)
	}
	cmd, ready := m.SyncCommand(env, address)
	if !ready || strings.Contains(strings.Join(cmd.Args, " "), "--resync") || strings.Contains(strings.Join(cmd.Args, " "), "'onedrive:'") {
		t.Fatal("selection or restart safety", cmd)
	}
	assertBisyncSafety(t, cmd)
	// OneDrive, never chosen, is no synced root; its row waits for the
	// tenant's answer to say what the grant allows.
	services := m.Check(context.Background(), env, address)
	if services[0].ID != "sharepoint" || services[0].State != StateOK || services[1].State != StateOK {
		t.Fatal(services)
	}
	data, err := os.ReadFile(filepath.Join(env.Home, "pi-commands"))
	if err != nil || !strings.Contains(string(data), "MS365_MCP_EXPECTED_USERNAME="+address) || strings.Contains(string(data), "secret") {
		t.Fatal("native MCP setup", err)
	}
	skill := m.Skill(env, address)
	if !skill.Synced || skill.Mirrored || !strings.Contains(skill.Body, "`create-draft-email`") {
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
				if !errors.As(err, &c) || !strings.HasPrefix(c.URL, "https://login.microsoftonline.com/"+testTenant+"/v2.0/adminconsent?") {
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
	t.Run("native-import-failure", func(t *testing.T) {
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
	if err := m.testChoose(context.Background(), env, a, []string{"../escape"}); err == nil {
		t.Fatal("accepted forged remote")
	}
	config := filepath.Join(env.Home, microsoftDir, a+".conf")
	if err := os.WriteFile(config, []byte(testMicrosoftRoots("sp-012345678901234567890123", "cloud/sharepoint/org--"+a+"/../outside")), 0600); err != nil {
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
	data, _ := json.Marshal(Config{Tools: map[string]string{}, Microsoft: &MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000001", TenantID: testTenant}})
	var cfg Config
	if err := decodeStrict(data, &cfg); err != nil {
		t.Fatal("new known config rejected", err)
	}
}

func TestMicrosoftCatalogRelaysOneCodeAndCompletesWithoutFolderStep(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	hold := filepath.Join(env.Home, "hold-mcp")
	if err := os.WriteFile(hold, nil, 0600); err != nil {
		t.Fatal(err)
	}
	c := New(env, []Entry{m}, nil, WithQuota(func() Room { return Room{Free: 2048, OK: true} }))
	ctx, cancel := context.WithCancel(context.Background())
	c.Start(ctx)
	defer func() { cancel(); c.Stop() }()
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
		if v["state"] == "completing" && v["login_phase"] == "files_discovery" {
			if v["user_code"] != nil || v["verification_uri"] != nil {
				t.Fatal("spent prompt remained visible", v)
			}
			if v["attempt_id"] != id {
				t.Fatal("lost attempt identity")
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("single grant never completed", v)
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
	// No folder step: the sign-in completes with nothing to sync.
	done := waitState(t, h, ownerA, "completed")
	if done["address"] != "person@example.test" {
		t.Fatal(done)
	}
	// Completion is published before the worker's reconciliation, which starts
	// sync and then writes the skill with an fsync under c.write. A removal sent
	// in that window is refused as busy, not queued.
	waitLoginWorker(t, c)
	if c.sync.supervised(key{Microsoft, "person@example.test"}) {
		t.Fatal("a sync started without a choice")
	}
	if _, err := os.Stat(filepath.Join(env.Home, BootSignal)); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("boot signal without a sync", err)
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

// The organisation's tenant is the authority of every native refresh: rclone's
// configuration and the MCP server's environment after a restart.
func TestMicrosoftNativeRefreshUsesTheTenant(t *testing.T) {
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
	// rclone's configuration exists where a root syncs: one an earlier
	// release chose, kept by the renewal.
	earlierRoots(t, m, env, address, LevelFull, earlierFullGrant)
	if err := m.testChoose(context.Background(), env, address, []string{"onedrive"}); err != nil {
		t.Fatal(err)
	}
	renewal := msLogin(t, m, env, address)
	if _, err := renewal.WaitWithPrompt(context.Background(), func(Prompt) error { return nil }); err != nil {
		t.Fatal(err)
	}
	if err := renewal.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	config, err := os.ReadFile(filepath.Join(env.Home, microsoftDir, address+".conf"))
	if err != nil || !strings.Contains(string(config), "tenant = "+testTenant+"\n") {
		t.Fatal("wrong rclone refresh authority", err)
	}
	app := env.microsoftApps()[LevelFull]
	cmd, ok := microsoftMCPCommand(env, app, microsoftMCPDir+"/"+address, address, microsoftMCPScopes)
	if !ok || !strings.Contains(strings.Join(cmd.Env, "\n"), "MS365_MCP_TENANT_ID="+testTenant) {
		t.Fatal("restart lost the tenant")
	}
}

// A hand-written audience keyword is not a single-tenant application: the
// daemon does not offer Microsoft rather than sign people in through it.
func TestMicrosoftAudienceKeywordIsNotConfigured(t *testing.T) {
	for _, tenant := range []string{"", "common", "organizations", "consumers"} {
		env := microsoftEnv(t)
		env.Config.Microsoft.TenantID = tenant
		if (&microsoft{}).AppConfigured(env) {
			t.Errorf("tenant %q configured", tenant)
		}
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
		reply string
		state ServiceState
	}{
		{`{"state":"unreachable"}`, StateUnreachable},
		{`{"state":"refused"}`, StateLoginExpired},
		{`{"state":"outside_tenant"}`, StateLoginExpired},
		{`{"state":"ok"}`, StateOK},
		// Anything the adapter did not decide is asked again, never a refusal.
		{`{"success":false,"reason":"native_failed"}`, StateUnreachable},
		{`{"state":"Login failed: invalid_grant"}`, StateUnreachable},
	} {
		if err := os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), []byte(test.reply), 0600); err != nil {
			t.Fatal(err)
		}
		if services := m.Check(context.Background(), env, address); services[2].State != test.state {
			t.Fatal(services)
		}
	}
}

// A renewal keeps exactly the roots that sync, under their own directories
// and with their listings untouched; a root an earlier release's folder step
// offered and nobody chose is left out, and no new library is looked for.
func TestMicrosoftReloginKeepsSyncingRootsAndDoesNotResyncHealthyPairs(t *testing.T) {
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
	earlierRoots(t, m, env, address, LevelFull, earlierFullGrant)
	remotes, err := microsoftRemotes(env, address)
	if err != nil || len(remotes) != 2 {
		t.Fatal(remotes, err)
	}
	if err := m.testChoose(context.Background(), env, address, []string{remotes[1].Name}); err != nil {
		t.Fatal(err)
	}
	listing := filepath.Join(env.Home, microsoftWork(address, remotes[1].Name), "local..dropbox.path1.lst")
	if err := os.WriteFile(listing, []byte("healthy native listing: do not reinitialize"), 0600); err != nil {
		t.Fatal(err)
	}
	base := m.client.Transport
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host == "graph.microsoft.com" && r.URL.Path != "/v1.0/me" {
			t.Errorf("renewal looked for files: %s", r.URL.Path)
		}
		return base.RoundTrip(r)
	})
	l := connect()
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	if len(l.restart) != 0 {
		t.Fatal("a renewal at the same level restarted passes", l.restart)
	}
	current, err := microsoftRemotes(env, address)
	if err != nil || len(current) != 1 || current[0] != remotes[1] {
		t.Fatalf("roots after renewal %+v %v", current, err)
	}
	data, err := os.ReadFile(listing)
	if err != nil || string(data) != "healthy native listing: do not reinitialize" {
		t.Fatal("healthy pair was resynced", err)
	}
	if cmd, ok := m.SyncCommand(env, address); !ok || !strings.Contains(strings.Join(cmd.Args, " "), remotes[1].Name+":") {
		t.Fatal("the syncing library stopped", cmd.Args)
	}
	if dirs := m.Directories(env, address); len(dirs) != 1 || dirs[0].Path != remotes[1].Directory {
		t.Fatal(dirs)
	}
	config, _ := os.ReadFile(filepath.Join(env.Home, microsoftDir, address+".conf"))
	if strings.Count(string(config), "\ntoken = ") != 1 || !strings.Contains(string(config), "access-secret") || !strings.Contains(string(config), microsoftDiscoveryFixed) {
		t.Fatalf("renewal's token not kept for the roots:\n%s", config)
	}
}

// A new account with a files grant asks Graph nothing about its files,
// offers no folder step and syncs nothing; its agents search and fetch.
func TestMicrosoftConnectOffersNoFolderStepAndSyncsNothing(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	base := m.client.Transport
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host == "graph.microsoft.com" && r.URL.Path != "/v1.0/me" {
			t.Errorf("sign-in looked for files: %s", r.URL.Path)
		}
		return base.RoundTrip(r)
	})
	c := New(env, []Entry{m}, nil, WithQuota(func() Room { return Room{Free: 1 << 40, OK: true} }))
	ctx, cancel := context.WithCancel(context.Background())
	c.Start(ctx)
	defer func() { cancel(); c.Stop() }()
	h := c.Handler(allow)
	if code, _, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft"}); code != 200 {
		t.Fatal(code)
	}
	v := waitState(t, h, ownerA, "completed")
	if v["address"] != "person@example.test" {
		t.Fatal(v)
	}
	address := "person@example.test"
	if remotes, err := microsoftRemotes(env, address); err != nil || len(remotes) != 0 {
		t.Fatal("roots without a choice", remotes, err)
	}
	if _, ready := m.SyncCommand(env, address); ready {
		t.Fatal("a new account syncs")
	}
	if dirs := m.Directories(env, address); len(dirs) != 0 {
		t.Fatal(dirs)
	}
	if _, err := os.Stat(filepath.Join(env.Home, "cloud")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("a cloud directory was made", err)
	}
	// The files row is the one sign-in's: agents reach files through it.
	reply, _ := json.Marshal(map[string]any{"state": "ok", "scopes": strings.Fields(earlierFullGrant + " " + microsoftMCPScopes)})
	os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), reply, 0600)
	services := m.Check(context.Background(), env, address)
	var ids []string
	for _, s := range services {
		ids = append(ids, s.ID)
	}
	if !slices.Equal(ids, []string{"onedrive", "mail", "calendar", "contacts"}) || services[0].State != services[1].State || services[0].Failure != "" {
		t.Fatalf("%+v", services)
	}
	skill := m.Skill(env, address)
	if skill.Synced || skill.Mirrored || strings.Contains(skill.Body, "Synced directories") || strings.Contains(skill.Body, "~/cloud/onedrive") || strings.Contains(skill.Body, "first sync") {
		t.Fatal(skill.Body)
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
	earlierRoots(t, m, env, address, LevelFull, earlierFullGrant)
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
	if err := m.testChoose(context.Background(), env, address, []string{remotes[0].Name, remotes[1].Name, "sp-012345678901234567890123"}); err != nil {
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
	earlierRoots(t, m, env, address, LevelFull, earlierFullGrant)
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		t.Fatal(err)
	}
	if err := m.testChoose(context.Background(), env, address, []string{remotes[0].Name, remotes[1].Name}); err != nil {
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
}

func (e *fastMicrosoftEntry) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	return e.StartLevelLogin(ctx, env, address, "")
}
func (e *fastMicrosoftEntry) StartLevelLogin(ctx context.Context, env Env, address string, level Level) (Login, error) {
	login, err := e.microsoft.StartLevelLogin(ctx, env, address, level)
	if err == nil {
		login.(*microsoftLogin).interval = time.Millisecond
	}
	return login, err
}

// A renewal of an account whose OneDrive syncs completes without a folder
// step and the sync carries on. A level change that turns the root to the
// other direction runs its first pass in the new one as the attempt's pass;
// if that pass fails, the attempt fails and the account and its files stay.
func TestMicrosoftRenewalKeepsRetainedSync(t *testing.T) {
	for _, action := range []string{"renewal", "level-change", "level-change-fails", "level-change-full"} {
		t.Run(action, func(t *testing.T) {
			env := microsoftLevelEnv(t)
			m := syntheticMicrosoft(t, "person@example.test", "")
			l := msLogin(t, m, env, "")
			address, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
			if err != nil {
				t.Fatal(err)
			}
			if err := l.Commit(context.Background(), address); err != nil {
				t.Fatal(err)
			}
			earlierRoots(t, m, env, address, LevelFull, earlierFullGrant)
			if err := m.testChoose(context.Background(), env, address, []string{"onedrive"}); err != nil {
				t.Fatal(err)
			}
			e := &fastMicrosoftEntry{microsoft: m}
			room := Room{Free: 2048, OK: true}
			c := New(env, []Entry{e}, nil, WithQuota(func() Room { return room }))
			ctx, cancel := context.WithCancel(context.Background())
			c.Start(ctx)
			defer func() { cancel(); c.Stop() }()
			if !c.sync.supervised(key{Microsoft, address}) {
				t.Fatal("initial native sync not supervised")
			}
			level := Level("")
			if action != "renewal" {
				level = LevelRead
				microsoftGrantToken(t, m, microsoftReadGrant, true)
			}
			if action == "level-change-fails" {
				// The read level's first pass is a mirror pass.
				wrapper := filepath.Join(t.TempDir(), "rclone")
				script := "#!/bin/sh\nset -eu\nfor a in \"$@\"; do [ \"$a\" != sync ] || exit 7; done\nexec '" + env.Config.Tools["rclone"] + "' \"$@\"\n"
				if err := os.WriteFile(wrapper, []byte(script), 0700); err != nil {
					t.Fatal(err)
				}
				env.Config.Tools["rclone"] = wrapper
				c.env.Config.Tools["rclone"] = wrapper
			}
			if action == "level-change-full" {
				// A full home takes no pass, not even one of local files.
				c.write.Lock()
				c.quota = func() Room { return Room{OK: true, Full: true} }
				c.write.Unlock()
			}
			if err := c.startLogin(ownerA, e, address, level); err != nil {
				t.Fatal(err)
			}
			h := c.Handler(allow)
			if action == "level-change-fails" || action == "level-change-full" {
				if v := waitState(t, h, ownerA, "failed"); v["address"] != address {
					t.Fatal(v)
				}
			} else {
				waitState(t, h, ownerA, "completed")
			}
			waitLoginWorker(t, c)
			remotes, err := microsoftRemotes(env, address)
			if err != nil || len(remotes) != 1 || remotes[0].Name != "onedrive" {
				t.Fatal("roots after", action, remotes, err)
			}
			if _, err := os.Stat(filepath.Join(env.Home, remotes[0].Directory)); err != nil {
				t.Fatal("local files gone", err)
			}
			switch action {
			case "renewal":
				if !remotes[0].Writable || !c.sync.supervised(key{Microsoft, address}) {
					t.Fatal("retained account lost sync after renewal")
				}
			case "level-change":
				if remotes[0].Writable || !microsoftReady(env, address, remotes[0]) || !c.sync.supervised(key{Microsoft, address}) {
					t.Fatal("the turned root does not sync as a mirror")
				}
			case "level-change-fails", "level-change-full":
				if a, _ := m.Accounts(env); len(a) != 1 {
					t.Fatal("a failed pass removed the account", a)
				}
				// The pass in the new direction stays recorded: the root
				// is still the account's, and the next start runs it.
				if !remotes[0].RecoverySelected || len(m.Directories(env, address)) != 1 || !microsoftRecoveryNeeded(env, address) {
					t.Fatal("the turned root was forgotten", remotes[0])
				}
				renewal := msLogin(t, m, env, address)
				if _, err := renewal.WaitWithPrompt(context.Background(), func(Prompt) error { return nil }); err != nil {
					t.Fatal(err)
				}
				if err := renewal.Commit(context.Background(), address); err != nil {
					t.Fatal(err)
				}
				if kept, _ := microsoftRemotes(env, address); len(kept) != 1 || kept[0].Name != "onedrive" {
					t.Fatal("a renewal dropped the turned root", kept)
				}
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
	defer func() { cancel(); c.Stop() }()
	if err := c.startLogin(ownerA, e, "", ""); err != nil {
		t.Fatal(err)
	}
	h := c.Handler(allow)
	deadline := time.Now().Add(3 * time.Second)
	for {
		_, v, _ := call(t, h, "GET", LoginPath, ownerA, nil)
		if v["state"] == "completing" && v["login_phase"] == "files_discovery" {
			if v["user_code"] != nil || v["verification_uri"] != nil {
				t.Fatal("spent prompt remained visible", v)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal(v)
		}
		time.Sleep(time.Millisecond)
	}
	address := "person@example.test"
	// files_discovery is published before staging exists. The native import
	// starts only after staging is ready, and hold-mcp keeps identity private.
	waitFor(t, "native import", func() bool { return exists(filepath.Join(env.Home, "import-started")) })
	// Model the instant after MSAL persists, before Wait has returned identity.
	if err := os.WriteFile(filepath.Join(env.Home, microsoftMCPDir, ".pending", address, ".token-cache.json"), []byte("native pending grant"), 0600); err != nil {
		t.Fatal(err)
	}
	code, out, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "microsoft", "address": address, "delete_directories": false})
	if code != 200 {
		t.Fatal(code, out)
	}
	c.relay.mu.Lock()
	done := c.relay.current().done
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

// Exercise real discovery and its logging with provider-shaped failures. Raw
// provider text, identifiers and bodies must never become log or browser data.
func TestMicrosoftDiscoveryFailureDiagnostics(t *testing.T) {
	for _, tc := range []struct {
		name, path, body, step, kind, code, message string
		status                                      int
	}{
		{"onedrive-http", "/v1.0/me/drive", `{"error":{"code":"BadRequest","message":"Tenant does not have a SPO license.","innerError":{"request-id":"private-id"}}}`, "onedrive", "unknown", "BadRequest", "Tenant does not have a SPO license.", 400},
		{"followed-sites-permission", "/v1.0/me/followedSites", `{"error":{"code":"accessDenied","message":"Insufficient privileges to complete the operation."}}`, "followed_sites", "business", "accessDenied", "Insufficient privileges to complete the operation.", 403},
		{"site-libraries-throttled", "/v1.0/sites/" + testMicrosoftSite + "/drives", `{"error":{"code":"TooManyRequests","message":"private@example.test access-secret private-id"}}`, "site_drives", "business", "TooManyRequests", "redacted", 429},
		{"unknown-code", "/v1.0/me/drive", `{"error":{"code":"access-secret","message":"private@example.test"}}`, "onedrive", "unknown", "redacted", "redacted", 500},
		{"html", "/v1.0/me/drive", `<html>access-secret private@example.test</html>`, "onedrive", "unknown", "redacted", "redacted", 502},
		{"oversize", "/v1.0/me/drive", strings.Repeat("access-secret", 256<<10), "onedrive", "unknown", "redacted", "redacted", 503},
		{"malformed-success", "/v1.0/me/drive", `access-secret`, "onedrive", "unknown", "not_applicable", "not_applicable", 200},
		{"pagination", "/v1.0/me/followedSites", `{"value":[],"@odata.nextLink":"https://example.test/access-secret"}`, "followed_sites_limit", "business", "not_applicable", "not_applicable", 200},
		{"invalid-drive", "/v1.0/me/drive", `{"id":"private@example.test","driveType":"business"}`, "onedrive_metadata", "business", "not_applicable", "not_applicable", 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := microsoftEnv(t)
			m := syntheticMicrosoft(t, "person@example.test", "")
			base := m.client.Transport
			m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
				if r.URL.Path == tc.path {
					return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body)), Header: make(http.Header)}, nil
				}
				return base.RoundTrip(r)
			})
			// The startup repair is what still discovers (microsoft_recover_linux.go).
			l := &microsoftLogin{entry: m, env: env, address: "person@example.test"}
			err := l.discover(context.Background(), "access-secret", map[string]bool{"Files.ReadWrite.All": true, "Sites.ReadWrite.All": true})
			if err == nil {
				t.Fatal("failed discovery succeeded")
			}
			var logs bytes.Buffer
			c := testCatalog(t, env.Home, nil)
			c.log = slog.New(slog.NewJSONHandler(&logs, nil))
			a := &attempt{provider: Microsoft, owner: ownerA, state: "device_code"}
			c.relay.put(a)
			c.failAttempt(a, err)
			var event map[string]any
			if err := json.Unmarshal(logs.Bytes(), &event); err != nil {
				t.Fatal(err)
			}
			wantStatus := tc.status
			if tc.name == "pagination" || tc.name == "invalid-drive" {
				wantStatus = 0
			} // local validation, not a failed HTTP request
			for key, want := range map[string]any{"step": tc.step, "reason": "tool_failed", "tool": "direct_http", "exit_status": "not_applicable", "http_status": float64(wantStatus), "tenant_kind": tc.kind, "graph_code": tc.code, "graph_message": tc.message} {
				if event[key] != want {
					t.Errorf("%s = %v, want %v", key, event[key], want)
				}
			}
			for _, secret := range []string{"access-secret", "refresh-secret", "private@example.test", "private-id", testMicrosoftSite, "Authorization", "Bearer"} {
				if strings.Contains(logs.String(), secret) {
					t.Errorf("diagnostic leaked %s", secret)
				}
			}
			view, _ := json.Marshal(c.relay.view(ownerA, ""))
			if !strings.Contains(string(view), `"state":"failed"`) || strings.Contains(string(view), "graph_message") || strings.Contains(string(view), tc.body) || loginFailure(err) != "tool_failed" {
				t.Fatal("provider diagnostic crossed browser contract")
			}
		})
	}
}

func TestMicrosoftDiscoveryTransportAndMissingScope(t *testing.T) {
	for _, mode := range []string{"transport", "missing-scope", "cancel", "deadline"} {
		t.Run(mode, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			if mode == "deadline" {
				var stop context.CancelFunc
				ctx, stop = context.WithDeadline(ctx, time.Now().Add(-time.Second))
				defer stop()
			}
			m := syntheticMicrosoft(t, "person@example.test", "")
			base := m.client.Transport
			m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
				if r.Context().Err() != nil {
					return nil, r.Context().Err()
				}
				if (mode == "transport" || mode == "cancel") && r.URL.Path == "/v1.0/me/drive" {
					if mode == "cancel" {
						cancel()
					}
					return nil, fmt.Errorf("access-secret")
				}
				return base.RoundTrip(r)
			})
			l := &microsoftLogin{entry: m, env: microsoftEnv(t), address: "person@example.test"}
			err := l.discover(ctx, "access-secret", map[string]bool{"Sites.ReadWrite.All": mode != "missing-scope"})
			if mode == "missing-scope" {
				// Without the sites grant OneDrive alone is discovered.
				if err != nil || !strings.Contains(string(l.config), "[onedrive]") || strings.Contains(string(l.config), "[sp-") {
					t.Fatalf("sites left out: %v\n%s", err, l.config)
				}
				return
			}
			var detail microsoftDiscoveryError
			if !errors.As(err, &detail) {
				t.Fatal("missing discovery diagnostic", err)
			}
			if mode == "transport" {
				if detail.step != "onedrive" || !errors.Is(err, ServerUnreachable) {
					t.Fatal(detail)
				}
			} else if mode == "cancel" || mode == "deadline" {
				want, reason := context.Canceled, "cancelled"
				if mode == "deadline" {
					want, reason = context.DeadlineExceeded, "expired"
				}
				if detail.step != "onedrive" || !errors.Is(err, want) || loginFailure(err) != reason {
					t.Fatal("lost context outcome", detail)
				}
			}
		})
	}
}

// A followed site can survive deletion or loss of permission. That site must
// not take the person's OneDrive and other followed libraries down with it.
// A Teams shared channel hosted by another organisation is followed too but
// lives on that organisation's host; the skip says which case it resembles.
func TestMicrosoftUnavailableFollowedSiteIsPartialSuccess(t *testing.T) {
	const partnerSite = "fabrikam.sharepoint.com,7B1D5A3C-0000-4000-8000-000000000002,7B1D5A3C-0000-4000-8000-000000000003"
	for _, tc := range []struct {
		status     int
		site, host string
	}{{403, testMicrosoftMissingSite, siteHostSame}, {404, testMicrosoftMissingSite, siteHostSame}, {404, partnerSite, siteHostOther}, {401, testMicrosoftMissingSite, ""}, {429, testMicrosoftMissingSite, ""}, {500, testMicrosoftMissingSite, ""}} {
		status, missing := tc.status, tc.site
		t.Run(fmt.Sprint(status, "-", tc.host), func(t *testing.T) {
			m := syntheticMicrosoft(t, "person@example.test", "")
			base := m.client.Transport
			m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
				body := ""
				code := 200
				switch r.URL.Path {
				case "/v1.0/me/followedSites":
					body = fmt.Sprintf(`{"value":[{"id":%q,"displayName":"Unavailable team","webUrl":"https://example.test/site"},{"id":%q,"displayName":"Team","webUrl":"https://contoso.sharepoint.com/sites/team"}]}`, missing, testMicrosoftSite)
				case "/v1.0/sites/" + missing + "/drives":
					code = status
					body = `{"error":{"code":"itemNotFound","message":"private@example.test access-secret"}}`
				case "/v1.0/sites/example.test:/site":
					body = fmt.Sprintf(`{"id":%q}`, missing)
				default:
					return base.RoundTrip(r)
				}
				return &http.Response{StatusCode: code, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
			})
			l := &microsoftLogin{entry: m, env: microsoftEnv(t), address: "person@example.test"}
			err := l.discover(context.Background(), "access-secret", map[string]bool{"Sites.ReadWrite.All": true})
			if status != 403 && status != 404 {
				if err == nil {
					t.Fatal("account-wide failure ignored")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if len(l.unavailableSites) != 1 || l.unavailableSites[0] != "Unavailable team" || len(l.skippedSites) != 1 {
				t.Fatal("missing partial-discovery notice")
			}
			if !strings.Contains(string(l.config), "drive_id=primary-drive,") || !strings.Contains(string(l.config), "drive_id=library-drive,") {
				t.Fatal("reachable roots lost")
			}
			log, _ := json.Marshal(l.skippedSites[0].diagnostic())
			if !strings.Contains(string(log), fmt.Sprint(status)) || !strings.Contains(string(log), `"site_drives"`) {
				t.Fatal("missing status", string(log))
			}
			if !strings.Contains(string(log), `"site_host",`+strconv.Quote(tc.host)) {
				t.Fatal("missing site host placement", string(log))
			}
			for _, secret := range []string{"private@example.test", "access-secret", missing, "Unavailable team", "fabrikam", "contoso"} {
				if strings.Contains(string(log), secret) {
					t.Fatal("unsafe skip diagnostic")
				}
			}
		})
	}
}
