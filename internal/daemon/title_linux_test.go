//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNativeSessionNameWinsAndLatestPersists(t *testing.T) {
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "project")
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(home, historyRoot)
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, "session.jsonl")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	id := "11111111-1111-4111-8111-111111111111"
	rows := []any{
		map[string]any{"type": "session", "version": 3, "id": id, "cwd": cwd},
		map[string]any{"type": "message", "id": "abc1", "message": map[string]any{"role": "user", "content": "An early prompt"}},
		map[string]any{"type": "message", "id": "huge", "message": map[string]any{"role": "toolResult", "content": strings.Repeat("x", 100000)}},
		map[string]any{"type": "session_info", "id": "abc2", "name": "Käyttäjän nimi"},
		map[string]any{"type": "session_info", "id": "abc3", "name": "A newer title"},
	}
	for _, row := range rows {
		b, _ := json.Marshal(row)
		fmt.Fprintln(f, string(b))
	}
	f.Close()
	session := readNativeHeader(path, os.Getuid())
	fact := sessionFact(session, "ws_fixture123", os.Getuid())
	title := fact["title"].(map[string]any)
	if title["display"] != "A newer title" || title["source"] != "native_session" {
		t.Fatal(title)
	}
	// Reopening the native file, not controller state, gives the same name.
	if name := nativeName(readNativeHeader(path, os.Getuid()), os.Getuid()); name != "A newer title" {
		t.Fatal(name)
	}
}

func TestTitleValidation(t *testing.T) {
	for _, bad := range []string{"", " space", "two\nlines", "bad\x00byte", string(make([]byte, 161))} {
		if validTitle(bad) {
			t.Fatalf("accepted %q", bad)
		}
	}
	if !validTitle("Lyhyt suomenkielinen otsikko") {
		t.Fatal("rejected title")
	}
}
