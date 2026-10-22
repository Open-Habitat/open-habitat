//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/Open-Habitat/open-habitat/internal/provision"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestApplyApprovalAndNoWrite(t *testing.T) {
	site, src, s := inspectionFixture(t)
	observe := func(ctx context.Context, path string) (Plan, error) { return buildPlan(ctx, path, src) }
	p, err := observe(context.Background(), site)
	if err != nil {
		t.Fatal(err)
	}
	before := snapshot(t, filepath.Dir(site))
	for _, dry := range []bool{false, true} {
		r, err := preflightApply(context.Background(), ApplyRequest{SitePath: site, ApprovedPlan: p.PlanID, DryRun: dry}, observe)
		if !errors.Is(err, ErrApplyBlocked) || r.Outcome != "blocked" || r.DryRun != dry || r.Plan.Protocol != ApplyProtocol || len(r.Would) == 0 {
			t.Fatal(r, err)
		}
	}
	if snapshot(t, filepath.Dir(site)) != before {
		t.Fatal("blocked apply wrote host state")
	}
	// Even a caller presenting the exact old fingerprint cannot approve changed
	// desired state. Approval is compared to a fresh trusted observation.
	s.Storage.DefaultLimitBytes += 1024
	b, _ := json.Marshal(s)
	if err := os.WriteFile(site, b, 0600); err != nil {
		t.Fatal(err)
	}
	for _, dry := range []bool{false, true} {
		_, err := preflightApply(context.Background(), ApplyRequest{SitePath: site, ApprovedPlan: p.PlanID, DryRun: dry}, observe)
		if !errors.Is(err, ErrStalePlan) {
			t.Fatal(err)
		}
	}
}

func TestApplyRejectsBeforeObservationAndNeverAuthorizes(t *testing.T) {
	called := false
	observe := func(context.Context, string) (Plan, error) { called = true; return Plan{}, nil }
	for _, r := range []ApplyRequest{
		{SitePath: "relative", DryRun: true}, {SitePath: "/site.json"}, {SitePath: "/site.json", ApprovedPlan: "SECRET_SENTINEL", DryRun: true},
	} {
		if _, err := preflightApply(context.Background(), r, observe); !errors.Is(err, ErrSite) || called {
			t.Fatal("observed invalid request", err)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := preflightApply(ctx, ApplyRequest{SitePath: "/site.json", DryRun: true}, observe); !errors.Is(err, context.Canceled) || called {
		t.Fatal(err)
	}
	// An accidental change in a future observer cannot unlock an unimplemented
	// executor. This check must remain until real adapters and postconditions land.
	p := Plan{PlanID: strings.Repeat("a", 64), Approvable: true, Inspection: Inspection{Ready: true}}
	_, err := preflightApply(context.Background(), ApplyRequest{SitePath: "/site.json", ApprovedPlan: p.PlanID}, func(context.Context, string) (Plan, error) { return p, nil })
	if !errors.Is(err, ErrApplyBlocked) {
		t.Fatal("qualification bypass", err)
	}
}

func TestApplyRecoveryAndImmutableRefusals(t *testing.T) {
	site, src, s := inspectionFixture(t)
	observe := func(ctx context.Context, path string) (Plan, error) { return buildPlan(ctx, path, src) }
	l, err := openOperationLock(context.Background(), src.journal, src.owner, time.Now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = l.Begin("apply", strings.Repeat("a", 64), s.Release); err != nil {
		t.Fatal(err)
	}
	if err := l.Close(); err != nil {
		t.Fatal(err)
	}
	before := snapshot(t, filepath.Dir(site))
	for _, dry := range []bool{false, true} {
		p, err := observe(context.Background(), site)
		if err != nil {
			t.Fatal(err)
		}
		_, err = preflightApply(context.Background(), ApplyRequest{SitePath: site, ApprovedPlan: p.PlanID, DryRun: dry}, observe)
		if !errors.Is(err, ErrRecovery) {
			t.Fatal("interruption must not become new mutation authorization", err)
		}
	}
	if snapshot(t, filepath.Dir(site)) != before {
		t.Fatal("recovery changed evidence")
	}
	// Use a separate fresh fixture: recovery is not a repair/reset permission.
	site, src, _ = inspectionFixture(t)
	oldBroker := src.broker
	src.broker = func(ctx context.Context) (provision.InstallationState, error) {
		s, err := oldBroker(ctx)
		s.Policy.GatewayUID++
		return s, err
	}
	p, err := observe(context.Background(), site)
	if err != nil {
		t.Fatal(err)
	}
	_, err = preflightApply(context.Background(), ApplyRequest{SitePath: site, ApprovedPlan: p.PlanID, DryRun: false}, observe)
	if !errors.Is(err, ErrImmutable) {
		t.Fatal("identity migration accepted", err)
	}
}
