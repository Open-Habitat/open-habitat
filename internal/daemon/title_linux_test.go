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
		map[string]any{"type": "message", "id": "abc1", "message": map[string]any{"role": "user", "content": "![" + strings.Repeat("screenshot", 30) + "](/api/v1/attachments/11111111-1111-4111-8111-111111111111)\n" + strings.Repeat("🙂", 80) + "\nAttachment path: /home/person/attachments/11111111-1111-4111-8111-111111111111"}},
	} {
		b, _ := json.Marshal(row)
		fmt.Fprintln(f, string(b))
	}
	f.Close()
	prompt := firstPrompt(readNativeHeader(path, os.Getuid()), os.Getuid())
	if prompt != strings.Repeat("🙂", 40) || !utf8.ValidString(prompt) {
		t.Fatalf("invalid fallback: %q", prompt)
	}
}

func TestFallbackTitleStripsAttachmentMetadata(t *testing.T) {
	const id = "11111111-1111-4111-8111-111111111111"
	const other = "22222222-2222-4222-8222-222222222222"
	const image = "![shot.png](/api/v1/attachments/" + id + ")"
	const file = "[data.csv](/api/v1/attachments/" + other + ")"
	const path = "Attachment path: /home/person/attachments/" + id
	const otherPath = "Attachment path: /home/person/attachments/" + other
	for _, tc := range []struct{ name, text, want string }{
		{"image and file", "Mikä tässä on vialla?\n" + image + "\n" + file + "\n" + path + "\n" + otherPath, "Mikä tässä on vialla?"},
		{"path before reference", path + "\n" + image + "\nInspect this", "Inspect this"},
		{"attachments only", image + "\n" + path, ""},
		{"empty", "", ""},
		{"ordinary markdown", "[manual](https://example.org)\nKeep **this**", "[manual](https://example.org)\nKeep **this**"},
		{"inline reference", "See " + image, "See " + image},
		{"unpaired path", path, path},
		{"other attachment path", image + "\n" + otherPath, otherPath},
		{"relative path", image + "\nAttachment path: attachments/" + id, "Attachment path: attachments/" + id},
		{"malformed reference", "![shot](/api/v1/attachments/not-an-id)", "![shot](/api/v1/attachments/not-an-id)"},
		{"line breaks", "First\n" + image + "\n\nSecond\n" + path, "First\n\nSecond"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := fallbackTitle(tc.text); got != tc.want {
				t.Fatalf("fallback = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestTitleExcerptTracksCurrentUserLanguage(t *testing.T) {
	for _, tc := range []struct{ first, latest, want string }{
		{"Hello, check the connection", "Tarkista yhteys uudelleen", "First user message:\nHello, check the connection\nLatest user message:\nTarkista yhteys uudelleen"},
		{"Aloitetaan tästä", "Please check the connection", "First user message:\nAloitetaan tästä\nLatest user message:\nPlease check the connection"},
		{"Parlons français", "Parlons français", "Parlons français"},
	} {
		if got := titleExcerpt(tc.first, tc.latest); got != tc.want {
			t.Errorf("excerpt %q / %q: %q", tc.first, tc.latest, got)
		}
	}
	long := titleExcerpt(strings.Repeat("x", 2048), strings.Repeat("y", 2048))
	if len(long) > 4096 || !strings.HasSuffix(long, strings.Repeat("y", 2048)) {
		t.Fatalf("latest message truncated from bounded excerpt: %d bytes", len(long))
	}
}

func TestContinuedTitleReadsLatestNativeUserPrompt(t *testing.T) {
	home := t.TempDir()
	path := filepath.Join(home, "session.jsonl")
	id := "11111111-1111-4111-8111-111111111111"
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range []any{
		map[string]any{"type": "session", "version": 3, "id": id, "cwd": home},
		map[string]any{"type": "message", "id": "abc1", "message": map[string]any{"role": "user", "content": "Check connection"}},
		map[string]any{"type": "model_change", "id": "abc0", "parentId": "abc1", "provider": "claude-bridge", "modelId": "claude-opus-5-5"},
		map[string]any{"type": "model_change", "id": "abc3", "parentId": "abc0", "provider": "openai-codex", "modelId": "gpt-6-sol"},
		map[string]any{"type": "message", "id": "abc2", "parentId": "abc3", "message": map[string]any{"role": "user", "content": "Tarkista yhteys"}},
	} {
		b, _ := json.Marshal(row)
		fmt.Fprintln(f, string(b))
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	if got := latestNativeUserPrompt(path, os.Getuid(), id, home); got != "Tarkista yhteys" {
		t.Fatalf("latest user prompt: %q", got)
	}
	if got := latestNativeUserPrompt(path, os.Getuid(), id, "/wrong"); got != "" {
		t.Fatalf("wrong workspace yielded prompt: %q", got)
	}
	// The background title model prefers the conversation's latest model's provider.
	if got := latestNativeModel(path, os.Getuid(), id, home); got == nil || *got != (piStartupChoice{Provider: "openai-codex", Model: "gpt-6-sol"}) {
		t.Fatalf("latest native model: %+v", got)
	}
	if got := latestNativeModel(path, os.Getuid(), id, "/wrong"); got != nil {
		t.Fatalf("wrong workspace yielded model: %+v", got)
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

func TestGeneratedTitleBound(t *testing.T) {
	for _, tc := range []struct{ input, want string }{
		{"Lyhyt suomenkielinen otsikko", "Lyhyt suomenkielinen otsikko"},
		{"Ääkköset säilyvät kokonaisina nyt", ""},
		{"123456789012345678901234567890 x", "123456789012345678901234567890 x"},
		{"1234567890123456789012345678901 xx", ""},
		{"one two three four five six", ""},
		{"Read supercalifragilisticexpialidocious", ""},
		{"Test synthetic workspace reminder delivery", ""},
		{"Repositorion sisällön tarkistus ja yhteenveto", ""},
		{"one  two\u00a0three", "one two three"},
		{"Repository", ""},
	} {
		got, err := boundGeneratedTitle(tc.input)
		if got != tc.want || (err != nil) != (tc.want == "") {
			t.Errorf("bound %q = %q, %v; want %q", tc.input, got, err, tc.want)
		}
	}
}
