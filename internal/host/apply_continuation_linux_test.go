//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"
	"time"
)

func TestApplySuccessorConvergingContinuation(t *testing.T) {
	for _, bad := range []string{"", "changed_secret", "staging", "wrong_approval", "split"} {
		t.Run(bad, func(t *testing.T) {
			dir, owner := operationFixture(t)
			ctx := context.Background()
			approval := strings.Repeat("a", 64)
			target := Release{"0.1.0-pilot.3", strings.Repeat("b", 64)}
			l, e := openOperationLock(ctx, dir, owner, time.Now)
			if e != nil {
				t.Fatal(e)
			}
			o, e := l.BeginApply(approval, target, "original-protected-inputs-and-product")
			if e != nil {
				t.Fatal(e)
			}
			for o.Seq < 10 {
				o, e = l.Advance(o, "converging", "running", "")
				if e != nil {
					t.Fatal(e)
				}
			}
			if bad == "staging" {
				o, e = l.Advance(o, "staging", "running", "")
			}
			if bad == "split" {
				_, e = l.Advance(o, "verifying", "running", "")
				if e == nil {
					e = replacePrivateAt(l.fd, "active.json", mustOperationBytes(t, o))
				}
			}
			if e != nil {
				t.Fatal(e)
			}
			l.Close()
			originalID := o.ID
			req := ApplyRequest{SitePath: "/site.json", ApprovedPlan: approval}
			if bad == "wrong_approval" {
				req.ApprovedPlan = strings.Repeat("c", 64)
			}
			repaired := false
			mutations := 0
			current := func(context.Context, string) (string, error) { return "new-product-binding", nil }
			installed := func(context.Context, string) (string, error) {
				if bad == "changed_secret" {
					return "changed-secret-binding", nil
				}
				return "original-protected-inputs-and-product", nil
			}
			d := applyDriver{journal: dir, owner: owner, now: time.Now,
				observe: func(context.Context, string) (Plan, error) { return Plan{PlanID: strings.Repeat("d", 64)}, nil },
				binding: func(c context.Context, p string) (string, error) {
					return applyContinuationBinding(c, p, req.ApprovedPlan, dir, owner, current, installed)
				},
				revalidate: func(context.Context, string) error {
					if !repaired {
						return ErrApplyBlocked
					}
					return nil
				},
				complete: func(context.Context) (bool, error) { return mutations > 0, nil },
				steps:    []applyStep{{"initializing", func(context.Context) error { t.Fatal("reseed/republication on late recovery"); return nil }}},
				resumeSteps: func(o Operation) ([]applyStep, error) {
					if !lateApplyPhase(o.Phase) {
						return nil, ErrRecovery
					}
					return []applyStep{{"converging", func(context.Context) error { mutations++; return nil }}}, nil
				},
			}
			// Unrepaired parent refuses without a service action, even with the original
			// approval. With repaired ancestry the exact seq-10 operation can finish.
			if _, e = executeApply(ctx, req, d); e == nil || mutations != 0 {
				t.Fatal(e, mutations)
			}
			repaired = true
			r, e := executeApply(ctx, req, d)
			if bad != "" {
				if e == nil || mutations != 0 {
					t.Fatal("unsafe continuation", r, e, mutations)
				}
				return
			}
			if e != nil || r.Operation == nil || r.Operation.ID != originalID || r.Operation.PlanID != approval || r.Operation.Status != "completed" || r.Operation.Seq <= 10 || mutations != 1 {
				t.Fatal(r, e, mutations)
			}
			r, e = executeApply(ctx, req, d)
			if e != nil || r.Outcome != "no_change" || mutations != 1 {
				t.Fatal(r, e, mutations)
			}
			// Protected source identity drift after completion still cannot reuse approval.
			installed = func(context.Context, string) (string, error) { return "changed-secret-binding", nil }
			if _, e = executeApply(ctx, req, d); !errors.Is(e, ErrStalePlan) && !errors.Is(e, ErrApplyBlocked) {
				t.Fatal("unexpected drift result", e)
			}
		})
	}
}

func mustOperationBytes(t *testing.T, o Operation) []byte {
	t.Helper()
	b, e := json.Marshal(o)
	if e != nil {
		t.Fatal(e)
	}
	return b
}

func TestApplyBindingPreservesBootstrapRepairButNotSecretReplacement(t *testing.T) {
	if os.Geteuid() != 0 || os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("fixed root trust-key path requires disposable root container")
	}
	site, _, s := inspectionFixture(t)
	const base = "/etc/open-habitat"
	if e := os.Mkdir(base, 0700); e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll(base)
	if e := os.WriteFile(releaseTrustKey, []byte(strings.Repeat("k", 32)), 0600); e != nil {
		t.Fatal(e)
	}
	s.Gateway.OAuthSecretFile = base + "/oauth"
	s.Gateway.TLSCertFile = base + "/cert"
	s.Gateway.TLSKeyFile = base + "/key"
	for _, r := range protectedReferences(s) {
		if e := os.WriteFile(r.path, []byte("synthetic-input"), 0600); e != nil {
			t.Fatal(e)
		}
	}
	b, e := json.Marshal(s)
	if e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile(site, b, 0600); e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	old, e := inputBindingProduct(ctx, site, "original-product-digest")
	if e != nil {
		t.Fatal(e)
	}
	if e = os.Chmod(base, 0711); e != nil {
		t.Fatal(e)
	}
	repaired, e := inputBindingProduct(ctx, site, "original-product-digest")
	if e != nil || repaired != old {
		t.Fatal("parent repair invalidated protected inputs", e)
	}
	next, e := inputBindingProduct(ctx, site, "successor-product-digest")
	if e != nil || next == old {
		t.Fatal("product digest not bound", e)
	}
	if e = os.WriteFile(base+"/key.next", []byte("synthetic-input"), 0600); e != nil {
		t.Fatal(e)
	}
	if e = os.Rename(base+"/key.next", base+"/key"); e != nil {
		t.Fatal(e)
	}
	changed, e := inputBindingProduct(ctx, site, "original-product-digest")
	if e != nil || changed == old {
		t.Fatal("same bytes with changed source identity accepted", e)
	}
}
