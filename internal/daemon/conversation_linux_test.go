//go:build linux

package daemon

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
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

	"github.com/maintainer/native-agent-host/internal/core"
	"github.com/maintainer/native-agent-host/internal/transport"
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
 print(json.dumps(dict(type="response",id=r["id"],command=r["type"],success=True)),flush=True)
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
	// Same command ID cannot be replayed after a lost response.
	retry := httptest.NewRequest("POST", "http://unix/send", strings.NewReader(body))
	retry.Header.Set("Content-Type", "application/json")
	again := httptest.NewRecorder()
	c.send(again, retry, id)
	if again.Code != 409 {
		t.Fatalf("duplicate send: %d", again.Code)
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
	if again.Code != 409 {
		t.Fatalf("old receipt ID replayed after continuation: %d", again.Code)
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
	p, err := launchPiRPCCommand(script, nil, home, home, []string{"PATH=/usr/bin:/bin"}, owner, nil)
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
			break
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
	if s.state != "uncertain" {
		t.Fatal("spontaneous exit treated as settled")
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
	cfg := transport.Config{UID: uid, GatewayUID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42", Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock"}
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
	if w := request("POST", path, opaque("wid_", "github:other"), `{"workspace_id":"ws_invalidxx"}`); w.Code != 403 || checks != 0 {
		t.Fatalf("cross identity: %d %d", w.Code, checks)
	}
	if w := request("POST", path, opaque("wid_", "github:42"), `{"workspace_id":"../etc"}`); w.Code != 400 {
		t.Fatalf("path traversal: %d", w.Code)
	}
	if w := request("GET", path, opaque("wid_", "github:42"), ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"sessions":[]`) {
		t.Fatalf("private list: %d %s", w.Code, w.Body.String())
	}
	c.status = func(context.Context) string { return "missing" }
	if w := request("GET", path, opaque("wid_", "github:42"), ""); w.Code != 428 {
		t.Fatalf("revoked: %d", w.Code)
	}
	if !c.closed {
		t.Fatal("revocation did not close controller")
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

func TestConversationStreamCursorAndNativeRecovery(t *testing.T) {
	const id = "12345678-1234-4123-8123-123456789abc"
	const instance = "aaaaaaaa-1234-4123-8123-123456789abc"
	home := t.TempDir()
	s := &conversation{id: id, workspace: "ws_12345678", cwd: home, rpc: &piRPC{}, state: "idle", events: []json.RawMessage{}}
	c := &ConversationController{instance: instance, sessions: map[string]*conversation{id: s}, home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, status: func(context.Context) string { return "usable" }}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { c.stream(w, r, id) }))
	defer server.Close()
	request := func(cursor string) (int, string) {
		req, _ := http.NewRequest("GET", server.URL, nil)
		if cursor != "" {
			req.Header.Set("Last-Event-ID", cursor)
		}
		client := &http.Client{Timeout: 3 * time.Second}
		res, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != 200 {
			b, _ := io.ReadAll(res.Body)
			return res.StatusCode, string(b)
		}
		reader := bufio.NewReader(res.Body)
		line, err := reader.ReadString('\n')
		if err != nil {
			t.Fatal(err)
		}
		return res.StatusCode, line
	}
	if code, first := request(""); code != 200 || !strings.Contains(first, "ev1:"+instance+":1") {
		t.Fatalf("initial: %d %s", code, first)
	}
	if code, _ := request("ev1:" + instance + ":9"); code != 409 || s.streamSeq != 1 {
		t.Fatalf("future cursor admitted: %d seq=%d", code, s.streamSeq)
	}
	if code, body := request("ev1:bbbbbbbb-1234-4123-8123-123456789abc:1"); code != 409 || !strings.Contains(body, "cursor_instance_mismatch") {
		t.Fatalf("previous incarnation admitted: %d %s", code, body)
	}
	if code, body := request("ev1:" + instance + ":1"); code != 409 || !strings.Contains(body, "cursor_expired") {
		t.Fatalf("cursor without replay silently accepted: %d %s", code, body)
	}
	if code, next := request(""); code != 200 || !strings.Contains(next, ":2") {
		t.Fatalf("fresh resnapshot: %d %s", code, next)
	}
}

func TestConversationStreamUnknownProbeDoesNotRevoke(t *testing.T) {
	const id = "12345678-1234-4123-8123-123456789abc"
	home := t.TempDir()
	s := &conversation{id: id, workspace: "ws_12345678", cwd: home, rpc: &piRPC{}, state: "idle", events: []json.RawMessage{}}
	c := &ConversationController{instance: id, sessions: map[string]*conversation{id: s}, home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, status: func(context.Context) string { return "unknown" }}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { c.stream(w, r, id) }))
	defer server.Close()
	res, err := http.Get(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if c.closed || s.state != "idle" {
		t.Fatal("transient status failure killed Pi controller")
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
	c := &ConversationController{home: home, fixture: true, cfg: transport.Config{Home: home, UID: os.Geteuid()}, runtime: &core.PiRuntimeConfig{Node: "/bin/sh", Entry: "/bin/fake", Manifest: "/bin/fake"}, sessions: map[string]*conversation{id: s}}
	c.discover = func(transport.Config) Discovery { return Discovery{State: "present", Entries: []Workspace{selected}} }
	status := func() string {
		w := httptest.NewRecorder()
		c.observe(w, httptest.NewRequest("GET", "http://unix/status", nil), id)
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
	check := func(expected string) {
		t.Helper()
		if got := status(); got != expected {
			t.Fatalf("status continuation %s, want %s", got, expected)
		}
		o, _, ws, _, _, _, got := c.continuationProof(id)
		if ws != nil {
			ws.Close()
		}
		if o != nil {
			o.release()
		}
		if got != expected {
			t.Fatalf("admission proof %s, want %s", got, expected)
		}
	}
	check("writer_present") // live child, despite uncertain RPC and readable JSONL
	close(exited)           // direct child reaped; status releases the controller's lock
	check("eligible")
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
	check("unproven")
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
		o, _, ws, _, _, _, got := c.continuationProof(id)
		if ws != nil {
			ws.Close()
		}
		if o != nil {
			o.release()
		}
		if got != expected {
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
	restartProof("unproven")
}
