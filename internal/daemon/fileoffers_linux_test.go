//go:build linux

package daemon

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

type fileOfferReply struct {
	Reused        bool             `json:"reused"`
	DryRun        bool             `json:"dry_run"`
	Offer         fileOfferSummary `json:"offer"`
	SkippedHidden int              `json:"skipped_hidden"`
	Plan          struct {
		Names []string `json:"names"`
	} `json:"plan"`
	Notice struct {
		AgentID string `json:"agent_id"`
	} `json:"notice"`
	Error struct {
		Code string `json:"code"`
	} `json:"error"`
}

func offerFiles(t *testing.T, c *ConversationController, query string, body map[string]any) (int, fileOfferReply) {
	t.Helper()
	b, _ := json.Marshal(body)
	target := "http://unix" + AgentFileOffersPath
	if query != "" {
		target += "?" + query
	}
	r := httptest.NewRequest("POST", target, strings.NewReader(string(b)))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.agentFileOffers(w, r)
	var v fileOfferReply
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		t.Fatalf("reply %d %q", w.Code, w.Body.String())
	}
	return w.Code, v
}

func fileOfferFixture(t *testing.T) viewFx {
	t.Helper()
	root := t.TempDir()
	ws := filepath.Join(root, "src", "project")
	secret := filepath.Join(root, "secret")
	for _, d := range []string{secret, filepath.Join(ws, "out", "kuvat"), filepath.Join(ws, "out", ".cache"), filepath.Join(ws, "linked"), filepath.Join(ws, "empty")} {
		if err := os.MkdirAll(d, 0700); err != nil {
			t.Fatal(err)
		}
	}
	var z bytes.Buffer
	zw := zip.NewWriter(&z)
	for _, n := range []string{"a/1.gpx", "a/", "b.txt"} {
		f, _ := zw.Create(n)
		if !strings.HasSuffix(n, "/") {
			f.Write([]byte("12345"))
		}
	}
	zw.Close()
	for path, data := range map[string][]byte{
		filepath.Join(secret, "token.txt"):                []byte("salaisuus"),
		filepath.Join(ws, "raportti.pdf"):                 []byte("%PDF-1.7 v1"),
		filepath.Join(ws, "vale.pdf"):                     []byte("not a pdf"),
		filepath.Join(ws, "taulukko.csv"):                 []byte("a,\"b,c\",d\n1,2,3\n4,5,6"),
		filepath.Join(ws, "out", "kaavio.png"):            fixturePNG(30, 20),
		filepath.Join(ws, "out", "reitit.zip"):            z.Bytes(),
		filepath.Join(ws, "out", "kuvat", "nauvo ä.png"):  fixturePNG(4, 3),
		filepath.Join(ws, "out", ".env"):                  []byte("TOKEN=x"),
		filepath.Join(ws, "out", ".cache", "x"):           []byte("x"),
		filepath.Join(ws, "kuvat.png"):                    fixturePNG(2, 2),
		filepath.Join(ws, "linked", "ok.txt"):             []byte("ok"),
		filepath.Join(ws, "out", "kuvat", "muistiot.txt"): []byte("x\n"),
	} {
		if err := os.WriteFile(path, data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	for link, to := range map[string]string{
		filepath.Join(ws, "leak.txt"):          filepath.Join(secret, "token.txt"),
		filepath.Join(ws, "linked", "s.txt"):   filepath.Join(secret, "token.txt"),
		filepath.Join(ws, "linked-secret-dir"): secret,
	} {
		if err := os.Symlink(to, link); err != nil {
			t.Fatal(err)
		}
	}
	c, q, _ := viewConversation(t, root, ws)
	return viewFx{root: root, cfg: c.cfg, c: c, ws: workspaceIDNamed(t, c.cfg, "project"), q: q}
}

func TestFileOfferFreezesOnlyWhatItNames(t *testing.T) {
	h := fileOfferFixture(t)
	c, ws := h.c, h.ws
	key := func(n string) string { return "00000000-0000-4000-8000-0000000000" + n }
	store := filepath.Join(h.root, ".local", "state", "open-habitat", "files")
	// Dry run reports the plan and writes nothing.
	code, dry := offerFiles(t, c, h.q, map[string]any{"idempotency_key": key("01"), "workspace_id": ws, "paths": []string{"out"}, "dry_run": true})
	if code != 200 || !dry.DryRun || strings.Join(dry.Plan.Names, ",") != "kaavio.png,kuvat/muistiot.txt,kuvat/nauvo ä.png,reitit.zip" {
		t.Fatalf("dry run: %d %+v", code, dry)
	}
	if _, err := os.Stat(store); !os.IsNotExist(err) {
		t.Fatalf("dry run created the store: %v", err)
	}
	// There is no offer without a conversation.
	if code, v := offerFiles(t, c, "", map[string]any{"idempotency_key": key("02"), "workspace_id": ws, "paths": []string{"raportti.pdf"}}); code != 400 || v.Error.Code != "invalid_arguments" {
		t.Fatalf("offer without conversation: %d %+v", code, v)
	}
	code, single := offerFiles(t, c, h.q, map[string]any{"idempotency_key": key("02"), "workspace_id": ws, "paths": []string{"raportti.pdf"}})
	if code != 200 || single.Offer.Title != "raportti.pdf" || single.Offer.Files != 1 || single.Offer.Folder != "" || single.Notice.AgentID != strings.TrimPrefix(h.q, "id=") {
		t.Fatalf("file offer: %d %+v", code, single)
	}
	code, folder := offerFiles(t, c, h.q, map[string]any{"idempotency_key": key("03"), "workspace_id": ws, "paths": []string{"out"}})
	if code != 200 || folder.Offer.Files != 4 || folder.SkippedHidden != 2 || folder.Offer.Folder != "out" || folder.Offer.Title != "out" {
		t.Fatalf("directory offer: %d %+v", code, folder)
	}
	code, mixed := offerFiles(t, c, h.q, map[string]any{"idempotency_key": key("04"), "workspace_id": ws, "paths": []string{"taulukko.csv", "out/kuvat"}, "title": "Paketti"})
	if code != 200 || mixed.Offer.Files != 3 || mixed.Offer.Folder != "" {
		t.Fatalf("mixed offer: %d %+v", code, mixed)
	}
	// The same key and offer recover the same offer; another offer with the
	// key is a conflict, never a second copy.
	if code, again := offerFiles(t, c, h.q, map[string]any{"idempotency_key": key("02"), "workspace_id": ws, "paths": []string{"raportti.pdf"}}); code != 200 || !again.Reused || again.Offer != single.Offer {
		t.Fatalf("idempotent replay: %d %+v", code, again)
	}
	if code, v := offerFiles(t, c, h.q, map[string]any{"idempotency_key": key("02"), "workspace_id": ws, "paths": []string{"vale.pdf"}}); code != 409 || v.Error.Code != "idempotency_conflict" {
		t.Fatalf("conflicting replay: %d %+v", code, v)
	}
	for _, tc := range []struct {
		body map[string]any
		code string
	}{
		{map[string]any{"paths": []string{"raportti.pdf", "taulukko.csv"}}, "invalid_arguments"}, // several need a title
		{map[string]any{"paths": []string{}}, "invalid_arguments"},
		{map[string]any{"paths": []string{"../secret/token.txt"}}, "invalid_arguments"},
		{map[string]any{"paths": []string{"/etc/passwd"}}, "invalid_arguments"},
		{map[string]any{"paths": []string{".", "raportti.pdf"}, "title": "x"}, "invalid_arguments"},
		{map[string]any{"paths": []string{"out/kaavio.png", "out/kaavio.png"}, "title": "x"}, "duplicate_file_name"},
		{map[string]any{"paths": []string{"leak.txt"}}, "unsafe_file_source"},
		{map[string]any{"paths": []string{"linked-secret-dir"}}, "unsafe_file_source"},
		{map[string]any{"paths": []string{"linked"}}, "file_source_symlink"},
		{map[string]any{"paths": []string{"empty"}}, "file_offer_empty"},
		{map[string]any{"paths": []string{"out/.env"}}, "unsupported_file_name"},
		{map[string]any{"paths": []string{"missing.pdf"}}, "file_source_not_found"},
		{map[string]any{"paths": []string{"raportti.pdf"}, "unknown": true}, "invalid_arguments"},
	} {
		body := map[string]any{"idempotency_key": key("09"), "workspace_id": ws}
		for k, v := range tc.body {
			body[k] = v
		}
		if code, v := offerFiles(t, c, h.q, body); code < 400 || v.Error.Code != tc.code {
			t.Errorf("%v: %d %q, want %s", tc.body, code, v.Error.Code, tc.code)
		}
	}
	if entries, _ := os.ReadDir(store); len(entries) != 3 {
		t.Fatalf("refused offers or staging left behind: %v", entries)
	}
	// The copy is frozen: later edits to the workspace do not reach it.
	if err := os.WriteFile(filepath.Join(h.root, "src", "project", "raportti.pdf"), []byte("%PDF-1.7 v2"), 0600); err != nil {
		t.Fatal(err)
	}
	read := FileOffersHandler(h.cfg, func(*http.Request) bool { return true })
	if w := readExport(read, FileOffersPath+"/"+single.Offer.ID+"/files/raportti.pdf"); w.Code != 200 || w.Body.String() != "%PDF-1.7 v1" || w.Header().Get("Content-Type") != "application/octet-stream" {
		t.Fatalf("frozen file: %d %q %v", w.Code, w.Body.String(), w.Header())
	}
	// The offer is a native notice in its conversation, carrying the summary.
	id := strings.TrimPrefix(h.q, "id=pi:")
	notices, err := readNativeNotices(filepath.Join(h.root, historyRoot, "native.jsonl"), os.Geteuid(), id, filepath.Join(h.root, "src", "project"))
	if err != nil || len(notices) == 0 || notices[len(notices)-1].Files == nil || notices[len(notices)-1].View != nil {
		t.Fatalf("native notices: %v %+v", err, notices)
	}
	if len(c.journal.frames) == 0 || !strings.Contains(string(c.journal.frames[0]), `"file_offer":{"offer_id":"`+single.Offer.ID) {
		t.Fatal("offer not published to the conversation")
	}
	// Removal takes the copy away; the card's reads are then 404.
	r := httptest.NewRequest("POST", "http://unix"+AgentFileOfferRemovePath, strings.NewReader(`{"offer_id":"`+single.Offer.ID+`"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.agentFileOffers(w, r)
	if w.Code != 200 {
		t.Fatalf("remove: %d %s", w.Code, w.Body.String())
	}
	for _, p := range []string{"", "/files/raportti.pdf", "/zip"} {
		if w := readExport(read, FileOffersPath+"/"+single.Offer.ID+p); w.Code != 404 {
			t.Fatalf("removed offer still served at %q: %d", p, w.Code)
		}
	}
}

func TestFileOfferReadsOnlyFilesOfThatOffer(t *testing.T) {
	h := fileOfferFixture(t)
	c, ws := h.c, h.ws
	_, a := offerFiles(t, c, h.q, map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000011", "workspace_id": ws, "paths": []string{"out"}})
	_, b := offerFiles(t, c, h.q, map[string]any{"idempotency_key": "00000000-0000-4000-8000-000000000012", "workspace_id": ws, "paths": []string{"taulukko.csv", "vale.pdf"}, "title": "Data"})
	if a.Offer.ID == "" || b.Offer.ID == "" || a.Offer.ID == b.Offer.ID {
		t.Fatalf("offers: %+v %+v", a, b)
	}
	read := FileOffersHandler(h.cfg, func(*http.Request) bool { return true })
	// The facts are read from the frozen copies.
	var m struct {
		Offer fileOfferSummary `json:"offer"`
		Items []fileOfferItem  `json:"items"`
	}
	w := readExport(read, FileOffersPath+"/"+b.Offer.ID)
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &m) != nil || strings.Contains(w.Body.String(), "idempotency_key") || strings.Contains(w.Body.String(), ws) {
		t.Fatalf("manifest: %d %s", w.Code, w.Body.String())
	}
	if len(m.Items) != 2 || m.Items[0].Kind != "csv" || m.Items[0].Lines != 3 || m.Items[0].Columns != 3 || m.Items[1].Kind != "file" {
		t.Fatalf("facts: %+v", m.Items)
	}
	w = readExport(read, FileOffersPath+"/"+a.Offer.ID)
	json.Unmarshal(w.Body.Bytes(), &m)
	facts := map[string]fileOfferItem{}
	for _, i := range m.Items {
		facts[i.Path] = i
	}
	if png := facts["kaavio.png"]; png.Kind != "image" || png.Width != 30 || png.Height != 20 {
		t.Fatalf("image facts: %+v", png)
	}
	if z := facts["reitit.zip"]; z.Kind != "zip" || z.Archive == nil || z.Archive.Entries != 2 || z.Archive.Bytes != 10 || len(z.Archive.Names) != 2 {
		t.Fatalf("zip facts: %+v", z)
	}
	// A byte range is served for media seeking.
	r := httptest.NewRequest("GET", "http://unix"+FileOffersPath+"/"+b.Offer.ID+"/files/taulukko.csv", nil)
	r.Header.Set("Range", "bytes=0-1")
	rw := httptest.NewRecorder()
	read.ServeHTTP(rw, r)
	if rw.Code != 206 || rw.Body.String() != "a," || rw.Header().Get("Content-Range") != "bytes 0-1/21" {
		t.Fatalf("range: %d %q %v", rw.Code, rw.Body.String(), rw.Header())
	}
	// A name with a space and a non-ASCII letter arrives percent-encoded.
	if w := readExport(read, FileOffersPath+"/"+a.Offer.ID+"/files/kuvat/nauvo%20%C3%A4.png"); w.Code != 200 || !bytes.HasPrefix(w.Body.Bytes(), []byte("\x89PNG")) {
		t.Fatalf("encoded name: %d", w.Code)
	}
	// The zip holds exactly the offer's files.
	w = readExport(read, FileOffersPath+"/"+a.Offer.ID+"/zip")
	zr, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	if w.Code != 200 || err != nil || len(zr.File) != 4 {
		t.Fatalf("zip: %d %v", w.Code, err)
	}
	for _, f := range zr.File {
		rc, _ := f.Open()
		data, _ := io.ReadAll(rc)
		rc.Close()
		if int64(len(data)) != facts[f.Name].Bytes {
			t.Fatalf("zip entry %s: %d bytes", f.Name, len(data))
		}
	}
	// A file planted in the copy afterwards as a symlink, or a special file,
	// is not served: the reader opens beneath that offer only.
	files := filepath.Join(h.root, ".local", "state", "open-habitat", "files", a.Offer.ID, "files")
	os.Symlink(filepath.Join(h.root, "secret", "token.txt"), filepath.Join(files, "planted.txt"))
	os.Symlink(filepath.Join(h.root, "secret"), filepath.Join(files, "planted-dir"))
	if err := syscall.Mkfifo(filepath.Join(files, "pipe.txt"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{
		"/" + a.Offer.ID + "/files/planted.txt",
		"/" + a.Offer.ID + "/files/planted-dir/token.txt",
		"/" + a.Offer.ID + "/files/pipe.txt",
		"/" + a.Offer.ID + "/files/taulukko.csv", // another offer's file
		"/" + a.Offer.ID + "/files/../" + b.Offer.ID + "/files/taulukko.csv",
		"/" + a.Offer.ID + "/files/kuvat/../../manifest.json",
		"/" + a.Offer.ID + "/manifest.json",
		"/" + a.Offer.ID + "/files/.env",
		"/" + a.Offer.ID + "/files/kuvat%2Fmuistiot.txt",
		"/" + a.Offer.ID + "/",
		"/fzzzzzzzzzzzzzzzzzzzzzzzzzz/files/kaavio.png",
		"/../../secret/token.txt",
	} {
		w := readExport(read, FileOffersPath+path)
		if w.Code == 200 || w.Code == 206 || strings.Contains(w.Body.String(), "salaisuus") {
			t.Errorf("%s: %d %q", path, w.Code, w.Body.String())
		}
	}
	untrusted := FileOffersHandler(h.cfg, func(*http.Request) bool { return false })
	if w := readExport(untrusted, FileOffersPath+"/"+a.Offer.ID+"/files/kaavio.png"); w.Code != 403 {
		t.Fatalf("untrusted peer: %d", w.Code)
	}
	// One conversation's list holds its offers; another's is empty, and any
	// other query is refused.
	if w := readExport(read, FileOffersPath+"?conversation_id=pi:33333333-3333-4333-8333-333333333333"); w.Code != 200 || strings.Contains(w.Body.String(), a.Offer.ID) {
		t.Fatalf("other conversation: %d %s", w.Code, w.Body.String())
	}
	if w := readExport(read, FileOffersPath+"?conversation_id="+strings.TrimPrefix(h.q, "id=")); w.Code != 200 || !strings.Contains(w.Body.String(), a.Offer.ID) || !strings.Contains(w.Body.String(), b.Offer.ID) {
		t.Fatalf("own conversation: %d %s", w.Code, w.Body.String())
	}
	for _, q := range []string{"?x=1", "?conversation_id=../x", "?conversation_id=pi:33333333-3333-4333-8333-333333333333&conversation_id=pi:33333333-3333-4333-8333-333333333333"} {
		if w := readExport(read, FileOffersPath+q); w.Code != 400 {
			t.Fatalf("list query %q: %d", q, w.Code)
		}
	}
	if w := readExport(read, FileOffersPath+"/"+a.Offer.ID+"?conversation_id="+strings.TrimPrefix(h.q, "id=")); w.Code != 400 {
		t.Fatalf("query on an offer: %d", w.Code)
	}
	// The browser list carries summaries only, never workspace paths or keys.
	w = readExport(read, FileOffersPath)
	if w.Code != 200 || !strings.Contains(w.Body.String(), a.Offer.ID) || strings.Contains(w.Body.String(), "idempotency_key") || strings.Contains(w.Body.String(), `"paths"`) || strings.Contains(w.Body.String(), ws) {
		t.Fatalf("browser list: %d %s", w.Code, w.Body.String())
	}
}

// A zip whose central directory is too large to hold in memory is offered
// without a listing rather than read whole.
func TestArchiveListingIsBounded(t *testing.T) {
	dir := t.TempDir()
	write := func(name string, entries int) *os.File {
		var b bytes.Buffer
		zw := zip.NewWriter(&b)
		for i := 0; i < entries; i++ {
			zw.CreateHeader(&zip.FileHeader{Name: strings.Repeat("x", 200) + string(rune('a'+i%26)) + strings.Repeat("y", i/26), Method: zip.Store})
		}
		zw.Close()
		os.WriteFile(filepath.Join(dir, name), b.Bytes(), 0600)
		f, _ := os.Open(filepath.Join(dir, name))
		t.Cleanup(func() { f.Close() })
		return f
	}
	small := write("small.zip", 3)
	st, _ := small.Stat()
	if a := readArchive(small, st.Size()); a == nil || a.Entries != 3 {
		t.Fatalf("small archive: %+v", a)
	}
	large := write("large.zip", 4500) // a directory of about 1.1 MiB
	st, _ = large.Stat()
	if a := readArchive(large, st.Size()); a != nil {
		t.Fatalf("large directory was read: %d entries", a.Entries)
	}
}

func TestFileKindNeedsAgreeingBytes(t *testing.T) {
	for _, tc := range []struct {
		name, head, kind string
	}{
		{"a.pdf", "%PDF-1.4", "pdf"},
		{"a.pdf", "<html>", "file"},
		{"a.docx", "PK\x03\x04", "docx"},
		{"a.xlsx", "not zip", "file"},
		{"A.PNG", "", "image"},
		{"a.svg", "", "svg"},
		{"a.py", "", "code"},
		{"a.parquet", "PAR1", "file"},
		{"noext", "", "file"},
	} {
		if got := fileKind(tc.name, []byte(tc.head)); got != tc.kind {
			t.Errorf("%s: %s, want %s", tc.name, got, tc.kind)
		}
	}
}
