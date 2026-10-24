//go:build linux

package provision

import (
	"context"
	"errors"
	"os"
	"os/user"
	"path/filepath"
	"testing"
)

func installFixture(t *testing.T) (string, uint32, Initialization) {
	t.Helper()
	// Like the broker fixtures, keep every ancestor non-writable by strangers.
	account, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	p, e := os.MkdirTemp(account.HomeDir, "oh-initialize-test-")
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { os.RemoveAll(p) })
	return p, uint32(os.Geteuid()), Initialization{GatewayUID: 31000, GatewayGID: 31000, UIDMin: 32000, UIDMax: 32003}
}
func TestInitializeEmptyOnlyAndCrashBoundaries(t *testing.T) {
	for _, phase := range []string{"broker.json", "allowlist.json", "bindings.json", "head.json", "published"} {
		t.Run(phase, func(t *testing.T) {
			p, owner, policy := installFixture(t)
			ids := []string{"123"}
			_, e := initializeBroker(context.Background(), p, "broker", policy, ids, owner, func(s string) error {
				if s == phase {
					return errors.New("crash")
				}
				return nil
			})
			if e == nil {
				t.Fatal("injection did not interrupt")
			}
			changed, e := initializeBroker(context.Background(), p, "broker", policy, ids, owner, nil)
			if phase == "published" {
				if e != nil || changed {
					t.Fatalf("durable publication not recognized: %v %v", changed, e)
				}
			} else {
				if e == nil {
					t.Fatal("interrupted staging reseeded")
				}
				if _, e = os.Stat(filepath.Join(p, "broker")); !os.IsNotExist(e) {
					t.Fatal("incomplete broker visible")
				}
			}
		})
	}
}
func TestInitializeRepeatAndForeignState(t *testing.T) {
	p, owner, policy := installFixture(t)
	ctx := context.Background()
	ids := []string{"123"}
	if changed, e := initializeBroker(ctx, p, "broker", policy, ids, owner, nil); e != nil || !changed {
		t.Fatal(changed, e)
	}
	if changed, e := initializeBroker(ctx, p, "broker", policy, ids, owner, nil); e != nil || changed {
		t.Fatal(changed, e)
	}
	other := policy
	other.UIDMax++
	if _, e := initializeBroker(ctx, p, "broker", other, ids, owner, nil); e == nil {
		t.Fatal("immutable policy changed")
	}
	// Real committed nonempty state is never replaced by an empty ledger.
	dir := filepath.Join(p, "broker")
	lb := []byte(`{"version":1,"generation":2,"bindings":[{"id":"123","uid":32000,"username":"person"}]}`)
	if e := os.WriteFile(filepath.Join(dir, "bindings.json"), lb, 0600); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(filepath.Join(dir, "head.json"), []byte(`{"version":1,"epoch":1,"generation":2}`), 0600); e != nil {
		t.Fatal(e)
	}
	if changed, e := initializeBroker(ctx, p, "broker", policy, ids, owner, nil); e != nil || changed {
		t.Fatal(changed, e)
	}
	got, _ := os.ReadFile(filepath.Join(dir, "bindings.json"))
	if string(got) != string(lb) {
		t.Fatal("reseeded occupied broker")
	}
	if e := os.WriteFile(filepath.Join(dir, "pending.json"), []byte(`{}`), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := initializeBroker(ctx, p, "broker", policy, ids, owner, nil); e == nil {
		t.Fatal("pending broker accepted")
	}
}
func TestPublishAdmissionWatermarkAndStalePlan(t *testing.T) {
	p, owner, policy := installFixture(t)
	ctx := context.Background()
	if _, e := initializeBroker(ctx, p, "broker", policy, []string{"123"}, owner, nil); e != nil {
		t.Fatal(e)
	}
	dir := filepath.Join(p, "broker")
	s, e := inspectInstallation(ctx, dir, owner)
	if e != nil {
		t.Fatal(e)
	}
	n, e := publishAdmission(ctx, dir, owner, s.Token, []string{"456"}, false)
	if e != nil {
		t.Fatal(e)
	}
	if n.Epoch != 2 || n.ObservedEpoch != 1 || n.Generation != 1 {
		t.Fatalf("false broker observation: %+v", n)
	}
	if _, e = publishAdmission(ctx, dir, owner, s.Token, []string{"789"}, false); e == nil {
		t.Fatal("stale token accepted")
	}
	if _, e = publishAdmission(ctx, dir, owner, n.Token, []string{"789"}, false); e == nil {
		t.Fatal("unobserved epoch accepted")
	}
	// Only the broker advances its observed epoch. Simulate that observation,
	// not a claim that an actual broker/executor ran in this unit test.
	if e = os.WriteFile(filepath.Join(dir, "head.json"), []byte(`{"version":1,"epoch":2,"generation":1}`), 0600); e != nil {
		t.Fatal(e)
	}
	n, e = inspectInstallation(ctx, dir, owner)
	if e != nil {
		t.Fatal(e)
	}
	same, e := publishAdmission(ctx, dir, owner, n.Token, []string{"456"}, false)
	if e != nil || same.Token != n.Token {
		t.Fatal("non-idempotent admission", e)
	}
}
