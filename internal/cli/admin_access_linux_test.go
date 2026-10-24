//go:build linux

package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/gateway"
	"github.com/Open-Habitat/open-habitat/internal/provision"
)

// accessTestBroker keeps an admission list with the broker's rules and
// answers authorize from it.
type accessTestBroker struct {
	adminTestBroker
	mu       sync.Mutex
	operator map[string]bool
	runtime  map[string]string
	on       bool
	lose     bool
}

func (b *accessTestBroker) Exchange(context.Context, gateway.BrokerRequest) (gateway.BrokerReply, error) {
	return gateway.BrokerReply{}, nil
}
func (b *accessTestBroker) row(id string) []gateway.AccessRow {
	switch {
	case b.operator[id]:
		return []gateway.AccessRow{{ID: id, Source: "operator", State: "joined", Username: "alice"}}
	case b.runtime[id] == "withdrawn":
		return []gateway.AccessRow{{ID: id, Source: "site_admin", State: "withdrawn", Username: "bob", LoginHint: "bob", Actor: "root", At: "2026-10-24T09:30:00Z"}}
	case b.runtime[id] == "admitted" && id == "43":
		return []gateway.AccessRow{{ID: id, Source: "site_admin", State: "joined", Username: "bob", LoginHint: "bob", Actor: "root", At: "2026-10-24T09:30:00Z"}}
	case b.runtime[id] == "admitted":
		return []gateway.AccessRow{{ID: id, Source: "site_admin", State: "allowed", LoginHint: "carol", Actor: "root", At: "2026-10-24T09:30:00Z"}}
	}
	return []gateway.AccessRow{}
}
func (b *accessTestBroker) AccessList(context.Context) (gateway.AccessPage, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	p := gateway.AccessPage{Mode: "allowlist", RuntimeAdmission: b.on, Rows: []gateway.AccessRow{}}
	for _, id := range []string{"42", "43", "44"} {
		p.Rows = append(p.Rows, b.row(id)...)
	}
	return p, nil
}
func (b *accessTestBroker) AccessRead(_ context.Context, id string) (gateway.AccessPage, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return gateway.AccessPage{Mode: "allowlist", RuntimeAdmission: b.on, Rows: b.row(id)}, nil
}
func (b *accessTestBroker) Admit(_ context.Context, id, _, _ string) (gateway.AccessRow, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if !b.on {
		return gateway.AccessRow{}, gateway.ErrAccessDisabled
	}
	b.runtime[id] = "admitted"
	return b.row(id)[0], nil
}
func (b *accessTestBroker) Withdraw(_ context.Context, id, _ string) (gateway.AccessRow, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.operator[id] {
		return gateway.AccessRow{}, gateway.ErrOperatorOwned
	}
	if b.lose {
		b.lose = false
		return gateway.AccessRow{}, gateway.ErrAccessUncertain
	}
	if id == "43" {
		b.runtime[id] = "withdrawn"
		return b.row(id)[0], nil
	}
	delete(b.runtime, id)
	return gateway.AccessRow{ID: id, Source: "site_admin", State: "removed"}, nil
}
func (b *accessTestBroker) ListBound(context.Context) ([]gateway.BoundUser, error) {
	return []gateway.BoundUser{{ID: "42", Username: "alice"}, {ID: "43", Username: "bob"}}, nil
}

type accessTestDirectory struct{ gateway.GitHubProvider }

func (accessTestDirectory) LookupLogin(_ context.Context, login string) (gateway.GitHubUser, error) {
	if login == "acme" {
		return gateway.GitHubUser{}, gateway.ErrGitHubNotUser
	}
	if login != "carol" {
		return gateway.GitHubUser{}, gateway.ErrGitHubUserNotFound
	}
	return gateway.GitHubUser{ID: "44", Login: "carol", Name: "Carol", Type: "User"}, nil
}
func (accessTestDirectory) LookupID(_ context.Context, id string) (gateway.GitHubUser, error) {
	if id != "44" {
		return gateway.GitHubUser{}, gateway.ErrGitHubUserNotFound
	}
	return gateway.GitHubUser{ID: "44", Login: "carol", Type: "User"}, nil
}

func viaAccessGateway(t *testing.T) *accessTestBroker {
	t.Helper()
	return viaAccessGatewayState(t, filepath.Join(t.TempDir(), "administration.json"))
}

func viaAccessGatewayState(t *testing.T, state string) *accessTestBroker {
	t.Helper()
	b := &accessTestBroker{adminTestBroker: adminTestBroker{bound: true}, operator: map[string]bool{"42": true}, runtime: map[string]string{"43": "admitted"}, on: true}
	a, e := gateway.NewAuth(gateway.OAuthConfig{ClientID: "test", ClientSecret: "test", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, gateway.AuthOptions{Provider: accessTestDirectory{}, Sink: revokeTestSink{}, Broker: b, AdminFile: state})
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

func TestAdminAccessCommands(t *testing.T) {
	b := viaAccessGateway(t)
	code, out, stderr := call(t, "--json", "admin", "access", "list", "--state", "joined")
	if code != 0 || out["data"].(map[string]any)["count"] != float64(2) {
		t.Fatalf("list: %d %v %s", code, out, stderr)
	}
	code, out, _ = call(t, "--json", "admin", "access", "lookup", "--login", "carol")
	if code != 0 || out["data"].(map[string]any)["id"] != "44" {
		t.Fatalf("lookup: %d %v", code, out)
	}
	if code, _, stderr = call(t, "--json", "admin", "access", "lookup", "--login", "acme"); code != 1 || !strings.Contains(stderr, "github_not_user") {
		t.Fatalf("organisation: %d %s", code, stderr)
	}
	// site.json owns 42: a usage error naming it, never a gateway call.
	if code, _, stderr = call(t, "--json", "admin", "access", "remove", "--github-id", "42"); code != 1 || !strings.Contains(stderr, "invalid_arguments") || !strings.Contains(stderr, "site.json") {
		t.Fatalf("operator remove: %d %s", code, stderr)
	}
	code, out, _ = call(t, "--json", "admin", "access", "remove", "--github-id", "43", "--dry-run")
	effects := out["data"].(map[string]any)["would"].([]any)[0].(map[string]any)["known_effects"].(map[string]any)
	if code != 0 || !strings.Contains(effects["effect"].(string), "bob") || b.runtime["43"] != "admitted" {
		t.Fatalf("remove dry-run: %d %v", code, out)
	}
	if code, out, _ = call(t, "--json", "admin", "access", "remove", "--github-id", "43"); code != 0 || out["data"].(map[string]any)["entry"].(map[string]any)["state"] != "withdrawn" {
		t.Fatalf("remove: %d %v", code, out)
	}
	code, out, _ = call(t, "--json", "admin", "access", "add", "--github-id", "43", "--dry-run")
	effects = out["data"].(map[string]any)["would"].([]any)[0].(map[string]any)["known_effects"].(map[string]any)
	if code != 0 || effects["restore_to"] != "bob" || b.runtime["43"] != "withdrawn" {
		t.Fatalf("add dry-run: %d %v", code, out)
	}
	if code, out, _ = call(t, "--json", "admin", "access", "add", "--github-id", "43"); code != 0 || out["data"].(map[string]any)["entry"].(map[string]any)["state"] != "joined" {
		t.Fatalf("restore: %d %v", code, out)
	}
	b.lose = true
	if code, _, stderr = call(t, "--json", "admin", "access", "remove", "--github-id", "43"); code != 2 || !strings.Contains(stderr, "outcome_uncertain") {
		t.Fatalf("uncertain: %d %s", code, stderr)
	}
	b.on = false
	for _, extra := range [][]string{{"--dry-run"}, nil} {
		if code, _, stderr = call(t, append([]string{"--json", "admin", "access", "add", "--github-id", "44"}, extra...)...); code != 1 || !strings.Contains(stderr, "runtime_admission_disabled") {
			t.Fatalf("switch off %v: %d %s", extra, code, stderr)
		}
	}
	for _, args := range [][]string{
		{"admin", "access", "add", "--github-id", "0"},
		{"admin", "access", "add", "--login", "carol"},
		{"admin", "access", "remove", "--github-id", "43", "--dry-run", "--dry-run"},
		{"admin", "access", "list", "--state", "pending"},
	} {
		if code, _, _ = call(t, append([]string{"--json"}, args...)...); code != 1 {
			t.Fatalf("%v accepted: %d", args, code)
		}
	}
}

// The receipt of bob's first sign-in reaches root through users list and
// access list, and stays out of settings show, which decodes strictly.
func TestAdminReceiptReachesRoot(t *testing.T) {
	state := filepath.Join(t.TempDir(), "administration.json")
	receipt := `{"at":"2026-10-24T09:00:00Z","mode":"auto","defaults":[{"repository":"acme/team","outcome":"queued"},{"repository":"acme/infra","outcome":"no_access"}],"ai_key":"seeded"}`
	if e := os.WriteFile(state, []byte(`{"version":1,"name":"","administrators":[],"onboarding_receipts":{"43":`+receipt+`}}`), 0o600); e != nil {
		t.Fatal(e)
	}
	viaAccessGatewayState(t, state)
	code, out, stderr := call(t, "--json", "admin", "users", "list")
	if code != 0 {
		t.Fatal(code, stderr)
	}
	users := out["data"].(map[string]any)["users"].([]any)
	if users[0].(map[string]any)["onboarding"] != nil || users[1].(map[string]any)["onboarding"].(map[string]any)["defaults"].([]any)[1].(map[string]any)["outcome"] != "no_access" {
		t.Fatalf("users: %v", users)
	}
	code, out, stderr = call(t, "--json", "admin", "access", "list")
	if code != 0 {
		t.Fatal(code, stderr)
	}
	for _, e := range out["data"].(map[string]any)["entries"].([]any) {
		row := e.(map[string]any)
		if (row["onboarding"] != nil) != (row["id"] == "43") || row["id"] == "43" && row["onboarding"].(map[string]any)["ai_key"] != "seeded" {
			t.Fatalf("access: %v", row)
		}
	}
	if code, _, stderr = call(t, "--json", "admin", "settings", "show"); code != 0 {
		t.Fatal("settings show with a stored receipt:", code, stderr)
	}
}

// Every entry field of the browser/host contract decodes into the CLI's
// strict reader: a new gateway field would otherwise fail admin access list.
func TestAccessEntryDecodesContractExample(t *testing.T) {
	b, e := os.ReadFile("../../contracts/v1/examples/server-access.json")
	if e != nil {
		t.Fatal(e)
	}
	var v struct {
		Entries []json.RawMessage `json:"entries"`
	}
	if json.Unmarshal(b, &v) != nil || len(v.Entries) == 0 {
		t.Fatal("example")
	}
	for _, raw := range v.Entries {
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.DisallowUnknownFields()
		var entry controlAccessEntry
		if e := dec.Decode(&entry); e != nil {
			t.Fatalf("%s: %v", raw, e)
		}
	}
}

// Only the broker's fixed refusals are definite; a lost reply or
// state_unavailable after a possible commit is uncertain.
func TestAccessWriteClassification(t *testing.T) {
	for _, tc := range []struct {
		reply provision.Reply
		err   error
		want  error
	}{
		{provision.Reply{}, errors.New("eof"), gateway.ErrAccessUncertain},
		{provision.Reply{Version: 1, Failure: provision.StateUnavailable}, nil, gateway.ErrAccessUncertain},
		{provision.Reply{Version: 1, Failure: provision.RuntimeDisabled}, nil, gateway.ErrAccessDisabled},
		{provision.Reply{Version: 1, Failure: provision.RuntimeFull}, nil, gateway.ErrAccessFull},
		{provision.Reply{Version: 1, Failure: provision.OperatorOwned}, nil, gateway.ErrOperatorOwned},
		{provision.Reply{Version: 1, Failure: provision.Drift}, nil, gateway.ErrAccessDrift},
		{provision.Reply{Version: 1, Failure: provision.Denied}, nil, gateway.ErrAccessRefused},
	} {
		if _, err := accessWrite(tc.reply, tc.err); !errors.Is(err, tc.want) {
			t.Errorf("%+v: %v", tc.reply, err)
		}
	}
	page := func(epoch uint64, next string, ids ...string) provision.Reply {
		rows := []provision.AccessRow{}
		for _, id := range ids {
			rows = append(rows, provision.AccessRow{ID: id, Source: "operator", State: "allowed"})
		}
		return provision.Reply{Version: 1, Access: &provision.AccessPage{Mode: "allowlist", RuntimeAdmission: true, Rows: rows}, Generation: 1, Epoch: epoch, Next: next}
	}
	replies := []provision.Reply{page(5, "1", "42"), page(6, "", "43")}
	_, err := collectAccessPages(context.Background(), func(context.Context, provision.Request) (provision.Reply, error) {
		r := replies[0]
		replies = replies[1:]
		return r, nil
	})
	if err == nil {
		t.Fatal("list spanning two epochs accepted")
	}
}
