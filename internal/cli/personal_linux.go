//go:build linux

package cli

import (
	_ "embed"
	"encoding/json"
	"io"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/udssecure"
)

//go:embed operator/SKILL.md
var operatorSkill string

//go:embed agent/SKILL.md
var agentSkill string

func skillContent(name string) string {
	if name == "agent" {
		return strings.Replace(agentSkill, "0.0.0-dev", version, 1)
	}
	return operatorSkillContent()
}
func hasComponent(args []string) bool {
	for _, a := range args {
		if a == "--component" {
			return true
		}
	}
	return false
}
func personalConfigPath() (string, error) {
	u, err := user.LookupId(strconv.Itoa(os.Geteuid()))
	if err != nil || u.HomeDir == "" {
		return "", system("identity_unavailable", "effective Unix account home unavailable")
	}
	return filepath.Join(u.HomeDir, ".pi/agent/settings.json"), nil
}
func readPersonalSettings(path string) (map[string]any, error) {
	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return map[string]any{}, nil
	}
	if err != nil {
		return nil, system("config_unavailable", "native Pi settings cannot be read")
	}
	defer f.Close()
	b, err := io.ReadAll(io.LimitReader(f, 1<<20+1))
	var data map[string]any
	if err != nil || len(b) > 1<<20 || json.Unmarshal(b, &data) != nil || data == nil {
		return nil, &cliError{code: "invalid_config", message: "native Pi settings must be a bounded JSON object", exit: 1}
	}
	// Only expose documented non-secret settings, not arbitrary extension config.
	safe := map[string]any{}
	for _, k := range []string{"defaultProvider", "defaultModel", "defaultThinkingLevel"} {
		if v, ok := data[k].(string); ok {
			safe[k] = map[string]any{"value": v, "source": "file"}
		}
	}
	return safe, nil
}
func personalConfig(args []string) (any, error) {
	if len(args) != 1 || (args[0] != "path" && args[0] != "show") {
		return nil, usage("expected config path|show [--component gateway|daemon]")
	}
	p, err := personalConfigPath()
	if err != nil {
		return nil, err
	}
	if args[0] == "path" {
		return envelope(map[string]any{"component": "personal", "path": p, "source": "native_account"}), nil
	}
	settings, err := readPersonalSettings(p)
	if err != nil {
		return nil, err
	}
	socket, err := personalSocket()
	if err != nil {
		return nil, err
	}
	return envelope(map[string]any{"component": "personal", "config_path": map[string]any{"value": p, "source": "native_account"}, "settings": settings, "agent_socket": map[string]any{"value": socket, "source": "effective_uid"}}), nil
}
func personalDoctor(args []string) (any, error) {
	if e := noArgs(args); e != nil {
		return nil, e
	}
	p, err := personalConfigPath()
	if err != nil {
		return nil, err
	}
	if _, err := readPersonalSettings(p); err != nil {
		return nil, err
	}
	socket, err := personalSocket()
	if err != nil {
		return nil, err
	}
	if udssecure.Agent(socket, os.Geteuid()) != nil {
		return nil, &cliError{code: "agent_socket_untrusted", message: "own-user agent socket is missing or unsafe; ask the operator to check installation", exit: 1}
	}
	return envelope(map[string]any{"component": "personal", "checks": []any{map[string]any{"id": "config.native", "status": "ok", "message": "native Pi settings are readable"}, map[string]any{"id": "agent.socket", "status": "ok", "message": "own-user socket filesystem permissions verified"}}, "summary": map[string]int{"ok": 2, "warn": 0, "fail": 0}}), nil
}
