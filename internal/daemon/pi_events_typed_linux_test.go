//go:build linux

package daemon

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestThinkingDeltasStayTypedAndRespectRedaction(t *testing.T) {
	j := newEventJournal()
	c := &ConversationController{journal: j}
	agent := "pi:11111111-1111-4111-8111-111111111111"
	for _, event := range []string{
		`{"type":"message_update","assistantMessageEvent":{"type":"thinking_delta","contentIndex":0,"delta":"think","partial":{"content":[{"type":"thinking","redacted":false}]}}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"thinking_delta","contentIndex":0,"delta":" secret","partial":{"content":[{"type":"thinking","redacted":true}]}}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":1,"delta":"answer"}}`,
	} {
		c.publishDelta(agent, json.RawMessage(event))
	}
	_, _, _, tails := j.turnView()
	frames := tails[agent].frames
	if len(frames) != 2 || !strings.Contains(string(frames[0]), `"kind":"assistant.thinking.delta"`) || !strings.Contains(string(frames[1]), `"kind":"assistant.delta"`) {
		t.Fatalf("unexpected typed tail: %s", frames)
	}
	for _, frame := range frames {
		if strings.Contains(string(frame), "secret") {
			t.Fatalf("redacted content escaped: %s", frame)
		}
	}
}

func TestLiveTypedEventsExcludeUncheckedFields(t *testing.T) {
	j := newEventJournal()
	c := &ConversationController{journal: j}
	agent := "pi:11111111-1111-4111-8111-111111111111"
	for _, raw := range []string{
		`{"type":"message_update","assistantMessageEvent":{"type":"toolcall_delta","contentIndex":1,"delta":"{\"path\":"}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"toolcall_end","contentIndex":1,"toolCall":{"id":"call1","name":"read","arguments":{"path":"demo"},"thoughtSignature":"private-signature"}}}`,
		`{"type":"tool_execution_start","toolCallId":"call1","toolName":"read","args":{"path":"demo"}}`,
		`{"type":"tool_execution_update","toolCallId":"call1","toolName":"read","partialResult":{"content":[{"type":"text","text":"progress"},{"type":"image","data":"private-image"}],"details":{"secret":"private-detail"}}}`,
		`{"type":"tool_execution_end","toolCallId":"call1","toolName":"read","result":{"content":[{"type":"text","text":"done"}]}}`,
		`{"type":"bash_execution_update","delta":"command output"}`,
		`{"type":"auto_retry_start","attempt":1,"maxAttempts":3,"errorMessage":"private-error"}`,
		`{"type":"compaction_end","reason":"threshold","result":{"summary":"private-summary"}}`,
		`{"type":"unexpected_provider_event","token":"private-token"}`,
		`{"type":"agent_end","willRetry":true,"messages":[{"content":"private-message"}]}`,
	} {
		c.publishDelta(agent, json.RawMessage(raw))
	}
	_, _, _, tails := j.turnView()
	frames := tails[agent].frames
	for _, kind := range []string{"assistant.toolcall.delta", "assistant.toolcall.end", "tool.started", "tool.updated", "tool.finished", "bash.output", "pi.retry", "pi.marker", "unknown.native", "pi.lifecycle"} {
		found := false
		for _, f := range frames {
			if strings.Contains(string(f), `"kind":"`+kind+`"`) {
				found = true
			}
		}
		if !found {
			t.Fatalf("missing %s: %s", kind, frames)
		}
	}
	for _, f := range frames {
		if strings.Contains(string(f), "private-") {
			t.Fatalf("unchecked data escaped: %s", f)
		}
	}
}

func TestSavedLocalCommandAndMarkers(t *testing.T) {
	bash := json.RawMessage(`{"type":"message","id":"bash1","message":{"role":"bashExecution","command":"echo private-arg","output":"hello world","exitCode":0,"excludeFromContext":true,"details":{"secret":"hidden"}}}`)
	entry := nativeEntry{ID: "bash1", Type: "message", Message: json.RawMessage(`{"role":"bashExecution","command":"echo private-arg","output":"hello world","exitCode":0,"excludeFromContext":true,"details":{"secret":"hidden"}}`), Raw: bash}
	projected := nativeBlocks(entry)
	if projected.Kind != "bash" || len(projected.Blocks) != 2 || projected.Blocks[0].Text != "echo private-arg" || projected.Blocks[1].Text != "hello world" {
		t.Fatalf("local command projection: %+v", projected)
	}
	if raw, _ := json.Marshal(projected); strings.Contains(string(raw), "hidden") {
		t.Fatalf("unchecked metadata escaped: %s", raw)
	}
	chunk, ok := nativeBlockChunk(bash, 1, 0, 65536)
	if !ok || chunk["text"] != "hello world" {
		t.Fatalf("saved command output read: %v %v", chunk, ok)
	}
	marker := nativeBlocks(nativeEntry{ID: "mark1", Type: "session_info", Raw: json.RawMessage(`{"type":"session_info","name":"Demo"}`)})
	if marker.EntryType != "session_info" || marker.Blocks[0].Text != "Demo" {
		t.Fatalf("marker: %+v", marker)
	}
}

func TestCumulativeToolProgressKeepsBoundedTail(t *testing.T) {
	j := newEventJournal()
	c := &ConversationController{journal: j}
	agent := "pi:11111111-1111-4111-8111-111111111111"
	for n := 0; n < 140; n++ {
		c.publishDelta(agent, json.RawMessage(`{"type":"message_update","assistantMessageEvent":{"type":"toolcall_delta","contentIndex":0,"delta":"x"}}`))
	}
	for n := 0; n < 45; n++ {
		raw, _ := json.Marshal(map[string]any{"type": "tool_execution_update", "toolCallId": "call1", "toolName": "bash", "partialResult": map[string]any{"content": []map[string]string{{"type": "text", "text": strings.Repeat("x", 4000)}}}})
		c.publishDelta(agent, raw)
	}
	_, _, _, tails := j.turnView()
	if tails[agent].overflow || len(tails[agent].frames) > 3 {
		t.Fatalf("cumulative progress exhausted tail: overflow=%v frames=%d", tails[agent].overflow, len(tails[agent].frames))
	}
	for _, frame := range tails[agent].frames {
		if strings.Contains(string(frame), `"reason":"ring_truncated"`) {
			t.Fatal("unexpected truncation")
		}
	}
}

func TestSavedResultSupersedesOnlyItsLiveCall(t *testing.T) {
	j := newEventJournal()
	agent := "pi:11111111-1111-4111-8111-111111111111"
	j.progress(agent, "assistant.toolcall.end", map[string]any{"content_index": 1, "tool_call_id": "call1", "tool_name": "read"})
	j.delta(agent, "assistant.toolcall.delta", "unfinished", 1)
	j.progress(agent, "tool.started", map[string]string{"tool_call_id": "call1", "tool_name": "read", "state": "running"})
	j.progress(agent, "tool.started", map[string]string{"tool_call_id": "call2", "tool_name": "write", "state": "running"})
	j.nativeEntry(agent, historyEntry{Key: "result", Kind: "tool", ToolCallID: "call1", Content: historyContent{MediaType: "text/plain", Text: "done", Complete: true}})
	_, _, _, tails := j.turnView()
	joined := joinTail(tails[agent].frames)
	if strings.Contains(joined, "call1") || strings.Contains(joined, "unfinished") || !strings.Contains(joined, "call2") {
		t.Fatalf("saved result failed to replace matching live call: %s", joined)
	}
	j.delta(agent, "bash.output", "local output", 0)
	j.nativeEntry(agent, historyEntry{Key: "bash", Kind: "bash", Content: historyContent{MediaType: "text/plain", Text: "Local command", Complete: true}})
	_, _, _, tails = j.turnView()
	joined = joinTail(tails[agent].frames)
	if strings.Contains(joined, "local output") {
		t.Fatalf("saved local output duplicated: %s", joined)
	}
}

func joinTail(frames []json.RawMessage) string {
	var parts []string
	for _, f := range frames {
		parts = append(parts, string(f))
	}
	return strings.Join(parts, "\n")
}
