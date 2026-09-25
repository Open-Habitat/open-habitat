//go:build linux

package provision

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/unix"
)

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
