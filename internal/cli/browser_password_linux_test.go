//go:build linux

package cli

import (
	"bufio"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/browserhost"
)

// Opt-in native evidence that the agent cannot read a password the person
// typed: the production host on a real Xvnc display with headful Chrome,
// keystrokes sent the way the person's viewer sends them (RFB key events on
// vnc.sock), and the CLI plus a raw CDP client trying to read the value
// back, including a listener installed before the person types, a type
// flip and FormData. The site itself records what reached the field, which
// also proves the person's own sign-in still works.
func TestAgentCannotReadThePersonsPassword(t *testing.T) {
	chrome, xvnc := os.Getenv("OH_BROWSER_ACTION_CHROME"), os.Getenv("OH_BROWSER_ACTION_XVNC")
	if chrome == "" || xvnc == "" {
		t.Skip("set OH_BROWSER_ACTION_CHROME and OH_BROWSER_ACTION_XVNC (TigerVNC's Xvnc) for the real display")
	}
	const secret = "synthetic7secret42"
	var mu sync.Mutex
	typed := ""
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			io.WriteString(w, `<!doctype html><title>Sign in</title><style>#pw{position:fixed;left:0;right:0;bottom:0;height:50vh;width:100%}</style><form action="/signed-in" method="post"><input name="user" value="person@example.invalid"><input id="pw" name="pw" type="password" autocomplete="current-password" autofocus><button type="button" id="show" onclick="pw.type=pw.type==='password'?'text':'password'">Show</button></form><p>Synthetic sign-in</p>
<script>const pw=document.querySelector('#pw');pw.addEventListener('input',()=>fetch('/typed',{method:'POST',body:pw.value}));onload=()=>pw.focus();</script>`)
		case "/typed":
			b, _ := io.ReadAll(r.Body)
			mu.Lock()
			typed = string(b)
			mu.Unlock()
		default:
			w.WriteHeader(404)
		}
	}))
	defer server.Close()

	root := t.TempDir()
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	dir := filepath.Join(root, "host")
	done := make(chan error, 1)
	go func() {
		done <- browserhost.Run(ctx, browserhost.Config{Dir: dir, Xvnc: xvnc, Chrome: chrome, Profile: filepath.Join(root, "profile"), Cache: filepath.Join(root, "cache"), Idle: time.Hour, Width: 1280, Height: 800, Env: os.Environ(), Log: slog.New(slog.NewTextHandler(io.Discard, nil))})
	}()
	defer func() {
		cancel()
		select {
		case <-done:
		case <-time.After(15 * time.Second):
			t.Error("browser did not stop")
		}
	}()
	st := browserConnectionInfo{Enabled: true, State: "running", Control: "agent", Socket: filepath.Join(dir, browserhost.CDPSocket), Path: "/devtools/browser", Downloads: filepath.Join(root, "profile", "Downloads")}
	for {
		if _, err := os.Stat(st.Socket); err == nil {
			break
		}
		select {
		case err := <-done:
			done <- err
			t.Fatal(err)
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		case <-time.After(20 * time.Millisecond):
		}
	}

	// Everything the agent receives, to check the secret never appears.
	var seen strings.Builder
	act := func(a browserAction) (map[string]any, error) {
		t.Helper()
		if a.timeout == 0 {
			a.timeout = 15 * time.Second
		}
		out, err := executeBrowserAction(a, st)
		b, _ := json.Marshal(out)
		seen.Write(b)
		if err != nil {
			seen.WriteString(err.Error())
			return nil, err
		}
		var env struct {
			Data struct {
				Result map[string]any `json:"result"`
			}
		}
		_ = json.Unmarshal(b, &env)
		return env.Data.Result, nil
	}
	refused := func(a browserAction) {
		t.Helper()
		_, err := act(a)
		var cli *cliError
		if !errors.As(err, &cli) || cli.code != "browser_action_refused" {
			t.Fatalf("%s %s: want refusal, got %v", a.verb, a.selector, err)
		}
	}
	nav, err := act(browserAction{verb: "goto", value: server.URL + "/"})
	if err != nil {
		t.Fatal(err)
	}
	tab := nav["tab"].(string)

	// A raw DevTools client on the same socket, as an agent could write.
	raw := func(attempts []rawAttempt) {
		t.Helper()
		c, err := dialBrowserCDP(ctx, st.Socket, st.Path)
		for errors.Is(err, errBrowserCDPBusy) {
			// The previous command's cleanup still holds the one slot.
			time.Sleep(50 * time.Millisecond)
			c, err = dialBrowserCDP(ctx, st.Socket, st.Path)
		}
		if err != nil {
			t.Fatal(err)
		}
		defer c.conn.Close()
		var attached struct {
			Session string `json:"sessionId"`
		}
		if err := c.call("Target.attachToTarget", map[string]any{"targetId": tab, "flatten": true}, &attached); err != nil {
			t.Fatal(err)
		}
		c.session = attached.Session
		for _, at := range attempts {
			var out json.RawMessage
			err := c.call(at.method, at.params, &out)
			seen.Write(out)
			var rejected *browserCDPRejected
			if !errors.As(err, &rejected) {
				t.Errorf("%s (%s) was not refused: %v %s", at.method, at.why, err, out)
			}
		}
	}
	listener := `document.addEventListener('keydown',e=>{window.__k=(window.__k||'')+e.key},true);'installed'`
	raw([]rawAttempt{
		{"pre-installed listener", "Runtime.evaluate", map[string]any{"expression": listener}},
		{"listener for the next document", "Page.addScriptToEvaluateOnNewDocument", map[string]any{"source": listener}},
		{"page-to-agent binding", "Runtime.addBinding", map[string]any{"name": "leak"}},
		{"sign-in request body", "Network.enable", map[string]any{}},
		{"request interception", "Fetch.enable", map[string]any{}},
		{"breakpoint code", "Debugger.enable", map[string]any{}},
		{"javascript: address", "Page.navigate", map[string]any{"url": "javascript:" + listener}},
		{"data: page", "Target.createTarget", map[string]any{"url": "data:text/html,<input type=password>"}},
		{"auto-attach to new pages", "Target.setAutoAttach", map[string]any{"autoAttach": true, "waitForDebuggerOnStart": false, "flatten": true}},
	})

	// The person takes control of the window and types the password.
	if resp, err := browserhost.ControlClient(dir).Post("http://browser"+browserhost.ControlPath, "application/json", strings.NewReader(`{"control":"person","window":"`+tab+`"}`)); err != nil || resp.StatusCode != 200 {
		t.Fatalf("person control: %v %v", resp, err)
	}
	vnc := dialRFB(t, filepath.Join(dir, browserhost.VNCSocket))
	// The person clicks into the field, which fills the lower half of the
	// page, and types.
	vnc.pointer(640, 650, 0)
	vnc.pointer(640, 650, 1)
	vnc.pointer(640, 650, 0)
	for _, r := range secret {
		vnc.key(uint32(r))
	}
	for deadline := time.Now().Add(20 * time.Second); ; time.Sleep(50 * time.Millisecond) {
		mu.Lock()
		got := typed
		mu.Unlock()
		if got == secret {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("the person's keystrokes did not reach the password field: %q", got)
		}
	}
	vnc.conn.Close()
	if resp, err := browserhost.ControlClient(dir).Post("http://browser"+browserhost.ControlPath, "application/json", strings.NewReader(`{"control":"agent"}`)); err != nil || resp.StatusCode != 200 {
		t.Fatalf("agent control: %v %v", resp, err)
	}

	raw([]rawAttempt{
		{"type flip", "Runtime.evaluate", map[string]any{"expression": "(()=>{const p=document.querySelector('#pw');p.type='text';return p.value})()", "returnByValue": true}},
		{"FormData", "Runtime.evaluate", map[string]any{"expression": "new FormData(document.forms[0]).get('pw')", "returnByValue": true}},
		{"what the listener collected", "Runtime.evaluate", map[string]any{"expression": "window.__k", "returnByValue": true}},
		{"function on a node", "Runtime.callFunctionOn", map[string]any{"functionDeclaration": "function(){return this.value}", "objectId": "1"}},
		{"DOM snapshot input values", "DOMSnapshot.captureSnapshot", map[string]any{"computedStyles": []string{}}},
		{"accessibility tree", "Accessibility.getFullAXTree", map[string]any{}},
		{"select and copy", "Input.dispatchKeyEvent", map[string]any{"type": "keyDown", "key": "a", "modifiers": 2, "commands": []string{"selectAll", "copy"}}},
		{"host page action with own script", browserhost.PageActionMethod, map[string]any{"action": "eval", "value": "document.querySelector('#pw').value"}},
	})
	if _, err := agentBrowserAction([]string{"eval", "document.querySelector('#pw').value", "--tab", tab}); err == nil {
		t.Fatal("the CLI still evaluates agent JavaScript")
	}
	text, err := act(browserAction{verb: "text", tab: tab})
	if err != nil || !strings.Contains(pageText(text), "Synthetic sign-in") {
		t.Fatalf("text: %v %v", text, err)
	}
	if _, err := act(browserAction{verb: "links", tab: tab}); err != nil {
		t.Fatal(err)
	}
	refused(browserAction{verb: "type", tab: tab, selector: "#pw", value: "overwrite"})
	// A masked field does not stop screenshots; the site's own "show
	// password" control, clicked without any script, does.
	if _, err := act(browserAction{verb: "screenshot", tab: tab, name: "masked.png"}); err != nil {
		t.Fatalf("screenshot of a masked password refused: %v", err)
	}
	if _, err := act(browserAction{verb: "click", tab: tab, selector: "#show"}); err != nil {
		t.Fatal(err)
	}
	refused(browserAction{verb: "screenshot", tab: tab, name: "revealed.png"})
	if _, err := os.Stat(filepath.Join(st.Downloads, "revealed.png")); err == nil {
		t.Fatal("a screenshot of the revealed password was saved")
	}
	mu.Lock()
	still := typed
	mu.Unlock()
	if still != secret {
		t.Fatalf("the person's password changed: %q", still)
	}
	if strings.Contains(seen.String(), secret) {
		t.Fatal("the agent received the person's password")
	}
	t.Log("person typed through the display; listener, script, type flip, FormData, DOM snapshot, accessibility, keyboard, eval, text, links, type and revealed screenshot gave the agent nothing")
}

type rawAttempt struct {
	why, method string
	params      map[string]any
}

// rfb is a minimal RFB 3.8 viewer: what the person's viewer sends through
// the daemon's relay to vnc.sock.
type rfb struct {
	t    *testing.T
	conn net.Conn
}

func dialRFB(t *testing.T, socket string) *rfb {
	t.Helper()
	conn, err := net.Dial("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
	r := bufio.NewReader(conn)
	version := make([]byte, 12)
	if _, err := io.ReadFull(r, version); err != nil || !strings.HasPrefix(string(version), "RFB 003.") {
		t.Fatalf("rfb version %q %v", version, err)
	}
	conn.Write([]byte("RFB 003.008\n"))
	n, _ := r.ReadByte()
	types := make([]byte, n)
	io.ReadFull(r, types)
	if !strings.ContainsRune(string(types), 1) {
		t.Fatalf("no None security: %v", types)
	}
	conn.Write([]byte{1})
	var result uint32
	if binary.Read(r, binary.BigEndian, &result) != nil || result != 0 {
		t.Fatalf("rfb security result %d", result)
	}
	conn.Write([]byte{1}) // shared
	head := make([]byte, 24)
	if _, err := io.ReadFull(r, head); err != nil {
		t.Fatal(err)
	}
	io.CopyN(io.Discard, r, int64(binary.BigEndian.Uint32(head[20:])))
	_ = conn.SetDeadline(time.Time{})
	// As a viewer does: raw encoding and one full update request. TigerVNC
	// leaves input waiting until the viewer has asked for the picture; its
	// updates are drained unread.
	conn.Write([]byte{2, 0, 0, 1, 0, 0, 0, 0})
	conn.Write([]byte{3, 0, 0, 0, 0, 0, 0x05, 0x00, 0x03, 0x20})
	go io.Copy(io.Discard, r)
	time.Sleep(500 * time.Millisecond)
	return &rfb{t: t, conn: conn}
}

func (v *rfb) pointer(x, y uint16, buttons byte) {
	msg := []byte{5, buttons, 0, 0, 0, 0}
	binary.BigEndian.PutUint16(msg[2:], x)
	binary.BigEndian.PutUint16(msg[4:], y)
	if _, err := v.conn.Write(msg); err != nil {
		v.t.Fatal(err)
	}
	time.Sleep(100 * time.Millisecond)
}

func (v *rfb) key(keysym uint32) {
	for _, down := range []byte{1, 0} {
		msg := []byte{4, down, 0, 0, 0, 0, 0, 0}
		binary.BigEndian.PutUint32(msg[4:], keysym)
		if _, err := v.conn.Write(msg); err != nil {
			v.t.Fatal(err)
		}
		time.Sleep(20 * time.Millisecond)
	}
}
