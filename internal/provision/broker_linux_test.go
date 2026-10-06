//go:build linux

package provision

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"

	"github.com/maintainer/native-agent-host/internal/diagnostic"
)

func TestBrokerListAndLookupAreNotLoggedAsFailures(t *testing.T) {
	w, _ := writerFixture(t)
	var b bytes.Buffer
	logged := loggedBrokerHandler(w.Handle, diagnostic.New(&b, "broker"))
	for _, tc := range []struct {
		op, id, candidate string
		wantUsers         int
	}{
		{"list", "0", "", 0},
		{"ensure", "42", "carol", -1},
		{"list", "0", "", 1},
		{"lookup", "42", "", 1},
	} {
		reply := logged(context.Background(), request(tc.op, tc.id, tc.candidate))
		if tc.wantUsers >= 0 && (reply.Users == nil || len(*reply.Users) != tc.wantUsers) || reply.Failure != "" {
			t.Fatalf("%s: %+v", tc.op, reply)
		}
	}
	var records []map[string]any
	for _, line := range bytes.Split(bytes.TrimSpace(b.Bytes()), []byte{'\n'}) {
		var record map[string]any
		if err := json.Unmarshal(line, &record); err != nil {
			t.Fatal(err)
		}
		records = append(records, record)
	}
	if len(records) != 4 {
		t.Fatalf("events: %s", b.String())
	}
	for _, i := range []int{0, 2, 3} {
		if records[i]["outcome"] != "accepted" || records[i]["user"] != nil || records[i]["reason"] != nil || records[i]["level"] != "INFO" {
			t.Fatalf("false list/lookup rejection: %v", records[i])
		}
	}
	if records[1]["user"] != "carol" {
		t.Fatalf("ensure lost verified user: %v", records[1])
	}
}

func TestBrokerExchangeDiagnosticVerifiedIdentityAndFailedSink(t *testing.T) {
	var b bytes.Buffer
	var calls int
	handle := func(_ context.Context, r Request) Reply {
		calls++
		if r.ID == "42" {
			return Reply{Version: 1, Route: &Route{Username: "mapped-user"}}
		}
		return failure(Denied)
	}
	logged := loggedBrokerHandler(handle, diagnostic.New(&b, "broker"))
	for _, id := range []string{"42", "43"} {
		logged(context.Background(), Request{Operation: "ensure", ID: id, Candidate: "synthetic-secret-content"})
	}
	if calls != 2 || strings.Contains(b.String(), "synthetic-secret-content") || strings.Contains(b.String(), `"user":"43"`) {
		t.Fatalf("unsafe broker record: %s", b.String())
	}
	for i, line := range bytes.Split(bytes.TrimSpace(b.Bytes()), []byte{'\n'}) {
		var record map[string]any
		if err := json.Unmarshal(line, &record); err != nil {
			t.Fatal(err)
		}
		if i == 0 && (record["user"] != "mapped-user" || record["outcome"] != "accepted") || i == 1 && (record["user"] != nil || record["reason"] != "denied") {
			t.Fatalf("incorrect attribution: %v", record)
		}
	}
	failed := loggedBrokerHandler(handle, diagnostic.New(failedDiagnosticWriter{}, "broker"))
	if reply := failed(context.Background(), Request{Operation: "ensure", ID: "43"}); reply.Failure != Denied || calls != 3 {
		t.Fatalf("diagnostic error changed admission: %+v", reply)
	}
}

type failedDiagnosticWriter struct{}

func (failedDiagnosticWriter) Write([]byte) (int, error) {
	return 0, errors.New("synthetic-secret-content")
}

type startupExecutor struct {
	fail  bool
	calls int
}

func (e *startupExecutor) Available(context.Context, string, uint32) (bool, error) {
	panic("startup must not allocate")
}
func (e *startupExecutor) Step(context.Context, string, ExecutorIdentity) error {
	panic("startup must not mutate")
}
func (e *startupExecutor) Ready(context.Context, ExecutorIdentity) error      { return nil }
func (e *startupExecutor) RouteReady(context.Context, ExecutorIdentity) error { return nil }
func (e *startupExecutor) Verify(ctx context.Context, _ ExecutorIdentity) error {
	e.calls++
	if e.fail || ctx.Err() != nil {
		return ErrInvalid
	}
	return nil
}

func TestBrokerAdmissionConfig(t *testing.T) {
	base := `{"version":1,"gateway_uid":21003,"gateway_gid":21003,"uid_min":21032,"uid_max":21047,"state_dir":"/var/lib/native-agent-host/broker"`
	for _, tc := range []struct {
		name, raw, want string
	}{
		{"legacy", base + `}`, ""},
		{"explicit allowlist", base + `,"admission":"allowlist"}`, "allowlist"},
		{"any", base + `,"admission":"any"}`, "any"},
		{"unknown", base + `,"admission":"other"}`, "invalid"},
		{"duplicate", base + `,"admission":"any","admission":"allowlist"}`, "invalid"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := parseBrokerConfig([]byte(tc.raw))
			if tc.want == "invalid" {
				if err != ErrBrokerStartup {
					t.Fatalf("expected startup refusal: %v", err)
				}
			} else if err != nil || cfg.Admission != tc.want {
				t.Fatalf("admission=%q err=%v", cfg.Admission, err)
			}
		})
	}
}

func TestBrokerStartupDenials(t *testing.T) {
	dir := fixture(t)
	// Own the synthetic directory and files as this test process; no host state.
	owner := uint32(os.Getuid())
	for name, data := range map[string]string{
		"allowlist.json": `{"version":1,"epoch":2,"ids":[{"id":"123"}]}`,
		"bindings.json":  `{"version":1,"generation":1,"bindings":[{"id":"123","uid":22001,"username":"testuser"}]}`,
		"head.json":      `{"version":1,"epoch":2,"generation":1}`,
	} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(data), 0600); err != nil {
			t.Fatal(err)
		}
	}
	e := &startupExecutor{}
	w := NewWriter(dir, 22000, 22002, e)
	w.owner = owner
	if err := w.Startup(context.Background()); err != nil || e.calls != 1 {
		t.Fatalf("valid state: %v, calls %d", err, e.calls)
	}
	e.fail = true
	if w.Startup(context.Background()) == nil {
		t.Fatal("accepted drift on restart")
	}
	e.fail = false
	if err := os.Symlink("/dev/null", filepath.Join(dir, "pending.json")); err != nil {
		t.Fatal(err)
	}
	if w.Startup(context.Background()) == nil {
		t.Fatal("accepted pending symlink")
	}
	os.Remove(filepath.Join(dir, "pending.json"))
	if err := os.Remove(filepath.Join(dir, "head.json")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("/dev/null", filepath.Join(dir, "head.json")); err != nil {
		t.Fatal(err)
	}
	if w.Startup(context.Background()) == nil {
		t.Fatal("accepted head symlink")
	}
	os.Remove(filepath.Join(dir, "head.json"))
	if err := os.WriteFile(filepath.Join(dir, "head.json"), []byte(`{"version":1,"epoch":3,"generation":1}`), 0600); err != nil {
		t.Fatal(err)
	}
	if w.Startup(context.Background()) == nil {
		t.Fatal("accepted epoch rollback")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if w.Startup(ctx) == nil {
		t.Fatal("accepted cancelled startup")
	}
}

func TestBrokerFDRefusesMissingActivation(t *testing.T) {
	t.Setenv("LISTEN_PID", "0")
	t.Setenv("LISTEN_FDS", "1")
	t.Setenv("LISTEN_FDNAMES", "broker")
	if _, err := brokerFD(); err == nil {
		t.Fatal("accepted wrong activation PID")
	}
}

func TestBrokerSocketSafeRejectsMissingAndSymlink(t *testing.T) {
	if brokerSocketSafe(21003) { // This test must not depend on host setup.
		t.Skip("host already has a matching socket; guest verifies pathname drift")
	}
	var st unix.Stat_t
	if unix.Lstat(BrokerSocket, &st) == nil && st.Mode&unix.S_IFMT == unix.S_IFLNK {
		t.Fatal("host has broker symlink")
	}
}
