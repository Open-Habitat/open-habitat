//go:build linux

package cli

import (
	"context"
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/gateway"
)

type adminTestBroker struct{ bound bool }

func (b adminTestBroker) Exchange(context.Context, gateway.BrokerRequest) (gateway.BrokerReply, error) {
	return gateway.BrokerReply{}, nil
}
func (b adminTestBroker) LookupBound(_ context.Context, id string) (bool, error) {
	return b.bound && id == "42", nil
}
func (b adminTestBroker) ReadQuota(_ context.Context, _ string) (gateway.Quota, gateway.QuotaFilesystem, error) {
	return gateway.Quota{UsageBytes: 2048, LimitBytes: 1073741824}, gateway.QuotaFilesystem{CapacityBytes: 1073741824, FreeBytes: 1024}, nil
}
func (b adminTestBroker) SetQuota(_ context.Context, _ string, _ uint64) error { return nil }
func (b adminTestBroker) ListBound(context.Context) ([]gateway.BoundUser, error) {
	if !b.bound {
		return []gateway.BoundUser{}, nil
	}
	return []gateway.BoundUser{{ID: "42", Username: "alice"}}, nil
}

func TestAdminOperatorAndGatewaySingleWriter(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("root peer credentials required for socket integration")
	}
	state := filepath.Join(t.TempDir(), "administration.json")
	a, e := gateway.NewAuth(gateway.OAuthConfig{ClientID: "test", ClientSecret: "test", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, gateway.AuthOptions{Provider: gateway.GitHubProvider{}, Sink: revokeTestSink{}, Broker: adminTestBroker{bound: true}, AdminFile: state})
	if e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(t.TempDir(), "control.sock")
	ln, e := net.Listen("unix", path)
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go serveRevocations(ctx, ln, a)
	adminControlSocket = path
	defer func() { adminControlSocket = revokeSocket }()
	commands := [][]string{
		{"admin", "settings", "show"},
		{"admin", "settings", "update", "--default-limit-bytes", "1073741824"},
		{"admin", "settings", "show"},
		{"admin", "storage", "list"},
		{"admin", "storage", "update", "42", "--limit-bytes", "1024", "--dry-run"},
		{"admin", "storage", "update", "42", "--limit-bytes", "1024"},
		{"admin", "users", "list"},
		{"admin", "role", "update", "42", "--administrator", "true", "--dry-run"},
		{"admin", "role", "update", "42", "--administrator", "true"},
		{"admin", "settings", "update", "--name", "Test host"},
		{"admin", "settings", "show"},
		{"admin", "role", "update", "42", "--administrator", "false"},
		{"admin", "settings", "update", "--name", "", "--dry-run"},
	}
	for _, cmd := range commands {
		code, out, stderr := call(t, append([]string{"--json"}, cmd...)...)
		if code != 0 {
			t.Fatalf("%v: exit %d: %s", cmd, code, stderr)
		}
		if cmd[1] == "settings" && cmd[2] == "show" && len(cmd) == 3 && out == nil {
			t.Fatal("missing settings")
		}
	}
	var s struct {
		Version           int      `json:"version"`
		Name              string   `json:"name"`
		Administrators    []string `json:"administrators"`
		DefaultLimitBytes uint64   `json:"default_limit_bytes"`
	}
	b, e := os.ReadFile(state)
	if e != nil || json.Unmarshal(b, &s) != nil || s.Name != "Test host" || len(s.Administrators) != 0 || s.DefaultLimitBytes != 1073741824 {
		t.Fatalf("gateway state %s: %v", b, e)
	}
	if code, _, err := call(t, "--json", "admin", "role", "update", "43", "--administrator", "true"); code != 1 || !strings.Contains(err, "not_found") {
		t.Fatalf("unbound target: %d %s", code, err)
	}
	if code, _, err := call(t, "--json", "admin", "role", "update", "43", "--administrator", "false"); code != 0 {
		t.Fatalf("removal must work without binding: %d %s", code, err)
	}
	// A CLI write must be immediately visible through the same gateway writer.
	var reply map[string]any
	b, e = a.AdminControl(context.Background(), []byte(`{"operation":"show"}`))
	if e != nil || json.Unmarshal(b, &reply) != nil || reply["name"] != "Test host" {
		t.Fatalf("control read: %s %v", b, e)
	}
}

func TestAdminUnprivilegedDenied(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires a nonroot caller")
	}
	for _, args := range [][]string{{"admin", "settings", "show"}, {"admin", "users", "list"}, {"admin", "role", "update", "42", "--administrator", "true", "--dry-run"}} {
		code, _, stderr := call(t, append([]string{"--json"}, args...)...)
		if code != 2 || !strings.Contains(stderr, "permission_denied") {
			t.Fatalf("%v: %d %s", args, code, stderr)
		}
	}
}

func TestAdminArgumentValidation(t *testing.T) {
	for _, cmd := range [][]string{
		{"admin", "settings", "update", "--name", " a"},
		{"admin", "settings", "update", "--name", "--dry-run"},
		{"admin", "settings", "update", "--name", "x", "--unexpected"},
		{"admin", "role", "update", "00", "--administrator", "true"},
		{"admin", "role", "update", "42", "--administrator", "yes"},
		{"admin", "role", "update", "42", "--administrator", "false", "--unexpected"},
	} {
		code, _, err := call(t, append([]string{"--json"}, cmd...)...)
		if code != 1 || !strings.Contains(err, "invalid_arguments") {
			t.Fatalf("%v: %d %s", cmd, code, err)
		}
	}
}
