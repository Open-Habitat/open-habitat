//go:build linux

package daemon

import (
	"encoding/json"
	"os"
	"path/filepath"
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

func TestHiddenCustomMessageSkippedByNativeReader(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "session.jsonl")
	data := `{"type":"session","version":3,"id":"11111111-1111-4111-8111-111111111111","timestamp":"2026-01-01T00:00:00Z","cwd":"/synthetic"}
{"type":"message","id":"hidden","parentId":null,"timestamp":"2026-01-01T00:00:01Z","message":{"role":"custom","display":false,"content":"secret"}}
{"type":"custom_message","id":"hidden2","parentId":"hidden","timestamp":"2026-01-01T00:00:02Z","display":false,"content":"secret"}
{"type":"message","id":"visible","parentId":"hidden2","timestamp":"2026-01-01T00:00:03Z","message":{"role":"user","content":"Hello"}}
`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	for _, s := range []nativeSession{readNative(path, -1), readNativeWindow(path, -1, "", 25)} {
		if s.state != "readable" || len(s.entries) != 1 || s.entries[0].Key != "visible" {
			t.Fatalf("hidden projection: %+v", s)
		}
	}
}
