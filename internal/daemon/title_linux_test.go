//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf8"
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
	// Conditional writes compare the entire native name; the UI only shows
	// a bounded prefix. An oversized/unknown entry must not look unnamed.
	long := strings.Repeat("n", 200)
	f, err = os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := json.Marshal(map[string]any{"type": "session_info", "id": "abc4", "name": long})
	fmt.Fprintln(f, string(b))
	f.Close()
	if exact, ok := nativeNameExact(readNativeHeader(path, os.Getuid()), os.Getuid()); !ok || exact != long {
		t.Fatalf("exact name %q %v", exact, ok)
	}
	if display := nativeNameDisplay(readNativeHeader(path, os.Getuid()), os.Getuid()); display != long[:160] {
		t.Fatalf("display name %q", display)
	}
	f, err = os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	b, _ = json.Marshal(map[string]any{"type": "session_info", "id": "abc5", "name": strings.Repeat("x", 70000)})
	fmt.Fprintln(f, string(b))
	f.Close()
	if name, ok := nativeNameExact(readNativeHeader(path, os.Getuid()), os.Getuid()); ok {
		t.Fatalf("oversized native name was treated as known: %d bytes", len(name))
	}
}

func TestFirstPromptFitsSnapshotTitle(t *testing.T) {
	home := t.TempDir()
	path := filepath.Join(home, "session.jsonl")
	id := "11111111-1111-4111-8111-111111111111"
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range []any{
		map[string]any{"type": "session", "version": 3, "id": id, "cwd": home},
		map[string]any{"type": "message", "id": "abc1", "message": map[string]any{"role": "user", "content": strings.Repeat("🙂", 80)}},
	} {
		b, _ := json.Marshal(row)
		fmt.Fprintln(f, string(b))
	}
	f.Close()
	prompt := firstPrompt(readNativeHeader(path, os.Getuid()), os.Getuid())
	if prompt == "" || len(prompt) > 160 || !utf8.ValidString(prompt) {
		t.Fatalf("invalid fallback: %q", prompt)
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
