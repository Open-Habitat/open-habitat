//go:build linux

package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/daemon"
)

func agentNoticeCommand(args []string) (any, error) {
	if len(args) == 0 || (args[0] != "create" && args[0] != "list") {
		return nil, usage("expected agent notice create|list; inspect --help")
	}
	create := args[0] == "create"
	values := map[string]string{}
	current, dry := false, false
	for i := 1; i < len(args); i++ {
		a := args[i]
		if _, ok := values[a]; ok {
			return nil, usage("duplicate flag " + a)
		}
		if a == "--current" {
			if current {
				return nil, usage("duplicate --current")
			}
			current = true
			continue
		}
		if a == "--dry-run" && create {
			if dry {
				return nil, usage("duplicate --dry-run")
			}
			dry = true
			continue
		}
		if a != "--conversation" && !(create && (a == "--text" || a == "--text-file" || a == "--idempotency-key")) && !(!create && a == "--output") {
			return nil, usage(fmt.Sprintf("unknown notice flag %q", a))
		}
		i++
		if i == len(args) {
			return nil, usage("missing value for " + a)
		}
		values[a] = args[i]
	}
	target, hasTarget := values["--conversation"]
	if current == hasTarget {
		return nil, usage("provide exactly one --conversation pi:UUID or --current")
	}
	if current {
		target = "--current"
	}
	path, err := agentRequestPath([]string{"conversation", "show", target})
	if err != nil {
		return nil, err
	}
	path = strings.Replace(path, daemon.AgentConversationPath, daemon.AgentNoticesPath, 1)
	method := "GET"
	var body []byte
	if create {
		key := values["--idempotency-key"]
		if !launchPattern.MatchString(key) {
			return nil, usage(fmt.Sprintf("invalid --idempotency-key %q; expected UUID; reuse it only for the same notice", key))
		}
		text, inline := values["--text"]
		file, fromFile := values["--text-file"]
		if inline == fromFile {
			return nil, usage("provide exactly one --text or --text-file FILE|- for stdin")
		}
		if fromFile {
			var reader io.Reader = os.Stdin
			if file != "-" {
				f, e := os.Open(file)
				if e != nil {
					return nil, system("io_input", "notice input could not be opened")
				}
				defer f.Close()
				reader = f
			}
			data, e := io.ReadAll(io.LimitReader(reader, 4097))
			if e != nil {
				return nil, system("io_input", "notice input could not be read")
			}
			text = string(data)
		}
		if !utf8.ValidString(text) || strings.TrimSpace(text) == "" || len(text) > 4096 {
			return nil, usage("notice text must be nonempty UTF-8, at most 4096 bytes")
		}
		body, _ = json.Marshal(map[string]any{"idempotency_key": key, "text": text, "dry_run": dry})
		method = "POST"
	}
	output := values["--output"]
	if _, provided := values["--output"]; provided && (output == "" || !strings.HasSuffix(output, ".jsonl") || strings.TrimSpace(output) != output) {
		return nil, usage("--output requires a new FILE.jsonl path")
	}
	data, err := exchangeAgentBody(method, path, body)
	if err != nil {
		return nil, err
	}
	if output != "" {
		return writeNoticeOutput(output, data)
	}
	warnings := []string{}
	if create && !dry {
		var reply struct {
			Notice struct {
				Persistence string `json:"persistence"`
			} `json:"notice"`
		}
		if json.Unmarshal(data, &reply) != nil {
			return nil, system("invalid_agent_response", "invalid notice result")
		}
		if reply.Notice.Persistence != "persisted" {
			warnings = append(warnings, "notice persistence is "+reply.Notice.Persistence+"; live delivery is best effort, not proof a person saw it; do not retry with a new key")
		}
	}
	result := envelope(map[string]any{"cli_version": version, "result": data})
	// Warnings are part of the shared envelope, not an error implying no side effects.
	result["warnings"] = warnings
	return result, nil
}
func writeNoticeOutput(path string, data json.RawMessage) (any, error) {
	var wire struct {
		Notices []map[string]any `json:"notices"`
		HasMore bool             `json:"has_more"`
	}
	if json.Unmarshal(data, &wire) != nil {
		return nil, system("invalid_agent_response", "invalid notice list")
	}
	out, err := writeRowsOutput(path, wire.Notices)
	if err != nil {
		return nil, err
	}
	out.(map[string]any)["data"].(map[string]any)["has_more"] = wire.HasMore
	return out, nil
}
