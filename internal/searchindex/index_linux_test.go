//go:build linux

package searchindex

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

const (
	sessionA = "11111111-1111-4111-8111-111111111111"
	sessionB = "22222222-2222-4222-8222-222222222222"
)

func plainOpen(path string) (*os.File, os.FileInfo, bool) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, false
	}
	info, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, nil, false
	}
	return f, info, true
}

// history writes synthetic native records for one session.
type history struct {
	t    *testing.T
	path string
	id   string
	leaf string
	n    int
}

func newHistory(t *testing.T, dir, id string) *history {
	h := &history{t: t, path: filepath.Join(dir, id+".jsonl"), id: id}
	h.raw(map[string]any{"type": "session", "version": 3, "id": id, "timestamp": "2026-11-01T10:00:00Z", "cwd": "/home/example/ws"})
	return h
}

func (h *history) raw(v any) {
	b, err := json.Marshal(v)
	if err != nil {
		h.t.Fatal(err)
	}
	f, err := os.OpenFile(h.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		h.t.Fatal(err)
	}
	defer f.Close()
	if _, err := f.Write(append(b, '\n')); err != nil {
		h.t.Fatal(err)
	}
}

// add appends one entry under parent ("" continues the leaf) and returns its id.
func (h *history) add(parent string, message map[string]any) string {
	h.n++
	id := fmt.Sprintf("e%03d", h.n)
	if parent == "" {
		parent = h.leaf
	}
	var p any
	if parent != "" {
		p = parent
	}
	entry := map[string]any{"type": "message", "id": id, "parentId": p, "timestamp": time.Date(2026, 11, 1, 10, h.n, 0, 0, time.UTC).Format(time.RFC3339Nano), "message": message}
	if message == nil {
		entry["type"] = "model_change"
		delete(entry, "message")
	}
	h.raw(entry)
	h.leaf = id
	return id
}

func (h *history) user(text string) string {
	return h.add("", map[string]any{"role": "user", "content": text})
}
func (h *history) agent(text string) string {
	return h.add("", map[string]any{"role": "assistant", "content": []any{map[string]any{"type": "thinking", "thinking": "salainen ajatus tilikartasta"}, map[string]any{"type": "text", "text": text}, map[string]any{"type": "toolCall", "name": "bash", "arguments": map[string]any{"command": "grep karttapalvelu"}}}})
}
func (h *history) tool(text string) string {
	return h.add("", map[string]any{"role": "toolResult", "toolName": "bash", "content": []any{map[string]any{"type": "text", "text": text}}})
}
func (h *history) session() Session {
	info, err := os.Stat(h.path)
	if err != nil {
		h.t.Fatal(err)
	}
	return Session{ID: h.id, Path: h.path, Changed: info.ModTime()}
}

func openIndex(t *testing.T) (*Index, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "search.sqlite")
	x, err := Open(path, plainOpen, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { x.Close() })
	return x, path
}

func search(t *testing.T, x *Index, q string) Result {
	t.Helper()
	r, err := x.Search(q)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func entries(c Conversation) []string {
	var out []string
	for _, h := range c.Hits {
		out = append(out, h.Entry)
	}
	return out
}

func syncAll(t *testing.T, x *Index, s ...Session) {
	t.Helper()
	if err := x.Sync(context.Background(), s); err != nil {
		t.Fatal(err)
	}
}

func TestBuildIndexesWordsNotToolsOrThinking(t *testing.T) {
	dir := t.TempDir()
	a := newHistory(t, dir, sessionA)
	u := a.user("Karttatiilet latautuvat hitaasti. Voisiko välimuistin tehdä?")
	a.tool("karttapalvelu vastasi 200")
	g := a.agent("Lisäsin välimuistin. Tilikartan rivit ovat ennallaan.")
	b := newHistory(t, dir, sessionB)
	b.user("Kuitit lokakuulta")
	x, path := openIndex(t)
	syncAll(t, x, a.session(), b.session())

	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("index mode = %v, %v", info.Mode(), err)
	}
	r := search(t, x, "kartan")
	if !reflect.DeepEqual(r.Terms, []string{"kart"}) {
		t.Fatalf("terms = %v", r.Terms)
	}
	if len(r.Conversations) != 1 || r.Conversations[0].Session != sessionA || r.Conversations[0].HitCount != 2 {
		t.Fatalf("conversations = %+v", r.Conversations)
	}
	// Newest first, but the word-start hit stands for the conversation.
	if got := entries(r.Conversations[0]); !reflect.DeepEqual(got, []string{u, g}) {
		t.Fatalf("hits = %v", got)
	}
	if r.Conversations[0].Hits[0].Role != "user" || r.Conversations[0].Hits[1].Role != "assistant" {
		t.Fatalf("roles = %+v", r.Conversations[0].Hits)
	}
	if got := r.Conversations[0].Hits[0].Snippet; got != "Karttatiilet latautuvat hitaasti." {
		t.Fatalf("snippet = %q", got)
	}
	for _, q := range []string{"karttapalvelu", "salainen", "grep"} {
		if got := search(t, x, q); len(got.Conversations) != 0 {
			t.Fatalf("%q found tool output or thinking: %+v", q, got)
		}
	}
	if got := search(t, x, "kuitit LOKAKUU"); len(got.Conversations) != 1 || got.Conversations[0].Session != sessionB {
		t.Fatalf("all words: %+v", got)
	}
	if got := search(t, x, "kuitit kartta"); len(got.Conversations) != 0 {
		t.Fatalf("every word must match: %+v", got)
	}
	if got := search(t, x, "ka"); len(got.Conversations) != 2 {
		t.Fatalf("two letters: %+v", got)
	}
	if indexed, total, building := x.Progress(); indexed != 2 || total != 2 || building {
		t.Fatalf("progress = %d/%d %v", indexed, total, building)
	}
}

func TestSyncIsIncremental(t *testing.T) {
	dir := t.TempDir()
	a := newHistory(t, dir, sessionA)
	a.user("ensimmäinen viesti")
	x, _ := openIndex(t)
	syncAll(t, x, a.session())
	a.add("", nil) // a model change continues the branch
	late := a.agent("Toinen vastaus reitistä")
	// An unterminated record waits for Pi to finish writing it.
	f, _ := os.OpenFile(a.path, os.O_APPEND|os.O_WRONLY, 0)
	f.WriteString(`{"type":"message","id":"e999","parentId":"` + late + `","timestamp":"2026-11-01T11:00:00Z","message":{"role":"user","content":"keskeneräinen reitti`)
	f.Close()
	syncAll(t, x, a.session())
	r := search(t, x, "reitti")
	if len(r.Conversations) != 1 || !reflect.DeepEqual(entries(r.Conversations[0]), []string{late}) {
		t.Fatalf("after append = %+v", r.Conversations)
	}
	f, _ = os.OpenFile(a.path, os.O_APPEND|os.O_WRONLY, 0)
	f.WriteString(`"}}` + "\n")
	f.Close()
	a.leaf = "e999"
	syncAll(t, x, a.session())
	r = search(t, x, "reitti")
	if len(r.Conversations) != 1 || r.Conversations[0].HitCount != 2 {
		t.Fatalf("completed record = %+v", r.Conversations)
	}
	var rows int
	x.db.QueryRow("SELECT count(*) FROM messages").Scan(&rows)
	if rows != 3 {
		t.Fatalf("rows = %d, appended records were indexed twice", rows)
	}
}

func TestBranchShrinkReplaceAndRemovalReindex(t *testing.T) {
	dir := t.TempDir()
	a := newHistory(t, dir, sessionA)
	first := a.user("alku: kartta")
	a.agent("vanha haara: kartta")
	x, _ := openIndex(t)
	syncAll(t, x, a.session())
	// Palaa tähän: a new entry continues from the first message.
	fresh := a.add(first, map[string]any{"role": "assistant", "content": "uusi haara: kartta"})
	syncAll(t, x, a.session())
	if got := entries(search(t, x, "kartta").Conversations[0]); !reflect.DeepEqual(got, []string{fresh, first}) {
		t.Fatalf("after branch = %v", got)
	}

	// A replaced (shorter) file is read again whole.
	os.Remove(a.path)
	a = newHistory(t, dir, sessionA)
	only := a.user("korvattu kartta")
	syncAll(t, x, a.session())
	if got := entries(search(t, x, "kartta").Conversations[0]); !reflect.DeepEqual(got, []string{only}) {
		t.Fatalf("after replace = %v", got)
	}

	// A same-size rewrite in place (same inode) is not an append.
	b, _ := os.ReadFile(a.path)
	f, _ := os.OpenFile(a.path, os.O_WRONLY, 0)
	f.WriteAt([]byte(strings.Replace(string(b), "korvattu kartta", "korvattu laatta", 1)), 0)
	f.Close()
	future := time.Now().Add(time.Minute)
	os.Chtimes(a.path, future, future)
	syncAll(t, x, a.session())
	if got := search(t, x, "kartta"); len(got.Conversations) != 0 {
		t.Fatalf("stale text after rewrite: %+v", got)
	}
	if got := search(t, x, "laatta"); len(got.Conversations) != 1 {
		t.Fatalf("rewrite not indexed: %+v", got)
	}

	syncAll(t, x)
	if got := search(t, x, "laatta"); len(got.Conversations) != 0 {
		t.Fatalf("after removal = %+v", got)
	}
}

func TestUnknownIndexIsRebuilt(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "search.sqlite")
	if err := os.WriteFile(path, []byte("not a database at all, just bytes that are long enough"), 0o600); err != nil {
		t.Fatal(err)
	}
	x, err := Open(path, plainOpen, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	a := newHistory(t, dir, sessionA)
	a.user("kartta")
	syncAll(t, x, a.session())
	if len(search(t, x, "kartta").Conversations) != 1 {
		t.Fatal("rebuilt index does not search")
	}
	x.db.Exec("PRAGMA user_version = 99")
	x.Close()
	x, err = Open(path, plainOpen, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	defer x.Close()
	if got := search(t, x, "kartta"); len(got.Conversations) != 0 {
		t.Fatalf("another schema version was kept: %+v", got)
	}
}

func TestSearchOrdersNewestHitAndBoundsHits(t *testing.T) {
	dir := t.TempDir()
	a := newHistory(t, dir, sessionA)
	for i := 0; i < 25; i++ {
		a.user(fmt.Sprintf("viesti %d tilikartasta", i))
	}
	b := newHistory(t, dir, sessionB)
	b.n = 40 // later timestamps
	b.user("kartta uusin")
	x, _ := openIndex(t)
	syncAll(t, x, a.session(), b.session())
	r := search(t, x, "kartta")
	if len(r.Conversations) != 2 || r.Conversations[0].Session != sessionB {
		t.Fatalf("order = %+v", r.Conversations)
	}
	if c := r.Conversations[1]; c.HitCount != 25 || len(c.Hits) != maxHitsEach || c.Hits[0].Entry != "e025" {
		t.Fatalf("bounded = %d hits of %d, first %s", len(c.Hits), c.HitCount, c.Hits[0].Entry)
	}
}

func TestTerms(t *testing.T) {
	for q, want := range map[string][]string{
		"kartta":            {"kart"},
		"Kartan":            {"kart"},
		"kartalle":          {"kart"},
		"välimuistin":       {"välimuist"},
		"map":               {"map"},
		"a kartta, kartan!": {"kart"},
		"":                  nil,
		"x":                 nil,
		`"; DROP --`:        {"drop"},
	} {
		if got := Terms(q); !reflect.DeepEqual(got, want) {
			t.Errorf("Terms(%q) = %v, want %v", q, got, want)
		}
	}
	if got := Terms(strings.Repeat("sana ", 20)); len(got) != 1 {
		t.Errorf("duplicates kept: %v", got)
	}
}

func TestSentence(t *testing.T) {
	text := "Ensimmäinen lause. " + strings.Repeat("täyte ", 40) + "tässä kartta keskellä " + strings.Repeat("loppu ", 40) + "Viimeinen."
	got := Sentence(text, []string{"kart"}, 60)
	if !strings.HasPrefix(got, "…") || !strings.HasSuffix(got, "…") || !strings.Contains(got, "kartta") || len([]rune(got)) > 70 {
		t.Fatalf("Sentence = %q", got)
	}
	// A run without spaces is cut, so a snippet stays within the contract.
	for _, long := range []string{strings.Repeat("a", 2000), "kartta " + strings.Repeat("x", 1600), strings.Repeat("y", 1600) + "kartta" + strings.Repeat("z", 1600)} {
		if got := Sentence(long, []string{"kart", "aa"}, 160); len([]rune(got)) > 210 {
			t.Fatalf("Sentence over bound: %d runes", len([]rune(got)))
		}
	}
	if got := Sentence(strings.Repeat("y", 1600)+"kartta"+strings.Repeat("z", 1600), []string{"kart"}, 160); !strings.Contains(got, "kartta") {
		t.Fatalf("match cut away: %q", got)
	}
	if got := Sentence("```\ncode\n```\nKoodi kartta.", []string{"kart"}, 60); got != "code Koodi kartta." {
		t.Fatalf("fences = %q", got)
	}
}
