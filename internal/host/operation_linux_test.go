//go:build linux

package host

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

func operationFixture(t *testing.T) (string, uint32) {
	t.Helper()
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	d, e := os.MkdirTemp(u.HomeDir, "oh-operation-test-")
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { os.RemoveAll(d) })
	return filepath.Join(d, "host"), uint32(os.Geteuid())
}
func TestOperationLockAndInterruptedPhase(t *testing.T) {
	dir, owner := operationFixture(t)
	now := func() time.Time { return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) }
	l, e := openOperationLock(context.Background(), dir, owner, now)
	if e != nil {
		t.Fatal(e)
	}
	if _, e := openOperationLock(context.Background(), dir, owner, now); !errors.Is(e, ErrBusy) {
		t.Fatal("concurrent lock accepted", e)
	}
	target := Release{"0.1.0", strings.Repeat("0", 64)}
	o, e := l.Begin("apply", strings.Repeat("1", 64), target)
	if e != nil {
		t.Fatal(e)
	}
	o, e = l.Advance(o, "initializing", "running", "")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = l.Advance(o, "SECRET_SENTINEL", "running", ""); e == nil {
		t.Fatal("unstructured diagnostics accepted")
	}
	if e = l.Close(); e != nil {
		t.Fatal(e)
	}
	// An exited process releases flock but does not erase its intent fence.
	l, e = openOperationLock(context.Background(), dir, owner, now)
	if e != nil {
		t.Fatal(e)
	}
	defer l.Close()
	if _, e = l.Begin("apply", strings.Repeat("2", 64), target); !errors.Is(e, ErrRecovery) {
		t.Fatal("interrupted operation ignored", e)
	}
	got, e := showOperation(dir, o.ID, owner)
	if e != nil || got != o {
		t.Fatal("phase lost", got, e)
	}
	// A stale in-memory operation cannot skip or overwrite a durable phase.
	stale := o
	stale.Seq--
	if _, e = l.Advance(stale, "completed", "completed", ""); e == nil {
		t.Fatal("stale writer accepted")
	}
	o, e = l.Advance(o, "verified", "completed", "")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = l.Begin("apply", strings.Repeat("2", 64), target); e != nil {
		t.Fatal("completed fence not reusable", e)
	}
	for _, id := range []string{"../active", o.ID + "/..", ""} {
		if _, e = showOperation(dir, id, owner); !errors.Is(e, ErrNotFound) {
			t.Fatal("unsafe selector accepted")
		}
	}
}
func TestOperationIncompleteAtomicWrite(t *testing.T) {
	dir, owner := operationFixture(t)
	l, e := openOperationLock(context.Background(), dir, owner, time.Now)
	if e != nil {
		t.Fatal(e)
	}
	defer l.Close()
	o, e := l.Begin("apply", strings.Repeat("1", 64), Release{"0.1.0", strings.Repeat("0", 64)})
	if e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile(filepath.Join(dir, "active.json.next"), []byte(`{}`), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e = l.Advance(o, "seeded", "running", ""); !errors.Is(e, ErrRecovery) {
		t.Fatal("incomplete publication ignored", e)
	}
	if _, e = l.Begin("apply", strings.Repeat("2", 64), o.Target); !errors.Is(e, ErrRecovery) {
		t.Fatal("crash fence ignored", e)
	}
}
func TestProtectedSiteTrust(t *testing.T) {
	dir, owner := operationFixture(t)
	parent := filepath.Dir(dir)
	p := filepath.Join(parent, "site.json")
	if e := os.WriteFile(p, example(t), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := loadSite(p, owner); e != nil {
		t.Fatal(e)
	}
	if e := os.Chmod(p, 0644); e != nil {
		t.Fatal(e)
	}
	if _, e := loadSite(p, owner); !errors.Is(e, ErrTrust) {
		t.Fatal("public site accepted", e)
	}
	if e := os.Chmod(p, 0600); e != nil {
		t.Fatal(e)
	}
	link := filepath.Join(parent, "link.json")
	if e := os.Symlink(p, link); e != nil {
		t.Fatal(e)
	}
	if _, e := loadSite(link, owner); e == nil {
		t.Fatal("symlink site accepted")
	}
}

// The child is re-executed under a different actual kernel UID, not an owner
// field override. No changes to this machine's passwd/groups are needed.
func TestOperationDistinctUIDs(t *testing.T) {
	if os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("requires disposable distinct-UID container")
	}
	if os.Getenv("HOST_INIT_UID_CHILD") == "1" {
		dir := os.Getenv("HOST_INIT_UID_DIRECTORY")
		if _, e := ShowOperation(os.Getenv("HOST_INIT_UID_ID")); e == nil {
			t.Fatal("non-root inspection accepted")
		}
		if _, e := os.ReadFile(filepath.Join(dir, "active.json")); e == nil {
			t.Fatal("foreign UID read root journal")
		}
		if _, e := openOperationLock(context.Background(), dir, uint32(os.Geteuid()), time.Now); e == nil {
			t.Fatal("foreign UID took root operation lock")
		}
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("container must run as root")
	}
	dir, owner := operationFixture(t)
	l, e := openOperationLock(context.Background(), dir, owner, time.Now)
	if e != nil {
		t.Fatal(e)
	}
	defer l.Close()
	o, e := l.Begin("apply", strings.Repeat("1", 64), Release{"0.1.0", strings.Repeat("0", 64)})
	if e != nil {
		t.Fatal(e)
	}
	exe, e := os.Executable()
	if e != nil {
		t.Fatal(e)
	}
	cmd := exec.Command(exe, "-test.run", "^TestOperationDistinctUIDs$", "-test.v")
	cmd.Env = append(os.Environ(), "HOST_INIT_UID_CHILD=1", "HOST_INIT_UID_DIRECTORY="+dir, "HOST_INIT_UID_ID="+o.ID)
	cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 42001, Gid: 42001}}
	if b, e := cmd.CombinedOutput(); e != nil {
		t.Fatalf("distinct UID: %v\n%s", e, b)
	}
}
