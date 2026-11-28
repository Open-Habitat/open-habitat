//go:build linux

package browserhost

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/wsframe"
)

// fakeChrome reads what the host writes to Chrome's pipe and lets a test
// answer as Chrome would.
type fakeChrome struct {
	t    *testing.T
	mux  *cdpMux
	got  chan map[string]any
	pipe *io.PipeWriter
}

func newFakeChrome(t *testing.T) *fakeChrome {
	r, w := io.Pipe()
	c := &fakeChrome{t: t, got: make(chan map[string]any, 256), pipe: w}
	c.mux = newCDPMux(w, slog.New(slog.NewTextHandler(io.Discard, nil)), time.Now)
	go func() {
		br := bufio.NewReader(r)
		for {
			msg, err := br.ReadBytes(0)
			if err != nil {
				return
			}
			var m map[string]any
			if json.Unmarshal(msg[:len(msg)-1], &m) != nil {
				t.Errorf("host wrote invalid JSON: %q", msg)
				return
			}
			c.got <- m
		}
	}()
	t.Cleanup(func() { r.Close() })
	return c
}

// next is the host's next message to Chrome.
func (c *fakeChrome) next() map[string]any {
	c.t.Helper()
	select {
	case m := <-c.got:
		return m
	case <-time.After(3 * time.Second):
		c.t.Fatal("no message to Chrome")
		return nil
	}
}

// expect skips messages until one with the method arrives.
func (c *fakeChrome) expect(method string) map[string]any {
	c.t.Helper()
	deadline := time.After(3 * time.Second)
	for {
		select {
		case m := <-c.got:
			if m["method"] == method {
				return m
			}
		case <-deadline:
			c.t.Fatalf("Chrome never got %s", method)
			return nil
		}
	}
}

func (c *fakeChrome) send(v any) {
	b, _ := json.Marshal(v)
	c.mux.fromChrome(b)
}

// agent is the client end of one agent's WebSocket.
type agent struct {
	t    *testing.T
	conn net.Conn
	a    *agentConn
	r    *bufio.Reader
	mu   sync.Mutex
}

func connectAgent(t *testing.T, c *fakeChrome) *agent {
	t.Helper()
	server, client := net.Pipe()
	ws := &wsConn{c: server, r: bufio.NewReader(server)}
	a, err := c.mux.connect(ws)
	if err != nil {
		t.Fatal(err)
	}
	ag := &agent{t: t, conn: client, a: a, r: bufio.NewReader(client)}
	go func() {
		for {
			msg, err := ws.next()
			if err != nil {
				a.disconnect(1000, "")
				return
			}
			if c.mux.fromAgent(a, msg) != nil {
				a.disconnect(1008, "")
				return
			}
		}
	}()
	t.Cleanup(func() { client.Close() })
	return ag
}

func (a *agent) send(v any) {
	a.t.Helper()
	b, _ := json.Marshal(v)
	a.mu.Lock()
	defer a.mu.Unlock()
	if _, err := a.conn.Write(wsframe.AppendFrame(nil, wsframe.OpText, b, true)); err != nil {
		a.t.Fatal(err)
	}
}

func (a *agent) recv() map[string]any {
	a.t.Helper()
	_ = a.conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	f, err := wsframe.ReadFrame(a.r, 1<<20, false)
	if err != nil {
		a.t.Fatalf("agent read: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(f.Payload, &m); err != nil {
		a.t.Fatal(err)
	}
	return m
}

// silent fails if the agent receives anything within a short while.
func (a *agent) silent() {
	a.t.Helper()
	_ = a.conn.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	f, err := wsframe.ReadFrame(a.r, 1<<20, false)
	if err == nil {
		a.t.Fatalf("agent got %s", f.Payload)
	}
}

func TestAgentRepliesKeepTheAgentsOwnIDs(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	ag.send(map[string]any{"id": 7, "method": "Browser.getVersion"})
	m := c.next()
	if m["method"] != "Browser.getVersion" {
		t.Fatalf("Chrome got %v", m)
	}
	hostID := m["id"]
	c.send(map[string]any{"id": hostID, "result": map[string]any{"product": "Chrome/157"}})
	reply := ag.recv()
	if reply["id"] != float64(7) || reply["result"].(map[string]any)["product"] != "Chrome/157" {
		t.Fatalf("agent got %v", reply)
	}
}

func TestHostsOwnSessionsNeverReachTheAgent(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	target := strings.Repeat("A", 32)
	done := make(chan string, 1)
	go func() {
		s, err := c.mux.hostSessionFor(context.Background(), target)
		if err != nil {
			t.Error(err)
		}
		done <- s
	}()
	attach := c.expect("Target.attachToTarget")
	// Chrome announces the attachment before it answers the command.
	c.send(map[string]any{"method": "Target.attachedToTarget", "params": map[string]any{"sessionId": "HOST1", "targetInfo": map[string]any{"targetId": target, "type": "page"}, "waitingForDebugger": false}})
	c.send(map[string]any{"id": attach["id"], "result": map[string]any{"sessionId": "HOST1"}})
	if s := <-done; s != "HOST1" {
		t.Fatalf("host session %q", s)
	}
	// An event of the host's session and its detachment stay in the host.
	c.send(map[string]any{"method": "Page.frameNavigated", "sessionId": "HOST1", "params": map[string]any{}})
	c.send(map[string]any{"method": "Target.detachedFromTarget", "params": map[string]any{"sessionId": "HOST1"}})
	ag.silent()
	// A browser-level event the agent asked for still arrives.
	c.send(map[string]any{"method": "Target.targetCreated", "params": map[string]any{"targetInfo": map[string]any{"targetId": target}}})
	if m := ag.recv(); m["method"] != "Target.targetCreated" {
		t.Fatalf("agent got %v", m)
	}
}

func TestAnAgentLeavingUndoesWhatItLeftInChrome(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	ag.send(map[string]any{"id": 1, "method": "Target.attachToTarget", "params": map[string]any{"targetId": strings.Repeat("B", 32), "flatten": true}})
	set := c.expect("Target.attachToTarget")
	c.send(map[string]any{"method": "Target.attachedToTarget", "params": map[string]any{"sessionId": "S1", "targetInfo": map[string]any{"targetId": strings.Repeat("B", 32), "type": "page"}}})
	c.send(map[string]any{"id": set["id"], "result": map[string]any{"sessionId": "S1"}})
	ag.recv()
	ag.recv()
	// A second agent is refused while this one drives.
	if _, err := c.mux.connect(&wsConn{}); err != errAgentBusy {
		t.Fatalf("second agent: %v", err)
	}
	ag.conn.Close()
	seen := map[string]map[string]any{}
	deadline := time.After(3 * time.Second)
	for len(seen) < 4 {
		select {
		case m := <-c.got:
			seen[m["method"].(string)] = m
		case <-deadline:
			t.Fatalf("cleanup sent only %v", seen)
		}
	}
	if p := seen["Target.detachFromTarget"]["params"].(map[string]any); p["sessionId"] != "S1" {
		t.Fatalf("detached %v", p)
	}
	if p := seen["Target.setAutoAttach"]["params"].(map[string]any); p["autoAttach"] != false || p["waitForDebuggerOnStart"] != false {
		t.Fatalf("auto-attach left %v", p)
	}
	if p := seen["Target.setDiscoverTargets"]["params"].(map[string]any); p["discover"] != false {
		t.Fatalf("discovery left %v", p)
	}
	if _, ok := seen["Browser.setDownloadBehavior"]; !ok {
		t.Fatal("downloads not reset")
	}
	// The next agent is welcome.
	connectAgent(t, c)
}

func TestPersonsControlHoldsTheAgentUntilGivenBack(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	c.mux.setRequest(strings.Repeat("C", 32), "code please")
	c.mux.setControl(true)
	ag.send(map[string]any{"id": 1, "method": PageActionMethod, "params": map[string]any{"action": PageText}})
	ag.send(map[string]any{"id": 2, "method": "Input.dispatchMouseEvent", "params": map[string]any{"type": "mousePressed", "button": "left", "x": 1, "y": 1}})
	select {
	case m := <-c.got:
		t.Fatalf("Chrome got %v while the person drives", m)
	case <-time.After(200 * time.Millisecond):
	}
	// Events still reach the waiting agent.
	c.send(map[string]any{"method": "Target.targetInfoChanged", "params": map[string]any{}})
	if m := ag.recv(); m["method"] != "Target.targetInfoChanged" {
		t.Fatalf("agent got %v", m)
	}
	c.mux.setControl(false)
	// What waited is answered, in order, and never reaches the page the
	// person may have changed.
	for _, id := range []float64{1, 2} {
		m := ag.recv()
		e, _ := m["error"].(map[string]any)
		if m["id"] != id || e["message"] != PersonTookControl {
			t.Fatalf("held command %v answered %v", id, m)
		}
	}
	select {
	case m := <-c.got:
		t.Fatalf("Chrome got held command %v", m)
	case <-time.After(200 * time.Millisecond):
	}
	// The agent carries on afterwards.
	ag.send(map[string]any{"id": 3, "method": "Page.getFrameTree"})
	if m := c.next(); m["method"] != "Page.getFrameTree" {
		t.Fatalf("after control: %v", m)
	}
	c.mux.mu.Lock()
	defer c.mux.mu.Unlock()
	if c.mux.request != nil {
		t.Fatal("giving control back left the request")
	}
}

func TestTheAgentCannotGrantItselfTheClipboard(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	refused := []map[string]any{
		{"id": 1, "method": "Browser.grantPermissions", "params": map[string]any{"permissions": []string{"geolocation", "clipboardReadWrite"}}},
		{"id": 2, "method": "Browser.grantPermissions", "params": map[string]any{"permissions": []string{"clipboardSanitizedWrite"}, "origin": "https://a.example"}},
		{"id": 3, "method": "Browser.setPermission", "params": map[string]any{"permission": map[string]any{"name": "clipboard-read"}, "setting": "granted"}},
		{"id": 4, "method": "Browser.setPermission", "sessionId": "S9", "params": map[string]any{"permission": map[string]any{"name": " Clipboard-Write"}, "setting": "granted"}},
		{"id": 5, "method": "Browser.grantPermissions"},
		{"id": 8, "method": "Target.sendMessageToTarget", "params": map[string]any{"sessionId": "S1", "message": `{"id":1,"method":"Browser.grantPermissions","params":{"permissions":["clipboardReadWrite"]}}`}},
	}
	for _, cmd := range refused {
		ag.send(cmd)
		m := ag.recv()
		if m["id"] != float64(cmd["id"].(int)) || m["error"] == nil || m["sessionId"] != cmd["sessionId"] {
			t.Fatalf("%v answered %v", cmd, m)
		}
	}
	// Other permissions pass, so the agent can still answer a site's
	// ordinary prompt the person asked it to.
	ag.send(map[string]any{"id": 6, "method": "Browser.grantPermissions", "params": map[string]any{"permissions": []string{"geolocation"}}})
	if m := c.next(); m["method"] != "Browser.grantPermissions" {
		t.Fatalf("Chrome got %v", m)
	}
	ag.send(map[string]any{"id": 7, "method": "Browser.setPermission", "params": map[string]any{"permission": map[string]any{"name": "notifications"}, "setting": "denied"}})
	if m := c.next(); m["method"] != "Browser.setPermission" {
		t.Fatalf("Chrome got %v", m)
	}
}

func TestTooMuchHeldDisconnectsTheAgent(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	c.mux.setControl(true)
	// The agent reads its socket, so the host's closing frame is not held up.
	go io.Copy(io.Discard, ag.conn)
	for i := 0; i < heldMessages+2; i++ {
		b, _ := json.Marshal(map[string]any{"id": i, "method": "Page.getFrameTree"})
		if _, err := ag.conn.Write(wsframe.AppendFrame(nil, wsframe.OpText, b, true)); err != nil {
			break
		}
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		c.mux.mu.Lock()
		gone := c.mux.agent == nil
		c.mux.mu.Unlock()
		if gone {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("agent kept after holding more than the limit")
}

func TestPointerIsObservedOnlyInPages(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	page, frame := strings.Repeat("D", 32), strings.Repeat("E", 32)
	c.send(map[string]any{"method": "Target.attachedToTarget", "params": map[string]any{"sessionId": "P", "targetInfo": map[string]any{"targetId": page, "type": "page"}}})
	c.send(map[string]any{"method": "Target.attachedToTarget", "params": map[string]any{"sessionId": "F", "targetInfo": map[string]any{"targetId": frame, "type": "iframe"}}})
	ag.recv()
	ag.recv()
	ag.send(map[string]any{"id": 1, "sessionId": "P", "method": "Input.dispatchMouseEvent", "params": map[string]any{"type": "mousePressed", "button": "left", "x": 320, "y": 200}})
	c.expect("Input.dispatchMouseEvent")
	ag.send(map[string]any{"id": 2, "sessionId": "F", "method": PageActionMethod, "params": map[string]any{"action": PageMetadata}})
	c.expect("Runtime.evaluate")
	h := &host{mux: c.mux, images: map[string]*image{}, metrics: map[string]viewport{page: {640, 400}}, failed: map[string]time.Time{}}
	h.windows, h.listed = []window{{id: page, title: "Kirjaudu", url: "https://login.example.invalid/a?token=secret"}}, time.Now()
	st := h.status(context.Background())
	if st.Pointer == nil || st.Pointer.X != 0.5 || st.Pointer.Y != 0.5 || len(st.Pointer.Clicks) != 1 {
		t.Fatalf("pointer %+v", st.Pointer)
	}
	if len(st.Windows) != 1 || !st.Windows[0].Agent || st.Windows[0].Origin != "https://login.example.invalid" {
		t.Fatalf("windows %+v", st.Windows)
	}
}

func TestRequestTextStaysShortPrintableAndOnOneLine(t *testing.T) {
	for _, bad := range []string{"", "   ", strings.Repeat("a", 301), "\xff"} {
		if _, ok := cleanText(bad); ok {
			t.Errorf("accepted %q", bad)
		}
	}
	got, ok := cleanText("Syötä\nkoodi‮  \u0007nyt")
	if !ok || got != "Syötä koodi nyt" {
		t.Fatalf("cleaned %q %v", got, ok)
	}
}

func TestCookieIsAFreshWildcardEntryOnlyThePersonReads(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "xauthority")
	if err := writeCookie(path); err != nil {
		t.Fatal(err)
	}
	first, _ := os.ReadFile(path)
	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("mode %v", info.Mode())
	}
	// family FamilyWild, empty address and display, the name and 16 bytes.
	if len(first) != 2+2+2+2+18+2+16 || binary.BigEndian.Uint16(first) != 0xffff || !bytes.Contains(first, []byte("MIT-MAGIC-COOKIE-1")) {
		t.Fatalf("cookie %x", first)
	}
	if err := writeCookie(path); err != nil {
		t.Fatal(err)
	}
	second, _ := os.ReadFile(path)
	if bytes.Equal(first, second) {
		t.Fatal("the cookie did not change")
	}
}

func TestAnAgentsAttachmentDuringTheHostsOwnIsNotTaken(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	target := strings.Repeat("F", 32)
	done := make(chan string, 1)
	go func() {
		s, _ := c.mux.hostSessionFor(context.Background(), target)
		done <- s
	}()
	attach := c.expect("Target.attachToTarget")
	// The agent's auto-attach and the host's attachment to the same page
	// arrive together, before the host's reply.
	c.send(map[string]any{"method": "Target.attachedToTarget", "params": map[string]any{"sessionId": "AGENT1", "targetInfo": map[string]any{"targetId": target, "type": "page"}, "waitingForDebugger": true}})
	c.send(map[string]any{"method": "Target.attachedToTarget", "params": map[string]any{"sessionId": "HOST2", "targetInfo": map[string]any{"targetId": target, "type": "page"}}})
	c.send(map[string]any{"id": attach["id"], "result": map[string]any{"sessionId": "HOST2"}})
	if s := <-done; s != "HOST2" {
		t.Fatalf("host session %q", s)
	}
	m := ag.recv()
	if m["method"] != "Target.attachedToTarget" || m["params"].(map[string]any)["sessionId"] != "AGENT1" {
		t.Fatalf("agent got %v", m)
	}
	ag.silent()
	// A host reply before its event keeps the session the host's.
	go func() {
		s, _ := c.mux.hostSessionFor(context.Background(), strings.Repeat("9", 32))
		done <- s
	}()
	attach = c.expect("Target.attachToTarget")
	c.send(map[string]any{"id": attach["id"], "result": map[string]any{"sessionId": "HOST3"}})
	<-done
	c.send(map[string]any{"method": "Target.attachedToTarget", "params": map[string]any{"sessionId": "HOST3", "targetInfo": map[string]any{"targetId": strings.Repeat("9", 32), "type": "page"}}})
	ag.silent()
}

func TestTheNextAgentsCommandsComeAfterTheLastOnesCleanup(t *testing.T) {
	c := newFakeChrome(t)
	first := connectAgent(t, c)
	first.conn.Close()
	for deadline := time.Now().Add(3 * time.Second); ; time.Sleep(time.Millisecond) {
		c.mux.mu.Lock()
		left := c.mux.agent != first.a
		c.mux.mu.Unlock()
		if left || time.Now().After(deadline) {
			break
		}
	}
	second := connectAgent(t, c)
	second.send(map[string]any{"id": 1, "method": "Target.getTargets"})
	var order []string
	for len(order) == 0 || order[len(order)-1] != "Target.getTargets" {
		order = append(order, c.next()["method"].(string))
	}
	if len(order) < 4 {
		t.Fatalf("the second agent's command came before the cleanup: %v", order)
	}
}
