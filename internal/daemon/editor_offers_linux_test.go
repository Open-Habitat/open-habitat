//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"net/http/httptest"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

type editorOfferReply struct {
	DryRun   bool        `json:"dry_run"`
	Reused   bool        `json:"reused"`
	Offer    editorOffer `json:"offer"`
	Delivery struct {
		Target      string `json:"target"`
		Persistence string `json:"persistence"`
	} `json:"delivery"`
	Editor struct {
		Engine string `json:"engine"`
	} `json:"editor"`
	Error struct {
		Code string `json:"code"`
	} `json:"error"`
}

func offerEditor(t *testing.T, c *ConversationController, query string, body map[string]any) (int, editorOfferReply) {
	t.Helper()
	b, _ := json.Marshal(body)
	target := "http://unix" + AgentEditorOffersPath
	if query != "" {
		target += "?" + query
	}
	r := httptest.NewRequest("POST", target, strings.NewReader(string(b)))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.agentEditorOffers(w, r)
	var v editorOfferReply
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		t.Fatalf("reply %d %q", w.Code, w.Body.String())
	}
	return w.Code, v
}

func editorOfferEvents(c *ConversationController) int {
	n := 0
	for _, f := range c.journal.frames {
		if strings.Contains(string(f), `"kind":"editor.offered"`) {
			n++
		}
	}
	return n
}

func editorOfferFixture(t *testing.T) (*heldHarness, *ConversationController, string) {
	t.Helper()
	h := newHeldHarness(t)
	ws := filepath.Join(h.root, "src", "project")
	secret := filepath.Join(h.root, "secret")
	for _, d := range []string{secret, filepath.Join(ws, "cmd"), filepath.Join(ws, ".github")} {
		if err := os.MkdirAll(d, 0700); err != nil {
			t.Fatal(err)
		}
	}
	for path, text := range map[string]string{
		filepath.Join(secret, "token.go"):       "salaisuus",
		filepath.Join(ws, "cmd", "main.go"):     "package main\n",
		filepath.Join(ws, ".github", "ci.yml"):  "on: push\n",
		filepath.Join(h.root, "src", "sib.txt"): "sibling",
	} {
		if err := os.WriteFile(path, []byte(text), 0600); err != nil {
			t.Fatal(err)
		}
	}
	for link, to := range map[string]string{
		filepath.Join(ws, "leak.go"):   filepath.Join(secret, "token.go"),
		filepath.Join(ws, "inside.go"): "cmd/main.go",
	} {
		if err := os.Symlink(to, link); err != nil {
			t.Fatal(err)
		}
	}
	c, stop := h.daemon()
	t.Cleanup(stop)
	return h, c, composerWorkspaceID(t, h, "project")
}

// An offer names only a regular file beneath its workspace; anything else is
// refused before the browser hears of it.
func TestEditorOfferIsConfinedToAWorkspaceFile(t *testing.T) {
	_, c, ws := editorOfferFixture(t)
	key := func(n int) string { return fmt.Sprintf("00000000-0000-4000-8000-%012d", n) }
	for i, tc := range []struct {
		path      string
		workspace string
		status    int
		code      string
	}{
		{"/etc/passwd", ws, 400, "invalid_arguments"},
		{"../sib.txt", ws, 400, "invalid_arguments"},
		{"cmd/../../sib.txt", ws, 400, "invalid_arguments"},
		{"./cmd/main.go", ws, 400, "invalid_arguments"},
		{"cmd//main.go", ws, 400, "invalid_arguments"},
		{"cmd/main.go\n", ws, 400, "invalid_arguments"},
		{"cmd", ws, 404, "file_unavailable"},
		{"leak.go", ws, 404, "file_unavailable"},
		// The browser editor follows no symlink, even one that stays inside.
		{"inside.go", ws, 404, "file_unavailable"},
		{"missing.go", ws, 404, "file_unavailable"},
		{"cmd/main.go", "ws_doesnotexist1", 404, "workspace_unavailable"},
	} {
		code, v := offerEditor(t, c, "", map[string]any{"idempotency_key": key(i + 1), "workspace_id": tc.workspace, "path": tc.path})
		if code != tc.status || v.Error.Code != tc.code {
			t.Errorf("%q: %d %+v, want %d %s", tc.path, code, v, tc.status, tc.code)
		}
	}
	if n := editorOfferEvents(c); n != 0 {
		t.Fatalf("refused offers published %d events", n)
	}
	// A file under a dot directory is one the editor opens too.
	for i, p := range []string{"cmd/main.go", ".github/ci.yml"} {
		if code, v := offerEditor(t, c, "", map[string]any{"idempotency_key": key(50 + i), "workspace_id": ws, "path": p}); code != 200 {
			t.Fatalf("%s: %d %+v", p, code, v)
		}
	}
}

func TestEditorAccountOfferIsPublishedOnce(t *testing.T) {
	_, c, ws := editorOfferFixture(t)
	body := map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000001", "workspace_id": ws, "path": "cmd/main.go", "line": 3}
	if code, dry := offerEditor(t, c, "", map[string]any{"idempotency_key": body["idempotency_key"], "workspace_id": ws, "path": "cmd/main.go", "line": 3, "dry_run": true}); code != 200 || !dry.DryRun || editorOfferEvents(c) != 0 {
		t.Fatalf("dry run: %d %+v events=%d", code, dry, editorOfferEvents(c))
	}
	code, v := offerEditor(t, c, "", body)
	if code != 200 || v.Delivery.Target != "account" || v.Delivery.Persistence != "transient" || v.Offer.Line != 3 || v.Offer.ConversationID != "" || editorOfferEvents(c) != 1 || !validEditorOffer(v.Offer) {
		t.Fatalf("offer: %d %+v events=%d", code, v, editorOfferEvents(c))
	}
	// A retried key answers the first offer and shows nothing twice; the same
	// key for another offer is a conflict.
	if code, again := offerEditor(t, c, "", body); code != 200 || !again.Reused || again.Offer != v.Offer || editorOfferEvents(c) != 1 {
		t.Fatalf("retry: %d %+v events=%d", code, again, editorOfferEvents(c))
	}
	other := map[string]any{"idempotency_key": body["idempotency_key"], "workspace_id": ws, "path": "cmd/main.go", "line": 4}
	if code, conflict := offerEditor(t, c, "", other); code != 409 || conflict.Error.Code != "idempotency_conflict" || editorOfferEvents(c) != 1 {
		t.Fatalf("conflict: %d %+v", code, conflict)
	}
}

// Without the person's chosen editor nothing is offered, and the agent is told.
func TestEditorOfferSaysWhenTheEditorIsNotInstalled(t *testing.T) {
	h, c, ws := editorOfferFixture(t)
	if err := saveEditorPreference(h.root, editorPreference{Engine: "vscode"}); err != nil {
		t.Fatal(err)
	}
	installed := false
	c.codeServerOffered = func() bool { return installed }
	body := map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000001", "workspace_id": ws, "path": "cmd/main.go"}
	if code, v := offerEditor(t, c, "", body); code != 409 || v.Error.Code != "editor_unavailable" || editorOfferEvents(c) != 0 {
		t.Fatalf("no code-server: %d %+v", code, v)
	}
	installed = true
	if code, v := offerEditor(t, c, "", body); code != 200 || v.Editor.Engine != "vscode" || editorOfferEvents(c) != 1 {
		t.Fatalf("code-server installed: %d %+v", code, v)
	}
}

func TestEditorOfferInConversationIsANativeNotice(t *testing.T) {
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	os.MkdirAll(filepath.Join(cwd, "cmd"), 0700)
	os.MkdirAll(filepath.Join(home, "src", "other"), 0700)
	os.MkdirAll(filepath.Join(home, historyRoot), 0700)
	os.WriteFile(filepath.Join(cwd, "cmd", "main.go"), []byte("package main\n"), 0600)
	os.WriteFile(filepath.Join(home, "src", "other", "x.go"), []byte("package x\n"), 0600)
	id := "11111111-1111-4111-8111-111111111111"
	path := filepath.Join(home, historyRoot, "native.jsonl")
	header := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, cwd)
	os.WriteFile(path, []byte(header+`{"type":"message","id":"m1","parentId":null,"message":{"role":"user","content":"hello"}}`+"\n"), 0600)
	var calls atomic.Int32
	peer := testProcessPeer(t, os.Getpid(), func(conn net.Conn) {
		var req struct {
			Notice agentNotice `json:"notice"`
		}
		if json.NewDecoder(conn).Decode(&req) != nil {
			return
		}
		calls.Add(1)
		f, _ := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
		defer f.Close()
		data, _ := json.Marshal(map[string]any{"type": "custom", "id": "n1", "parentId": "m1", "timestamp": req.Notice.Timestamp, "customType": noticeType, "data": req.Notice})
		fmt.Fprintln(f, string(data))
		json.NewEncoder(conn).Encode(map[string]any{"ok": true, "data": map[string]any{"written": true}})
	})
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	ids := map[string]string{}
	for _, e := range Discover(cfg).Entries {
		ids[e.Name] = workspaceIDOf(cfg, e)
	}
	c := &ConversationController{home: home, cfg: cfg, sessions: map[string]*conversation{id: {id: id, cwd: cwd, workspace: ids["fixture"], rpc: peer}}, journal: newEventJournal()}
	// The card opens in the conversation's own editor, so another workspace's
	// file is refused before anything is written.
	if code, v := offerEditor(t, c, "id=pi:"+id, map[string]any{"idempotency_key": "22222222-2222-4222-8222-222222222221", "workspace_id": ids["other"], "path": "x.go"}); code != 409 || v.Error.Code != "workspace_mismatch" || calls.Load() != 0 {
		t.Fatalf("other workspace: %d %+v", code, v)
	}
	body := map[string]any{"idempotency_key": "22222222-2222-4222-8222-222222222222", "workspace_id": ids["fixture"], "path": "cmd/main.go", "line": 1}
	code, v := offerEditor(t, c, "id=pi:"+id, body)
	if code != 200 || v.Delivery.Target != "conversation" || v.Delivery.Persistence != "persisted" || v.Offer.ConversationID != "pi:"+id || calls.Load() != 1 {
		t.Fatalf("conversation offer: %d %+v", code, v)
	}
	notices, err := readNativeNotices(path, os.Geteuid(), id, cwd)
	if err != nil || len(notices) != 1 || notices[0].Editor == nil || !sameEditorOffer(notices[0].Editor, &v.Offer) || notices[0].Text != "cmd/main.go:1" || notices[0].View != nil {
		t.Fatalf("native notice: %v %+v", err, notices)
	}
	if code, again := offerEditor(t, c, "id=pi:"+id, body); code != 200 || calls.Load() != 1 || !sameEditorOffer(&again.Offer, &v.Offer) {
		t.Fatalf("replay: %d %+v calls=%d", code, again, calls.Load())
	}
	// A notice carrying both kinds of offer is not a notice this reader accepts.
	both := notices[0]
	both.View = &viewSummary{ID: "vabcdefghijklmnopqrstuvwxyz", Title: "x", Entry: "x.html", Files: 1, CreatedAt: both.Timestamp}
	if validNotice(both) {
		t.Fatal("a notice with a view and an editor offer was accepted")
	}
}
