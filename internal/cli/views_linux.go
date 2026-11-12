//go:build linux

package cli

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strings"

	"github.com/open-habitat/open-habitat/internal/daemon"
)

var viewIDArgPattern = regexp.MustCompile(`^v[a-z2-7]{26}$`)

// agentViewCommand offers a readable HTML file or directory as a frozen view
// (ADR 0032), lists the person's views, or removes one. An offer reaches the
// person's open browsers as a card in its conversation, with Avaa and Avaa
// omalle välilehdelle; the reply says it was published, never that anyone
// opened it.
func agentViewCommand(args []string) (any, error) {
	return runAgentViewCommand(args, exchangeAgentBody)
}

func runAgentViewCommand(args []string, exchange func(string, string, []byte) (json.RawMessage, error)) (any, error) {
	if len(args) == 0 || (args[0] != "offer" && args[0] != "list" && args[0] != "remove") {
		return nil, usage("expected agent view offer|list|remove; inspect --help")
	}
	op := args[0]
	allowed := map[string][]string{
		"offer":  {"--workspace", "--source", "--entry-file", "--title", "--conversation", "--idempotency-key"},
		"list":   {"--output"},
		"remove": {"--view"},
	}[op]
	values := map[string]string{}
	current, dry := false, false
	for i := 1; i < len(args); i++ {
		a := args[i]
		if _, ok := values[a]; ok {
			return nil, usage("duplicate flag " + a)
		}
		switch {
		case a == "--current" && op == "offer":
			if current {
				return nil, usage("duplicate --current")
			}
			current = true
			continue
		case a == "--dry-run" && op != "list":
			if dry {
				return nil, usage("duplicate --dry-run")
			}
			dry = true
			continue
		}
		known := false
		for _, flag := range allowed {
			known = known || a == flag
		}
		if !known {
			return nil, usage(fmt.Sprintf("unknown view %s flag %q", op, a))
		}
		i++
		if i == len(args) {
			return nil, usage("missing value for " + a)
		}
		values[a] = args[i]
	}
	switch op {
	case "list":
		output, provided := values["--output"]
		if provided && (output == "" || !strings.HasSuffix(output, ".jsonl") || strings.TrimSpace(output) != output) {
			return nil, usage("--output requires a new FILE.jsonl path")
		}
		data, err := exchange("GET", daemon.AgentViewsPath, nil)
		if err != nil {
			return nil, err
		}
		if output != "" {
			var wire struct {
				Views []map[string]any `json:"views"`
			}
			if json.Unmarshal(data, &wire) != nil {
				return nil, system("invalid_agent_response", "invalid view list")
			}
			return writeRowsOutput(output, wire.Views)
		}
		return envelope(map[string]any{"cli_version": version, "result": data}), nil
	case "remove":
		id := values["--view"]
		if !viewIDArgPattern.MatchString(id) {
			return nil, usage(fmt.Sprintf("invalid --view %q; expected a view_id from agent view list", id))
		}
		body, _ := json.Marshal(map[string]any{"view_id": id, "dry_run": dry})
		data, err := exchange("POST", daemon.AgentViewRemovePath, body)
		if err != nil {
			return nil, err
		}
		return envelope(map[string]any{"cli_version": version, "result": data}), nil
	}
	key := values["--idempotency-key"]
	if !launchPattern.MatchString(key) {
		return nil, usage(fmt.Sprintf("invalid --idempotency-key %q; expected UUID; reuse it only for the same offer", key))
	}
	target, hasTarget := values["--conversation"]
	if current == hasTarget {
		return nil, usage("provide exactly one of --current or --conversation pi:UUID; the card appears in that conversation")
	}
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
	path := daemon.AgentViewsPath + "?" + query
	workspace, hasWorkspace := values["--workspace"]
	if !hasWorkspace && current {
		// The checked launch context names the conversation's workspace.
		workspace = os.Getenv("OPEN_HABITAT_WORKSPACE_ID")
	}
	if !workspacePattern.MatchString(workspace) {
		return nil, usage(fmt.Sprintf("invalid --workspace %q; expected ws_ ID from agent workspace list (optional only with --current)", workspace))
	}
	source, ok := values["--source"]
	if !ok || source == "" || len(source) > 1024 {
		return nil, usage("--source requires a file or directory path, absolute or relative to the current working directory (at most 1024 bytes)")
	}
	request := map[string]any{"idempotency_key": key, "workspace_id": workspace, "path": source, "dry_run": dry}
	if entry, ok := values["--entry-file"]; ok {
		request["entry"] = entry
	}
	if title, ok := values["--title"]; ok {
		if strings.TrimSpace(title) == "" || len(title) > 200 {
			return nil, usage("--title must be nonempty, at most 200 bytes")
		}
		request["title"] = title
	}
	if source, err = absoluteOfferSource("view", source); err != nil {
		return nil, err
	}
	request["path"] = source
	body, _ := json.Marshal(request)
	data, err := exchange("POST", path, body)
	if err != nil {
		return nil, offerNotFoundNamesPaths(err, "view", []string{source})
	}
	warnings := []string{}
	if !dry {
		var reply struct {
			SkippedHidden int `json:"skipped_hidden"`
			Offer         struct {
				Persistence string `json:"persistence"`
			} `json:"offer"`
		}
		if json.Unmarshal(data, &reply) != nil {
			return nil, system("invalid_agent_response", "invalid view offer result")
		}
		warnings = append(warnings, "the offer was published to the person's open browsers; that is not proof anyone opened or saw it")
		if reply.Offer.Persistence != "persisted" {
			warnings = append(warnings, "the offer card's persistence is "+reply.Offer.Persistence+"; it may not reappear after reload; do not retry with a new key")
		}
		if reply.SkippedHidden > 0 {
			warnings = append(warnings, fmt.Sprintf("%d hidden entries (names starting with a dot) were not exported", reply.SkippedHidden))
		}
	}
	result := envelope(map[string]any{"cli_version": version, "result": data})
	result["warnings"] = warnings
	return result, nil
}
