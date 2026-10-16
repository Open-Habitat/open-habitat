//go:build linux

package daemon

import (
	"encoding/json"
	"strconv"
)

// A process tool's human-readable text contains PIDs and log paths; details
// contain raw commands. Project only the identity needed to join the tray.
func processToolResult(raw json.RawMessage) string {
	var r struct {
		Details struct {
			Action  string        `json:"action"`
			Process nativeProcess `json:"process"`
		} `json:"details"`
	}
	if json.Unmarshal(raw, &r) != nil {
		return ""
	}
	d := r.Details
	result := map[string]any{"action": prefixBytes(d.Action, 80)}
	if processIDPattern.MatchString(d.Process.ID) && d.Process.Start > 0 {
		result["process"] = map[string]any{"id": d.Process.ID, "name": prefixBytes(d.Process.Name, 200), "started_at": d.Process.Start, "process_token": "pt_" + strconv.FormatInt(d.Process.Start, 10)}
	}
	wire, _ := json.Marshal(result)
	return string(wire)
}
func processToolArguments(raw json.RawMessage) string {
	var args struct {
		Action  string `json:"action"`
		Name    string `json:"name"`
		ID      string `json:"id"`
		Command string `json:"command"`
	}
	if json.Unmarshal(raw, &args) != nil {
		return ""
	}
	projected := map[string]string{"action": prefixBytes(args.Action, 80)}
	if args.Name != "" {
		projected["name"] = prefixBytes(args.Name, 200)
	}
	if processIDPattern.MatchString(args.ID) {
		projected["id"] = args.ID
	}
	if args.Command != "" {
		projected["command_preview"] = commandPreview(args.Command)
	}
	wire, _ := json.Marshal(projected)
	return string(wire)
}
