//go:build linux

package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/daemon"
)

var worktreeCLIName = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,39}$`)

type conversationRequest struct {
	method, path, output string
	body                 []byte
}

func agentConversationCommand(args []string) (any, error) {
	req, err := parseConversationRequest(args)
	if err != nil {
		return nil, err
	}
	return runConversationRequest(req, exchangeAgentBody)
}

func runConversationRequest(req conversationRequest, exchange func(string, string, []byte) (json.RawMessage, error)) (any, error) {
	data, err := exchange(req.method, req.path, req.body)
	if err != nil {
		return nil, err
	}
	if err := conversationOperationError(req.path, data); err != nil {
		return nil, err
	}
	if req.output != "" {
		var wire struct {
			Sessions []map[string]any `json:"sessions"`
		}
		if json.Unmarshal(data, &wire) != nil {
			return nil, system("invalid_agent_response", "invalid conversation list")
		}
		return writeRowsOutput(req.output, wire.Sessions)
	}
	result := envelope(map[string]any{"cli_version": version, "result": data})
	if req.method == "POST" {
		result["warnings"] = []string{"Do not automatically replay writes after a missing reply or 503; inspect conversation state. A missing receipt is not rejection."}
	}
	return result, nil
}

// The browser protocol encodes model-generation failures in a 200 reply.
// A CLI must not turn that explicit failure into a successful exit status.
func conversationOperationError(path string, data json.RawMessage) error {
	if !strings.HasSuffix(path, "/recap") && !strings.HasSuffix(path, "/regenerate_title") && !strings.HasSuffix(path, "/history_title") {
		return nil
	}
	var result struct {
		State  string `json:"state"`
		Reason string `json:"reason"`
	}
	if json.Unmarshal(data, &result) != nil {
		return system("invalid_agent_response", "invalid conversation result")
	}
	if result.State == "failed" {
		reason := ""
		// The daemon's fixed reason codes, never free text from the reply.
		if len(result.Reason) <= 40 && strings.Trim(result.Reason, "abcdefghijklmnopqrstuvwxyz_") == "" && result.Reason != "" {
			reason = " (reason: " + result.Reason + ")"
		}
		return system("native_operation_failed", "native title/recap generation failed"+reason+"; inspect native state before requesting another model call")
	}
	return nil
}

// The per-command allowlist prevents ignored flags and implicit cross-conversation
// targets. Only the original read-only show supports inherited --current.
func parseConversationRequest(args []string) (conversationRequest, error) {
	req := conversationRequest{method: "POST"}
	if len(args) < 2 {
		return req, usage("expected an agent resource and verb; inspect agent --help")
	}
	key := args[0] + " " + args[1]
	allowed := ""
	action := ""
	switch key {
	case "conversation list":
		req.method = "GET"
		allowed = "--output"
	case "conversation create":
		allowed = "--workspace --provider --model --thinking --worktree --dry-run"
	case "conversation show":
		req.method = "GET"
		action = "status"
		allowed = "--conversation"
	case "conversation resume":
		action = "continue"
		allowed = "--conversation --dry-run"
	case "conversation stop":
		action = "stop"
		allowed = "--conversation --dry-run"
	case "conversation delete":
		action = "close"
		allowed = "--conversation --empty-only --dry-run"
	case "conversation update":
		action = "archive"
		allowed = "--conversation --workspace --archived --observation-token --previous-archive --dry-run"
	case "archive show":
		req.method = "GET"
		action = "archive"
		allowed = "--conversation"
	case "continuation show":
		req.method = "GET"
		action = "eligibility"
		allowed = "--conversation"
	case "message create":
		action = "send"
		allowed = "--conversation --text-file --idempotency-key --delivery --dry-run"
	case "queue show":
		req.method = "GET"
		action = "status"
		allowed = "--conversation"
	case "queue delete":
		action = "clear_queue"
		allowed = "--conversation --idempotency-key --held --dry-run"
	case "turn interrupt":
		action = "abort"
		allowed = "--conversation --idempotency-key --dry-run"
	case "title create":
		action = "regenerate_title"
		allowed = "--conversation --workspace --dry-run"
	case "recap create":
		action = "recap"
		allowed = "--conversation --dry-run"
	case "recap show":
		req.method = "GET"
		action = "recap"
		allowed = "--conversation"
	default:
		return req, usage(fmt.Sprintf("unknown agent command %q; inspect agent --help", key))
	}
	values := map[string]string{}
	for i := 2; i < len(args); i++ {
		flag := args[i]
		if !strings.Contains(" "+allowed+" ", " "+flag+" ") {
			return req, usage(fmt.Sprintf("unknown flag %q for %s", flag, key))
		}
		if _, ok := values[flag]; ok {
			return req, usage("duplicate " + flag)
		}
		switch flag {
		case "--dry-run", "--empty-only", "--held":
			values[flag] = "true"
			continue
		}
		i++
		if i == len(args) {
			return req, usage("missing value for " + flag)
		}
		if args[i] == "" || strings.TrimSpace(args[i]) != args[i] {
			return req, usage("empty or surrounding whitespace in " + flag)
		}
		values[flag] = args[i]
	}
	body := map[string]any{}
	req.path = daemon.AgentConversationsPath
	if action != "" {
		id := values["--conversation"]
		if !agentIDPattern.MatchString(id) {
			return req, usage(fmt.Sprintf("invalid --conversation %q; required explicit own pi:UUID", id))
		}
		req.path += "/" + strings.TrimPrefix(id, "pi:") + "/" + action
	}
	if key == "conversation create" || key == "conversation update" || (key == "title create" && values["--workspace"] != "") {
		workspace := values["--workspace"]
		if !workspacePattern.MatchString(workspace) {
			return req, usage(fmt.Sprintf("invalid --workspace %q; expected ws_ ID from workspace list", workspace))
		}
		body["workspace_id"] = workspace
	}
	if key == "conversation create" {
		if values["--provider"] != "" && values["--model"] == "" {
			return req, usage("--provider requires --model; omit both to inherit native defaults")
		}
		for _, field := range []string{"provider", "model", "thinking"} {
			if v, ok := values["--"+field]; ok {
				body[field] = v
			}
		}
		if p, ok := values["--provider"]; ok && !conversationProvider(p) {
			return req, usage(fmt.Sprintf("invalid --provider %q; expected openai-codex, openai, anthropic, deepseek or claude-bridge", p))
		}
		if model, ok := values["--model"]; ok && (!utf8.ValidString(model) || len(model) > 160 || strings.ContainsAny(model, "\x00\r\n")) {
			return req, usage(fmt.Sprintf("invalid --model %q; expected native catalog ID up to 160 UTF-8 bytes", model))
		}
		if thinking, ok := values["--thinking"]; ok {
			if values["--model"] == "" || !strings.Contains(" off minimal low medium high xhigh max ", " "+thinking+" ") {
				return req, usage("--thinking requires --model and a supported thinking level")
			}
		}
		if name, ok := values["--worktree"]; ok {
			if len(name) > 40 || !worktreeCLIName.MatchString(name) {
				return req, usage("invalid --worktree; expected 1–40 lowercase letters, digits or hyphens, starting alphanumeric")
			}
			body["new_worktree"] = map[string]string{"name": name}
		}
	}
	if key == "message create" || key == "queue delete" || key == "turn interrupt" {
		id := values["--idempotency-key"]
		if !launchPattern.MatchString(id) {
			return req, usage("--idempotency-key requires an explicit UUID; never use a new key to replay uncertain work")
		}
		body["command_id"] = id
	}
	if key == "message create" {
		delivery := values["--delivery"]
		switch delivery {
		case "", "send":
		case "steer":
			req.path = strings.TrimSuffix(req.path, "send") + "steer"
		case "follow-up":
			req.path = strings.TrimSuffix(req.path, "send") + "follow_up"
		default:
			return req, usage(fmt.Sprintf("invalid --delivery %q; expected send, steer or follow-up", delivery))
		}
		file := values["--text-file"]
		if file == "" {
			return req, usage("--text-file FILE|- is required")
		}
		var reader io.Reader = os.Stdin
		if file != "-" {
			f, err := os.Open(file)
			if err != nil {
				return req, system("io_input", "message input could not be opened")
			}
			defer f.Close()
			reader = f
		}
		text, err := io.ReadAll(io.LimitReader(reader, 65537))
		if err != nil {
			return req, system("io_input", "message input could not be read")
		}
		if len(text) > 65536 || !utf8.Valid(text) || strings.TrimSpace(string(text)) == "" {
			return req, usage("message must be nonempty UTF-8, at most 65536 bytes")
		}
		body["message"] = string(text)
	}
	if key == "queue delete" && values["--held"] != "" {
		req.path = strings.TrimSuffix(req.path, "clear_queue") + "cancel_held"
	}
	if key == "conversation delete" && values["--empty-only"] == "" {
		return req, usage("conversation delete requires --empty-only; native history is never deleted")
	}
	if key == "conversation update" {
		archived := values["--archived"]
		if archived != "true" && archived != "false" {
			return req, usage(fmt.Sprintf("invalid --archived %q; expected true or false", archived))
		}
		previous := values["--previous-archive"]
		if previous != "active" && previous != "archived" {
			return req, usage(fmt.Sprintf("invalid --previous-archive %q; expected active or archived from archive show", previous))
		}
		token := values["--observation-token"]
		if len(token) < 8 || len(token) > 200 {
			return req, usage("--observation-token requires a fresh archive show token")
		}
		body["archived"] = archived == "true"
		body["previous_archive"] = previous
		body["observation_token"] = token
	}
	if key == "title create" && values["--workspace"] != "" {
		req.path = strings.TrimSuffix(req.path, "regenerate_title") + "history_title"
	}
	if values["--dry-run"] != "" {
		return req, &cliError{code: "dry_run_unsupported", message: "conversation control is race-sensitive; inspect current state and safety observations, then apply explicitly", exit: 1}
	}
	if output, ok := values["--output"]; ok {
		if !strings.HasSuffix(output, ".jsonl") {
			return req, usage("--output requires a new FILE.jsonl")
		}
		req.output = output
	}
	if len(body) > 0 {
		var encoded bytes.Buffer
		encoder := json.NewEncoder(&encoded)
		encoder.SetEscapeHTML(false)
		if encoder.Encode(body) != nil {
			return req, system("internal_encoding", "conversation input could not be encoded")
		}
		req.body = bytes.TrimSuffix(encoded.Bytes(), []byte("\n"))
		if key == "message create" && len(req.body) > 66000 {
			return req, usage("message exceeds the daemon's 66000-byte JSON-encoded limit; shorten the input file (escaped newlines and control characters also count)")
		}
	}
	return req, nil
}
