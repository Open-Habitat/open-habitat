//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestNativeHistoryEntriesPublishedOnceFromJSONL(t *testing.T) {
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	root := filepath.Join(home, historyRoot)
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	const id = "11111111-1111-4111-8111-111111111111"
	path := filepath.Join(root, "session.jsonl")
	write := func(rows ...string) {
		t.Helper()
		f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
		if err != nil {
			t.Fatal(err)
		}
		for _, row := range rows {
			if _, err = f.WriteString(row + "\n"); err != nil {
				t.Fatal(err)
			}
		}
		if err := f.Close(); err != nil {
			t.Fatal(err)
		}
	}
	write(`{"type":"session","version":3,"id":"`+id+`","cwd":"`+cwd+`"}`,
		`{"type":"message","id":"native_a","message":{"role":"user","content":"hello"}}`)
	j := newEventJournal()
	s := &conversation{id: id, cwd: cwd}
	c := &ConversationController{cfg: transport.Config{Home: home, UID: os.Geteuid()}, home: home, journal: j, sessions: map[string]*conversation{id: s}}
	c.publishNativeHistory(s)
	c.publishNativeHistory(s)
	write(`{"type":"message","id":"native_b","parentId":"native_a","message":{"role":"assistant","content":[{"type":"text","text":"answer"}]}}`)
	c.publishNativeHistory(s)
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.seq != 2 || len(j.frames) != 2 {
		t.Fatalf("replayed duplicate: %d", j.seq)
	}
	for i, key := range []string{"native_a", "native_b"} {
		var event struct {
			Kind      string `json:"kind"`
			NativeKey string `json:"native_key"`
			Payload   struct {
				EntryKey  string         `json:"entry_key"`
				EntryKind string         `json:"entry_kind"`
				Content   historyContent `json:"content"`
			} `json:"payload"`
		}
		if err := json.Unmarshal(j.frames[i], &event); err != nil {
			t.Fatal(err)
		}
		if event.Kind != "history.entry" || event.NativeKey != key || event.Payload.EntryKey != key || !event.Payload.Content.Complete {
			t.Fatalf("entry: %+v", event)
		}
	}
	if !strings.Contains(string(j.frames[1]), "answer") {
		t.Fatal("native content lost")
	}
}

func TestContinuedHistorySeedsReplayWithoutEvictingOtherAgent(t *testing.T) {
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	root := filepath.Join(home, historyRoot)
	for _, dir := range []string{cwd, root} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	const id = "11111111-1111-4111-8111-111111111111"
	path := filepath.Join(root, "session.jsonl")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Fprintf(f, `{"type":"session","version":3,"id":%q,"cwd":%q}`+"\n", id, cwd)
	parent := ""
	for i := 0; i < 200; i++ {
		key := fmt.Sprintf("old_%04d", i)
		if parent == "" {
			fmt.Fprintf(f, `{"type":"message","id":%q,"message":{"role":"user","content":"old"}}`+"\n", key)
		} else {
			fmt.Fprintf(f, `{"type":"message","id":%q,"parentId":%q,"message":{"role":"assistant","content":"old"}}`+"\n", key, parent)
		}
		parent = key
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	keys, err := existingHistoryKeys(path, os.Geteuid(), id, cwd)
	if err != nil || len(keys) != 200 {
		t.Fatalf("continued baseline: %d %v", len(keys), err)
	}
	j := newEventJournal()
	j.appendInvalidation("pi:22222222-2222-4222-8222-222222222222")
	s := &conversation{id: id, cwd: cwd, publishedHistory: keys}
	c := &ConversationController{cfg: transport.Config{Home: home, UID: os.Geteuid()}, home: home, journal: j, sessions: map[string]*conversation{id: s}}
	f, err = os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Fprintf(f, `{"type":"message","id":"new_reply","parentId":%q,"message":{"role":"assistant","content":"new"}}`+"\n", parent)
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	c.publishNativeHistory(s)
	c.publishNativeHistory(s)
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.seq != 2 || len(j.frames) != 2 || !strings.Contains(string(j.frames[1]), `"native_key":"new_reply"`) {
		t.Fatalf("old entries evicted user replay: seq=%d frames=%d", j.seq, len(j.frames))
	}
}

// A new prompt admitted while the native file is being read must not let the
// preceding turn clear the new provisional tail or attach its native key.
func TestNativeHistoryTurnGenerationFencesStaleSettlement(t *testing.T) {
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	root := filepath.Join(home, historyRoot)
	for _, dir := range []string{cwd, root} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	const id = "11111111-1111-4111-8111-111111111111"
	file := filepath.Join(root, "session.jsonl")
	data := fmt.Sprintf(`{"type":"session","version":3,"id":%q,"cwd":%q}`+"\n", id, cwd) + `{"type":"message","id":"native_one","message":{"role":"assistant","content":"answer"}}` + "\n"
	if err := os.WriteFile(file, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	j := newEventJournal()
	s := &conversation{id: id, cwd: cwd, turnGeneration: 2}
	c := &ConversationController{cfg: transport.Config{Home: home, UID: os.Geteuid()}, home: home, journal: j, sessions: map[string]*conversation{id: s}}
	if key := c.publishNativeHistoryForTurn(s, 1); key != "" {
		t.Fatalf("stale turn key: %s", key)
	}
	j.mu.Lock()
	old := j.seq
	j.mu.Unlock()
	if old != 0 {
		t.Fatal("stale turn published native event")
	}
	if key := c.publishNativeHistoryForTurn(s, 2); key != "native_one" {
		t.Fatalf("current turn key: %s", key)
	}
}
