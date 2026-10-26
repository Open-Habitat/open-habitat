//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"strings"
	"testing"
)

// The person sees the catch-up's details, never its agent-facing English text
// or the raw commands it repeats; both native entry forms are recognised.
func TestRestartCatchUpIsPresentedFromItsDetails(t *testing.T) {
	const run, live = "01m531x6y92ggdqcmb1exzmn00", "01m531x6y92ggdqcmb1exzmn01"
	body := `"customType":"oh-resume-catch-up","display":true,"content":"[Open Habitat] This conversation's Pi had stopped: taskfleet run wait ` + run + `","details":{"schema_version":1,` +
		`"processes":[{"id":"proc_8ffc","startTime":1,"name":"wait-gate-evidence"},{"id":"bad","startTime":2,"name":"x"}],` +
		`"spinoffs":[{"run_id":"` + run + `","state":"stalled","title":"release pilot.12"},{"run_id":"` + run + `","state":"invented","title":"x"}],` +
		`"rearm":[{"run_id":"` + live + `","title":"gate"},"` + run + `"]}`
	for _, e := range []nativeEntry{
		{ID: "a", Type: "custom_message", Raw: json.RawMessage(`{"type":"custom_message",` + body + `}`)},
		{ID: "b", Type: "message", Message: json.RawMessage(`{"role":"custom",` + body + `}`)},
	} {
		got := nativeBlocks(e)
		if got.Kind != "unknown" || got.Restart == nil || len(got.Blocks) != 0 {
			t.Fatalf("%s: %+v", e.Type, got)
		}
		want := restartNotice{
			Processes:    []restartProcess{{"proc_8ffc", "wait-gate-evidence"}},
			Runs:         []restartRun{{run, "release pilot.12", "stalled"}},
			StillRunning: []restartRun{{ID: live, Title: "gate"}, {ID: run}},
		}
		if a, b := mustJSON(got.Restart), mustJSON(want); a != b {
			t.Fatalf("%s:\n got %s\nwant %s", e.Type, a, b)
		}
		wire := mustJSON(nativeEntryPayload(got))
		if strings.Contains(wire, "Open Habitat") || strings.Contains(wire, "taskfleet run wait") {
			t.Fatalf("agent text reached the browser: %s", wire)
		}
		page := mustJSON(map[string]any{"schema_version": 1, "agent_id": "pi:11111111-1111-4111-8111-111111111111", "native_revision": "r", "entries": []historyEntry{got}, "complete": true})
		validateHistoryPage(t, page)
		raw := e.Raw
		if raw == nil {
			raw = json.RawMessage(`{"type":"message","message":` + string(e.Message) + `}`)
		}
		if _, ok := nativeBlockChunk(raw, 0, 0, 100); ok {
			t.Fatalf("%s: catch-up content selectable by block read", e.Type)
		}
	}
	hidden := nativeBlocks(nativeEntry{ID: "c", Type: "custom_message", Raw: json.RawMessage(`{"type":"custom_message","customType":"oh-resume-catch-up","display":false,"content":"x"}`)})
	if hidden.Kind != "" {
		t.Fatalf("an undisplayed catch-up became visible: %+v", hidden)
	}
}

func validateHistoryPage(t *testing.T, page string) {
	t.Helper()
	python := os.Getenv("PYTHON")
	if python == "" {
		python = "python3"
	}
	cmd := exec.Command(python, "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); m['Draft202012Validator'](m['schemas']['history.schema.json'],registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`)
	cmd.Stdin = bytes.NewReader([]byte(page))
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("schema: %s: %v", out, err)
	}
}
