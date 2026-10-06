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
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestLegacyTUIRecapUsesNativeParent(t *testing.T) {
	parent := "assistant1"
	entry := nativeEntry{ID: "recap1", ParentID: &parent, Type: "custom", Raw: json.RawMessage(`{"type":"custom","id":"recap1","parentId":"assistant1","customType":"conversation-recap","data":{"recap":"All set","next":"Review","generatedAt":1750000000000,"completedTurnCount":3,"trigger":"automatic"}}`)}
	projected := nativeBlocks(entry)
	if projected.Recap == nil || projected.Recap.Through != parent || projected.Recap.Next != "Review" {
		t.Fatal(projected)
	}
}

func TestRecapOnAbandonedBranchIsNotCurrent(t *testing.T) {
	home := t.TempDir()
	path := filepath.Join(home, "session.jsonl")
	data := `{"type":"session","version":3,"id":"11111111-1111-4111-8111-111111111111","cwd":"/synthetic"}
{"type":"message","id":"old-user","parentId":null,"message":{"role":"user","content":"Old"}}
{"type":"message","id":"old-assistant","parentId":"old-user","message":{"role":"assistant","content":"Done"}}
{"type":"custom","id":"old-recap","parentId":"old-assistant","customType":"conversation-recap","data":{"recap":"Old work","next":"Review","generatedAt":1750000000000,"through":"old-assistant"}}
{"type":"message","id":"new-user","parentId":null,"message":{"role":"user","content":"New"}}
`
	if err := os.WriteFile(path, []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	recap, latest, ok := latestNativeRecap(path, os.Geteuid(), "11111111-1111-4111-8111-111111111111", "/synthetic")
	if !ok || recap.Through != "" || latest != "new-user" {
		t.Fatalf("old branch leaked: %+v %q %v", recap, latest, ok)
	}
}

func TestNativeRecapPersistsAndBecomesStale(t *testing.T) {
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	root := filepath.Join(home, historyRoot)
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	id := "11111111-1111-4111-8111-111111111111"
	path := filepath.Join(root, "session.jsonl")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	write := func(row any) {
		b, e := json.Marshal(row)
		if e != nil {
			t.Fatal(e)
		}
		fmt.Fprintln(f, string(b))
	}
	write(map[string]any{"type": "session", "version": 3, "id": id, "cwd": cwd})
	write(map[string]any{"type": "message", "id": "one", "parentId": nil, "message": map[string]any{"role": "user", "content": "Work"}})
	write(map[string]any{"type": "message", "id": "two", "parentId": "one", "message": map[string]any{"role": "assistant", "content": []any{map[string]any{"type": "text", "text": "Done"}}}})
	write(map[string]any{"type": "custom", "id": "three", "parentId": "two", "customType": "conversation-recap", "data": map[string]any{"recap": "Work completed", "next": "Check tests", "generatedAt": 1750000000000, "through": "two", "private": "never expose"}})
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	u, _ := user.Current()
	uid, _ := strconv.Atoi(u.Uid)
	cfg := transport.Config{UID: uid, GatewayUID: uid, Home: home, Username: u.Username}
	handler := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, nativeSessions)
	get := func() map[string]any {
		t.Helper()
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+id+"/recap", nil))
		if w.Code != 200 {
			t.Fatalf("GET: %d %s", w.Code, w.Body.String())
		}
		var result map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if _, ok := result["private"]; ok {
			t.Fatal("private metadata exposed")
		}
		return result
	}
	first := get()
	window := readNativeWindow(path, uid, "", 25)
	foundRecap := false
	for _, entry := range window.entries {
		if entry.Recap == nil {
			continue
		}
		foundRecap = true
		inline(&window, &entry)
		if entry.Kind != "recap" || entry.Content.MediaType != "text/plain" || !entry.Content.Complete {
			t.Fatal("invalid native history projection", entry)
		}
	}
	if !foundRecap {
		t.Fatal("recap missing from native history window")
	}
	if first["latest_message"] != "two" || first["recap"].(map[string]any)["through"] != "two" {
		t.Fatal(first)
	}
	f, err = os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Fprintln(f, `{"type":"message","id":"four","parentId":"three","message":{"role":"user","content":"More"}}`)
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	second := get()
	if second["latest_message"] != "four" || second["recap"].(map[string]any)["through"] != "two" {
		t.Fatal(second)
	}
	f, err = os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	parent := "four"
	for i := 0; i < 250; i++ {
		id := fmt.Sprintf("turn%d", i)
		row, _ := json.Marshal(map[string]any{"type": "message", "id": id, "parentId": parent, "message": map[string]any{"role": "user", "content": "More"}})
		fmt.Fprintln(f, string(row))
		parent = id
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	after := get()
	if after["latest_message"] != "turn249" || after["recap"].(map[string]any)["through"] != "two" {
		t.Fatal(after)
	}
}
