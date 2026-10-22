package cli

import (
	"fmt"
	"sort"
	"strings"
)

type helpSpec struct {
	path, description, example string
	flags                      []string
}

var helpSpecs = []helpSpec{
	{"host check", "Read-only site/host checks; blocked exit 1 has error.result.data; unavailable is not pass", "host check --site /etc/open-habitat/site.json --json", []string{"--site"}},
	{"host plan", "Read-only observation fingerprint and typed qualification blockers; currently non-approvable", "host plan --site /etc/open-habitat/site.json --json", []string{"--site"}},
	{"host apply", "Validate approval and qualification without bypasses; currently always blocked, no activation; live form requires --approved-plan and --output=jsonl (not --json)", "host apply --site /etc/open-habitat/site.json --dry-run --json", []string{"--site", "--approved-plan", "--dry-run", "--output=jsonl"}},
	{"host prepare", "Inspect preparation requirements; always blocked, no quota writes, restarts or activation; real form requires --approved-plan, --approve-disruption and --output=jsonl", "host prepare --site /etc/open-habitat/site.json --dry-run --json", []string{"--site", "--approved-plan", "--approve-disruption", "--dry-run", "--output=jsonl"}},
	{"host operation show", "Read root-only durable phase intent, not proof of host action completion", "host operation show 00000000000000000000000000000001 --json", nil},
	{"agent history list", "Discover native histories, or read/export one explicit conversation", "agent history list --output histories.jsonl --json", []string{"--conversation", "--output"}},
	{"agent history-block show", "Read a revision-bound block; export all remaining chunks to JSONL", "agent history-block show --conversation pi:00000000-0000-4000-8000-000000000001 --entry entry1 --block 0 --revision rev_example --output block.jsonl --json", []string{"--conversation", "--entry", "--block", "--revision", "--offset", "--output"}},
	{"agent receipt show", "Read the original command acknowledgement, not turn completion", "agent receipt show --conversation pi:00000000-0000-4000-8000-000000000001 --command 00000000-0000-4000-8000-000000000002 --json", []string{"--conversation", "--command"}},
	{"agent process list", "Read owned process inventory and owner-generation/token fences", "agent process list --conversation pi:00000000-0000-4000-8000-000000000001 --output processes.jsonl --json", []string{"--conversation", "--output"}},
	{"agent process show", "Read a selected process output tail with both ownership fences", "agent process show --conversation pi:00000000-0000-4000-8000-000000000001 --process proc_abcd --owner-generation GENERATION --process-token pt_1000 --output output.jsonl --json", []string{"--conversation", "--process", "--owner-generation", "--process-token", "--tail-lines", "--output"}},
	{"agent process stop", "Stop exactly the selected process; --force requests immediate kill", "agent process stop --conversation pi:00000000-0000-4000-8000-000000000001 --process proc_abcd --owner-generation GENERATION --process-token pt_1000 --json", []string{"--conversation", "--process", "--owner-generation", "--process-token", "--force", "--dry-run"}},
	{"agent process delete", "Clear only finished process records of the selected owner generation", "agent process delete --conversation pi:00000000-0000-4000-8000-000000000001 --owner-generation GENERATION --finished-only --json", []string{"--conversation", "--owner-generation", "--finished-only", "--dry-run"}},
	{"agent attachment create", "Register bytes in the native attachments directory (1..20 MiB)", "agent attachment create --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent attachment show", "Download registered bytes into a private new file, never inline", "agent attachment show --attachment 00000000-0000-4000-8000-000000000001 --output image.png --json", []string{"--attachment", "--output"}},

	{"agent integration list", "Read native accounts and sync state; no login tokens", "agent integration list --json", nil},
	{"agent question answer", "Answer the observed pending native question; protected JSON: request_id, value (boolean or string)", "agent question answer --conversation pi:00000000-0000-4000-8000-000000000001 --input-file - --json", []string{"--conversation", "--input-file", "--dry-run"}},
	{"agent question cancel", "Cancel the observed native question; protected JSON: request_id; delivery remains uncertain", "agent question cancel --conversation pi:00000000-0000-4000-8000-000000000001 --input-file - --json", []string{"--conversation", "--input-file", "--dry-run"}},
	{"agent integration-login create", "Start own-UID OAuth; JSON: provider, optional existing address; give URL/device code to the person", "agent integration-login create --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent integration-login show", "Observe own-UID OAuth attempt, never a browser lease", "agent integration-login show --json", nil},
	{"agent integration-login update", "Submit protected JSON: attempt_id and either redirect_url (loopback) or folders (IDs)", "agent integration-login update --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent integration-login delete", "Cancel own-UID OAuth; protected JSON: attempt_id; not grant revocation", "agent integration-login delete --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent pi-login create", "Start native Pi device login; give URL and device code to the person, never handle their password", "agent pi-login create --json", []string{"--dry-run"}},
	{"agent pi-login show", "Observe the exact own-UID Pi attempt from create", "agent pi-login show --attempt 00000000000000000000000000000001 --json", []string{"--attempt"}},
	{"agent pi-login delete", "Cancel the exact own-UID Pi attempt; not logout", "agent pi-login delete --attempt 00000000000000000000000000000001 --json", []string{"--attempt", "--dry-run"}},
	{"agent claude-login create", "Start native Claude subscription login; give browser URL to the person", "agent claude-login create --json", []string{"--dry-run"}},
	{"agent claude-login show", "Read own-UID Claude attempt or native subscription presence", "agent claude-login show --json", nil},
	{"agent claude-login update", "Submit one-time Claude code through protected JSON: attempt_id, code", "agent claude-login update --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent claude-login delete", "Cancel own-UID Claude attempt through protected JSON: attempt_id; not logout", "agent claude-login delete --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent integration-account create", "Connect a password account using protected integration-account JSON, excluding action", "agent integration-account create --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent integration-account update", "Change a password using protected JSON: provider, address, password", "agent integration-account update --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent integration-account delete", "Remove native account using protected JSON: provider, address, delete_directories (Trash when true)", "agent integration-account delete --input-file - --json", []string{"--input-file", "--dry-run"}},
	{"agent credential list", "Read Pi credential presence, never keys or references", "agent credential list --json", nil},
	{"agent credential update", "Save a literal OpenAI API key from protected raw input; not argv or environment", "agent credential update --secret-file - --json", []string{"--secret-file", "--dry-run"}},
	{"agent credential delete", "Remove the OpenAI API key from native Pi auth; subscriptions unchanged", "agent credential delete --json", []string{"--dry-run"}},
	{"agent conversation list", "List live daemon handles without starting Pi", "agent conversation list --output conversations.jsonl --json", []string{"--output"}},
	{"agent conversation create", "Start a conversation; lost replies are uncertain, inspect list before acting", "agent conversation create --workspace ws_example123 --json", []string{"--workspace", "--provider", "--model", "--thinking", "--worktree", "--dry-run"}},
	{"agent conversation resume", "Resume after the existing native ownership and one-writer proof", "agent conversation resume --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation", "--dry-run"}},
	{"agent conversation stop", "Stop the daemon-owned Pi, not its detached tools", "agent conversation stop --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation", "--dry-run"}},
	{"agent conversation delete", "Close only a fresh empty daemon-owned conversation", "agent conversation delete --conversation pi:00000000-0000-4000-8000-000000000001 --empty-only --json", []string{"--conversation", "--empty-only", "--dry-run"}},
	{"agent conversation update", "Change archive annotation using an explicit fresh observation", "agent conversation update --conversation pi:00000000-0000-4000-8000-000000000001 --workspace ws_example123 --archived true --previous-archive active --observation-token obs_example --json", []string{"--conversation", "--workspace", "--archived", "--previous-archive", "--observation-token", "--dry-run"}},
	{"agent archive show", "Read the native archive state and freshness token", "agent archive show --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation"}},
	{"agent continuation show", "Read native continuation eligibility without starting Pi", "agent continuation show --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation"}},
	{"agent message create", "Send, steer or follow up on an explicit own conversation", "agent message create --conversation pi:00000000-0000-4000-8000-000000000001 --idempotency-key 00000000-0000-4000-8000-000000000002 --text-file - --json", []string{"--conversation", "--idempotency-key", "--text-file", "--delivery", "--dry-run"}},
	{"agent queue show", "Read status including queued and held messages", "agent queue show --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation"}},
	{"agent queue delete", "Clear the native queue or cancel held messages with --held", "agent queue delete --conversation pi:00000000-0000-4000-8000-000000000001 --idempotency-key 00000000-0000-4000-8000-000000000002 --json", []string{"--conversation", "--idempotency-key", "--held", "--dry-run"}},
	{"agent turn interrupt", "Interrupt the active turn without stopping Pi", "agent turn interrupt --conversation pi:00000000-0000-4000-8000-000000000001 --idempotency-key 00000000-0000-4000-8000-000000000002 --json", []string{"--conversation", "--idempotency-key", "--dry-run"}},
	{"agent title create", "Generate a native title; --workspace selects settled history naming", "agent title create --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation", "--workspace", "--dry-run"}},
	{"agent recap show", "Read the latest native recap", "agent recap show --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation"}},
	{"agent recap create", "Generate a native recap; inspect recap show after an uncertain reply", "agent recap create --conversation pi:00000000-0000-4000-8000-000000000001 --json", []string{"--conversation", "--dry-run"}},
	{"agent model list", "Read native Pi catalog and global defaults without starting Pi", "agent model list --json", nil},
	{"agent model update", "Select global defaults for future conversations; omitted thinking is preserved", "agent model update --provider openai-codex --model gpt-5.5 --thinking medium --json", []string{"--provider", "--model", "--thinking", "--dry-run"}},
	{"version", "Show binary and skill provenance", "version --json", nil},
	{"config path", "Locate personal native settings (or explicit operator component)", "config path --json", []string{"--component"}},
	{"config show", "Inspect non-secret configuration and sources", "config show --json", []string{"--component"}},
	{"doctor", "Check personal settings and socket (or explicit operator component)", "doctor --json", []string{"--component"}},
	{"gateway exec", "Run the gateway service", "gateway exec --config /etc/open-habitat/gateway.json --verbose", []string{"--config"}},
	{"daemon exec", "Run the per-user daemon with both activated sockets", "daemon exec --config /etc/open-habitat/daemon.json --verbose", []string{"--config"}},
	{"broker exec", "Run the root provisioning broker", "broker exec --verbose", nil},
	{"admin readiness show", "Inspect privileged readiness", "admin readiness show --json", nil},
	{"admin settings show", "Inspect host settings", "admin settings show --json", nil},
	{"admin settings update", "Update host name or default quota", "admin settings update --name Example --dry-run --json", []string{"--name", "--default-limit-bytes", "--dry-run"}},
	{"admin users list", "List bound host users", "admin users list --json", nil},
	{"admin role update", "Update a subject's administrator role", "admin role update 123 --administrator true --dry-run --json", []string{"--administrator", "--dry-run"}},
	{"admin storage list", "Inspect host user quotas", "admin storage list --json", nil},
	{"admin storage update", "Update a subject's hard quota", "admin storage update 123 --limit-bytes 1073741824 --dry-run --json", []string{"--limit-bytes", "--dry-run"}},
	{"maintenance enter", "Enter maintenance", "maintenance enter --idempotency-key example --dry-run --json", []string{"--idempotency-key", "--dry-run"}},
	{"maintenance leave", "Leave maintenance", "maintenance leave --idempotency-key example --dry-run --json", []string{"--idempotency-key", "--dry-run"}},
	{"revoke subject", "Revoke a bound subject as root", "revoke subject 123 --json", nil},
	{"skill list", "List version-matched companion skills", "skill list --json", nil},
	{"skill print", "Read a bundled skill without installing", "skill print agent --json", nil},
	{"skill install", "Install operator or agent skill to native runtime layouts", "skill install agent --target ./skills-example --dry-run --json", []string{"--agent", "--target", "--dry-run", "--force"}},
	{"agent notice create", "Send an agent notice through the native conversation writer; persistence is explicit", "agent notice create --current --text Blocked --idempotency-key 00000000-0000-4000-8000-000000000001 --json", []string{"--conversation", "--current", "--text", "--text-file", "--idempotency-key", "--dry-run"}},
	{"agent notice list", "Read the latest 200 native conversation notices", "agent notice list --current --json", []string{"--conversation", "--current", "--output"}},
	{"agent environment show", "Read own quota, capacity and daemon version", "agent environment show --json", nil},
	{"agent workspace list", "Discover native workspaces", "agent workspace list --json", []string{"--output"}},
	{"agent conversation show", "Read an explicit live record or verified inherited context", "agent conversation show --current --json", []string{"--current", "--conversation"}},
}

func init() {
	for _, spec := range workspaceCommandSpecs {
		helpSpecs = append(helpSpecs, helpSpec{"agent " + spec.key, spec.description, "agent " + spec.example + " --json", strings.Fields(spec.flags)})
	}
}

func helpRequested(args []string) bool {
	for _, a := range args {
		if a == "--help" || a == "-h" || a == "help" {
			return true
		}
	}
	return false
}
func commandHelp(args []string) (any, error) {
	path := []string{}
	for _, a := range args {
		if a == "--help" || a == "-h" || a == "help" {
			continue
		}
		path = append(path, a)
	}
	key := strings.Join(path, " ")
	matches := []helpSpec{}
	children := map[string]bool{}
	var exact *helpSpec
	for _, spec := range helpSpecs {
		if key == spec.path {
			v := spec
			exact = &v
		}
		if key == "" || spec.path == key || strings.HasPrefix(spec.path, key+" ") {
			matches = append(matches, spec)
			suffix := strings.TrimSpace(strings.TrimPrefix(spec.path, key))
			if suffix != "" {
				children[strings.Fields(suffix)[0]] = true
			}
		}
	}
	if len(matches) == 0 {
		return nil, usage(fmt.Sprintf("unknown help command path %q", key))
	}
	subs := []string{}
	for s := range children {
		subs = append(subs, s)
	}
	sort.Strings(subs)
	flags := []any{helpFlag("--json"), helpFlag("--verbose"), helpFlag("--help")}
	if key == "" {
		flags = append(flags, helpFlag("--version"))
	}
	examples := []any{}
	for _, spec := range matches {
		examples = append(examples, map[string]any{"description": spec.description, "argv": append([]string{"open-habitat"}, strings.Fields(spec.example)...)})
	}
	description := "Open Habitat: personal agent operations and explicit operator services"
	if exact != nil {
		description = exact.description
		for _, f := range exact.flags {
			flags = append(flags, helpFlag(f))
		}
	}
	arguments := []any{}
	switch key {
	case "host operation show":
		arguments = append(arguments, map[string]any{"name": "operation_id", "required": true, "description": "Exact 32-character lowercase hexadecimal durable operation ID"})
	case "agent conversation show":
		arguments = append(arguments, map[string]any{"name": "pi:UUID", "required": false, "description": "Explicit live controller record; mutually exclusive with --current"})
	case "skill print", "skill install":
		arguments = append(arguments, map[string]any{"name": "name", "required": true, "possible_values": []string{"operator", "agent"}})
	case "admin role update", "admin storage update", "revoke subject":
		arguments = append(arguments, map[string]any{"name": "subject", "required": true, "description": "Canonical positive decimal GitHub subject"})
	}
	return envelope(map[string]any{"name": "open-habitat", "command_path": append([]string{"open-habitat"}, path...), "description": description, "subcommands": subs, "flags": flags, "args": arguments, "examples": examples, "exit_codes": map[string]string{"0": "success (including help/version)", "1": "caller or domain error", "2": "system or internal error", "130": "SIGINT", "143": "SIGTERM"}}), nil
}
func helpFlag(name string) map[string]any {
	v := map[string]any{"long": name, "description": name, "default": nil, "env": nil, "possible_values": []string{}, "deprecated": false}
	switch name {
	case "--approved-plan":
		v["description"] = "Exact current 64-character lowercase observation plan ID; required without --dry-run; never bypasses qualification; stale IDs are refused"
	case "--output=jsonl":
		v["description"] = "Versioned stdout progress and exactly one terminal event; required for non-dry apply, mutually exclusive with --json"
	case "--site":
		v["description"] = "Required absolute strict version-1 site file; source=flag; root-owned private regular file, trusted parents; no environment/includes/overrides"
	case "--owner-generation":
		v["description"] = "Exact owner_generation from process list, not a conversation ID"
	case "--process-token":
		v["description"] = "Exact process_token from the selected process list row; never reuse after a record changes"
	case "--process":
		v["description"] = "Selected native proc_ ID; owner generation and process token are also required"
	case "--tail-lines":
		v["description"] = "Output tail length, 1..2000"
		v["default"] = 100
	case "--offset":
		v["description"] = "Block byte/base64 offset (0..512 MiB)"
		v["default"] = 0
	case "--block":
		v["description"] = "Zero-based history block index, 0..127; required"
	case "--revision":
		v["description"] = "Native revision from the history entry; changed revisions refuse block reads"
	case "--command":
		v["description"] = "Original message command UUID; acknowledgement is not turn completion"
	case "--attachment":
		v["description"] = "Registered attachment UUID; binary downloads require --output"
	case "--workspace":
		v["description"] = "Explicit own ws_ ID from workspace list; required for creation/archive and settled-history title generation"
	case "--name":
		v["description"] = "Workspace directory name beneath native src; 1–255 UTF-8 bytes, no slash/control characters or leading dot/hyphen"
	case "--display-name":
		v["description"] = "Display override up to 255 UTF-8 bytes; update accepts empty string to clear it"
	case "--entry":
		v["description"] = "Exact history entry key, registry entry or Trash entry from its matching observation, never a path"
	case "--repository":
		v["description"] = "Exact GitHub owner/repo, never a URL or credentials"
	case "--job":
		v["description"] = "Exact 32-character lowercase hexadecimal clone job ID from clone create/list"
	case "--deletion":
		v["description"] = "Read native deletion checks without removing anything; not a reservation"
		v["default"] = false
	case "--checkout":
		v["description"] = "Observe the local import destination rather than remote repository metadata"
		v["default"] = false
	case "--merged-only":
		v["description"] = "Remove only the exact merged set named by --listing-token; forbids single-entry flags"
		v["default"] = false
	case "--all":
		v["description"] = "Empty only the exact Trash set named by --listing-token; forbids entry/confirmation"
		v["default"] = false
	case "--interrupted-only":
		v["description"] = "Explicitly remove the interrupted --repository destination; forbids --job"
		v["default"] = false
	case "--mode":
		v["possible_values"] = []string{"full", "blobless"}
	case "--disposal":
		v["description"] = "Workspace: trash|permanent; worktree: remove|commit|force|prune"
	case "--confirmation":
		v["description"] = "Exact typed name for permanent Trash deletion or forced worktree removal"
	case "--listing-token", "--user-observation-token":
		v["description"] = "Fresh token from the matching native listing; never infer or reuse across targets"
	case "--git", "--hidden":
		v["possible_values"] = []string{"true", "false"}
	case "--archived":
		v["possible_values"] = []string{"true", "false"}
	case "--previous-archive":
		v["possible_values"] = []string{"active", "archived"}
	case "--observation-token":
		v["description"] = "Fresh token from the matching archive/workspace/worktree observation; checked again on write"
	case "--worktree":
		v["description"] = "Create a browser worktree conversation, not a Taskfleet run; 1–40 lowercase alphanumeric/hyphen characters"
	case "--delivery":
		v["possible_values"] = []string{"send", "steer", "follow-up"}
		v["default"] = "send"
	case "--empty-only":
		v["description"] = "Required opt-in: only a fresh, provably empty daemon-owned conversation may close"
		v["default"] = false
	case "--held":
		v["description"] = "Cancel daemon-held messages instead of clearing Pi's queue"
		v["default"] = false
	case "--provider":
		v["description"] = "Required model provider from model list"
		v["possible_values"] = []string{"openai", "openai-codex", "claude-bridge"}
	case "--model":
		v["description"] = "Required native model ID from model list; repeat the current provider/model to change only thinking"
	case "--thinking":
		v["description"] = "Optional default thinking level; must be supported by the selected model; omission preserves native thinking settings"
		v["possible_values"] = []string{"off", "minimal", "low", "medium", "high", "xhigh", "max"}
	case "--conversation":
		v["description"] = "Explicit own pi:UUID target; mutually exclusive with --current"
	case "--text":
		v["description"] = "Plain agent text, 1–4096 UTF-8 bytes; mutually exclusive with --text-file"
	case "--attempt":
		v["description"] = "Exact 32-lowercase-hex Pi attempt_id returned by create; stale IDs never select a successor"
	case "--input-file":
		v["description"] = "Protected command JSON (no action), maximum 8192 bytes (question: 66000); regular own-UID mode 0600 file or - for redirected stdin"
	case "--secret-file":
		v["description"] = "Raw literal OpenAI API key, maximum 256 bytes; regular own-UID mode 0600 file or - for redirected stdin; never argv/environment"
	case "--text-file":
		v["description"] = "Read UTF-8 from FILE or - for stdin; notice maximum 4096 bytes, message maximum 65536 raw bytes and 66000 encoded request bytes"
	case "--idempotency-key":
		v["description"] = "Explicit UUID for notice/control intent; spent message/control IDs are refused, never replayed; never use a new key to retry uncertain work"
	case "--output":
		v["description"] = "Export result rows to a new FILE.jsonl (refuses overwrite); stdout reports path and count"
	case "--component":
		v["possible_values"] = []string{"gateway", "daemon"}
		v["description"] = "Explicit operator component; omit for personal native configuration"
	case "--config":
		v["description"] = "Required trusted service configuration path"
	case "--agent":
		v["possible_values"] = []string{"claude", "pi", "codex", "all"}
		v["default"] = "all"
	case "--target":
		v["description"] = "Skill installation base directory"
		v["default"] = "."
	case "--current":
		v["description"] = "Resolve inherited OPEN_HABITAT_CONVERSATION_ID, OPEN_HABITAT_WORKSPACE_ID and OPEN_HABITAT_LAUNCH_GENERATION against the daemon"
	case "--administrator":
		v["possible_values"] = []string{"true", "false"}
	case "--json", "--verbose", "--dry-run", "--force", "--finished-only":
		v["default"] = false
	}
	return v
}
func helpText(out any) string {
	data := out.(map[string]any)["data"].(map[string]any)
	var b strings.Builder
	fmt.Fprintf(&b, "%s\n%s\n", strings.Join(data["command_path"].([]string), " "), data["description"])
	if subs := data["subcommands"].([]string); len(subs) > 0 {
		fmt.Fprintf(&b, "Subcommands: %s\n", strings.Join(subs, ", "))
	}
	for _, f := range data["flags"].([]any) {
		v := f.(map[string]any)
		fmt.Fprintf(&b, "  %s  %s\n", v["long"], v["description"])
	}
	for _, e := range data["examples"].([]any) {
		v := e.(map[string]any)
		fmt.Fprintf(&b, "Example: %s\n", strings.Join(v["argv"].([]string), " "))
	}
	b.WriteString("Exit codes: 0 success; 1 caller/domain error; 2 system/internal error; 130 SIGINT; 143 SIGTERM.\n")
	return strings.TrimSuffix(b.String(), "\n")
}
