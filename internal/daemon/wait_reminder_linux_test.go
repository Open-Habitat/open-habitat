//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

// The person sees which runs the turn-end reminder named, never its English
// text or the wait command it gives the agent; both native entry forms count.
func TestWaitReminderIsPresentedFromItsDetails(t *testing.T) {
	const run, other = "01m531x6y92ggdqcmb1exzmn00", "01m531x6y92ggdqcmb1exzmn01"
	body := `"customType":"oh-wait-reminder","display":true,"content":"[Open Habitat] A Taskfleet run you started is still working: taskfleet run wait ` + run + ` --any","details":{"schema_version":1,` +
		`"runs":["` + run + `","bad","` + other + `"],"titles":["worker-presentation",3]}`
	for _, e := range []nativeEntry{
		{ID: "a", Type: "custom_message", Raw: json.RawMessage(`{"type":"custom_message",` + body + `}`)},
		{ID: "b", Type: "message", Message: json.RawMessage(`{"role":"custom",` + body + `}`)},
	} {
		got := nativeBlocks(e)
		if got.Kind != "unknown" || got.WaitReminder == nil || len(got.Blocks) != 0 || got.Content.Text != "" {
			t.Fatalf("%s: %+v", e.Type, got)
		}
		want := waitReminder{Runs: []restartRun{{ID: run, Title: "worker-presentation"}, {ID: other}}}
		if a, b := mustJSON(got.WaitReminder), mustJSON(want); a != b {
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
			t.Fatalf("%s: reminder content selectable by block read", e.Type)
		}
	}
	ids := make([]string, 22)
	for i := range ids {
		ids[i] = fmt.Sprintf(`"01m531x6y92ggdqcmb1exzmn%02d"`, i)
	}
	many := nativeBlocks(nativeEntry{ID: "c", Type: "custom_message", Raw: json.RawMessage(`{"type":"custom_message","customType":"oh-wait-reminder","display":true,"content":"x","details":{"runs":[` + strings.Join(ids, ",") + `]}}`)})
	if many.WaitReminder == nil || len(many.WaitReminder.Runs) != 20 || many.WaitReminder.More != 2 {
		t.Fatalf("over twenty runs: %+v", many.WaitReminder)
	}
	for _, raw := range []string{
		`{"type":"custom_message","customType":"oh-wait-reminder","display":false,"content":"x","details":{"runs":["` + run + `"]}}`,
		`{"type":"custom_message","customType":"oh-wait-reminder","display":true,"content":"x","details":{"runs":["bad"]}}`,
	} {
		if hidden := nativeBlocks(nativeEntry{ID: "d", Type: "custom_message", Raw: json.RawMessage(raw)}); hidden.Kind != "" {
			t.Fatalf("a reminder with nothing to show became visible: %+v", hidden)
		}
	}
}
