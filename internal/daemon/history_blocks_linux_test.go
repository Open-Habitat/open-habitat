//go:build linux

package daemon

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestNativeBlocksOrderedAndPrivate(t *testing.T) {
	e := nativeEntry{ID: "entry_1", Type: "message", Message: json.RawMessage(`{"role":"assistant","model":"synthetic","stopReason":"toolUse","diagnostics":{"apiKey":"secret"},"content":[{"type":"thinking","thinking":"private","redacted":true,"thinkingSignature":"secret"},{"type":"text","text":"Hello"},{"type":"toolCall","id":"call-1","name":"read","arguments":{"token":"secret"}},{"type":"image","mimeType":"image/png","data":"secret"},{"type":"future","payload":"secret"}]}`)}
	result := nativeBlocks(e)
	if len(result.Blocks) != 5 || result.Blocks[0].Type != "thinking" || !result.Blocks[0].Redacted || result.Blocks[1].Text != "Hello" || result.Blocks[2].ToolCallID != "call-1" || result.Blocks[3].MimeType != "image/png" || result.Blocks[4].Type != "unknown" {
		t.Fatalf("wrong ordered blocks: %+v", result.Blocks)
	}
	wire, _ := json.Marshal(nativeEntryPayload(result))
	if strings.Contains(string(wire), "secret") || strings.Contains(string(wire), "private") {
		t.Fatalf("private metadata escaped: %s", wire)
	}
	hidden := nativeBlocks(nativeEntry{Type: "message", Message: json.RawMessage(`{"role":"custom","display":false,"content":"hidden"}`)})
	if hidden.Kind != "" {
		t.Fatalf("hidden extension visible: %+v", hidden)
	}
}
