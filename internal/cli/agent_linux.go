//go:build linux

package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/user"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/daemon"
	"github.com/Open-Habitat/open-habitat/internal/udssecure"
	"golang.org/x/sys/unix"
)

var agentIDPattern = regexp.MustCompile(`^pi:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var launchPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var workspacePattern = regexp.MustCompile(`^ws_[A-Za-z0-9_-]{8,64}$`)

func personalSocket() (string, error) {
	uid := os.Geteuid()
	if uid <= 0 {
		return "", &cliError{code: "peer_not_authorized", message: "agent commands require the person's non-root Unix user", exit: 1}
	}
	u, err := user.LookupId(strconv.Itoa(uid))
	if err != nil || u.Username == "" || strings.ContainsAny(u.Username, "/\\\x00") || u.Username == "." || u.Username == ".." {
		return "", system("identity_unavailable", "effective Unix account unavailable")
	}
	return "/run/open-habitat/users/" + u.Username + "/agent.sock", nil
}
func agentCommand(args []string) (any, error) {
	if len(args) > 0 && args[0] == "model" {
		return agentModelCommand(args[1:])
	}
	if len(args) > 0 && args[0] == "notice" {
		return agentNoticeCommand(args[1:])
	}
	output := ""
	if len(args) == 4 && args[0] == "workspace" && args[1] == "list" && args[2] == "--output" {
		output = args[3]
		if output == "" || strings.TrimSpace(output) != output || !strings.HasSuffix(output, ".jsonl") {
			return nil, usage(fmt.Sprintf("invalid --output %q; expected a nonempty .jsonl path", output))
		}
		args = args[:2]
	}
	path, err := agentRequestPath(args)
	if err != nil {
		return nil, err
	}
	data, err := exchangeAgent(path)
	if err != nil {
		return nil, err
	}
	if output != "" {
		return writeWorkspaceOutput(output, data)
	}
	return envelope(map[string]any{"cli_version": version, "cli_commit": func() any { v, _ := buildProvenance(); return v }(), "result": data}), nil
}
func agentRequestPath(args []string) (string, error) {
	if len(args) == 2 && args[0] == "environment" && args[1] == "show" {
		return daemon.AgentEnvironmentPath, nil
	}
	if len(args) == 2 && args[0] == "workspace" && args[1] == "list" {
		return daemon.AgentWorkspacesPath, nil
	}
	if len(args) < 3 || args[0] != "conversation" || args[1] != "show" {
		return "", usage(fmt.Sprintf("invalid agent arguments %q; expected environment show, workspace list [--output FILE.jsonl], or conversation show <pi:UUID>|--current", args))
	}
	q := url.Values{}
	if len(args) == 3 && args[2] == "--current" {
		id, workspace, generation := os.Getenv("OPEN_HABITAT_CONVERSATION_ID"), os.Getenv("OPEN_HABITAT_WORKSPACE_ID"), os.Getenv("OPEN_HABITAT_LAUNCH_GENERATION")
		if !agentIDPattern.MatchString(id) || !workspacePattern.MatchString(workspace) || !launchPattern.MatchString(generation) {
			return "", &cliError{code: "current_context_unavailable", message: "--current requires a daemon-launched Pi context; use an explicit pi:UUID outside it", exit: 1}
		}
		q.Set("id", id)
		q.Set("workspace_id", workspace)
		q.Set("generation", generation)
		q.Set("current", "true")
	} else if len(args) == 3 && agentIDPattern.MatchString(args[2]) {
		q.Set("id", args[2])
	} else {
		return "", usage(fmt.Sprintf("invalid conversation target %q; expected exactly one pi:UUID or --current, not both", args[2:]))
	}
	return daemon.AgentConversationPath + "?" + q.Encode(), nil
}
func exchangeAgent(path string) (json.RawMessage, error) { return exchangeAgentBody("GET", path, nil) }
func exchangeAgentBody(method, path string, input []byte) (json.RawMessage, error) {
	socket, err := personalSocket()
	if err != nil {
		return nil, err
	}
	if udssecure.Agent(socket, os.Geteuid()) != nil {
		return nil, system("agent_socket_untrusted", "own-user agent socket is missing or unsafe; ask the operator to check socket installation")
	}
	timeout := 8 * time.Second
	if path == daemon.AgentModelsPath {
		timeout = 16 * time.Second // Native catalog lookup has a 12-second deadline.
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	conn, err := (&net.Dialer{}).DialContext(ctx, "unix", socket)
	if err != nil {
		return nil, system("agent_unavailable", "own daemon could not be reached")
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(timeout))
	uc, ok := conn.(*net.UnixConn)
	if !ok {
		return nil, system("agent_socket_untrusted", "unexpected socket transport")
	}
	raw, err := uc.SyscallConn()
	if err != nil {
		return nil, system("agent_socket_untrusted", "socket peer unavailable")
	}
	trusted := false
	err = raw.Control(func(fd uintptr) {
		cred, e := unix.GetsockoptUcred(int(fd), unix.SOL_SOCKET, unix.SO_PEERCRED)
		trusted = e == nil && cred.Uid == 0 && cred.Pid == 1
	})
	if err != nil || !trusted || udssecure.Agent(socket, os.Geteuid()) != nil {
		return nil, system("agent_socket_untrusted", "socket was not created by the system service manager")
	}
	req, _ := http.NewRequestWithContext(ctx, method, "http://unix"+path, bytes.NewReader(input))
	req.Close = true
	if input != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	tr := &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) { return conn, nil }, DisableKeepAlives: true, MaxResponseHeaderBytes: 8192}
	defer tr.CloseIdleConnections()
	res, err := tr.RoundTrip(req)
	if err != nil {
		return nil, system("agent_unavailable", "daemon response unavailable")
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 4<<20+1))
	if err != nil || len(body) > 4<<20 || !json.Valid(body) {
		return nil, system("invalid_agent_response", "daemon response is invalid or too large")
	}
	var wire struct {
		Version int `json:"schema_version"`
		Error   struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if json.Unmarshal(body, &wire) != nil || wire.Version != 1 {
		return nil, system("invalid_agent_response", "unsupported daemon schema")
	}
	if res.StatusCode != 200 {
		switch wire.Error.Code {
		case "current_context_stale", "conversation_not_found", "invalid_arguments", "peer_not_authorized", "conversation_not_running", "idempotency_conflict", "invalid_request", "model_unavailable", "thinking_unsupported":
			return nil, &cliError{code: wire.Error.Code, message: "daemon rejected the request; inspect command input and current native state", exit: 1}
		}
		return nil, system("agent_unavailable", "daemon could not read native state")
	}
	return json.RawMessage(body), nil
}

func writeWorkspaceOutput(path string, data json.RawMessage) (any, error) {
	var list struct {
		Workspaces []map[string]any `json:"workspaces"`
	}
	if json.Unmarshal(data, &list) != nil {
		return nil, system("invalid_agent_response", "workspace result could not be decoded")
	}
	return writeRowsOutput(path, list.Workspaces)
}
func writeRowsOutput(path string, rows []map[string]any) (any, error) {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if os.IsExist(err) {
		return nil, &cliError{code: "already_exists", message: "output file exists; choose a new path", exit: 1}
	}
	if err != nil {
		return nil, system("io_output", "output file could not be created")
	}
	complete := false
	defer func() {
		f.Close()
		if !complete {
			os.Remove(path)
		}
	}()
	encoder := json.NewEncoder(f)
	for _, w := range rows {
		w["schema_version"] = 1
		if encoder.Encode(w) != nil {
			return nil, system("io_output", "result export failed")
		}
	}
	if f.Close() != nil {
		return nil, system("io_output", "result export could not be closed")
	}
	complete = true
	absolute, _ := filepath.Abs(path)
	return envelope(map[string]any{"path": absolute, "count": len(rows), "format": "jsonl", "cli_version": version}), nil
}
