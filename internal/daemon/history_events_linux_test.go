//go:build linux

package daemon

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/maintainer/native-agent-host/internal/transport"
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
