//go:build linux

package host

import (
	"context"
	"errors"
	"os"
)

var ErrStalePlan = errors.New("stale_plan: observed inputs differ from the approved plan; obtain and approve a new plan")
var ErrApplyBlocked = errors.New("host_apply_blocked: qualification is incomplete; inspect the typed blockers")

// ApplyRequest names an observation, not a caller-supplied executable plan.
// Approval never overrides a failed check. Dry runs accept an omitted approval
// to inspect current blockers, but still validate it when supplied.
type ApplyRequest struct {
	SitePath     string
	ApprovedPlan string
	DryRun       bool
}

type ApplyResult struct {
	DryRun  bool     `json:"dry_run"`
	Plan    Plan     `json:"plan"`
	Would   []Action `json:"would"`
	Outcome string   `json:"outcome"`
}

// Apply currently implements the no-write qualification boundary. The current
// release has checksum inventory, not authenticated manifest/profile acceptance,
// and no preparation/boot-gate verifier. Neither a checksum nor a root-written
// "ready" file is permission to activate. Until those adapters land, no plan
// can pass this boundary, and no lock directory or operation receipt is created.
//
// The eventual executor must acquire the host lock, reopen protected inputs and
// repeat qualification and approval comparison *under that lock*, then journal
// intent before each action. It must not execute the Would list supplied by a
// caller, nor treat the plan ID as a reservation against root changes.
func Apply(ctx context.Context, req ApplyRequest) (ApplyResult, error) {
	if os.Geteuid() != 0 {
		return ApplyResult{}, ErrTrust
	}
	return preflightApply(ctx, req, func(ctx context.Context, path string) (Plan, error) {
		return BuildPlan(ctx, path)
	})
}

func preflightApply(ctx context.Context, req ApplyRequest, observe func(context.Context, string) (Plan, error)) (ApplyResult, error) {
	if !absolute(req.SitePath) || req.ApprovedPlan != "" && !digestRE.MatchString(req.ApprovedPlan) || !req.DryRun && req.ApprovedPlan == "" {
		return ApplyResult{}, ErrSite
	}
	if err := ctx.Err(); err != nil {
		return ApplyResult{}, err
	}
	p, err := observe(ctx, req.SitePath)
	if err != nil {
		return ApplyResult{}, err
	}
	r := ApplyResult{DryRun: req.DryRun, Plan: p, Would: p.Actions, Outcome: "blocked"}
	if err := ctx.Err(); err != nil {
		return r, err
	}
	if req.ApprovedPlan != "" && req.ApprovedPlan != p.PlanID {
		return r, ErrStalePlan
	}
	// Deliberately independent of p.Ready/Approvable: a future observer change
	// must not accidentally enable an executor that has not been implemented.
	return r, ErrApplyBlocked
}
