package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

// Keep parked workers in native-shaped Taskfleet state so snapshots and
// subsequent host journal updates cannot disagree about their parents.
func writeParkedWorker(home, parent string) error {
	if !regexp.MustCompile(`^[0-9a-f-]{36}$`).MatchString(parent) {
		return fmt.Errorf("invalid parent")
	}
	root := filepath.Join(home, ".taskfleet")
	var list struct {
		Data struct {
			Runs []map[string]any `json:"runs"`
		} `json:"data"`
	}
	if b, err := os.ReadFile(filepath.Join(root, "fixture-list.json")); err == nil {
		if err := json.Unmarshal(b, &list); err != nil {
			return err
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	runID := fmt.Sprintf("01m53wnktnxb4w2xgdd79%05d", len(list.Data.Runs))
	transcript := "runs/" + runID + "/session.jsonl"
	run := map[string]any{
		"run_id": runID, "kind": "spinoff", "title": "Parked fixture worker", "status": "running",
		"lifecycle": "interactive", "agent_owner": "taskfleet", "source_branch": "main",
		"source_repo": filepath.Join(home, "src", "ordinary-dir"), "created_at": "2026-10-16T16:04:37Z",
		"created_by_session": map[string]string{"harness": "pi", "session_id": parent},
		"supervisor":         map[string]string{"state": "running"},
		"node_transcripts": []any{map[string]any{
			"node_id": "n-0001", "harness": "pi", "support": "supported",
			"live": map[string]any{"anchor": "state-root", "path": transcript, "availability": "available"},
		}},
	}
	if err := os.MkdirAll(filepath.Join(root, "runs", runID), 0700); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(root, transcript), []byte(`{"type":"message","message":{"role":"assistant","stopReason":"stop"}}`+"\n"), 0600); err != nil {
		return err
	}
	list.Data.Runs = append(list.Data.Runs, run)
	for name, value := range map[string]any{
		"fixture-list.json":                map[string]any{"schema_version": 1, "data": list.Data},
		"runs/" + runID + "/manifest.json": run,
	} {
		b, err := json.Marshal(value)
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(root, name), b, 0600); err != nil {
			return err
		}
	}
	return nil
}
