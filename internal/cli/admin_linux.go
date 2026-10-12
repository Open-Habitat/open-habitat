//go:build linux

package cli

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type controlSettings struct {
	Version           int      `json:"version"`
	Name              string   `json:"name"`
	Administrators    []string `json:"administrators"`
	DefaultLimitBytes uint64   `json:"default_limit_bytes"`
}
type controlUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// exchangeAdmin is a private root-to-gateway protocol, not a direct state-file writer.
func exchangeAdmin(request any, reply any) error {
	if os.Geteuid() != 0 {
		return system("permission_denied", "root required for server administration; run through the privileged operator path")
	}
	payload, err := json.Marshal(request)
	if err != nil || len(payload) > 1024 {
		return usage("administration request exceeds the control protocol limit")
	}
	c, err := net.DialTimeout("unix", adminControlSocket, 3*time.Second)
	if err != nil {
		return system("control_unavailable", "private gateway control socket unavailable; ensure the gateway and revoke.socket are running")
	}
	defer c.Close()
	_ = c.SetDeadline(time.Now().Add(5 * time.Second))
	if _, err = c.Write(append(append([]byte("ADMIN "), payload...), '\n')); err != nil {
		return system("control_unavailable", "administration request could not be sent; inspect gateway before retry")
	}
	line, err := bufio.NewReader(io.LimitReader(c, 131073)).ReadBytes('\n')
	if err != nil {
		return system("control_unavailable", "administration response missing or too large; result unknown, inspect gateway before retry")
	}
	if bytes.HasPrefix(line, []byte("ERROR ")) {
		switch string(bytes.TrimSuffix(bytes.TrimPrefix(line, []byte("ERROR ")), []byte{'\n'})) {
		case "not_found":
			return &cliError{code: "not_found", message: "GitHub subject is not bound; sign in and bind the user before granting a role", exit: 1}
		case "broker_unavailable":
			return system("broker_unavailable", "binding lookup unavailable; ensure the broker is running before granting a role")
		case "administration_unavailable":
			return system("administration_unavailable", "gateway administration state unavailable; inspect the private administration.json and gateway logs")
		case "state_io":
			return system("state_io", "gateway could not persist administration state; check StateDirectory ownership, permissions and available disk space, then inspect gateway logs")
		case "request_failed":
			return system("administration_failed", "gateway rejected administration request; inspect gateway logs and current state before retry")
		}
		return system("invalid_control_response", "gateway returned an unknown administration error")
	}
	dec := json.NewDecoder(bytes.NewReader(bytes.TrimSuffix(line, []byte{'\n'})))
	dec.DisallowUnknownFields()
	if dec.Decode(reply) != nil || dec.Decode(new(any)) != io.EOF {
		return system("invalid_control_response", "gateway returned invalid administration data")
	}
	return nil
}

func adminOperation(operation string, fields map[string]any, reply any) error {
	request := map[string]any{"operation": operation}
	for k, v := range fields {
		request[k] = v
	}
	return exchangeAdmin(request, reply)
}

func adminServerCommand(args []string) (any, error) {
	if len(args) < 2 {
		return nil, usage("expected admin settings show|update, admin users list, admin role update, or admin storage list|update")
	}
	switch args[0] {
	case "settings":
		switch args[1] {
		case "show":
			if e := noArgs(args[2:]); e != nil {
				return nil, e
			}
			var s controlSettings
			if e := adminOperation("show", nil, &s); e != nil {
				return nil, e
			}
			if s.Version != 1 || s.Administrators == nil {
				return nil, system("invalid_control_response", "gateway returned invalid settings")
			}
			return envelope(s), nil
		case "update":
			if len(args) >= 4 && args[2] == "--default-limit-bytes" {
				limit, e := parseQuotaArg(args[3])
				if e != nil {
					return nil, e
				}
				dry := len(args) == 5 && args[4] == "--dry-run"
				if len(args) != 4 && !dry {
					return nil, usage("expected admin settings update --default-limit-bytes <bytes> [--dry-run]")
				}
				if dry {
					var current controlSettings
					if e := adminOperation("show", nil, &current); e != nil {
						return nil, e
					}
					return envelope(map[string]any{"dry_run": true, "would": []any{map[string]any{"action": "update", "resource": "server-settings", "input": map[string]any{"default_limit_bytes": limit}, "known_effects": map[string]any{"previous_default_limit_bytes": current.DefaultLimitBytes}}}}), nil
				}
				var ack struct {
					OK bool `json:"ok"`
				}
				if e := adminOperation("default_limit", map[string]any{"default_limit_bytes": limit}, &ack); e != nil {
					return nil, e
				}
				if !ack.OK {
					return nil, system("invalid_control_response", "gateway did not acknowledge settings update")
				}
				return envelope(map[string]any{"default_limit_bytes": limit, "updated": true}), nil
			}
			if len(args) < 4 || args[2] != "--name" {
				return nil, usage("expected admin settings update --name <name> [--dry-run]; empty name clears it")
			}
			name := args[3]
			dry := len(args) == 5 && args[4] == "--dry-run"
			if len(args) != 4 && !dry {
				return nil, usage("expected admin settings update --name <name> [--dry-run]")
			}
			if strings.HasPrefix(name, "--") {
				return nil, usage(fmt.Sprintf("invalid server name %q; a flag was given where the name value was expected", name))
			}
			if !utf8.ValidString(name) || len(name) > 80 || strings.TrimSpace(name) != name || strings.ContainsAny(name, "\x00\n\r") {
				return nil, usage(fmt.Sprintf("invalid server name %q; expected at most 80 UTF-8 bytes, no leading/trailing whitespace or control characters", name))
			}
			for _, r := range name {
				if r < 32 || r == 127 {
					return nil, usage(fmt.Sprintf("invalid server name %q; control characters are not allowed", name))
				}
			}
			if dry {
				var s controlSettings
				if e := adminOperation("show", nil, &s); e != nil {
					return nil, e
				}
				return envelope(map[string]any{"dry_run": true, "would": []any{map[string]any{"action": "update", "resource": "server-settings", "input": map[string]any{"name": name}, "known_effects": map[string]any{"previous_name": s.Name}}}}), nil
			}
			var ack struct {
				OK bool `json:"ok"`
			}
			if e := adminOperation("name", map[string]any{"name": name}, &ack); e != nil {
				return nil, e
			}
			if !ack.OK {
				return nil, system("invalid_control_response", "gateway did not acknowledge settings update")
			}
			return envelope(map[string]any{"name": name, "updated": true}), nil
		}
	case "users":
		if args[1] == "list" {
			if e := noArgs(args[2:]); e != nil {
				return nil, e
			}
			var users []controlUser
			if e := adminOperation("users", nil, &users); e != nil {
				return nil, e
			}
			if users == nil {
				return nil, system("invalid_control_response", "gateway returned invalid user list")
			}
			return envelope(map[string]any{"users": users, "count": len(users)}), nil
		}
	case "storage":
		if args[1] == "list" && len(args) == 2 {
			var result struct {
				SchemaVersion int `json:"schema_version"`
				Users         []struct {
					ID         string `json:"id"`
					Username   string `json:"username"`
					UsageBytes uint64 `json:"usage_bytes"`
					LimitBytes uint64 `json:"limit_bytes"`
				} `json:"users"`
				Filesystem struct {
					CapacityBytes uint64 `json:"capacity_bytes"`
					FreeBytes     uint64 `json:"free_bytes"`
				} `json:"filesystem"`
				Overcommitted bool `json:"overcommitted"`
			}
			if e := adminOperation("quota_users", nil, &result); e != nil {
				return nil, e
			}
			if result.SchemaVersion != 1 || result.Users == nil || result.Filesystem.CapacityBytes == 0 {
				return nil, system("invalid_control_response", "gateway returned invalid storage information")
			}
			return envelope(result), nil
		}
		if args[1] == "update" && len(args) >= 5 && args[3] == "--limit-bytes" {
			id := args[2]
			n, e := strconv.ParseUint(id, 10, 64)
			if e != nil || n == 0 || strconv.FormatUint(n, 10) != id {
				return nil, usage("expected canonical numeric GitHub subject")
			}
			limit, e := parseQuotaArg(args[4])
			if e != nil {
				return nil, e
			}
			dry := len(args) == 6 && args[5] == "--dry-run"
			if len(args) != 5 && !dry {
				return nil, usage("expected admin storage update <subject> --limit-bytes <bytes> [--dry-run]")
			}
			if dry {
				return envelope(map[string]any{"dry_run": true, "would": []any{map[string]any{"action": "update", "resource": "user-storage", "input": map[string]any{"subject": id, "limit_bytes": limit}, "unknown_until_apply": []string{"binding_and_quota_at_commit"}}}}), nil
			}
			var ack struct {
				OK bool `json:"ok"`
			}
			if e := adminOperation("quota_set", map[string]any{"subject": id, "limit_bytes": limit}, &ack); e != nil {
				return nil, e
			}
			if !ack.OK {
				return nil, system("invalid_control_response", "gateway did not acknowledge quota update")
			}
			return envelope(map[string]any{"subject": id, "limit_bytes": limit, "updated": true}), nil
		}
	case "role":
		if args[1] == "update" {
			if len(args) < 5 || args[3] != "--administrator" {
				return nil, usage("expected admin role update <canonical numeric GitHub subject> --administrator true|false [--dry-run]")
			}
			id := args[2]
			n, err := strconv.ParseUint(id, 10, 64)
			if err != nil || n == 0 || strconv.FormatUint(n, 10) != id {
				return nil, usage(fmt.Sprintf("invalid GitHub subject %q; expected a positive canonical decimal ID", id))
			}
			if args[4] != "true" && args[4] != "false" {
				return nil, usage(fmt.Sprintf("invalid administrator value %q; expected true or false", args[4]))
			}
			grant := args[4] == "true"
			dry := len(args) == 6 && args[5] == "--dry-run"
			if len(args) != 5 && !dry {
				return nil, usage("expected admin role update <subject> --administrator true|false [--dry-run]")
			}
			if dry {
				var s controlSettings
				if e := adminOperation("show", nil, &s); e != nil {
					return nil, e
				}
				if grant {
					var users []controlUser
					if e := adminOperation("users", nil, &users); e != nil {
						return nil, e
					}
					found := false
					for _, u := range users {
						if u.ID == id {
							found = true
							break
						}
					}
					if !found {
						return nil, &cliError{code: "not_found", message: fmt.Sprintf("GitHub subject %q is not bound; sign in first", id), exit: 1}
					}
				}
				return envelope(map[string]any{"dry_run": true, "would": []any{map[string]any{"action": "update", "resource": "browser-role", "input": map[string]any{"subject": id, "administrator": grant}, "unknown_until_apply": []string{"binding_and_role_at_commit"}}}}), nil
			}
			var ack struct {
				OK bool `json:"ok"`
			}
			if e := adminOperation("role", map[string]any{"subject": id, "administrator": grant}, &ack); e != nil {
				return nil, e
			}
			if !ack.OK {
				return nil, system("invalid_control_response", "gateway did not acknowledge role update")
			}
			return envelope(map[string]any{"subject": id, "administrator": grant, "updated": true}), nil
		}
	}
	return nil, usage("expected admin settings show|update, admin users list, admin role update, or admin storage list|update")
}

func parseQuotaArg(raw string) (uint64, error) {
	n, e := strconv.ParseUint(raw, 10, 64)
	if e != nil || n < 1024 || n > 9007199254740991 || n%1024 != 0 || strconv.FormatUint(n, 10) != raw {
		return 0, usage("invalid quota limit; expected a positive multiple of 1024 bytes no greater than 9007199254740991")
	}
	return n, nil
}
