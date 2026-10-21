//go:build linux

package integrations

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAgentPasswordAccountsNoBrowserLease(t *testing.T) {
	home := newHome(t)
	c := testCatalog(t, home, Production())
	h := c.AgentHandler(allow, "/agent/v1/integrations", "/agent/v1/integrations/accounts")
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
	for _, path := range []string{LoginPath, "/agent/v1/integrations/login", ListPath, AccountsPath} {
		code, _, _ = call(t, h, "GET", path, ownerA, nil)
		if code != 404 {
			t.Fatal(path, code)
		}
	}
	denied := c.AgentHandler(func(*http.Request) bool { return false }, "/agent/v1/integrations", "/agent/v1/integrations/accounts")
	code, _, _ = call(t, denied, "DELETE", "/agent/v1/integrations/accounts", ownerA, map[string]any{"action": "remove", "provider": "imap", "address": "a@example.test", "delete_directories": false})
	if code != 403 {
		t.Fatal("session bypassed peer guard")
	}
	code, _, _ = call(t, h, "DELETE", "/agent/v1/integrations/accounts", "", map[string]any{"action": "remove", "provider": "imap", "address": "a@example.test", "delete_directories": false})
	if code != 200 {
		t.Fatal("remove", code)
	}
}
