//go:build linux

package host

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
)

const PrepareProtocol = "host.prepare.v2"

var ErrPrepareBlocked = errors.New("host_prepare_blocked: preparation prerequisites are unavailable")
var ErrDisruptionApproval = errors.New("disruption_approval_required: preparation requires explicit maintenance approval")
var ErrHomeMount = errors.New("home_mount_required: dedicated declared ext4 home mount required")
var ErrQuotaEnforcement = errors.New("quota_enforcement_required: journaled user quotas must already be enforced")

type PrepareRequest struct {
	SitePath          string
	ApprovedPlan      string
	DryRun            bool
	ApproveDisruption bool
	Progress          func(string) error
}
type PrepareResult struct {
	DryRun                     bool       `json:"dry_run"`
	Plan                       Plan       `json:"plan"`
	Would                      []Action   `json:"would"`
	Requirements               []Action   `json:"requirements"`
	DisruptionApprovalRequired bool       `json:"disruption_approval_required"`
	Outcome                    string     `json:"outcome"`
	PolicyFiles                []string   `json:"policy_files"`
	Operation                  *Operation `json:"operation,omitempty"`
}

func Prepare(ctx context.Context, req PrepareRequest) (PrepareResult, error) {
	if os.Geteuid() != 0 {
		return PrepareResult{}, ErrTrust
	}
	return prepare(ctx, req, productionPrepareSources())
}

// Qualification is separate from execution so a dry-run never creates even a
// lock directory. Installation/runtime/boot checks remain unavailable; none is
// promoted by completing this narrower, explicit maintenance operation.
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
	h := sha256.Sum256([]byte(PrepareProtocol + "\x00" + p.PlanID))
	p.PlanID = hex.EncodeToString(h[:])
	p.Protocol = PrepareProtocol
	p.Ready = false
	p.Approvable = false
	p.Actions = []Action{}
	r := PrepareResult{DryRun: req.DryRun, Plan: p, Would: []Action{}, Outcome: "blocked", DisruptionApprovalRequired: true, Requirements: []Action{
		{"prepare.boot_gates", "unavailable", "home_quota_boot_gates_required"},
		{"prepare.socket_acceptance", "unavailable", "cold_listeners_acl_binding_verification_required"},
		{"prepare.proc_acceptance", "unavailable", "effective_proc_session_restart_acceptance_required"},
	}}
	if req.ApprovedPlan != "" && req.ApprovedPlan != p.PlanID {
		return r, ErrStalePlan
	}
	checks := map[string]Check{}
	for _, c := range p.Checks {
		checks[c.Code] = c
		if c.Reason == "recovery_required" && c.Status != "pass" {
			return r, ErrRecovery
		}
		if c.Reason == "immutable_identity_changed" && c.Status != "pass" {
			return r, ErrImmutable
		}
	}
	if checks["storage.home"].Status != "pass" {
		return r, ErrHomeMount
	}
	if checks["storage.quota_format"].Status != "pass" {
		r.Requirements = append(r.Requirements, Action{"customer.storage", "blocked", "customer_offline_quota_features_required"})
		return r, ErrQuotaEnforcement
	}
	if checks["storage.enforcement"].Status != "pass" {
		return r, ErrQuotaEnforcement
	}
	for _, code := range []string{"site.schema", "host.identity", "platform.os", "platform.systemd", "operation.fence", "preparation.policy"} {
		if checks[code].Status != "pass" {
			return r, ErrPrepareBlocked
		}
	}
	r.Plan.Approvable = true
	r.Would = []Action{{"prepare.quota_probe", "planned", "bounded_disposable_uid_edquot_and_cleanup"}, {"prepare.policy", "planned", "install_storage_acl_proc_policy_files_no_activation"}}
	r.Plan.Actions = r.Would
	r.Outcome = "planned"
	return r, ctx.Err()
}
