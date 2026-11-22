package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Turn snapshots in the synthetic host (scenario pi-snapshots). The fake
// stands in for the recorder and the rewind extension the way rewind.go does
// for the per-file copies, but the snapshots are real: the recorder's own
// module (turn-snapshot-helper.mjs) writes the conversation's store under
// ~/.pi/agent/file-history, so the real daemon compares real trees. A turn
// whose message says "skripti" changes the workspace only through shell
// commands: a Python script, sed -i and rm. The recorder and the extension
// themselves are proven against the pinned Pi in
// internal/daemon/turn_snapshots_native_linux_test.go.

func snapshotScenario(home string) bool {
	mode, _ := os.ReadFile(filepath.Join(filepath.Dir(home), "fakepi-scenario"))
	return strings.TrimSpace(string(mode)) == "pi-snapshots"
}

// The file the script's turn removes; it is put in place first, untracked
// but recorded.
const snapshotRemoved = "vanha-raportti.txt"

var snapshotCommands = []string{
	`python3 -c "open('data.csv', 'a').write('4,2\n')"`,
	`sed -i 's/sisältö/analyysi/' analyysi.py`,
	`rm ` + snapshotRemoved,
}

func snapshotHelper(command string, input map[string]any, out any) error {
	home := os.Getenv("HOME")
	node, err := os.ReadFile(filepath.Join(filepath.Dir(home), "fakepi-node"))
	if err != nil {
		return err
	}
	repo, err := os.ReadFile(filepath.Join(filepath.Dir(home), "fakepi-repo"))
	if err != nil {
		return err
	}
	b, _ := json.Marshal(input)
	cmd := exec.Command(strings.TrimSpace(string(node)), filepath.Join(strings.TrimSpace(string(repo)), "test", "browser-host", "turn-snapshot-helper.mjs"), command, string(b))
	cmd.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin", "TMPDIR=" + filepath.Dir(home)}
	result, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("snapshot helper %s: %w", command, err)
	}
	return json.Unmarshal(result, out)
}

type snapshotResult struct {
	StartedAt string         `json:"startedAt"`
	Tree      *string        `json:"tree"`
	Reason    *string        `json:"reason"`
	Root      *string        `json:"root"`
	Skipped   map[string]any `json:"skipped"`
}

// snapshotRecord takes a snapshot and returns the recorder's entry for it.
func (s *fakeSession) snapshotRecord(user, phase string) (map[string]any, snapshotResult) {
	var r snapshotResult
	agentDir := filepath.Join(os.Getenv("HOME"), ".pi", "agent")
	if err := snapshotHelper("snapshot", map[string]any{"agentDir": agentDir, "storeId": s.id, "cwd": s.cwd, "sessionFile": s.path, "label": user + "-" + phase}, &r); err != nil {
		reason := "snapshot-failed"
		r = snapshotResult{StartedAt: time.Now().UTC().Format(time.RFC3339Nano), Reason: &reason, Skipped: map[string]any{"count": 0, "paths": []any{}, "truncated": false}}
	}
	return map[string]any{"version": 1, "userEntryId": user, "phase": phase, "tree": r.Tree, "reason": r.Reason, "store": s.id, "root": r.Root, "cwd": s.cwd, "timestamp": r.StartedAt, "skipped": r.Skipped}, r
}

// snapshotTurn records the run's start, changes the files through shell
// commands as tool calls, and returns the run's end for after the reply.
func (s *fakeSession) snapshotTurn(emit func(any)) func() {
	user := s.lastMessage
	if _, err := os.Stat(filepath.Join(s.cwd, snapshotRemoved)); os.IsNotExist(err) {
		_ = os.WriteFile(filepath.Join(s.cwd, snapshotRemoved), []byte("vanha raportti\npoistetaan\n"), 0600)
	}
	start, began := s.snapshotRecord(user, "start")
	s.append(map[string]any{"type": "custom", "customType": "turn-snapshot", "data": start})
	for i, command := range snapshotCommands {
		id := fmt.Sprintf("snapshot-%d-%d", time.Now().UnixNano(), i)
		args := map[string]any{"command": command}
		emit(map[string]any{"type": "tool_execution_start", "toolName": "bash", "toolCallId": id, "args": args})
		cmd := exec.Command("/bin/sh", "-c", command)
		cmd.Dir = s.cwd
		cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + os.Getenv("HOME")}
		output, err := cmd.CombinedOutput()
		s.append(message("assistant", []map[string]any{{"type": "toolCall", "name": "bash", "id": id, "arguments": args}}, nil))
		s.append(message("toolResult", []map[string]any{{"type": "text", "text": string(output)}}, map[string]any{"toolCallId": id, "toolName": "bash", "isError": err != nil}))
		emit(map[string]any{"type": "tool_execution_end", "toolName": "bash", "toolCallId": id, "args": args, "result": map[string]any{"content": []map[string]any{{"type": "text", "text": string(output)}}}, "isError": err != nil})
	}
	return func() {
		end, ended := s.snapshotRecord(user, "end")
		end["outcome"] = "completed"
		if began.Tree != nil && ended.Tree != nil {
			var stat map[string]any
			if snapshotHelper("stat", map[string]any{"agentDir": filepath.Join(os.Getenv("HOME"), ".pi", "agent"), "storeId": s.id, "from": *began.Tree, "to": *ended.Tree}, &stat) == nil {
				end["stat"] = stat
			}
		}
		s.append(map[string]any{"type": "custom", "customType": "turn-snapshot", "data": end})
	}
}

// snapshotRewind restores the files the runs changed since entry from its
// start snapshot, as the rewind extension does, and says how many changed.
func (s *fakeSession) snapshotRewind(entry string) int {
	var out struct {
		Restored int `json:"restored"`
	}
	if snapshotHelper("rewind", map[string]any{"agentDir": filepath.Join(os.Getenv("HOME"), ".pi", "agent"), "storeId": s.id, "sessionFile": s.path, "entry": entry}, &out) != nil {
		return 0
	}
	return out.Restored
}
