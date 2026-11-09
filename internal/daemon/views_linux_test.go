//go:build linux

package daemon

import (
	"archive/zip"
	"bytes"
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
		AgentID string `json:"agent_id"`
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

// viewConversation gives a controller one running conversation in cwd whose
// fake Pi writes each notice it receives into the native history. It returns
// the controller, the conversation's offer query and the count of notice
// writes.
func viewConversation(t *testing.T, home, cwd string) (*ConversationController, string, *atomic.Int32) {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(home, historyRoot), 0700); err != nil {
		t.Fatal(err)
	}
	id := "11111111-1111-4111-8111-111111111111"
	path := filepath.Join(home, historyRoot, "native.jsonl")
	header := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, cwd)
	if err := os.WriteFile(path, []byte(header+`{"type":"message","id":"m1","parentId":null,"message":{"role":"user","content":"hello"}}`+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	calls := &atomic.Int32{}
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
		data, _ := json.Marshal(map[string]any{"type": "custom", "id": fmt.Sprintf("n%d", calls.Load()), "parentId": "m1", "timestamp": req.Notice.Timestamp, "customType": noticeType, "data": req.Notice})
		fmt.Fprintln(f, string(data))
		json.NewEncoder(conn).Encode(map[string]any{"ok": true, "data": map[string]any{"written": true}})
	})
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	site := func() (siteFacts, error) { return siteFacts{Origin: "https://habitat.example.org", Views: true}, nil }
	c := &ConversationController{home: home, cfg: cfg, site: site, sessions: map[string]*conversation{id: {id: id, cwd: cwd, workspace: "ws_example123", rpc: peer}}, journal: newEventJournal()}
	return c, "id=pi:" + id, calls
}

func workspaceIDNamed(t *testing.T, cfg transport.Config, name string) string {
	t.Helper()
	for _, e := range Discover(cfg).Entries {
		if e.Name == name {
			return workspaceIDOf(cfg, e)
		}
	}
	t.Fatalf("no workspace %s", name)
	return ""
}

type viewFx struct {
	root string
	cfg  transport.Config
	c    *ConversationController
	ws   string
	q    string
}

func viewFixture(t *testing.T) viewFx {
	t.Helper()
	root := t.TempDir()
	ws := filepath.Join(root, "src", "project")
	secret := filepath.Join(root, "secret")
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
	c, q, _ := viewConversation(t, root, ws)
	return viewFx{root: root, cfg: c.cfg, c: c, ws: workspaceIDNamed(t, c.cfg, "project"), q: q}
}

func TestViewOfferFreezesOnlyWhatItNames(t *testing.T) {
	h := viewFixture(t)
	c, ws := h.c, h.ws
	key := func(n string) string { return "00000000-0000-4000-8000-0000000000" + n }
	// Dry run reports the plan and writes nothing.
	code, dry := offerView(t, c, h.q, map[string]any{"idempotency_key": key("01"), "workspace_id": ws, "path": "site", "entry": "index.html", "dry_run": true})
	if code != 200 || !dry.DryRun {
		t.Fatalf("dry run: %d %+v", code, dry)
	}
	if _, err := os.Stat(filepath.Join(h.root, ".local", "state", "open-habitat", "views")); !os.IsNotExist(err) {
		t.Fatalf("dry run created the view store: %v", err)
	}
	// An offer without its conversation has nowhere to appear and is refused
	// before anything is copied.
	for _, query := range []string{"", "current=true"} {
		if code, v := offerView(t, c, query, map[string]any{"idempotency_key": key("02"), "workspace_id": ws, "path": "report.html"}); code != 400 || v.Error.Code != "invalid_arguments" {
			t.Fatalf("offer without conversation %q: %d %+v", query, code, v)
		}
	}
	code, single := offerView(t, c, h.q, map[string]any{"idempotency_key": key("02"), "workspace_id": ws, "path": "report.html"})
	if code != 200 || single.View.Entry != "report.html" || single.View.Files != 1 || single.View.ConversationID != strings.TrimPrefix(h.q, "id=") {
		t.Fatalf("file offer: %d %+v", code, single)
	}
	code, site := offerView(t, c, h.q, map[string]any{"idempotency_key": key("03"), "workspace_id": ws, "path": "site", "entry": "index.html", "title": "Prototyyppi"})
	if code != 200 || site.View.Files != 3 || site.SkippedHidden != 2 || site.View.Title != "Prototyyppi" {
		t.Fatalf("directory offer: %d %+v", code, site)
	}
	// The same key and offer recover the same view; a different offer with the
	// key is a conflict, never a second export.
	if code, again := offerView(t, c, h.q, map[string]any{"idempotency_key": key("02"), "workspace_id": ws, "path": "report.html"}); code != 200 || !again.Reused || again.View != single.View {
		t.Fatalf("idempotent replay: %d %+v", code, again)
	}
	if code, v := offerView(t, c, h.q, map[string]any{"idempotency_key": key("02"), "workspace_id": ws, "path": "site", "entry": "index.html"}); code != 409 || v.Error.Code != "idempotency_conflict" {
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
		{map[string]any{"path": "/var/tmp/../report.html"}, "invalid_arguments"},
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
		if code, v := offerView(t, c, h.q, body); code < 400 || v.Error.Code != tc.code {
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
	h := viewFixture(t)
	c, ws := h.c, h.ws
	_, a := offerView(t, c, h.q, map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000011", "workspace_id": ws, "path": "site", "entry": "index.html"})
	_, b := offerView(t, c, h.q, map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000012", "workspace_id": ws, "path": "report.html"})
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
	// The browser list carries summaries only, never the offer's workspace,
	// request path or key; the source it names is the owner's own fact.
	lw := httptest.NewRecorder()
	ViewsHandler(h.cfg, func(*http.Request) bool { return true }).ServeHTTP(lw, httptest.NewRequest("GET", "http://unix"+ViewsPath, nil))
	body, _ := io.ReadAll(lw.Body)
	if lw.Code != 200 || !strings.Contains(string(body), a.View.ID) || strings.Contains(string(body), "idempotency_key") || strings.Contains(string(body), `"path"`) || strings.Contains(string(body), ws) || !strings.Contains(string(body), `"source":"`+filepath.Join(h.root, "src", "project", "site")+`"`) {
		t.Fatalf("browser list: %d %s", lw.Code, body)
	}
	// The view origin's summary names the entry, never where it came from.
	if w := readExport(export, ViewExportPrefix+a.View.ID+"/"); strings.Contains(w.Body.String(), "source") || strings.Contains(w.Body.String(), h.root) {
		t.Fatalf("export summary names its source: %s", w.Body.String())
	}
}

// The browser reads the views one page at a time, the person's or one
// conversation's, and a re-offer of the same file records the same source.
func TestViewListPagesByConversation(t *testing.T) {
	h := viewFixture(t)
	c, ws := h.c, h.ws
	conversation := strings.TrimPrefix(h.q, "id=")
	_, first := offerView(t, c, h.q, map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000041", "workspace_id": ws, "path": "report.html"})
	_, again := offerView(t, c, h.q, map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000042", "workspace_id": ws, "path": "report.html", "title": "Toinen nimi"})
	_, site := offerView(t, c, h.q, map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000043", "workspace_id": ws, "path": "site", "entry": "index.html"})
	report := filepath.Join(h.root, "src", "project", "report.html")
	if first.View.Source != report || again.View.Source != report || site.View.Source != filepath.Join(h.root, "src", "project", "site") || first.View.ID == again.View.ID {
		t.Fatalf("sources: %q %q %q", first.View.Source, again.View.Source, site.View.Source)
	}
	// Other conversations' views, and enough of them to need pages. They are
	// written as the store holds them; the list reads nothing else.
	store := filepath.Join(append([]string{h.root}, viewsDirParts...)...)
	other := "pi:22222222-2222-4222-8222-222222222222"
	for i := 0; i < 2*maxViewPage+5; i++ {
		id, _ := newViewID()
		m := viewManifest{SchemaVersion: 1, viewSummary: viewSummary{ID: id, Title: "Muu", Entry: "index.html", Files: 1, Bytes: 1, CreatedAt: fmt.Sprintf("2026-01-01T00:00:%02dZ", i%60), ConversationID: other}, IdempotencyKey: fmt.Sprintf("00000000-0000-4000-8000-%012d", i), WorkspaceID: ws, Path: "x.html"}
		b, _ := json.Marshal(m)
		if err := os.MkdirAll(filepath.Join(store, id), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(store, id, "manifest.json"), b, 0600); err != nil {
			t.Fatal(err)
		}
	}
	handler := ViewsHandler(h.cfg, func(*http.Request) bool { return true })
	type page struct {
		Views []viewSummary `json:"views"`
		Next  string        `json:"next_cursor"`
	}
	read := func(query string) (int, page) {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", "http://unix"+ViewsPath+query, nil))
		var p page
		_ = json.Unmarshal(w.Body.Bytes(), &p)
		return w.Code, p
	}
	code, mine := read("?conversation_id=" + conversation)
	if code != 200 || len(mine.Views) != 3 || mine.Next != "" || mine.Views[0].ID != site.View.ID {
		t.Fatalf("conversation's views: %d %+v", code, mine)
	}
	seen := map[string]bool{}
	query := ""
	for pages := 0; ; pages++ {
		code, p := read(query)
		if code != 200 || len(p.Views) > maxViewPage || pages > 3 {
			t.Fatalf("page %d: %d %d", pages, code, len(p.Views))
		}
		for _, v := range p.Views {
			if seen[v.ID] {
				t.Fatalf("view %s on two pages", v.ID)
			}
			seen[v.ID] = true
		}
		if p.Next == "" {
			break
		}
		query = "?cursor=" + p.Next
	}
	if len(seen) != 2*maxViewPage+8 {
		t.Fatalf("pages held %d views", len(seen))
	}
	// A cursor whose view is gone still continues where it was.
	code, p1 := read("?conversation_id=" + other)
	if code != 200 || len(p1.Views) != maxViewPage || p1.Next == "" {
		t.Fatalf("first page: %d %d %q", code, len(p1.Views), p1.Next)
	}
	if err := removeView(h.root, p1.Views[len(p1.Views)-1].ID); err != nil {
		t.Fatal(err)
	}
	code, p2 := read("?conversation_id=" + other + "&cursor=" + p1.Next)
	if code != 200 || len(p2.Views) != maxViewPage {
		t.Fatalf("after a removal: %d %d", code, len(p2.Views))
	}
	for _, v := range p1.Views {
		if v.ID == p2.Views[0].ID {
			t.Fatalf("view %s repeated after a removal", v.ID)
		}
	}
	for _, q := range []string{"?x=1", "?conversation_id=pi:x", "?cursor=nope", "?cursor=2026-01-01T00:00:00Z_vx", "?conversation_id=" + conversation + "&conversation_id=" + conversation, "?cursor=_" + site.View.ID} {
		if code, _ := read(q); code != 400 {
			t.Errorf("%s: %d", q, code)
		}
	}
}

func TestViewOfferInConversationIsANativeNotice(t *testing.T) {
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	os.MkdirAll(cwd, 0700)
	os.WriteFile(filepath.Join(cwd, "report.html"), []byte("<p>raportti</p>"), 0600)
	c, q, calls := viewConversation(t, home, cwd)
	id := strings.TrimPrefix(q, "id=pi:")
	path := filepath.Join(home, historyRoot, "native.jsonl")
	ws := workspaceIDNamed(t, c.cfg, "fixture")
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
	if code != 200 || v.Offer.AgentID != "pi:"+id || v.View.ConversationID != "pi:"+id || calls.Load() != 1 {
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

// A file name may be longer than a title: the derived title is shortened,
// and what the offer publishes is what the list and reader accept.
func TestViewOfferWithLongNameStaysReadable(t *testing.T) {
	h := viewFixture(t)
	c, ws := h.c, h.ws
	name := strings.Repeat("ä", 120) + ".html"
	if err := os.WriteFile(filepath.Join(h.root, "src", "project", name), []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	code, v := offerView(t, c, h.q, map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000021", "workspace_id": ws, "path": name})
	if code != 200 || len(v.View.Title) > maxViewTitle || !strings.HasPrefix(name, v.View.Title) {
		t.Fatalf("offer: %d %+v", code, v)
	}
	list, err := listViews(h.root)
	if err != nil || len(list) != 1 || list[0].ID != v.View.ID {
		t.Fatalf("list: %v %+v", err, list)
	}
}

// A site without a view origin shows no card, so an offer there is refused
// with a code the agent can relay, before anything is copied or published,
// dry runs and replays included. An unreadable site file refuses too.
func TestViewOfferRefusedWithoutViewOrigin(t *testing.T) {
	h := viewFixture(t)
	c, calls := h.c, h.c.journal
	body := map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000031", "workspace_id": h.ws, "path": "report.html"}
	if code, v := offerView(t, c, h.q, body); code != 200 || v.View.ID == "" {
		t.Fatalf("offer with views: %d %+v", code, v)
	}
	frames := len(calls.frames)
	for name, site := range map[string]func() (siteFacts, error){
		"no views":   func() (siteFacts, error) { return siteFacts{Origin: "https://habitat.example.org"}, nil },
		"unreadable": func() (siteFacts, error) { return siteFacts{}, os.ErrNotExist },
	} {
		c.site = site
		for _, b := range []map[string]any{
			body, // replay of a published offer
			{"idempotency_key": "00000000-0000-4000-8000-000000000032", "workspace_id": h.ws, "path": "report.html"},
			{"idempotency_key": "00000000-0000-4000-8000-000000000033", "workspace_id": h.ws, "path": "report.html", "dry_run": true},
		} {
			if code, v := offerView(t, c, h.q, b); code != 409 || v.Error.Code != "views_unavailable" {
				t.Fatalf("%s: offer %v = %d %+v", name, b, code, v)
			}
		}
	}
	if list, _ := listViews(h.root); len(list) != 1 || len(calls.frames) != frames {
		t.Fatalf("refused offers left exports or cards: %d views, %d frames", len(list), len(calls.frames)-frames)
	}
	// Invalid input is still named as such.
	if code, v := offerView(t, c, h.q, map[string]any{"idempotency_key": "x"}); code != 400 || v.Error.Code != "invalid_arguments" {
		t.Fatalf("invalid offer: %d %+v", code, v)
	}
}

func TestViewZipHoldsOnlyThatExport(t *testing.T) {
	h := viewFixture(t)
	c, ws := h.c, h.ws
	_, a := offerView(t, c, h.q, map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000031", "workspace_id": ws, "path": "site", "entry": "index.html"})
	if a.View.ID == "" {
		t.Fatalf("offer: %+v", a)
	}
	views := ViewsHandler(h.cfg, func(*http.Request) bool { return true })
	read := func(method, path string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		views.ServeHTTP(w, httptest.NewRequest(method, "http://unix"+path, nil))
		return w
	}
	w := read("GET", ViewsPath+"/"+a.View.ID+"/zip")
	if w.Code != 200 || w.Header().Get("Content-Type") != "application/octet-stream" || w.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("zip: %d %v", w.Code, w.Header())
	}
	z, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, f := range z.File {
		names = append(names, f.Name)
		if f.Method != zip.Store {
			t.Errorf("%s: method %d", f.Name, f.Method)
		}
	}
	if strings.Join(names, ",") != "app.js,index.html,sub/x.css" {
		t.Fatalf("entries: %v", names)
	}
	if w := read("HEAD", ViewsPath+"/"+a.View.ID+"/zip"); w.Code != 200 || w.Body.Len() != 0 {
		t.Fatalf("head: %d %d", w.Code, w.Body.Len())
	}
	// Another or a missing view, a malformed path or a write is refused.
	for path, code := range map[string]int{
		ViewsPath + "/vzzzzzzzzzzzzzzzzzzzzzzzzzz/zip": 404,
		ViewsPath + "/" + a.View.ID:                    404,
		ViewsPath + "/" + a.View.ID + "/zip/x":         404,
		ViewsPath + "/../" + a.View.ID + "/zip":        404,
		ViewsPath + "/" + a.View.ID + "/zip?x=1":       400,
	} {
		if w := read("GET", path); w.Code != code {
			t.Errorf("%s: %d, want %d", path, w.Code, code)
		}
	}
	if w := read("POST", ViewsPath+"/"+a.View.ID+"/zip"); w.Code != 400 {
		t.Errorf("post: %d", w.Code)
	}
	untrusted := ViewsHandler(h.cfg, func(*http.Request) bool { return false })
	uw := httptest.NewRecorder()
	untrusted.ServeHTTP(uw, httptest.NewRequest("GET", "http://unix"+ViewsPath+"/"+a.View.ID+"/zip", nil))
	if uw.Code != 403 {
		t.Fatalf("untrusted peer: %d", uw.Code)
	}
	// A frozen file truncated after the export fails the zip instead of
	// downloading a shorter one.
	index := filepath.Join(h.root, ".local", "state", "open-habitat", "views", a.View.ID, "files", "index.html")
	original, _ := os.ReadFile(index)
	if err := os.WriteFile(index, nil, 0600); err != nil {
		t.Fatal(err)
	}
	if w := read("GET", ViewsPath+"/"+a.View.ID+"/zip"); w.Code != 503 {
		t.Fatalf("truncated file: %d", w.Code)
	}
	if err := os.WriteFile(index, original, 0600); err != nil {
		t.Fatal(err)
	}
	// A file planted in the export as a symlink makes the store unreadable
	// for a zip rather than following it.
	files := filepath.Join(h.root, ".local", "state", "open-habitat", "views", a.View.ID, "files")
	if err := os.Symlink(filepath.Join(h.root, "secret", "token.html"), filepath.Join(files, "planted.html")); err != nil {
		t.Fatal(err)
	}
	if w := read("GET", ViewsPath+"/"+a.View.ID+"/zip"); w.Code != 503 || strings.Contains(w.Body.String(), "salaisuus") {
		t.Fatalf("planted symlink: %d %q", w.Code, w.Body.String())
	}
}
