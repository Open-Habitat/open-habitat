//go:build linux

package daemon

import (
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestTitleGenerationFencesUserNameAndConcurrentRequests(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("Pi RPC requires nonroot")
	}
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	root := filepath.Join(home, historyRoot)
	for _, dir := range []string{cwd, root} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	id := ownershipTestID
	path := filepath.Join(root, "session.jsonl")
	appendName := func(name string) {
		f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
		if err != nil {
			t.Fatal(err)
		}
		fmt.Fprintf(f, `{"type":"session_info","id":"name%d","name":%q}`+"\n", time.Now().UnixNano(), name)
		f.Close()
	}
	if err := os.WriteFile(path, []byte(fmt.Sprintf(`{"type":"session","version":3,"id":%q,"cwd":%q}`+"\n", id, cwd)), 0600); err != nil {
		t.Fatal(err)
	}
	script := filepath.Join(home, "pi")
	code := `#!/usr/bin/env python3
import json,sys,time
for line in sys.stdin:
 r=json.loads(line)
 if r['type']=='set_session_name':
  with open(sys.argv[1],'a') as f:
   f.write(json.dumps({'type':'session_info','id':'generated'+str(time.time_ns()),'name':r['name']})+'\n')
 print(json.dumps({'type':'response','id':r['id'],'command':r['type'],'success':True}),flush=True)
`
	// The fixture transport launches without arguments; embed the path in a wrapper.
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	// Use an absolute path literal as the script argument.
	wrapper := filepath.Join(home, "wrapper")
	if err := os.WriteFile(wrapper, []byte("#!/bin/sh\nexec /usr/bin/python3 "+script+" "+path+"\n"), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(wrapper, home, cwd, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	entered, release := make(chan struct{}, 1), make(chan struct{})
	c := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, fixture: true,
		titleGenerator: func(string) (string, error) { entered <- struct{}{}; <-release; return "Automatic title", nil }, sessions: map[string]*conversation{}}
	s := &conversation{id: id, cwd: cwd, rpc: p, turnGeneration: 1}
	c.sessions[id] = s
	s.naming = true
	done := make(chan struct{})
	go func() { c.nameConversation(s, "some text", false); close(done) }()
	<-entered
	// A second request is not admitted while generation is in flight.
	if !s.naming {
		t.Fatal("lost naming reservation")
	}
	appendName("Chosen in terminal")
	close(release)
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("name generator stuck")
	}
	if name, _ := c.sessionName(s); name != "Chosen in terminal" {
		t.Fatalf("overwrote chosen name: %q", name)
	}
	// An already named session is never automatically renamed again.
	called := false
	c.titleGenerator = func(string) (string, error) { called = true; return "Unwanted title", nil }
	c.nameConversation(s, "other prompt", false)
	if called {
		t.Fatal("generated over a user name")
	}
	// Explicit regeneration can replace it, through the same native Pi RPC.
	c.titleGenerator = func(string) (string, error) { return "Requested title", nil }
	c.nameConversation(s, "some text", true)
	if name, _ := c.sessionName(s); name != "Requested title" {
		t.Fatalf("explicit name: %q", name)
	}
	// A running conversation can change language on its second message.
	// Explicit regeneration must use that message, not only the first one.
	s.firstText = "Original prompt"
	s.latestText = "Jatketaan suomeksi"
	s.acceptedMessages = 2
	c.titleGenerator = func(text string) (string, error) {
		if text != titleExcerpt("Original prompt", "Jatketaan suomeksi") {
			t.Errorf("manual title missed running Finnish conversation: %q", text)
		}
		return "Continued title", nil
	}
	w := httptest.NewRecorder()
	c.regenerateTitle(w, httptest.NewRequest("POST", "http://unix/regenerate_title", nil), id)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"done"`) {
		t.Fatalf("continued regeneration: %d %s", w.Code, w.Body.String())
	}
	if name, _ := c.sessionName(s); name != "Continued title" {
		t.Fatalf("manual name: %q", name)
	}
	// After continuation there is no accepted-message memory. Read the last
	// user message from the same native session for explicit regeneration.
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Fprintln(f, `{"type":"message","id":"user1","message":{"role":"user","content":"Check connection"}}`)
	fmt.Fprintln(f, `{"type":"message","id":"user2","message":{"role":"user","content":"Tarkista yhteys"}}`)
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	s.latestText = ""
	s.historyPath = path
	s.acceptedMessages = 4
	c.titleGenerator = func(text string) (string, error) {
		if text != titleExcerpt("Original prompt", "Tarkista yhteys") {
			t.Errorf("continued title excerpt: %q", text)
		}
		return "Continued title", nil
	}
	w = httptest.NewRecorder()
	c.regenerateTitle(w, httptest.NewRequest("POST", "http://unix/regenerate_title", nil), id)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"done"`) {
		t.Fatalf("continued regeneration: %d %s", w.Code, w.Body.String())
	}
	// The regression case is an already automatically named conversation.
	// A failed manual request must retain its Pi name and allow retry.
	s.automaticName = "Continued title"
	// A model error does not erase an existing name.
	c.titleGenerator = func(string) (string, error) { return "", fmt.Errorf("synthetic secret: provider unavailable") }
	w = httptest.NewRecorder()
	c.regenerateTitle(w, httptest.NewRequest("POST", "http://unix/regenerate_title", nil), id)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"reason":"model_unavailable"`) || strings.Contains(w.Body.String(), "synthetic secret") {
		t.Fatalf("unsafe or missing fixed reason: %d %s", w.Code, w.Body.String())
	}
	if name, _ := c.sessionName(s); name != "Continued title" {
		t.Fatalf("failure erased name: %q", name)
	}
	c.titleGenerator = func(string) (string, error) { return "Recovered title", nil }
	w = httptest.NewRecorder()
	c.regenerateTitle(w, httptest.NewRequest("POST", "http://unix/regenerate_title", nil), id)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"done"`) {
		t.Fatalf("retry failed: %d %s", w.Code, w.Body.String())
	}
	// The third turn does not refine a name supplied by a person or by
	// explicit regeneration, even if automatic naming failed earlier.
	c.mu.Lock()
	s.acceptedMessages = 3
	s.thirdText = "third message"
	s.settled = true
	c.startAutomaticTitle(s)
	if s.naming || s.automaticRefined {
		t.Fatal("refined a user-chosen name")
	}
	c.mu.Unlock()

	// Reuse the same fake Pi child with a fresh native header. Hold the first
	// automatic model call across third settlement and fourth acceptance.
	if err := os.WriteFile(path, []byte(fmt.Sprintf(`{"type":"session","version":3,"id":%q,"cwd":%q}`+"\n", id, cwd)), 0600); err != nil {
		t.Fatal(err)
	}
	enteredFirst, releaseFirst := make(chan struct{}), make(chan struct{})
	calls := 0
	c.titleGenerator = func(text string) (string, error) {
		calls++
		if calls == 1 {
			close(enteredFirst)
			<-releaseFirst
			return "First automatic title", nil
		}
		if text != titleExcerpt("first message", "third message") {
			t.Errorf("refinement excerpt: %q", text)
		}
		return "Third refined title", nil
	}
	c.mu.Lock()
	s.acceptedMessages = 1
	s.firstText = "first message"
	s.latestText = "first message"
	s.thirdText = ""
	s.automaticFirst, s.automaticRefined, s.refinementDue = false, false, false
	s.automaticName = ""
	s.settled = false
	c.startAutomaticTitle(s)
	if s.automaticFirst {
		t.Fatal("named before first settlement")
	}
	s.settled = true
	c.startAutomaticTitle(s)
	if !s.automaticFirst || !s.naming {
		t.Fatal("first title not scheduled after settlement")
	}
	c.mu.Unlock()
	<-enteredFirst
	c.mu.Lock()
	s.acceptedMessages = 3
	s.thirdText = "third message"
	s.settled = true
	c.startAutomaticTitle(s)
	if !s.refinementDue || s.automaticRefined {
		t.Fatal("third settlement not reserved")
	}
	s.acceptedMessages = 4
	s.settled = false
	c.mu.Unlock()
	close(releaseFirst)
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		refined, naming := s.automaticRefined, s.naming
		c.mu.Unlock()
		if refined && !naming {
			break
		}
		time.Sleep(time.Millisecond)
	}
	c.mu.Lock()
	if !s.automaticRefined || s.naming || calls != 2 {
		t.Fatalf("fourth turn lost refinement: refined=%v naming=%v calls=%d", s.automaticRefined, s.naming, calls)
	}
	c.mu.Unlock()
	if name, _ := c.sessionName(s); name != "Third refined title" {
		t.Fatalf("native refined title: %q", name)
	}
}
