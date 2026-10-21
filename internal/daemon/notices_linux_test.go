//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestNoticesNativeWriteOutcomesAndOwnership(t *testing.T) {
	for _, mode := range []string{"saved", "edquot", "uncertain", "session_switched"} {
		t.Run(mode, func(t *testing.T) {
			home := t.TempDir()
			cwd := filepath.Join(home, "src", "fixture")
			os.MkdirAll(cwd, 0700)
			os.MkdirAll(filepath.Join(home, historyRoot), 0700)
			id := "11111111-1111-4111-8111-111111111111"
			key := "22222222-2222-4222-8222-222222222222"
			path := filepath.Join(home, historyRoot, "native.jsonl")
			header := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, cwd)
			os.WriteFile(path, []byte(header+`{"type":"message","id":"m1","parentId":null,"message":{"role":"user","content":"hello"}}`+"\n"), 0600)
			var calls atomic.Int32
			peer := testProcessPeer(t, os.Getpid(), func(conn net.Conn) {
				var req struct {
					Op     string      `json:"op"`
					Notice agentNotice `json:"notice"`
				}
				if json.NewDecoder(conn).Decode(&req) != nil {
					return
				}
				calls.Add(1)
				if mode == "saved" {
					f, _ := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
					defer f.Close()
					data, _ := json.Marshal(map[string]any{"type": "custom", "id": "n1", "parentId": "m1", "timestamp": req.Notice.Timestamp, "customType": noticeType, "data": req.Notice})
					fmt.Fprintln(f, string(data))
				}
				if mode == "uncertain" {
					return
				}
				json.NewEncoder(conn).Encode(map[string]any{"ok": true, "data": map[string]any{"written": mode == "saved", "reason": func() string {
					if mode == "session_switched" {
						return "conversation_mismatch"
					}
					return ""
				}()}})
			})
			c := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{id: {id: id, cwd: cwd, workspace: "ws_example123", rpc: peer}}, journal: newEventJournal()}
			body := `{"idempotency_key":"` + key + `","text":"<script>alert(1)</script>"}`
			request := func(method, target, body string) *httptest.ResponseRecorder {
				t.Helper()
				w := httptest.NewRecorder()
				c.agentNotices(w, httptest.NewRequest(method, AgentNoticesPath+"?id=pi:"+target, strings.NewReader(body)))
				return w
			}
			dry := request("POST", id, strings.TrimSuffix(body, "}")+`,"dry_run":true}`)
			if dry.Code != 200 || calls.Load() != 0 {
				t.Fatalf("dry run wrote: %d %s", dry.Code, dry.Body.String())
			}
			other := request("POST", "33333333-3333-4333-8333-333333333333", body)
			if other.Code != 404 || calls.Load() != 0 {
				t.Fatal("unknown target reached writer")
			}
			forged := request("POST", id, strings.TrimSuffix(body, "}")+`,"uid":0}`)
			if forged.Code != 400 || calls.Load() != 0 {
				t.Fatal("identity hint accepted")
			}
			got := request("POST", id, body)
			if mode == "session_switched" {
				if got.Code != 409 || len(c.journal.frames) != 0 {
					t.Fatalf("switched session published a notice: %d %s", got.Code, got.Body.String())
				}
				return
			}
			want := map[string]string{"saved": "persisted", "edquot": "not_persisted", "uncertain": "unknown"}[mode]
			if got.Code != 200 || !strings.Contains(got.Body.String(), `"persistence":"`+want+`"`) {
				t.Fatalf("%d %s", got.Code, got.Body.String())
			}
			if len(c.journal.frames) == 0 || !strings.Contains(string(c.journal.frames[0]), `"kind":"notice.created"`) || !strings.Contains(string(c.journal.frames[0]), `"agent_id":"pi:`+id+`"`) {
				t.Fatal("notice not scoped to conversation")
			}
			list := request("GET", id, "")
			if list.Code != 200 || (mode != "saved" && strings.Contains(list.Body.String(), key)) {
				t.Fatalf("non-native notice listed: %s", list.Body.String())
			}
			if mode == "saved" {
				again := request("POST", id, body)
				if again.Code != 200 || calls.Load() != 1 {
					t.Fatal("duplicate native write")
				}
				conflict := request("POST", id, strings.Replace(body, "alert(1)", "alert(2)", 1))
				if conflict.Code != 409 {
					t.Fatal("key reused with different text")
				}
				os.WriteFile(filepath.Join(home, historyRoot, "duplicate.jsonl"), []byte(header), 0600)
				if w := request("GET", id, ""); w.Code != 503 {
					t.Fatal("ambiguous native conversation accepted")
				}
			}
		})
	}
}
func TestNativeNoticeBranchAndProjection(t *testing.T) {
	home := t.TempDir()
	path := filepath.Join(home, "native.jsonl")
	id := "11111111-1111-4111-8111-111111111111"
	n := agentNotice{ID: id, Origin: "agent", Timestamp: "2026-10-21T10:00:00Z", Text: "<img src=x onerror=alert(1)>", Persistence: "unknown"}
	row, _ := json.Marshal(map[string]any{"type": "custom", "id": "n", "parentId": "a", "customType": noticeType, "data": n})
	data := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home) + `{"type":"message","id":"a","parentId":null,"message":{"role":"user","content":"x"}}` + "\n" + string(row) + "\n"
	os.WriteFile(path, []byte(data), 0600)
	notices, err := readNativeNotices(path, os.Geteuid(), id, home)
	if err != nil || len(notices) != 1 || notices[0].Persistence != "persisted" {
		t.Fatalf("%v %+v", err, notices)
	}
	var entry nativeEntry
	json.Unmarshal(row, &entry)
	entry.Raw = row
	projected := nativeBlocks(entry)
	if projected.Notice == nil || projected.Notice.Text != n.Text || projected.Kind != "unknown" {
		t.Fatal("native projection lost notice")
	}
	os.WriteFile(path, []byte(data+`{"type":"message","id":"b","parentId":"a","message":{"role":"user","content":"fork"}}`+"\n"), 0600)
	notices, err = readNativeNotices(path, os.Geteuid(), id, home)
	if err != nil || len(notices) != 0 {
		t.Fatalf("abandoned branch notice escaped: %v %+v", err, notices)
	}
	if _, err = readNativeNotices(path, os.Geteuid(), "22222222-2222-4222-8222-222222222222", home); err == nil {
		t.Fatal("wrong session accepted")
	}
}

func TestNoticeStaleLaunchFailsBeforeNativeRead(t *testing.T) {
	id := "11111111-1111-4111-8111-111111111111"
	generation := "22222222-2222-4222-8222-222222222222"
	c := &ConversationController{home: "/must-not-read", sessions: map[string]*conversation{id: {id: id, workspace: "ws_example123", rpc: &piRPC{processGeneration: generation, exited: make(chan struct{})}}}}
	for _, method := range []string{"GET", "POST"} {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(method, AgentNoticesPath+"?current=true&id=pi:"+id+"&workspace_id=ws_example123&generation=33333333-3333-4333-8333-333333333333", nil)
		c.agentNotices(w, r)
		if w.Code != 409 || !strings.Contains(w.Body.String(), "current_context_stale") {
			t.Fatalf("stale %s reached native source: %d %s", method, w.Code, w.Body.String())
		}
	}
}
