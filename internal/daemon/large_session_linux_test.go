//go:build linux && !race

// The race detector instruments every byte encoding/json scans, which makes
// one projecting read of these 40 MiB of pictures some fifty times slower
// (0.4 s → 20 s) and a resumed turn alone outlast any honest wait. The race
// build covers the same reading and continuation code on small sessions;
// the gate runs these tests separately, without -race, at full size.

package daemon

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// largeSessionSize is above the 32 MiB cap that once locked a pilot's main
// conversation (7.11.2026: 35 MiB, 14 image records over 1 MiB).
// OH_LARGE_SESSION_MIB raises it for a manual run past the former 512 MiB
// whole-file bound (8.11.2026), which is too slow for every gate; such a run
// logs the test process's peak resident memory.
var largeSessionSize = func() int64 {
	if mib, err := strconv.ParseInt(os.Getenv("OH_LARGE_SESSION_MIB"), 10, 64); err == nil && mib > 40 {
		return mib << 20
	}
	return 40 << 20
}()

// peakRSS is the process's resident high-water mark from /proc, in KiB.
func peakRSS(t *testing.T) string {
	t.Helper()
	b, err := os.ReadFile("/proc/self/status")
	if err != nil {
		t.Fatal(err)
	}
	for _, line := range strings.Split(string(b), "\n") {
		if strings.HasPrefix(line, "VmHWM:") {
			return strings.TrimSpace(strings.TrimPrefix(line, "VmHWM:"))
		}
	}
	return "unknown"
}

// inflateSession appends picture turns to a settled native session until it
// passes largeSessionSize: each a person's message with a text and a >1 MiB
// image, answered by the agent, in Pi's own record shape and on the active
// branch. The agent's answers copy the session's last one, so the provider
// fields are Pi's. It returns the last appended entry ID.
func inflateSession(t *testing.T, path string) string {
	t.Helper()
	original, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var parent string
	var assistant map[string]any
	for _, line := range bytes.Split(bytes.TrimSpace(original), []byte{'\n'}) {
		var e map[string]any
		if json.Unmarshal(line, &e) != nil {
			t.Fatalf("native line %q", line)
		}
		if e["type"] == "session" {
			continue
		}
		parent = e["id"].(string)
		if m, ok := e["message"].(map[string]any); ok && m["role"] == "assistant" {
			assistant = e
		}
	}
	if parent == "" || assistant == nil {
		t.Fatalf("no settled turn to continue from:\n%s", original)
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	picture := make([]byte, 1100<<10)
	size := int64(len(original))
	for n := 0; size < largeSessionSize; n++ {
		if _, err := rand.Read(picture); err != nil {
			t.Fatal(err)
		}
		at := time.Now().UTC()
		user := map[string]any{"type": "message", "id": fmt.Sprintf("u%07d", n), "parentId": parent, "timestamp": at.Format(time.RFC3339Nano), "message": map[string]any{"role": "user", "timestamp": at.UnixMilli(), "content": []any{
			map[string]any{"type": "text", "text": fmt.Sprintf("Kuva %d", n)},
			map[string]any{"type": "image", "mimeType": "image/png", "data": base64.StdEncoding.EncodeToString(picture)},
		}}}
		reply := map[string]any{}
		for k, v := range assistant {
			reply[k] = v
		}
		message := map[string]any{}
		for k, v := range assistant["message"].(map[string]any) {
			message[k] = v
		}
		message["content"] = []any{map[string]any{"type": "text", "text": fmt.Sprintf("Näen kuvan %d.", n)}}
		message["timestamp"] = at.UnixMilli()
		reply["id"], reply["parentId"], reply["timestamp"], reply["message"] = fmt.Sprintf("a%07d", n), user["id"], at.Format(time.RFC3339Nano), message
		for _, entry := range []map[string]any{user, reply} {
			b, _ := json.Marshal(entry)
			b = append(b, '\n')
			if _, err := f.Write(b); err != nil {
				t.Fatal(err)
			}
			size += int64(len(b))
			parent = entry["id"].(string)
		}
	}
	// Past what one provider request can carry, Pi has compacted: the
	// pictures stay in the file, and the context starts at the summary.
	if largeSessionCompacted() {
		compaction, _ := json.Marshal(map[string]any{"type": "compaction", "id": "c0000000", "parentId": parent, "timestamp": time.Now().UTC().Format(time.RFC3339Nano), "summary": "Kuvia ja vastauksia niihin.", "firstKeptEntryId": "c0000000", "tokensBefore": 100000})
		if _, err := f.Write(append(compaction, '\n')); err != nil {
			t.Fatal(err)
		}
		parent = "c0000000"
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	return parent
}

// largeSessionCompacted says the synthetic session ends in a compaction: Pi
// serializes its whole context into one request, which a branch of hundreds
// of MiB of pictures cannot fit (V8 strings end near 512 MiB, providers far
// earlier).
func largeSessionCompacted() bool { return largeSessionSize > 256<<20 }

func (h *heldHarness) sessionFile(id string) string {
	h.t.Helper()
	files, _ := filepath.Glob(filepath.Join(h.root, ".pi/agent/sessions/*/*_"+id+".jsonl"))
	if len(files) != 1 {
		h.t.Fatalf("session files: %v", files)
	}
	return files[0]
}

type largeHistoryPage struct {
	Revision   string `json:"native_revision"`
	NextBefore string `json:"next_before"`
	NextAfter  string `json:"next_after"`
	Older      bool   `json:"older_complete"`
	Entries    []struct {
		Key     string `json:"entry_key"`
		Kind    string `json:"kind"`
		Content struct {
			Text string `json:"text"`
		} `json:"content"`
		Blocks []struct {
			Type string `json:"type"`
		} `json:"blocks"`
	} `json:"entries"`
}

func (h *heldHarness) historyPage(id, query string) largeHistoryPage {
	h.t.Helper()
	handler := HistoryHandler(h.cfg, func(*http.Request) bool { return true })
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+id+"/history"+query, nil))
	var page largeHistoryPage
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &page) != nil {
		h.t.Fatalf("history %s: %d %s", query, w.Code, w.Body.String())
	}
	return page
}

// A resting conversation over the old 32 MiB cap opens from its end and pages
// back, is named by the model and by hand, is archived and restored, and
// continues; then its idle Pi is archived. The synthetic Pi stands in for Pi;
// TestLargeSessionContinuesWithNativePi continues one with the pinned Pi.
func TestLargeSessionStaysUsable(t *testing.T) {
	h := newHeldHarness(t)
	namingFakePi(t, h)
	first, stopFirst := h.daemon()
	id := h.create(first)
	if w := h.send(first, id, "Alku", heldA); w.Code != 200 {
		t.Fatalf("first send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("first turn settled", func() bool {
		first.mu.Lock()
		defer first.mu.Unlock()
		s := first.sessions[id]
		return s.settled && !s.naming && s.receipts[heldA] == "accepted"
	})
	stopFirst()
	h.eventually("first Pi reaped", func() bool {
		first.mu.Lock()
		defer first.mu.Unlock()
		return first.sessions[id].dead
	})
	path := h.sessionFile(id)
	last := inflateSession(t, path)
	if info, _ := os.Stat(path); info.Size() < largeSessionSize {
		t.Fatalf("session only %d bytes", info.Size())
	}
	t.Logf("session %d MiB, peak RSS after writing it %s", largeSessionSize>>20, peakRSS(t))
	defer func() { t.Logf("peak RSS after using it %s", peakRSS(t)) }()

	c, stop := h.daemon()
	defer stop()

	// History opens at the newest turn and pages back to the beginning.
	page := h.historyPage(id, "?messages=20")
	if len(page.Entries) == 0 || page.Entries[len(page.Entries)-1].Key != last || page.NextBefore == "" || page.Older {
		t.Fatalf("first page: %d entries, next %q, older %v", len(page.Entries), page.NextBefore, page.Older)
	}
	images := 0
	for _, e := range page.Entries {
		for _, b := range e.Blocks {
			if b.Type == "image" {
				images++
			}
		}
	}
	if images == 0 {
		t.Fatal("the newest page shows no picture")
	}
	// The streamed whole-file read and the tail window bind one revision, so
	// a published entry's block read finds its page.
	if whole := readNativeSettled(path, h.cfg.UID); whole.state != "readable" || whole.revision != page.Revision || whole.entries[len(whole.entries)-1].Key != last {
		t.Fatalf("whole-file read: %s, revision %q, page %q", whole.state, whole.revision, page.Revision)
	}
	block := httptest.NewRecorder()
	HistoryHandler(h.cfg, func(*http.Request) bool { return true }).ServeHTTP(block, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+id+"/entries/u0000003/blocks/0?revision="+page.Revision+"&offset=0&limit_bytes=1000", nil))
	if block.Code != 200 || !strings.Contains(block.Body.String(), "Kuva 3") {
		t.Fatalf("block read: %d %s", block.Code, block.Body.String())
	}
	pages, seen := 1, len(page.Entries)
	for page.NextBefore != "" {
		page = h.historyPage(id, "?messages=20&before="+page.NextBefore)
		pages++
		seen += len(page.Entries) - 1
		if pages > 50 {
			t.Fatal("history paging does not end")
		}
	}
	if !page.Older || page.Entries[0].Content.Text != "Alku" {
		t.Fatalf("paging did not reach the first message: %+v", page.Entries[0])
	}
	// A held window continues forward from a known entry.
	if forward := h.historyPage(id, "?after="+"u0000000"+"&limit=3"); len(forward.Entries) != 3 || forward.Entries[0].Key != "a0000000" || forward.NextAfter == "" {
		t.Fatalf("forward page: %+v", forward)
	}

	t.Logf("peak RSS after paging %s", peakRSS(t))
	// Palaa tähän reads the branch's structure from the whole file.
	if rs, ok := c.rewindSource(id); !ok || rs.leaf != last {
		t.Fatalf("rewind source: %v", ok)
	}

	// The model's name: generated from the newest prompt, written by Pi.
	var prompt string
	c.titleGenerator = func(text string) (string, error) { prompt = text; return "Hapanjuurikirja", nil }
	w := h.post(func(w http.ResponseWriter, r *http.Request) { c.historyTitle(w, r, id) }, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace))
	if !strings.Contains(w.Body.String(), `"done"`) {
		t.Fatalf("generated name: %d %s", w.Code, w.Body.String())
	}
	if !strings.Contains(prompt, "Kuva ") || h.nativeName(id) != "Hapanjuurikirja" {
		t.Fatalf("generated from %q, named %q", prompt, h.nativeName(id))
	}
	if code, state := h.rename(c, id, h.workspace, "Leipäkirja"); code != 200 || state != "done" {
		t.Fatalf("rename: %d %s", code, state)
	}
	if got := h.nativeName(id); got != "Leipäkirja" {
		t.Fatalf("name after rename: %q", got)
	}

	// Archive is an annotation: a resting history and a live idle Pi alike.
	h.archive(c, id)
	h.unarchive(c, id)
	if w := h.send(c, id, "Jatko", heldB); w.Code != 200 {
		t.Fatalf("resume send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("resumed turn settled", func() bool {
		_, v := h.status(c, id)
		return v.State == "idle" && h.receipt(c, id, heldB) == "accepted"
	})
	if prompts := h.prompts(); len(prompts) != 2 || prompts[1] != "Jatko" {
		t.Fatalf("native prompts: %q", prompts)
	}
	if page := h.historyPage(id, "?messages=5"); page.Entries[len(page.Entries)-1].Kind != "assistant" || page.Entries[len(page.Entries)-2].Content.Text != "Jatko" {
		t.Fatalf("newest page after the resumed turn: %+v", page.Entries)
	}
	h.archive(c, id)
}

// The pinned Pi itself continues a conversation over the old cap, pictures
// and all: the daemon proves the file and hands it to Pi, which loads it,
// sends the whole branch to the provider and appends its answer.
func TestLargeSessionContinuesWithNativePi(t *testing.T) {
	modules, err := filepath.Abs("pi-device-test/node_modules")
	if err != nil {
		t.Fatal(err)
	}
	cli := filepath.Join(modules, "@earendil-works/pi-coding-agent/dist/bundle/cli.js")
	if _, err := os.Stat(cli); err != nil {
		t.Skip("pinned Pi test dependencies not installed")
	}
	h := newHeldHarness(t)
	agent := filepath.Join(h.root, ".pi/agent")
	if err := os.MkdirAll(agent, 0700); err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	var requests []int
	var lastBody string
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		mu.Lock()
		requests = append(requests, len(b))
		lastBody = string(b[max(0, len(b)-4096):])
		mu.Unlock()
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"Fixture answer\"},\"finish_reason\":null}]}\n\ndata: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
	}))
	defer provider.Close()
	models, _ := json.Marshal(map[string]any{"providers": map[string]any{"fixture": map[string]any{"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "models": []any{map[string]any{"id": "fake", "name": "Fake", "input": []string{"text", "image"}, "contextWindow": 10000000}}}}})
	if err := os.WriteFile(filepath.Join(agent, "models.json"), models, 0600); err != nil {
		t.Fatal(err)
	}
	// The fixture runtime passes the entry first; Pi's CLI takes its place.
	launcher := filepath.Join(h.root, "node")
	script := fmt.Sprintf("#!/bin/sh\nshift\nexec %s %q --provider fixture --model fake \"$@\"\n", "'"+strings.ReplaceAll(nativeNodePath(t), "'", "'\"'\"'")+"'", cli)
	if err := os.WriteFile(launcher, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	h.runtime.Node = launcher
	answered := func(n int) func() bool {
		return func() bool { mu.Lock(); defer mu.Unlock(); return len(requests) >= n }
	}

	first, stopFirst := h.daemon()
	id := h.create(first)
	if w := h.send(first, id, "Alku", heldA); w.Code != 200 {
		t.Fatalf("first send: %d %s", w.Code, w.Body.String())
	}
	h.eventually("first provider request", answered(1))
	h.eventually("first turn settled", func() bool {
		_, v := h.status(first, id)
		return v.State == "idle" && h.receipt(first, id, heldA) == "accepted"
	})
	stopFirst()
	h.eventually("first Pi reaped", func() bool {
		first.mu.Lock()
		defer first.mu.Unlock()
		return first.sessions[id].dead
	})
	path := h.sessionFile(id)
	last := inflateSession(t, path)
	before, _ := os.Stat(path)

	second, stopSecond := h.daemon()
	defer stopSecond()
	if w := h.send(second, id, "Jatko", heldB); w.Code != 200 {
		t.Fatalf("resume send: %d %s", w.Code, w.Body.String())
	}
	// Pi loads the whole file and sends it all; a manual run past the
	// default size waits in proportion.
	wait := time.Duration(max(1, largeSessionSize/(40<<20))) * 15 * time.Second
	h.eventuallyWithin(wait, "resumed provider request", answered(2))
	h.eventuallyWithin(wait, "resumed turn settled", func() bool {
		_, v := h.status(second, id)
		if v.State == "start_failed" {
			t.Fatalf("resume failed to start: %+v", v)
		}
		return v.State == "idle" && h.receipt(second, id, heldB) == "accepted"
	})
	mu.Lock()
	sent, body := requests[1], lastBody
	mu.Unlock()
	if !largeSessionCompacted() && int64(sent) < largeSessionSize*9/10 || !strings.Contains(body, "Jatko") {
		t.Fatalf("Pi sent %d bytes ending %q; the continued branch is missing", sent, body)
	}
	after, _ := os.Stat(path)
	native := readNativeSettled(path, h.cfg.UID)
	if after.Size() <= before.Size() || native.state != "readable" {
		t.Fatalf("history after the resumed turn: %d → %d bytes, %s", before.Size(), after.Size(), native.state)
	}
	entries := native.entries
	if n := len(entries); n < 3 || entries[n-1].full != "Fixture answer" || entries[n-2].full != "Jatko" {
		t.Fatalf("newest native entries: %+v", entries[max(0, n-3):])
	}
	found := false
	for _, e := range entries {
		found = found || e.Key == last
	}
	if !found {
		t.Fatal("the resumed turn left the pictures' branch")
	}
}

// A person may attach promptAttachmentLimit of pictures to one message, and Pi
// writes them all into that message's single record (8.11.2026: twenty 3 MiB
// screenshots made an 80 MB record, and the conversation's history could no
// longer be read). Every reader of the file must accept that record, as the
// newest one and with an answer after it.
func TestLargestAdmittedMessageRecordStaysReadable(t *testing.T) {
	home := t.TempDir()
	id := "11111111-1111-4111-8111-111111111111"
	cwd := filepath.Join(home, "src", "fixture")
	root := filepath.Join(home, historyRoot, "--fixture--")
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	const images = 25
	picture := base64.StdEncoding.EncodeToString(make([]byte, promptAttachmentLimit/images))
	content := []any{map[string]any{"type": "text", "text": strings.Repeat("Attachment path: ~/.local/share/open-habitat/attachments/x\n", images)}}
	for i := 0; i < images; i++ {
		content = append(content, map[string]any{"type": "image", "mimeType": "image/png", "data": picture})
	}
	header, _ := json.Marshal(map[string]any{"type": "session", "version": 3, "id": id, "cwd": cwd})
	user, _ := json.Marshal(map[string]any{"type": "message", "id": "u0000001", "parentId": nil, "message": map[string]any{"role": "user", "content": content}})
	reply, _ := json.Marshal(map[string]any{"type": "message", "id": "a0000001", "parentId": "u0000001", "message": map[string]any{"role": "assistant", "stopReason": "stop", "content": []any{map[string]any{"type": "text", "text": "Näen kuvat."}}}})
	if len(user) <= 64<<20 {
		t.Fatalf("record only %d bytes", len(user))
	}
	path := filepath.Join(root, "native.jsonl")
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	h := HistoryHandler(cfg, func(*http.Request) bool { return true })
	for _, records := range [][][]byte{{header, user}, {header, user, reply}} {
		last := "u0000001"
		if len(records) == 3 {
			last = "a0000001"
		}
		if err := os.WriteFile(path, append(bytes.Join(records, []byte{'\n'}), '\n'), 0600); err != nil {
			t.Fatal(err)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+id+"/history?messages=20", nil))
		var page largeHistoryPage
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &page) != nil || len(page.Entries) == 0 || page.Entries[len(page.Entries)-1].Key != last {
			t.Fatalf("newest page ending %s: %d %.200s", last, w.Code, w.Body.String())
		}
		w = httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+id+"/history?after=&limit=10", nil))
		if w.Code != 200 {
			t.Fatalf("forward page ending %s: %d %.200s", last, w.Code, w.Body.String())
		}
		if whole := readNativeSettled(path, cfg.UID); whole.state != "readable" || whole.revision != page.Revision {
			t.Fatalf("whole-file read ending %s: %q", last, whole.state)
		}
		if proof := proveNativeSettled(path, cfg.UID); proof.state != "readable" {
			t.Fatalf("proof ending %s: %q", last, proof.state)
		}
		if _, err := reconciledNativeHistory(path, cfg.UID, id, cwd); err != nil {
			t.Fatalf("tail proof ending %s: %v", last, err)
		}
	}
}
