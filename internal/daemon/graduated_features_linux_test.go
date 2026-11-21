//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestMissingTaskfleetIsAnEmptyInventory(t *testing.T) {
	cfg, _ := spinoffFixture(t)
	if taskfleetBinary(cfg.Home) != "" {
		t.Skip("a system Taskfleet is installed")
	}
	parent := nativeSession{id: spinoffParent, cwd: "/invented/source", state: "readable"}
	h := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, func(transport.Config) ([]nativeSession, error) { return []nativeSession{parent}, nil })
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+spinoffParent+"/spinoffs", nil))
	var reply struct {
		Availability string       `json:"availability"`
		Runs         []spinoffRow `json:"runs"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &reply) != nil || reply.Availability != "available" || reply.Runs == nil || len(reply.Runs) != 0 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
	bin := filepath.Join(cfg.Home, ".local", "bin", "taskfleet")
	if err := os.MkdirAll(filepath.Dir(bin), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(bin, []byte("#!/bin/sh\nexit 1\n"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, broken := range []string{"non-executable", "broken-symlink"} {
		if broken == "broken-symlink" {
			if err := os.Remove(bin); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink(filepath.Join(cfg.Home, "missing"), bin); err != nil {
				t.Fatal(err)
			}
		}
		w = httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+spinoffParent+"/spinoffs", nil))
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &reply) != nil || reply.Availability != "unavailable" {
			t.Fatalf("%s: %d %s", broken, w.Code, w.Body.String())
		}
	}
}

func TestFileOfferListPagesWithoutDroppingPrivateOutputs(t *testing.T) {
	h := fileOfferFixture(t)
	store := filepath.Join(append([]string{h.root}, fileOffersDirParts...)...)
	for i := 0; i < maxViewList+1; i++ {
		id, err := newFileOfferID()
		if err != nil {
			t.Fatal(err)
		}
		m := fileOfferHead{SchemaVersion: 1, fileOfferSummary: fileOfferSummary{ID: id, Title: "Synthetic output", Files: 1, Bytes: 1, CreatedAt: "2026-01-01T00:00:00Z", ConversationID: "pi:" + spinoffParent}}
		data, _ := json.Marshal(m)
		dir := filepath.Join(store, id)
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "manifest.json"), data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	handler := FileOffersHandler(h.cfg, func(*http.Request) bool { return true })
	read := func(query string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", "http://unix"+FileOffersPath+query, nil))
		return w
	}
	var first, second struct {
		Offers []fileOfferSummary `json:"offers"`
		Next   string             `json:"next_cursor"`
	}
	w := read("")
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &first) != nil || len(first.Offers) != maxViewList || first.Next == "" {
		t.Fatalf("first page: %d %s", w.Code, w.Body.String())
	}
	// Equal timestamps must not duplicate or lose an output at the boundary.
	w = read("?cursor=" + first.Next)
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &second) != nil || len(second.Offers) != 1 || second.Next != "" {
		t.Fatalf("second page: %d %s", w.Code, w.Body.String())
	}
	for _, a := range first.Offers {
		if a.ID == second.Offers[0].ID {
			t.Fatal("duplicate output")
		}
	}
	w = read("?conversation_id=pi:33333333-3333-4333-8333-333333333333&cursor=" + first.Next)
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &second) != nil || len(second.Offers) != 0 {
		t.Fatalf("conversation filter lost: %d %s", w.Code, w.Body.String())
	}
	for _, query := range []string{"?cursor=nope", "?cursor=2026-01-01T00:00:00Z_v" + first.Offers[0].ID[1:], "?cursor=" + first.Next + "&cursor=" + first.Next, "?unknown=x"} {
		if w := read(query); w.Code != 400 {
			t.Fatalf("accepted %s: %d", query, w.Code)
		}
	}
}
