//go:build linux

package host

import (
	"context"
	"encoding/json"
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
	for _, secret := range []string{"SECRET_SENTINEL", "secret_sentinel"} {
		if _, e = l.Advance(o, secret, "running", ""); e == nil {
			t.Fatal("unstructured phase accepted")
		}
		if _, e = l.Advance(o, "verifying", "failed", secret); e == nil {
			t.Fatal("unstructured reason accepted")
		}
	}
	if _, e = l.Begin("secret_sentinel", strings.Repeat("1", 64), target); e == nil {
		t.Fatal("unstructured kind accepted")
	}
	raw, e := os.ReadFile(filepath.Join(dir, o.ID+".json"))
	if e != nil || strings.Contains(strings.ToLower(string(raw)), "secret_sentinel") {
		t.Fatal("secret in journal", e)
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
	got, e := showOperation(dir, o.ID, owner)
	if e != nil || got != o {
		t.Fatal("refused phase changed the durable receipt", got, e)
	}
	if _, e = l.Begin("apply", strings.Repeat("2", 64), o.Target); !errors.Is(e, ErrRecovery) {
		t.Fatal("crash fence ignored", e)
	}
}
func TestOperationInterruptedBeginDoesNotCreateReceipts(t *testing.T) {
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
	o, e = l.Advance(o, "verified", "completed", "")
	if e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile(filepath.Join(dir, "active.json.next"), []byte(`{}`), 0600); e != nil {
		t.Fatal(e)
	}
	before, e := os.ReadDir(dir)
	if e != nil {
		t.Fatal(e)
	}
	for i := 0; i < 2; i++ {
		if _, e = l.Begin("apply", strings.Repeat("2", 64), o.Target); !errors.Is(e, ErrRecovery) {
			t.Fatal("incomplete successor ignored", e)
		}
	}
	after, e := os.ReadDir(dir)
	if e != nil {
		t.Fatal(e)
	}
	if len(after) != len(before) {
		t.Fatalf("refused Begin created orphan receipts: %d -> %d", len(before), len(after))
	}
	got, e := showOperation(dir, o.ID, owner)
	if e != nil || got != o {
		t.Fatal("prior receipt overwritten", e)
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

// Simulate process death between receipt publication and active-fence publication
// at every apply phase. This is filesystem evidence, not a power-loss test.
func TestOperationSplitPublicationAtEveryPhase(t *testing.T) {
	for _, phase := range []string{"started", "staging", "initializing", "seeded", "converging", "verifying", "quiescing", "activating", "verified", "completed"} {
		for _, priorStatus := range []string{"running", "completed"} {
			t.Run(phase+"/"+priorStatus, func(t *testing.T) {
				dir, owner := operationFixture(t)
				l, err := openOperationLock(context.Background(), dir, owner, time.Now)
				if err != nil {
					t.Fatal(err)
				}
				target := Release{"0.1.0", strings.Repeat("a", 64)}
				o, err := l.Begin("apply", strings.Repeat("b", 64), target)
				if err != nil {
					t.Fatal(err)
				}
				if priorStatus == "completed" {
					o, err = l.Advance(o, "completed", "completed", "")
					if err != nil {
						t.Fatal(err)
					}
				}
				// Write only the successor receipt, exactly the order persist uses.
				next := o
				next.Phase = phase
				next.Seq++
				next.Status = "running"
				if phase == "completed" {
					next.Status = "completed"
				}
				b, _ := json.Marshal(next)
				receipt := filepath.Join(dir, o.ID+".json")
				if err := os.WriteFile(receipt, b, 0600); err != nil {
					t.Fatal(err)
				}
				if err := l.Close(); err != nil {
					t.Fatal(err)
				}
				l, err = openOperationLock(context.Background(), dir, owner, time.Now)
				if err != nil {
					t.Fatal(err)
				}
				defer l.Close()
				before := snapshot(t, dir)
				if _, err = l.Begin("apply", strings.Repeat("c", 64), target); !errors.Is(err, ErrRecovery) {
					t.Fatal("begin erased split publication", err)
				}
				if _, err = l.Advance(o, "completed", "completed", ""); !errors.Is(err, ErrRecovery) {
					t.Fatal("advance erased split publication", err)
				}
				if snapshot(t, dir) != before {
					t.Fatal("recovery refusal changed evidence")
				}
			})
		}
	}
}
