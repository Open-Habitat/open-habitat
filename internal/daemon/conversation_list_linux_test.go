//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestConversationListTitles(t *testing.T) {
	home := t.TempDir()
	root := filepath.Join(home, historyRoot)
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	id := "11111111-1111-4111-8111-111111111111"
	path := filepath.Join(root, "native.jsonl")
	c := &ConversationController{home: home, cfg: transport.Config{UID: os.Geteuid()}, sessions: map[string]*conversation{id: {id: id, workspace: "ws_example123", state: "idle", givenName: "Pending name"}}}
	facts := &snapshotFacts{sessions: &sessionFileFacts{files: map[string]*sessionFile{}}}
	checkOnce := func(want string) {
		t.Helper()
		w := httptest.NewRecorder()
		c.list(w)
		var out struct {
			SchemaVersion int `json:"schema_version"`
			Sessions      []struct {
				AgentID string  `json:"agent_id"`
				Title   *string `json:"title"`
			} `json:"sessions"`
		}
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &out) != nil || out.SchemaVersion != 1 || len(out.Sessions) != 1 {
			t.Fatalf("list: %d %s", w.Code, w.Body.String())
		}
		if out.Sessions[0].AgentID != "pi:"+id || out.Sessions[0].Title == nil || *out.Sessions[0].Title != want {
			t.Fatalf("title want %q: %s", want, w.Body.String())
		}
	}
	check := func(want string) {
		t.Helper()
		for _, cache := range []*snapshotFacts{nil, facts} {
			c.facts = cache
			checkOnce(want)
		}
	}
	check("Pending name")
	c.sessions[id].givenName = ""
	check("Uusi keskustelu")
	content := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home)
	content += `{"type":"message","id":"m1","message":{"role":"user","content":"First question"}}` + "\n"
	write := func() {
		t.Helper()
		if err := os.WriteFile(path, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}
	write()
	check("First question")
	content += `{"type":"session_info","name":"Automatic title"}` + "\n"
	write()
	check("Automatic title")
	content += `{"type":"session_info","name":"Manual name"}` + "\n"
	write()
	check("Manual name")
	// Read native state again, not the last automatic or given-name handle cache.
	c.sessions[id].givenName = "Stale name"
	content += `{"type":"session_info","name":"Renamed in Pi"}` + "\n"
	write()
	check("Renamed in Pi")
	// Ambiguous histories must not displace the controller-only rail name.
	if err := os.WriteFile(filepath.Join(root, "duplicate.jsonl"), []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	check("Stale name")
	// A failed inventory must not break lost-create recovery of known handles.
	if err := os.Rename(root, root+"-saved"); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(root+"-saved", root); err != nil {
		t.Fatal(err)
	}
	check("Stale name")
}
