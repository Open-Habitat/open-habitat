//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestBoundedBlockReadSelectionAndPrivacy(t *testing.T) {
	const id = "11111111-1111-4111-8111-111111111111"
	home := t.TempDir()
	root := filepath.Join(home, ".pi/agent/sessions")
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, "session.jsonl")
	lines := []any{
		map[string]any{"type": "session", "version": 3, "id": id, "cwd": "/synthetic"},
		map[string]any{"type": "message", "id": "first", "parentId": nil, "message": map[string]any{"role": "assistant", "diagnostics": map[string]any{"token": "do-not-serialize"}, "content": []any{
			map[string]any{"type": "thinking", "thinking": "secret redacted", "redacted": true, "thinkingSignature": "signature"},
			map[string]any{"type": "thinking", "thinking": strings.Repeat("é", 20000), "thinkingSignature": "signature"},
			map[string]any{"type": "image", "mimeType": "image/png", "data": strings.Repeat("QUJD", 300000)},
			map[string]any{"type": "toolCall", "id": "call", "name": "read", "arguments": map[string]any{"path": "/synthetic", "token": "requested-only"}, "providerMetadata": "private"},
			map[string]any{"type": "future", "payload": "unchecked"},
		}}},
		map[string]any{"type": "message", "id": "result", "parentId": "first", "message": map[string]any{"role": "toolResult", "toolCallId": "call", "content": []any{map[string]any{"type": "image", "mimeType": "image/png", "data": "QUJD"}, map[string]any{"type": "text", "text": strings.Repeat("R", 20000)}}}},
		map[string]any{"type": "compaction", "id": "summary", "parentId": "result", "summary": strings.Repeat("S", 20000), "details": map[string]any{"token": "secret"}},
		map[string]any{"type": "custom_message", "id": "hidden", "parentId": "summary", "display": false, "content": "hidden secret"},
		map[string]any{"type": "custom_message", "id": "extension", "parentId": "hidden", "display": true, "content": "visible extension", "details": map[string]any{"token": "secret"}},
	}
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	for _, line := range lines {
		if err := json.NewEncoder(f).Encode(line); err != nil {
			t.Fatal(err)
		}
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	h := HistoryHandlerWithNativeRoot(transport.Config{Home: home, UID: os.Getuid()}, func(*http.Request) bool { return true }, home)
	read := func(url string) (int, map[string]any, string) {
		t.Helper()
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix"+url, nil))
		var value map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &value); err != nil {
			t.Fatal(err)
		}
		return w.Code, value, w.Body.String()
	}
	base := "/api/v1/agents/pi:" + id
	status, page, wire := read(base + "/history?limit=25")
	if status != 200 || strings.Contains(wire, "requested-only") || strings.Contains(wire, "secret redacted") || strings.Contains(wire, "unchecked") || strings.Contains(wire, "do-not-serialize") || strings.Contains(wire, "hidden secret") || strings.Contains(wire, "QUJD") {
		t.Fatalf("leaky page %d: %s", status, wire[:min(len(wire), 2000)])
	}
	revision := page["native_revision"].(string)
	entries := page["entries"].([]any)
	if len(entries) != 4 {
		t.Fatalf("wrong visibility: %d", len(entries))
	}
	blocks := entries[0].(map[string]any)["blocks"].([]any)
	if blocks[0].(map[string]any)["redacted"] != true || blocks[1].(map[string]any)["readable"] != true || blocks[3].(map[string]any)["readable"] != true || blocks[4].(map[string]any)["type"] != "unknown" {
		t.Fatal(blocks)
	}
	url := func(key string, index int, offset, limit int) string {
		return fmt.Sprintf("%s/entries/%s/blocks/%d?revision=%s&offset=%d&limit_bytes=%d", base, key, index, revision, offset, limit)
	}
	for _, tc := range []struct {
		key   string
		index int
		kind  string
		want  string
	}{
		{"first", 1, "text/plain", "é"}, {"first", 2, "image/png", "QUJD"}, {"first", 3, "text/plain", "requested-only"}, {"result", 0, "image/png", "QUJD"}, {"result", 1, "text/plain", "R"}, {"summary", 0, "text/plain", "S"}, {"extension", 0, "text/plain", "visible extension"},
	} {
		code, v, raw := read(url(tc.key, tc.index, 0, 64))
		chunk, _ := v["chunk"].(map[string]any)
		if code != 200 || chunk["media_type"] != tc.kind || !strings.Contains(raw, tc.want) || strings.Contains(raw, "signature") || strings.Contains(raw, "do-not-serialize") {
			t.Fatalf("%+v: %d %s", tc, code, raw)
		}
	}
	code, largeImage, rawImage := read(url("first", 2, 0, 1048576))
	if code != 200 || len(rawImage) > 1050000 || largeImage["chunk"].(map[string]any)["next_offset"] != float64(1048576) {
		t.Fatal("large bounded image read", code, len(rawImage))
	}
	code, tailImage, _ := read(url("first", 2, 1048576, 1048576))
	if code != 200 || tailImage["chunk"].(map[string]any)["complete"] != true {
		t.Fatal("image continuation", code)
	}
	code, first, _ := read(url("first", 2, 0, 64))
	if code != 200 || first["chunk"].(map[string]any)["next_offset"] != float64(64) {
		t.Fatal(first)
	}
	for _, u := range []string{url("first", 0, 0, 64), url("hidden", 0, 0, 64), url("first", 4, 0, 64), url("first", 5, 0, 64), url("missing", 0, 0, 64), base + "/entries/first/blocks/1?revision=wrong&offset=0&limit_bytes=64", "/api/v1/content/ct_old?offset=0&limit_bytes=64"} {
		if code, _, _ := read(u); code == 200 {
			t.Fatalf("unsafe selection succeeded: %s", u)
		}
	}
	for _, u := range []string{url("first", 1, 1, 64), url("first", 2, 1, 64), url("first", 2, 0, 3), url("first", 2, 0, 1048577), url("first", 2, 0, 0)} {
		if code, _, _ := read(u); code == 200 {
			t.Fatalf("unbounded/invalid read succeeded: %s", u)
		}
	}
}

func TestLiveHistoryEntryIncludesBlockRevision(t *testing.T) {
	entry := historyEntry{Key: "saved", Kind: "assistant", NativeRevision: "native-hash", Blocks: []historyBlock{{Type: "text", Text: "prefix", Readable: true}}, Content: historyContent{MediaType: "text/plain", Text: "prefix", Complete: false, Truncated: true}}
	payload := nativeEntryPayload(entry)
	if payload["native_revision"] != "native-hash" {
		t.Fatal("live block read has no revision")
	}
	if _, ok := payload["raw"]; ok {
		t.Fatal("raw payload exposed")
	}
}

// Prove metadata-rich image/tool-only entries cannot bypass the history page
// budget just because their ancillary flattened label is short.
func TestTypedHistoryPageBoundsMetadata(t *testing.T) {
	home := t.TempDir()
	root := filepath.Join(home, historyRoot)
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	id := "11111111-1111-4111-8111-111111111111"
	path := filepath.Join(root, "blocks.jsonl")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	enc := json.NewEncoder(f)
	if err := enc.Encode(map[string]any{"type": "session", "version": 3, "id": id, "cwd": "/synthetic"}); err != nil {
		t.Fatal(err)
	}
	blocks := make([]any, 128)
	for i := range blocks {
		blocks[i] = map[string]any{"type": "toolCall", "id": strings.Repeat("i", 180), "name": strings.Repeat("n", 180)}
	}
	for i := 0; i < 200; i++ {
		if err := enc.Encode(map[string]any{"type": "message", "id": fmt.Sprintf("entry%03d", i), "message": map[string]any{"role": "assistant", "content": blocks}}); err != nil {
			t.Fatal(err)
		}
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	h := HistoryHandlerWithNativeRoot(transport.Config{Home: home, UID: os.Getuid()}, func(*http.Request) bool { return true }, home)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+id+"/history?limit=200", nil))
	if w.Code != 200 || w.Body.Len() > 350000 {
		t.Fatalf("page exceeded bound: %d %d", w.Code, w.Body.Len())
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["next_before"] == nil || body["older_complete"] != false {
		t.Fatal("lost backward page cursor")
	}
	forward := httptest.NewRecorder()
	h.ServeHTTP(forward, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+id+"/history?after=&limit=200", nil))
	if forward.Code != 200 || forward.Body.Len() > 350000 {
		t.Fatalf("forward page exceeded bound: %d %d", forward.Code, forward.Body.Len())
	}
	if err := json.Unmarshal(forward.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["next_after"] == nil || body["complete"] != false {
		t.Fatal("lost forward page cursor")
	}
}
