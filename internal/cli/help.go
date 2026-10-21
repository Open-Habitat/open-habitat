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
	{"agent conversation show", "Read an explicit live record or verified inherited context", "agent conversation show --current --json", []string{"--current"}},
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
	case "--text-file":
		v["description"] = "Read plain UTF-8 text from FILE or - for stdin, at most 4096 bytes"
	case "--idempotency-key":
		v["description"] = "Required UUID identifying this notice; reuse only with identical text; never automatically replay an uncertain write"
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
	case "--json", "--verbose", "--dry-run", "--force":
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
