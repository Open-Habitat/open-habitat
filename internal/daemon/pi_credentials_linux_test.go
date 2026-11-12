//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestPiCredentialsNative(t *testing.T) {
	p, home := piFixture(t)
	ctx := context.Background()
	for _, key := range []string{"!id", "$HOME", "${X}", "sk-short", "sk-" + strings.Repeat("a", 201)} {
		if _, err := p.credentials(ctx, "save", "openai", key); err == nil {
			t.Fatal("accepted nonliteral key")
		}
	}
	if _, err := os.Stat(filepath.Join(home, ".pi")); !os.IsNotExist(err) {
		t.Fatal("invalid input wrote native files")
	}
	// Exercise the agent credential adapter's successful native writes/reads
	// here, without a socket/client deadline competing with SDK startup. The
	// route test separately proves own-UID transport, denial and exact paths.
	handler := piCredentialsHandlerAt(transport.Config{}, func(*http.Request) bool { return true }, p, AgentCredentialsPath)
	call := func(method, path, body string) piCredentials {
		t.Helper()
		req := httptest.NewRequest(method, "http://unix"+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		var result piCredentials
		if w.Code != http.StatusOK || json.Unmarshal(w.Body.Bytes(), &result) != nil {
			t.Fatalf("%s %s: %d %s", method, path, w.Code, w.Body)
		}
		return result
	}
	// A real native OAuth record is preserved byte-for-byte through key changes.
	_, events, err := p.Start()
	if err != nil {
		t.Fatal(err)
	}
	for range events {
	}
	path := filepath.Join(home, ".pi/agent/auth.json")
	before, _ := os.ReadFile(path)
	var original map[string]json.RawMessage
	_ = json.Unmarshal(before, &original)
	key := "sk-" + strings.Repeat("a", 24) + "abcd"
	result := call("POST", AgentCredentialsPath, `{"provider":"openai","key":"`+key+`"}`)
	reply, _ := json.Marshal(result)
	if !result.OpenAI.Present || result.OpenAI.Suffix == nil || *result.OpenAI.Suffix != "abcd" || strings.Contains(string(reply), key) {
		t.Fatal("unsafe or incomplete credential reply")
	}
	st, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0600 || st.Sys().(*syscall.Stat_t).Uid != uint32(os.Geteuid()) {
		t.Fatal("credential file has wrong mode/owner")
	}
	raw, _ := os.ReadFile(path)
	var stored map[string]json.RawMessage
	_ = json.Unmarshal(raw, &stored)
	var saved struct {
		Key string `json:"key"`
	}
	if json.Unmarshal(stored["openai"], &saved) != nil || saved.Key != key {
		t.Fatal("native key missing or changed")
	}
	if string(stored["openai-codex"]) != string(original["openai-codex"]) {
		t.Fatal("OAuth entry changed")
	}
	models, err := p.catalog(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	var apiModel string
	for _, m := range models.Models {
		if m.Provider == "openai" {
			apiModel = m.ID
			break
		}
	}
	if apiModel == "" {
		t.Fatal("no API models")
	}
	if _, err = p.catalog(ctx, apiModel, "", "openai"); err != nil {
		t.Fatal(err)
	}
	deepseek := "sk-" + strings.Repeat("d", 24)
	call("POST", AgentCredentialsPath, `{"provider":"deepseek","key":"`+deepseek+`"}`)
	if view := call("GET", AgentCredentialsPath, ""); !view.OpenAI.Present || !view.DeepSeek.Present {
		t.Fatal("missing provider presence")
	}
	call("DELETE", AgentCredentialsPath+"/openai", "")
	if view := call("GET", AgentCredentialsPath, ""); view.OpenAI.Present || !view.DeepSeek.Present {
		t.Fatal("removal did not touch exactly its provider")
	}
	call("DELETE", AgentCredentialsPath+"/deepseek", "")
	raw, _ = os.ReadFile(path)
	_ = json.Unmarshal(raw, &stored)
	var after map[string]json.RawMessage
	_ = json.Unmarshal(raw, &after)
	if after["openai"] != nil || string(after["openai-codex"]) != string(original["openai-codex"]) {
		t.Fatal("removal damaged native credentials")
	}
	models, err = p.catalog(ctx, "")
	if err != nil || models.DefaultProvider == nil || *models.DefaultProvider != "openai-codex" || models.DefaultModel == nil || *models.DefaultModel != "gpt-6.1-sol" {
		t.Fatal("removal did not restore subscription default")
	}
}

func TestPiCredentialsUnsafeAndRawReferences(t *testing.T) {
	p, home := piFixture(t)
	ctx := context.Background()
	path := filepath.Join(home, ".pi/agent/auth.json")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	// Raw read does not execute Pi's command syntax and does not invent a suffix.
	if err := os.WriteFile(path, []byte(`{"openai":{"type":"api_key","key":"!touch should-not-exist"}}`), 0600); err != nil {
		t.Fatal(err)
	}
	result, err := p.credentials(ctx, "read", "", "")
	if err != nil || !result.OpenAI.Present || result.OpenAI.Suffix != nil {
		t.Fatal("raw credential read failed")
	}
	if _, err := os.Stat(filepath.Join(home, "should-not-exist")); !os.IsNotExist(err) {
		t.Fatal("read executed a resolver")
	}
	// Native read-only auth resolves environment variables in Pi 1.3; suffix reads
	// must instead use its raw stored-credential reader.
	t.Setenv("OH_TEST_KEY", "sk-"+strings.Repeat("z", 24)+"wxyz")
	for _, ref := range []string{"$OH_TEST_KEY", "${OH_TEST_KEY}"} {
		raw, _ := json.Marshal(map[string]any{"openai": map[string]any{"type": "api_key", "key": ref}})
		if err := os.WriteFile(path, raw, 0600); err != nil {
			t.Fatal(err)
		}
		result, err = p.credentials(ctx, "read", "", "")
		if err != nil || !result.OpenAI.Present || result.OpenAI.Suffix != nil {
			t.Fatal("credential read resolved an environment reference")
		}
	}
	// Pi's session directories can be 0755 under a normal SSH umask. Read bits
	// do not disclose a 0600 credential, but group/other write bits remain unsafe.
	for _, dir := range []string{filepath.Join(home, ".pi"), filepath.Join(home, ".pi/agent")} {
		if err := os.Chmod(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = p.credentials(ctx, "save", "openai", "sk-"+strings.Repeat("c", 24)); err != nil {
		t.Fatal("rejected native nonwritable directories")
	}
	if err := os.Chmod(filepath.Join(home, ".pi/agent"), 0770); err != nil {
		t.Fatal(err)
	}
	if _, err = p.credentials(ctx, "remove", "openai", ""); err == nil {
		t.Fatal("accepted group-writable credential directory")
	}
	_ = os.Chmod(filepath.Join(home, ".pi/agent"), 0755)
	if err := os.Chmod(path, 0644); err != nil {
		t.Fatal(err)
	}
	for _, action := range []string{"read", "save", "remove"} {
		provider := "openai"
		if action == "read" {
			provider = ""
		}
		if _, err := p.credentials(ctx, action, provider, "sk-"+strings.Repeat("b", 24)); err == nil {
			t.Fatal("accepted unsafe mode")
		}
	}
	_ = os.Remove(path)
	outside := filepath.Join(t.TempDir(), "auth.json")
	_ = os.WriteFile(outside, []byte("{}"), 0600)
	_ = os.Symlink(outside, path)
	if _, err := p.credentials(ctx, "save", "openai", "sk-"+strings.Repeat("b", 24)); err == nil {
		t.Fatal("followed credential symlink")
	}
	raw, _ := os.ReadFile(outside)
	if string(raw) != "{}" {
		t.Fatal("changed symlink target")
	}
}

func TestPiCredentialsAPIOnlyReadinessAndReplacement(t *testing.T) {
	p, home := piFixture(t)
	ctx := context.Background()
	if _, err := p.credentials(ctx, "save", "openai", "sk-"+strings.Repeat("a", 24)); err != nil {
		t.Fatal(err)
	}
	models, err := p.catalog(ctx, "")
	if err != nil || models.DefaultModel == nil || *models.DefaultModel != "gpt-6.1-sol" {
		t.Fatal("first API key did not select Pi's native default model")
	}
	if p.Status() != "usable" {
		t.Fatal("API-only account blocked by subscription gate")
	}
	settings := filepath.Join(home, ".pi/agent/settings.json")
	before, _ := os.ReadFile(settings)
	if _, err := p.credentials(ctx, "save", "openai", "sk-"+strings.Repeat("b", 24)); err != nil {
		t.Fatal(err)
	}
	after, _ := os.ReadFile(settings)
	if string(before) != string(after) {
		t.Fatal("replacement changed default settings")
	}
	if _, err := p.credentials(ctx, "remove", "openai", ""); err != nil {
		t.Fatal(err)
	}
	if p.Status() != "missing" {
		t.Fatal("account without credentials did not return to onboarding")
	}
}

// Anthropic and DeepSeek keys go into Pi's own auth.json exactly as Pi's /login
// writes them, and the pinned Pi CLI then sends each to its provider.
func TestPiCredentialsAnthropicAndDeepSeekNative(t *testing.T) {
	p, home := piFixture(t)
	ctx := context.Background()
	anthropic := "sk-ant-api03-" + strings.Repeat("A", 86) + "_x-AA"
	deepseek := "sk-" + strings.Repeat("0f", 15) + "beef"
	result, err := p.credentials(ctx, "save", "anthropic", anthropic)
	if err != nil {
		t.Fatal(err)
	}
	reply, _ := json.Marshal(result)
	if !result.Anthropic.Present || result.Anthropic.Suffix == nil || *result.Anthropic.Suffix != "x-AA" || result.OpenAI.Present || result.DeepSeek.Present || strings.Contains(string(reply), anthropic) {
		t.Fatalf("unsafe or incomplete Anthropic reply: %s", reply)
	}
	models, err := p.catalog(ctx, "")
	if err != nil || models.DefaultProvider == nil || *models.DefaultProvider != "anthropic" || models.DefaultModel == nil || *models.DefaultModel != "claude-opus-5-5" {
		t.Fatal("first Anthropic key did not select Pi's native default")
	}
	if p.Status() != "usable" {
		t.Fatal("Anthropic-only account blocked by onboarding")
	}
	if result, err = p.credentials(ctx, "save", "deepseek", deepseek); err != nil || !result.DeepSeek.Present || *result.DeepSeek.Suffix != "beef" || !result.Anthropic.Present {
		t.Fatal("DeepSeek key not saved beside Anthropic")
	}
	listed, err := p.models(ctx, "")
	if err != nil || *listed.DefaultProvider != "deepseek" {
		t.Fatal("first DeepSeek key did not become the default")
	}
	offered := map[string]bool{}
	for _, m := range listed.Models {
		if !m.Older {
			offered[m.Provider+"/"+m.ID] = true
		}
	}
	if !offered["anthropic/claude-opus-5-5"] || offered["anthropic/claude-opus-4-8"] || !offered["deepseek/deepseek-v4-pro"] {
		t.Fatalf("chooser lacks provider models or newest grouping: %v", offered)
	}
	raw, _ := os.ReadFile(filepath.Join(home, ".pi/agent/auth.json"))
	var stored map[string]struct{ Type, Key string }
	if json.Unmarshal(raw, &stored) != nil || stored["anthropic"].Type != "api_key" || stored["anthropic"].Key != anthropic || stored["deepseek"].Type != "api_key" || stored["deepseek"].Key != deepseek {
		t.Fatal("keys not in Pi's native api_key form")
	}

	// Pi uses the stored keys natively: x-api-key for Anthropic, Bearer for DeepSeek.
	seen := make(chan string, 4)
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen <- r.URL.Path + " " + r.Header.Get("X-Api-Key") + " " + r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(401) // A retryable status would make Pi back off for the test's lifetime.
		_, _ = w.Write([]byte(`{}`))
	}))
	defer provider.Close()
	overrides, _ := json.Marshal(map[string]any{"providers": map[string]any{"anthropic": map[string]any{"baseUrl": provider.URL}, "deepseek": map[string]any{"baseUrl": provider.URL + "/v1"}}})
	if err := os.WriteFile(filepath.Join(home, ".pi/agent/models.json"), overrides, 0600); err != nil {
		t.Fatal(err)
	}
	cli, _ := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"))
	node, _ := exec.LookPath("node")
	for _, run := range []struct{ provider, model, want string }{
		{"anthropic", "claude-opus-5-5", "/v1/messages " + anthropic + " "},
		{"deepseek", "deepseek-v4-pro", "/v1/chat/completions  Bearer " + deepseek},
	} {
		cmd := exec.CommandContext(ctx, node, cli, "-p", "--no-session", "--provider", run.provider, "--model", run.model, "hello")
		cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home, "PI_OFFLINE=1"}
		cmd.Dir = home
		cmd.WaitDelay = time.Second
		_ = cmd.Run() // The synthetic provider refuses; the request is the evidence.
		select {
		case got := <-seen:
			if got != run.want {
				t.Fatalf("%s: Pi sent %q", run.provider, got)
			}
		case <-time.After(20 * time.Second):
			t.Fatalf("%s: Pi made no provider request", run.provider)
		}
	}

	// Removing the default's key falls back to another key; without one the
	// account returns to onboarding.
	if _, err = p.credentials(ctx, "remove", "deepseek", ""); err != nil {
		t.Fatal(err)
	}
	if models, err = p.catalog(ctx, ""); err != nil || *models.DefaultProvider != "anthropic" || *models.DefaultModel != "claude-opus-5-5" {
		t.Fatal("removal did not fall back to the remaining key")
	}
	if result, err = p.credentials(ctx, "remove", "anthropic", ""); err != nil || result.Anthropic.Present || result.DeepSeek.Present {
		t.Fatal("Anthropic key not removed")
	}
	if p.Status() != "missing" {
		t.Fatal("account without credentials did not return to onboarding")
	}
}

// Listing models must not resolve a stored key: Pi would run a `!command`.
func TestPiModelsDoNotResolveStoredKeys(t *testing.T) {
	p, home := piFixture(t)
	path := filepath.Join(home, ".pi/agent/auth.json")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	for _, provider := range piKeyProviders {
		marker := filepath.Join(home, "ran-"+provider)
		raw, _ := json.Marshal(map[string]any{provider: map[string]any{"type": "api_key", "key": "!touch " + marker}})
		if err := os.WriteFile(path, raw, 0600); err != nil {
			t.Fatal(err)
		}
		models, err := p.catalog(context.Background(), "")
		if err != nil || !slices.ContainsFunc(models.Models, func(m piModel) bool { return m.Provider == provider }) {
			t.Fatalf("%s: models of a present key not listed", provider)
		}
		if _, err := os.Stat(marker); !os.IsNotExist(err) {
			t.Fatalf("%s: model listing ran the stored key command", provider)
		}
	}
}

// Pi keeps a Claude Pro/Max sign-in under the same provider id as the key. A
// key change must not replace or delete it.
func TestPiCredentialsKeepsAnthropicSubscription(t *testing.T) {
	p, home := piFixture(t)
	ctx := context.Background()
	path := filepath.Join(home, ".pi/agent/auth.json")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	oauth := []byte(`{"anthropic":{"type":"oauth","access":"synthetic-access","refresh":"synthetic-refresh","expires":4102444800000}}`)
	if err := os.WriteFile(path, oauth, 0600); err != nil {
		t.Fatal(err)
	}
	if result, err := p.credentials(ctx, "read", "", ""); err != nil || result.Anthropic.Present {
		t.Fatal("subscription reported as an API key")
	}
	if _, err := p.credentials(ctx, "save", "anthropic", "sk-ant-api03-"+strings.Repeat("b", 40)); err == nil {
		t.Fatal("key replaced the Anthropic sign-in")
	}
	if _, err := p.credentials(ctx, "remove", "anthropic", ""); err == nil {
		t.Fatal("key removal deleted the Anthropic sign-in")
	}
	if raw, _ := os.ReadFile(path); string(raw) != string(oauth) {
		t.Fatal("Anthropic sign-in changed")
	}
	if _, err := p.credentials(ctx, "save", "deepseek", "sk-"+strings.Repeat("c", 32)); err != nil {
		t.Fatal("unrelated provider blocked by the Anthropic sign-in")
	}
	for _, provider := range []string{"", "google", "openai-codex", "claude-bridge"} {
		if _, err := p.credentials(ctx, "save", provider, "sk-"+strings.Repeat("d", 32)); err == nil {
			t.Fatalf("accepted provider %q", provider)
		}
	}
}

// The site AI key is seeded only where the person's Pi has no credential of
// any kind for that provider. A first seed sets the default for a person who
// has none; a seed beside another provider's credential leaves their default
// where it was, so the site's key never becomes what they use by accident.
func TestSeedSiteKeyWritesOnlyWhereAbsent(t *testing.T) {
	p, home := piFixture(t)
	ctx := context.Background()
	key := "sk-ant-api03-" + strings.Repeat("S", 40) + "seed"
	for _, bad := range []string{"!id", "$ANTHROPIC_API_KEY", "sk-short"} {
		if got := p.SeedSiteKey(ctx, "anthropic", bad); got != "failed" {
			t.Fatal("seeded a nonliteral key", got)
		}
	}
	if got := p.SeedSiteKey(ctx, "anthropic", key); got != "seeded" {
		t.Fatal(got)
	}
	models, err := p.catalog(ctx, "")
	if err != nil || models.DefaultProvider == nil || *models.DefaultProvider != "anthropic" || p.Status() != "usable" {
		t.Fatal("a first seed did not make Pi usable with the key's provider")
	}
	// A second seed, of another key, keeps the first.
	if got := p.SeedSiteKey(ctx, "anthropic", "sk-ant-api03-"+strings.Repeat("T", 40)); got != "already_present" {
		t.Fatal(got)
	}
	raw, _ := os.ReadFile(filepath.Join(home, ".pi/agent/auth.json"))
	if !strings.Contains(string(raw), key) {
		t.Fatal("seed replaced a present key")
	}
	// Beside the person's own default, a seed of another provider is written
	// but not made the default.
	settings := filepath.Join(home, ".pi/agent/settings.json")
	before, _ := os.ReadFile(settings)
	if got := p.SeedSiteKey(ctx, "deepseek", "sk-"+strings.Repeat("d", 32)); got != "seeded" {
		t.Fatal(got)
	}
	if after, _ := os.ReadFile(settings); string(after) != string(before) {
		t.Fatal("a seed moved the person's default")
	}

	// A Claude sign-in kept under the same id stays byte for byte.
	p2, home2 := piFixture(t)
	path := filepath.Join(home2, ".pi/agent/auth.json")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	oauth := []byte(`{"anthropic":{"type":"oauth","access":"synthetic-access","refresh":"synthetic-refresh","expires":4102444800000}}`)
	if err := os.WriteFile(path, oauth, 0600); err != nil {
		t.Fatal(err)
	}
	if got := p2.SeedSiteKey(ctx, "anthropic", key); got != "already_present" {
		t.Fatal(got)
	}
	if raw, _ := os.ReadFile(path); string(raw) != string(oauth) {
		t.Fatal("seed changed the Claude sign-in")
	}
}

// The decision is made under Pi's own file lock: a person's own key saved by
// a concurrent second login while the creating login's seed waits always
// stays. A check outside the lock would read the empty file and overwrite it.
func TestSeedSiteKeyKeepsAKeySavedUnderTheLock(t *testing.T) {
	p, home := piFixture(t)
	path := filepath.Join(home, ".pi/agent/auth.json")
	own := "sk-" + strings.Repeat("o", 30) + "mine"
	storage, _ := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "core", "auth-storage.js"))
	holder := `import { AuthStorage } from ` + strconvQuote(storage) + `;
import { createInterface } from 'node:readline';
const lines = createInterface({ input: process.stdin });
await AuthStorage.create(process.argv[1]).storage.withLockAsync(async () => {
  process.stdout.write('locked\n');
  for await (const _ of lines) break;
  return { result: undefined, next: JSON.stringify({ openai: { type: 'api_key', key: process.argv[2] } }) };
});
process.stdout.write('released\n');
`
	node, _ := exec.LookPath("node")
	cmd := exec.Command(node, "--input-type=module", "--eval", holder, path, own)
	cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home}
	in, _ := cmd.StdinPipe()
	out, _ := cmd.StdoutPipe()
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer cmd.Process.Kill()
	buf := make([]byte, 7)
	if _, err := io.ReadFull(out, buf); err != nil || string(buf) != "locked\n" {
		t.Fatal("holder did not take the lock", err, string(buf))
	}
	result := make(chan string, 1)
	go func() { result <- p.SeedSiteKey(context.Background(), "openai", "sk-"+strings.Repeat("s", 30)+"site") }()
	select {
	case got := <-result:
		t.Fatal("seed did not wait for the lock", got)
	case <-time.After(1500 * time.Millisecond):
	}
	_, _ = io.WriteString(in, "save\n")
	_ = in.Close()
	select {
	case got := <-result:
		if got != "already_present" {
			t.Fatal("seed answered", got)
		}
	case <-time.After(15 * time.Second):
		t.Fatal("seed never finished")
	}
	_ = cmd.Wait()
	raw, _ := os.ReadFile(path)
	var stored map[string]struct{ Type, Key string }
	if json.Unmarshal(raw, &stored) != nil || stored["openai"].Key != own {
		t.Fatalf("the person's own key was replaced: %s", raw)
	}
}

func strconvQuote(s string) string { b, _ := json.Marshal(s); return string(b) }
