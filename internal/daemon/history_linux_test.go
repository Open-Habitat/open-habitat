//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestUnknownNativeContentDoesNotExposeUncheckedPayload(t *testing.T) {
	cases := []nativeEntry{
		{Type: "message", Message: json.RawMessage(`{"role":"assistant","content":[{"type":"futureQuestion","prompt":"Jatketaanko?","choices":["Kyllä"]}]}`)},
		{Type: "futureEntry", Raw: json.RawMessage(`{"type":"futureEntry","payload":"<script>alert(1)</script>"}`)},
	}
	for _, entry := range cases {
		kind, text := nativeText(entry)
		if (kind != "unknown" && kind != "assistant") || strings.Contains(text, "Jatketaanko?") || strings.Contains(text, "<script>") {
			t.Fatalf("unchecked native payload exposed: %s: %s", kind, text)
		}
	}
}

// The flattened text is the message's own text only: the browser words tool
// calls, other blocks and unknown entries in the person's language, so the
// daemon adds no words of its own.
func TestNativeTextFlattensOnlyTheMessagesText(t *testing.T) {
	kind, text := nativeText(nativeEntry{Type: "message", Message: json.RawMessage(`{"role":"assistant","content":[{"type":"text","text":"Ready."},{"type":"toolCall","name":"read"},{"type":"image","mimeType":"image/png"}]}`)})
	if kind != "assistant" || text != "Ready." {
		t.Fatalf("assistant: %s %q", kind, text)
	}
	for _, entry := range []nativeEntry{
		{Type: "message", Message: json.RawMessage(`[]`)},
		{Type: "message", Message: json.RawMessage(`{"role":"assistant","content":{}}`)},
		{Type: "futureEntry"},
	} {
		if kind, text := nativeText(entry); kind != "unknown" || text != "" {
			t.Fatalf("%s: %s %q", entry.Type, kind, text)
		}
	}
}

func TestPiHistoryNativePagesChunksAndReopen(t *testing.T) {
	home := t.TempDir()
	src := filepath.Join(home, "src", "fixture")
	if err := os.MkdirAll(src, 0700); err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(home, historyRoot)
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	id := "11111111-1111-4111-8111-111111111111"
	path := filepath.Join(root, "native.jsonl")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	write := func(v any) {
		t.Helper()
		b, e := json.Marshal(v)
		if e != nil {
			t.Fatal(e)
		}
		fmt.Fprintln(f, string(b))
	}
	write(map[string]any{"type": "session", "version": 3, "id": id, "cwd": src})
	long := strings.Repeat("ä", 40000) + "<script>alert('bad')</script>"
	for i := 0; i < 2500; i++ {
		text := fmt.Sprintf("fixture %d", i)
		if i == 2497 {
			text = long
		}
		row := map[string]any{"type": "message", "id": fmt.Sprintf("native%04d", i), "message": map[string]any{"role": "user", "content": text}}
		if i == 2499 {
			row["type"] = "unfamiliar_event"
		}
		write(row)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	u, _ := user.Current()
	uid, _ := strconv.Atoi(u.Uid)
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: "42"}
	reader := func(c transport.Config) ([]nativeSession, error) { c.Home = home; return nativeSessions(c) }
	get := func(path string) (int, map[string]any) {
		t.Helper()
		r := httptest.NewRequest("GET", "http://unix"+path, nil)
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
		w := httptest.NewRecorder()
		historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, reader).ServeHTTP(w, r)
		var body map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &body)
		return w.Code, body
	}
	base := "/api/v1/agents/pi:" + id + "/history"
	status, page := get(base + "?limit=200&after=")
	if status != 200 || len(page["entries"].([]any)) != 200 || page["complete"] != false {
		t.Fatal(status, page)
	}
	sessions, err := reader(cfg)
	if err != nil || len(sessions) != 1 {
		t.Fatal(sessions, err)
	}
	fact := sessionFact(sessions[0], "ws_fixture123", uid)
	title := fact["title"].(map[string]any)
	if title["display"] != "fixture 0" || title["source"] != "first_message_fallback" {
		t.Fatal(title)
	}
	firstRevision := page["native_revision"]
	seen := map[string]bool{}
	for {
		for _, v := range page["entries"].([]any) {
			key := v.(map[string]any)["entry_key"].(string)
			if seen[key] {
				t.Fatal("duplicate", key)
			}
			seen[key] = true
		}
		if page["complete"] == true {
			break
		}
		status, page = get(base + "?limit=200&after=" + page["next_after"].(string))
		if status != 200 || page["native_revision"] != firstRevision {
			t.Fatal(status, page)
		}
	}
	if len(seen) != 2500 {
		t.Fatal(len(seen))
	}
	if page["entries"].([]any)[len(page["entries"].([]any))-1].(map[string]any)["kind"] != "unknown" {
		t.Fatal("unknown event hidden")
	}
	status, page = get(base + "?after=native2496&limit=1")
	if status != 200 {
		t.Fatal(status, page)
	}
	c := page["entries"].([]any)[0].(map[string]any)["content"].(map[string]any)
	if c["complete"] != false {
		t.Fatal("long entry not chunked")
	}
	blockURL := fmt.Sprintf("/api/v1/agents/pi:%s/entries/native2496/blocks/0?revision=%s&offset=0&limit_bytes=65536", id, firstRevision)
	status, chunk := get(blockURL)
	if status != 200 || chunk["chunk"].(map[string]any)["text"] == "" {
		t.Fatal(status, chunk)
	}
	// Tail-first reads one bounded page, and backward pages include their
	// shared boundary while preserving native order.
	status, tail := get(base + "?limit=3")
	if status != 200 || tail["older_complete"] != false || tail["boundary_found"] != true ||
		tail["entries"].([]any)[0].(map[string]any)["entry_key"] != "native2497" {
		t.Fatal("tail", status, tail)
	}
	status, older := get(base + "?limit=3&before=native2497")
	if status != 200 || len(older["entries"].([]any)) != 4 ||
		older["entries"].([]any)[3].(map[string]any)["entry_key"] != "native2497" ||
		older["next_before"] != "native2494" {
		t.Fatal("older", status, older)
	}
	// Walk every page with only the shared boundary repeated.
	status, back := get(base + "?limit=200")
	if status != 200 {
		t.Fatal(status)
	}
	backKeys := map[string]bool{}
	backRequests := 1
	for {
		items := back["entries"].([]any)
		for _, item := range items {
			key := item.(map[string]any)["entry_key"].(string)
			backKeys[key] = true
		}
		if back["older_complete"] == true {
			break
		}
		cursor := back["next_before"].(string)
		status, back = get(base + "?limit=200&before=" + cursor)
		backRequests++
		if status != 200 || back["boundary_found"] != true ||
			back["entries"].([]any)[len(back["entries"].([]any))-1].(map[string]any)["entry_key"] != cursor {
			t.Fatal("disjoint page", status, cursor)
		}
		if backRequests > 20 {
			t.Fatal("non-progressing cursor")
		}
	}
	if len(backKeys) != 2500 || backRequests != 13 {
		t.Fatal("backward coverage", len(backKeys), backRequests)
	}
	t.Logf("2500 native entries in %d backward HTTP pages (one boundary overlap per page)", backRequests)
	status, missing := get(base + "?before=missing&limit=3")
	if status != 200 || missing["boundary_found"] != false || len(missing["entries"].([]any)) != 0 {
		t.Fatal("missing boundary", status, missing)
	}
	appendFile, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	_, err = fmt.Fprintln(appendFile, `{"type":"message","id":"native2500","message":{"role":"user","content":"append"}}`)
	if err != nil {
		t.Fatal(err)
	}
	if err = appendFile.Close(); err != nil {
		t.Fatal(err)
	}
	status, appendedOlder := get(base + "?before=native2497&limit=3")
	if status != 200 || appendedOlder["entries"].([]any)[3].(map[string]any)["entry_key"] != "native2497" {
		t.Fatal("append invalidated cursor", status, appendedOlder)
	}
	status, reopen := get(base + "?limit=200&after=")
	if status != 200 || reopen["native_revision"] == firstRevision || reopen["entries"].([]any)[0].(map[string]any)["entry_key"] != "native0000" {
		t.Fatal("reopen changed identity")
	}
	if err := os.WriteFile(path, []byte(`{"type":"session","version":3,"id":"`+id+`","cwd":"`+src+`"}`+"\n"+`{"type":"message","id":"a","message":{`+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	sessions, err = reader(cfg)
	if err != nil || len(sessions) != 1 || readNative(sessions[0].path, cfg.UID).state != "corrupt" {
		t.Fatal(sessions, err)
	}
	status, _ = get(base)
	if status != 503 {
		t.Fatal("corrupt accepted", status)
	}
	status, _ = get(blockURL)
	if status != 404 {
		t.Fatal("old revision accepted", status)
	}
}

// Run with PI_DISPOSABLE_HISTORY_FILE pointing to create-native-fixture.mjs's
// explicit /tmp output. CI's synthetic fixture remains self-contained.
func TestPiHistoryTreeAndModel(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "tree.jsonl")
	lines := []string{
		`{"type":"session","version":3,"id":"11111111-1111-4111-8111-111111111111","cwd":"/tmp/synthetic"}`,
		`{"type":"model_change","id":"a","parentId":null,"provider":"openai-codex","modelId":"gpt-synthetic"}`,
		`{"type":"message","id":"b","parentId":"a","message":{"role":"user","content":"old branch"}}`,
		`{"type":"message","id":"c","parentId":"a","message":{"role":"user","content":"new branch"}}`,
	}
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	s := readNative(path, os.Getuid())
	if s.state != "readable" || len(s.entries) != 2 || s.entries[0].full != "openai-codex/gpt-synthetic" || s.entries[1].full != "new branch" {
		t.Fatalf("branch/model: %+v", s)
	}
}
func TestPiHistoryDisposableSDKFixture(t *testing.T) {
	path := os.Getenv("PI_DISPOSABLE_HISTORY_FILE")
	if path == "" {
		t.Skip("opt-in disposable native SDK fixture")
	}
	if !strings.HasPrefix(path, "/tmp/") {
		t.Fatal("fixture must be disposable")
	}
	s := readNative(path, os.Getuid())
	if s.id != "11111111-1111-4111-8111-111111111111" || s.state != "readable" || len(s.entries) != 2 || s.entries[0].full != "synthetic native user" || s.entries[1].full != "synthetic native assistant" {
		t.Fatalf("native SDK mismatch: %+v", s)
	}
}
func TestPiHistoryMovedCwdAndSymlink(t *testing.T) {
	home := t.TempDir()
	root := filepath.Join(home, historyRoot)
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	id := "11111111-1111-4111-8111-111111111111"
	if err := os.WriteFile(filepath.Join(root, "native.jsonl"), []byte(`{"type":"session","version":3,"id":"`+id+`","cwd":"/moved/workspace"}`+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	sessions, err := nativeSessions(transport.Config{Home: home, UID: os.Getuid()})
	if err != nil || len(sessions) != 1 || sessions[0].cwd != "/moved/workspace" {
		t.Fatal(sessions, err)
	}
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(home, ".pi", "agent", "sessions", "link")); err != nil {
		t.Fatal(err)
	}
	sessions, err = nativeSessions(transport.Config{Home: home, UID: os.Getuid()})
	if err != nil || len(sessions) != 1 {
		t.Fatal("followed symlink", err)
	}
}

func TestTailPageLargeNativeFileAndByteCap(t *testing.T) {
	home := t.TempDir()
	root := filepath.Join(home, historyRoot)
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	id := "11111111-1111-4111-8111-111111111111"
	path := filepath.Join(root, "large.jsonl")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Fprintf(f, "{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":\"/synthetic\"}\n", id)
	// A native record several times the test-scale 256 KiB page budget;
	// the tail response must skip it, then the older page must chunk it.
	large := strings.Repeat("x", 1<<20)
	fmt.Fprintf(f, "{\"type\":\"message\",\"id\":\"first\",\"message\":{\"role\":\"user\",\"content\":%q}}\n", large)
	for i := 0; i < 8; i++ {
		fmt.Fprintf(f, "{\"type\":\"message\",\"id\":\"last%d\",\"message\":{\"role\":\"user\",\"content\":%q}}\n", i, strings.Repeat("y", 60000))
	}
	if err = f.Close(); err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	h := HistoryHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, home)
	read := func(url string) (int, map[string]any, int) {
		t.Helper()
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix"+url, nil))
		var body map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		return w.Code, body, w.Body.Len()
	}
	base := "/api/v1/agents/pi:" + id + "/history"
	started := time.Now()
	status, page, n := read(base + "?limit=8")
	tailDuration := time.Since(started)
	tailBytes := n
	if status != 200 || n > 350000 || len(page["entries"].([]any)) < 1 || page["next_before"] == nil {
		t.Fatal("tail byte cap", status, n, page["next_before"])
	}
	status, older, n := read(base + "?before=last0&limit=2")
	if status != 200 || n > 350000 || older["entries"].([]any)[0].(map[string]any)["entry_key"] != "first" {
		t.Fatal("large entry", status, n)
	}
	content := older["entries"].([]any)[0].(map[string]any)["content"].(map[string]any)
	if content["complete"] != false {
		t.Fatal("huge entry not chunked")
	}
	blockURL := fmt.Sprintf("/api/v1/agents/pi:%s/entries/first/blocks/0?revision=%s&offset=0&limit_bytes=65536", id, older["native_revision"])
	status, chunk, n := read(blockURL)
	if status != 200 || n > 70000 || chunk["chunk"].(map[string]any)["text"] == "" {
		t.Fatal("content cap", status, n)
	}
	appendFile, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = appendFile.WriteString(`{"type":"message","id":"appended","message":{"role":"user","content":"new"}}` + "\n"); err != nil {
		t.Fatal(err)
	}
	if err = appendFile.Close(); err != nil {
		t.Fatal(err)
	}
	status, _, _ = read(blockURL)
	if status != 404 {
		t.Fatal("stale content revision accepted", status)
	}
	t.Logf("native bytes=%d, tail request duration=%s, tail response bytes=%d, content response bytes=%d, HTTP requests=4", len(large), tailDuration, tailBytes, n)
}

func TestTailPageFollowsActiveNativeBranch(t *testing.T) {
	path := filepath.Join(t.TempDir(), "branch.jsonl")
	lines := []string{
		`{"type":"session","version":3,"id":"11111111-1111-4111-8111-111111111111","cwd":"/synthetic"}`,
		`{"type":"message","id":"a","parentId":null,"message":{"role":"user","content":"root"}}`,
		`{"type":"message","id":"b","parentId":"a","message":{"role":"user","content":"old"}}`,
		`{"type":"message","id":"c","parentId":"a","message":{"role":"user","content":"active"}}`,
	}
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	page := readNativeWindow(path, os.Getuid(), "", 2)
	if page.state != "readable" || len(page.entries) != 2 || page.entries[0].Key != "a" || page.entries[1].Key != "c" || !page.olderComplete {
		t.Fatal(page)
	}
	stale := readNativeWindow(path, os.Getuid(), "b", 2)
	if stale.state != "readable" || stale.boundaryFound {
		t.Fatal("inactive branch cursor accepted", stale)
	}
}

// A forward page keeps only the entries it returns, yet follows the active
// branch, which the file names only at its end: an abandoned branch written
// first is neither returned nor counted, and its key is no cursor.
func TestForwardPageFollowsActiveNativeBranch(t *testing.T) {
	path := filepath.Join(t.TempDir(), "branch.jsonl")
	lines := []string{
		`{"type":"session","version":3,"id":"11111111-1111-4111-8111-111111111111","cwd":"/synthetic"}`,
		`{"type":"message","id":"a","parentId":null,"message":{"role":"user","content":"root"}}`,
		`{"type":"message","id":"b","parentId":"a","message":{"role":"user","content":"old"}}`,
		`{"type":"message","id":"b2","parentId":"b","message":{"role":"assistant","content":"old reply"}}`,
		`{"type":"model_change","id":"m","parentId":"a","provider":"p","modelId":"x"}`,
		`{"type":"message","id":"c","parentId":"m","message":{"role":"user","content":"active"}}`,
		`{"type":"message","id":"d","parentId":"c","message":{"role":"assistant","content":"reply"}}`,
	}
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	keys := func(s nativeSession) string {
		var k []string
		for _, e := range s.entries {
			k = append(k, e.Key)
		}
		return strings.Join(k, ",")
	}
	for _, c := range []struct {
		after string
		limit int
		want  string
		found bool
	}{
		{"", 2, "a,m,c", true},
		{"", 10, "a,m,c,d", true},
		{"m", 1, "c,d", true},
		{"d", 5, "", true},
		{"b", 5, "", false},
		{"gone", 5, "", false},
	} {
		page, found := readNativeForward(path, os.Getuid(), c.after, c.limit)
		if page.state != "readable" || found != c.found || found && keys(page) != c.want {
			t.Fatalf("after %q limit %d: %s %v %q", c.after, c.limit, page.state, found, keys(page))
		}
	}
	// Publication keeps what is not yet published; an abandoned branch is
	// never even projected.
	asked := map[string]bool{}
	all := readNativeRetaining(path, os.Getuid(), func(id string, project func() historyEntry) (historyEntry, bool) {
		asked[id] = true
		return retainAll(id, project)
	})
	if keys(all) != "a,m,c,d" || asked["b"] || asked["b2"] {
		t.Fatalf("active read kept %q, asked %v", keys(all), asked)
	}
}

func TestTailWindowRetriesUnstableNativeReadOnce(t *testing.T) {
	for _, first := range []nativeSession{{}, {id: "native", state: "corrupt"}} {
		calls := 0
		result := settleNativeWindow(func() nativeSession {
			calls++
			if calls == 1 {
				return first
			}
			return nativeSession{id: "native", state: "readable"}
		})
		if calls != 2 || result.state != "readable" {
			t.Fatal("did not recover from append", calls, result)
		}
	}
}

func TestNativeTimestampsComeOnlyFromNativeJSONL(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "session.jsonl")
	id := "11111111-1111-4111-8111-111111111111"
	data := fmt.Sprintf(`{"type":"session","version":3,"id":%q,"cwd":%q,"timestamp":"2026-10-13T10:00:00Z"}`+"\n"+`{"type":"message","id":"a","timestamp":"2026-10-13T10:01:07Z","message":{"role":"user","content":"synthetic"}}`+"\n", id, root)
	if err := os.WriteFile(path, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	header := readNativeHeader(path, os.Getuid())
	history := readNativeWindow(path, os.Getuid(), "", 25)
	if header.startedAt != "2026-10-13T10:00:00Z" || history.entries[0].Timestamp != "2026-10-13T10:01:07Z" {
		t.Fatalf("native times: %q %+v", header.startedAt, history.entries)
	}
}

// Quota truncation is tolerated only at EOF, not as a way to skip bad records.
func TestNativeCutOffTail(t *testing.T) {
	home := t.TempDir()
	path := filepath.Join(home, "history.jsonl")
	id := "12345678-1234-4123-8123-123456789abc"
	prefix := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home) + `{"type":"message","id":"first","parentId":null,"message":{"role":"user","content":"saved"}}` + "\n"
	for _, tail := range []string{`{"type":"message","id":"last","message":{"content":"cut`, "{\"text\":\"\xe2\x82"} {
		if err := os.WriteFile(path, []byte(prefix+tail), 0600); err != nil {
			t.Fatal(err)
		}
		for _, native := range []nativeSession{readNativeSettled(path, os.Geteuid()), readNativeWindowSettled(path, os.Geteuid(), "", 25, "")} {
			if native.state != "readable" || !native.cutOff || len(native.entries) != 1 || native.entries[0].full != "saved" {
				t.Fatalf("cut-off projection: %+v", native)
			}
		}
		if _, err := reconciledNativeHistory(path, os.Geteuid(), id, home); err == nil {
			t.Fatal("cut-off history admitted for native writing")
		}
		if _, err := existingHistoryKeys(path, os.Geteuid(), id, home); err == nil {
			t.Fatal("cut-off history seeded for continuation")
		}
		got, _ := os.ReadFile(path)
		if string(got) != prefix+tail {
			t.Fatal("native bytes repaired silently")
		}
	}
	for _, tail := range []string{"{bad", "{\"type\":\"message\"}\n{bad\n", "{\"type\":\n", "{\"id\":\"first\"}\n"} {
		if err := os.WriteFile(path, []byte(prefix+tail), 0600); err != nil {
			t.Fatal(err)
		}
		if readNativeSettled(path, os.Geteuid()).state == "readable" || readNativeWindowSettled(path, os.Geteuid(), "", 25, "").state == "readable" {
			t.Fatalf("corruption accepted: %q", tail)
		}
	}
}

// A conversation past the former 512 MiB whole-file bound is discovered as
// readable with its size, which the browser uses to advise a new
// conversation; discovery must not fall back to a bare unavailable state.
// The file is sparse, so the test writes only its header.
func TestDiscoveryKeepsConversationOverFormerBoundReadable(t *testing.T) {
	id := "11111111-2222-3333-4444-555555555555"
	path := filepath.Join(t.TempDir(), "large.jsonl")
	if err := os.WriteFile(path, []byte(`{"type":"session","version":3,"id":"`+id+`","cwd":"/workspace"}`+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	const size = 600 << 20
	if err := os.Truncate(path, size); err != nil {
		t.Fatal(err)
	}
	s := readNativeHeader(path, os.Getuid())
	if s.id != id || s.state != "readable" || s.bytes != size {
		t.Fatalf("large conversation discovered as id=%q state=%q bytes=%d", s.id, s.state, s.bytes)
	}
}
