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

// Pi 1.3.0 agent-session.js creates this internal prompt message; the
// interactive renderer explicitly skips role system. Sections/tools are not
// extension content, even if a future producer also supplies nonempty content.
func TestSystemPromptIsNotAnExtensionCard(t *testing.T) {
	for _, content := range []string{`""`, `"Internal prompt"`} {
		path := filepath.Join(t.TempDir(), "session.jsonl")
		raw := `{"type":"message","id":"system","parentId":null,"message":{"role":"system","content":` + content + `,"sections":{"preamble":"private synthetic instruction"},"toolsAdded":[{"name":"synthetic","parameters":{"type":"object"}}],"timestamp":1792143755045}}`
		data := `{"type":"session","version":3,"id":"11111111-1111-4111-8111-111111111111","cwd":"/synthetic"}` + "\n" + raw + "\n" + `{"type":"message","id":"user","parentId":"system","message":{"role":"user","content":"Hello"}}` + "\n"
		if err := os.WriteFile(path, []byte(data), 0600); err != nil {
			t.Fatal(err)
		}
		for _, s := range []nativeSession{readNative(path, -1), readNativeWindow(path, -1, "", 25)} {
			if s.state != "readable" || len(s.entries) != 1 || s.entries[0].Key != "user" {
				t.Fatalf("system prompt projected as conversation: %+v", s)
			}
		}
		if _, ok := nativeBlockChunk(json.RawMessage(raw), 0, 0, 100); ok {
			t.Fatal("system prompt selectable by block read")
		}
	}
}

func TestCustomMessageEmptyContentIsNotAVisibleCard(t *testing.T) {
	for _, content := range []string{`""`, `"  \n "`, `[]`, `[{"type":"text","text":""}]`, `null`} {
		raw := json.RawMessage(`{"type":"custom_message","customType":"ad-process:notification","display":true,"content":` + content + `,"details":{"summary":"private, not content"}}`)
		result := nativeBlocks(nativeEntry{ID: "empty", Type: "custom_message", Raw: raw})
		if result.Kind != "" {
			t.Fatalf("empty extension became visible: %+v", result)
		}
	}
}

// A stopped turn is marked from its native record. Only the AbortError of a
// cancelled request turns Pi's "error" into an abort; any other model error
// stays a failure, and its text never reaches the entry.
func TestNativeAbortRecordedAsErrorIsAnAbort(t *testing.T) {
	for _, c := range []struct{ message, want string }{
		{`"stopReason":"error","errorMessage":"This operation was aborted"`, "aborted"},
		{`"stopReason":"aborted","errorMessage":"Request was aborted"`, "aborted"},
		{`"stopReason":"error","errorMessage":"This operation was aborted by the provider"`, "error"},
		{`"stopReason":"error","errorMessage":"429 rate limited"`, "error"},
	} {
		e := nativeEntry{ID: "entry_1", Type: "message", Message: json.RawMessage(`{"role":"assistant","content":[],` + c.message + `}`)}
		result := nativeBlocks(e)
		if result.StopReason != c.want {
			t.Errorf("%s: stop reason %q, want %q", c.message, result.StopReason, c.want)
		}
		if wire, _ := json.Marshal(nativeEntryPayload(result)); strings.Contains(string(wire), "abort") != (c.want == "aborted") || strings.Contains(string(wire), "rate") {
			t.Errorf("%s: wire %s", c.message, wire)
		}
	}
}

// The browser reads a reply's context size as Pi's context usage does: Pi's
// total, else its counters, never from an aborted or failed reply, and a
// malformed usage never costs the entry itself.
func TestAssistantContextTokensFollowPi(t *testing.T) {
	for _, c := range []struct {
		message string
		want    int64
	}{
		{`"stopReason":"stop","usage":{"input":100,"output":20,"cacheRead":5000,"cacheWrite":7,"totalTokens":5127}`, 5127},
		{`"stopReason":"toolUse","usage":{"input":100,"output":20,"cacheRead":5000,"cacheWrite":7}`, 5127},
		{`"stopReason":"stop","usage":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"totalTokens":0}`, 0},
		{`"stopReason":"aborted","usage":{"totalTokens":5127}`, 0},
		{`"stopReason":"error","errorMessage":"429 rate limited","usage":{"totalTokens":5127}`, 0},
		{`"stopReason":"error","errorMessage":"This operation was aborted","usage":{"totalTokens":5127}`, 0},
		{`"stopReason":"stop","usage":{"totalTokens":"many"}`, 0},
		{`"stopReason":"stop","usage":{"totalTokens":-5}`, 0},
	} {
		e := nativeEntry{ID: "entry_1", Type: "message", Message: json.RawMessage(`{"role":"assistant","content":[{"type":"text","text":"Hei"}],` + c.message + `}`)}
		result := nativeBlocks(e)
		if result.ContextTokens != c.want || result.Kind != "assistant" || len(result.Blocks) != 1 {
			t.Errorf("%s: %+v, want %d", c.message, result, c.want)
		}
		wire, _ := json.Marshal(nativeEntryPayload(result))
		if strings.Contains(string(wire), "context_tokens") != (c.want > 0) {
			t.Errorf("%s: wire %s", c.message, wire)
		}
	}
	// A context edit invalidates earlier usage in Pi; the browser must see it.
	edit := nativeBlocks(nativeEntry{ID: "entry_3", Type: "context_edit", Raw: json.RawMessage(`{"type":"context_edit","targetId":"entry_1","replacement":{"content":"secret"}}`)})
	if wire, _ := json.Marshal(nativeEntryPayload(edit)); edit.EntryType != "context_edit" || strings.Contains(string(wire), "secret") {
		t.Fatalf("context edit: %+v %s", edit, wire)
	}
	user := nativeBlocks(nativeEntry{ID: "entry_2", Type: "message", Message: json.RawMessage(`{"role":"user","content":"Hei","usage":{"totalTokens":5127}}`)})
	if user.ContextTokens != 0 {
		t.Fatalf("user message carries usage: %+v", user)
	}
}

// An image's size reaches the browser without its payload, so a message of
// many large pictures can show collapsed; a malformed payload counts as none.
func TestNativeImageBlockSize(t *testing.T) {
	e := nativeEntry{ID: "entry_1", Type: "message", Message: json.RawMessage(`{"role":"user","content":[{"type":"image","mimeType":"image/png","data":"QUJDRA=="},{"type":"image","mimeType":"image/png","data":"QUJD"},{"type":"image","mimeType":"image/png","data":"QU$D"},{"type":"image","mimeType":"image/png","data":7}]}`)}
	result := nativeBlocks(e)
	got := []int64{}
	for _, b := range result.Blocks {
		got = append(got, b.Bytes)
	}
	if len(got) != 4 || got[0] != 4 || got[1] != 3 || got[2] != 0 || got[3] != 0 {
		t.Fatalf("image sizes %v", got)
	}
	wire, _ := json.Marshal(nativeEntryPayload(result))
	if strings.Contains(string(wire), "QUJD") || !strings.Contains(string(wire), `"bytes":4`) {
		t.Fatalf("image payload or size on the wire: %s", wire)
	}
}
