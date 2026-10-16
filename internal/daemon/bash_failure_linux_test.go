//go:build linux

package daemon

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestBashFailure(t *testing.T) {
	for _, tt := range []struct {
		name, text, kind string
		failed           bool
		amount           int
	}{
		{"bash", "usage error\n\nCommand exited with code 2\n", "exit", true, 2},
		{"bash", "Command timed out after 30 seconds", "timeout", true, 30},
		{"bash", "Command aborted", "aborted", true, 0},
		{"bash", "Command exited with code 2\nmore output", "", true, 0},
		{"bash", "Command exited with code 999999999999999999999", "", true, 0},
		{"bash", "Command exited with code 2", "", false, 0},
		{"extension", "Command exited with code 2", "", true, 0},
		{"bash", "unknown failure", "", true, 0},
	} {
		got := parseBashFailure(tt.name, tt.failed, tt.text)
		if tt.kind == "" {
			if got != nil {
				t.Errorf("unexpected cause: %+v", got)
			}
			continue
		}
		if got == nil || got.Kind != tt.kind {
			t.Fatalf("%q: %+v", tt.text, got)
		}
		if tt.kind != "aborted" && (got.Amount == nil || *got.Amount != tt.amount) {
			t.Fatalf("wrong amount: %+v", got)
		}
	}
}
func TestBashFailureNativeProjection(t *testing.T) {
	e := nativeBlocks(nativeEntry{ID: "failure", Type: "message", Message: []byte(`{"role":"toolResult","toolName":"bash","toolCallId":"bash1","isError":true,"content":[{"type":"text","text":"usage\nCommand exited with code 2"}]}`)})
	if e.FailureCause == nil || e.FailureCause.Kind != "exit" || *e.FailureCause.Amount != 2 {
		t.Fatalf("missing native cause: %+v", e)
	}
	if len(e.Blocks) != 1 || e.Blocks[0].Text != "usage\nCommand exited with code 2" {
		t.Fatal("native text was mutated")
	}
}

func TestLiveBashFailureSurvivesOutputPreviewCap(t *testing.T) {
	j := newEventJournal()
	c := &ConversationController{journal: j}
	agent := "pi:11111111-1111-4111-8111-111111111111"
	raw, _ := json.Marshal(map[string]any{
		"type": "tool_execution_end", "toolCallId": "failed-call", "toolName": "bash", "isError": true,
		"result": map[string]any{"content": []map[string]string{{"type": "text", "text": strings.Repeat("x", 6000) + "\nCommand exited with code 2"}}},
	})
	c.publishDelta(agent, raw)
	_, _, _, tails := j.turnView()
	var event struct {
		Payload struct {
			State string       `json:"state"`
			Text  string       `json:"text"`
			Cause *bashFailure `json:"failure_cause"`
		} `json:"payload"`
	}
	if len(tails[agent].frames) != 1 {
		t.Fatalf("unexpected frames: %s", joinTail(tails[agent].frames))
	}
	if err := json.Unmarshal(tails[agent].frames[0], &event); err != nil {
		t.Fatal(err)
	}
	if event.Payload.State != "failed" || event.Payload.Cause == nil || event.Payload.Cause.Amount == nil || *event.Payload.Cause.Amount != 2 {
		t.Fatalf("cause lost: %+v", event.Payload)
	}
	if len(event.Payload.Text) > 4096 || strings.Contains(event.Payload.Text, "Command exited") {
		t.Fatal("expected a capped output preview, independently of cause")
	}
}
