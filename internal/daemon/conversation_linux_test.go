//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/core"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

func TestConversationSendSurvivesDisconnect(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	// The first frame is a correlated native acknowledgement. The later event
	// is emitted after the HTTP request has been canceled.
	code := `#!/usr/bin/env python3
import json,sys,time
for line in sys.stdin:
 r=json.loads(line)
 open(sys.argv[0]+".log","a").write(r["type"]+"\n")
 print(json.dumps(dict(type="response",id=r["id"],command=r["type"],success=True)),flush=True)
 time.sleep(.05)
 print(json.dumps(dict(type="agent_settled")),flush=True)
`
	prompts := func() int {
		data, _ := os.ReadFile(script + ".log")
		return strings.Count(string(data), "prompt\n")
	}
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	id := ownershipTestID
	s := &conversation{id: id, rpc: p, state: "idle", commands: map[string]bool{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}}
	go c.drain(s)
	ctx, cancel := context.WithCancel(context.Background())
	body := fmt.Sprintf(`{"message":"hello","command_id":%q}`, id)
	req := httptest.NewRequest("POST", "http://unix/send", strings.NewReader(body)).WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.send(w, req, id)
	cancel()
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"pending"`) {
		t.Fatalf("send: %d %s", w.Code, w.Body.String())
	}
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		state := s.state
		cursor := s.cursor
		c.mu.Unlock()
		if state == "idle" && cursor > 0 {
			break
		}
		time.Sleep(time.Millisecond)
	}
	c.mu.Lock()
	state := s.state
	cursor := s.cursor
	ack := s.ack
	c.mu.Unlock()
	if state != "idle" || cursor == 0 || ack != "accepted" {
		t.Fatalf("disconnected send: state %s events %d", state, cursor)
	}
	// The same command arriving again after a lost response (a browser or
	// proxy resend) is observed, not replayed and not refused: a refusal
	// would tell the page its delivered message was rejected.
	retry := httptest.NewRequest("POST", "http://unix/send", strings.NewReader(body))
	retry.Header.Set("Content-Type", "application/json")
	again := httptest.NewRecorder()
	c.send(again, retry, id)
	if again.Code != 200 || !strings.Contains(again.Body.String(), `"pending"`) {
		t.Fatalf("duplicate send: %d %s", again.Code, again.Body.String())
	}
	time.Sleep(100 * time.Millisecond)
	c.mu.Lock()
	receipt, accepted := s.receipts[id], s.acceptedMessages
	c.mu.Unlock()
	if n := prompts(); n != 1 || receipt != "accepted" || accepted != 1 {
		t.Fatalf("duplicate send reached Pi: prompts %d receipt %q accepted %d", n, receipt, accepted)
	}
	// A native session can continue beyond the former 128-command ceiling
	// without forgetting spent IDs. The map is retained across continuation.
	c.mu.Lock()
	for i := 0; i < 127; i++ {
		s.commands[fmt.Sprintf("aaaaaaaa-aaaa-4aaa-8aaa-%012d", i)] = true
	}
	c.mu.Unlock()
	next := httptest.NewRequest("POST", "http://unix/send", strings.NewReader(fmt.Sprintf(`{"message":"after continuation","command_id":%q}`, "aaaaaaaa-aaaa-4aaa-8aaa-999999999999")))
	next.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	c.send(w, next, id)
	if w.Code != 200 {
		t.Fatalf("send after 128 spent IDs: %d %s", w.Code, w.Body.String())
	}
	deadline = time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		idle := s.state == "idle"
		c.mu.Unlock()
		if idle {
			break
		}
		time.Sleep(time.Millisecond)
	}
	oldID := httptest.NewRequest("POST", "http://unix/send", strings.NewReader(body))
	oldID.Header.Set("Content-Type", "application/json")
	again = httptest.NewRecorder()
	c.send(again, oldID, id)
	time.Sleep(100 * time.Millisecond)
	if again.Code != 200 || prompts() != 2 {
		t.Fatalf("old receipt ID replayed after continuation: %d, %d prompts", again.Code, prompts())
	}
}

func TestConversationWorkspaceReplacement(t *testing.T) {
	root := t.TempDir()
	a := filepath.Join(root, "a")
	b := filepath.Join(root, "b")
	if err := os.Mkdir(a, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(b, 0700); err != nil {
		t.Fatal(err)
	}
	before, err := unix.Open(a, unix.O_DIRECTORY|unix.O_RDONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(before)
	info, err := stat(before)
	if err != nil {
		t.Fatal(err)
	}
	selected := Workspace{dev: uint64(info.Dev), ino: info.Ino}
	if err := os.Rename(a, filepath.Join(root, "old")); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(b, a); err != nil {
		t.Fatal(err)
	}
	after, err := unix.Open(a, unix.O_DIRECTORY|unix.O_RDONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(after)
	if workspaceMatches(after, selected) || !workspaceMatches(before, selected) {
		t.Fatal("workspace substitution accepted")
	}
}

func TestConversationSpontaneousExitWithInheritedStdout(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	home := t.TempDir()
	runtime := filepath.Join(home, "run")
	if err := os.Mkdir(runtime, 0700); err != nil {
		t.Fatal(err)
	}
	script := filepath.Join(home, "pi")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nsetsid sh -c 'echo $$ > \"$HOME/holder.pid\"; exec sleep 5' &\nwhile [ ! -s \"$HOME/holder.pid\" ]; do sleep .01; done\n"), 0700); err != nil {
		t.Fatal(err)
	}
	owner, err := acquirePiOwnership(runtime, ownershipTestID)
	if err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPCCommand(script, nil, home, home, []string{"PATH=/usr/bin:/bin"}, owner, nil, "")
	if err != nil {
		t.Fatal(err)
	}
	s := &conversation{rpc: p, owner: owner, state: "idle"}
	c := &ConversationController{}
	watched := make(chan struct{})
	go func() { c.watch(s); close(watched) }()
	defer func() { _ = p.close() }()
	var pid int
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		b, e := os.ReadFile(filepath.Join(home, "holder.pid"))
		if e == nil {
			pid, _ = strconv.Atoi(strings.TrimSpace(string(b)))
			if pid > 0 {
				break
			}
		}
		time.Sleep(time.Millisecond)
	}
	if pid <= 0 {
		t.Fatal("holder did not start")
	}
	defer syscall.Kill(pid, syscall.SIGKILL)
	select {
	case <-watched:
	case <-time.After(time.Second):
		t.Fatal("watcher blocked by inherited stdout")
	}
	select {
	case <-p.done:
	case <-time.After(time.Second):
		t.Fatal("reader blocked by inherited stdout")
	}
	// A reaped child leaves no control: stopped, never idle or settled.
	if s.state != "stopped" || !s.dead {
		t.Fatalf("spontaneous exit treated as %q", s.state)
	}
}

func TestConversationPrivateBoundary(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("mapped nonroot daemon required")
	}
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, err := strconv.Atoi(u.Uid)
	if err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{UID: uid, GatewayUID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42", Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock"}
	checks := 0
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c := newConversationController(ctx, cfg, nil, func(*http.Request) bool { return true }, func(context.Context) string { checks++; return "usable" })
	defer c.shutdown()
	request := func(method, path, identity, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://unix"+path, strings.NewReader(body))
		r.RequestURI = path
		r.Header.Set("X-Agent-Host-Identity", identity)
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.ServeHTTP(w, r)
		return w
	}
	path := "/api/v1/conversations"
	if w := request("POST", path, opaque("wid_", "github:42"), `{"workspace_id":"../etc"}`); w.Code != 400 {
		t.Fatalf("path traversal: %d", w.Code)
	}
	if w := request("GET", path, opaque("wid_", "github:42"), ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"sessions":[]`) {
		t.Fatalf("private list: %d %s", w.Code, w.Body.String())
	}
	c.status = func(context.Context) string { checks++; return "missing" }
	if w := request("GET", path, opaque("wid_", "github:42"), ""); w.Code != 200 || checks != 0 || c.closed {
		t.Fatalf("native read used Pi status or revoked controller: %d checks=%d", w.Code, checks)
	}
}

func TestConversationQueueClearCorrelatedAndDeduplicated(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	code := `#!/usr/bin/env python3
import json,sys,time
q={"steering":[],"followUp":[]}
for line in sys.stdin:
 r=json.loads(line)
 if r["type"] in ("steer","follow_up"):
  q["steering" if r["type"]=="steer" else "followUp"].append(r["message"])
  print(json.dumps(dict(type="queue_update",**q)),flush=True)
 if r["type"]=="clear_queue":
  result=q
  q={"steering":[],"followUp":[]}
  print(json.dumps(dict(type="queue_update",**q)),flush=True)
  print(json.dumps(dict(type="response",id=r["id"],command=r["type"],success=True,data=result)),flush=True)
 else:
  print(json.dumps(dict(type="response",id=r["id"],command=r["type"],success=True)),flush=True)
`
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	id := ownershipTestID
	s := &conversation{id: id, rpc: p, state: "accepted", commands: map[string]bool{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}}
	go c.drain(s)
	for i, kind := range []string{"steer", "follow_up", "steer"} {
		cid := fmt.Sprintf("12345678-1234-4123-8123-%012d", i)
		body := fmt.Sprintf(`{"message":%q,"command_id":%q}`, fmt.Sprintf("text %d", i), cid)
		req := httptest.NewRequest("POST", "http://unix/"+kind, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.sendKind(w, req, id, kind)
		if w.Code != 200 {
			t.Fatalf("%s: %d %s", kind, w.Code, w.Body.String())
		}
		deadline := time.Now().Add(time.Second)
		for time.Now().Before(deadline) {
			c.mu.Lock()
			ack := s.ack
			c.mu.Unlock()
			if ack == "accepted" {
				break
			}
			time.Sleep(time.Millisecond)
		}
	}
	body := fmt.Sprintf(`{"command_id":%q}`, "12345678-1234-4123-8123-999999999999")
	clear := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "http://unix/clear_queue", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.clearQueue(w, req, id)
		return w
	}
	result := clear()
	if result.Code != 200 || !strings.Contains(result.Body.String(), `"steering":["text 0","text 2"]`) || !strings.Contains(result.Body.String(), `"follow_up":["text 1"]`) {
		t.Fatalf("clear result: %d %s", result.Code, result.Body.String())
	}
	if again := clear(); again.Code != 409 {
		t.Fatalf("duplicate clear: %d", again.Code)
	}
	// A long native queue_update exceeds the presentation event cap, but it
	// must still update the authoritative queue without poisoning Pi transport.
	long := strings.Repeat("x", 9000)
	req := httptest.NewRequest("POST", "http://unix/steer", strings.NewReader(fmt.Sprintf(`{"message":%q,"command_id":%q}`, long, "12345678-1234-4123-8123-888888888888")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.sendKind(w, req, id, "steer")
	if w.Code != 200 {
		t.Fatalf("long steer %d", w.Code)
	}
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		got := len(s.queueSteering)
		state := s.state
		c.mu.Unlock()
		if got == 1 && state == "accepted" {
			break
		}
		time.Sleep(time.Millisecond)
	}
	c.mu.Lock()
	got := len(s.queueSteering)
	c.mu.Unlock()
	if got != 1 || p.overflow.Load() {
		t.Fatal("long queue event poisoned or missing")
	}
	c.mu.Lock()
	state := s.state
	c.mu.Unlock()
	if state != "accepted" {
		t.Fatalf("long queue state %s", state)
	}
}

func TestConversationAbortTurnKeepsWriterAndRejectsReplay(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	code := `#!/usr/bin/env python3
import json,sys,time
for line in sys.stdin:
 r=json.loads(line)
 if r["type"]=="abort": time.sleep(.1)
 print(json.dumps(dict(type="response",id=r["id"],command=r["type"],success=True)),flush=True)
`
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	id := ownershipTestID
	s := &conversation{id: id, rpc: p, state: "accepted", commands: map[string]bool{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}}
	body := fmt.Sprintf(`{"command_id":%q}`, id)
	call := func() *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "http://unix/abort", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.abort(w, r, id)
		return w
	}
	if w := call(); w.Code != 200 || !strings.Contains(w.Body.String(), `"pending"`) {
		t.Fatalf("abort: %d %s", w.Code, w.Body.String())
	}
	if w := call(); w.Code != 409 {
		t.Fatalf("replayed abort: %d", w.Code)
	}
	clear := httptest.NewRequest("POST", "http://unix/clear_queue", strings.NewReader(body))
	clear.Header.Set("Content-Type", "application/json")
	blocked := httptest.NewRecorder()
	c.clearQueue(blocked, clear, id)
	if blocked.Code != 409 {
		t.Fatalf("clear while aborting: %d", blocked.Code)
	}
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		ack, state, aborting := s.ack, s.state, s.aborting
		c.mu.Unlock()
		if ack == "accepted" && !aborting {
			if state != "accepted" {
				t.Fatalf("process state %s", state)
			}
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("no Pi abort acknowledgement")
}

func TestConversationStatusNoStreamOrImplicitProof(t *testing.T) {
	const id = "12345678-1234-4123-8123-123456789abc"
	home := t.TempDir()
	s := &conversation{id: id, workspace: "ws_12345678", cwd: home, rpc: &piRPC{}, state: "idle", events: []json.RawMessage{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, trusted: func(*http.Request) bool { return true }}
	for _, route := range []string{"/api/v1/conversations/" + id + "/status", "/api/v1/conversations/" + id + "/stream"} {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("GET", "http://unix"+route, nil)
		r.RequestURI = r.URL.RequestURI()
		c.ServeHTTP(w, r)
		if strings.HasSuffix(route, "/stream") {
			if w.Code != 404 {
				t.Fatalf("stream: %d", w.Code)
			}
			continue
		}
		if w.Code != 200 || !strings.Contains(w.Body.String(), `"continuation":"unproven"`) {
			t.Fatalf("status: %d %s", w.Code, w.Body.String())
		}
	}
}

// A known native file contributes only a metadata hint. Corrupt contents do
// not become "readable" on status; the history reader rejects them separately.
func TestConversationStatusUsesStatAndProofIsOptIn(t *testing.T) {
	const id = "12345678-1234-4123-8123-123456789abc"
	home := t.TempDir()
	path := filepath.Join(home, "session.jsonl")
	if err := os.WriteFile(path, []byte("not JSON\n"), 0600); err != nil {
		t.Fatal(err)
	}
	s := &conversation{id: id, workspace: "ws_12345678", cwd: home, historyPath: path, rpc: &piRPC{}, state: "idle", events: []json.RawMessage{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}}
	read := func() map[string]any {
		t.Helper()
		w := httptest.NewRecorder()
		c.observe(w, httptest.NewRequest("GET", "http://unix/status", nil), id)
		if w.Code != 200 {
			t.Fatal(w.Code)
		}
		var v map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	first := read()
	if first["native_history"] != "present" || first["native_revision"] == "" || first["continuation"] != "unproven" {
		t.Fatalf("metadata: %v", first)
	}
	if native := readNative(path, os.Geteuid()); native.state == "readable" {
		t.Fatal("invalid JSONL admitted by history reader")
	}
	if err := os.WriteFile(path, []byte("not JSON\nmore\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if read()["native_revision"] == first["native_revision"] {
		t.Fatal("metadata change not observed")
	}
	// Before a native path is known, a broken sessions root is unavailable,
	// not evidence that history is absent.
	s.historyPath = ""
	if err := os.WriteFile(filepath.Join(home, ".pi"), []byte("not a directory"), 0600); err != nil {
		t.Fatal(err)
	}
	if got := read()["native_history"]; got != "unavailable" {
		t.Fatalf("broken history root reported %v", got)
	}
	if err := os.Remove(filepath.Join(home, ".pi")); err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(home, historyRoot)
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	oversized, err := os.Create(filepath.Join(root, "oversized.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fmt.Fprintf(oversized, "{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home); err != nil {
		t.Fatal(err)
	}
	// A session past the former 512 MiB whole-file bound stays present: its
	// readers stream or read from the tail.
	if err := oversized.Truncate(600 << 20); err != nil {
		t.Fatal(err)
	}
	if err := oversized.Close(); err != nil {
		t.Fatal(err)
	}
	if got := read()["native_history"]; got != "present" {
		t.Fatalf("large native file reported %v", got)
	}
}

func TestConversationContinuationProofAndStatus(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot lock owner")
	}
	const id = ownershipTestID
	const workspace = "ws_12345678"
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "project")
	for _, path := range []string{cwd, filepath.Join(home, ".pi", "agent", "sessions")} {
		if err := os.MkdirAll(path, 0700); err != nil {
			t.Fatal(err)
		}
	}
	fd, err := unix.Open(cwd, unix.O_PATH|unix.O_DIRECTORY, 0)
	if err != nil {
		t.Fatal(err)
	}
	fi, err := stat(fd)
	unix.Close(fd)
	if err != nil {
		t.Fatal(err)
	}
	selected := Workspace{Name: "project", Kind: "repository", Metadata: "missing", WorkspaceID: workspace, dev: uint64(fi.Dev), ino: fi.Ino}
	path := filepath.Join(home, ".pi", "agent", "sessions", "session.jsonl")
	header := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, cwd)
	if err := os.WriteFile(path, []byte(header), 0600); err != nil {
		t.Fatal(err)
	}
	owner, err := acquirePiOwnership(home, id)
	if err != nil {
		t.Fatal(err)
	}
	defer owner.release()
	if err := owner.markBrowser(workspace, cwd); err != nil {
		t.Fatal(err)
	}
	exited := make(chan struct{})
	s := &conversation{id: id, workspace: workspace, cwd: cwd, rpc: &piRPC{exited: exited}, owner: owner, state: "uncertain", events: []json.RawMessage{}}
	c := &ConversationController{writerProc: t.TempDir(), home: home, fixture: true, cfg: transport.Config{Home: home, UID: os.Geteuid()}, runtime: &core.PiRuntimeConfig{Node: "/bin/sh", Entry: "/bin/fake", Manifest: "/bin/fake"}, sessions: map[string]*conversation{id: s}}
	c.discover = func(transport.Config) Discovery { return Discovery{State: "present", Entries: []Workspace{selected}} }
	status := func() string {
		w := httptest.NewRecorder()
		c.observe(w, httptest.NewRequest("GET", "http://unix/status?continuation=true", nil), id)
		if w.Code != 200 {
			t.Fatalf("status: %d %s", w.Code, w.Body.String())
		}
		var view struct {
			Continuation string `json:"continuation"`
			State        string `json:"state"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &view); err != nil {
			t.Fatal(err)
		}
		if view.State != "uncertain" {
			t.Fatalf("unexpected state: %s", view.State)
		}
		return view.Continuation
	}
	proof := func() string {
		o, _, ws, _, _, _, got := c.continuationProof(id)
		if ws != nil {
			ws.Close()
		}
		if o != nil {
			o.release()
		}
		return got
	}
	check := func(expected string) {
		t.Helper()
		if got := status(); got != expected {
			t.Fatalf("status continuation %s, want %s", got, expected)
		}
		if got := proof(); got != expected {
			t.Fatalf("admission proof %s, want %s", got, expected)
		}
	}
	check("writer_present") // live child, despite uncertain RPC and readable JSONL
	close(exited)           // direct child reaped; status releases the controller's lock
	check("eligible")
	// A cut-off tail is eligible: only a start removes it. Probing it, as
	// status and admission do, never changes the native file.
	cut := header + `{"type":"message","id":"cut","message":{"content":"lost`
	if err := os.WriteFile(path, []byte(cut), 0600); err != nil {
		t.Fatal(err)
	}
	check("eligible")
	if data, _ := os.ReadFile(path); string(data) != cut {
		t.Fatal("a continuation probe changed cut-off history")
	}
	// A complete corrupt line is damage the person is told about.
	damaged := header + "{bad\n"
	if err := os.WriteFile(path, []byte(damaged), 0600); err != nil {
		t.Fatal(err)
	}
	check("history_damaged")
	damagedReply := httptest.NewRecorder()
	c.continueEnded(damagedReply, httptest.NewRequest("POST", "http://unix/continue", nil), id)
	if damagedReply.Code != http.StatusConflict || !strings.Contains(damagedReply.Body.String(), "history_damaged") {
		t.Fatalf("damaged continuation: %d %s", damagedReply.Code, damagedReply.Body.String())
	}
	if data, _ := os.ReadFile(path); string(data) != damaged {
		t.Fatal("continuation changed damaged history")
	}
	if err := os.WriteFile(path, []byte(header), 0600); err != nil {
		t.Fatal(err)
	}
	// A second status must wait for this daemon's temporary probe instead
	// of reporting a foreign writer while no Pi process is running.
	originalDiscover := c.discover
	entered, unblock := make(chan struct{}), make(chan struct{})
	c.discover = func(cfg transport.Config) Discovery {
		close(entered)
		<-unblock
		return originalDiscover(cfg)
	}
	first := make(chan string, 1)
	go func() { first <- status() }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("first probe did not enter discovery")
	}
	c.discover = originalDiscover
	second := make(chan string, 1)
	go func() { second <- status() }()
	close(unblock)
	for label, result := range map[string]string{"first probe": <-first, "overlapping probe": <-second} {
		if result != "eligible" && result != "unproven" {
			t.Fatalf("%s: %s (expected eligible or transient unproven, never a foreign writer)", label, result)
		}
	}
	check("eligible")
	permit, ok := c.proofPermit(context.Background())
	if !ok {
		t.Fatal("could not hold local proof gate")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if release, ok := c.proofPermit(ctx); ok {
		release()
		t.Fatal("canceled proof wait entered")
	}
	permit()
	// Native source failures retain 503 on admission, but status never
	// exports that internal reason as a fifth continuation value.
	runtime := c.runtime
	c.runtime = nil
	checkStatusOnly := status()
	if checkStatusOnly != "unproven" {
		t.Fatalf("missing runtime: %s", checkStatusOnly)
	}
	w := httptest.NewRecorder()
	c.continueEnded(w, httptest.NewRequest("POST", "http://unix/continue", nil), id)
	if w.Code != 503 {
		t.Fatalf("missing runtime admission: %d %s", w.Code, w.Body.String())
	}
	c.runtime = runtime
	// The status probe never reserves a writer lock beyond its own request.
	other, err := acquirePiOwnership(home, id)
	if err != nil {
		t.Fatal(err)
	}
	check("writer_present")
	other.release()
	if err := os.WriteFile(path, []byte(header+"{\"type\":\n"), 0600); err != nil {
		t.Fatal(err)
	}
	check("history_damaged")
	if err := os.WriteFile(path, []byte(header), 0600); err != nil {
		t.Fatal(err)
	}
	terminal, err := acquirePiOwnership(home, id)
	if err != nil {
		t.Fatal(err)
	}
	if err := terminal.file.Truncate(0); err != nil {
		t.Fatal(err)
	}
	terminal.release()
	check("read_only_history")
	origin, err := acquirePiOwnership(home, id)
	if err != nil {
		t.Fatal(err)
	}
	if err := origin.markBrowser(workspace, cwd); err != nil {
		t.Fatal(err)
	}
	origin.release()
	// Simulate a daemon restart: no in-memory child, but the same lock,
	// origin, workspace and native-history proof is still required.
	c.sessions = map[string]*conversation{}
	restartProof := func(expected string) {
		t.Helper()
		if got := proof(); got != expected {
			t.Fatalf("restart proof %s, want %s", got, expected)
		}
	}
	restartProof("eligible")
	other, err = acquirePiOwnership(home, id)
	if err != nil {
		t.Fatal(err)
	}
	restartProof("writer_present")
	other.release()
	if err := os.WriteFile(path, []byte(header+"{\"type\":\n"), 0600); err != nil {
		t.Fatal(err)
	}
	restartProof("history_damaged")
}

func TestConversationReceiptAndUnknownQuestion(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	code := `#!/usr/bin/env python3
import json,sys,time
for line in sys.stdin:
 r=json.loads(line)
 print(json.dumps(dict(type="response",id=r["id"],command=r["type"],success=True)),flush=True)
 print(json.dumps(dict(type="extension_ui_request",id="req_1",method="custom_dialog",title="Choose <plain text>",options=["one","two"])),flush=True)
 print(json.dumps(dict(type="extension_ui_request",id="req_2",method="setStatus",statusKey="build",statusText="Synthetic <safe> status")),flush=True)
 time.sleep(.2)
 print(json.dumps(dict(type="message_end",message={"role":"assistant"})),flush=True)
 time.sleep(.05)
 print(json.dumps(dict(type="agent_settled")),flush=True)
`
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	id := ownershipTestID
	s := &conversation{id: id, rpc: p, state: "idle", commands: map[string]bool{}, events: []json.RawMessage{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, journal: newEventJournal()}
	go c.drain(s)
	body := fmt.Sprintf(`{"message":"hello","command_id":%q}`, id)
	req := httptest.NewRequest("POST", "http://unix/send", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	c.send(httptest.NewRecorder(), req, id)
	// Fire-and-forget updates must not replace an unanswered dialog before Pi settles.
	questionDeadline := time.Now().Add(2 * time.Second)
	seenDialog := false
	for time.Now().Before(questionDeadline) {
		c.journal.mu.Lock()
		updateSeen := false
		for _, raw := range c.journal.frames {
			if strings.Contains(string(raw), `"kind":"extension.visible"`) {
				updateSeen = true
				break
			}
		}
		c.journal.mu.Unlock()
		if updateSeen {
			c.mu.Lock()
			q := s.question
			seenDialog = q != nil && q["request_id"] == "req_1"
			c.mu.Unlock()
			break
		}
		time.Sleep(time.Millisecond)
	}
	if !seenDialog {
		t.Fatal("status update displaced pending dialog")
	}
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		done := s.settlement != nil && s.receipts[id] == "accepted"
		c.mu.Unlock()
		if done {
			break
		}
		time.Sleep(time.Millisecond)
	}
	c.mu.Lock()
	if s.receipts[id] != "accepted" || s.settlement["state"] != "unknown" || s.question != nil {
		t.Errorf("receipt %v question %v settlement %v", s.receipts, s.question, s.settlement)
	}
	c.mu.Unlock()
	c.journal.mu.Lock()
	foundQuestion, foundSafeUpdate := false, false
	for _, raw := range c.journal.frames {
		var event struct {
			Kind    string         `json:"kind"`
			Payload map[string]any `json:"payload"`
		}
		if json.Unmarshal(raw, &event) == nil && event.Kind == "question.requested" && event.Payload["question_kind"] == "unknown" && event.Payload["prompt"] == "Choose <plain text>" {
			foundQuestion = true
		}
		if event.Kind == "extension.visible" && event.Payload["method"] == "setStatus" && event.Payload["key"] == "build" && event.Payload["text"] == "Synthetic <safe> status" {
			foundSafeUpdate = true
		}
	}
	c.journal.mu.Unlock()
	if !foundQuestion || !foundSafeUpdate {
		t.Fatalf("question or safe fire-and-forget update missing: %v %v", foundQuestion, foundSafeUpdate)
	}
	lookup := httptest.NewRecorder()
	c.readReceipt(lookup, httptest.NewRequest("GET", "http://unix/receipt?command_id="+id, nil), id)
	if lookup.Code != 200 || !strings.Contains(lookup.Body.String(), `"accepted"`) {
		t.Fatalf("lookup %d %s", lookup.Code, lookup.Body.String())
	}
	_, _, _, views := c.journal.turnView()
	_ = views
}

func TestQuestionOneNativeWriteAndStale(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	code := `#!/usr/bin/env python3
import json,sys
for line in sys.stdin:
 r=json.loads(line)
 if r["type"] == "prompt":
  print(json.dumps(dict(type="response",id=r["id"],command="prompt",success=True)),flush=True)
  print(json.dumps(dict(type="extension_ui_request",id="native-1",method="select",title="Choose",options=["one","two"])),flush=True)
 elif r["type"] == "extension_ui_response" and r["id"] == "native-1":
  print(json.dumps(dict(type="extension_ui_request",id="native-2",method="confirm",title="Confirm",message="Continue?")),flush=True)
  print(json.dumps(dict(type="extension_ui_request",id="native-3",method="custom",title="Unknown")),flush=True)
 elif r["type"] == "extension_ui_response" and r["id"] == "native-3":
  print(json.dumps(dict(type="agent_settled")),flush=True)
  print(json.dumps(dict(type="extension_ui_request",id="native-4",method="input",title="After turn")),flush=True)
`
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	id := ownershipTestID
	s := &conversation{id: id, rpc: p, state: "idle", commands: map[string]bool{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, journal: newEventJournal()}
	go c.drain(s)
	accepted, err := p.request("prompt", "start", time.Second)
	if err != nil || !accepted {
		t.Fatalf("prompt: %v %v", accepted, err)
	}
	wait := func(want string) {
		t.Helper()
		end := time.Now().Add(time.Second)
		for time.Now().Before(end) {
			c.mu.Lock()
			got := s.questionID
			c.mu.Unlock()
			if got == want {
				return
			}
			time.Sleep(time.Millisecond)
		}
		t.Fatalf("question %q not pending", want)
	}
	call := func(request string, action string, value string) int {
		t.Helper()
		body := fmt.Sprintf(`{"request_id":%q,"action":%q%s}`, request, action, value)
		req := httptest.NewRequest("POST", AgentConversationsPath+"/"+id+"/question", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.agentConversations(w, req)
		return w.Code
	}
	wait("native-1")
	if code := call("wrong", "answer", `,"value":"one"`); code != 409 {
		t.Fatalf("stale: %d", code)
	}
	if code := call("native-1", "answer", `,"value":"three"`); code != 400 {
		t.Fatalf("invalid choice: %d", code)
	}
	if code := call("native-1", "answer", `,"value":"one"`); code != 200 {
		t.Fatalf("answer: %d", code)
	}
	if code := call("native-1", "answer", `,"value":"one"`); code != 409 {
		t.Fatalf("replay: %d", code)
	}
	wait("native-2")
	// Both requests arrived before the visible one was cancelled. Pi does not
	// repeat a request, so the daemon must keep native-3 until promotion.
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		queued := len(s.queuedQuestions)
		c.mu.Unlock()
		if queued == 1 {
			break
		}
		time.Sleep(time.Millisecond)
	}
	c.mu.Lock()
	queued := len(s.queuedQuestions)
	c.mu.Unlock()
	if queued != 1 {
		t.Fatal("concurrent dialog was discarded")
	}
	if code := call("native-2", "cancel", ""); code != 200 {
		t.Fatalf("cancel: %d", code)
	}
	wait("native-3")
	if code := call("native-3", "answer", `,"value":true`); code != 409 {
		t.Fatalf("unknown answer: %d", code)
	}
	if code := call("native-3", "cancel", ""); code != 200 {
		t.Fatalf("unknown cancel: %d", code)
	}
	wait("native-4")
	if code := call("native-4", "answer", `,"value":"later"`); code != 200 {
		t.Fatalf("post-settlement answer: %d", code)
	}
}

// The page steers while it sees the agent working. A steer that reaches a
// live, idle Pi after the turn ended starts the next turn when the browser
// sent it; an agent that asked for steering explicitly is told it is late.
func TestBrowserSteerAfterTurnEndStartsTurn(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	code := `#!/usr/bin/env python3
import json,sys
for line in sys.stdin:
 r=json.loads(line)
 open(sys.argv[0]+".log","a").write(r["type"]+" "+r.get("message","")+"\n")
 print(json.dumps(dict(type="response",id=r["id"],command=r["type"],success=True)),flush=True)
`
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	id := ownershipTestID
	s := &conversation{id: id, rpc: p, state: "idle", settled: true, commands: map[string]bool{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}}
	go c.drain(s)
	post := func(cid string, browser bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest("POST", "http://unix/steer", strings.NewReader(fmt.Sprintf(`{"message":"myöhässä","command_id":%q}`, cid)))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.admitMessage(w, req, id, "steer", browser)
		return w
	}
	if w := post("12345678-1234-4123-8123-000000000001", false); w.Code != 409 {
		t.Fatalf("explicit idle steer: %d %s", w.Code, w.Body.String())
	}
	if w := post("12345678-1234-4123-8123-000000000002", true); w.Code != 200 || !strings.Contains(w.Body.String(), `"pending"`) {
		t.Fatalf("browser idle steer: %d %s", w.Code, w.Body.String())
	}
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		receipt := s.receipts["12345678-1234-4123-8123-000000000002"]
		c.mu.Unlock()
		if receipt == "accepted" {
			break
		}
		time.Sleep(time.Millisecond)
	}
	// A refused browser prompt leaves "rejected" while a native run goes on;
	// that run is no idle Pi to prompt.
	c.mu.Lock()
	s.state, s.runActive = "rejected", true
	c.mu.Unlock()
	if w := post("12345678-1234-4123-8123-000000000003", true); w.Code != 409 {
		t.Fatalf("steer into a running native turn: %d %s", w.Code, w.Body.String())
	}
	log, _ := os.ReadFile(script + ".log")
	if string(log) != "prompt myöhässä\n" {
		t.Fatalf("Pi got %q", log)
	}
	c.mu.Lock()
	receipt := s.receipts["12345678-1234-4123-8123-000000000002"]
	c.mu.Unlock()
	if receipt != "accepted" {
		t.Fatalf("receipt %q", receipt)
	}
}

// A status names the journal position it was read at, so a browser can order
// status replies against each other and the stream: an event published with
// a state change is never past the cursor of a status that lacks the change.
func TestConversationStatusCarriesItsJournalPosition(t *testing.T) {
	const id = "12345678-1234-4123-8123-123456789abd"
	home := t.TempDir()
	s := &conversation{id: id, workspace: "ws_12345678", cwd: home, rpc: &piRPC{}, state: "accepted", events: []json.RawMessage{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, journal: newEventJournal()}
	read := func() map[string]any {
		t.Helper()
		w := httptest.NewRecorder()
		c.observe(w, httptest.NewRequest("GET", "http://unix/status", nil), id)
		if w.Code != 200 {
			t.Fatal(w.Code)
		}
		var v map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	before := read()
	if before["journal_cursor"] != c.journal.position() {
		t.Fatalf("status at %v, journal at %s", before["journal_cursor"], c.journal.position())
	}
	const command = "22222222-2222-4222-8222-222222222222"
	c.mu.Lock()
	s.command = command
	c.receipt(s, command, "accepted")
	c.mu.Unlock()
	after := read()
	if after["journal_cursor"] == before["journal_cursor"] || after["journal_cursor"] != c.journal.position() || after["command_id"] != command {
		t.Fatalf("status after the receipt's event: %v", after)
	}
}

// Jari 9.11.2026: a large image batch outlasted the time to hand it to Pi,
// and the cut-off write left the message uncertain in the page for good.
// A frame cut off before its end never reached Pi: the send is undelivered,
// a definite outcome, also when the ending child's watcher came first.
func TestPromptCutOffIsUndelivered(t *testing.T) {
	// A steer comes during a turn the ending child may have cut off: its
	// interruption stands.
	for _, tc := range []struct {
		watcherFirst bool
		kind         string
	}{{false, "send"}, {true, "send"}, {true, "steer"}} {
		watcherFirst, kind := tc.watcherFirst, tc.kind
		home := t.TempDir()
		script := filepath.Join(home, "pi")
		// Pi takes nothing in, as a reader far too slow for the frame.
		if err := os.WriteFile(script, []byte("#!/bin/sh\nsleep 10\n"), 0700); err != nil {
			t.Fatal(err)
		}
		p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
		if err != nil {
			t.Fatal(err)
		}
		id := ownershipTestID
		s := &conversation{id: id, rpc: p, state: "idle", settled: true, commands: map[string]bool{id: true}, events: []json.RawMessage{}}
		c := &ConversationController{sessions: map[string]*conversation{id: s}, journal: newEventJournal(), promptTimeout: 50 * time.Millisecond}
		c.mu.Lock()
		c.beginPrompt(s, kind, []string{id})
		if watcherFirst {
			// The child ends as soon as its input is closed; its watcher
			// takes the lock before finishPrompt does.
			done := make(chan struct{})
			go func() {
				c.finishPrompt(s, kind, []string{id}, strings.Repeat("\n", 60000), nil, "idle", true, nil)
				close(done)
			}()
			deadline := time.Now().Add(5 * time.Second)
			for p.inputEndCause() == "" && time.Now().Before(deadline) {
				time.Sleep(time.Millisecond)
			}
			s.state, s.ack, s.interrupted = "stopped", "uncertain", true
			c.uncertainPrompt(s)
			c.mu.Unlock()
			<-done
		} else {
			c.mu.Unlock()
			c.finishPrompt(s, kind, []string{id}, strings.Repeat("\n", 60000), nil, "idle", true, nil)
		}
		c.mu.Lock()
		if kind == "steer" {
			if s.ack != "rejected" || !s.interrupted {
				t.Errorf("steer: ack %q interrupted %v", s.ack, s.interrupted)
			}
			c.mu.Unlock()
			_ = p.close()
			continue
		}
		if s.receipts[id] != "undelivered" || s.ack != "rejected" || s.interrupted || s.told {
			t.Errorf("watcher first %v: receipt %q ack %q interrupted %v told %v", watcherFirst, s.receipts[id], s.ack, s.interrupted, s.told)
		}
		if !watcherFirst && (s.state != "rejected" || !s.settled) {
			t.Errorf("state %q settled %v", s.state, s.settled)
		}
		c.mu.Unlock()
		c.journal.mu.Lock()
		found := false
		for _, raw := range c.journal.frames {
			if strings.Contains(string(raw), `"error_code":"not_delivered"`) && strings.Contains(string(raw), `"acceptance":"rejected"`) {
				found = true
			}
		}
		c.journal.mu.Unlock()
		if !found {
			t.Error("journal does not say the message was not delivered")
		}
		_ = p.close()
	}
}
