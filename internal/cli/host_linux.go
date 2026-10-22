//go:build linux

package cli

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/host"
)

func hostCommand(args []string) (any, error) {

	if len(args) >= 2 && args[0] == "config" && (args[1] == "path" || args[1] == "show") {
		path := "/etc/open-habitat/site.json"
		source := "default"
		if len(args) == 4 && args[2] == "--site" && filepath.IsAbs(args[3]) && filepath.Clean(args[3]) == args[3] && args[3] != "/" {
			path = args[3]
			source = "flag"
		} else if len(args) != 2 {
			return nil, usage("expected host config path|show [--site /absolute/site.json]")
		}
		result := map[string]any{"path": path, "source": source, "environment": "ignored", "release_directory": "/var/lib/open-habitat/release", "release_key": "/etc/open-habitat/release-key.pub", "data_root": "/var/lib/open-habitat/host"}
		if args[1] == "show" {
			if os.Geteuid() != 0 {
				return nil, hostError(host.ErrTrust)
			}
			site, e := host.LoadSite(path)
			if e != nil {
				return nil, hostError(e)
			}
			result["site"] = site
			result["site_source"] = "file"
			result["secrets"] = "protected_file_references_only"
		}
		return envelope(result), nil
	}
	// Parse the entire selector before reading any host file. Never echo rejected
	// values: a misplaced protected value might itself be a secret.
	if len(args) == 3 && args[0] == "operation" && args[1] == "show" {
		if !regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(args[2]) {
			return nil, usage("host operation show requires a 32-character lowercase hexadecimal operation ID")
		}
		o, e := host.ShowOperation(args[2])
		if errors.Is(e, os.ErrNotExist) {
			e = host.ErrNotFound
		}
		if e != nil {
			return nil, hostError(e)
		}
		return envelope(o), nil
	}
	if len(args) != 3 || (args[0] != "check" && args[0] != "plan") || args[1] != "--site" || !filepath.IsAbs(args[2]) || filepath.Clean(args[2]) != args[2] || args[2] == "/" {
		return nil, usage("expected host check|plan --site /absolute/site.json, or host operation show ID; no environment overrides, output files or mutation flags")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	if args[0] == "check" {
		r, e := host.Inspect(ctx, args[2])
		if e != nil {
			return nil, hostError(e)
		}
		if !r.Ready {
			return nil, hostBlocked("host_check_blocked", "host checks failed or are unavailable; inspect error.result.data.checks", r)
		}
		return envelope(r), nil
	}
	p, e := host.BuildPlan(ctx, args[2])
	if e != nil {
		return nil, hostError(e)
	}
	if !p.Approvable {
		return nil, hostBlocked("host_plan_blocked", "plan qualification is incomplete; inspect error.result.data; do not bypass unavailable checks", p)
	}
	return envelope(p), nil
}
func hostBlocked(code, message string, result any) *cliError {
	b, _ := json.Marshal(envelope(result))
	return &cliError{code: code, message: message, exit: 1, result: b}
}
func hostError(e error) *cliError {
	switch {
	case errors.Is(e, host.ErrEntryFence):
		return &cliError{code: "entry_fence_unavailable", message: "cannot durably confirm closed HTTP entry; keep external ingress closed and inspect operation and gateway state", exit: 2}
	case errors.Is(e, host.ErrNativeApply):
		return &cliError{code: "host_action_failed", message: "native installation action failed; inspect operation, entry_closure and service journals before continuing the same approved input", exit: 2}
	case errors.Is(e, host.ErrHomeMount):
		return &cliError{code: "home_mount_required", message: "require a separately mounted declared ext4 /home; no automatic formatting or migration", exit: 1}
	case errors.Is(e, host.ErrQuotaEnforcement):
		return &cliError{code: "quota_enforcement_required", message: "require journaled user quotas with kernel enforcement; customer offline feature work is never automatic", exit: 1}
	case errors.Is(e, host.ErrSessionPolicy):
		return &cliError{code: "session_policy_unavailable", message: "effective proc/logind/polkit policy unavailable; inspect the incomplete operation before retrying", exit: 1}
	case errors.Is(e, host.ErrPrepareBlocked):
		return &cliError{code: "host_prepare_blocked", message: "preparation prerequisites failed or are unavailable; inspect typed checks; incomplete operations require diagnosis", exit: 1}
	case errors.Is(e, host.ErrDisruptionApproval):
		return &cliError{code: "disruption_approval_required", message: "host prepare requires explicit --approve-disruption for a real run", exit: 1}
	case errors.Is(e, host.ErrImmutable):
		return &cliError{code: "immutable_identity_changed", message: "ordinary maintenance cannot migrate the initialized gateway or identity pool", exit: 1}
	case errors.Is(e, host.ErrStalePlan):
		return &cliError{code: "stale_plan", message: "host inputs differ from the approved observation; obtain and approve a new plan", exit: 1}
	case errors.Is(e, host.ErrApplyBlocked):
		return &cliError{code: "host_apply_blocked", message: "installation qualification is incomplete; inspect typed blockers and any operation evidence", exit: 1}
	case errors.Is(e, host.ErrBusy):
		return &cliError{code: "operation_busy", message: "another host operation holds the root lock", exit: 1}
	case errors.Is(e, host.ErrSite):
		return &cliError{code: "invalid_site", message: "site declaration is invalid; inspect site/schema.json", exit: 1}
	case errors.Is(e, host.ErrTrust):
		return &cliError{code: "unsafe_host_input", message: "require root-owned trusted parents and private regular files; run deliberate operator reads as root", exit: 1}
	case errors.Is(e, host.ErrNotFound):
		return &cliError{code: "operation_not_found", message: "no durable operation exists for that ID", exit: 1}
	case errors.Is(e, host.ErrUnstable):
		return &cliError{code: "observation_unstable", message: "host inputs changed during observation; re-run the read", exit: 1}
	case errors.Is(e, host.ErrRecovery):
		return &cliError{code: "recovery_required", message: "operation evidence is incomplete; inspect without automatic retry or repair", exit: 1}
	default:
		return system("host_observation_unavailable", "cannot safely observe the requested host input; verify its existence and trusted permissions")
	}
}
