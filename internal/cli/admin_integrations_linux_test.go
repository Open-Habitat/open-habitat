//go:build linux

package cli

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/gateway"
	"github.com/Open-Habitat/open-habitat/internal/provision"
)

const cliGoogleID = "704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com"

// integrationTestBroker answers with broker replies, so the gateway adapter's
// classification is exercised too.
type integrationTestBroker struct {
	*accessTestBroker
	apps    []provision.IntegrationApp
	setup   bool
	failure provision.Failure
	lose    bool
	relayed []provision.Request
}

func (b *integrationTestBroker) reply() provision.Reply {
	return provision.Reply{Version: 1, Integrations: &provision.IntegrationPage{BrowserSetup: b.setup, Apps: append([]provision.IntegrationApp{}, b.apps...)}}
}
func (b *integrationTestBroker) IntegrationList(context.Context) (gateway.IntegrationApps, error) {
	return integrationApps(*b.reply().Integrations), nil
}
func (b *integrationTestBroker) write(r provision.Request) (gateway.IntegrationApps, error) {
	b.relayed = append(b.relayed, r)
	if b.failure != "" {
		return integrationWrite(provision.Reply{Version: 1, Failure: b.failure}, nil)
	}
	kept := []provision.IntegrationApp{}
	for _, a := range b.apps {
		if a.Provider != r.Provider {
			kept = append(kept, a)
		}
	}
	if r.Fields != nil {
		kept = append(kept, provision.IntegrationApp{Provider: r.Provider, ClientID: r.Fields["client_id"], TenantID: r.Fields["tenant_id"], Usable: true, Source: provision.AppSourceSiteAdmin, Actor: r.Actor, At: "2026-10-24T12:00:00Z"})
	}
	b.apps = kept
	if b.lose {
		return integrationWrite(provision.Reply{}, errors.New("eof"))
	}
	return integrationWrite(b.reply(), nil)
}
func (b *integrationTestBroker) SetIntegrationApp(_ context.Context, provider string, fields map[string]string, actor string) (gateway.IntegrationApps, error) {
	return b.write(provision.Request{Operation: provision.OpIntegrationSet, Provider: provider, Fields: fields, Actor: actor})
}
func (b *integrationTestBroker) ClearIntegrationApp(_ context.Context, provider, actor string) (gateway.IntegrationApps, error) {
	return b.write(provision.Request{Operation: provision.OpIntegrationClear, Provider: provider, Actor: actor})
}

func viaIntegrationGateway(t *testing.T) *integrationTestBroker {
	t.Helper()
	access := &accessTestBroker{adminTestBroker: adminTestBroker{bound: true}, operator: map[string]bool{"42": true}, runtime: map[string]string{}, on: true}
	b := &integrationTestBroker{accessTestBroker: access, setup: true, apps: []provision.IntegrationApp{{Provider: "dropbox", ClientID: "p3n8vq1zt6ka0rw", Usable: true, Source: provision.AppSourceOperator}}}
	a, e := gateway.NewAuth(gateway.OAuthConfig{ClientID: "test", ClientSecret: "test", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, gateway.AuthOptions{Provider: accessTestDirectory{}, Sink: revokeTestSink{}, Broker: b, AdminFile: filepath.Join(t.TempDir(), "administration.json")})
	if e != nil {
		t.Fatal(e)
	}
	adminRoundTrip = func(payload []byte) ([]byte, error) {
		out, e := a.AdminControl(context.Background(), payload)
		if e != nil {
			return []byte("ERROR " + gateway.AdminControlError(e) + "\n"), nil
		}
		return append(out, '\n'), nil
	}
	t.Cleanup(func() { adminRoundTrip = socketRoundTrip })
	return b
}

func withStdin(t *testing.T, text string) {
	t.Helper()
	f, err := os.CreateTemp(t.TempDir(), "stdin")
	if err != nil {
		t.Fatal(err)
	}
	f.WriteString(text)
	f.Seek(0, 0)
	old := os.Stdin
	os.Stdin = f
	t.Cleanup(func() { os.Stdin = old; f.Close() })
}

func TestAdminIntegrationsCommands(t *testing.T) {
	b := viaIntegrationGateway(t)
	code, out, stderr := call(t, "--json", "admin", "integrations", "list")
	if code != 0 || out["data"].(map[string]any)["count"] != float64(1) {
		t.Fatalf("list: %d %v %s", code, out, stderr)
	}
	// The secret comes from stdin; argv never carries it and nothing echoes it.
	withStdin(t, "GOCSPX-cli-sentinel\n")
	code, out, stderr = call(t, "--json", "admin", "integrations", "set", "--provider", "google", "--client-id", cliGoogleID, "--client-secret-file", "-", "--dry-run")
	would := out["data"].(map[string]any)["would"].([]any)[0].(map[string]any)
	if code != 0 || len(b.relayed) != 0 || !strings.HasPrefix(would["known_effects"].(map[string]any)["effect"].(string), "set") || strings.Contains(stderr+toJSON(out), "sentinel") {
		t.Fatalf("dry run: %d %v %s", code, out, stderr)
	}
	withStdin(t, "GOCSPX-cli-sentinel\n")
	code, out, stderr = call(t, "--json", "admin", "integrations", "set", "--provider", "google", "--client-id", cliGoogleID, "--client-secret-file", "-")
	app := out["data"].(map[string]any)["app"].(map[string]any)
	if code != 0 || app["actor"] != "root" || len(b.relayed) != 1 || b.relayed[0].Fields["client_secret"] != "GOCSPX-cli-sentinel" || strings.Contains(stderr+toJSON(out), "sentinel") {
		t.Fatalf("set: %d %v %s", code, out, stderr)
	}
	code, out, _ = call(t, "--json", "admin", "integrations", "set", "--provider", "microsoft", "--client-id", "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3", "--tenant-id", "organizations")
	if code != 0 || out["data"].(map[string]any)["app"].(map[string]any)["tenant_id"] != "organizations" {
		t.Fatalf("microsoft: %d %v", code, out)
	}
	if code, out, _ = call(t, "--json", "admin", "integrations", "clear", "--provider", "dropbox", "--dry-run"); code != 0 || len(b.relayed) != 2 {
		t.Fatalf("clear dry run: %d %v", code, out)
	}
	if code, out, _ = call(t, "--json", "admin", "integrations", "clear", "--provider", "dropbox"); code != 0 || out["data"].(map[string]any)["app"] != nil {
		t.Fatalf("clear: %d %v", code, out)
	}
	for failure, want := range map[provision.Failure]string{provision.BrowserSetupOff: "browser_setup_disabled", provision.HostBusy: "host_busy", provision.IntegrationsFile: "integrations_file_invalid", provision.Invalid: "integration_refused"} {
		b.failure = failure
		if code, _, stderr = call(t, "--json", "admin", "integrations", "clear", "--provider", "google"); code != 1 || !strings.Contains(stderr, want) {
			t.Fatalf("%s: %d %s", failure, code, stderr)
		}
	}
	b.failure = provision.StateUnavailable
	if code, _, stderr = call(t, "--json", "admin", "integrations", "clear", "--provider", "google"); code != 2 || !strings.Contains(stderr, "outcome_uncertain") {
		t.Fatalf("state unavailable: %d %s", code, stderr)
	}
	b.failure, b.lose = "", true
	if code, _, stderr = call(t, "--json", "admin", "integrations", "clear", "--provider", "google"); code != 2 || !strings.Contains(stderr, "outcome_uncertain") {
		t.Fatalf("lost reply: %d %s", code, stderr)
	}
	b.lose, b.setup = false, false
	relayed := len(b.relayed)
	if code, _, stderr = call(t, "--json", "admin", "integrations", "clear", "--provider", "google", "--dry-run"); code != 1 || !strings.Contains(stderr, "browser_setup_disabled") || len(b.relayed) != relayed {
		t.Fatalf("dry run with the switch off: %d %s", code, stderr)
	}
	withStdin(t, "same\n")
	for _, args := range [][]string{
		{"admin", "integrations", "set", "--provider", "google", "--client-id", "abc", "--client-secret-file", "-"},
		{"admin", "integrations", "set", "--provider", "dropbox", "--client-id", "same", "--client-secret-file", "-"},
		{"admin", "integrations", "set", "--provider", "google", "--client-id", cliGoogleID, "--client-secret", "x"},
		{"admin", "integrations", "set", "--provider", "microsoft", "--client-id", "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3", "--client-secret-file", "-"},
		{"admin", "integrations", "set", "--provider", "imap", "--client-id", "x"},
		{"admin", "integrations", "clear", "--provider", "google", "--client-id", cliGoogleID},
		{"admin", "integrations", "list", "--provider", "google"},
	} {
		// A refused value is never echoed: it may be a secret.
		if code, _, stderr = call(t, append([]string{"--json"}, args...)...); code != 1 || strings.Contains(stderr, `"same"`) {
			t.Fatalf("%v: %d %s", args, code, stderr)
		}
	}
	if len(b.relayed) != relayed {
		t.Fatal("an invalid command reached the broker")
	}
}

func toJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
