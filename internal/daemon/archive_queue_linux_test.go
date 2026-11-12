//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// archiveQueueFixture is one workspace with settled native histories.
func archiveQueueFixture(t *testing.T, ids []string) (*ConversationController, func(id string, archived bool) (int, string)) {
	t.Helper()
	const wsid = "ws_12345678"
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "project")
	root := filepath.Join(home, ".pi", "agent", "sessions")
	for _, d := range []string{cwd, root} {
		if err := os.MkdirAll(d, 0700); err != nil {
			t.Fatal(err)
		}
	}
	paths := map[string]string{}
	for i, id := range ids {
		path := filepath.Join(root, fmt.Sprintf("history-%d.jsonl", i))
		body := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, cwd) + `{"type":"message","id":"m1","message":{"role":"user","content":"saved"}}` + "\n"
		if err := os.WriteFile(path, []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
		paths[id] = path
	}
	fd, err := unix.Open(cwd, unix.O_PATH|unix.O_DIRECTORY, 0)
	if err != nil {
		t.Fatal(err)
	}
	info, err := stat(fd)
	unix.Close(fd)
	if err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	c := &ConversationController{writerProc: t.TempDir(), home: home, cfg: cfg, sessions: map[string]*conversation{}}
	c.discover = func(transport.Config) Discovery {
		return Discovery{State: "present", Entries: []Workspace{{Name: "project", Kind: "directory", WorkspaceID: wsid, dev: uint64(info.Dev), ino: info.Ino}}}
	}
	archive := func(id string, archived bool) (int, string) {
		previous := "active"
		if !archived {
			previous = "archived"
		}
		body, _ := json.Marshal(map[string]any{"workspace_id": wsid, "archived": archived, "previous_archive": previous, "observation_token": archiveObservation(readNativeHeader(paths[id], cfg.UID))})
		req := httptest.NewRequest("POST", "http://unix/archive", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.archive(w, req, id)
		var reply struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &reply)
		return w.Code, reply.Error.Code
	}
	return c, archive
}

// Archives clicked in quick succession, and an archive that meets a brief
// holder of the workspace writer (a checkout observation, another archive),
// queue in the daemon instead of refusing with workspace_busy.
func TestQuickSuccessiveArchivesQueueInsteadOfRefusing(t *testing.T) {
	ids := []string{
		"12345678-1234-4123-8123-000000000001",
		"12345678-1234-4123-8123-000000000002",
		"12345678-1234-4123-8123-000000000003",
	}
	c, archive := archiveQueueFixture(t, ids)
	if !cloneWriter.TryLock("workspace_checkout_check_running") {
		t.Fatal("workspace writer already held")
	}
	released := make(chan struct{})
	go func() {
		time.Sleep(300 * time.Millisecond)
		cloneWriter.Unlock()
		close(released)
	}()
	type outcome struct {
		status int
		code   string
	}
	results := make([]outcome, len(ids))
	var wg sync.WaitGroup
	for i, id := range ids {
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			status, code := archive(id, true)
			results[i] = outcome{status, code}
		}(i, id)
	}
	wg.Wait()
	<-released
	for i, r := range results {
		if r.status != 200 {
			t.Fatalf("archive %d refused: %d %s", i, r.status, r.code)
		}
	}
	state, err := loadVisibility(c.home)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range ids {
		if archiveFact(state, nil, "pi:"+id) != "archived" {
			t.Fatalf("%s not archived: %v", id, state.Conversations)
		}
	}
	// Restores share the slot and queue the same way.
	for i := range results {
		results[i] = outcome{}
	}
	for i, id := range ids {
		wg.Add(1)
		go func(i int, id string) {
			defer wg.Done()
			status, code := archive(id, false)
			results[i] = outcome{status, code}
		}(i, id)
	}
	wg.Wait()
	for i, r := range results {
		if r.status != 200 {
			t.Fatalf("restore %d refused: %d %s", i, r.status, r.code)
		}
	}
}

// A holder that outlasts the bounded wait is a real operation; the refusal
// names it rather than saying only that something was busy, and nothing is
// written.
func TestArchiveBehindLongOperationNamesIt(t *testing.T) {
	id := "12345678-1234-4123-8123-000000000009"
	c, archive := archiveQueueFixture(t, []string{id})
	if !cloneWriter.TryLock("workspace_clone_running") {
		t.Fatal("workspace writer already held")
	}
	start := time.Now()
	status, code := archive(id, true)
	cloneWriter.Unlock()
	if status != 409 || code != "workspace_clone_running" {
		t.Fatalf("archive behind a clone: %d %s", status, code)
	}
	if waited := time.Since(start); waited < briefWriterWait-100*time.Millisecond || waited > briefWriterWait+2*time.Second {
		t.Fatalf("bounded wait took %v", waited)
	}
	state, err := loadVisibility(c.home)
	if err != nil || archiveFact(state, nil, "pi:"+id) != "active" {
		t.Fatalf("refused archive wrote: %v %v", state.Conversations, err)
	}
}
