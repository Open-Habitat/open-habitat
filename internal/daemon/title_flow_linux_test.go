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

	"github.com/maintainer/native-agent-host/internal/transport"
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
	// Continued sessions have an excerpt but no new-turn count. The browser
	// action still replaces their native name through the owned Pi child.
	s.firstText = "Original prompt"
	s.acceptedMessages = 4
	c.titleGenerator = func(string) (string, error) { return "Continued title", nil }
	w := httptest.NewRecorder()
	c.regenerateTitle(w, httptest.NewRequest("POST", "http://unix/regenerate_title", nil), id)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"done"`) {
		t.Fatalf("continued regeneration: %d %s", w.Code, w.Body.String())
	}
	if name, _ := c.sessionName(s); name != "Continued title" {
		t.Fatalf("continued name: %q", name)
	}
	// A model error does not erase an existing name.
	c.titleGenerator = func(string) (string, error) { return "", fmt.Errorf("synthetic unavailable") }
	c.nameConversation(s, "some text", true)
	if name, _ := c.sessionName(s); name != "Continued title" {
		t.Fatalf("failure erased name: %q", name)
	}
	c.mu.Lock()
	s.acceptedMessages = 1
	s.firstText = "Original prompt"
	s.settled = false
	c.startAutomaticTitle(s)
	if s.automaticFirst {
		t.Fatal("first title attempted before settlement")
	}
	s.settled = true
	c.startAutomaticTitle(s)
	if !s.automaticFirst {
		t.Fatal("first title not attempted after settlement")
	}
	c.mu.Unlock()
	deadlineFirst := time.Now().Add(time.Second)
	for time.Now().Before(deadlineFirst) {
		c.mu.Lock()
		naming := s.naming
		c.mu.Unlock()
		if !naming {
			break
		}
		time.Sleep(time.Millisecond)
	}
	c.mu.Lock()
	s.acceptedMessages = 3
	s.thirdText = "third message"
	s.settled = false
	c.startAutomaticTitle(s)
	if s.automaticRefined {
		t.Fatal("refined before third turn settled")
	}
	s.settled = true
	c.startAutomaticTitle(s)
	if !s.automaticRefined || !s.naming {
		t.Fatal("third turn did not schedule refinement")
	}
	c.mu.Unlock()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		naming := s.naming
		c.mu.Unlock()
		if !naming {
			break
		}
		time.Sleep(time.Millisecond)
	}
	if name, _ := c.sessionName(s); name != "Continued title" {
		t.Fatalf("refinement overwrote user title: %q", name)
	}
	c.mu.Lock()
	c.startAutomaticTitle(s)
	if s.naming {
		t.Fatal("refinement was scheduled twice")
	}
	c.mu.Unlock()
}
