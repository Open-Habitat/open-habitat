//go:build linux

package host

import (
	"context"
	"errors"
	"os"
)

var ErrStalePlan = errors.New("stale_plan: observed inputs differ from the approved plan; obtain and approve a new plan")
var ErrApplyBlocked = errors.New("host_apply_blocked: qualification is incomplete; inspect the typed blockers")
var ErrImmutable = errors.New("immutable_identity_changed: ordinary apply cannot migrate initialized identity policy")

// ApplyRequest names an observation, not a caller-supplied executable plan.
// Approval never overrides a failed check. Dry runs accept an omitted approval
// to inspect current blockers, but still validate it when supplied.
type ApplyRequest struct {
	SitePath     string
	ApprovedPlan string
	DryRun       bool
	Progress     func(string) error
}

type ApplyResult struct {
	DryRun         bool                   `json:"dry_run"`
	Plan           Plan                   `json:"plan"`
	Would          []Action               `json:"would"`
	Outcome        string                 `json:"outcome"`
	Operation      *Operation             `json:"operation,omitempty"`
	Administrators []AdministratorOutcome `json:"administrators,omitempty"`
}
type AdministratorOutcome struct {
	Subject string `json:"subject"`
	Outcome string `json:"outcome"`
}

// Apply executes only fixed product actions after approval revalidation under
// the root operation lock. A dry run never creates that lock or an intent.
func Apply(ctx context.Context, req ApplyRequest) (ApplyResult, error) {
	if os.Geteuid() != 0 {
		return ApplyResult{}, ErrTrust
	}
	return applyNative(ctx, req)
}
