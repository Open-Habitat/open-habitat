//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/testpython"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// rewindProvider is a synthetic model: a person's message gets one write
// tool call chosen by its text, and the tool's result gets a short reply.
func rewindProvider(t *testing.T, writes map[string][]map[string]string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []struct {
				Role    string          `json:"role"`
				Content json.RawMessage `json:"content"`
			} `json:"messages"`
		}
		if r.URL.Path != "/v1/chat/completions" || json.NewDecoder(r.Body).Decode(&body) != nil || len(body.Messages) == 0 {
			t.Errorf("unexpected provider request %s", r.URL.Path)
			w.WriteHeader(400)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		chunk := func(delta string, finish string) {
			f := "null"
			if finish != "" {
				f = `"` + finish + `"`
			}
			fmt.Fprintf(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":%s,\"finish_reason\":%s}]}\n\n", delta, f)
		}
		last := body.Messages[len(body.Messages)-1]
		if last.Role == "tool" {
			chunk(`{"role":"assistant","content":"Valmis."}`, "")
			chunk(`{}`, "stop")
			fmt.Fprint(w, "data: [DONE]\n\n")
			return
		}
		text := string(last.Content)
		var calls []string
		for key, files := range writes {
			if strings.Contains(text, key) {
				for i, file := range files {
					args, _ := json.Marshal(file)
					quoted, _ := json.Marshal(string(args))
					calls = append(calls, fmt.Sprintf(`{"index":%d,"id":"call_%s_%d","type":"function","function":{"name":"write","arguments":%s}}`, i, key, i, quoted))
				}
			}
		}
		if len(calls) == 0 {
			chunk(`{"role":"assistant","content":"Selvä."}`, "")
			chunk(`{}`, "stop")
		} else {
			chunk(`{"role":"assistant","tool_calls":[`+strings.Join(calls, ",")+`]}`, "")
			chunk(`{}`, "tool_calls")
		}
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
}

func validateRewind(t *testing.T, body []byte) {
	t.Helper()
	python := testpython.Validator(t)
	cmd := exec.Command(python, "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); m['Draft202012Validator'](m['schemas']['rewind.schema.json'],registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`)
	cmd.Stdin = bytes.NewReader(body)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("rewind schema: %s: %v", out, err)
	}
}

// TestRewindThroughPinnedPi drives the daemon's rewind extension in the pinned
// Pi against a synthetic model whose write tool changes real files: the
// checkpoint copies, the preview, going back with files, reading and returning
// to the replaced continuation with its files, and a files-only restore and
// its undo, all read back from the native session file.
func TestRewindThroughPinnedPi(t *testing.T) {
	cli, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(cli); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	ext, err := filepath.Abs("rewind-extension.mjs")
	if err != nil {
		t.Fatal(err)
	}
	provider := rewindProvider(t, map[string][]map[string]string{
		"ensimmäinen": {{"path": "notes.txt", "content": "one\n"}},
		"toinen":      {{"path": "notes.txt", "content": "two\nlines\n"}, {"path": "extra.txt", "content": "new\n"}},
		"kolmas":      {{"path": "third.txt", "content": "3\n"}},
	})
	defer provider.Close()
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	for _, dir := range []string{filepath.Join(home, ".pi", "agent"), filepath.Join(home, ".config", "open-habitat"), cwd} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	models := map[string]any{"providers": map[string]any{"fixture": map[string]any{"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "authHeader": true, "models": []any{map[string]any{"id": "fake", "name": "Fake"}}}}}
	data, _ := json.Marshal(models)
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "models.json"), data, 0600); err != nil {
		t.Fatal(err)
	}
	// Without the person's switch nothing is copied (the first turn).
	if err := os.WriteFile(filepath.Join(home, ".config", "open-habitat", "preferences.json"), []byte(`{"engine":"codemirror6","experimental":{}}`), 0600); err != nil {
		t.Fatal(err)
	}
	id, _ := uuid()
	owner, err := acquirePiOwnership(home, id)
	if err != nil {
		t.Fatal(err)
	}
	defer owner.release()
	if err := owner.markBrowser("ws_example123", cwd); err != nil {
		t.Fatal(err)
	}
	ws, err := os.Open(cwd)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	p, err := launchPiRPCCommand(nativeNodePath(t), []string{cli, "--provider", "fixture", "--model", "fake", "--extension", ext}, home, cwd, []string{"PATH=/usr/bin:/bin"}, owner, ws, "ws_example123")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	settled := make(chan struct{}, 8)
	go func() {
		for event := range p.events {
			if strings.Contains(string(event), `"type":"agent_settled"`) {
				settled <- struct{}{}
			}
		}
	}()
	turn := func(text string) {
		t.Helper()
		if accepted, err := p.request("prompt", text, 15*time.Second); !accepted || err != nil {
			t.Fatalf("prompt %q: %v %v", text, accepted, err)
		}
		select {
		case <-settled:
		case <-time.After(20 * time.Second):
			t.Fatalf("native Pi did not settle after %q", text)
		}
	}
	read := func(name string) string {
		b, err := os.ReadFile(filepath.Join(cwd, name))
		if os.IsNotExist(err) {
			return "<missing>"
		}
		if err != nil {
			t.Fatal(err)
		}
		return string(b)
	}
	turn("Tee nolla: ei tiedostoja")
	if err := os.WriteFile(filepath.Join(home, ".config", "open-habitat", "preferences.json"), []byte(`{"engine":"codemirror6","experimental":{"rewind-conversation":true}}`), 0600); err != nil {
		t.Fatal(err)
	}
	turn("Tee ensimmäinen versio")
	turn("Tee toinen versio")
	if read("notes.txt") != "two\nlines\n" || read("extra.txt") != "new\n" {
		t.Fatalf("the synthetic model's writes did not land: %q %q", read("notes.txt"), read("extra.txt"))
	}

	controller := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	s := &conversation{id: id, cwd: cwd, rpc: p, state: "idle"}
	controller.sessions[id] = s
	sessions, err := nativeSessions(controller.nativeCfg())
	if err != nil || len(sessions) != 1 {
		t.Fatalf("native sessions: %+v %v", sessions, err)
	}
	window := func() []historyEntry {
		t.Helper()
		page := readNativeWindowSettled(sessions[0].path, os.Geteuid(), "", 1000, "")
		if page.state != "readable" {
			t.Fatalf("history window %s", page.state)
		}
		return page.entries
	}
	users := func(entries []historyEntry) (keys []string, texts []string) {
		for _, e := range entries {
			if e.Kind == "user" {
				text := e.Content.Text
				for _, b := range e.Blocks {
					text += b.Text
				}
				keys, texts = append(keys, e.Key), append(texts, text)
			}
		}
		return
	}
	keys, texts := users(window())
	if len(keys) != 3 || !strings.Contains(texts[2], "toinen") {
		raw, _ := os.ReadFile(sessions[0].path)
		t.Fatalf("user messages %v\n%s", texts, raw)
	}
	first, second := keys[1], keys[2]
	get := func(query string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		controller.rewindRead(w, httptest.NewRequest(http.MethodGet, "http://unix/api/v1/conversations/"+id+"/rewind?"+query, nil), id)
		return w
	}
	post := func(body string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodPost, "http://unix/api/v1/conversations/"+id+"/rewind", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		controller.rewind(w, r, id)
		return w
	}

	// A message before the switch was turned on has no checkpoint: the
	// conversation can go back, the files cannot.
	if w := get("entry=" + keys[0]); w.Code != 200 || !strings.Contains(w.Body.String(), `"checkpoint":false`) {
		t.Fatalf("preview without checkpoint: %d %s", w.Code, w.Body.String())
	}
	w := get("entry=" + second)
	var preview rewindPreview
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &preview) != nil {
		t.Fatalf("preview: %d %s", w.Code, w.Body.String())
	}
	validateRewind(t, w.Body.Bytes())
	if preview.Own != 1 || preview.Replies != 1 || !preview.Checkpoint || len(preview.Files) != 2 {
		t.Fatalf("preview %+v", preview)
	}
	byPath := map[string]rewindFile{}
	for _, f := range preview.Files {
		byPath[f.Path] = f
	}
	if f := byPath["notes.txt"]; f.Change != "modified" || f.Additions == nil || *f.Additions != 2 || *f.Deletions != 1 {
		t.Fatalf("notes.txt in preview: %+v", f)
	}
	if f := byPath["extra.txt"]; f.Change != "created" {
		t.Fatalf("extra.txt in preview: %+v", f)
	}

	// A turn in progress is not cut off unless the person said so.
	s.state = "accepted"
	if w := post(`{"action":"rewind","entry_key":"` + second + `","conversation":true,"files":true}`); w.Code != 409 || !strings.Contains(w.Body.String(), "turn_running") {
		t.Fatalf("running turn: %d %s", w.Code, w.Body.String())
	}
	s.state = "idle"
	if w := post(`{"action":"rewind","entry_key":"` + second + `","conversation":false,"files":false}`); w.Code != 400 {
		t.Fatalf("nothing chosen: %d", w.Code)
	}

	// Conversation and files back to before the second message.
	w = post(`{"action":"rewind","entry_key":"` + second + `","conversation":true,"files":true}`)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"restored":2`) {
		t.Fatalf("rewind: %d %s", w.Code, w.Body.String())
	}
	validateRewind(t, w.Body.Bytes())
	if read("notes.txt") != "one\n" || read("extra.txt") != "<missing>" {
		t.Fatalf("files after rewind: %q %q", read("notes.txt"), read("extra.txt"))
	}
	entries := window()
	keys, _ = users(entries)
	last := entries[len(entries)-1]
	if len(keys) != 2 || last.Kind != "rewind" || last.Rewind == nil || last.Rewind.Action != "rewind" || !last.Rewind.Switchable || !last.Rewind.FilesReturn || last.Rewind.Own != 1 || last.Rewind.Replies != 1 || last.Rewind.FilesRestored == nil || *last.Rewind.FilesRestored != 2 {
		t.Fatalf("active branch after rewind: %d users, last %+v %+v", len(keys), last, last.Rewind)
	}
	marker := last.Key
	inline(nil, &last)
	page, _ := json.Marshal(map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "native_revision": "rev", "entries": []historyEntry{last}, "complete": true})
	validateHistoryPage(t, string(page))
	// The replaced continuation is still in the same session, under the row.
	w = get("branch=" + marker)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "toinen") || !strings.Contains(w.Body.String(), "Valmis.") || strings.Contains(w.Body.String(), "ensimmäinen") {
		t.Fatalf("replaced continuation: %d %s", w.Code, w.Body.String())
	}
	validateRewind(t, w.Body.Bytes())

	// Continue from the replaced continuation, with its files.
	if w := post(`{"action":"switch","marker_key":"` + marker + `","files":true}`); w.Code != 200 {
		t.Fatalf("switch: %d %s", w.Code, w.Body.String())
	}
	if read("notes.txt") != "two\nlines\n" || read("extra.txt") != "new\n" {
		t.Fatalf("files after switch: %q %q", read("notes.txt"), read("extra.txt"))
	}
	entries = window()
	keys, _ = users(entries)
	last = entries[len(entries)-1]
	if len(keys) != 3 || keys[2] != second || last.Rewind == nil || last.Rewind.Action != "switch" || last.Rewind.Own != 0 {
		t.Fatalf("active branch after switch: %v %+v", keys, last.Rewind)
	}
	// The row of the switch names the continuation it left: only the marker.
	if w := get("branch=" + last.Key); w.Code != 200 || strings.Contains(w.Body.String(), `"kind":"user"`) {
		t.Fatalf("left continuation after switch: %d %s", w.Code, w.Body.String())
	}

	// Files only: the conversation stays, the agent is told, and it can be undone.
	if w := post(`{"action":"rewind","entry_key":"` + second + `","conversation":false,"files":true}`); w.Code != 200 {
		t.Fatalf("files only: %d %s", w.Code, w.Body.String())
	}
	if read("notes.txt") != "one\n" || read("extra.txt") != "<missing>" {
		t.Fatalf("files after files-only restore: %q %q", read("notes.txt"), read("extra.txt"))
	}
	entries = window()
	keys, _ = users(entries)
	last = entries[len(entries)-1]
	if len(keys) != 3 || last.Rewind == nil || last.Rewind.Action != "files" || !last.Rewind.FilesReturn {
		t.Fatalf("after files-only restore: %v %+v", keys, last.Rewind)
	}
	raw, _ := os.ReadFile(sessions[0].path)
	if !strings.Contains(string(raw), `"customType":"oh-rewind-note"`) {
		t.Fatal("the agent was not told that its files changed")
	}
	filesMarker := last.Key
	// Work after the restore is not the restore's to undo.
	turn("Tee kolmas tiedosto")
	if w := post(`{"action":"undo","marker_key":"` + filesMarker + `"}`); w.Code != 200 {
		t.Fatalf("undo: %d %s", w.Code, w.Body.String())
	}
	if read("notes.txt") != "two\nlines\n" || read("extra.txt") != "new\n" || read("third.txt") != "3\n" {
		t.Fatalf("files after undo: %q %q %q", read("notes.txt"), read("extra.txt"), read("third.txt"))
	}
	if w := post(`{"action":"undo","marker_key":"` + filesMarker + `"}`); w.Code != 409 || !strings.Contains(w.Body.String(), "already_undone") {
		t.Fatalf("second undo: %d %s", w.Code, w.Body.String())
	}

	// Back before the very first message: no message of the person's is left,
	// and the files stay as they are when only the conversation goes back.
	if w := post(`{"action":"rewind","entry_key":"` + keys[0] + `","conversation":true,"files":false}`); w.Code != 200 {
		t.Fatalf("rewind to the start: %d %s", w.Code, w.Body.String())
	}
	entries = window()
	keys, _ = users(entries)
	last = entries[len(entries)-1]
	if len(keys) != 0 || last.Rewind == nil || last.Rewind.Own != 4 || last.Rewind.Replies != 4 || last.Rewind.FilesRestored != nil || last.Rewind.FilesReturn {
		t.Fatalf("after rewinding to the start: %v %+v", keys, last.Rewind)
	}
	if read("notes.txt") != "two\nlines\n" {
		t.Fatal("a conversation-only rewind changed a file")
	}
	// A marker that is no longer on the active branch cannot be acted on.
	if w := post(`{"action":"switch","marker_key":"` + marker + `","files":false}`); w.Code != 404 {
		t.Fatalf("switch from an inactive marker: %d %s", w.Code, w.Body.String())
	}
	// The continuation left ended in the extension's own note to the agent;
	// it can still be continued.
	if w := post(`{"action":"switch","marker_key":"` + last.Key + `","files":false}`); w.Code != 200 {
		t.Fatalf("switch back past the note: %d %s", w.Code, w.Body.String())
	}
	keys, _ = users(window())
	if len(keys) != 4 {
		t.Fatalf("after switching back: %v", keys)
	}
	_ = first
}

func TestRewindLineCountAndUnavailableCopies(t *testing.T) {
	if a, d := countLineChanges("", ""); a == nil || *a != 0 || *d != 0 {
		t.Fatal("an empty file against an empty file")
	}
	if a, d := countLineChanges("a\nb\n", "a\nc\nd\n"); a == nil || *a != 2 || *d != 1 {
		t.Fatalf("line count %v %v", a, d)
	}
	// A path the later checkpoint could not copy has no version there: the
	// preview names no change rather than the first copy's.
	home := t.TempDir()
	cwd := filepath.Join(home, "w")
	_ = os.MkdirAll(filepath.Join(cwd), 0700)
	_ = os.WriteFile(filepath.Join(cwd, "a.txt"), []byte("now\n"), 0600)
	lines := []string{
		`{"type":"session","version":3,"id":"11111111-1111-4111-8111-111111111111","timestamp":"2026-11-06T09:00:00Z","cwd":"` + cwd + `"}`,
		`{"type":"message","id":"u1","parentId":null,"message":{"role":"user","content":"one"}}`,
		`{"type":"custom","customType":"oh-rewind-checkpoint","id":"c1","parentId":"u1","data":{"version":1,"kind":"snapshot","userEntryId":"u1","cwd":"` + cwd + `","timestamp":"t","files":{}}}`,
		`{"type":"custom","customType":"oh-rewind-checkpoint","id":"c2","parentId":"c1","data":{"version":1,"kind":"update","userEntryId":"u1","files":{"a.txt":{"backupFileName":null,"storeId":"s"}}}}`,
		`{"type":"message","id":"a1","parentId":"c2","message":{"role":"assistant","content":[{"type":"text","text":"ok"}]}}`,
		`{"type":"message","id":"u2","parentId":"a1","message":{"role":"user","content":"two"}}`,
		`{"type":"custom","customType":"oh-rewind-checkpoint","id":"c3","parentId":"u2","data":{"version":1,"kind":"snapshot","userEntryId":"u2","cwd":"` + cwd + `","timestamp":"t","files":{},"unavailable":["a.txt"]}}`,
	}
	path := filepath.Join(home, "s.jsonl")
	_ = os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0600)
	s, ok := readRewindSession(path, os.Geteuid())
	if !ok {
		t.Fatal("session unreadable")
	}
	p, ok := s.preview(home, "u2")
	if !ok || len(p.Files) != 0 || p.FileErrors != 1 {
		t.Fatalf("preview with an uncopied path: %+v", p)
	}
	p, _ = s.preview(home, "u1")
	if len(p.Files) != 1 || p.Files[0].Change != "created" {
		t.Fatalf("preview of the first checkpoint: %+v", p)
	}
}

// A file the agent changed and committed after the message is named as
// committed: a restore leaves the commit and brings the file back as an
// uncommitted change. A change left uncommitted, and a commit from before
// the message, are not.
func TestRewindPreviewNamesCommittedFiles(t *testing.T) {
	if _, err := os.Stat("/usr/bin/git"); err != nil {
		t.Skip("git not installed")
	}
	home := t.TempDir()
	cwd := filepath.Join(home, "w")
	store := filepath.Join(home, ".pi", "agent", "file-history", "s")
	for _, d := range []string{cwd, store} {
		if err := os.MkdirAll(d, 0700); err != nil {
			t.Fatal(err)
		}
	}
	git := func(date string, args ...string) {
		t.Helper()
		cmd := exec.Command("/usr/bin/git", append([]string{"-C", cwd, "-c", "user.name=T", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false"}, args...)...)
		cmd.Env = append(os.Environ(), "HOME="+home, "GIT_CONFIG_NOSYSTEM=1", "GIT_AUTHOR_DATE="+date, "GIT_COMMITTER_DATE="+date)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v %s", args, err, out)
		}
	}
	write := func(path, text string) {
		t.Helper()
		if err := os.WriteFile(path, []byte(text), 0600); err != nil {
			t.Fatal(err)
		}
	}
	git("2026-06-01T08:00:00Z", "init", "-q")
	if err := os.MkdirAll(filepath.Join(cwd, "gone"), 0700); err != nil {
		t.Fatal(err)
	}
	write(filepath.Join(cwd, "gone", "a.txt"), "was\n")
	write(filepath.Join(store, "gone-a"), "was\n")
	for _, name := range []string{"kept.txt", "loose.txt", "old.txt"} {
		write(filepath.Join(cwd, name), "was\n")
		write(filepath.Join(store, name), "was\n")
	}
	git("2026-06-01T08:00:00Z", "add", ".")
	git("2026-06-01T08:00:00Z", "commit", "-q", "-m", "before")
	// old.txt: committed before the message, then changed and left.
	write(filepath.Join(cwd, "old.txt"), "now\n")
	// After the message at 09:00 the agent commits kept.txt and new.txt,
	// removes the directory gone in a commit and leaves loose.txt
	// uncommitted.
	write(filepath.Join(cwd, "kept.txt"), "now\n")
	write(filepath.Join(cwd, "new.txt"), "new\n")
	git("2026-06-01T09:00:10Z", "rm", "-q", "-r", "gone")
	git("2026-06-01T09:00:10Z", "add", "kept.txt", "new.txt")
	git("2026-06-01T09:00:10Z", "commit", "-q", "-m", "agent")
	write(filepath.Join(cwd, "loose.txt"), "now\n")
	version := func(name string) string {
		if name == "new.txt" {
			return `{"backupFileName":null,"storeId":"s"}`
		}
		if name == "gone/a.txt" {
			return `{"backupFileName":"gone-a","storeId":"s"}`
		}
		return `{"backupFileName":"` + name + `","storeId":"s"}`
	}
	files := []string{}
	for _, name := range []string{"kept.txt", "loose.txt", "old.txt", "new.txt", "gone/a.txt"} {
		files = append(files, `"`+name+`":`+version(name))
	}
	lines := []string{
		`{"type":"session","version":3,"id":"11111111-1111-4111-8111-111111111111","timestamp":"2026-06-01T08:30:00Z","cwd":"` + cwd + `"}`,
		`{"type":"message","id":"u1","parentId":null,"timestamp":"2026-06-01T09:00:00.000Z","message":{"role":"user","content":"one"}}`,
		`{"type":"custom","customType":"oh-rewind-checkpoint","id":"c1","parentId":"u1","timestamp":"2026-06-01T09:00:01.000Z","data":{"version":1,"kind":"snapshot","userEntryId":"u1","cwd":"` + cwd + `","files":{` + strings.Join(files, ",") + `}}}`,
		`{"type":"message","id":"a1","parentId":"c1","timestamp":"2026-06-01T09:00:20.000Z","message":{"role":"assistant","content":[{"type":"text","text":"ok"}]}}`,
	}
	path := filepath.Join(home, "s.jsonl")
	write(path, strings.Join(lines, "\n")+"\n")
	s, ok := readRewindSession(path, os.Geteuid())
	if !ok {
		t.Fatal("session unreadable")
	}
	p, ok := s.preview(home, "u1")
	if !ok || len(p.Files) != 5 {
		t.Fatalf("preview: %+v", p)
	}
	committed := map[string]bool{}
	for _, f := range p.Files {
		committed[f.Path] = f.Committed
	}
	want := map[string]bool{"kept.txt": true, "new.txt": true, "gone/a.txt": true, "loose.txt": false, "old.txt": false}
	for name, c := range want {
		if committed[name] != c {
			t.Fatalf("%s committed=%v, want %v (%+v)", name, committed[name], c, p.Files)
		}
	}
	body, _ := json.Marshal(p.Files)
	if strings.Count(string(body), `"committed":true`) != 3 || strings.Contains(string(body), `"committed":false`) {
		t.Fatalf("wire form: %s", body)
	}
}
