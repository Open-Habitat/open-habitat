//go:build linux

package host

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
)

const PrepareProtocol = "host.prepare.v1"

var ErrPrepareBlocked = errors.New("host_prepare_blocked: preparation executor and postcondition verification are unavailable")
var ErrDisruptionApproval = errors.New("disruption_approval_required: preparation requires explicit maintenance approval")

type PrepareRequest struct {
	SitePath          string
	ApprovedPlan      string
	DryRun            bool
	ApproveDisruption bool
}

// PrepareResult deliberately reports requirements, not executable mutations.
// Until the executor can observe a complete plan, Would is empty and the dry
// run fails rather than pretending this requirements list is a safe preview.
type PrepareResult struct {
	DryRun                     bool     `json:"dry_run"`
	Plan                       Plan     `json:"plan"`
	Would                      []Action `json:"would"`
	Requirements               []Action `json:"requirements"`
	DisruptionApprovalRequired bool     `json:"disruption_approval_required"`
	Outcome                    string   `json:"outcome"`
}

// Prepare exposes only no-write qualification. Approval is never evidence of
// EDQUOT, boot ordering or ACL restoration. A later executor must reobserve and
// compare approval under the shared operation lock, persist intent before each
// mutation and leave interrupted probes closed for fix-forward recovery.
func Prepare(ctx context.Context, req PrepareRequest) (PrepareResult, error) {
	if os.Geteuid() != 0 {
		return PrepareResult{}, ErrTrust
	}
	return preflightPrepare(ctx, req, BuildPlan)
}

func preflightPrepare(ctx context.Context, req PrepareRequest, observe func(context.Context, string) (Plan, error)) (PrepareResult, error) {
	if !absolute(req.SitePath) || req.ApprovedPlan != "" && !digestRE.MatchString(req.ApprovedPlan) || !req.DryRun && req.ApprovedPlan == "" {
		return PrepareResult{}, ErrSite
	}
	if !req.DryRun && !req.ApproveDisruption {
		return PrepareResult{}, ErrDisruptionApproval
	}
	if err := ctx.Err(); err != nil {
		return PrepareResult{}, err
	}
	p, err := observe(ctx, req.SitePath)
	if err != nil {
		return PrepareResult{}, err
	}
	// The apply observation already binds site, protected inputs, machine, boot,
	// storage and journal. Domain separation prevents applying an install approval
	// to preparation. Changing preparation semantics requires a protocol bump.
	h := sha256.Sum256([]byte(PrepareProtocol + "\x00" + p.PlanID))
	p.PlanID = hex.EncodeToString(h[:])
	p.Protocol = PrepareProtocol
	p.Ready, p.Approvable = false, false
	p.Actions = []Action{}
	p.Checks = append(p.Checks, Check{"preparation.executor", "unavailable", "preparation_executor_required"})
	r := PrepareResult{DryRun: req.DryRun, Plan: p, Would: []Action{}, DisruptionApprovalRequired: true, Outcome: "blocked", Requirements: []Action{
		{"prepare.quota_probe", "unavailable", "disposable_uid_edquot_probe_required"},
		{"prepare.boot_gates", "unavailable", "home_quota_boot_gates_required"},
		{"prepare.socket_policy", "unavailable", "both_listeners_acl_binding_verification_required"},
		{"prepare.proc_policy", "unavailable", "effective_proc_isolation_required"},
		{"prepare.session_policy", "unavailable", "logind_polkit_restart_plan_required"},
	}}
	for _, c := range p.Checks {
		if c.Code == "storage.quota_format" && c.Reason == "offline_journaled_user_quota_required" {
			r.Requirements = append(r.Requirements, Action{"customer.storage", "blocked", "customer_offline_quota_features_required"})
		}
	}
	if err := ctx.Err(); err != nil {
		return r, err
	}
	if req.ApprovedPlan != "" && req.ApprovedPlan != p.PlanID {
		return r, ErrStalePlan
	}
	for _, c := range p.Checks {
		if c.Status != "pass" && c.Reason == "recovery_required" {
			return r, ErrRecovery
		}
		if c.Status != "pass" && c.Reason == "immutable_identity_changed" {
			return r, ErrImmutable
		}
	}
	// Independent of observer readiness: no observer or caller can enable root
	// mutations before the executor and its postconditions have been implemented.
	return r, ErrPrepareBlocked
}
