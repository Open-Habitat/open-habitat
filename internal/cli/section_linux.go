//go:build linux

package cli

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/open-habitat/open-habitat/internal/daemon"
)

// agentSectionCommand places the agent's own conversation in the rail after
// its reply: agent section update --current --section yours|running|quiet.
// Only the current conversation can be placed; there is no --conversation.
func agentSectionCommand(args []string) (any, error) {
	if len(args) == 0 || args[0] != "update" {
		return nil, usage("expected agent section update --current --section yours|running|quiet; inspect --help")
	}
	current, section, hasSection := false, "", false
	for i := 1; i < len(args); i++ {
		switch a := args[i]; a {
		case "--current":
			if current {
				return nil, usage("duplicate --current")
			}
			current = true
		case "--section":
			if hasSection {
				return nil, usage("duplicate --section")
			}
			i++
			if i == len(args) {
				return nil, usage("missing value for --section")
			}
			section, hasSection = args[i], true
		case "--dry-run":
			return nil, &cliError{code: "dry_run_unsupported", message: "a section choice is idempotent and lasts only until the next turn; apply it explicitly, repeating the same section changes nothing", exit: 1}
		default:
			return nil, usage(fmt.Sprintf("unknown section flag %q; only --current and --section are accepted", a))
		}
	}
	if !current {
		return nil, usage("--current is required; an agent places only its own conversation")
	}
	if section != "yours" && section != "running" && section != "quiet" {
		return nil, usage(fmt.Sprintf("invalid --section %q; expected yours, running or quiet", section))
	}
	path, err := agentRequestPath([]string{"conversation", "show", "--current"})
	if err != nil {
		return nil, err
	}
	path = strings.Replace(path, daemon.AgentConversationPath, daemon.AgentSectionPath, 1)
	body, _ := json.Marshal(map[string]string{"section": section})
	data, err := exchangeAgentBody("POST", path, body)
	if err != nil {
		return nil, err
	}
	return envelope(map[string]any{"cli_version": version, "result": data}), nil
}
