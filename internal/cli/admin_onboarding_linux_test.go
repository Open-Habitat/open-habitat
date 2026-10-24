//go:build linux

package cli

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/gateway"
)

// viaGateway routes admin commands to a real gateway's control handler, as
// the root socket listener does, without needing root peer credentials.
func viaGateway(t *testing.T) *gateway.Auth {
	t.Helper()
	state := filepath.Join(t.TempDir(), "administration.json")
	a, e := gateway.NewAuth(gateway.OAuthConfig{ClientID: "test", ClientSecret: "test", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, gateway.AuthOptions{Provider: gateway.GitHubProvider{}, Sink: revokeTestSink{}, Broker: adminTestBroker{bound: true}, AdminFile: state})
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
	return a
}

func writeDoc(t *testing.T, body string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "onboarding.json")
	if e := os.WriteFile(p, []byte(body), 0600); e != nil {
		t.Fatal(e)
	}
	return p
}

const cliOnboarding = `{"repositories":{"mode":"skip","defaults":["example-org/product"]},"integrations":[{"provider":"microsoft","required":true}],"ai_account":{"offer":"anthropic_key"}}`

func TestAdminOnboardingShowUpdateAndDryRun(t *testing.T) {
	viaGateway(t)
	code, out, stderr := call(t, "--json", "admin", "onboarding", "show")
	if code != 0 {
		t.Fatalf("show: %d %s", code, stderr)
	}
	data := out["data"].(map[string]any)
	if data["version"] != float64(0) || data["ai_account"].(map[string]any)["offer"] != "all" {
		t.Fatalf("default: %v", data)
	}
	file := writeDoc(t, cliOnboarding)
	// A dry run validates against the gateway and writes nothing.
	code, out, stderr = call(t, "--json", "admin", "onboarding", "update", "--file", file, "--expected-version", "0", "--dry-run")
	if code != 0 {
		t.Fatalf("dry-run: %d %s", code, stderr)
	}
	would := out["data"].(map[string]any)["would"].([]any)[0].(map[string]any)
	effects := would["known_effects"].(map[string]any)
	if out["data"].(map[string]any)["dry_run"] != true || effects["next"].(map[string]any)["version"] != float64(1) || len(effects["changed"].([]any)) != 4 {
		t.Fatalf("dry-run plan: %v", out)
	}
	if _, out, _ = call(t, "--json", "admin", "onboarding", "show"); out["data"].(map[string]any)["version"] != float64(0) {
		t.Fatalf("dry-run wrote: %v", out)
	}
	// A dry run of a rejected document is rejected the same way as the write.
	bad := writeDoc(t, strings.Replace(cliOnboarding, "microsoft", "slack", 1))
	if code, _, stderr = call(t, "--json", "admin", "onboarding", "update", "--file", bad, "--expected-version", "0", "--dry-run"); code != 1 || !strings.Contains(stderr, "unknown_provider") {
		t.Fatalf("dry-run rejection: %d %s", code, stderr)
	}
	if code, out, stderr = call(t, "--json", "admin", "onboarding", "update", "--file", file, "--expected-version", "0"); code != 0 || out["data"].(map[string]any)["onboarding"].(map[string]any)["version"] != float64(1) {
		t.Fatalf("update: %d %v %s", code, out, stderr)
	}
	// The same version again is now stale, in a dry run and a write.
	for _, extra := range [][]string{{"--dry-run"}, nil} {
		args := append([]string{"--json", "admin", "onboarding", "update", "--file", file, "--expected-version", "0"}, extra...)
		if code, _, stderr = call(t, args...); code != 1 || !strings.Contains(stderr, "version_conflict") {
			t.Fatalf("stale %v: %d %s", extra, code, stderr)
		}
	}
	// show output can be edited and written back: its version must match.
	_, out, _ = call(t, "--json", "admin", "onboarding", "show")
	shown, _ := json.Marshal(out)
	edited := writeDoc(t, strings.Replace(string(shown), `"skip"`, `"auto"`, 1))
	if code, _, stderr = call(t, "--json", "admin", "onboarding", "update", "--file", edited, "--expected-version", "2"); code != 1 || !strings.Contains(stderr, "invalid_arguments") {
		t.Fatalf("mismatched version field: %d %s", code, stderr)
	}
	if code, out, stderr = call(t, "--json", "admin", "onboarding", "update", "--file", edited, "--expected-version", "1"); code != 0 || out["data"].(map[string]any)["onboarding"].(map[string]any)["repositories"].(map[string]any)["mode"] != "auto" {
		t.Fatalf("edited show output: %d %v %s", code, out, stderr)
	}
}

// The CLI reports the gateway's rejection reasons, the same codes the browser receives.
func TestAdminOnboardingRejections(t *testing.T) {
	a := viaGateway(t)
	long := make([]string, 21)
	for i := range long {
		long[i] = `"example-org/r` + strings.Repeat("x", i+1) + `"`
	}
	for reason, body := range map[string]string{
		"invalid_repository_name": strings.Replace(cliOnboarding, "example-org/product", "example-org/a b", 1),
		"too_many_defaults":       strings.Replace(cliOnboarding, `"example-org/product"`, strings.Join(long, ","), 1),
		"unknown_provider":        strings.Replace(cliOnboarding, "microsoft", "teams", 1),
		"site_key_unavailable":    strings.Replace(cliOnboarding, "anthropic_key", "site_key", 1),
		"invalid_document":        `{"repositories":{"mode":"skip","defaults":[]}}`,
	} {
		code, _, stderr := call(t, "--json", "admin", "onboarding", "update", "--file", writeDoc(t, body), "--expected-version", "0")
		if code != 1 || !strings.Contains(stderr, `"code":"`+reason+`"`) {
			t.Errorf("%s: %d %s", reason, code, stderr)
		}
	}
	if b, _ := a.AdminControl(context.Background(), []byte(`{"operation":"onboarding_show"}`)); !strings.Contains(string(b), `"version":0`) {
		t.Fatalf("a rejected update wrote: %s", b)
	}
}

func TestAdminOnboardingArgumentValidation(t *testing.T) {
	viaGateway(t)
	file := writeDoc(t, cliOnboarding)
	for _, cmd := range [][]string{
		{"admin", "onboarding"},
		{"admin", "onboarding", "show", "--dry-run"},
		{"admin", "onboarding", "update", "--file", file},
		{"admin", "onboarding", "update", "--expected-version", "0"},
		{"admin", "onboarding", "update", "--file", file, "--expected-version", "-1"},
		{"admin", "onboarding", "update", "--file", file, "--expected-version", "01"},
		{"admin", "onboarding", "update", "--file", file, "--expected-version", "x"},
		{"admin", "onboarding", "update", "--file", "--dry-run", "--expected-version", "0"},
		{"admin", "onboarding", "update", "--file", file, "--file", file, "--expected-version", "0"},
		{"admin", "onboarding", "update", "--file", file, "--expected-version", "0", "--force"},
		{"admin", "onboarding", "update", "--file", filepath.Join(t.TempDir(), "missing.json"), "--expected-version", "0"},
		{"admin", "onboarding", "update", "--file", t.TempDir(), "--expected-version", "0"},
		{"admin", "onboarding", "update", "--file", writeDoc(t, strings.Repeat(" ", 7681)+"{}"), "--expected-version", "0"},
	} {
		code, _, err := call(t, append([]string{"--json"}, cmd...)...)
		if code != 1 || !strings.Contains(err, "invalid_arguments") {
			t.Errorf("%v: %d %s", cmd, code, err)
		}
	}
}

func TestAdminOnboardingHelp(t *testing.T) {
	code, out, _ := call(t, "--json", "admin", "onboarding", "update", "--help")
	if code != 0 {
		t.Fatal(code)
	}
	flags, _ := json.Marshal(out["data"].(map[string]any)["flags"])
	for _, f := range []string{"--file", "--expected-version", "--dry-run"} {
		if !strings.Contains(string(flags), f) {
			t.Fatalf("help lacks %s: %s", f, flags)
		}
	}
}
