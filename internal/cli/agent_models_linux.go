//go:build linux

package cli

import (
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/daemon"
)

func agentModelCommand(args []string) (any, error) {
	method, body, err := agentModelRequest(args)
	if err != nil {
		return nil, err
	}
	data, err := exchangeAgentBody(method, daemon.AgentModelsPath, body)
	if err != nil {
		return nil, err
	}
	return envelope(map[string]any{"cli_version": version, "result": data}), nil
}

func agentModelRequest(args []string) (string, []byte, error) {
	if len(args) == 1 && args[0] == "list" {
		return "GET", nil, nil
	}
	if len(args) == 0 || args[0] != "update" {
		return "", nil, usage("expected agent model list or update --provider PROVIDER --model MODEL [--thinking LEVEL] [--dry-run]")
	}
	values := map[string]string{}
	dry := false
	for i := 1; i < len(args); i++ {
		flag := args[i]
		if flag == "--dry-run" && !dry {
			dry = true
			continue
		}
		if flag != "--provider" && flag != "--model" && flag != "--thinking" {
			return "", nil, usage(fmt.Sprintf("unknown or duplicate model flag %q", flag))
		}
		if _, exists := values[flag]; exists {
			return "", nil, usage("duplicate " + flag)
		}
		i++
		if i == len(args) {
			return "", nil, usage("missing value for " + flag)
		}
		values[flag] = args[i]
	}
	provider := values["--provider"]
	if !conversationProvider(provider) {
		return "", nil, usage(fmt.Sprintf("invalid --provider %q; expected openai-codex, openai, anthropic, deepseek or claude-bridge", provider))
	}
	model := values["--model"]
	if !utf8.ValidString(model) || model == "" || strings.TrimSpace(model) != model || len(model) > 160 || strings.ContainsAny(model, "\x00\r\n") {
		return "", nil, usage(fmt.Sprintf("invalid --model %q; expected a catalog model ID, 1–160 UTF-8 bytes without surrounding whitespace", model))
	}
	input := map[string]string{"provider": provider, "model": model}
	if level, present := values["--thinking"]; present {
		switch level {
		case "off", "minimal", "low", "medium", "high", "xhigh", "max":
			input["thinking"] = level
		default:
			return "", nil, usage(fmt.Sprintf("invalid --thinking %q; expected off, minimal, low, medium, high, xhigh or max", level))
		}
	}
	if dry {
		return "", nil, &cliError{code: "dry_run_unsupported", message: "native Pi catalog and settings may change before apply; inspect model list, then update explicitly", exit: 1}
	}
	body, _ := json.Marshal(input)
	return "POST", body, nil
}
