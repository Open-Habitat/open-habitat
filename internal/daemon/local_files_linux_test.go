//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestLocalFilesNativeRelayClaimsAndIsolation(t *testing.T) {
	c := &ConversationController{home: t.TempDir(), cfg: transport.Config{}, trusted: func(*http.Request) bool { return true }, journal: newEventJournal(), localFiles: &localFiles{pending: map[string]*localFileRequest{}}}
	other := &ConversationController{trusted: c.trusted, localFiles: &localFiles{pending: map[string]*localFileRequest{}}}
	p := &piRPC{processDir: t.TempDir(), done: make(chan struct{})}
	c.attachLocalFiles(p)
	defer close(p.done)
	client := &http.Client{Transport: &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", filepath.Join(p.processDir, "local-files.sock"))
	}}, Timeout: 3 * time.Second}
	defer client.CloseIdleConnections()
	completed := make(chan []byte, 1)
	go func() {
		r, e := client.Post("http://unix/", "application/json", bytes.NewBufferString(`{"action":"list"}`))
		if e != nil {
			completed <- []byte(e.Error())
			return
		}
		defer r.Body.Close()
		b, _ := io.ReadAll(r.Body)
		completed <- b
	}()
	// Observe the real journal, rather than constructing an unrelated request.
	var id string
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		c.localFiles.mu.Lock()
		for k := range c.localFiles.pending {
			id = k
		}
		c.localFiles.mu.Unlock()
		c.journal.mu.Lock()
		published := len(c.journal.frames) > 0
		c.journal.mu.Unlock()
		if id != "" && published {
			break
		}
		time.Sleep(time.Millisecond)
	}
	if id == "" {
		t.Fatal("native request not published")
	}
	c.journal.mu.Lock()
	frames := len(c.journal.frames)
	c.journal.mu.Unlock()
	if frames != 1 {
		t.Fatal("missing stream event", frames)
	}
	post := func(controller *ConversationController, body string) int {
		r := httptest.NewRequest("POST", "http://unix"+LocalFilesPath, bytes.NewBufferString(body))
		w := httptest.NewRecorder()
		controller.LocalFilesHandler().ServeHTTP(w, r)
		return w.Code
	}
	claim := "11111111-1111-4111-8111-111111111111"
	claimBody := `{"id":"` + id + `","claim":"` + claim + `"}`
	if code := post(other, claimBody); code != 409 {
		t.Fatal("other daemon accepted claim", code)
	}
	if code := post(c, claimBody); code != 200 {
		t.Fatal("claim failed", code)
	}
	if code := post(c, claimBody); code != 409 {
		t.Fatal("duplicate claim", code)
	}
	wrong := `{"id":"` + id + `","claim":"22222222-2222-4222-8222-222222222222","complete":true,"names":["notes.txt"]}`
	if code := post(c, wrong); code != 409 {
		t.Fatal("foreign claim completed", code)
	}
	traversal := `{"id":"` + id + `","claim":"` + claim + `","complete":true,"names":["../secret"]}`
	if code := post(c, traversal); code != 400 {
		t.Fatal("traversal accepted", code)
	}
	done := `{"id":"` + id + `","claim":"` + claim + `","complete":true,"names":["notes.txt"]}`
	if code := post(c, done); code != 200 {
		t.Fatal("complete failed", code)
	}
	var answer localFileAnswer
	if err := json.Unmarshal(<-completed, &answer); err != nil || len(answer.Names) != 1 || answer.Names[0] != "notes.txt" {
		t.Fatal(answer, err)
	}
	if code := post(c, done); code != 409 {
		t.Fatal("replayed completion", code)
	}
}

func TestLocalFilesExpiredAndDenied(t *testing.T) {
	id := "11111111-1111-4111-8111-111111111111"
	c := &ConversationController{trusted: func(*http.Request) bool { return true }, localFiles: &localFiles{pending: map[string]*localFileRequest{id: {ID: id, Expires: time.Now().Add(-time.Second).UnixMilli()}}}}
	request := func() *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("POST", "http://unix"+LocalFilesPath, bytes.NewBufferString(`{"id":"`+id+`","claim":"`+id+`"}`))
		c.LocalFilesHandler().ServeHTTP(w, r)
		return w
	}
	if w := request(); w.Code != 409 {
		t.Fatal(w.Code)
	}
	c.trusted = func(*http.Request) bool { return false }
	if w := request(); w.Code != 403 {
		t.Fatal(w.Code)
	}
	for _, name := range []string{"..", "../secret", "sub/file", "a\\b", "a\x00b"} {
		if validLocalName(name) {
			t.Fatal(name)
		}
	}
}

func TestLocalFilesReleaseTool(t *testing.T) {
	command := exec.Command("node", "--test", "pi-device-test/local-files.test.mjs")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("release tool: %v\n%s", err, output)
	}
}
