//go:build linux

package daemon

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
)

func TestExternalPiAppendReachesTwoStreamsAndNativeHistory(t *testing.T) {
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	root := filepath.Join(home, historyRoot)
	for _, path := range []string{cwd, root} {
		if err := os.MkdirAll(path, 0700); err != nil {
			t.Fatal(err)
		}
	}
	const id = "11111111-1111-4111-8111-111111111111"
	file := filepath.Join(root, "session.jsonl")
	if err := os.WriteFile(file, []byte(fmt.Sprintf(`{"type":"session","version":3,"id":%q,"cwd":%q}`+"\n", id, cwd)), 0600); err != nil {
		t.Fatal(err)
	}
	journal := newEventJournal()
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ready := make(chan bool, 1)
	go watchNativeHistory(ctx, cfg, journal, ready)
	if !<-ready {
		t.Fatal("watcher could not start")
	}
	cursor, _ := journal.watermark()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { journal.stream(w, r, func() bool { return true }) }))
	defer server.Close()
	clients := make([]*http.Response, 2)
	for i := range clients {
		req, err := http.NewRequest("GET", server.URL+"/api/v1/events?after="+cursor, nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Host = "unix"
		clients[i], err = server.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer clients[i].Body.Close()
		if clients[i].StatusCode != 200 {
			t.Fatalf("client %d: %d", i, clients[i].StatusCode)
		}
	}
	f, err := os.OpenFile(file, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = f.WriteString(`{"type":"message","id":"terminal_one","message":{"role":"user","content":"outside"}}` + "\n"); err != nil {
		t.Fatal(err)
	}
	if err = f.Close(); err != nil {
		t.Fatal(err)
	}
	for i, response := range clients {
		seen := make(chan string, 1)
		go func() {
			scanner := bufio.NewScanner(response.Body)
			for scanner.Scan() {
				if strings.HasPrefix(scanner.Text(), "data: ") {
					seen <- scanner.Text()
					return
				}
			}
		}()
		select {
		case frame := <-seen:
			if !strings.Contains(frame, `"kind":"snapshot.invalidated"`) {
				t.Fatalf("client %d: %s", i, frame)
			}
		case <-time.After(3 * time.Second):
			t.Fatalf("client %d missed external append", i)
		}
	}
	sessions, err := nativeSessions(cfg)
	if err != nil || len(sessions) != 1 {
		t.Fatalf("discovery: %v %v", sessions, err)
	}
	native := readNativeSettled(sessions[0].path, cfg.UID)
	if native.state != "readable" || len(native.entries) != 1 || native.entries[0].Key != "terminal_one" {
		t.Fatalf("history after invalidation: %+v", native)
	}
	// A controller publication can race with the watcher. Only the controller
	// emits the keyed entry; the browser joins it by native key after reloading.
	journal.nativeEntry("pi:"+id, native.entries[0])
	journal.mu.Lock()
	entries := 0
	for _, frame := range journal.frames {
		if strings.Contains(string(frame), `"kind":"history.entry"`) {
			entries++
		}
	}
	journal.mu.Unlock()
	if entries != 1 {
		t.Fatalf("duplicate keyed entries: %d", entries)
	}
}

func TestHistoryWatcherFailureDoesNotBreakNativeReads(t *testing.T) {
	home := t.TempDir()
	if err := os.Symlink(t.TempDir(), filepath.Join(home, ".pi")); err != nil {
		t.Fatal(err)
	}
	journal := newEventJournal()
	ready := make(chan bool, 1)
	watchNativeHistory(context.Background(), transport.Config{Home: home, UID: os.Geteuid()}, journal, ready)
	if <-ready {
		t.Fatal("followed history symlink")
	}
	if _, err := nativeSessions(transport.Config{Home: home, UID: os.Geteuid()}); err == nil {
		t.Fatal("unsafe history readable")
	}
	if cursor, _ := journal.watermark(); strings.HasSuffix(cursor, ":0") {
		t.Fatal("missing failure invalidation")
	}
}
