//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/testpython"
)

// The person sees the catch-up's details, never its agent-facing English text
// or the raw commands it repeats; both native entry forms are recognised.
func TestRestartCatchUpIsPresentedFromItsDetails(t *testing.T) {
	const run, live = "01m531x6y92ggdqcmb1exzmn00", "01m531x6y92ggdqcmb1exzmn01"
	body := `"customType":"oh-resume-catch-up","display":true,"content":"[Open Habitat] This conversation's Pi had stopped: taskfleet run wait ` + run + `","details":{"schema_version":1,"stopped":{"cause":"idle","at":"2026-10-26T18:20:00Z"},"interrupted_turn":true,` +
		`"processes":[{"id":"proc_8ffc","startTime":1,"name":"wait-gate-evidence"},{"id":"bad","startTime":2,"name":"x"}],` +
		`"spinoffs":[{"run_id":"` + run + `","state":"stalled","title":"release pilot.12","summary":"Taskfleet's words","branch":"wt/pilot","ended_at":"2026-10-26T18:41:00Z"},{"run_id":"` + run + `","state":"invented","title":"x"}],` +
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
			Stopped:         map[string]any{"cause": "idle", "at": "2026-10-26T18:20:00Z"},
			InterruptedTurn: true,
			Processes:       []restartProcess{{"proc_8ffc", "wait-gate-evidence"}},
			Runs:            []restartRun{{run, "release pilot.12", "stalled", "Taskfleet's words", "2026-10-26T18:41:00Z", "wt/pilot", 0, ""}},
			StillRunning:    []restartRun{{ID: live, Title: "gate"}, {ID: run}},
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

// The branch's last message says whether Pi stopped in the middle of a turn:
// the same rule as the companion's branchFacts (catch-up.test.mjs).
func TestBranchScanSeesACutTurn(t *testing.T) {
	line := func(id, parent, message string) string {
		p := "null"
		if parent != "" {
			p = `"` + parent + `"`
		}
		if message == "" {
			return `{"type":"session_info","id":"` + id + `","parentId":` + p + `,"timestamp":"2030-01-01T00:00:00Z","name":"otsikko"}`
		}
		if message == "restart" {
			return `{"type":"custom","customType":"oh-restart-stop","id":"` + id + `","parentId":` + p + `,"timestamp":"2030-01-01T00:00:00Z","data":{"schema_version":1}}`
		}
		return `{"type":"message","id":"` + id + `","parentId":` + p + `,"timestamp":"2030-01-01T00:00:00Z","message":` + message + `}`
	}
	prompt, call, result := `{"role":"user","content":"x"}`, `{"role":"assistant","stopReason":"toolUse"}`, `{"role":"toolResult","toolName":"read"}`
	answer, aborted := `{"role":"assistant","stopReason":"stop"}`, `{"role":"assistant","stopReason":"aborted"}`
	shell, note := `{"role":"bashExecution","command":"git status"}`, `{"role":"custom","customType":"oh-resume-catch-up"}`
	for _, tc := range []struct {
		name  string
		lines []string
		cut   bool
	}{
		{"answered, then titled", []string{line("e1", "", prompt), line("e2", "e1", call), line("e3", "e2", result), line("e4", "e3", answer), line("e5", "e4", "")}, false},
		{"unanswered prompt", []string{line("e1", "", prompt)}, true},
		{"tool call without result", []string{line("e1", "", prompt), line("e2", "e1", call)}, true},
		{"unanswered tool result", []string{line("e1", "", prompt), line("e2", "e1", call), line("e3", "e2", result)}, true},
		{"aborted reply", []string{line("e1", "", prompt), line("e2", "e1", aborted)}, false},
		// The daemon marked its own stop ahead of the abort: the restart cut
		// the turn, also when a running tool's abort is saved as an error.
		{"reply aborted by a restart", []string{line("e1", "", prompt), line("e2", "e1", "restart"), line("e3", "e2", aborted)}, true},
		{"tool aborted by a restart", []string{line("e1", "", prompt), line("e2", "e1", call), line("e3", "e2", "restart"), line("e4", "e3", result), line("e5", "e4", `{"role":"assistant","stopReason":"error","errorMessage":"This operation was aborted"}`)}, true},
		// A mark from an earlier turn does not make the person's own stop a cut.
		{"person's stop after a restarted turn", []string{line("e1", "", prompt), line("e2", "e1", "restart"), line("e3", "e2", aborted), line("e4", "e3", prompt), line("e5", "e4", aborted)}, false},
		{"restart while idle", []string{line("e1", "", prompt), line("e2", "e1", answer), line("e3", "e2", "restart")}, false},
		// The person's `!command` and Habitat's messages are not the answer.
		{"shell after a tool result", []string{line("e1", "", prompt), line("e2", "e1", call), line("e3", "e2", result), line("e4", "e3", shell)}, true},
		{"custom after the prompt", []string{line("e1", "", prompt), line("e2", "e1", note)}, true},
		{"shell after the answer", []string{line("e1", "", prompt), line("e2", "e1", answer), line("e3", "e2", shell)}, false},
		// Only the active leaf's ancestry counts.
		{"cut sibling branch", []string{line("e1", "", prompt), line("e2", "e1", answer), line("e3", "e2", prompt), line("e4", "e2", "")}, false},
	} {
		if got := scanBranch([]byte(strings.Join(tc.lines, "\n"))).turnCut; got != tc.cut {
			t.Errorf("%s: turnCut %v, want %v", tc.name, got, tc.cut)
		}
	}
}

// A turn ended in an error when the branch's last message is a reply the
// provider failed; a retry's answer or the person's next prompt ends that.
func TestBranchScanSeesAnErrorTurn(t *testing.T) {
	line := func(id, parent, message string) string {
		p := "null"
		if parent != "" {
			p = `"` + parent + `"`
		}
		if message == "" {
			return `{"type":"session_info","id":"` + id + `","parentId":` + p + `,"timestamp":"2030-01-01T00:00:00Z","name":"otsikko"}`
		}
		return `{"type":"message","id":"` + id + `","parentId":` + p + `,"timestamp":"2030-01-01T00:00:00Z","message":` + message + `}`
	}
	prompt, answer, failed := `{"role":"user","content":"x"}`, `{"role":"assistant","stopReason":"stop"}`, `{"role":"assistant","stopReason":"error","errorMessage":"overloaded"}`
	aborted, shell := `{"role":"assistant","stopReason":"aborted"}`, `{"role":"bashExecution","command":"git status"}`
	stoppedTool := `{"role":"assistant","stopReason":"error","errorMessage":"This operation was aborted"}`
	for _, tc := range []struct {
		name  string
		lines []string
		error bool
	}{
		{"failed reply", []string{line("e1", "", prompt), line("e2", "e1", failed)}, true},
		{"failed, then titled", []string{line("e1", "", prompt), line("e2", "e1", failed), line("e3", "e2", "")}, true},
		{"failed, then the shell", []string{line("e1", "", prompt), line("e2", "e1", failed), line("e3", "e2", shell)}, true},
		{"retried", []string{line("e1", "", prompt), line("e2", "e1", failed), line("e3", "e2", answer)}, false},
		{"asked again", []string{line("e1", "", prompt), line("e2", "e1", failed), line("e3", "e2", prompt)}, false},
		{"answered", []string{line("e1", "", prompt), line("e2", "e1", answer)}, false},
		{"stopped by the person", []string{line("e1", "", prompt), line("e2", "e1", aborted)}, false},
		{"stopped while a tool ran", []string{line("e1", "", prompt), line("e2", "e1", stoppedTool)}, false},
		{"failed sibling branch", []string{line("e1", "", prompt), line("e2", "e1", failed), line("e3", "e1", answer)}, false},
	} {
		if got := scanBranch([]byte(strings.Join(tc.lines, "\n"))).turnError; got != tc.error {
			t.Errorf("%s: turnError %v, want %v", tc.name, got, tc.error)
		}
	}
}

func validateHistoryPage(t *testing.T, page string) {
	t.Helper()
	python := testpython.Validator(t)
	cmd := exec.Command(python, "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); m['Draft202012Validator'](m['schemas']['history.schema.json'],registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`)
	cmd.Stdin = bytes.NewReader([]byte(page))
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("schema: %s: %v", out, err)
	}
}

// The person begins a turn with a message after a finished one; a steer into
// an open turn and an agent wake-up do not begin one.
func TestBranchScanSeesWhenThePersonBeganTheTurn(t *testing.T) {
	line := func(id, parent, at, message string) string {
		p := "null"
		if parent != "" {
			p = `"` + parent + `"`
		}
		return `{"type":"message","id":"` + id + `","parentId":` + p + `,"timestamp":"2030-01-01T00:` + at + `Z","message":` + message + `}`
	}
	ms := func(at string) int64 {
		v, _ := time.Parse(time.RFC3339, "2030-01-01T00:"+at+"Z")
		return v.UnixMilli()
	}
	prompt, call, result := `{"role":"user","content":"x"}`, `{"role":"assistant","stopReason":"toolUse"}`, `{"role":"toolResult","toolName":"process"}`
	answer, wake := `{"role":"assistant","stopReason":"stop"}`, `{"role":"custom","customType":"ad-process:notification"}`
	for _, tc := range []struct {
		name  string
		lines []string
		want  int64
	}{
		{"none", []string{}, 0},
		{"first prompt", []string{line("e1", "", "01:00", prompt), line("e2", "e1", "02:00", answer)}, ms("01:00")},
		{"second prompt", []string{line("e1", "", "01:00", prompt), line("e2", "e1", "02:00", answer), line("e3", "e2", "03:00", prompt), line("e4", "e3", "04:00", answer)}, ms("03:00")},
		{"steer into an open turn", []string{line("e1", "", "01:00", prompt), line("e2", "e1", "02:00", call), line("e3", "e2", "03:00", result), line("e4", "e3", "04:00", prompt), line("e5", "e4", "05:00", answer)}, ms("01:00")},
		{"wake-up turn", []string{line("e1", "", "01:00", prompt), line("e2", "e1", "02:00", answer), line("e3", "e2", "03:00", wake), line("e4", "e3", "04:00", answer)}, ms("01:00")},
	} {
		if got := scanBranch([]byte(strings.Join(tc.lines, "\n"))).turnAt; got != tc.want {
			t.Errorf("%s: turnAt %d, want %d", tc.name, got, tc.want)
		}
	}
}
