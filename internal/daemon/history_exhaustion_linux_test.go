//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// This is the metadata-only sequence from the reopened live case, not its
// content or identifiers. The prompt message after the settings is not rendered.
// Exercise every prefix: a short conversation can grow past the 25-entry edge.
func TestHistoryExhaustionWithLiveEntryTypeSequence(t *testing.T) {
	kinds := []string{
		"model_change", "thinking_level_change", "system", "user", "assistant", "user",
		"assistant", "tool", "tool", "tool", "assistant", "tool", "tool", "tool",
		"assistant", "tool", "assistant", "tool", "assistant", "tool", "assistant", "tool",
		"assistant", "tool", "assistant", "tool", "assistant", "tool", "assistant", "tool",
		"assistant", "tool", "assistant", "tool", "assistant", "tool", "assistant",
		"custom_message", "assistant", "custom_message", "assistant", "tool", "assistant",
		"custom_message", "assistant", "custom_message", "assistant", "tool", "assistant", "tool", "assistant",
	}
	home := t.TempDir()
	root := filepath.Join(home, historyRoot)
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, "synthetic.jsonl")
	const id = "11111111-1111-4111-8111-111111111111"
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	handler := HistoryHandler(cfg, func(*http.Request) bool { return true })
	rows := []map[string]any{{"type": "session", "version": 3, "id": id, "cwd": home}}
	wantKeys := []string{}
	for i, kind := range kinds {
		key := fmt.Sprintf("entry%02d", i)
		var parent any
		if i > 0 {
			parent = fmt.Sprintf("entry%02d", i-1)
		}
		row := map[string]any{"id": key, "parentId": parent}
		switch kind {
		case "model_change":
			row["type"], row["provider"], row["modelId"] = kind, "synthetic", "model"
		case "thinking_level_change":
			row["type"], row["thinkingLevel"] = kind, "medium"
		case "custom_message":
			row["type"], row["display"], row["content"] = kind, true, "Synthetic extension"
		default:
			role := kind
			if kind == "tool" {
				role = "toolResult"
			}
			row["type"] = "message"
			row["message"] = map[string]any{"role": role, "content": "Synthetic message"}
		}
		rows = append(rows, row)
		if kind != "system" {
			wantKeys = append(wantKeys, key)
		}
		data := []byte{}
		for _, row := range rows {
			b, err := json.Marshal(row)
			if err != nil {
				t.Fatal(err)
			}
			data = append(append(data, b...), '\n')
		}
		if err := os.WriteFile(path, data, 0600); err != nil {
			t.Fatal(err)
		}
		t.Run(fmt.Sprintf("native_entries_%02d", i+1), func(t *testing.T) {
			seen := map[string]bool{}
			cursor := ""
			for requests := 0; ; requests++ {
				url := "http://unix/api/v1/agents/pi:" + id + "/history?limit=25"
				if cursor != "" {
					url += "&before=" + cursor
				}
				w := httptest.NewRecorder()
				handler.ServeHTTP(w, httptest.NewRequest("GET", url, nil))
				var page struct {
					Entries       []historyEntry `json:"entries"`
					OlderComplete bool           `json:"older_complete"`
					BoundaryFound bool           `json:"boundary_found"`
					Next          string         `json:"next_before"`
				}
				if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil || w.Code != 200 || !page.BoundaryFound {
					t.Fatalf("page unavailable: status=%d err=%v", w.Code, err)
				}
				if len(page.Entries) == 0 {
					t.Fatal("empty page before exhaustion")
				}
				if cursor != "" && page.Entries[len(page.Entries)-1].Key != cursor {
					t.Fatal("older page lost its boundary witness")
				}
				for _, entry := range page.Entries {
					seen[entry.Key] = true
				}
				atStart := page.Entries[0].Key == "entry00"
				if page.OlderComplete != atStart || (page.Next == "") != atStart {
					t.Fatalf("oldest entry and exhaustion disagree: first=%s complete=%v cursor=%s", page.Entries[0].Key, page.OlderComplete, page.Next)
				}
				if page.OlderComplete {
					break
				}
				if page.Next == cursor || requests > 2 {
					t.Fatal("non-progressing paging")
				}
				cursor = page.Next
			}
			if len(seen) != len(wantKeys) || seen["entry02"] {
				t.Fatalf("rendered coverage=%d want=%d hidden prompt leaked=%v", len(seen), len(wantKeys), seen["entry02"])
			}
			for _, key := range wantKeys {
				if !seen[key] {
					t.Fatalf("missing rendered entry %s", key)
				}
			}
		})
	}
}
