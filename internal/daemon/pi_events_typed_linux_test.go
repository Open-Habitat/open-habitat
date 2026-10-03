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
