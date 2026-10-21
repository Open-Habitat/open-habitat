//go:build linux

package cli

import (
	"encoding/json"
	"io"
	"net/url"
	"os"
	"regexp"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/daemon"
)

var loginAttemptPattern = regexp.MustCompile(`^[0-9]{8}T[0-9]{6}\.[0-9]{9}$`)
var piLoginAttemptPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)

func agentLoginCommand(args []string) (any, error) {
	req, err := parseAgentLoginRequest(args, os.Stdin)
	if err != nil {
		return nil, err
	}
	data, err := exchangeAgentBody(req.method, req.path, req.body)
	if err != nil {
		return nil, err
	}
	if err := agentLoginOperationError(data); err != nil {
		return nil, err
	}
	out := envelope(map[string]any{"cli_version": version, "result": data})
	if req.method != "GET" {
		out["warnings"] = []string{"Delivery may already have occurred. Never replay automatically after an unknown outcome or missing reply. Hand the browser URL/device code to the person; never ask for or handle their provider password. Cancellation is not logout or grant revocation."}
	}
	return out, nil
}

func agentLoginOperationError(data json.RawMessage) error {
	// Native attempt failure is not successful completion. Never include raw
	// native output or submitted codes/redirects in a diagnostic.
	var view struct {
		State string `json:"state"`
	}
	if json.Unmarshal(data, &view) != nil {
		return system("invalid_agent_response", "invalid login/question response")
	}
	if view.State == "failed" || view.State == "unavailable" {
		err := system("native_login_failed", "native login failed; inspect the redacted result and native state, never replay automatically")
		// Keep fixed failure/consent guidance from the redacted native view.
		// Otherwise an administrator-consent URL disappears exactly when needed.
		err.result = data
		return err
	}
	return nil
}

// All potentially credential-bearing inputs and errors on this surface are
// protected, including malformed argv. Actions are chosen by the command, not
// by input JSON. Headers never convey an agent's attempt ownership.
func parseAgentLoginRequest(args []string, stdin io.Reader) (conversationRequest, error) {
	req := conversationRequest{}
	invalid := func() (conversationRequest, error) {
		return req, usage("invalid login/question arguments; inspect --help; codes and redirect URLs require --input-file FILE|- (private file or redirected stdin)")
	}
	if len(args) < 2 {
		return invalid()
	}
	key := args[0] + " " + args[1]
	input, target, attempt, dry := "", "", "", false
	needsInput := false
	allowedFields, action := "", ""
	switch key {
	case "integration-login show":
		req.method, req.path = "GET", daemon.AgentIntegrationLoginPath
	case "integration-login create":
		req.method, req.path, needsInput, allowedFields, action = "POST", daemon.AgentIntegrationLoginPath, true, " provider address ", "start"
	case "integration-login update":
		req.method, req.path, needsInput, allowedFields = "PUT", daemon.AgentIntegrationLoginPath, true, " attempt_id redirect_url folders "
	case "integration-login delete":
		req.method, req.path, needsInput, allowedFields, action = "DELETE", daemon.AgentIntegrationLoginPath, true, " attempt_id ", "cancel"
	case "pi-login create":
		req.method, req.path = "POST", daemon.AgentPiLoginPath
	case "pi-login show":
		req.method, req.path = "GET", daemon.AgentPiLoginPath
	case "pi-login delete":
		req.method, req.path = "DELETE", daemon.AgentPiLoginPath
	case "claude-login create":
		req.method, req.path = "POST", daemon.AgentClaudeLoginPath
	case "claude-login show":
		req.method, req.path = "GET", daemon.AgentClaudeLoginPath
	case "claude-login update":
		req.method, req.path, needsInput, allowedFields = "PUT", daemon.AgentClaudeLoginPath, true, " attempt_id code "
	case "claude-login delete":
		req.method, req.path, needsInput, allowedFields = "DELETE", daemon.AgentClaudeLoginPath, true, " attempt_id "
	case "question answer":
		req.method, needsInput, allowedFields, action = "POST", true, " request_id value ", "answer"
	case "question cancel":
		req.method, needsInput, allowedFields, action = "POST", true, " request_id ", "cancel"
	default:
		return invalid()
	}
	for i := 2; i < len(args); i++ {
		switch args[i] {
		case "--dry-run":
			if dry || req.method == "GET" {
				return invalid()
			}
			dry = true
		case "--input-file":
			if !needsInput || input != "" || i+1 == len(args) {
				return invalid()
			}
			i++
			input = args[i]
			if input == "" {
				return invalid()
			}
		case "--conversation":
			if args[0] != "question" || target != "" || i+1 == len(args) {
				return invalid()
			}
			i++
			target = args[i]
		case "--attempt":
			if args[0] != "pi-login" || args[1] == "create" || attempt != "" || i+1 == len(args) {
				return invalid()
			}
			i++
			attempt = args[i]
		default:
			return invalid()
		}
	}
	if needsInput && input == "" {
		return invalid()
	}
	if args[0] == "question" {
		if !agentIDPattern.MatchString(target) {
			return invalid()
		}
		req.path = daemon.AgentConversationsPath + "/" + strings.TrimPrefix(target, "pi:") + "/question"
	}
	if args[0] == "pi-login" && args[1] != "create" {
		if !piLoginAttemptPattern.MatchString(attempt) {
			return invalid()
		}
		req.path += "?attempt_id=" + url.QueryEscape(attempt)
	}
	if dry {
		return req, &cliError{code: "dry_run_unsupported", message: "native login and question delivery cannot be previewed; inspect status then apply explicitly", exit: 1}
	}
	if !needsInput {
		return req, nil
	}
	limit := int64(8192)
	if args[0] == "question" {
		limit = 66000
	}
	raw, err := readProtectedInput(input, stdin, limit)
	if err != nil {
		return req, err
	}
	fields, ok := protectedFields(raw)
	if !ok {
		return invalid()
	}
	for k := range fields {
		if !strings.Contains(allowedFields, " "+k+" ") {
			return invalid()
		}
	}
	if args[0] == "question" {
		var id string
		if json.Unmarshal(fields["request_id"], &id) != nil || len(id) < 1 || len(id) > 200 {
			return invalid()
		}
		if args[1] == "answer" && fields["value"] == nil {
			return invalid()
		}
	} else if key != "integration-login create" {
		var id string
		if json.Unmarshal(fields["attempt_id"], &id) != nil || !loginAttemptPattern.MatchString(id) {
			return invalid()
		}
	}
	if key == "integration-login create" {
		var provider string
		if json.Unmarshal(fields["provider"], &provider) != nil || provider == "" {
			return invalid()
		}
	}
	if key == "integration-login update" {
		if (fields["redirect_url"] == nil) == (fields["folders"] == nil) {
			return invalid()
		}
		action = "redirect"
		if fields["folders"] != nil {
			action = "folders"
		}
	}
	if key == "claude-login update" && fields["code"] == nil {
		return invalid()
	}
	if action != "" {
		fields["action"], _ = json.Marshal(action)
	}
	req.body, _ = json.Marshal(fields)
	return req, nil
}
