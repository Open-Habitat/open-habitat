//go:build linux

package integrations

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestAgentPasswordAccountsNoBrowserLease(t *testing.T) {
	home := newHome(t)
	c := testCatalog(t, home, Production())
	h := c.AgentHandler(allow, "/agent/v1/integrations", "/agent/v1/integrations/accounts", "/agent/v1/integrations/login", "/agent/v1/integrations/gitea", "/agent/v1/integrations/gitlab")
	secret := "sentinel-agent-password"
	input := imapAccount("a@example.test", secret)
	code, _, raw := call(t, h, "POST", "/agent/v1/integrations/accounts", ownerA, input)
	if code != 200 || strings.Contains(raw, secret) {
		t.Fatalf("connect: %d %s", code, raw)
	}
	code, _, raw = call(t, h, "GET", "/agent/v1/integrations", ownerB, nil)
	if code != 200 || strings.Contains(raw, secret) || !strings.Contains(raw, "a@example.test") {
		t.Fatalf("list: %d %s", code, raw)
	}
	// Native tool store, not a host-owned credential database.
	found := false
	filepath.WalkDir(home, func(path string, d os.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			b, _ := os.ReadFile(path)
			if strings.Contains(string(b), secret) {
				found = true
				if !strings.Contains(path, "himalaya") {
					t.Error("credential outside tool store")
				}
			}
		}
		return nil
	})
	if !found {
		t.Fatal("native account not persisted")
	}
	code, _, raw = call(t, h, "POST", "/agent/v1/integrations/accounts", "", map[string]any{"action": "password", "provider": "imap", "address": "a@example.test", "password": "new-" + secret})
	if code != 200 || strings.Contains(raw, secret) {
		t.Fatalf("password: %d %s", code, raw)
	}
	for _, path := range []string{LoginPath, ListPath, AccountsPath} {
		code, _, _ = call(t, h, "GET", path, ownerA, nil)
		if code != 404 {
			t.Fatal(path, code)
		}
	}
	denied := c.AgentHandler(func(*http.Request) bool { return false }, "/agent/v1/integrations", "/agent/v1/integrations/accounts", "/agent/v1/integrations/login", "/agent/v1/integrations/gitea", "/agent/v1/integrations/gitlab")
	code, _, _ = call(t, denied, "DELETE", "/agent/v1/integrations/accounts", ownerA, map[string]any{"action": "remove", "provider": "imap", "address": "a@example.test", "delete_directories": false})
	if code != 403 {
		t.Fatal("session bypassed peer guard")
	}
	code, _, _ = call(t, h, "DELETE", "/agent/v1/integrations/accounts", "", map[string]any{"action": "remove", "provider": "imap", "address": "a@example.test", "delete_directories": false})
	if code != 200 {
		t.Fatal("remove", code)
	}
}

func TestAgentOAuthUsesOwnLeaseAndNativeFolderChecks(t *testing.T) {
	home := newHome(t)
	e := &syncScriptEntry{&scriptEntry{provider: Google, kind: PastedRedirect, signsIn: "person@example.test", folders: []Folder{{ID: "drive", Name: "Drive", Bytes: 1}}}}
	c := testCatalog(t, home, []Entry{e})
	const path = "/agent/v1/integrations/login"
	agent := c.AgentHandler(allow, "/agent/v1/integrations", "/agent/v1/integrations/accounts", path, "/agent/v1/integrations/gitea", "/agent/v1/integrations/gitlab")
	browser := c.Handler(allow)
	code, out, raw := call(t, agent, "POST", path, ownerA, map[string]any{"action": "start", "provider": "google"})
	if code != 200 || out["state"] != "open_url" {
		t.Fatal(code, raw)
	}
	id := out["attempt_id"].(string)
	if code, out, raw = call(t, browser, "GET", LoginPath, ownerA, nil); code != 200 || out["state"] != "none" {
		t.Fatal("browser borrowed agent lease", code, raw)
	}
	if code, _, raw = call(t, browser, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1/?code=synthetic&state=s1"}); code != 404 {
		t.Fatal("browser submitted", code, raw)
	}
	if code, _, raw = call(t, agent, "PUT", path, ownerB, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "https://evil.example.test/?code=SENTINEL"}); code != 422 || strings.Contains(raw, "SENTINEL") {
		t.Fatal("unsafe redirect", code, raw)
	}
	if code, out, raw = call(t, agent, "PUT", path, "", map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1/?code=synthetic&state=s1"}); code != 200 {
		t.Fatal(code, raw)
	}
	deadline := time.Now().Add(3 * time.Second)
	for out["state"] != "choose_folders" {
		if time.Now().After(deadline) {
			t.Fatal("no folders", out)
		}
		time.Sleep(time.Millisecond)
		_, out, _ = call(t, agent, "GET", path, ownerB, nil)
	}
	if code, _, raw = call(t, agent, "PUT", path, "", map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"unobserved"}}); code == 200 {
		t.Fatal("unobserved folder", raw)
	}
	if code, _, raw = call(t, agent, "DELETE", path, "", map[string]any{"action": "cancel", "attempt_id": "20260101T000000.000000000"}); code != 404 {
		t.Fatal("stale cancel", code, raw)
	}
	if code, _, raw = call(t, agent, "PUT", path, "", map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"drive"}}); code != 200 {
		t.Fatal("valid folders", code, raw)
	}
	if code, _, raw = call(t, agent, "DELETE", path, "", map[string]any{"action": "cancel", "attempt_id": id}); code != 200 {
		t.Fatal("cancel", code, raw)
	}
}
