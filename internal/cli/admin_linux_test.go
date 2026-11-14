//go:build linux

package cli

import (
	"context"
	"encoding/json"
	"github.com/open-habitat/open-habitat/internal/provision"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/gateway"
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
		{"admin", "storage", "update", "42", "--limit-bytes", "1048576", "--dry-run"},
		{"admin", "storage", "update", "42", "--limit-bytes", "1048576"},
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

func TestAdminSettingsShowsSavedDefaultLanguage(t *testing.T) {
	for _, language := range []string{"", "system", "fi", "en", "en-US", "en-GB"} {
		t.Run("language="+language, func(t *testing.T) {
			state := filepath.Join(t.TempDir(), "administration.json")
			// The browser administration writer persists this optional field.
			settings := map[string]any{"version": 1, "name": "", "administrators": []string{}}
			if language != "" {
				settings["default_language"] = language
			}
			before, err := json.Marshal(settings)
			if err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(state, before, 0o600); err != nil {
				t.Fatal(err)
			}
			viaAccessGatewayState(t, state)
			code, out, stderr := call(t, "--json", "admin", "settings", "show")
			if code != 0 {
				t.Fatalf("settings show: exit %d: %s", code, stderr)
			}
			got, present := out["data"].(map[string]any)["default_language"]
			if language == "" && present || language != "" && got != language {
				t.Fatalf("default_language = %v (present %v), want %q", got, present, language)
			}
			after, err := os.ReadFile(state)
			if err != nil || string(after) != string(before) {
				t.Fatalf("settings read changed saved state: %s, %v", after, err)
			}
		})
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

func (b adminTestBroker) ListQuotas(ctx context.Context) ([]gateway.QuotaRow, gateway.QuotaFilesystem, error) {
	users, err := b.ListBound(ctx)
	if err != nil {
		return nil, gateway.QuotaFilesystem{}, err
	}
	rows := make([]gateway.QuotaRow, 0, len(users))
	var fs gateway.QuotaFilesystem
	for _, u := range users {
		q, disk, err := b.ReadQuota(ctx, u.ID)
		if err != nil {
			return nil, fs, err
		}
		fs = disk
		rows = append(rows, gateway.QuotaRow{BoundUser: u, Quota: q})
	}
	return rows, fs, nil
}

func TestCollectQuotaPagesRejectsMixedStateAndLoops(t *testing.T) {
	for _, change := range []string{"generation", "epoch", "duplicate", "offset", "capacity", "healthy"} {
		t.Run(change, func(t *testing.T) {
			calls := 0
			rows, _, err := collectQuotaPages(context.Background(), func(_ context.Context, request provision.Request) (provision.Reply, error) {
				calls++
				if request.Operation != "quota_list" || request.ID != "0" || (calls == 2 && request.Candidate != "1") {
					t.Fatalf("wrong request: %+v", request)
				}
				r := provision.Reply{Version: 1, Generation: 7, Epoch: 4, Quotas: &provision.QuotaPage{Rows: []provision.QuotaRow{{BoundUser: provision.BoundUser{ID: strconv.Itoa(calls), Username: "alice"}, LimitBytes: 1 << 30}}, CapacityBytes: 2 << 30}}
				if calls == 1 {
					r.Next = "1"
				} else {
					switch change {
					case "generation":
						r.Generation++
					case "epoch":
						r.Epoch++
					case "duplicate":
						r.Quotas.Rows[0].ID = "1"
					case "offset":
						r.Next = "1"
					case "capacity":
						r.Quotas.CapacityBytes++
					}
				}
				return r, nil
			})
			if change == "healthy" {
				if err != nil || len(rows) != 2 {
					t.Fatal(rows, err)
				}
			} else if err == nil {
				t.Fatal("accepted inconsistent/looping quota pages")
			}
		})
	}
}

func TestCollectQuotaPagesCancelsInFlightPage(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	calls := 0
	rows, _, err := collectQuotaPages(ctx, func(ctx context.Context, _ provision.Request) (provision.Reply, error) {
		calls++
		if calls == 1 {
			return provision.Reply{Version: 1, Generation: 1, Epoch: 1, Next: "1", Quotas: &provision.QuotaPage{Rows: []provision.QuotaRow{{BoundUser: provision.BoundUser{ID: "42", Username: "alice"}, LimitBytes: 1 << 30}}, CapacityBytes: 2 << 30}}, nil
		}
		<-ctx.Done()
		return provision.Reply{}, ctx.Err()
	})
	if err == nil || rows != nil || calls != 2 || ctx.Err() == nil {
		t.Fatalf("collector survived cancellation: %v %v %d", rows, err, calls)
	}
}
