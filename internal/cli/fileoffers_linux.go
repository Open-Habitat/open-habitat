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

var fileOfferIDArgPattern = regexp.MustCompile(`^f[a-z2-7]{26}$`)

// agentFileCommand offers workspace files to the person as a frozen copy they
// download in the conversation, lists the person's offers, or removes one.
// An offer reaches the person's open browsers as a card in its conversation;
// the reply says it was published, never that anyone downloaded it.
func agentFileCommand(args []string) (any, error) {
	return runAgentFileCommand(args, exchangeAgentBody)
}

func runAgentFileCommand(args []string, exchange func(string, string, []byte) (json.RawMessage, error)) (any, error) {
	if len(args) == 0 || (args[0] != "offer" && args[0] != "list" && args[0] != "remove") {
		return nil, usage("expected agent file offer|list|remove; inspect --help")
	}
	op := args[0]
	allowed := map[string][]string{
		"offer":  {"--workspace", "--source", "--title", "--conversation", "--idempotency-key"},
		"list":   {"--output"},
		"remove": {"--offer-id"},
	}[op]
	values := map[string]string{}
	sources := []string{}
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
			return nil, usage(fmt.Sprintf("unknown file %s flag %q", op, a))
		}
		i++
		if i == len(args) {
			return nil, usage("missing value for " + a)
		}
		// --source repeats: each names one file or directory.
		if a == "--source" {
			sources = append(sources, args[i])
			continue
		}
		values[a] = args[i]
	}
	switch op {
	case "list":
		output, provided := values["--output"]
		if provided && (output == "" || !strings.HasSuffix(output, ".jsonl") || strings.TrimSpace(output) != output) {
			return nil, usage("--output requires a new FILE.jsonl path")
		}
		data, err := exchange("GET", daemon.AgentFileOffersPath, nil)
		if err != nil {
			return nil, err
		}
		if output != "" {
			var wire struct {
				Offers []map[string]any `json:"offers"`
			}
			if json.Unmarshal(data, &wire) != nil {
				return nil, system("invalid_agent_response", "invalid file offer list")
			}
			return writeRowsOutput(output, wire.Offers)
		}
		return envelope(map[string]any{"cli_version": version, "result": data}), nil
	case "remove":
		id := values["--offer-id"]
		if !fileOfferIDArgPattern.MatchString(id) {
			return nil, usage(fmt.Sprintf("invalid --offer-id %q; expected an offer_id from agent file list", id))
		}
		body, _ := json.Marshal(map[string]any{"offer_id": id, "dry_run": dry})
		data, err := exchange("POST", daemon.AgentFileOfferRemovePath, body)
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
	if len(sources) == 0 || len(sources) > 20 {
		return nil, usage("provide 1 to 20 --source flags, each a file or directory path, absolute or relative to the current working directory")
	}
	for _, source := range sources {
		if source == "" || len(source) > 1024 {
			return nil, usage("--source requires a file or directory path, absolute or relative to the current working directory (at most 1024 bytes)")
		}
	}
	title, hasTitle := values["--title"]
	if hasTitle && (strings.TrimSpace(title) == "" || len(title) > 200) {
		return nil, usage("--title must be nonempty, at most 200 bytes")
	}
	if len(sources) > 1 && !hasTitle {
		return nil, usage("--title is required with several --source flags; it names the package on the card")
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
	workspace, hasWorkspace := values["--workspace"]
	if !hasWorkspace && current {
		// The checked launch context names the conversation's workspace.
		workspace = os.Getenv("OPEN_HABITAT_WORKSPACE_ID")
	}
	if !workspacePattern.MatchString(workspace) {
		return nil, usage(fmt.Sprintf("invalid --workspace %q; expected ws_ ID from agent workspace list (optional only with --current)", workspace))
	}
	for i, source := range sources {
		abs, err := absoluteOfferSource("file", source)
		if err != nil {
			return nil, err
		}
		sources[i] = abs
	}
	request := map[string]any{"idempotency_key": key, "workspace_id": workspace, "paths": sources, "dry_run": dry}
	if hasTitle {
		request["title"] = title
	}
	body, _ := json.Marshal(request)
	data, err := exchange("POST", daemon.AgentFileOffersPath+"?"+query, body)
	if err != nil {
		return nil, offerNotFoundNamesPaths(err, "file", sources)
	}
	warnings := []string{}
	if !dry {
		var reply struct {
			SkippedHidden int `json:"skipped_hidden"`
			Notice        struct {
				Persistence string `json:"persistence"`
			} `json:"notice"`
		}
		if json.Unmarshal(data, &reply) != nil {
			return nil, system("invalid_agent_response", "invalid file offer result")
		}
		warnings = append(warnings, "the offer was published to the person's open browsers; that is not proof anyone downloaded or saw it")
		if reply.Notice.Persistence != "persisted" {
			warnings = append(warnings, "the offer card's persistence is "+reply.Notice.Persistence+"; it may not reappear after reload; do not retry with a new key")
		}
		if reply.SkippedHidden > 0 {
			warnings = append(warnings, fmt.Sprintf("%d hidden entries (names starting with a dot) were not offered", reply.SkippedHidden))
		}
	}
	result := envelope(map[string]any{"cli_version": version, "result": data})
	result["warnings"] = warnings
	return result, nil
}
