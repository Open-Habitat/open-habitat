//go:build linux

package msmcp

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"
)

// The test binary doubles as a fake native server when FAKE_MCP_DIR is set.
// It records every start, any overlap with another running instance, every
// call and every cancellation in that directory.
func TestMain(m *testing.M) {
	if dir := os.Getenv("FAKE_MCP_DIR"); dir != "" {
		fakeServer(dir)
		os.Exit(0)
	}
	os.Exit(m.Run())
}

func appendLine(path, line string) {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err == nil {
		fmt.Fprintln(f, line)
		f.Close()
	}
}

var fakeTools = []string{"list-folder-files", "search-query", "delete-mail-folder", "send-mail", "list-mail-folders", "login", "list-accounts"}

func fakeServer(dir string) {
	account := os.Getenv("FAKE_ACCOUNT")
	lock, _ := os.OpenFile(filepath.Join(dir, "running.lock"), os.O_CREATE|os.O_RDWR, 0600)
	if syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB) != nil {
		appendLine(filepath.Join(dir, "overlap"), account)
	}
	appendLine(filepath.Join(dir, "starts"), account)
	var mu sync.Mutex
	out := bufio.NewWriter(os.Stdout)
	write := func(v any) {
		b, _ := json.Marshal(v)
		mu.Lock()
		out.Write(append(b, '\n'))
		out.Flush()
		mu.Unlock()
	}
	cancelled := map[string]chan struct{}{}
	var cmu sync.Mutex
	in := bufio.NewScanner(os.Stdin)
	in.Buffer(make([]byte, 1<<20), 1<<20)
	for in.Scan() {
		var msg struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
			Params json.RawMessage `json:"params"`
		}
		if json.Unmarshal(in.Bytes(), &msg) != nil {
			continue
		}
		switch msg.Method {
		case "initialize":
			write(map[string]any{"jsonrpc": "2.0", "id": msg.ID, "result": map[string]any{"protocolVersion": "2025-06-18", "capabilities": map[string]any{"tools": map[string]any{}}, "serverInfo": map[string]any{"name": "fake", "version": "1"}, "instructions": "fake instructions"}})
		case "tools/list":
			var tools []any
			for _, t := range fakeTools {
				tools = append(tools, map[string]any{"name": t, "inputSchema": map[string]any{"type": "object"}})
			}
			write(map[string]any{"jsonrpc": "2.0", "id": msg.ID, "result": map[string]any{"tools": tools}})
		case "notifications/cancelled":
			var p struct {
				RequestID json.RawMessage `json:"requestId"`
			}
			json.Unmarshal(msg.Params, &p)
			appendLine(filepath.Join(dir, "cancelled"), string(p.RequestID))
			cmu.Lock()
			if ch := cancelled[string(p.RequestID)]; ch != nil {
				close(ch)
				delete(cancelled, string(p.RequestID))
			}
			cmu.Unlock()
		case "tools/call":
			var p struct {
				Name      string `json:"name"`
				Arguments struct {
					Delay int    `json:"delay"`
					Crash bool   `json:"crash"`
					Hang  bool   `json:"hang"`
					Huge  int    `json:"huge"`
					Tag   string `json:"tag"`
				} `json:"arguments"`
				Meta struct {
					Token json.RawMessage `json:"progressToken"`
				} `json:"_meta"`
			}
			json.Unmarshal(msg.Params, &p)
			appendLine(filepath.Join(dir, "calls"), account+" "+p.Name+" "+p.Arguments.Tag)
			if p.Arguments.Crash {
				os.Exit(3)
			}
			if p.Arguments.Huge > 0 {
				// An answer past the bridge's line bound, written while
				// nobody may read it; ignore SIGPIPE like Node does.
				signal.Ignore(syscall.SIGPIPE)
				write(map[string]any{"jsonrpc": "2.0", "id": msg.ID, "result": map[string]any{"content": []any{map[string]any{"type": "text", "text": strings.Repeat("x", p.Arguments.Huge)}}}})
				time.Sleep(time.Hour)
			}
			done := make(chan struct{})
			cmu.Lock()
			cancelled[string(msg.ID)] = done
			cmu.Unlock()
			id := msg.ID
			go func() {
				if len(p.Meta.Token) > 0 {
					write(map[string]any{"jsonrpc": "2.0", "method": "notifications/progress", "params": map[string]any{"progressToken": p.Meta.Token, "progress": 1, "message": p.Arguments.Tag}})
				}
				wait := time.Duration(p.Arguments.Delay) * time.Millisecond
				if p.Arguments.Hang {
					wait = time.Hour
				}
				select {
				case <-done:
					return // a cancelled request is not answered
				case <-time.After(wait):
				}
				write(map[string]any{"jsonrpc": "2.0", "id": id, "result": map[string]any{"content": []any{map[string]any{"type": "text", "text": account + ":" + p.Name + ":" + p.Arguments.Tag}}}})
			}()
		}
	}
}

type harness struct {
	t    *testing.T
	home string
	dir  string
	srv  *Server
	stop context.CancelFunc
	done chan struct{}
	// accounts the resolver admits; others are refused.
	mu       sync.Mutex
	accounts map[string]string // account -> extra key part
}

func newHarness(t *testing.T, opt Options) *harness {
	t.Helper()
	home := t.TempDir()
	dir := t.TempDir()
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	h := &harness{t: t, home: home, dir: dir, accounts: map[string]string{"a@example.test": "", "b@example.test": ""}, done: make(chan struct{})}
	resolve := func(account string) (Binding, error) {
		h.mu.Lock()
		extra, ok := h.accounts[account]
		h.mu.Unlock()
		if !ok {
			return Binding{}, errors.New("unknown account")
		}
		return Binding{Account: account, Key: account + "\x00" + extra, Path: exe, Env: []string{"FAKE_MCP_DIR=" + dir, "FAKE_ACCOUNT=" + account + extra, "PATH=/usr/bin:/bin"}, Dir: dir}, nil
	}
	if opt.Stop == 0 {
		opt.Stop = 300 * time.Millisecond
	}
	h.srv = NewServer(resolve, opt)
	ctx, cancel := context.WithCancel(context.Background())
	h.stop = cancel
	go func() {
		defer close(h.done)
		h.srv.Serve(ctx, home)
	}()
	t.Cleanup(h.close)
	deadline := time.Now().Add(5 * time.Second)
	for {
		if _, err := os.Stat(SocketPath(home)); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("endpoint never appeared")
		}
		time.Sleep(10 * time.Millisecond)
	}
	return h
}

func (h *harness) close() {
	h.stop()
	select {
	case <-h.done:
	case <-time.After(10 * time.Second):
		h.t.Error("server did not stop")
	}
}

func (h *harness) lines(name string) []string {
	data, _ := os.ReadFile(filepath.Join(h.dir, name))
	var out []string
	for _, l := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		if l != "" {
			out = append(out, l)
		}
	}
	return out
}

// mcpClient is a minimal client over the production socket.
type mcpClient struct {
	t    *testing.T
	conn *net.UnixConn
	mu   sync.Mutex
	got  chan map[string]json.RawMessage
}

func (h *harness) dial(account, area string) *mcpClient {
	h.t.Helper()
	conn, err := Dial(h.home, Hello{Provider: "microsoft", Account: account, Area: area}, nil, 2*time.Second)
	if err != nil {
		h.t.Fatal(err)
	}
	c := &mcpClient{t: h.t, conn: conn, got: make(chan map[string]json.RawMessage, 64)}
	go func() {
		r := bufio.NewReader(conn)
		for {
			line, err := readLine(r, 1<<20)
			if err != nil {
				close(c.got)
				return
			}
			var m map[string]json.RawMessage
			json.Unmarshal(line, &m)
			c.got <- m
		}
	}()
	h.t.Cleanup(func() { conn.Close() })
	return c
}

func (c *mcpClient) send(v any) {
	b, _ := json.Marshal(v)
	c.mu.Lock()
	defer c.mu.Unlock()
	c.conn.Write(append(b, '\n'))
}

func (c *mcpClient) request(id any, method string, params any) {
	c.send(map[string]any{"jsonrpc": "2.0", "id": id, "method": method, "params": params})
}

func (c *mcpClient) next(timeout time.Duration) map[string]json.RawMessage {
	c.t.Helper()
	select {
	case m, ok := <-c.got:
		if !ok {
			c.t.Fatal("connection closed")
		}
		return m
	case <-time.After(timeout):
		c.t.Fatal("no message")
	}
	return nil
}

func (c *mcpClient) none(timeout time.Duration) {
	c.t.Helper()
	select {
	case m, ok := <-c.got:
		if ok {
			c.t.Fatalf("unexpected message %s", m)
		}
	case <-time.After(timeout):
	}
}

func (c *mcpClient) call(id any, name string, args map[string]any) map[string]json.RawMessage {
	c.t.Helper()
	c.request(id, "tools/call", map[string]any{"name": name, "arguments": args})
	return c.next(10 * time.Second)
}

func text(t *testing.T, m map[string]json.RawMessage) string {
	t.Helper()
	var r struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if json.Unmarshal(m["result"], &r) != nil || len(r.Content) == 0 {
		t.Fatalf("no result: %s %s", m["result"], m["error"])
	}
	return r.Content[0].Text
}

func errMessage(m map[string]json.RawMessage) string {
	var e rpcError
	json.Unmarshal(m["error"], &e)
	return e.Message
}

func toolNames(t *testing.T, m map[string]json.RawMessage) []string {
	var r struct {
		Tools []struct {
			Name string `json:"name"`
		} `json:"tools"`
	}
	if json.Unmarshal(m["result"], &r) != nil {
		t.Fatalf("listing: %s", m["error"])
	}
	var out []string
	for _, tool := range r.Tools {
		out = append(out, tool.Name)
	}
	slices.Sort(out)
	return out
}

// Twenty connections across four "conversations" and all areas start the
// native server once and see only their area's tools; sign-in tools and
// another area's tools are neither listed nor callable.
func TestOneChildFilteredAreas(t *testing.T) {
	h := newHarness(t, Options{})
	var wg sync.WaitGroup
	var mu sync.Mutex
	listings := map[string][]string{}
	for conv := 0; conv < 4; conv++ {
		for _, area := range AreaNames() {
			wg.Add(1)
			go func(conv int, area string) {
				defer wg.Done()
				c := h.dial("a@example.test", area)
				c.request(1, "initialize", map[string]any{"protocolVersion": "2025-03-26"})
				init := c.next(10 * time.Second)
				var ir struct {
					Protocol     string `json:"protocolVersion"`
					Instructions string `json:"instructions"`
				}
				if json.Unmarshal(init["result"], &ir) != nil || ir.Protocol != "2025-03-26" || ir.Instructions != "fake instructions" {
					t.Errorf("initialize: %s", init["result"])
				}
				c.request(2, "tools/list", map[string]any{})
				names := toolNames(t, c.next(10*time.Second))
				c.request(3, "ping", nil)
				c.next(5 * time.Second)
				mu.Lock()
				listings[area] = names
				mu.Unlock()
			}(conv, area)
		}
	}
	wg.Wait()
	want := map[string][]string{"files": {"list-folder-files", "search-query"}, "mail": {"send-mail", "list-mail-folders"}, "admin": {"delete-mail-folder", "list-mail-folders"}, "calendar": nil, "contacts": nil}
	for area, names := range want {
		slices.Sort(names)
		if !slices.Equal(listings[area], names) {
			t.Errorf("%s lists %v, want %v", area, listings[area], names)
		}
	}
	if starts := h.lines("starts"); len(starts) != 1 {
		t.Fatalf("native starts: %v", starts)
	}
	files := h.dial("a@example.test", "files")
	if m := files.call(1, "delete-mail-folder", map[string]any{}); errMessage(m) != errUnknownTool.Message {
		t.Fatalf("files area ran an admin tool: %s", m)
	}
	if m := files.call(2, "login", map[string]any{}); errMessage(m) != errUnknownTool.Message {
		t.Fatalf("sign-in tool callable: %s", m)
	}
	if got := text(t, files.call(3, "list-folder-files", map[string]any{"tag": "x"})); got != "a@example.test:list-folder-files:x" {
		t.Fatalf("call: %q", got)
	}
	admin := h.dial("a@example.test", "admin")
	if got := text(t, admin.call("s", "delete-mail-folder", map[string]any{})); got != "a@example.test:delete-mail-folder:" {
		t.Fatalf("admin call: %q", got)
	}
}

// Request ids are the client's own: two clients using the same id and the
// same progress token each get their own answer and progress.
func TestIDsAndProgressStayWithTheirClient(t *testing.T) {
	h := newHarness(t, Options{})
	a := h.dial("a@example.test", "files")
	b := h.dial("a@example.test", "files")
	for _, c := range []*mcpClient{a, b} {
		c.request(1, "tools/list", map[string]any{})
		c.next(10 * time.Second)
	}
	a.request(7, "tools/call", map[string]any{"name": "search-query", "arguments": map[string]any{"tag": "A", "delay": 100}, "_meta": map[string]any{"progressToken": 1}})
	b.request(7, "tools/call", map[string]any{"name": "search-query", "arguments": map[string]any{"tag": "B", "delay": 50}, "_meta": map[string]any{"progressToken": 1}})
	for name, c := range map[string]*mcpClient{"A": a, "B": b} {
		progress := c.next(5 * time.Second)
		var p struct {
			Token   json.RawMessage `json:"progressToken"`
			Message string          `json:"message"`
		}
		json.Unmarshal(progress["params"], &p)
		if string(progress["method"]) != `"notifications/progress"` || string(p.Token) != "1" || p.Message != name {
			t.Fatalf("%s progress: %s", name, progress)
		}
		resp := c.next(5 * time.Second)
		if string(resp["id"]) != "7" || text(t, resp) != "a@example.test:search-query:"+name {
			t.Fatalf("%s answer: %s", name, resp)
		}
	}
}

// Another account's call waits for the running account's call to finish,
// then the child is stopped and reaped before the next one starts: never
// two at once, and the first answer still reaches its client.
func TestAccountSwitchDrainsAndReaps(t *testing.T) {
	h := newHarness(t, Options{})
	a := h.dial("a@example.test", "files")
	b := h.dial("b@example.test", "files")
	a.request(1, "tools/list", map[string]any{})
	a.next(10 * time.Second)
	a.request(2, "tools/call", map[string]any{"name": "search-query", "arguments": map[string]any{"tag": "slow", "delay": 600}})
	time.Sleep(100 * time.Millisecond)
	b.request(1, "tools/call", map[string]any{"name": "search-query", "arguments": map[string]any{"tag": "b"}})
	first := a.next(10 * time.Second)
	if text(t, first) != "a@example.test:search-query:slow" {
		t.Fatalf("a: %s", first)
	}
	if got := text(t, b.next(10*time.Second)); got != "b@example.test:search-query:b" {
		t.Fatalf("b: %q", got)
	}
	// a's next call switches back.
	if got := text(t, a.call(3, "search-query", map[string]any{"tag": "again"})); got != "a@example.test:search-query:again" {
		t.Fatalf("a again: %q", got)
	}
	if starts := h.lines("starts"); !slices.Equal(starts, []string{"a@example.test", "b@example.test", "a@example.test"}) {
		t.Fatalf("starts: %v", starts)
	}
	if overlap := h.lines("overlap"); len(overlap) != 0 {
		t.Fatalf("two native processes ran at once: %v", overlap)
	}
	// A changed binding of the same account (a new level) is a switch too,
	// and its listing is not answered from the old one's.
	h.mu.Lock()
	h.accounts["a@example.test"] = "+level"
	h.mu.Unlock()
	if got := text(t, a.call(4, "search-query", map[string]any{"tag": "level"})); got != "a@example.test+level:search-query:level" {
		t.Fatalf("after level change: %q", got)
	}
}

func TestPauseDrainsAndReapsBeforeNativeCacheWrite(t *testing.T) {
	h := newHarness(t, Options{})
	c := h.dial("a@example.test", "mail")
	c.request(1, "tools/call", map[string]any{"name": "send-mail", "arguments": map[string]any{"tag": "inflight", "delay": 400}})
	deadline := time.Now().Add(5 * time.Second)
	for len(h.lines("calls")) == 0 {
		if time.Now().After(deadline) {
			t.Fatal("call never dispatched")
		}
		time.Sleep(10 * time.Millisecond)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	resume, err := h.srv.Pause(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer resume()
	if got := text(t, c.next(time.Second)); got != "a@example.test:send-mail:inflight" {
		t.Fatal(got)
	}
	if h.srv.Running() != 0 {
		t.Fatal("pause returned before reaping")
	}
	c.request(2, "tools/call", map[string]any{"name": "send-mail", "arguments": map[string]any{"tag": "queued"}})
	c.none(100 * time.Millisecond)
	if len(h.lines("starts")) != 1 || len(h.lines("calls")) != 1 {
		t.Fatal("native work admitted during pause")
	}
	resume()
	if got := text(t, c.next(5*time.Second)); got != "a@example.test:send-mail:queued" {
		t.Fatal(got)
	}
	if len(h.lines("starts")) != 2 || len(h.lines("calls")) != 2 || len(h.lines("overlap")) != 0 {
		t.Fatal("restart overlapped or replayed a call")
	}
}

func TestPauseWithoutEndpointOwnershipRefuses(t *testing.T) {
	s := NewServer(nil, Options{})
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if resume, err := s.Pause(ctx); err == nil {
		resume()
		t.Fatal("non-serving daemon permitted a native cache write")
	}
	if ctx.Err() != nil {
		t.Fatal("pause waited for a scheduler that never started")
	}
}

func TestCancelledPauseReleasesSlot(t *testing.T) {
	h := newHarness(t, Options{})
	c := h.dial("a@example.test", "mail")
	c.request(1, "tools/call", map[string]any{"name": "send-mail", "arguments": map[string]any{"tag": "inflight", "delay": 400}})
	deadline := time.Now().Add(5 * time.Second)
	for len(h.lines("calls")) == 0 {
		if time.Now().After(deadline) {
			t.Fatal("call never dispatched")
		}
		time.Sleep(10 * time.Millisecond)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if resume, err := h.srv.Pause(ctx); err == nil {
		resume()
		t.Fatal("canceled pause succeeded")
	}
	if got := text(t, c.next(5*time.Second)); got != "a@example.test:send-mail:inflight" {
		t.Fatal(got)
	}
	if got := text(t, c.call(2, "send-mail", map[string]any{"tag": "next"})); got != "a@example.test:send-mail:next" {
		t.Fatal(got)
	}
}

// A native crash fails the call as of unknown outcome and never sends it
// again; the next call starts a fresh child.
func TestCrashIsNotReplayed(t *testing.T) {
	h := newHarness(t, Options{})
	c := h.dial("a@example.test", "mail")
	m := c.call(1, "send-mail", map[string]any{"crash": true, "tag": "once"})
	if errMessage(m) != errUpstream.Message {
		t.Fatalf("crash answer: %s", m)
	}
	time.Sleep(200 * time.Millisecond)
	if calls := h.lines("calls"); !slices.Equal(calls, []string{"a@example.test send-mail once"}) {
		t.Fatalf("calls after crash: %v", calls)
	}
	if got := text(t, c.call(2, "send-mail", map[string]any{"tag": "next"})); got != "a@example.test:send-mail:next" {
		t.Fatalf("after restart: %q", got)
	}
	if calls := h.lines("calls"); len(calls) != 2 {
		t.Fatalf("calls: %v", calls)
	}
}

// Cancelling a sent call reaches the native server and nothing is answered;
// cancelling a queued call removes it before it is ever sent. A closed
// connection cancels what it still had in flight.
func TestCancellation(t *testing.T) {
	h := newHarness(t, Options{})
	a := h.dial("a@example.test", "files")
	a.request(1, "tools/list", map[string]any{})
	a.next(10 * time.Second)
	a.request(2, "tools/call", map[string]any{"name": "search-query", "arguments": map[string]any{"hang": true, "tag": "sent"}})
	time.Sleep(100 * time.Millisecond)
	// b's call queues behind a's account switch.
	b := h.dial("b@example.test", "files")
	b.request(9, "tools/call", map[string]any{"name": "search-query", "arguments": map[string]any{"tag": "queued"}})
	time.Sleep(100 * time.Millisecond)
	b.send(map[string]any{"jsonrpc": "2.0", "method": "notifications/cancelled", "params": map[string]any{"requestId": 9}})
	a.send(map[string]any{"jsonrpc": "2.0", "method": "notifications/cancelled", "params": map[string]any{"requestId": 2}})
	a.none(400 * time.Millisecond)
	b.none(400 * time.Millisecond)
	if got := h.lines("cancelled"); len(got) != 1 {
		t.Fatalf("native cancellations: %v", got)
	}
	for _, call := range h.lines("calls") {
		if strings.HasSuffix(call, "queued") {
			t.Fatalf("a cancelled queued call was sent: %v", call)
		}
	}
	a.request(3, "tools/call", map[string]any{"name": "search-query", "arguments": map[string]any{"hang": true, "tag": "orphan"}})
	// Close only once the call is in flight; a queued one is simply dropped.
	for deadline := time.Now().Add(10 * time.Second); !slices.Contains(h.lines("calls"), "a@example.test search-query orphan"); {
		if time.Now().After(deadline) {
			t.Fatalf("orphan never sent: %v", h.lines("calls"))
		}
		time.Sleep(20 * time.Millisecond)
	}
	a.conn.Close()
	deadline := time.Now().Add(5 * time.Second)
	for len(h.lines("cancelled")) < 2 {
		if time.Now().After(deadline) {
			t.Fatalf("disconnect did not cancel: %v calls %v starts %v", h.lines("cancelled"), h.lines("calls"), h.lines("starts"))
		}
		time.Sleep(20 * time.Millisecond)
	}
}

// An account the daemon's records do not hold, an unknown area and a
// malformed hello get nothing from the native server.
func TestSpoofedClaims(t *testing.T) {
	h := newHarness(t, Options{})
	c := h.dial("someone@else.test", "files")
	c.request(1, "initialize", map[string]any{})
	if m := c.next(5 * time.Second); errMessage(m) != errAccount.Message {
		t.Fatalf("unknown account: %s", m)
	}
	c.request(2, "tools/call", map[string]any{"name": "search-query", "arguments": map[string]any{}})
	if m := c.next(5 * time.Second); errMessage(m) != errAccount.Message {
		t.Fatalf("unknown account call: %s", m)
	}
	u := h.dial("a@example.test", "everything")
	u.request(1, "tools/list", map[string]any{})
	if m := u.next(5 * time.Second); m["error"] == nil {
		t.Fatalf("unknown area answered: %s", m)
	}
	conn, err := dialOnce(h.home)
	if err != nil {
		t.Fatal(err)
	}
	conn.Write([]byte(`{"habitat_mcp":1,"provider":"microsoft","account":"a@example.test","area":"files","command":"/bin/sh"}` + "\n"))
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	if n, err := conn.Read(make([]byte, 1)); n != 0 || !errors.Is(err, io.EOF) {
		t.Fatalf("hello with an extra field was not refused: %d %v", n, err)
	}
	if starts := h.lines("starts"); len(starts) != 0 {
		t.Fatalf("a spoofed claim started the native server: %v", starts)
	}
}

// The endpoint is private: its directory 0700 and socket 0600, both the
// person's; a directory another account could write is refused by the
// relay, and a second daemon of the same person does not serve.
func TestEndpointIsPrivateAndSingle(t *testing.T) {
	h := newHarness(t, Options{})
	st, err := os.Stat(filepath.Dir(SocketPath(h.home)))
	if err != nil || st.Mode().Perm() != 0700 {
		t.Fatalf("directory: %v %v", st.Mode(), err)
	}
	st, err = os.Lstat(SocketPath(h.home))
	if err != nil || st.Mode().Perm() != 0600 || st.Mode()&os.ModeSocket == 0 {
		t.Fatalf("socket: %v %v", st.Mode(), err)
	}
	second := NewServer(func(string) (Binding, error) { return Binding{}, errors.New("no") }, Options{})
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()
	if err := second.Serve(ctx, h.home); err != nil {
		t.Fatal(err)
	}
	// The first still serves.
	c := h.dial("a@example.test", "files")
	c.request(1, "ping", nil)
	c.next(5 * time.Second)

	os.Chmod(filepath.Dir(SocketPath(h.home)), 0750)
	if _, err := dialOnce(h.home); !errors.Is(err, errPeer) {
		t.Fatalf("group-readable directory accepted: %v", err)
	}
	os.Chmod(filepath.Dir(SocketPath(h.home)), 0700)
}

// A connection from another kernel UID is dropped before its hello is read.
// The peer UID is the kernel's; an unprivileged test cannot make another
// UID's connection, so the UID read is replaced for this one test.
func TestForeignPeerUIDIsDropped(t *testing.T) {
	h := newHarness(t, Options{})
	foreign := os.Geteuid() + 1
	peerUIDOverride.Store(&foreign)
	defer peerUIDOverride.Store(nil)
	conn, err := net.DialUnix("unix", nil, &net.UnixAddr{Name: SocketPath(h.home), Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.Write([]byte(`{"habitat_mcp":1,"provider":"microsoft","account":"a@example.test","area":"files"}` + "\n" + `{"jsonrpc":"2.0","id":1,"method":"ping"}` + "\n"))
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	if n, err := conn.Read(make([]byte, 64)); n != 0 || err == nil {
		t.Fatalf("foreign UID answered: %d %v", n, err)
	}
}

// With nothing to do the child stops; the next call starts it again.
func TestIdleStopAndRelease(t *testing.T) {
	h := newHarness(t, Options{Idle: 300 * time.Millisecond})
	c := h.dial("a@example.test", "files")
	text(t, c.call(1, "search-query", map[string]any{}))
	if h.srv.Running() == 0 {
		t.Fatal("child not running after a call")
	}
	deadline := time.Now().Add(5 * time.Second)
	for h.srv.Running() != 0 {
		if time.Now().After(deadline) {
			t.Fatal("idle child kept running")
		}
		time.Sleep(20 * time.Millisecond)
	}
	text(t, c.call(2, "search-query", map[string]any{}))
	h.srv.Release("a@example.test")
	if h.srv.Running() != 0 {
		t.Fatal("released account's child still runs")
	}
	if starts := h.lines("starts"); len(starts) != 2 {
		t.Fatalf("starts: %v", starts)
	}
}

// The relay carries a whole session over stdio.
func TestRelay(t *testing.T) {
	h := newHarness(t, Options{})
	inR, inW := io.Pipe()
	outR, outW := io.Pipe()
	done := make(chan error, 1)
	go func() {
		done <- Relay(h.home, Hello{Provider: "microsoft", Account: "a@example.test", Area: "files"}, nil, inR, outW)
	}()
	r := bufio.NewReader(outR)
	io.WriteString(inW, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}`+"\n")
	line, err := readLine(r, 1<<20)
	if err != nil || !strings.Contains(string(line), `"serverInfo"`) {
		t.Fatalf("%s %v", line, err)
	}
	io.WriteString(inW, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list-folder-files","arguments":{"tag":"r"}}}`+"\n")
	line, _ = readLine(r, 1<<20)
	if !strings.Contains(string(line), "list-folder-files:r") {
		t.Fatalf("%s", line)
	}
	inW.Close()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("relay did not end with its stdin")
	}
	if err := Relay(h.home, Hello{Provider: "microsoft", Account: "a@example.test", Area: "nope"}, nil, strings.NewReader(""), io.Discard); err == nil {
		t.Fatal("unknown area relayed")
	}
}

// Shutdown stops the child and fails what waited.
func TestShutdownReaps(t *testing.T) {
	h := newHarness(t, Options{})
	c := h.dial("a@example.test", "files")
	text(t, c.call(1, "search-query", map[string]any{}))
	pid := h.srv.Running()
	h.close()
	if err := syscall.Kill(pid, 0); err == nil {
		t.Fatalf("native process %d survived shutdown", pid)
	}
	_ = strconv.Itoa
}

// An answer past the line bound fails its call as of unknown outcome, the
// child is stopped and reaped even though it is stuck writing, and the next
// call gets a fresh child.
func TestOversizedAnswerDoesNotWedgeTheSlot(t *testing.T) {
	h := newHarness(t, Options{MaxLine: 256 << 10})
	c := h.dial("a@example.test", "files")
	if m := c.call(1, "search-query", map[string]any{"huge": 1 << 20}); errMessage(m) != errUpstream.Message {
		t.Fatalf("oversized answer: %s", m)
	}
	if got := text(t, c.call(2, "search-query", map[string]any{"tag": "after"})); got != "a@example.test:search-query:after" {
		t.Fatalf("after: %q", got)
	}
	if overlap := h.lines("overlap"); len(overlap) != 0 {
		t.Fatalf("overlap: %v", overlap)
	}
}

// A child that starts while the server shuts down is stopped, not awaited.
func TestShutdownStopsAStartingChild(t *testing.T) {
	release := make(chan struct{})
	var once sync.Once
	opt := Options{started: func(Binding) { once.Do(func() { <-release }) }}
	h := newHarness(t, opt)
	c := h.dial("a@example.test", "files")
	c.request(1, "tools/list", map[string]any{})
	for deadline := time.Now().Add(5 * time.Second); len(h.lines("starts")) == 0; {
		if time.Now().After(deadline) {
			t.Fatal("never started")
		}
		time.Sleep(10 * time.Millisecond)
	}
	h.stop()
	time.Sleep(50 * time.Millisecond)
	close(release)
	select {
	case <-h.done:
	case <-time.After(10 * time.Second):
		t.Fatal("shutdown waited forever on a starting child")
	}
	lock, _ := os.OpenFile(filepath.Join(h.dir, "running.lock"), os.O_RDWR, 0600)
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		t.Fatal("native process survived shutdown")
	}
}

// A call that waited while its account's binding changed is failed, never
// sent to the old child; removal fails what was queued for the account.
func TestQueuedCallsDoNotOutliveTheirBinding(t *testing.T) {
	h := newHarness(t, Options{})
	a := h.dial("a@example.test", "files")
	b := h.dial("b@example.test", "files")
	a.request(1, "tools/list", map[string]any{})
	a.next(10 * time.Second)
	a.request(2, "tools/call", map[string]any{"name": "search-query", "arguments": map[string]any{"delay": 400, "tag": "running"}})
	time.Sleep(100 * time.Millisecond)
	b.request(1, "tools/call", map[string]any{"name": "search-query", "arguments": map[string]any{"tag": "b"}})
	time.Sleep(50 * time.Millisecond)
	a.request(3, "tools/call", map[string]any{"name": "search-query", "arguments": map[string]any{"tag": "queued"}})
	time.Sleep(50 * time.Millisecond)
	h.mu.Lock()
	h.accounts["a@example.test"] = "+downgraded"
	h.mu.Unlock()
	b.send(map[string]any{"jsonrpc": "2.0", "method": "notifications/cancelled", "params": map[string]any{"requestId": 1}})
	got := map[string]string{}
	for i := 0; i < 2; i++ {
		m := a.next(10 * time.Second)
		if m["error"] != nil {
			got[string(m["id"])] = errMessage(m)
		} else {
			got[string(m["id"])] = text(t, m)
		}
	}
	if got["2"] != "a@example.test:search-query:running" || got["3"] != errChanged.Message {
		t.Fatalf("answers: %v", got)
	}
	for _, call := range h.lines("calls") {
		if strings.HasSuffix(call, "queued") {
			t.Fatalf("stale call sent: %v", h.lines("calls"))
		}
	}
}

// A request of a client that is gone is never dispatched.
func TestGoneClientIsNotAdmitted(t *testing.T) {
	h := newHarness(t, Options{})
	c := h.dial("a@example.test", "files")
	text(t, c.call(1, "search-query", map[string]any{}))
	b, _ := h.srv.resolve("a@example.test")
	gone := &client{s: h.srv, closed: true, out: make(chan []byte, 1), outstanding: map[string]bool{"9": true}, withdrawn: map[string]bool{}}
	h.srv.submit(&call{c: gone, id: json.RawMessage("9"), method: "tools/call", params: json.RawMessage(`{"name":"search-query","arguments":{"tag":"ghost"}}`), binding: b})
	time.Sleep(200 * time.Millisecond)
	for _, call := range h.lines("calls") {
		if strings.HasSuffix(call, "ghost") {
			t.Fatal("a gone client's call was sent")
		}
	}
	if len(gone.outstanding) != 0 {
		t.Fatal("refused request kept its slot")
	}
}
