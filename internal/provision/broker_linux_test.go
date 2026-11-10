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
	"sync"
	"testing"

	"golang.org/x/sys/unix"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"github.com/Open-Habitat/open-habitat/internal/storagequota"
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
func (e *startupExecutor) SyncAtBoot(context.Context, ExecutorIdentity) (bool, error) {
	panic("startup must not look into homes")
}
func (e *startupExecutor) EnableLinger(context.Context, ExecutorIdentity) error {
	panic("startup inspection must not enable lingering")
}
func (e *startupExecutor) StartDaemon(context.Context, ExecutorIdentity) error {
	panic("startup must not start daemons")
}
func (e *startupExecutor) StopListeners(context.Context, ExecutorIdentity) error {
	panic("startup inspection must not stop listeners")
}
func (e *startupExecutor) Verify(ctx context.Context, _ ExecutorIdentity) error {
	e.calls++
	if e.fail || ctx.Err() != nil {
		return ErrInvalid
	}
	return nil
}

func TestBrokerAdmissionConfig(t *testing.T) {
	base := `{"version":1,"gateway_uid":21003,"gateway_gid":21003,"uid_min":21032,"uid_max":21047,"state_dir":"/var/lib/open-habitat/broker"`
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
	w.QuotaEnabled = func() error { return nil }
	w.Capacity = func() (storagequota.Filesystem, error) {
		return storagequota.Filesystem{Capacity: 2 << 30, Free: 1 << 30}, nil
	}
	w.Quota = &fakeQuota{quota: storagequota.Quota{Limit: 1 << 30}}
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

// A boot starts with committed bindings but no active user sockets. Restore
// must release the ledger lock before calling Ready, which invokes the JIT
// gate, and keep serving when one user's gate rejects activation.
type rebootHost struct {
	*fakeHost
	mu     sync.Mutex
	active map[string]bool
	gate   func(ExecutorIdentity) error
}

func (h *rebootHost) Ready(_ context.Context, i ExecutorIdentity) error {
	if err := h.gate(i); err != nil {
		return err
	}
	h.mu.Lock()
	h.active[i.Username()] = true
	h.mu.Unlock()
	return nil
}
func (h *rebootHost) RouteReady(_ context.Context, i ExecutorIdentity) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	if !h.active[i.Username()] {
		return ErrInvalid
	}
	return nil
}
func TestBrokerRestoresCommittedSocketsWithoutLogin(t *testing.T) {
	w, h := writerFixture(t)
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"},{"id":"43"}]}`)
	for _, u := range []struct{ id, name string }{{"42", "carol"}, {"43", "dana"}} {
		if r := handle(w, "ensure", u.id, u.name); r.Route == nil {
			t.Fatal(r)
		}
	}
	blocked := make(chan struct{})
	entered := make(chan struct{})
	gateError := make(chan error, 2)
	reboot := &rebootHost{fakeHost: h, active: map[string]bool{}}
	reboot.gate = func(i ExecutorIdentity) error {
		// The actual gate reads the ledger. If restoration holds its
		// exclusive lock this exchange cannot complete.
		if r := handle(w, "lookup", i.ID(), ""); r.Users == nil {
			gateError <- errors.New("ledger unavailable during activation")
		}
		if i.Username() == "carol" {
			close(entered)
			<-blocked
			return ErrInvalid // gate rejects Carol
		}
		return nil
	}
	w.Executor = reboot
	bindings, err := w.startupBindings(context.Background())
	if err != nil || len(bindings) != 2 {
		t.Fatalf("startup: %v, bindings: %+v", err, bindings)
	}
	results := make(chan string, 2)
	done := make(chan struct{})
	go func() {
		w.restoreSockets(context.Background(), bindings, func(user string, err error) {
			if err == nil {
				results <- user + ":ready"
			} else {
				results <- user + ":failed"
			}
		}, func(string, bool, error) {})
		close(done)
	}()
	<-entered
	// While one gate waits, the broker remains responsive; authorization
	// fails closed for sockets that have not yet been restored.
	if r := handle(w, "authorize", "43", ""); r.Failure != StateUnavailable {
		t.Fatalf("inactive user unexpectedly routable: %+v", r)
	}
	close(blocked)
	<-done
	if got := <-results; got != "carol:failed" {
		t.Fatal(got)
	}
	if got := <-results; got != "dana:ready" {
		t.Fatal(got)
	}
	if r := handle(w, "authorize", "43", ""); r.Route == nil {
		t.Fatalf("broker cannot serve later user: %+v", r)
	}
	select {
	case err := <-gateError:
		t.Fatal(err)
	default:
	}
	if r := handle(w, "authorize", "42", ""); r.Failure != StateUnavailable {
		t.Fatalf("failed user's socket became routable: %+v", r)
	}
}

func TestBrokerStartupVerifiesButDoesNotActivateRevokedBinding(t *testing.T) {
	w, h := writerFixture(t)
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"},{"id":"43"}]}`)
	for _, u := range []struct{ id, name string }{{"42", "carol"}, {"43", "dana"}} {
		if r := handle(w, "ensure", u.id, u.name); r.Route == nil {
			t.Fatal(r)
		}
	}
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[{"id":"42"}]}`)
	h.mu.Lock()
	h.calls = nil
	h.mu.Unlock()
	bindings, err := w.startupBindings(context.Background())
	if err != nil || len(bindings) != 1 || bindings[0].ID() != "42" {
		t.Fatalf("revoked binding included in activation: %v, %+v", err, bindings)
	}
	assertCalls(t, h, call("verify", ExecutorIdentity{provider: "github", id: "42", username: "carol", uid: 2100}), call("verify", ExecutorIdentity{provider: "github", id: "43", username: "dana", uid: 2101}))
	w.AdmitAny = true
	bindings, err = w.startupBindings(context.Background())
	if err != nil || len(bindings) != 2 {
		t.Fatalf("admission:any dropped bound user: %v, %+v", err, bindings)
	}
}

func TestBrokerActivationLockAndUncertainStart(t *testing.T) {
	w, h := writerFixture(t)
	identity := ExecutorIdentity{provider: "github", id: "42", username: "carol", uid: 2100}
	entered := make(chan struct{})
	release := make(chan struct{})
	h.onReady = func() { close(entered); <-release }
	first := make(chan error, 1)
	go func() { first <- w.activate(context.Background(), identity) }()
	<-entered
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := w.activate(ctx, identity); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled waiter entered activation: %v", err)
	}
	h.mu.Lock()
	h.onReady = nil
	h.mu.Unlock()
	second := make(chan error, 1)
	go func() { second <- w.activate(context.Background(), identity) }()
	close(release)
	if err := <-first; err != nil {
		t.Fatal(err)
	}
	if err := <-second; err != nil {
		t.Fatalf("waiting activation did not proceed: %v", err)
	}
	h.mu.Lock()
	h.fail = "uncertain-ready"
	h.readyCalls = nil
	h.mu.Unlock()
	var reported []error
	w.restoreSockets(context.Background(), []ExecutorIdentity{identity, identity}, func(_ string, err error) {
		reported = append(reported, err)
	}, func(string, bool, error) { t.Fatal("checked a signal after an uncertain activation") })
	if len(reported) != 1 || !errors.Is(reported[0], errActivationUncertain) {
		t.Fatalf("continued after uncertain systemd job: %v", reported)
	}
	h.mu.Lock()
	h.fail = ""
	n := len(h.readyCalls)
	h.mu.Unlock()
	if err := w.activate(context.Background(), identity); err == nil {
		t.Fatal("started another socket while submitted job may be pending")
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if len(h.readyCalls) != n {
		t.Fatalf("uncertain activation reached executor: %v", h.readyCalls)
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

// budgetHost records whether each host probe ran with startup budgets.
type budgetHost struct {
	*fakeHost
	seen []string
}

func (h *budgetHost) mark(ctx context.Context, op string) {
	startup, _ := ctx.Value(startupProbes{}).(bool)
	h.seen = append(h.seen, op+":"+map[bool]string{true: "startup", false: "request"}[startup])
}
func (h *budgetHost) Verify(ctx context.Context, i ExecutorIdentity) error {
	h.mark(ctx, "verify")
	return h.fakeHost.Verify(ctx, i)
}
func (h *budgetHost) Ready(ctx context.Context, i ExecutorIdentity) error {
	h.mark(ctx, "ready")
	return h.fakeHost.Ready(ctx, i)
}

// Only boot verification and restore get startup budgets; a person's
// request keeps the short request-time budget.
func TestStartupBudgetsOnlyAtBoot(t *testing.T) {
	w, h := writerFixture(t)
	host := &budgetHost{fakeHost: h}
	w.Executor = host
	if r := handle(w, "ensure", "42", "carol"); r.Route == nil {
		t.Fatal(r)
	}
	for _, s := range host.seen {
		if strings.HasSuffix(s, ":startup") {
			t.Fatal("request probe got startup budget", host.seen)
		}
	}
	host.seen = nil
	bindings, err := w.startupBindings(context.Background())
	if err != nil || len(bindings) != 1 {
		t.Fatal(err, bindings)
	}
	w.restoreSockets(context.Background(), bindings, func(string, error) {}, func(string, bool, error) {})
	if strings.Join(host.seen, ",") != "verify:startup,ready:startup" {
		t.Fatal(host.seen)
	}
}
