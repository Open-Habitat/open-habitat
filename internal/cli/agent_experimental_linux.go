//go:build linux

package cli

import (
	"encoding/json"
	"fmt"
	"github.com/open-habitat/open-habitat/internal/daemon"
	"github.com/open-habitat/open-habitat/internal/experimental"
)

func agentExperimentalCommand(args []string) (any, error) {
	method, body, err := agentExperimentalRequest(args)
	if err != nil {
		return nil, err
	}
	data, err := exchangeAgentBody(method, daemon.AgentExperimentalPath, body)
	if err != nil {
		return nil, err
	}
	return envelope(map[string]any{"cli_version": version, "result": data}), nil
}

func agentExperimentalRequest(args []string) (string, []byte, error) {
	if len(args) == 1 && args[0] == "list" {
		return "GET", nil, nil
	}
	if len(args) < 3 || len(args) > 4 || args[0] != "update" {
		return "", nil, usage("expected agent experimental list or update <id> --on|--off [--dry-run]")
	}
	if !experimental.Known(args[1]) {
		return "", nil, usage(fmt.Sprintf("unknown experimental feature %q; use agent experimental list", args[1]))
	}
	chosen, on, dry := false, false, false
	for _, flag := range args[2:] {
		switch {
		case (flag == "--on" || flag == "--off") && !chosen:
			chosen, on = true, flag == "--on"
		case flag == "--dry-run" && !dry:
			dry = true
		default:
			return "", nil, usage(fmt.Sprintf("unknown or conflicting experimental flag %q; choose exactly one of --on and --off", flag))
		}
	}
	if !chosen {
		return "", nil, usage("choose exactly one of --on and --off")
	}
	if dry {
		return "", nil, &cliError{code: "dry_run_unsupported", message: "inspect experimental list, then update explicitly; preferences may change before apply", exit: 1}
	}
	body, _ := json.Marshal(map[string]any{"id": args[1], "enabled": on})
	return "PUT", body, nil
}
