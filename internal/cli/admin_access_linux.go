//go:build linux

package cli

import (
	"fmt"
	"strconv"
)

type controlAccessEntry struct {
	ID            string          `json:"id"`
	Source        string          `json:"source"`
	State         string          `json:"state"`
	Username      string          `json:"username,omitempty"`
	LoginHint     string          `json:"login_hint,omitempty"`
	Actor         string          `json:"actor,omitempty"`
	At            string          `json:"at,omitempty"`
	LastSeen      string          `json:"last_seen,omitempty"`
	Administrator bool            `json:"administrator"`
	Denied        bool            `json:"denied"`
	Onboarding    *controlReceipt `json:"onboarding,omitempty"`
}
type controlAccess struct {
	SchemaVersion    int                  `json:"schema_version"`
	Mode             string               `json:"mode"`
	RuntimeAdmission bool                 `json:"runtime_admission"`
	Entries          []controlAccessEntry `json:"entries"`
}

// accessRejections are the gateway's fixed access refusals: the caller can
// act on each (exit 1). outcome_uncertain and unavailability are system
// errors (exit 2), never an empty result or a success.
var accessRejections = map[string]string{
	"runtime_admission_disabled": "runtime admission is switched off; set identities.runtime_admission in site.json and run host apply, or admit the id in identities.admission",
	"runtime_admission_full":     "the runtime admission list already has 256 entries; withdraw someone or move people into site.json",
	"admission_open":             "this installation admits anyone (admission \"any\"); the access list has no effect",
	"operator_owned":             "this GitHub id is admitted by site.json identities.admission; remove it there and run host apply",
	"binding_drift":              "the id's committed account failed verification; inspect it with host check before restoring",
	"github_user_not_found":      "GitHub has no user with that login or id",
	"github_not_user":            "that GitHub account is an organisation or bot, not a person",
	"access_refused":             "the broker refused the access change",
}

func accessRejection(code string) (*cliError, bool) {
	if code == "operator_owned" {
		return usage(accessRejections[code]), true
	}
	if m, ok := accessRejections[code]; ok {
		return &cliError{code: code, message: m, exit: 1}, true
	}
	switch code {
	case "outcome_uncertain":
		return system("outcome_uncertain", "the change may or may not have taken effect; read admin access list before deciding to repeat it (nothing was retried)"), true
	case "github_lookup_unavailable":
		return system("github_lookup_unavailable", "GitHub's users API did not answer; nothing was changed"), true
	case "access_unavailable":
		return system("access_unavailable", "the access change could not be completed; inspect admin access list and gateway logs"), true
	}
	return nil, false
}

func readAccess() (controlAccess, error) {
	var v controlAccess
	if e := adminOperation("access_list", nil, &v); e != nil {
		return v, e
	}
	if v.SchemaVersion != 1 || v.Entries == nil || v.Mode != "allowlist" && v.Mode != "any" {
		return v, system("invalid_control_response", "gateway returned an invalid access list")
	}
	return v, nil
}

func accessEntryFor(v controlAccess, id string) *controlAccessEntry {
	for i := range v.Entries {
		if v.Entries[i].ID == id {
			return &v.Entries[i]
		}
	}
	return nil
}

func githubIDFlag(args []string, shape string) (string, bool, error) {
	id, dry := "", false
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--github-id":
			if id != "" || i+1 >= len(args) {
				return "", false, usage(shape)
			}
			i++
			id = args[i]
		case "--dry-run":
			if dry {
				return "", false, usage("--dry-run given twice")
			}
			dry = true
		default:
			return "", false, usage(fmt.Sprintf("unknown option %q; %s", args[i], shape))
		}
	}
	n, e := strconv.ParseUint(id, 10, 64)
	if e != nil || n == 0 || strconv.FormatUint(n, 10) != id {
		return "", false, usage(fmt.Sprintf("invalid --github-id %q; expected the positive decimal id admin access lookup prints; %s", id, shape))
	}
	return id, dry, nil
}

func adminAccessCommand(args []string) (any, error) {
	const shape = "expected admin access list [--state allowed|joined|withdrawn], admin access lookup --login <github-login>, admin access add --github-id <id> [--dry-run] or admin access remove --github-id <id> [--dry-run]"
	if len(args) == 0 {
		return nil, usage(shape)
	}
	switch args[0] {
	case "list":
		state := ""
		if len(args) == 3 && args[1] == "--state" && (args[2] == "allowed" || args[2] == "joined" || args[2] == "withdrawn") {
			state = args[2]
		} else if len(args) != 1 {
			return nil, usage("expected admin access list [--state allowed|joined|withdrawn]")
		}
		v, e := readAccess()
		if e != nil {
			return nil, e
		}
		if state != "" {
			kept := []controlAccessEntry{}
			for _, x := range v.Entries {
				if x.State == state {
					kept = append(kept, x)
				}
			}
			v.Entries = kept
		}
		return envelope(map[string]any{"mode": v.Mode, "runtime_admission": v.RuntimeAdmission, "entries": v.Entries, "count": len(v.Entries)}), nil
	case "lookup":
		if len(args) != 3 || args[1] != "--login" {
			return nil, usage("expected admin access lookup --login <github-login>")
		}
		var user struct {
			ID    string `json:"id"`
			Login string `json:"login"`
			Name  string `json:"name"`
			Type  string `json:"type"`
		}
		if e := adminOperation("access_lookup", map[string]any{"login": args[2]}, &user); e != nil {
			return nil, e
		}
		if user.ID == "" || user.Login == "" {
			return nil, system("invalid_control_response", "gateway returned an invalid GitHub account")
		}
		return envelope(user), nil
	case "add", "remove":
		id, dry, e := githubIDFlag(args[1:], "expected admin access "+args[0]+" --github-id <id> [--dry-run]")
		if e != nil {
			return nil, e
		}
		v, e := readAccess()
		if e != nil {
			return nil, e
		}
		current := accessEntryFor(v, id)
		if v.Mode == "any" {
			c, _ := accessRejection("admission_open")
			return nil, c
		}
		if args[0] == "remove" && current != nil && current.Source == "operator" {
			c, _ := accessRejection("operator_owned")
			return nil, c
		}
		if dry {
			return accessDryRun(args[0], id, v, current)
		}
		operation := "access_add"
		if args[0] == "remove" {
			operation = "access_remove"
		}
		var row controlAccessEntry
		if e = adminOperation(operation, map[string]any{"subject": id}, &row); e != nil {
			return nil, e
		}
		if row.ID != id {
			return nil, system("invalid_control_response", "gateway returned an access entry for another id")
		}
		return envelope(map[string]any{"entry": row, "updated": true}), nil
	}
	return nil, usage(shape)
}

// accessDryRun reports what add or remove would do from the current list.
// The gateway rereads everything at commit; only the broker's reply is the
// outcome.
func accessDryRun(verb, id string, v controlAccess, current *controlAccessEntry) (any, error) {
	effects := map[string]any{"current": current, "runtime_admission": v.RuntimeAdmission}
	unknown := []string{"broker_state_at_commit"}
	if verb == "add" {
		if current != nil && current.Source == "none" {
			current = nil
		}
		switch {
		case current != nil && current.Source == "operator":
			effects["effect"] = "already admitted by site.json"
		case current != nil && current.State != "withdrawn":
			effects["effect"] = "already admitted"
		case !v.RuntimeAdmission:
			c, _ := accessRejection("runtime_admission_disabled")
			return nil, c
		case current != nil:
			effects["effect"] = "restore to " + current.Username
			effects["restore_to"] = current.Username
			unknown = append(unknown, "binding_verification")
		default:
			// A bound id that neither source admits returns to its account.
			var users []controlUser
			if e := adminOperation("users", nil, &users); e != nil {
				return nil, e
			}
			effects["effect"] = "admit; the account is created at the person's first sign-in"
			for _, u := range users {
				if u.ID == id {
					effects["effect"] = "restore to " + u.Username
					effects["restore_to"] = u.Username
					unknown = append(unknown, "binding_verification")
				}
			}
			unknown = append(unknown, "github_account")
		}
		if current != nil && current.Denied {
			effects["ends_sessions"] = "leftover sessions from before the withdrawal are removed"
		}
	} else {
		switch {
		case current == nil:
			effects["effect"] = "nothing to withdraw"
		case current.State == "withdrawn":
			effects["effect"] = "already withdrawn"
		case current.Username != "":
			effects["effect"] = "withdraw web access; the Unix account " + current.Username + ", its files, SSH and processes stay"
			effects["ends_sessions"] = "every browser session, terminal and editor of this person ends"
		default:
			effects["effect"] = "remove the never-used admission; nothing remains"
		}
	}
	return envelope(map[string]any{"dry_run": true, "would": []any{map[string]any{"action": verb, "resource": "site-access", "input": map[string]any{"github_id": id}, "known_effects": effects, "unknown_until_apply": unknown}}}), nil
}
