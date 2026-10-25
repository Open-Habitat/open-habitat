//go:build linux

package cli

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/daemon"
)

var viewIDArgPattern = regexp.MustCompile(`^v[a-z2-7]{26}$`)

// agentViewCommand offers a workspace HTML file or directory as a frozen view
// (ADR 0032), lists the person's views, or removes one. An offer reaches the
// person's open browsers as a card with Avaa and Avaa omalle välilehdelle;
// the reply says it was published, never that anyone opened it.
func agentViewCommand(args []string) (any, error) {
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
		data, err := exchangeAgent(daemon.AgentViewsPath)
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
		if dry {
			data, err := exchangeAgent(daemon.AgentViewsPath)
			if err != nil {
				return nil, err
			}
			var wire struct {
				Views []struct {
					ID string `json:"view_id"`
				} `json:"views"`
			}
			if json.Unmarshal(data, &wire) != nil {
				return nil, system("invalid_agent_response", "invalid view list")
			}
			for _, v := range wire.Views {
				if v.ID == id {
					return envelope(map[string]any{"cli_version": version, "dry_run": true, "would_remove": id}), nil
				}
			}
			return nil, &cliError{code: "view_not_found", message: "no such view; inspect agent view list", exit: 1}
		}
		body, _ := json.Marshal(map[string]any{"view_id": id})
		data, err := exchangeAgentBody("POST", daemon.AgentViewRemovePath, body)
		if err != nil {
			return nil, err
		}
		return envelope(map[string]any{"cli_version": version, "result": data}), nil
	}
	key := values["--idempotency-key"]
	if !launchPattern.MatchString(key) {
		return nil, usage(fmt.Sprintf("invalid --idempotency-key %q; expected UUID; reuse it only for the same offer", key))
	}
	workspace := values["--workspace"]
	if !workspacePattern.MatchString(workspace) {
		return nil, usage(fmt.Sprintf("invalid --workspace %q; expected ws_ ID from agent workspace list", workspace))
	}
	source, ok := values["--source"]
	if !ok || source == "" || strings.HasPrefix(source, "/") || len(source) > 1024 {
		return nil, usage("--source requires a workspace-relative file or directory path, not an absolute path")
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
	path := daemon.AgentViewsPath
	target, hasTarget := values["--conversation"]
	if current && hasTarget {
		return nil, usage("provide at most one of --conversation pi:UUID or --current")
	}
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
	body, _ := json.Marshal(request)
	data, err := exchangeAgentBody("POST", path, body)
	if err != nil {
		return nil, err
	}
	warnings := []string{}
	if !dry {
		var reply struct {
			SkippedHidden int `json:"skipped_hidden"`
			Offer         struct {
				Target      string `json:"target"`
				Persistence string `json:"persistence"`
			} `json:"offer"`
		}
		if json.Unmarshal(data, &reply) != nil {
			return nil, system("invalid_agent_response", "invalid view offer result")
		}
		warnings = append(warnings, "the offer was published to the person's open browsers; that is not proof anyone opened or saw it")
		if reply.Offer.Target == "conversation" && reply.Offer.Persistence != "persisted" {
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
