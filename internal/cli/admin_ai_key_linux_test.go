//go:build linux

package cli

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/gateway"
)

// viaGatewayWithKey is viaGateway with the site AI key file beside the state.
func viaGatewayWithKey(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	keyFile := filepath.Join(dir, "site-ai-key.json")
	a, e := gateway.NewAuth(gateway.OAuthConfig{ClientID: "test", ClientSecret: "test", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, gateway.AuthOptions{Provider: gateway.GitHubProvider{}, Sink: revokeTestSink{}, Broker: adminTestBroker{bound: true}, AdminFile: filepath.Join(dir, "administration.json"), SiteKeyFile: keyFile})
	if e != nil {
		t.Fatal(e)
	}
	adminRoundTrip = func(payload []byte) ([]byte, error) {
		b, e := a.AdminControl(context.Background(), payload)
		if e != nil {
			return []byte("ERROR " + gateway.AdminControlError(e) + "\n"), nil
		}
		return append(b, '\n'), nil
	}
	t.Cleanup(func() { adminRoundTrip = socketRoundTrip })
	return keyFile
}

// set reads the key from stdin or a file, never argv; show, set and delete
// print only provider and suffix; dry runs send the gateway's checks and
// write nothing; delete needs the replacement offer; and no output or refusal
// echoes the key.
func TestAdminAIKeyCommands(t *testing.T) {
	keyFile := viaGatewayWithKey(t)
	key := "sk-ant-api03-" + strings.Repeat("Q", 30) + "Zz9_"
	stdin := func(s string) {
		r, w, _ := os.Pipe()
		_, _ = w.WriteString(s)
		_ = w.Close()
		old := os.Stdin
		os.Stdin = r
		t.Cleanup(func() { os.Stdin = old })
	}
	noKey := func(where string, texts ...string) {
		t.Helper()
		for _, s := range texts {
			if strings.Contains(s, key) || strings.Contains(s, key[:16]) {
				t.Fatalf("%s echoed the key", where)
			}
		}
	}
	code, out, stderr := call(t, "--json", "admin", "ai-key", "show")
	if code != 0 || out["data"].(map[string]any)["stored"] != false || out["data"].(map[string]any)["offer"] != "all" {
		t.Fatalf("show: %d %v %s", code, out, stderr)
	}

	// Usage errors: argv has no key flag, the provider and shape are checked
	// locally, and the rejection names neither value.
	for _, args := range [][]string{
		{"set", "--provider", "anthropic", "--key", key},
		{"set", "--provider", "mistral", "--key-file", "-"},
		{"set", "--provider", "openai", "--key-file", "-"},
		{"delete"},
		{"delete", "--offer", "site_key"},
		{"show", "--dry-run"},
	} {
		stdin(key + "\n")
		code, _, stderr = call(t, append([]string{"--json", "admin", "ai-key"}, args...)...)
		if code != 1 || !strings.Contains(stderr, "invalid_arguments") {
			t.Fatalf("%v: %d %s", args, code, stderr)
		}
		noKey("refusal", stderr)
	}

	stdin(key + "\n")
	code, out, stderr = call(t, "--json", "admin", "ai-key", "set", "--provider", "anthropic", "--key-file", "-", "--dry-run")
	would := out["data"].(map[string]any)["would"].([]any)[0].(map[string]any)
	if code != 0 || would["input"].(map[string]any)["key_suffix"] != "Zz9_" {
		t.Fatalf("dry set: %d %v %s", code, out, stderr)
	}
	if _, e := os.Stat(keyFile); !os.IsNotExist(e) {
		t.Fatal("dry run stored the key")
	}
	file := filepath.Join(t.TempDir(), "key")
	if e := os.WriteFile(file, []byte(key+"\n"), 0600); e != nil {
		t.Fatal(e)
	}
	code, out, stderr = call(t, "--json", "admin", "ai-key", "set", "--provider", "anthropic", "--key-file", file)
	data := out["data"].(map[string]any)
	if code != 0 || data["offer"] != "site_key" || data["site_key"].(map[string]any)["suffix"] != "Zz9_" {
		t.Fatalf("set: %d %v %s", code, out, stderr)
	}
	stored, _ := os.ReadFile(keyFile)
	if !strings.Contains(string(stored), `"key":"`+key+`"`) {
		t.Fatal("the stored key is not the file's, without its newline")
	}
	code, out, stderr = call(t, "--json", "admin", "ai-key", "show")
	shown := out["data"].(map[string]any)
	if code != 0 || shown["stored"] != true || shown["site_key"].(map[string]any)["provider"] != "anthropic" {
		t.Fatal("show after set", code, out)
	}
	// The onboarding document now keeps site_key; changing it is refused.
	doc := writeDoc(t, `{"repositories":{"mode":"preselected","defaults":[]},"integrations":[],"ai_account":{"offer":"claude"}}`)
	if code, _, stderr = call(t, "--json", "admin", "onboarding", "update", "--file", doc, "--expected-version", "1"); code != 1 || !strings.Contains(stderr, "site_key_stored") {
		t.Fatalf("offer moved with a stored key: %d %s", code, stderr)
	}

	if code, out, _ = call(t, "--json", "admin", "ai-key", "delete", "--offer", "chatgpt", "--dry-run"); code != 0 {
		t.Fatal("dry delete", code)
	}
	if _, e := os.Stat(keyFile); e != nil {
		t.Fatal("dry delete removed the key")
	}
	code, out, stderr = call(t, "--json", "admin", "ai-key", "delete", "--offer", "chatgpt")
	if code != 0 || out["data"].(map[string]any)["offer"] != "chatgpt" || out["data"].(map[string]any)["stored"] != false {
		t.Fatalf("delete: %d %v %s", code, out, stderr)
	}
	if _, e := os.Stat(keyFile); !os.IsNotExist(e) {
		t.Fatal("delete left the key")
	}
	if code, _, stderr = call(t, "--json", "admin", "ai-key", "delete", "--offer", "all"); code != 1 || !strings.Contains(stderr, "site_key_unavailable") {
		t.Fatalf("delete twice: %d %s", code, stderr)
	}
}
