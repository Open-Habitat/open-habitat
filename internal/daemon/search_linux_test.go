//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/testpython"
	"github.com/open-habitat/open-habitat/internal/transport"
)

func validateSearchReply(t *testing.T, body string) {
	t.Helper()
	python := testpython.Validator(t)
	cmd := exec.Command(python, "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); m['Draft202012Validator'](m['schemas']['search.schema.json'],registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`)
	cmd.Stdin = strings.NewReader(body)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("schema: %s: %v", out, err)
	}
}

type searchReply struct {
	Terms []string `json:"terms"`
	Index struct {
		State          string `json:"state"`
		Indexed, Total int
	} `json:"index"`
	Conversations []struct {
		AgentID  string `json:"agent_id"`
		HitCount int    `json:"hit_count"`
		Hits     []struct {
			EntryKey string `json:"entry_key"`
			Role     string `json:"role"`
			Snippet  string `json:"snippet"`
		} `json:"hits"`
	} `json:"conversations"`
}

func TestSearchRouteIndexesThePersonsConversations(t *testing.T) {
	old := searchFresh
	searchFresh = 0
	t.Cleanup(func() { searchFresh = old })
	home := t.TempDir()
	dir := filepath.Join(home, historyRoot, "--work--")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	id := "33333333-3333-4333-8333-333333333333"
	file := filepath.Join(dir, "2026-11-15_"+id+".jsonl")
	write := func(lines ...string) {
		f, err := os.OpenFile(file, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
		if err != nil {
			t.Fatal(err)
		}
		defer f.Close()
		for _, l := range lines {
			f.WriteString(l + "\n")
		}
	}
	write(`{"type":"session","version":3,"id":"`+id+`","timestamp":"2026-11-15T10:00:00Z","cwd":"/work"}`,
		`{"type":"message","id":"m1","parentId":null,"timestamp":"2026-11-15T10:01:00Z","message":{"role":"user","content":"Voisiko karttatiilet tallentaa välimuistiin?"}}`,
		`{"type":"message","id":"m2","parentId":"m1","timestamp":"2026-11-15T10:02:00Z","message":{"role":"toolResult","toolName":"bash","content":[{"type":"text","text":"kartta tool output"}]}}`)
	cfg := transport.Config{Home: home, UID: os.Getuid()}
	trusted := true
	h := searchHandlerWith(cfg, func(*http.Request) bool { return trusted }, nativeSessions)
	ask := func(raw string) (*httptest.ResponseRecorder, searchReply) {
		r := httptest.NewRequest("GET", "http://unix/api/v1/search?"+raw, nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		var reply searchReply
		if w.Code == 200 {
			json.Unmarshal(w.Body.Bytes(), &reply)
		}
		return w, reply
	}
	q := "q=" + url.QueryEscape("kartan")
	var reply searchReply
	deadline := time.Now().Add(10 * time.Second)
	for {
		w, got := ask(q)
		if w.Code != 200 {
			t.Fatalf("search: %d %s", w.Code, w.Body.String())
		}
		validateSearchReply(t, w.Body.String())
		reply = got
		if got.Index.State == "ready" || time.Now().After(deadline) {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if reply.Index.State != "ready" || reply.Index.Total != 1 || len(reply.Conversations) != 1 || reply.Conversations[0].AgentID != "pi:"+id || reply.Conversations[0].HitCount != 1 || reply.Conversations[0].Hits[0].EntryKey != "m1" || reply.Conversations[0].Hits[0].Role != "user" {
		t.Fatalf("reply = %+v", reply)
	}
	info, err := os.Lstat(filepath.Join(home, ".local/state/open-habitat/search.sqlite"))
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("index file: %v %v", info, err)
	}

	write(`{"type":"message","id":"m3","parentId":"m2","timestamp":"2026-11-15T10:03:00Z","message":{"role":"assistant","content":[{"type":"text","text":"Tallensin kartan."}]}}`)
	if _, got := ask(q); len(got.Conversations) != 1 || got.Conversations[0].HitCount != 2 || got.Conversations[0].Hits[0].EntryKey != "m3" {
		t.Fatalf("appended turn not found: %+v", got)
	}

	for _, raw := range []string{"", "q=a&q=b", "q=x&home=/root", "q=" + strings.Repeat("a", 201), "q=%ff"} {
		if w, _ := ask(raw); w.Code != 400 {
			t.Fatalf("%q: %d", raw, w.Code)
		}
	}
	trusted = false
	if w, _ := ask(q); w.Code != 403 {
		t.Fatalf("untrusted peer: %d", w.Code)
	}
}
