//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestPiOAuthCompletionDoesNotRequirePaste(t *testing.T) {
	for _, mode := range []string{"immediate", "loopback"} {
		t.Run(mode, func(t *testing.T) {
			env := atlassianFixture(t)
			if err := os.WriteFile(filepath.Join(env.Home, "mode"), []byte(mode), 0600); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			var l Login
			var err error
			if mode == "immediate" {
				l, err = startPiOAuth(ctx, env, atlassianServer, false)
			} else {
				l, err = (&atlassian{}).StartLevelLogin(ctx, env, "", LevelRead)
			}
			if err != nil {
				t.Fatal(err)
			}
			defer l.Cancel()
			p, err := l.Prompt(ctx)
			if err != nil || !validPrompt(PastedRedirect, p) {
				t.Fatal(p, err)
			}
			address, err := l.Wait(ctx)
			if err != nil || address != atlassianServer {
				t.Fatal(address, err)
			}
		})
	}
}
func TestAtlassianUnacceptedNewLoginCleansOnlyItsNativeEntry(t *testing.T) {
	for _, mode := range []string{"fail", "cancel"} {
		t.Run(mode, func(t *testing.T) {
			env := atlassianFixture(t)
			dir := filepath.Join(env.Home, ".pi/agent")
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			original := []byte(`{"mcpServers":{"other":{"url":"https://other.invalid/mcp"}}}`)
			if err := os.WriteFile(filepath.Join(dir, "mcp.json"), original, 0600); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(env.Home, "mode"), []byte(mode), 0600); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			l, err := (&atlassian{}).StartLevelLogin(ctx, env, "", LevelRead)
			if err != nil {
				t.Fatal(err)
			}
			_, err = l.Prompt(ctx)
			if mode == "fail" && err == nil {
				t.Fatal("failure hidden")
			}
			l.Cancel()
			accounts, err := (&atlassian{}).Accounts(env)
			if err != nil || len(accounts) != 0 {
				t.Fatal(accounts, err)
			}
			data, _ := os.ReadFile(filepath.Join(dir, "mcp.json"))
			var root struct {
				Servers map[string]json.RawMessage `json:"mcpServers"`
			}
			_ = json.Unmarshal(data, &root)
			if len(root.Servers) != 1 || root.Servers["other"] == nil {
				t.Fatal("unrelated entry removed")
			}
		})
	}
}
func TestAtlassianNativeIdentityCollisionIsNotAdopted(t *testing.T) {
	for _, collision := range []string{"namespace", "legacy"} {
		t.Run(collision, func(t *testing.T) {
			env := atlassianFixture(t)
			dir := filepath.Join(env.Home, ".pi/agent")
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			file, contents := "mcp.json", `{"mcpServers":{"open-habitat-atlassian":{"url":"https://mcp.atlassian.com/v2/mcp"}}}`
			if collision == "legacy" {
				file, contents = "mcp-auth.json", `{"https://mcp.atlassian.com/v2/mcp":{"tokens":{"access_token":"do-not-adopt"}}}`
			}
			if err := os.WriteFile(filepath.Join(dir, file), []byte(contents), 0600); err != nil {
				t.Fatal(err)
			}
			if _, err := (&atlassian{}).StartLevelLogin(context.Background(), env, "", LevelRead); err == nil {
				t.Fatal("adopted another native identity")
			}
			after, _ := os.ReadFile(filepath.Join(dir, file))
			if string(after) != contents {
				t.Fatal("changed collision")
			}
		})
	}
}

func TestAtlassianExpiryDoesNotPretendToRefresh(t *testing.T) {
	env := atlassianFixture(t)
	dir := filepath.Join(env.Home, ".pi/agent")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	config := []byte(`{"mcpServers":{"open_habitat_atlassian":{"url":"https://mcp.atlassian.com/v2/mcp","oauth":{"scope":"` + atlassianReadScopes + `"}}}}`)
	if err := os.WriteFile(filepath.Join(dir, "mcp.json"), config, 0600); err != nil {
		t.Fatal(err)
	}
	for _, refresh := range []string{"", "refresh-secret"} {
		state := map[string]any{"tokens": map[string]string{"access_token": "expired-secret", "refresh_token": refresh, "scope": atlassianReadScopes}, "tokensExpireAt": time.Now().Add(-time.Minute).UnixMilli()}
		data, _ := json.Marshal(map[string]any{"mcp__" + atlassianServer + "|" + atlassianURL: state})
		path := filepath.Join(dir, "mcp-auth.json")
		if err := os.WriteFile(path, data, 0600); err != nil {
			t.Fatal(err)
		}
		services, _ := (&atlassian{}).CheckGrant(context.Background(), env, atlassianServer)
		want := StateLoginExpired
		if refresh != "" {
			want = StateUnknown
		}
		if services[0].State != want || services[1].State != want {
			t.Fatal(services)
		}
		after, _ := os.ReadFile(path)
		if string(after) != string(data) {
			t.Fatal("status mutated native credentials")
		}
	}
}

func TestAtlassianNativeSettingsAndWriteShortfall(t *testing.T) {
	env := atlassianFixture(t)
	dir := filepath.Join(env.Home, ".pi/agent")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	config := []byte(`{"mcpServers":{"open_habitat_atlassian":{"url":"https://mcp.atlassian.com/v2/mcp","exposure":"deferred","enabled":true,"oauth":{"scope":"` + atlassianWriteScopes + `"}}}}`)
	if err := os.WriteFile(filepath.Join(dir, "mcp.json"), config, 0600); err != nil {
		t.Fatal(err)
	}
	token, _ := json.Marshal(map[string]any{"mcp__" + atlassianServer + "|" + atlassianURL: map[string]any{"tokens": map[string]string{"access_token": "secret", "scope": atlassianReadScopes}}})
	if err := os.WriteFile(filepath.Join(dir, "mcp-auth.json"), token, 0600); err != nil {
		t.Fatal(err)
	}
	a := &atlassian{}
	accounts, err := a.Accounts(env)
	if err != nil || len(accounts) != 1 {
		t.Fatal(accounts, err)
	}
	services, grant := a.CheckGrant(context.Background(), env, atlassianServer)
	if a.Level(env, atlassianServer, services) != LevelRead || grant == nil || len(grant.NotGranted) != 2 {
		t.Fatal(services, grant)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	l, err := a.StartLevelLogin(ctx, env, atlassianServer, LevelFull)
	if err != nil {
		t.Fatal(err)
	}
	_, err = l.Prompt(ctx)
	if err != nil {
		t.Fatal(err)
	}
	l.Cancel()
	data, _ := os.ReadFile(filepath.Join(dir, "mcp-auth.json"))
	var states map[string]json.RawMessage
	_ = json.Unmarshal(data, &states)
	if states["mcp__"+atlassianServer+"|"+atlassianURL] != nil {
		t.Fatal("level change left old token available for refresh")
	}
	_, servers, err := atlassianMCP.config(env)
	if err != nil {
		t.Fatal(err)
	}
	var entry map[string]json.RawMessage
	_ = json.Unmarshal(servers[atlassianServer], &entry)
	if string(entry["exposure"]) != `"deferred"` || string(entry["enabled"]) != "true" {
		t.Fatal("native settings lost")
	}
	if err := a.Remove(ctx, env, atlassianServer); err != nil {
		t.Fatal(err)
	}
}
