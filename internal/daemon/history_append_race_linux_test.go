//go:build linux

package daemon

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// piStep is one tool step as Pi appends it: the assistant's tool call, then
// its result, each one appendFileSync of a whole line.
func piStep(key, parent string) []string {
	// Pi's records start with their type, in JSON.stringify's insertion order.
	record := func(id, parent string, message map[string]any) string {
		m, _ := json.Marshal(message)
		return fmt.Sprintf(`{"type":"message","id":%q,"parentId":%q,"timestamp":"2026-11-12T11:36:20.898Z","message":%s}`+"\n", id, parent, m)
	}
	return []string{
		record(key+"-call", parent, map[string]any{"role": "assistant", "stopReason": "toolUse", "content": []any{map[string]any{"type": "toolCall", "id": key, "name": "bash", "arguments": map[string]any{"command": "sleep 3000"}}}}),
		record(key+"-result", key+"-call", map[string]any{"role": "toolResult", "toolCallId": key, "toolName": "bash", "content": []any{map[string]any{"type": "text", "text": "ok"}}}),
	}
}

func appendNative(t testing.TB, path string, s string) {
	t.Helper()
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Error(err)
		return
	}
	defer f.Close()
	if _, err := f.WriteString(s); err != nil {
		t.Error(err)
	}
}

func revisionOf(b []byte) string {
	sum := sha256.Sum256(b)
	return base64.RawURLEncoding.EncodeToString(sum[:18])
}

type racePage struct {
	Revision string         `json:"native_revision"`
	Entries  []historyEntry `json:"entries"`
	CutOff   bool           `json:"cut_off"`
}

func getRacePage(t *testing.T, h http.Handler, url string) (int, racePage, string) {
	t.Helper()
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix"+url, nil))
	var page racePage
	if w.Code == 200 {
		if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
	}
	return w.Code, page, w.Body.String()
}

// 12.11.2026 13:36:20 and 13:37:37: GET history answered 503 in ~120 ms on a
// 5 MiB conductor conversation, each time while Pi appended a tool call and
// its result (11:36:20.898/.913Z, 11:37:37.217/.250Z). Pi only appends, so
// the bytes up to the size seen at open are a whole history; growth during
// the read is the conversation going on, not instability.
func TestHistoryPageReadsThroughPiAppendingDuringTheRead(t *testing.T) {
	home := t.TempDir()
	url := seedToolHeavySession(t, home, 20, 0)
	path := filepath.Join(home, historyRoot, "--fixture--", "native.jsonl")
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	h := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, nativeSessions)
	step := 0
	nativeWindowReadHook = func() {
		step++
		for _, line := range piStep(fmt.Sprintf("live%d", step), map[bool]string{true: "t019-reply", false: fmt.Sprintf("live%d-result", step-1)}[step == 1]) {
			appendNative(t, path, line)
		}
	}
	t.Cleanup(func() { nativeWindowReadHook = nil })
	status, page, body := getRacePage(t, h, url+"?messages=100")
	if status != 200 {
		t.Fatalf("history refused while Pi appended: %d %s", status, body)
	}
	if last := page.Entries[len(page.Entries)-1].Key; last != "t019-reply" || page.CutOff {
		t.Fatalf("page ends at %s cut_off=%v, want the leaf seen at open", last, page.CutOff)
	}
	if page.Revision != revisionOf(before) {
		t.Fatal("revision does not name the bytes the page was read from")
	}
	// The next read sees the appended steps.
	nativeWindowReadHook = nil
	status, page, _ = getRacePage(t, h, url+"?messages=100")
	if status != 200 || page.Entries[len(page.Entries)-1].Key != fmt.Sprintf("live%d-result", step) {
		t.Fatalf("later read: %d ends %s", status, page.Entries[len(page.Entries)-1].Key)
	}
}

// A record Pi is still writing ends the file without its newline. Once the
// file grows past it during the read, it was an append in progress, not a
// quota cut: the page is the complete prefix and is not marked cut off.
func TestHistoryPageDoesNotCallAnAppendInProgressCutOff(t *testing.T) {
	home := t.TempDir()
	url := seedToolHeavySession(t, home, 3, 0)
	path := filepath.Join(home, historyRoot, "--fixture--", "native.jsonl")
	line := piStep("live", "t002-reply")[0]
	appendNative(t, path, line[:len(line)/2])
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	h := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, nativeSessions)
	completed := false
	nativeWindowReadHook = func() {
		if !completed {
			completed = true
			appendNative(t, path, line[len(line)/2:])
		}
	}
	t.Cleanup(func() { nativeWindowReadHook = nil })
	status, page, body := getRacePage(t, h, url+"?messages=100")
	if status != 200 || page.CutOff || page.Entries[len(page.Entries)-1].Key != "t002-reply" {
		t.Fatalf("append in progress: %d cut_off=%v %s", status, page.CutOff, body)
	}
}

// The same with real timing: a writer appending Pi-sized steps as fast as a
// busy tool loop while the browser pages the tail of a multi-MiB history.
func TestHistoryPageStaysReadableUnderContinuousAppends(t *testing.T) {
	if testing.Short() {
		t.Skip("timing reproduction")
	}
	home := t.TempDir()
	url := seedToolHeavySession(t, home, 300, 0)
	path := filepath.Join(home, historyRoot, "--fixture--", "native.jsonl")
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	h := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, nativeSessions)
	var stop atomic.Bool
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		parent := "t299-reply"
		for i := 0; !stop.Load(); i++ {
			key := fmt.Sprintf("bg%d", i)
			for _, line := range piStep(key, parent) {
				appendNative(t, path, line)
				time.Sleep(200 * time.Microsecond)
			}
			parent = key + "-result"
		}
	}()
	failed := 0
	for i := 0; i < 30; i++ {
		if status, _, _ := getRacePage(t, h, url+"?messages=100"); status != 200 {
			failed++
		}
	}
	stop.Store(true)
	wg.Wait()
	if failed > 0 {
		t.Fatalf("%d of 30 page reads refused while Pi appended", failed)
	}
}

// Every 503 of the history route names in the request record which check
// refused it, as a fixed code; the wire answer stays the same.
func TestHistoryRefusalReasonReachesTheRequestRecord(t *testing.T) {
	home := t.TempDir()
	url := seedToolHeavySession(t, home, 2, 0)
	path := filepath.Join(home, historyRoot, "--fixture--", "native.jsonl")
	appendNative(t, path, "{not json}\n")
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	var log bytes.Buffer
	h := diagnostic.Requests(slog.New(slog.NewJSONHandler(&log, nil)), diagnostic.RequestOptions{}, historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, nativeSessions))
	status, _, body := getRacePage(t, h, url+"?messages=100")
	if status != 503 || !strings.Contains(body, "native_source_unavailable") {
		t.Fatalf("broken record: %d %s", status, body)
	}
	var record map[string]any
	if err := json.Unmarshal(log.Bytes(), &record); err != nil {
		t.Fatalf("request record: %v %q", err, log.String())
	}
	if record["reason"] != "broken_record" {
		t.Fatalf("request record reason %v: %s", record["reason"], log.String())
	}
	if strings.Contains(log.String(), "not json") {
		t.Fatal("record carries native content")
	}
}

// A full quota cuts Pi's append short; once there is room again Pi's next
// append lands on the same line. The page refuses as before, but under its
// own code, so the browser can say storage ran out instead of "tell the
// administrator".
func TestHistoryNamesARecordAFullQuotaCut(t *testing.T) {
	home := t.TempDir()
	url := seedToolHeavySession(t, home, 2, 0)
	path := filepath.Join(home, historyRoot, "--fixture--", "native.jsonl")
	steps := piStep("cut", "t001-reply")
	next := piStep("after", "cut-call")
	appendNative(t, path, steps[0][:len(steps[0])/2]) // ENOSPC mid-write
	appendNative(t, path, next[0]+next[1])            // room again
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	var log bytes.Buffer
	h := diagnostic.Requests(slog.New(slog.NewJSONHandler(&log, nil)), diagnostic.RequestOptions{}, historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, nativeSessions))
	status, _, body := getRacePage(t, h, url+"?messages=100")
	if status != 503 || !strings.Contains(body, `"native_history_cut"`) || !strings.Contains(log.String(), `"reason":"quota_cut_record"`) {
		t.Fatalf("quota cut: %d %s %s", status, body, log.String())
	}
	// A cut inside a multibyte rune is named the same.
	original, _ := os.ReadFile(path)
	umlaut := strings.Replace(piStep("rune", "t001-reply")[0], `"sleep 3000"`, `"echo ä"`, 1)
	cutAt := strings.Index(umlaut, "ä") + 1 // after ä's first byte
	if err := os.WriteFile(path, append(append([]byte{}, original...), umlaut[:cutAt]+next[0]...), 0600); err != nil {
		t.Fatal(err)
	}
	log.Reset()
	if status, _, body := getRacePage(t, h, url+"?messages=100"); status != 503 || !strings.Contains(body, `"native_history_cut"`) {
		t.Fatalf("quota cut inside a rune: %d %s %s", status, body, log.String())
	}
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	// The bytes are never repaired.
	got, _ := os.ReadFile(path)
	if !bytes.Contains(got, []byte(steps[0][:len(steps[0])/2]+next[0])) {
		t.Fatal("native bytes changed")
	}
	// Ordinary garbage is not called a quota cut.
	for _, line := range []string{"{bad", `{"type":"message","id":"x"} trailing`, `{"type":"message","id":"a"`} {
		if quotaCutRecord([]byte(line)) {
			t.Fatalf("%q called a quota cut", line)
		}
	}
}

// A model's usage limit is Pi's error reply, an ordinary entry of the
// history: it never makes the history unreadable.
func TestHistoryReadsAUsageLimitReply(t *testing.T) {
	home := t.TempDir()
	url := seedToolHeavySession(t, home, 2, 0)
	path := filepath.Join(home, historyRoot, "--fixture--", "native.jsonl")
	limit, _ := json.Marshal(map[string]any{"type": "message", "id": "limited", "parentId": "t001-reply", "message": map[string]any{"role": "assistant", "provider": "anthropic", "stopReason": "error", "errorMessage": `429 {"type":"error","error":{"type":"rate_limit_error","message":"This request would exceed your account's rate limit."}}`, "content": []any{}}})
	appendNative(t, path, string(limit)+"\n")
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	h := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, nativeSessions)
	status, page, body := getRacePage(t, h, url+"?messages=100")
	if status != 200 || page.Entries[len(page.Entries)-1].Key != "limited" || page.Entries[len(page.Entries)-1].StopReason != "error" {
		t.Fatalf("usage limit reply: %d %s", status, body)
	}
}
