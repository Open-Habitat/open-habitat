//go:build linux

package cli

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/daemon"
	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
	"golang.org/x/sys/unix"
)

func protectedAgentArgs(args []string) bool {
	clean := []string{}
	for _, a := range args {
		if a != "--json" && a != "--verbose" && !strings.HasPrefix(a, "--json=") && !strings.HasPrefix(a, "--verbose=") {
			clean = append(clean, a)
		}
	}
	return len(clean) > 1 && clean[0] == "agent" && (clean[1] == "integration" || clean[1] == "integration-account" || clean[1] == "credential" || clean[1] == "code-host" || clean[1] == "speech-key" || clean[1] == "question" || clean[1] == "integration-login" || clean[1] == "pi-login" || clean[1] == "claude-login")
}

// Providers whose API keys the daemon stores in Pi's auth.json.
func keyProvider(p string) bool {
	return p == "openai" || p == "anthropic" || p == "deepseek"
}

// Providers a conversation or default model may name.
func conversationProvider(p string) bool {
	return p == "openai-codex" || p == "claude-bridge" || keyProvider(p)
}

func agentIntegrationCommand(args []string) (any, error) {
	req, err := parseIntegrationRequest(args, os.Stdin)
	if err != nil {
		return nil, err
	}
	data, err := exchangeAgentBody(req.method, req.path, req.body)
	if err != nil {
		return nil, err
	}
	out := envelope(map[string]any{"cli_version": version, "result": data})
	if req.method != "GET" && !(args[0] == "code-host" && args[1] == "check") {
		warning := "Do not replay after a missing reply or native failure; inspect native state first."
		if args[0] != "recap-settings" && args[0] != "speech-key" {
			warning += " Provider grants are not revoked by account removal."
		}
		out["warnings"] = []string{warning}
	}
	return out, nil
}

// Errors on this surface deliberately never interpolate argv, paths, JSON or
// native errors: callers may accidentally put a secret in any of them.
func parseIntegrationRequest(args []string, stdin io.Reader) (conversationRequest, error) {
	req := conversationRequest{}
	invalid := func() (conversationRequest, error) {
		return req, usage("invalid integration/credential arguments; use --help; secrets require --input-file or --secret-file (use - for stdin)")
	}
	if len(args) < 2 {
		return invalid()
	}
	switch args[0] {
	case "code-host":
		return parseCodeHostRequest(args, stdin)
	case "speech-key", "recap-settings":
		return parseSettingRequest(args, stdin)
	}
	key := args[0] + " " + args[1]
	switch key {
	case "integration list":
		req.method, req.path = "GET", daemon.AgentIntegrationsPath
	case "credential list":
		req.method, req.path = "GET", daemon.AgentCredentialsPath
	case "credential delete":
		req.method, req.path = "DELETE", daemon.AgentCredentialsPath
	case "credential update":
		req.method, req.path = "POST", daemon.AgentCredentialsPath
	case "integration-account create", "integration-account update":
		req.method, req.path = "POST", daemon.AgentIntegrationAccountsPath
	case "integration-account delete":
		req.method, req.path = "DELETE", daemon.AgentIntegrationAccountsPath
	default:
		return invalid()
	}
	inputFlag := "--input-file"
	if key == "credential update" {
		inputFlag = "--secret-file"
	}
	needsInput := req.method != "GET" && key != "credential delete"
	source, provider := "", ""
	dry := false
	needsProvider := key == "credential update" || key == "credential delete"
	for i := 2; i < len(args); i++ {
		switch {
		case args[i] == "--dry-run" && req.method != "GET" && !dry:
			dry = true
		case args[i] == "--provider" && needsProvider && provider == "":
			i++
			if i == len(args) || !keyProvider(args[i]) {
				return invalid()
			}
			provider = args[i]
		case args[i] == inputFlag && needsInput && source == "":
			i++
			if i == len(args) || args[i] == "" {
				return invalid()
			}
			source = args[i]
		default:
			return invalid()
		}
	}
	if needsInput && source == "" || needsProvider && provider == "" {
		return invalid()
	}
	if key == "credential delete" {
		req.path += "/" + provider
	}
	// No input is consumed and no native/network operation starts on a preview.
	if dry {
		return req, &cliError{code: "dry_run_unsupported", message: "native credential validation and account changes cannot be previewed; inspect list, then apply explicitly", exit: 1}
	}
	if !needsInput {
		return req, nil
	}
	limit := int64(8192)
	if key == "credential update" {
		limit = 256
	}
	data, err := readProtectedInput(source, stdin, limit)
	if err != nil {
		return req, err
	}
	if key == "credential update" {
		secret := strings.TrimSuffix(strings.TrimSuffix(string(data), "\n"), "\r")
		if !utf8.ValidString(secret) || len(secret) < 23 || len(secret) > 203 || !strings.HasPrefix(secret, "sk-") || strings.IndexFunc(secret[3:], func(r rune) bool {
			return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '-')
		}) >= 0 {
			return invalid()
		}
		req.body, _ = json.Marshal(map[string]string{"provider": provider, "key": secret})
		return req, nil
	}
	// The native handler validates the existing contract. The command supplies
	// action itself, so protected JSON cannot silently select a different write.
	fields, valid := protectedFields(data)
	if !valid {
		return invalid()
	}
	allowed := " provider address password "
	action := "password"
	if key == "integration-account create" {
		action = "connect"
		allowed += " server port security username smtp_server smtp_port smtp_security url "
	}
	if key == "integration-account delete" {
		action = "remove"
		allowed = " provider address delete_directories "
	}
	for field := range fields {
		if !strings.Contains(allowed, " "+field+" ") {
			return invalid()
		}
	}
	for _, field := range []string{"provider", "address"} {
		if _, ok := fields[field]; !ok {
			return invalid()
		}
	}
	fields["action"], _ = json.Marshal(action)
	req.body, _ = json.Marshal(fields)
	return req, nil
}

var codeHostConnection = regexp.MustCompile(`^(gitea|gitlab)_[0-9a-f]{24}$`)

// parseCodeHostRequest builds the browser's own Gitea/GitLab connection
// write (/settings/code-hosts) for the same daemon handler. The token is
// read only from protected input; the connection ID names its provider.
func parseCodeHostRequest(args []string, stdin io.Reader) (conversationRequest, error) {
	req := conversationRequest{}
	invalid := func() (conversationRequest, error) {
		return req, usage("invalid code-host arguments; use --help; the token requires --secret-file (use - for stdin)")
	}
	verb := args[1]
	action := map[string]string{"create": "connect", "update": "replace", "check": "check", "repair": "repair", "delete": "disconnect"}[verb]
	if action == "" {
		return invalid()
	}
	needsSecret := verb == "create" || verb == "update"
	provider, base, connection, source := "", "", "", ""
	dry := false
	for i := 2; i < len(args); i++ {
		flag := args[i]
		if flag == "--dry-run" && verb != "check" && !dry {
			dry = true
			continue
		}
		if i+1 == len(args) || args[i+1] == "" {
			return invalid()
		}
		i++
		switch {
		case flag == "--provider" && verb == "create" && provider == "" && (args[i] == "gitea" || args[i] == "gitlab"):
			provider = args[i]
		case flag == "--base-url" && verb == "create" && base == "" && len(args[i]) <= 2048 && strings.TrimSpace(args[i]) == args[i]:
			base = args[i]
		case flag == "--connection" && verb != "create" && connection == "" && codeHostConnection.MatchString(args[i]):
			connection = args[i]
			provider, _, _ = strings.Cut(connection, "_")
		case flag == "--secret-file" && needsSecret && source == "":
			source = args[i]
		default:
			return invalid()
		}
	}
	if provider == "" || verb == "create" && base == "" || verb != "create" && connection == "" || needsSecret && source == "" {
		return invalid()
	}
	req.method, req.path = "POST", daemon.AgentGiteaPath
	if provider == "gitlab" {
		req.path = daemon.AgentGitLabPath
	}
	if verb == "delete" {
		req.method = "DELETE"
	}
	// No input is consumed and no native/network operation starts on a preview.
	if dry {
		return req, &cliError{code: "dry_run_unsupported", message: "the provider's token check and native connection changes cannot be previewed; inspect integration list, then apply explicitly", exit: 1}
	}
	body := map[string]string{"action": action}
	if verb == "create" {
		body["base_url"] = base
	} else {
		body["connection_id"] = connection
	}
	if needsSecret {
		data, err := readProtectedInput(source, stdin, 1026)
		if err != nil {
			return req, err
		}
		token := strings.TrimSuffix(strings.TrimSuffix(string(data), "\n"), "\r")
		if !nativeforge.ValidToken(token) {
			return invalid()
		}
		body["token"] = token
	}
	req.body, _ = json.Marshal(body)
	return req, nil
}

// parseSettingRequest reads or writes one of the browser's personal settings
// through the daemon's own handler: the dictation key (raw protected input,
// stored only in ~/.config/soniox/key.json after Soniox takes it) or the
// complete recap settings document Pi keeps in its settings.json.
func parseSettingRequest(args []string, stdin io.Reader) (conversationRequest, error) {
	req := conversationRequest{path: daemon.AgentSpeechKeyPath}
	inputFlag, limit := "--secret-file", int64(258)
	if args[0] == "recap-settings" {
		req.path, inputFlag, limit = daemon.AgentRecapSettingsPath, "--input-file", 1024
	}
	invalid := func() (conversationRequest, error) {
		return req, usage("invalid " + args[0] + " arguments; use --help; input requires " + inputFlag + " (use - for stdin)")
	}
	switch {
	case args[1] == "show":
		req.method = "GET"
	case args[1] == "update" && args[0] == "recap-settings":
		req.method = "PUT"
	case args[1] == "update":
		req.method = "POST"
	case args[1] == "delete" && args[0] == "speech-key":
		req.method = "DELETE"
	default:
		return invalid()
	}
	needsInput := args[1] == "update"
	source, dry := "", false
	for i := 2; i < len(args); i++ {
		switch {
		case args[i] == "--dry-run" && req.method != "GET" && !dry:
			dry = true
		case args[i] == inputFlag && needsInput && source == "" && i+1 < len(args) && args[i+1] != "":
			i++
			source = args[i]
		default:
			return invalid()
		}
	}
	if needsInput && source == "" {
		return invalid()
	}
	if dry {
		return req, &cliError{code: "dry_run_unsupported", message: "the native settings write cannot be previewed; inspect show, then apply explicitly", exit: 1}
	}
	if !needsInput {
		return req, nil
	}
	data, err := readProtectedInput(source, stdin, limit)
	if err != nil {
		return req, err
	}
	if args[0] == "speech-key" {
		key := strings.TrimSuffix(strings.TrimSuffix(string(data), "\n"), "\r")
		if !daemon.ValidSonioxKey(key) {
			return invalid()
		}
		req.body, _ = json.Marshal(map[string]string{"key": key})
		return req, nil
	}
	// The daemon checks every field and its bounds; the whole document is
	// replaced, so a duplicate key must not pick a value silently.
	if _, valid := protectedFields(data); !valid {
		return invalid()
	}
	req.body = bytes.TrimSpace(data)
	return req, nil
}

// Credential JSON is a flat contract object. Reject duplicate keys rather
// than silently selecting whichever credential/target happened to come last.
func protectedFields(data []byte) (map[string]json.RawMessage, bool) {
	if !utf8.Valid(data) {
		return nil, false
	}
	d := json.NewDecoder(bytes.NewReader(data))
	token, err := d.Token()
	if err != nil || token != json.Delim('{') {
		return nil, false
	}
	fields := map[string]json.RawMessage{}
	for d.More() {
		token, err = d.Token()
		name, ok := token.(string)
		if err != nil || !ok {
			return nil, false
		}
		if _, exists := fields[name]; exists {
			return nil, false
		}
		var value json.RawMessage
		if d.Decode(&value) != nil {
			return nil, false
		}
		fields[name] = value
	}
	token, err = d.Token()
	if err != nil || token != json.Delim('}') || d.Decode(new(any)) != io.EOF {
		return nil, false
	}
	return fields, true
}

func readProtectedInput(path string, stdin io.Reader, limit int64) ([]byte, error) {
	var reader io.Reader = stdin
	if path == "-" {
		if f, ok := stdin.(*os.File); ok {
			if st, err := f.Stat(); err != nil || st.Mode()&os.ModeCharDevice != 0 {
				return nil, usage("protected stdin must be redirected, not a terminal")
			}
		}
	} else {
		fd, err := unix.Open(path, unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
		if err != nil {
			return nil, usage("protected input unavailable; use a regular own-user file with mode 0600 or redirected stdin")
		}
		f := os.NewFile(uintptr(fd), "protected-input")
		defer f.Close()
		var st unix.Stat_t
		if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != uint32(os.Geteuid()) || st.Mode&0077 != 0 {
			return nil, usage("protected input must be a regular own-user file inaccessible to group and others")
		}
		reader = f
	}
	b, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil || len(b) == 0 || int64(len(b)) > limit {
		return nil, usage("protected input is empty, unreadable or too large")
	}
	return bytes.Clone(b), nil
}
