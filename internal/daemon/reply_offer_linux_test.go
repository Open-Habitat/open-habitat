//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/replyblock"
	"github.com/open-habitat/open-habitat/internal/transport"
)

const (
	replyViewID   = "vk3qzm7d2xw4a6b5c7e2f3g4h5j"
	replyPDFID    = "fq7r2s3t4u5v6w7x2y3z4a5b6c7"
	replyPackID   = "fm2n3o4p5q6r7s2t3u4v5w6x7y2"
	replyGoneID   = "fz2z3z4z5z6z7z2z3z4z5z6z7z2"
	replyOtherID  = "fa2a3a4a5a6a7a2a3a4a5a6a7a2"
	replyConvID   = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	replyNoticeTS = "2026-11-26T07:20:10Z"
)

func writeReplyManifest(t *testing.T, home string, parts []string, id string, m any) {
	t.Helper()
	dir := filepath.Join(append(append([]string{home}, parts...), id)...)
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	for p := dir; p != home; p = filepath.Dir(p) {
		_ = os.Chmod(p, 0700)
	}
	raw, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "manifest.json"), raw, 0600); err != nil {
		t.Fatal(err)
	}
}

func noticeLine(t *testing.T, id, parent string, n agentNotice) string {
	t.Helper()
	p := any(nil)
	if parent != "" {
		p = parent
	}
	raw, err := json.Marshal(map[string]any{"type": "custom", "id": id, "parentId": p, "timestamp": replyNoticeTS, "customType": noticeType, "data": n})
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

// offerReplySetup writes a conversation whose current branch holds a view,
// one file, a three-file offer, an agent message and an offer since removed,
// with one more offer on a branch Palaa tähän set aside; and the person's
// offer store with every offer but the removed one.
func offerReplySetup(t *testing.T) (*ConversationController, string) {
	t.Helper()
	home := t.TempDir()
	conv := "pi:" + replyConvID
	view := viewSummary{ID: replyViewID, Title: "Ajat keskustelussa – kierros 3", Entry: "index.html", Files: 12, Bytes: 7864320, CreatedAt: replyNoticeTS, ConversationID: conv, Source: filepath.Join(home, "dist", "ajat-3")}
	pdf := fileOfferSummary{ID: replyPDFID, Title: "vuosikertomus-2026.pdf", Files: 1, Bytes: 2516582, CreatedAt: replyNoticeTS, ConversationID: conv}
	pack := fileOfferSummary{ID: replyPackID, Title: "Vuosikertomuksen liitteet", Folder: "liitteet", Files: 3, Bytes: 1160110, CreatedAt: replyNoticeTS, ConversationID: conv}
	gone := fileOfferSummary{ID: replyGoneID, Title: "vanha.pdf", Files: 1, Bytes: 10, CreatedAt: replyNoticeTS, ConversationID: conv}
	other := fileOfferSummary{ID: replyOtherID, Title: "sivuhaara.pdf", Files: 1, Bytes: 10, CreatedAt: replyNoticeTS, ConversationID: conv}
	notice := func(n int) agentNotice {
		return agentNotice{ID: fmt.Sprintf("22222222-2222-4222-8222-%012d", n), Origin: "agent", Timestamp: replyNoticeTS, Text: "Tarjous", Persistence: "unknown"}
	}
	nv, nf, np, nx, ns := notice(1), notice(2), notice(3), notice(4), notice(5)
	nv.View, nf.Files, np.Files, nx.Files, ns.Files = &view, &pdf, &pack, &gone, &other
	dir := filepath.Join(home, historyRoot, "--work--")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	lines := []string{
		fmt.Sprintf(`{"type":"session","version":3,"id":%q,"cwd":%q}`, replyConvID, home),
		`{"type":"message","id":"u1","parentId":null,"message":{"role":"user","content":"Tee raportti."}}`,
		noticeLine(t, "nv", "u1", nv),
		noticeLine(t, "nf", "nv", nf),
		noticeLine(t, "np", "nf", np),
		`{"type":"message","id":"a1","parentId":"np","message":{"role":"assistant","content":"Valmista. Kolme tarjousta."}}`,
		noticeLine(t, "nx", "a1", nx),
		noticeLine(t, "ns", "u1", ns),
		`{"type":"custom","id":"rc","parentId":"nx","customType":"oh-recap","data":{}}`,
		`{"type":"message","id":"u2","parentId":"rc","message":{"role":"user","content":"Kiitos."}}`,
	}
	if err := os.WriteFile(filepath.Join(dir, "session.jsonl"), []byte(strings.Join(lines, "\n")+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	writeReplyManifest(t, home, viewsDirParts, replyViewID, viewManifest{SchemaVersion: 1, viewSummary: view, IdempotencyKey: "k1", WorkspaceID: "ws_report", Path: "dist/ajat-3"})
	writeReplyManifest(t, home, fileOffersDirParts, replyPDFID, fileOfferManifest{SchemaVersion: 1, fileOfferSummary: pdf, IdempotencyKey: "k2", WorkspaceID: "ws_report", Paths: []string{"out/vuosikertomus-2026.pdf"}, Items: []fileOfferItem{{Path: "vuosikertomus-2026.pdf", Bytes: 2516582, Kind: "pdf"}}})
	writeReplyManifest(t, home, fileOffersDirParts, replyPackID, fileOfferManifest{SchemaVersion: 1, fileOfferSummary: pack, IdempotencyKey: "k3", WorkspaceID: "ws_report", Paths: []string{"liitteet"}, Items: []fileOfferItem{
		{Path: "tase-2026.xlsx", Bytes: 1132462, Kind: "xlsx"},
		{Path: "henkilosto.csv", Bytes: 18432, Kind: "csv", Lines: 143, Columns: 6},
		{Path: "muistiot/tilintarkastus.md", Bytes: 9216, Kind: "markdown", Lines: 120},
	}})
	writeReplyManifest(t, home, fileOffersDirParts, replyOtherID, fileOfferManifest{SchemaVersion: 1, fileOfferSummary: other, IdempotencyKey: "k4", WorkspaceID: "ws_report", Paths: []string{"sivuhaara.pdf"}, Items: []fileOfferItem{{Path: "sivuhaara.pdf", Bytes: 10, Kind: "pdf"}}})
	c := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	return c, home
}

func TestReplyToOfferResolvesFromTheConversation(t *testing.T) {
	c, _ := offerReplySetup(t)
	for name, tc := range map[string]struct {
		key, path, want string
	}{
		"view":              {"nv", "", "View you offered: \"Ajat keskustelussa – kierros 3\" (view_id " + replyViewID + ")\nSource: dist/ajat-3 · opens index.html · 12 files · 7.5 MB"},
		"one file":          {"nf", "", "File you offered: \"vuosikertomus-2026.pdf\" (offer_id " + replyPDFID + ")\nSource: out/vuosikertomus-2026.pdf · PDF · 2.4 MB"},
		"one file, by path": {"nf", "vuosikertomus-2026.pdf", "File you offered: \"vuosikertomus-2026.pdf\" (offer_id " + replyPDFID + ")\nSource: out/vuosikertomus-2026.pdf · PDF · 2.4 MB"},
		"files":             {"np", "", "Files you offered: \"Vuosikertomuksen liitteet\" (offer_id " + replyPackID + ")\nSource: liitteet · 3 files · 1.1 MB"},
		"file of files":     {"np", "henkilosto.csv", "File \"henkilosto.csv\" in the files you offered as \"Vuosikertomuksen liitteet\" (offer_id " + replyPackID + ")\nSource: liitteet/henkilosto.csv · CSV table · 18 KB"},
		"nested file":       {"np", "muistiot/tilintarkastus.md", "File \"muistiot/tilintarkastus.md\" in the files you offered as \"Vuosikertomuksen liitteet\" (offer_id " + replyPackID + ")\nSource: liitteet/muistiot/tilintarkastus.md · Markdown · 9 KB"},
		"agent message":     {"a1", "", "Valmista. …"},
	} {
		got, ok := c.replyBody(replyConvID, tc.key, tc.path)
		if !ok || got != tc.want {
			t.Errorf("%s: %q %v\nwant %q", name, got, ok, tc.want)
		}
	}
	for name, tc := range map[string]struct{ key, path string }{
		"an offer on a set-aside branch": {"ns", ""},
		"a removed offer":                {"nx", ""},
		"a path on a view":               {"nv", "index.html"},
		"a path not in the offer":        {"np", "salaiset.txt"},
		"another file's path":            {"nf", "muu.pdf"},
		"a path on a message":            {"a1", "x"},
		"a path that climbs":             {"np", "../henkilosto.csv"},
		"another custom entry":           {"rc", ""},
		"a person's message":             {"u1", ""},
		"an unknown entry":               {"zz", ""},
	} {
		if got, ok := c.replyBody(replyConvID, tc.key, tc.path); ok {
			t.Errorf("%s: resolved to %q", name, got)
		}
	}
}

func TestReplyToOfferAdmission(t *testing.T) {
	c, home := offerReplySetup(t)
	if err := os.MkdirAll(filepath.Join(home, ".config", "open-habitat"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, ".config", "open-habitat", "preferences.json"), []byte(`{"engine":"codemirror6","experimental":{"reply-to-message":true}}`), 0600); err != nil {
		t.Fatal(err)
	}
	c.sessions[replyConvID] = &conversation{id: replyConvID, cwd: home, rpc: stoppedRPC(), state: "stopped", dead: true, commands: map[string]bool{}}
	n := 0
	send := func(body string) (int, string) {
		n++
		body = strings.Replace(body, "CMD", fmt.Sprintf("bbbbbbbb-bbbb-4bbb-8bbb-%012d", n), 1)
		req := httptest.NewRequest("POST", "http://unix/api/v1/conversations/"+replyConvID+"/follow_up", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.admitMessage(w, req, replyConvID, "follow_up", false, nil)
		return w.Code, w.Body.String()
	}
	for name, body := range map[string]string{
		"a path that climbs": `{"message":"x","command_id":"CMD","reply_to":{"entry_key":"np","path":"../x"}}`,
		"an absolute path":   `{"message":"x","command_id":"CMD","reply_to":{"entry_key":"np","path":"/etc/passwd"}}`,
		"an empty key":       `{"message":"x","command_id":"CMD","reply_to":{"entry_key":"","path":"a"}}`,
	} {
		if code, out := send(body); code != 400 || !strings.Contains(out, "invalid_request") {
			t.Errorf("%s: %d %s", name, code, out)
		}
	}
	for name, body := range map[string]string{
		"an offer outside this branch": `{"message":"x","command_id":"CMD","reply_to":{"entry_key":"ns"}}`,
		"a file the offer lacks":       `{"message":"x","command_id":"CMD","reply_to":{"entry_key":"np","path":"salaiset.txt"}}`,
		"a removed offer":              `{"message":"x","command_id":"CMD","reply_to":{"entry_key":"nx"}}`,
	} {
		if code, out := send(body); code != 409 || !strings.Contains(out, "reply_target_gone") {
			t.Errorf("%s: %d %s", name, code, out)
		}
	}
}

func TestReplyToOfferProjection(t *testing.T) {
	body, ok := replyblock.OfferBody(replyblock.Offer{Kind: replyblock.OfferFiles, ID: replyPackID, Title: "Vuosikertomuksen liitteet", Path: "henkilosto.csv"}, "Source: liitteet/henkilosto.csv · CSV table · 18 KB")
	if !ok {
		t.Fatal("body")
	}
	native := replyblock.Build("np", body, "Sarake puuttuu.")
	raw := `{"type":"message","id":"u3","parentId":"u2","message":{"role":"user","content":` + mustJSON(native) + `}}`
	var e nativeEntry
	if err := json.Unmarshal([]byte(raw), &e); err != nil {
		t.Fatal(err)
	}
	e.Raw = json.RawMessage(raw)
	out := nativeBlocks(e)
	inline(nil, &out)
	if out.ReplyTo == nil || out.ReplyTo.EntryKey != "np" || out.ReplyTo.Excerpt != body || out.ReplyTo.Offer == nil || *out.ReplyTo.Offer != (replyOffer{Kind: "files", Title: "Vuosikertomuksen liitteet", Path: "henkilosto.csv"}) {
		t.Fatalf("reply_to %+v offer %+v", out.ReplyTo, out.ReplyTo.Offer)
	}
	if out.Content.Text != "Sarake puuttuu." {
		t.Fatalf("content %q", out.Content.Text)
	}
	// A reply to a message carries no offer.
	if ref, ok := projectUserReply(json.RawMessage(`{"role":"user","content":` + mustJSON(replyblock.Build("a1", "Valmista. …", "x")) + `}`)); !ok || ref.Offer != nil {
		t.Fatalf("message reply %+v", ref)
	}
}

func TestHostSize(t *testing.T) {
	for b, want := range map[int64]string{0: "0 bytes", 1023: "1023 bytes", 1024: "1 KB", 9216: "9 KB", 18432: "18 KB", 1132462: "1.1 MB", 2516582: "2.4 MB", 7864320: "7.5 MB", 10485759: "10 MB", 536870912: "512 MB"} {
		if got := hostSize(b); got != want {
			t.Errorf("hostSize(%d) = %q, want %q", b, got, want)
		}
	}
}

func TestItemSourceDoesNotGuess(t *testing.T) {
	m := fileOfferManifest{Paths: []string{"client/dist", "server/dist", "README.md"}}
	m.Files = 3
	for item, want := range map[string]string{"dist/server.js": "", "dist/client.js": "", "README.md": "README.md"} {
		if got := itemSource(m, fileOfferItem{Path: item}); got != want {
			t.Errorf("itemSource(%q) = %q, want %q", item, got, want)
		}
	}
	one := fileOfferManifest{Paths: []string{"client/dist", "README.md"}}
	one.Files = 2
	if got := itemSource(one, fileOfferItem{Path: "dist/a/b.js"}); got != "client/dist/a/b.js" {
		t.Errorf("one folder: %q", got)
	}
}
