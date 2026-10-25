//go:build linux

package cli

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/daemon"
)

// agentEditorCommand offers to show a workspace file, optionally at a line, in
// the person's Habitat editor. The offer reaches the person's open browsers as
// a card; their press opens it. The reply says it was published, never that
// anyone opened it, and nothing gives the agent the editor itself.
func agentEditorCommand(args []string) (any, error) {
	if len(args) == 0 || args[0] != "offer" {
		return nil, usage("expected agent editor offer; inspect --help")
	}
	values := map[string]string{}
	current, dry := false, false
	for i := 1; i < len(args); i++ {
		a := args[i]
		if _, ok := values[a]; ok {
			return nil, usage("duplicate flag " + a)
		}
		switch a {
		case "--current":
			if current {
				return nil, usage("duplicate --current")
			}
			current = true
			continue
		case "--dry-run":
			if dry {
				return nil, usage("duplicate --dry-run")
			}
			dry = true
			continue
		case "--workspace", "--path", "--line", "--conversation", "--idempotency-key":
		default:
			return nil, usage(fmt.Sprintf("unknown editor offer flag %q", a))
		}
		i++
		if i == len(args) {
			return nil, usage("missing value for " + a)
		}
		values[a] = args[i]
	}
	key := values["--idempotency-key"]
	if !launchPattern.MatchString(key) {
		return nil, usage(fmt.Sprintf("invalid --idempotency-key %q; expected UUID; reuse it only for the same offer", key))
	}
	target, hasTarget := values["--conversation"]
	if current && hasTarget {
		return nil, usage("provide at most one of --conversation pi:UUID or --current")
	}
	path := daemon.AgentEditorOffersPath
	if current || hasTarget {
		if current {
			target = "--current"
		}
		conversation, err := agentRequestPath([]string{"conversation", "show", target})
		if err != nil {
			return nil, err
		}
		_, query, _ := strings.Cut(conversation, "?")
		if _, err := url.ParseQuery(query); err != nil {
			return nil, usage("invalid conversation target")
		}
		path += "?" + query
	}
	workspace, hasWorkspace := values["--workspace"]
	if !hasWorkspace && current {
		// The checked launch context names the conversation's workspace.
		workspace = os.Getenv("OPEN_HABITAT_WORKSPACE_ID")
	}
	if !workspacePattern.MatchString(workspace) {
		return nil, usage(fmt.Sprintf("invalid --workspace %q; expected ws_ ID from agent workspace list (optional only with --current)", workspace))
	}
	file, ok := values["--path"]
	if !ok || file == "" || strings.HasPrefix(file, "/") || len(file) > 1024 {
		return nil, usage("--path requires a workspace-relative file path, not an absolute path")
	}
	request := map[string]any{"idempotency_key": key, "workspace_id": workspace, "path": file, "dry_run": dry}
	if raw, ok := values["--line"]; ok {
		line, err := strconv.Atoi(raw)
		if err != nil || line < 1 || line > 10_000_000 || strconv.Itoa(line) != raw {
			return nil, usage(fmt.Sprintf("invalid --line %q; expected a line number from 1", raw))
		}
		request["line"] = line
	}
	body, _ := json.Marshal(request)
	data, err := exchangeAgentBody("POST", path, body)
	if err != nil {
		return nil, err
	}
	warnings := []string{}
	if !dry {
		var reply struct {
			Delivery struct {
				Target      string `json:"target"`
				Persistence string `json:"persistence"`
			} `json:"delivery"`
		}
		if json.Unmarshal(data, &reply) != nil {
			return nil, system("invalid_agent_response", "invalid editor offer result")
		}
		warnings = append(warnings, "the offer was published to the person's open browsers; that is not proof anyone opened or saw it")
		switch {
		case reply.Delivery.Target == "account":
			warnings = append(warnings, "an account offer is shown only in browsers open now and is gone after a reload; do not retry with a new key")
		case reply.Delivery.Persistence != "persisted":
			warnings = append(warnings, "the offer card's persistence is "+reply.Delivery.Persistence+"; it may not reappear after reload; do not retry with a new key")
		}
	}
	result := envelope(map[string]any{"cli_version": version, "result": data})
	result["warnings"] = warnings
	return result, nil
}
