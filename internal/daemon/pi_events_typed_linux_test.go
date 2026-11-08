//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"unicode/utf8"
)

func TestThinkingDeltasStayTypedAndRespectRedaction(t *testing.T) {
	j := newEventJournal()
	c := &ConversationController{journal: j}
	agent := "pi:11111111-1111-4111-8111-111111111111"
	for _, event := range []string{
		`{"type":"message_update","assistantMessageEvent":{"type":"thinking_delta","contentIndex":0,"delta":"think"}}`,
		`{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":1,"delta":"answer"}}`,
		`{"type":"message_end","message":{"role":"assistant","stopReason":"stop","content":[{"type":"thinking","thinking":"think","thinkingSignature":"secret"},{"type":"thinking","thinking":"[Reasoning redacted]","thinkingSignature":"redacted secret","redacted":true}]}}`,
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

func TestPi13ThinkingChunksDoNotOverflowOnFinalMessage(t *testing.T) {
	j := newEventJournal()
	c := &ConversationController{journal: j}
	agent := "pi:11111111-1111-4111-8111-111111111111"
	// Actual wire order: small deltas followed by a potentially large final
	// message. Re-emitting that final block would overflow the live tail.
	for range 8 {
		raw, _ := json.Marshal(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "thinking_delta", "contentIndex": 0, "delta": strings.Repeat("x", 1024)}})
		c.publishDelta(agent, raw)
	}
	c.publishDelta(agent, json.RawMessage(`{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":1,"delta":"answer"}}`))
	final, _ := json.Marshal(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "stop", "content": []any{map[string]any{"type": "thinking", "thinking": strings.Repeat("x", 8192)}}}})
	c.publishDelta(agent, final)
	_, _, _, tails := j.turnView()
	frames := tails[agent].frames
	thinking, answer := "", ""
	for _, frame := range frames {
		var event struct {
			Kind    string `json:"kind"`
			Payload struct {
				Text string `json:"text"`
			} `json:"payload"`
		}
		if err := json.Unmarshal(frame, &event); err != nil {
			t.Fatal(err)
		}
		if event.Kind == "assistant.thinking.delta" {
			thinking += event.Payload.Text
		}
		if event.Kind == "assistant.delta" {
			answer += event.Payload.Text
		}
	}
	if thinking != strings.Repeat("x", 8192) || answer != "answer" || !strings.Contains(string(frames[0]), `"kind":"assistant.thinking.delta"`) {
		t.Fatalf("lost or reordered live thinking/answer after final message: %d thinking bytes, answer %q", len(thinking), answer)
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

func TestOversizeLocalOutputInvalidatesOnlyOnce(t *testing.T) {
	j := newEventJournal()
	agent := "pi:11111111-1111-4111-8111-111111111111"
	// Large chunks are split and kept; only output beyond the tail's byte
	// bound gives the tail up, and only once.
	for range tailBytes/5000 + 40 {
		j.delta(agent, "bash.output", strings.Repeat("x", 5000), 0)
	}
	count := 0
	for _, frame := range j.frames {
		if strings.Contains(string(frame), `"reason":"ring_truncated"`) {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("oversize chunks produced %d invalidations, want 1", count)
	}
}

func TestLargeToolArgumentsAndOutputFitLiveTail(t *testing.T) {
	j := newEventJournal()
	c := &ConversationController{journal: j}
	agent := "pi:11111111-1111-4111-8111-111111111111"
	raw, _ := json.Marshal(map[string]any{
		"type": "tool_execution_end", "toolCallId": "call1", "toolName": "bash",
		"args":   map[string]any{"command": strings.Repeat("a", 3900)},
		"result": map[string]any{"content": []map[string]string{{"type": "text", "text": strings.Repeat("b", 3900)}}},
	})
	c.publishDelta(agent, raw)
	_, _, _, tails := j.turnView()
	if tails[agent].overflow || !strings.Contains(joinTail(tails[agent].frames), "tool.finished") {
		t.Fatalf("bounded tool fields exhausted the tail: overflow=%v", tails[agent].overflow)
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

// A `!` command is not part of Pi's turn: its streamed output survives the
// turn's end and the next turn's start, and only its own entry retires it.
func TestCommandOutputOutlivesTheTurn(t *testing.T) {
	j := newEventJournal()
	agent := "pi:11111111-1111-4111-8111-111111111111"
	j.delta(agent, "assistant.delta", "turn text", 0)
	j.nativeEntry(agent, historyEntry{Key: "reply", Kind: "assistant", Content: historyContent{MediaType: "text/plain", Text: "turn text", Complete: true}})
	// Output still being coalesced when the next turn starts is kept too.
	j.delta(agent, "bash.output", "serving on 8000", 0)
	j.reset(agent, "running")
	j.delta(agent, "assistant.delta", "next turn", 0)
	_, _, _, tails := j.turnView()
	joined := joinTail(tails[agent].frames)
	if !strings.Contains(joined, "serving on 8000") || strings.Contains(joined, "turn text") {
		t.Fatalf("turn boundaries must keep only the command's output: %s", joined)
	}
	j.nativeEntry(agent, historyEntry{Key: "bash", Kind: "bash", Content: historyContent{MediaType: "text/plain", Text: "Local command", Complete: true}})
	_, _, _, tails = j.turnView()
	if joined := joinTail(tails[agent].frames); strings.Contains(joined, "serving on 8000") || !strings.Contains(joined, "next turn") {
		t.Fatalf("the command's entry retires only its output: %s", joined)
	}
}

func joinTail(frames []json.RawMessage) string {
	var parts []string
	for _, f := range frames {
		parts = append(parts, string(f))
	}
	return strings.Join(parts, "\n")
}

func TestLocalCommandDeltasDoNotInvalidateNativeHistory(t *testing.T) {
	for _, kind := range []string{"message_update", "tool_execution_update", "bash_execution_update"} {
		if piEventChangesNative(kind) {
			t.Fatalf("%s is not a persisted entry", kind)
		}
	}
	for _, kind := range []string{"message_end", "entry_appended", "compaction_end"} {
		if !piEventChangesNative(kind) {
			t.Fatalf("%s may have changed native history", kind)
		}
	}
}

func TestLongStreamKeepsMergedTail(t *testing.T) {
	j := newEventJournal()
	agent := "pi:11111111-1111-4111-8111-111111111111"
	want := ""
	// Each delta is flushed on its own, as the 50 ms timer does while a model
	// streams for longer than the tail's frame count.
	for n := range 400 {
		word := fmt.Sprintf("sana%d ", n)
		want += word
		j.delta(agent, "assistant.delta", word, 0)
		j.mu.Lock()
		j.flushTextLocked(agent, j.tail(agent))
		j.mu.Unlock()
	}
	// A large native chunk splits on a rune boundary instead of truncating.
	big := strings.Repeat("ä", 5000)
	want += big
	j.delta(agent, "assistant.delta", big, 0)
	j.progress(agent, "pi.lifecycle", map[string]any{"signal": "turn_end"})
	j.delta(agent, "assistant.thinking.delta", "pohdinta", 1)
	cursor, _, _, tails := j.turnView()
	tail := tails[agent]
	published := 0
	for _, frame := range j.frames {
		if strings.Contains(string(frame), `"ring_truncated"`) {
			t.Fatal("long stream truncated the tail")
		}
		if strings.Contains(string(frame), `"assistant.delta"`) {
			published++
		}
	}
	if published < 400 {
		t.Fatalf("subscribers received %d text events, want every flush", published)
	}
	got, kinds := "", []string{}
	last := uint64(0)
	for _, frame := range tail.frames {
		var event struct {
			Kind     string `json:"kind"`
			Sequence uint64 `json:"sequence"`
			Payload  struct {
				Text  string `json:"text"`
				Index int    `json:"content_index"`
			} `json:"payload"`
		}
		if json.Unmarshal(frame, &event) != nil || event.Sequence <= last || len(frame) > tailFrameBytes || !utf8.ValidString(event.Payload.Text) {
			t.Fatalf("invalid merged frame %s", frame)
		}
		last = event.Sequence
		if event.Kind == "assistant.delta" {
			got += event.Payload.Text
		}
		kinds = append(kinds, event.Kind)
	}
	if got != want || len(tail.frames) > 10 || kinds[len(kinds)-1] != "assistant.thinking.delta" || kinds[len(kinds)-2] != "pi.lifecycle" {
		t.Fatalf("merged tail: %d frames %v, text intact %v", len(tail.frames), kinds, got == want)
	}
	if !strings.HasSuffix(cursor, fmt.Sprintf(":%d", j.seq)) || last > j.seq {
		t.Fatal("tail is not covered by the snapshot cursor")
	}
}

// piToolTurn is one tool-calling model turn of a long run as Pi's RPC sends
// it, sized like a busy real turn: some thinking, a command, and a result at
// the live projection's 4 KiB cap, also seen once as cumulative progress.
func piToolTurn(c *ConversationController, agent string, n int) {
	call := fmt.Sprintf("call_%03d", n)
	args := map[string]any{"command": strings.Repeat("c", 200)}
	result := map[string]any{"content": []map[string]string{{"type": "text", "text": strings.Repeat("r", 4096)}}}
	for _, event := range []map[string]any{
		{"type": "turn_start"},
		{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "thinking_delta", "contentIndex": 0, "delta": strings.Repeat("t", 1024)}},
		{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "toolcall_delta", "contentIndex": 1, "delta": `{"command":"` + strings.Repeat("c", 200) + `"}`}},
		{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "toolcall_end", "contentIndex": 1, "toolCall": map[string]any{"id": call, "name": "bash", "arguments": args}}},
		{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "toolUse"}},
		{"type": "tool_execution_start", "toolCallId": call, "toolName": "bash", "args": args},
		{"type": "tool_execution_update", "toolCallId": call, "toolName": "bash", "args": args, "partialResult": result},
		{"type": "tool_execution_end", "toolCallId": call, "toolName": "bash", "args": args, "result": result},
		{"type": "turn_end"},
	} {
		raw, _ := json.Marshal(event)
		c.publishDelta(agent, raw)
	}
}

// Pi publishes a run's history entries only when it settles, so the live tail
// holds every model turn of the run. The longest run measured on a real host
// (2026-10-27) made 55 tool calls; at the busy size above it must stay live
// from start to end. A tail given up and resumed at a later turn_start would
// look whole at the end, so the event ring is checked for any give-up.
func TestLongRunFitsLiveTail(t *testing.T) {
	j := newEventJournal()
	c := &ConversationController{journal: j}
	agent := "pi:11111111-1111-4111-8111-111111111111"
	c.publishDelta(agent, json.RawMessage(`{"type":"agent_start"}`))
	const turns = 55
	for n := range turns {
		piToolTurn(c, agent, n)
	}
	_, _, _, tails := j.turnView()
	tail := tails[agent]
	t.Logf("%d tool-calling turns: %d tail frames, %d tail bytes (%.1f frames, %d bytes per turn)", turns, len(tail.frames), tail.bytes, float64(len(tail.frames))/turns, tail.bytes/turns)
	for _, frame := range j.frames {
		if strings.Contains(string(frame), `"reason":"ring_truncated"`) {
			t.Fatalf("long run gave up the live tail: frames=%d bytes=%d", len(tail.frames), tail.bytes)
		}
	}
	if len(tail.frames) != 1+turns*8 || tail.overflow {
		t.Fatalf("long run tail: %d frames, overflow=%v", len(tail.frames), tail.overflow)
	}
}

// The end of Pi's compaction says how it ended, whoever asked for it, so the
// conversation can show a failure with its reason; Pi's error text stays out.
func TestCompactionEndCarriesItsOutcome(t *testing.T) {
	agent := "pi:11111111-1111-4111-8111-111111111111"
	for raw, want := range map[string]string{
		`{"type":"compaction_end","reason":"manual","result":{"summary":"private-summary"},"aborted":false}`:                        "done",
		`{"type":"compaction_end","reason":"manual","aborted":false,"errorMessage":"Compaction failed: Already compacted"}`:         "already_compacted",
		`{"type":"compaction_end","reason":"manual","aborted":false,"errorMessage":"Compaction failed: Nothing to compact (x)"}`:    "nothing_to_compact",
		`{"type":"compaction_end","reason":"manual","aborted":true}`:                                                                "cancelled",
		`{"type":"compaction_end","reason":"threshold","aborted":false,"errorMessage":"Compaction failed: private-provider-error"}`: "failed",
		`{"type":"compaction_end","reason":"overflow","result":null,"aborted":false}`:                                               "failed",
	} {
		j := newEventJournal()
		c := &ConversationController{journal: j}
		c.publishDelta(agent, json.RawMessage(raw))
		_, _, _, tails := j.turnView()
		frames := tails[agent].frames
		if len(frames) != 1 || !strings.Contains(string(frames[0]), `"outcome":"`+want+`"`) || strings.Contains(string(frames[0]), "private-") {
			t.Fatalf("%s: %s", raw, frames)
		}
	}
}

// Pi compacts after the answer it is saving: the saved answer retires the
// turn's provisional frames but leaves the compaction's markers.
func TestSavedAnswerKeepsCompactionMarkers(t *testing.T) {
	j := newEventJournal()
	c := &ConversationController{journal: j}
	agent := "pi:11111111-1111-4111-8111-111111111111"
	j.delta(agent, "assistant.delta", "vastaus", 0)
	c.publishDelta(agent, json.RawMessage(`{"type":"compaction_start","reason":"threshold"}`))
	c.publishDelta(agent, json.RawMessage(`{"type":"compaction_end","reason":"threshold","aborted":false,"errorMessage":"Compaction failed: x"}`))
	j.nativeEntry(agent, historyEntry{Key: "a1", Kind: "assistant"})
	_, _, _, tails := j.turnView()
	frames := joinTail(tails[agent].frames)
	if strings.Contains(frames, "assistant.delta") || !strings.Contains(frames, `"marker":"compaction_start"`) || !strings.Contains(frames, `"outcome":"failed"`) {
		t.Fatalf("tail after the saved answer: %s", frames)
	}
}
