//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPrepareApprovalAndNoWrite(t *testing.T) {
	site, src, s := inspectionFixture(t)
	observe := func(ctx context.Context, path string) (Plan, error) { return buildPlan(ctx, path, src) }
	before := snapshot(t, filepath.Dir(site))
	preview, err := preflightPrepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, observe)
	if !errors.Is(err, ErrPrepareBlocked) || preview.Plan.Approvable || preview.Plan.Ready || preview.Plan.Protocol != PrepareProtocol || len(preview.Would) != 0 || len(preview.Requirements) < 5 || !preview.DisruptionApprovalRequired {
		t.Fatal(preview, err)
	}
	apply, err := observe(context.Background(), site)
	if err != nil || apply.PlanID == preview.Plan.PlanID {
		t.Fatal("approval protocols not separated", err)
	}
	for _, dry := range []bool{true, false} {
		req := PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, DryRun: dry, ApproveDisruption: true}
		r, err := preflightPrepare(context.Background(), req, observe)
		if !errors.Is(err, ErrPrepareBlocked) || r.DryRun != dry || r.Outcome != "blocked" {
			t.Fatal(r, err)
		}
		req.ApprovedPlan = apply.PlanID
		if _, err := preflightPrepare(context.Background(), req, observe); !errors.Is(err, ErrStalePlan) {
			t.Fatal("apply approval accepted", err)
		}
	}
	if snapshot(t, filepath.Dir(site)) != before {
		t.Fatal("prepare wrote state")
	}
	s.Storage.DefaultLimitBytes += 1024
	b, _ := json.Marshal(s)
	if err := os.WriteFile(site, b, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := preflightPrepare(context.Background(), PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, DryRun: true}, observe); !errors.Is(err, ErrStalePlan) {
		t.Fatal("changed declaration accepted", err)
	}
}

func TestPrepareRefusesBeforeObservationAndCannotBeUnlocked(t *testing.T) {
	called := false
	observe := func(context.Context, string) (Plan, error) { called = true; return Plan{}, nil }
	for _, r := range []PrepareRequest{
		{SitePath: "relative", DryRun: true}, {SitePath: "/site.json", ApproveDisruption: true},
		{SitePath: "/site.json", ApprovedPlan: strings.Repeat("a", 64)},
		{SitePath: "/site.json", ApprovedPlan: "SECRET_SENTINEL", DryRun: true},
	} {
		if _, err := preflightPrepare(context.Background(), r, observe); err == nil || called {
			t.Fatal("observed invalid/unapproved request", err)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := preflightPrepare(ctx, PrepareRequest{SitePath: "/site.json", DryRun: true}, observe); !errors.Is(err, context.Canceled) || called {
		t.Fatal(err)
	}
	p := Plan{PlanID: strings.Repeat("a", 64), Approvable: true, Inspection: Inspection{Ready: true}}
	r, err := preflightPrepare(context.Background(), PrepareRequest{SitePath: "/site.json", DryRun: true}, func(context.Context, string) (Plan, error) { return p, nil })
	if !errors.Is(err, ErrPrepareBlocked) || r.Plan.Approvable || r.Plan.Ready || len(r.Plan.Actions) != 0 {
		t.Fatal("observer enabled mutation", r, err)
	}
	// Even a valid install approval plus disruption approval is not prepare approval.
	if _, err := preflightApply(context.Background(), ApplyRequest{SitePath: "/site.json", ApprovedPlan: r.Plan.PlanID}, func(context.Context, string) (Plan, error) { return p, nil }); !errors.Is(err, ErrStalePlan) {
		t.Fatal(err)
	}
}

func TestPrepareRecoveryAndCustomerOfflineWork(t *testing.T) {
	site, src, s := inspectionFixture(t)
	observe := func(ctx context.Context, path string) (Plan, error) { return buildPlan(ctx, path, src) }
	l, err := openOperationLock(context.Background(), src.journal, src.owner, time.Now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = l.Begin("prepare", strings.Repeat("a", 64), s.Release); err != nil {
		t.Fatal(err)
	}
	if err = l.Close(); err != nil {
		t.Fatal(err)
	}
	before := snapshot(t, filepath.Dir(site))
	if _, err := preflightPrepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, observe); !errors.Is(err, ErrRecovery) {
		t.Fatal(err)
	}
	if snapshot(t, filepath.Dir(site)) != before {
		t.Fatal("interrupted evidence changed")
	}
	p := Plan{PlanID: strings.Repeat("b", 64), Inspection: Inspection{Checks: []Check{{"storage.quota_format", "fail", "offline_journaled_user_quota_required"}}}}
	r, err := preflightPrepare(context.Background(), PrepareRequest{SitePath: "/site.json", DryRun: true}, func(context.Context, string) (Plan, error) { return p, nil })
	if !errors.Is(err, ErrPrepareBlocked) || len(r.Would) != 0 || r.Requirements[len(r.Requirements)-1].Code != "customer.storage" {
		t.Fatal(r, err)
	}
	p.Checks = []Check{{"broker.state", "fail", "immutable_identity_changed"}}
	if _, err := preflightPrepare(context.Background(), PrepareRequest{SitePath: "/site.json", DryRun: true}, func(context.Context, string) (Plan, error) { return p, nil }); !errors.Is(err, ErrImmutable) {
		t.Fatal(err)
	}
}
