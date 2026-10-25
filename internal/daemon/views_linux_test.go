//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"syscall"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

type viewReply struct {
	Reused        bool        `json:"reused"`
	DryRun        bool        `json:"dry_run"`
	View          viewSummary `json:"view"`
	SkippedHidden int         `json:"skipped_hidden"`
	Offer         struct {
		Target string `json:"target"`
	} `json:"offer"`
	Error struct {
		Code string `json:"code"`
	} `json:"error"`
}

func offerView(t *testing.T, c *ConversationController, query string, body map[string]any) (int, viewReply) {
	t.Helper()
	b, _ := json.Marshal(body)
	target := "http://unix" + AgentViewsPath
	if query != "" {
		target += "?" + query
	}
	r := httptest.NewRequest("POST", target, strings.NewReader(string(b)))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.agentViews(w, r)
	var v viewReply
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		t.Fatalf("reply %d %q", w.Code, w.Body.String())
	}
	return w.Code, v
}

func readExport(h http.Handler, path string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("GET", "http://unix"+path, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func viewFixture(t *testing.T) (*heldHarness, *ConversationController, string) {
	t.Helper()
	h := newHeldHarness(t)
	ws := filepath.Join(h.root, "src", "project")
	secret := filepath.Join(h.root, "secret")
	for _, d := range []string{secret, filepath.Join(ws, "site", "sub"), filepath.Join(ws, "site", ".git"), filepath.Join(ws, "linked-site")} {
		if err := os.MkdirAll(d, 0700); err != nil {
			t.Fatal(err)
		}
	}
	for path, text := range map[string]string{
		filepath.Join(secret, "token.html"):            "salaisuus",
		filepath.Join(ws, "report.html"):               "<h1>v1</h1>",
		filepath.Join(ws, "notes.txt"):                 "not html",
		filepath.Join(ws, "site", "index.html"):        "<script src=app.js></script>",
		filepath.Join(ws, "site", "app.js"):            "1",
		filepath.Join(ws, "site", "sub", "x.css"):      "p{}",
		filepath.Join(ws, "site", ".env"):              "TOKEN=x",
		filepath.Join(ws, "site", ".git", "config"):    "[core]",
		filepath.Join(ws, "linked-site", "index.html"): "ok",
	} {
		if err := os.WriteFile(path, []byte(text), 0600); err != nil {
			t.Fatal(err)
		}
	}
	for link, to := range map[string]string{
		filepath.Join(ws, "leak.html"):                  filepath.Join(secret, "token.html"),
		filepath.Join(ws, "linked-site", "secret.html"): filepath.Join(secret, "token.html"),
		filepath.Join(ws, "linked-site-dir"):            secret,
	} {
		if err := os.Symlink(to, link); err != nil {
			t.Fatal(err)
		}
	}
	c, stop := h.daemon()
	t.Cleanup(stop)
	return h, c, composerWorkspaceID(t, h, "project")
}

func TestViewOfferFreezesOnlyWhatItNames(t *testing.T) {
	h, c, ws := viewFixture(t)
	key := func(n string) string { return "00000000-0000-4000-8000-0000000000" + n }
	// Dry run reports the plan and writes nothing.
	code, dry := offerView(t, c, "", map[string]any{"idempotency_key": key("01"), "workspace_id": ws, "path": "site", "entry": "index.html", "dry_run": true})
	if code != 200 || !dry.DryRun {
		t.Fatalf("dry run: %d %+v", code, dry)
	}
	if _, err := os.Stat(filepath.Join(h.root, ".local", "state", "open-habitat", "views")); !os.IsNotExist(err) {
		t.Fatalf("dry run created the view store: %v", err)
	}
	code, single := offerView(t, c, "", map[string]any{"idempotency_key": key("02"), "workspace_id": ws, "path": "report.html"})
	if code != 200 || single.View.Entry != "report.html" || single.View.Files != 1 || single.Offer.Target != "account" || single.View.ConversationID != "" {
		t.Fatalf("file offer: %d %+v", code, single)
	}
	code, site := offerView(t, c, "", map[string]any{"idempotency_key": key("03"), "workspace_id": ws, "path": "site", "entry": "index.html", "title": "Prototyyppi"})
	if code != 200 || site.View.Files != 3 || site.SkippedHidden != 2 || site.View.Title != "Prototyyppi" {
		t.Fatalf("directory offer: %d %+v", code, site)
	}
	// The same key and offer recover the same view; a different offer with the
	// key is a conflict, never a second export.
	if code, again := offerView(t, c, "", map[string]any{"idempotency_key": key("02"), "workspace_id": ws, "path": "report.html"}); code != 200 || !again.Reused || again.View != single.View {
		t.Fatalf("idempotent replay: %d %+v", code, again)
	}
	if code, v := offerView(t, c, "", map[string]any{"idempotency_key": key("02"), "workspace_id": ws, "path": "site", "entry": "index.html"}); code != 409 || v.Error.Code != "idempotency_conflict" {
		t.Fatalf("conflicting replay: %d %+v", code, v)
	}
	for _, tc := range []struct {
		body map[string]any
		code string
	}{
		{map[string]any{"path": "site"}, "view_entry_required"},
		{map[string]any{"path": "site", "entry": "app.js"}, "view_entry_not_html"},
		{map[string]any{"path": "site", "entry": "missing.html"}, "view_entry_not_found"},
		{map[string]any{"path": "site", "entry": ".env"}, "invalid_arguments"},
		{map[string]any{"path": "notes.txt"}, "view_entry_not_html"},
		{map[string]any{"path": "../secret/token.html"}, "invalid_arguments"},
		{map[string]any{"path": "/etc/passwd"}, "invalid_arguments"},
		{map[string]any{"path": "leak.html"}, "unsafe_view_source"},
		{map[string]any{"path": "linked-site-dir", "entry": "token.html"}, "unsafe_view_source"},
		{map[string]any{"path": "linked-site", "entry": "index.html"}, "view_source_symlink"},
		{map[string]any{"path": "missing.html"}, "view_source_not_found"},
		{map[string]any{"path": "report.html", "unknown": true}, "invalid_arguments"},
	} {
		body := map[string]any{"idempotency_key": key("09"), "workspace_id": ws}
		for k, v := range tc.body {
			body[k] = v
		}
		if code, v := offerView(t, c, "", body); code < 400 || v.Error.Code != tc.code {
			t.Errorf("%v: %d %q, want %s", tc.body, code, v.Error.Code, tc.code)
		}
	}
	list, err := listViews(h.root)
	if err != nil || len(list) != 2 {
		t.Fatalf("refused offers left exports: %v %d", err, len(list))
	}
	if entries, _ := os.ReadDir(filepath.Join(h.root, ".local", "state", "open-habitat", "views")); len(entries) != 2 {
		t.Fatalf("staging left behind: %v", entries)
	}

	// The export is frozen: later edits to the workspace do not reach it.
	if err := os.WriteFile(filepath.Join(h.root, "src", "project", "report.html"), []byte("<h1>v2</h1>"), 0600); err != nil {
		t.Fatal(err)
	}
	export := ViewExportHandler(h.cfg, func(*http.Request) bool { return true })
	if w := readExport(export, ViewExportPath(single.View.ID, "report.html")); w.Code != 200 || w.Body.String() != "<h1>v1</h1>" || w.Header().Get("Content-Type") != "application/octet-stream" {
		t.Fatalf("frozen file: %d %q %v", w.Code, w.Body.String(), w.Header())
	}

	// Removal takes the export away.
	r := httptest.NewRequest("POST", "http://unix"+AgentViewRemovePath, strings.NewReader(`{"view_id":"`+single.View.ID+`"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.agentViews(w, r)
	if w.Code != 200 {
		t.Fatalf("remove: %d %s", w.Code, w.Body.String())
	}
	if w := readExport(export, ViewExportPath(single.View.ID, "report.html")); w.Code != 404 {
		t.Fatalf("removed view still served: %d", w.Code)
	}
}

func TestViewExportReadsOnlyFilesOfThatExport(t *testing.T) {
	h, c, ws := viewFixture(t)
	_, a := offerView(t, c, "", map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000011", "workspace_id": ws, "path": "site", "entry": "index.html"})
	_, b := offerView(t, c, "", map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000012", "workspace_id": ws, "path": "report.html"})
	if a.View.ID == "" || b.View.ID == "" || a.View.ID == b.View.ID {
		t.Fatalf("offers: %+v %+v", a, b)
	}
	export := ViewExportHandler(h.cfg, func(*http.Request) bool { return true })
	if w := readExport(export, ViewExportPrefix+a.View.ID+"/"); w.Code != 200 || !strings.Contains(w.Body.String(), `"entry":"index.html"`) {
		t.Fatalf("summary: %d %s", w.Code, w.Body.String())
	}
	if w := readExport(export, ViewExportPath(a.View.ID, "sub/x.css")); w.Code != 200 || w.Body.String() != "p{}" {
		t.Fatalf("nested file: %d %q", w.Code, w.Body.String())
	}
	// A file planted in the export after the fact as a symlink, or a special
	// file, is not served: the reader opens beneath the export only.
	files := filepath.Join(h.root, ".local", "state", "open-habitat", "views", a.View.ID, "files")
	if err := os.Symlink(filepath.Join(h.root, "secret", "token.html"), filepath.Join(files, "planted.html")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(h.root, "secret"), filepath.Join(files, "planted-dir")); err != nil {
		t.Fatal(err)
	}
	if err := syscall.Mkfifo(filepath.Join(files, "pipe.html"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{
		ViewExportPath(a.View.ID, "planted.html"),
		ViewExportPath(a.View.ID, "planted-dir/token.html"),
		ViewExportPath(a.View.ID, "pipe.html"),
		ViewExportPath(a.View.ID, "report.html"), // another export's file
		ViewExportPrefix + a.View.ID + "/../" + b.View.ID + "/files/report.html",
		ViewExportPrefix + a.View.ID + "/sub/../../manifest.json",
		ViewExportPrefix + a.View.ID + "/.env",
		ViewExportPrefix + a.View.ID + "/sub%2Fx.css",
		ViewExportPrefix + "vzzzzzzzzzzzzzzzzzzzzzzzzzz/index.html",
		ViewExportPrefix + "../../secret/token.html",
	} {
		w := readExport(export, path)
		if w.Code == 200 || strings.Contains(w.Body.String(), "salaisuus") || strings.Contains(w.Body.String(), "v1") {
			t.Errorf("%s: %d %q", path, w.Code, w.Body.String())
		}
	}
	untrusted := ViewExportHandler(h.cfg, func(*http.Request) bool { return false })
	if w := readExport(untrusted, ViewExportPath(a.View.ID, "index.html")); w.Code != 403 {
		t.Fatalf("untrusted peer: %d", w.Code)
	}
	// The browser list carries summaries only, never workspace paths or keys.
	lw := httptest.NewRecorder()
	ViewsHandler(h.cfg, func(*http.Request) bool { return true }).ServeHTTP(lw, httptest.NewRequest("GET", "http://unix"+ViewsPath, nil))
	body, _ := io.ReadAll(lw.Body)
	if lw.Code != 200 || !strings.Contains(string(body), a.View.ID) || strings.Contains(string(body), "idempotency_key") || strings.Contains(string(body), `"path"`) || strings.Contains(string(body), ws) {
		t.Fatalf("browser list: %d %s", lw.Code, body)
	}
}

func TestViewOfferInConversationIsANativeNotice(t *testing.T) {
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	os.MkdirAll(cwd, 0700)
	os.MkdirAll(filepath.Join(home, historyRoot), 0700)
	os.WriteFile(filepath.Join(cwd, "report.html"), []byte("<p>raportti</p>"), 0600)
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
	c := &ConversationController{home: home, cfg: cfg, sessions: map[string]*conversation{id: {id: id, cwd: cwd, workspace: "ws_example123", rpc: peer}}, journal: newEventJournal()}
	ws := ""
	for _, e := range Discover(cfg).Entries {
		if e.Name == "fixture" {
			ws = workspaceIDOf(cfg, e)
		}
	}
	body := map[string]any{"idempotency_key": "22222222-2222-4222-8222-222222222222", "workspace_id": ws, "path": "report.html", "title": "Raportti"}
	// An offer to a conversation that is not this daemon's running one is
	// refused before anything is copied.
	if code, v := offerView(t, c, "id=pi:33333333-3333-4333-8333-333333333333", body); code != 404 || calls.Load() != 0 {
		t.Fatalf("unknown conversation: %d %+v", code, v)
	}
	if list, _ := listViews(home); len(list) != 0 {
		t.Fatal("refused offer left an export")
	}
	code, v := offerView(t, c, "id=pi:"+id, body)
	if code != 200 || v.Offer.Target != "conversation" || v.View.ConversationID != "pi:"+id || calls.Load() != 1 {
		t.Fatalf("conversation offer: %d %+v", code, v)
	}
	notices, err := readNativeNotices(path, os.Geteuid(), id, cwd)
	if err != nil || len(notices) != 1 || notices[0].View == nil || *notices[0].View != v.View || notices[0].Text != "Raportti" {
		t.Fatalf("native notice: %v %+v", err, notices)
	}
	if len(c.journal.frames) == 0 || !strings.Contains(string(c.journal.frames[0]), `"kind":"notice.created"`) || !strings.Contains(string(c.journal.frames[0]), v.View.ID) {
		t.Fatal("offer not published to the conversation")
	}
	// The same key recovers the same offer without a second native write.
	if code, again := offerView(t, c, "id=pi:"+id, body); code != 200 || !again.Reused || again.View != v.View || calls.Load() != 1 {
		t.Fatalf("replay: %d %+v calls=%d", code, again, calls.Load())
	}
}
