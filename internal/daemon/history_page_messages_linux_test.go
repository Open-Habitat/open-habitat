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
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// seedToolHeavySession writes a synthetic Pi session shaped like a long
// conductor conversation: each turn is a prompt, three thinking+tool-call
// steps with 4 KiB results, and a visible reply. tools adds trailing steps
// with no visible reply.
func seedToolHeavySession(t *testing.T, home string, turns, tools int) string {
	t.Helper()
	id := "11111111-1111-4111-8111-111111111111"
	src := filepath.Join(home, "src", "fixture")
	root := filepath.Join(home, historyRoot, "--fixture--")
	for _, dir := range []string{src, root} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	var b strings.Builder
	parent := ""
	write := func(key string, message map[string]any) {
		row := map[string]any{"type": "message", "id": key, "message": message}
		if parent != "" {
			row["parentId"] = parent
		} else {
			row["parentId"] = nil
		}
		line, err := json.Marshal(row)
		if err != nil {
			t.Fatal(err)
		}
		b.Write(line)
		b.WriteByte('\n')
		parent = key
	}
	header, _ := json.Marshal(map[string]any{"type": "session", "version": 3, "id": id, "cwd": src})
	b.Write(header)
	b.WriteByte('\n')
	output := strings.Repeat("synthetic tool output line\n", 150)
	step := func(prefix string, i int) {
		call := fmt.Sprintf("%s-call%d", prefix, i)
		write(call, map[string]any{"role": "assistant", "stopReason": "toolUse", "content": []any{
			map[string]any{"type": "thinking", "thinking": "Synthetic reasoning about the next step."},
			map[string]any{"type": "toolCall", "id": call, "name": "bash", "arguments": map[string]any{"command": "ls -la"}},
		}})
		write(fmt.Sprintf("%s-result%d", prefix, i), map[string]any{"role": "toolResult", "toolCallId": call, "toolName": "bash", "content": []any{map[string]any{"type": "text", "text": output}}})
	}
	for turn := 0; turn < turns; turn++ {
		write(fmt.Sprintf("t%03d-user", turn), map[string]any{"role": "user", "content": fmt.Sprintf("Synthetic prompt %d", turn)})
		for i := 0; i < 3; i++ {
			step(fmt.Sprintf("t%03d", turn), i)
		}
		write(fmt.Sprintf("t%03d-reply", turn), map[string]any{"role": "assistant", "stopReason": "stop", "content": []any{map[string]any{"type": "text", "text": fmt.Sprintf("Synthetic reply %d", turn)}}})
	}
	for i := 0; i < tools; i++ {
		step("tail", i)
	}
	if err := os.WriteFile(filepath.Join(root, "native.jsonl"), []byte(b.String()), 0600); err != nil {
		t.Fatal(err)
	}
	return "/api/v1/agents/pi:" + id + "/history"
}

type messagePage struct {
	Entries       []historyEntry `json:"entries"`
	OlderComplete bool           `json:"older_complete"`
	NextBefore    string         `json:"next_before"`
}

func getMessagePage(t *testing.T, h http.Handler, url string) (int, messagePage, int, time.Duration) {
	t.Helper()
	w := httptest.NewRecorder()
	started := time.Now()
	h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix"+url, nil))
	took := time.Since(started)
	var page messagePage
	if w.Code == 200 {
		if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
	}
	return w.Code, page, w.Body.Len(), took
}

// countConversational counts wire entries the way a reader sees them: the
// fixtures' replies are short enough for their text to be in the blocks.
func countConversational(entries []historyEntry) int {
	n := 0
	for _, e := range entries {
		for _, b := range e.Blocks {
			if e.Kind == "assistant" && b.Type == "text" && strings.TrimSpace(b.Text) != "" {
				n++
				break
			}
		}
		if e.Kind == "user" {
			n++
		}
	}
	return n
}

// The browser rejects a history body over 2 MiB (web/src/app/history.ts).
const browserHistoryCap = 2 << 20

func TestLongThinkingReplyStillCountsAsAMessage(t *testing.T) {
	path := filepath.Join(t.TempDir(), "thinking.jsonl")
	lines := []string{
		`{"type":"session","version":3,"id":"11111111-1111-4111-8111-111111111111","cwd":"/synthetic"}`,
		`{"type":"message","id":"a","parentId":null,"message":{"role":"user","content":"question"}}`,
		`{"type":"message","id":"b","parentId":"a","message":{"role":"assistant","content":[{"type":"thinking","thinking":"` + strings.Repeat("x", 20000) + `"},{"type":"text","text":"Done"}]}}`,
	}
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	page := readNativeWindowBounded(path, os.Getuid(), "", historyPageEntries, 1, "")
	if page.state != "readable" || len(page.entries) != 1 || page.entries[0].Key != "b" || page.olderComplete {
		t.Fatalf("one-message page: %+v", page)
	}
}

func TestHistoryPageCountsMessagesNotToolEntries(t *testing.T) {
	home := t.TempDir()
	const turns = 120
	base := seedToolHeavySession(t, home, turns, 0)
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	h := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, nativeSessions)

	status, tail, bytes, took := getMessagePage(t, h, base+"?messages=100")
	if status != 200 || countConversational(tail.Entries) != 100 || tail.OlderComplete || tail.NextBefore != tail.Entries[0].Key {
		t.Fatalf("tail: %d messages=%d entries=%d older_complete=%v", status, countConversational(tail.Entries), len(tail.Entries), tail.OlderComplete)
	}
	// 50 whole turns: the oldest kept entry is the 100th message back.
	if len(tail.Entries) != 50*8 || tail.Entries[0].Key != fmt.Sprintf("t%03d-user", turns-50) {
		t.Fatalf("tail starts at %s with %d entries", tail.Entries[0].Key, len(tail.Entries))
	}
	if bytes > browserHistoryCap {
		t.Fatalf("tail page %d bytes over budget", bytes)
	}
	t.Logf("tool-heavy tail: %d messages, %d entries, %d bytes, %s", countConversational(tail.Entries), len(tail.Entries), bytes, took)

	held := map[string]bool{}
	for _, e := range tail.Entries {
		held[e.Key] = true
	}
	cursor, pages := tail.NextBefore, 1
	for cursor != "" {
		status, older, _, _ := getMessagePage(t, h, base+"?messages=100&before="+cursor)
		if status != 200 || len(older.Entries) < 2 || older.Entries[len(older.Entries)-1].Key != cursor {
			t.Fatalf("older page before %s: %d %+v", cursor, status, older)
		}
		// The boundary witness counts as neither an entry nor a message of the page.
		fresh := older.Entries[:len(older.Entries)-1]
		if n := countConversational(fresh); n != 100 && !(older.OlderComplete && n < 100) {
			t.Fatalf("older page counted %d messages", n)
		}
		for _, e := range fresh {
			if held[e.Key] {
				t.Fatalf("entry %s repeated", e.Key)
			}
			held[e.Key] = true
		}
		pages++
		if older.OlderComplete {
			break
		}
		cursor = older.NextBefore
	}
	if len(held) != turns*8 || pages != 3 {
		t.Fatalf("paged %d entries in %d pages", len(held), pages)
	}
}

func TestHistoryPageMessageAskStaysWithinEntryAndByteBounds(t *testing.T) {
	home := t.TempDir()
	// A long tool run without a visible reply must not let a message ask read on.
	base := seedToolHeavySession(t, home, 2, historyPageEntries)
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	h := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, nativeSessions)
	status, page, bytes, _ := getMessagePage(t, h, base+"?messages=100")
	if status != 200 || page.OlderComplete || countConversational(page.Entries) != 0 {
		t.Fatalf("entry bound: %d %d entries older_complete=%v", status, len(page.Entries), page.OlderComplete)
	}
	if len(page.Entries) > historyPageEntries || bytes > browserHistoryCap {
		t.Fatalf("page of %d entries and %d bytes exceeds bounds", len(page.Entries), bytes)
	}

	small := historyHandlerWithBudget(cfg, func(*http.Request) bool { return true }, nativeSessions, 64<<10, historyBlockBudget)
	status, page, bytes, _ = getMessagePage(t, small, base+"?messages=100")
	if status != 200 || page.OlderComplete || page.NextBefore != page.Entries[0].Key || bytes > 64<<10+4096 {
		t.Fatalf("byte bound: %d %d entries %d bytes", status, len(page.Entries), bytes)
	}

	for _, query := range []string{"?messages=0", "?messages=201", "?messages=x", "?messages=1&messages=2", "?messages=10&after=", "?limit=1001"} {
		if status, _, _, _ := getMessagePage(t, h, base+query); status != 400 {
			t.Fatalf("%s accepted: %d", query, status)
		}
	}
}
