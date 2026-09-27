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

	"github.com/maintainer/native-agent-host/internal/transport"
)

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
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: "42"}
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
	status, page := get(base + "?limit=200")
	if status != 200 || len(page["entries"].([]any)) != 200 || page["complete"] != false {
		t.Fatal(status, page)
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
	contentID := c["content_id"].(string)
	offset := int(c["next_offset"].(float64))
	status, chunk := get(fmt.Sprintf("/api/v1/content/%s?offset=%d&limit_bytes=65536", contentID, offset))
	if status != 200 || chunk["content"].(map[string]any)["text"] == "" {
		t.Fatal(status, chunk)
	}
	status, reopen := get(base + "?limit=200")
	if status != 200 || reopen["native_revision"] != firstRevision || reopen["entries"].([]any)[0].(map[string]any)["entry_key"] != "native0000" {
		t.Fatal("reopen changed identity")
	}
	if err := os.WriteFile(path, []byte(`{"type":"session","version":3,"id":"`+id+`","cwd":"`+src+`"}`+"\n"+`{"type":"message","id":"a","message":{`+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	sessions, err := reader(cfg)
	if err != nil || len(sessions) != 1 || readNative(sessions[0].path, cfg.UID).state != "corrupt" {
		t.Fatal(sessions, err)
	}
	status, _ = get(base)
	if status != 503 {
		t.Fatal("corrupt accepted", status)
	}
	status, _ = get("/api/v1/content/" + contentID + "?offset=0&limit_bytes=50")
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
