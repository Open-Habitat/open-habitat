//go:build linux

package cli

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/daemon"
)

type workspaceCommandSpec struct {
	key, action, flags, required, description, example string
}

// The same table supplies parsing and drill-down help; flags never silently
// bleed from one destruction operation to another.
var workspaceCommandSpecs = []workspaceCommandSpec{
	{"workspace show", "", "--workspace --deletion", "--workspace", "Read a workspace and its observation, optionally deletion safety", "workspace show --workspace ws_example123"},
	{"workspace create", "create", "--name --display-name --git --user-observation-token --dry-run", "--name --user-observation-token", "Create with the source observation from workspace list", "workspace create --name example --user-observation-token obs_example"},
	{"workspace update", "settings", "--workspace --display-name --hidden --observation-token --dry-run", "--workspace --observation-token", "Change display name or visibility using a fresh workspace observation", "workspace update --workspace ws_example123 --display-name Example --observation-token obs_example"},
	{"workspace delete", "delete", "--workspace --observation-token --disposal --dry-run", "--workspace --observation-token --disposal", "Trash a workspace or delete only a verified clean pushed clone", "workspace delete --workspace ws_example123 --observation-token obs_example --disposal trash"},
	{"worktree list", "worktree_list", "--workspace --output", "", "Observe native worktree registry and safety tokens", "worktree list --output worktrees.jsonl"},
	{"worktree delete", "worktree_remove", "--workspace --entry --observation-token --disposal --confirmation --merged-only --listing-token --dry-run", "", "Remove one observed worktree or exactly a merged listing", "worktree delete --workspace ws_example123 --entry example --observation-token wt_example --disposal remove"},
	{"trash list", "trash_list", "--output", "", "List own Trash and listing token", "trash list --output trash.jsonl"},
	{"trash show", "trash_inspect", "--entry", "--entry", "Inspect one own Trash entry", "trash show --entry example"},
	{"trash restore", "trash_restore", "--entry --dry-run", "--entry", "Restore without overwriting a workspace", "trash restore --entry example"},
	{"trash delete", "trash_delete", "--entry --confirmation --all --listing-token --dry-run", "", "Permanently delete a typed entry or an exact Trash listing", "trash delete --entry example --confirmation example"},
	{"repository list", "", "--output", "", "Read the native gh repository catalog", "repository list --output repositories.jsonl"},
	{"repository show", "", "--repository --checkout", "--repository", "Read one exact GitHub repository", "repository show --repository example/project"},
	{"clone list", "", "--output", "", "Read clone jobs and interrupted destinations", "clone list"},
	{"clone show", "", "--job", "--job", "Read one clone job without starting or replaying it", "clone show --job 00000000000000000000000000000001"},
	{"clone create", "start", "--repository --mode --dry-run", "--repository --mode", "Start a native clone job; inspect clone list after a lost reply", "clone create --repository example/project --mode blobless"},
	{"clone restart", "restart", "--repository --mode --dry-run", "--repository --mode", "Explicitly remove and restart an interrupted clone", "clone restart --repository example/project --mode full"},
	{"clone stop", "cancel", "--job --dry-run", "--job", "Cancel a running clone job and clean its destination", "clone stop --job 00000000000000000000000000000001"},
	{"clone delete", "dismiss", "--job --repository --interrupted-only --dry-run", "", "Dismiss a finished job or remove an interrupted destination", "clone delete --repository example/project --interrupted-only"},
}

var repositoryCLIName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$`)
var cloneCLIJob = regexp.MustCompile(`^[0-9a-f]{32}$`)

func parseWorkspaceRequest(args []string) (conversationRequest, error) {
	req := conversationRequest{method: "POST", path: daemon.AgentWorkspaceOperationsPath}
	if len(args) < 2 {
		return req, usage("expected resource and verb; inspect agent --help")
	}
	key := args[0] + " " + args[1]
	var spec *workspaceCommandSpec
	for i := range workspaceCommandSpecs {
		if workspaceCommandSpecs[i].key == key {
			spec = &workspaceCommandSpecs[i]
			break
		}
	}
	if spec == nil {
		return req, usage(fmt.Sprintf("unknown agent command %q; inspect agent --help", key))
	}
	values := map[string]string{}
	for i := 2; i < len(args); i++ {
		flag := args[i]
		if !strings.Contains(" "+spec.flags+" ", " "+flag+" ") {
			return req, usage(fmt.Sprintf("unknown flag %q for %s", flag, key))
		}
		if _, ok := values[flag]; ok {
			return req, usage("duplicate " + flag)
		}
		switch flag {
		case "--dry-run", "--deletion", "--checkout", "--merged-only", "--all", "--interrupted-only":
			values[flag] = "true"
			continue
		}
		i++
		if i == len(args) {
			return req, usage("missing value for " + flag)
		}
		v := args[i]
		if v == "" && !(flag == "--display-name" && key == "workspace update") || strings.TrimSpace(v) != v || !utf8.ValidString(v) || strings.ContainsAny(v, "\x00\r\n") {
			return req, usage("invalid value for " + flag)
		}
		values[flag] = v
	}
	for _, flag := range strings.Fields(spec.required) {
		if _, ok := values[flag]; !ok {
			return req, usage("required " + flag)
		}
	}
	for flag, v := range values {
		valid := true
		switch flag {
		case "--workspace":
			valid = workspacePattern.MatchString(v)
		case "--repository":
			valid = repositoryCLIName.MatchString(v) && !strings.HasSuffix(v, "/.") && !strings.HasSuffix(v, "/..")
		case "--job":
			valid = cloneCLIJob.MatchString(v)
		case "--name":
			valid = len(v) <= 255 && !strings.HasPrefix(v, "-") && v != "." && v != ".." && !strings.HasPrefix(v, ".") && !strings.ContainsAny(v, "/\\")
		case "--entry":
			valid = len(v) <= 255 && v != "." && v != ".." && !strings.ContainsAny(v, "/\\")
		case "--display-name", "--confirmation":
			valid = len(v) <= 255
		case "--git", "--hidden":
			valid = v == "true" || v == "false"
		case "--mode":
			valid = v == "full" || v == "blobless"
		case "--observation-token", "--user-observation-token", "--listing-token":
			valid = len(v) >= 8 && len(v) <= 200
		case "--output":
			valid = strings.HasSuffix(v, ".jsonl")
		}
		if !valid {
			if flag == "--repository" {
				return req, usage("invalid --repository; expected owner/repo, never a remote URL or credentials")
			}
			return req, usage(fmt.Sprintf("invalid %s %q; inspect %s --help", flag, v, key))
		}
	}
	body := map[string]any{}
	if spec.action != "" {
		body["action"] = spec.action
	}
	fields := map[string]string{"--workspace": "workspace_id", "--name": "name", "--display-name": "display_name", "--observation-token": "observation_token", "--user-observation-token": "user_observation_token", "--listing-token": "listing_token", "--entry": "entry", "--confirmation": "confirmation", "--disposal": "disposal", "--repository": "full_name", "--mode": "mode", "--job": "job_id"}
	for flag, field := range fields {
		if v, ok := values[flag]; ok {
			body[field] = v
		}
	}
	for _, flag := range []string{"--git", "--hidden"} {
		if v, ok := values[flag]; ok {
			body[strings.TrimPrefix(flag, "--")] = v == "true"
		}
	}
	switch key {
	case "workspace show":
		req.method = "GET"
		req.path = daemon.AgentWorkspacesPath
	case "workspace create":
		if _, ok := body["git"]; !ok {
			body["git"] = false
		}
	case "workspace update":
		_, display := values["--display-name"]
		_, hidden := values["--hidden"]
		if display == hidden {
			return req, usage("supply exactly one of --display-name or --hidden")
		}
		if hidden {
			body["action"] = "visibility"
		}
	case "workspace delete":
		if values["--disposal"] != "trash" && values["--disposal"] != "permanent" {
			return req, usage("--disposal must be trash or permanent")
		}
	case "worktree delete":
		if values["--merged-only"] != "" {
			if values["--listing-token"] == "" || values["--entry"] != "" || values["--disposal"] != "" || values["--observation-token"] != "" || values["--confirmation"] != "" {
				return req, usage("--merged-only requires --listing-token and forbids single-entry flags")
			}
			body["action"] = "worktree_clean_merged"
		} else {
			for _, flag := range []string{"--workspace", "--entry", "--observation-token", "--disposal"} {
				if values[flag] == "" {
					return req, usage("required " + flag)
				}
			}
			disposal := values["--disposal"]
			if !strings.Contains(" remove commit force prune ", " "+disposal+" ") || values["--listing-token"] != "" {
				return req, usage("--disposal must be remove, commit, force or prune; listing token is bulk-only")
			}
			if (disposal == "force") != (values["--confirmation"] != "") {
				return req, usage("force requires typed --confirmation; other disposals forbid it")
			}
		}
	case "trash delete":
		if values["--all"] != "" {
			if values["--listing-token"] == "" || values["--entry"] != "" || values["--confirmation"] != "" {
				return req, usage("--all requires --listing-token and forbids entry/confirmation")
			}
			body["action"] = "trash_empty"
		} else if values["--entry"] == "" || values["--confirmation"] == "" || values["--listing-token"] != "" {
			return req, usage("single Trash deletion requires --entry and typed --confirmation; listing token is bulk-only")
		}
	case "repository list":
		req.method = "GET"
		req.path = daemon.AgentRepositoriesPath
	case "repository show":
		req.method = "GET"
		req.path = daemon.AgentRepositoryPath
		if values["--checkout"] != "" {
			req.path = daemon.AgentCheckoutPath
		}
		req.path += "?full_name=" + url.QueryEscape(values["--repository"])
	}
	if args[0] == "clone" {
		req.path = daemon.AgentClonesPath
		if key == "clone list" || key == "clone show" {
			req.method = "GET"
		}
		if key == "clone delete" {
			if values["--interrupted-only"] != "" {
				if values["--repository"] == "" || values["--job"] != "" {
					return req, usage("--interrupted-only requires --repository and forbids --job")
				}
				body["action"] = "remove"
			} else if values["--job"] == "" || values["--repository"] != "" {
				return req, usage("dismiss requires --job; destination removal requires --repository --interrupted-only")
			}
		}
	}
	if values["--dry-run"] != "" {
		return req, &cliError{code: "dry_run_unsupported", message: "native safety state cannot be reserved; inspect workspace show --deletion, worktree list, trash show or repository show --checkout before an explicit write", exit: 1}
	}
	req.output = values["--output"]
	if req.method == "POST" {
		req.body, _ = json.Marshal(body)
		if len(req.body) > 2048 {
			return req, usage("workspace request exceeds 2048 encoded bytes")
		}
	}
	return req, nil
}

func agentWorkspaceCommand(args []string) (any, error) {
	req, err := parseWorkspaceRequest(args)
	if err != nil {
		return nil, err
	}
	data, err := exchangeAgentBody(req.method, req.path, req.body)
	if err != nil {
		return nil, err
	}
	key := args[0] + " " + args[1]
	if key == "clone show" {
		var list struct {
			Jobs []map[string]any `json:"jobs"`
		}
		if json.Unmarshal(data, &list) != nil {
			return nil, system("invalid_agent_response", "invalid clone jobs")
		}
		var target map[string]any
		for _, j := range list.Jobs {
			if j["job_id"] == flagValue(args, "--job") {
				target = j
				break
			}
		}
		if target == nil {
			return nil, &cliError{code: "clone_job_missing", message: "job is absent from the daemon; observe repository checkout state before further work", exit: 1}
		}
		data, _ = json.Marshal(map[string]any{"schema_version": 1, "job": target})
	}
	if key == "workspace show" {
		var list struct {
			Workspaces []map[string]any `json:"workspaces"`
		}
		if json.Unmarshal(data, &list) != nil {
			return nil, system("invalid_agent_response", "invalid workspace observation")
		}
		var target map[string]any
		for _, w := range list.Workspaces {
			if w["workspace_id"] == flagValue(args, "--workspace") {
				target = w
				break
			}
		}
		if target == nil {
			return nil, &cliError{code: "workspace_missing", message: "workspace is absent from the current native listing", exit: 1}
		}
		if hasWorkspaceFlag(args, "--deletion") {
			body, _ := json.Marshal(map[string]any{"action": "delete_check", "workspace_id": target["workspace_id"], "observation_token": target["observation_token"]})
			data, err = exchangeAgentBody("POST", daemon.AgentWorkspaceOperationsPath, body)
			if err != nil {
				return nil, err
			}
		} else {
			data, _ = json.Marshal(map[string]any{"schema_version": 1, "workspace": target})
		}
	}
	if req.method == "POST" {
		if err := workspaceOperationError(key, data); err != nil {
			return nil, err
		}
	}
	if req.output != "" {
		var wire map[string]json.RawMessage
		if json.Unmarshal(data, &wire) != nil {
			return nil, system("invalid_agent_response", "invalid list")
		}
		field := map[string]string{"worktree list": "worktrees", "trash list": "entries", "repository list": "repositories", "clone list": "jobs"}[key]
		var rows []map[string]any
		if json.Unmarshal(wire[field], &rows) != nil {
			return nil, system("invalid_agent_response", "invalid list rows")
		}
		// Preserve listing tokens, completeness and interrupted destinations alongside
		// rows; exporting only the rows would discard the safety observation.
		metadata := map[string]any{"record_type": "observation"}
		for k, v := range wire {
			if k != field {
				metadata[k] = v
			}
		}
		rows = append([]map[string]any{metadata}, rows...)
		return writeRowsOutput(req.output, rows)
	}
	result := envelope(map[string]any{"cli_version": version, "result": data})
	if req.method == "POST" {
		result["warnings"] = []string{"Never automatically replay an uncertain write. Inspect native state; observation tokens are not reservations or approvals."}
	}
	return result, nil
}

func workspaceOperationError(key string, data json.RawMessage) error {
	var wire struct {
		State      string            `json:"state"`
		Kept       []json.RawMessage `json:"kept"`
		KeptReason string            `json:"kept_reason"`
		Job        struct {
			State    string `json:"state"`
			Leftover string `json:"leftover"`
		} `json:"job"`
	}
	if json.Unmarshal(data, &wire) != nil {
		return system("invalid_agent_response", "invalid operation result")
	}
	if wire.State == "partial" || wire.State == "blocked" || wire.State == "replaced" || wire.Job.State == "failed" || len(wire.Kept) > 0 || wire.KeptReason != "" || (key == "clone stop" && (wire.Job.State == "running" || wire.Job.Leftover == "kept")) {
		return &cliError{code: "native_operation_incomplete", message: "native operation was blocked, changed or only partly completed; inspect current state before any further write", exit: 1, result: data}
	}
	return nil
}

func flagValue(args []string, flag string) string {
	for i := 0; i+1 < len(args); i++ {
		if args[i] == flag {
			return args[i+1]
		}
	}
	return ""
}

func hasWorkspaceFlag(args []string, flag string) bool {
	for _, a := range args {
		if a == flag {
			return true
		}
	}
	return false
}
