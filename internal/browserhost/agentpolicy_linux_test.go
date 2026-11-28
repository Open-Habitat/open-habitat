//go:build linux

package browserhost

import (
	"encoding/json"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/wsframe"
)

// Each of these would let the agent run its own script in a page, read the
// DOM or the network, or press keys: with any of them it could read a
// password the person typed (a listener installed before they type, a type
// flip, FormData, the sign-in request's body). None may reach Chrome, also
// not while the person drives and the agent's commands are otherwise held.
func TestTheAgentRunsNoScriptOfItsOwn(t *testing.T) {
	listener := `document.addEventListener('keydown',e=>window.__k=(window.__k||'')+e.key,true)`
	refused := []map[string]any{
		{"method": "Runtime.evaluate", "params": map[string]any{"expression": "document.querySelector('input[type=password]').type='text'"}},
		{"method": "Runtime.evaluate", "params": map[string]any{"expression": "new FormData(document.forms[0]).get('password')"}},
		{"method": "Runtime.evaluate", "params": map[string]any{"expression": listener}},
		{"method": "Runtime.callFunctionOn", "params": map[string]any{"functionDeclaration": "function(){return this.value}", "objectId": "1"}},
		{"method": "Runtime.compileScript", "params": map[string]any{"expression": listener, "sourceURL": "", "persistScript": true}},
		{"method": "Runtime.runScript", "params": map[string]any{"scriptId": "1"}},
		{"method": "Runtime.addBinding", "params": map[string]any{"name": "leak"}},
		{"method": "Runtime.getProperties", "params": map[string]any{"objectId": "1"}},
		{"method": "Page.addScriptToEvaluateOnNewDocument", "params": map[string]any{"source": listener}},
		{"method": "Page.setDocumentContent", "params": map[string]any{"frameId": "F", "html": "<form><input type=password></form>"}},
		{"method": "Page.navigate", "params": map[string]any{"url": "javascript:" + listener}},
		{"method": "Page.navigate", "params": map[string]any{"url": "data:text/html,<input type=password>"}},
		{"method": "Page.navigate", "params": map[string]any{"url": "chrome://password-manager/passwords"}},
		{"method": "Target.createTarget", "params": map[string]any{"url": "javascript:" + listener}},
		{"method": "Target.createTarget", "params": map[string]any{"url": "view-source:https://a.example/"}},
		{"method": "Target.setAutoAttach", "params": map[string]any{"autoAttach": true, "waitForDebuggerOnStart": true, "flatten": true}},
		{"method": "Target.exposeDevToolsProtocol", "params": map[string]any{"targetId": "T"}},
		{"method": "DOM.setAttributeValue", "params": map[string]any{"nodeId": 1, "name": "onkeydown", "value": listener}},
		{"method": "DOM.getOuterHTML", "params": map[string]any{"nodeId": 1}},
		{"method": "DOM.resolveNode", "params": map[string]any{"nodeId": 1}},
		{"method": "DOMSnapshot.captureSnapshot", "params": map[string]any{"computedStyles": []string{}}},
		{"method": "Accessibility.getFullAXTree"},
		{"method": "Network.enable"},
		{"method": "Network.getRequestPostData", "params": map[string]any{"requestId": "1"}},
		{"method": "Fetch.enable", "params": map[string]any{"patterns": []any{map[string]any{"urlPattern": "*"}}}},
		{"method": "Debugger.enable"},
		{"method": "Debugger.setBreakpointByUrl", "params": map[string]any{"lineNumber": 0, "condition": listener}},
		{"method": "Input.dispatchKeyEvent", "params": map[string]any{"type": "keyDown", "key": "a", "modifiers": 2, "commands": []string{"selectAll", "copy"}}},
		{"method": "Input.insertText", "params": map[string]any{"text": "x"}},
		{"method": "Input.dispatchMouseEvent", "params": map[string]any{"type": "mousePressed", "button": "middle", "x": 1, "y": 1}},
		{"method": "Input.dispatchMouseEvent", "params": map[string]any{"type": "mousePressed", "button": "right", "x": 1, "y": 1}},
		{"method": "IO.read", "params": map[string]any{"handle": "blob:00000000-0000-0000-0000-000000000000"}},
		{"method": "Storage.getCookies"},
		{"method": "Emulation.setScriptExecutionDisabled", "params": map[string]any{"value": false}},
		{"method": PageActionMethod, "params": map[string]any{"action": "eval", "value": "document.querySelector('input[type=password]').value"}},
		{"method": PageActionMethod, "params": map[string]any{"action": PageText, "selector": "input"}},
		{"method": PageActionMethod, "params": map[string]any{"action": PageClick}},
		{"method": PageActionMethod, "params": map[string]any{"action": PageClick, "selector": "a", "value": "x"}},
	}
	for _, person := range []bool{false, true} {
		c := newFakeChrome(t)
		ag := connectAgent(t, c)
		c.mux.setControl(person)
		for i, cmd := range refused {
			cmd["id"], cmd["sessionId"] = i, "S1"
			ag.send(cmd)
			m := ag.recv()
			e, _ := m["error"].(map[string]any)
			if m["id"] != float64(i) || m["sessionId"] != "S1" || e == nil || e["message"] != agentRefused {
				t.Fatalf("person=%v: %v answered %v", person, cmd, m)
			}
		}
		select {
		case m := <-c.got:
			t.Fatalf("person=%v: Chrome got %v", person, m)
		case <-time.After(100 * time.Millisecond):
		}
	}
}

// What is let through carries only what it may: an address cannot become
// script, a session cannot become nested, and a page action's script is the
// host's, with the agent's selector and text only as string literals.
func TestAllowedCommandsAreRebuiltFromWhatTheyMayCarry(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	ag.send(map[string]any{"id": 1, "sessionId": "S1", "method": "Page.navigate", "params": map[string]any{"url": "https://a.example/login", "frameId": "CHILD", "transitionType": "link"}})
	if m := c.expect("Page.navigate"); len(m["params"].(map[string]any)) != 1 || m["params"].(map[string]any)["url"] != "https://a.example/login" || m["sessionId"] != "S1" {
		t.Fatalf("navigate became %v", m)
	}
	ag.send(map[string]any{"id": 2, "method": "Target.attachToTarget", "params": map[string]any{"targetId": strings.Repeat("A", 32), "flatten": false}})
	if p := c.expect("Target.attachToTarget")["params"].(map[string]any); p["flatten"] != true {
		t.Fatalf("attach became %v", p)
	}
	selector := `input[name="q"]'),alert(1),('` + " "
	ag.send(map[string]any{"id": 3, "sessionId": "S1", "method": PageActionMethod, "params": map[string]any{"action": PageType, "selector": selector, "value": "hei\n", "expression": "window.leak", "contextId": 7, "includeCommandLineAPI": true}})
	m := c.expect("Runtime.evaluate")
	p := m["params"].(map[string]any)
	if len(p) != 3 || p["awaitPromise"] != true || p["returnByValue"] != true {
		t.Fatalf("page action params %v", p)
	}
	expr := p["expression"].(string)
	lit, _ := json.Marshal(selector)
	if strings.Contains(expr, "window.leak") || !strings.Contains(expr, "document.querySelectorAll("+string(lit)+")") || strings.Contains(expr, " ") {
		t.Fatalf("selector left its literal: %s", expr)
	}
	ag.send(map[string]any{"id": 4, "method": "Target.createTarget", "params": map[string]any{"url": "about:blank", "newWindow": true, "browserContextId": "OTHER"}})
	if p := c.expect("Target.createTarget")["params"].(map[string]any); len(p) != 1 || p["url"] != "about:blank" {
		t.Fatalf("createTarget became %v", p)
	}
}

// A screenshot goes to Chrome only after the host found no password field
// showing its value. The agent can click a site's own "show password"
// control without script; the picture would then carry what was typed.
func TestScreenshotWaitsForTheRevealCheck(t *testing.T) {
	for _, tc := range []struct {
		name   string
		answer map[string]any
		want   string
	}{
		{"masked", map[string]any{"result": map[string]any{"result": map[string]any{"type": "boolean", "value": false}}}, ""},
		{"revealed", map[string]any{"result": map[string]any{"result": map[string]any{"type": "boolean", "value": true}}}, RevealedRefused},
		{"page threw", map[string]any{"result": map[string]any{"result": map[string]any{"type": "object"}, "exceptionDetails": map[string]any{"text": "x"}}}, GuardFailed},
		{"cdp error", map[string]any{"error": map[string]any{"code": -32000, "message": "no"}}, GuardFailed},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := newFakeChrome(t)
			ag := connectAgent(t, c)
			ag.send(map[string]any{"id": 9, "sessionId": "S1", "method": "Page.captureScreenshot", "params": map[string]any{"format": "png", "clip": map[string]any{"x": 0, "y": 0, "width": 1, "height": 1, "scale": 1}}})
			check := c.next()
			if check["method"] != "Runtime.evaluate" || check["sessionId"] != "S1" || check["params"].(map[string]any)["expression"] != revealedPasswordScript {
				t.Fatalf("first to Chrome: %v", check)
			}
			tc.answer["id"] = check["id"]
			c.send(tc.answer)
			if tc.want == "" {
				shot := c.next()
				if shot["method"] != "Page.captureScreenshot" || shot["params"].(map[string]any)["clip"] != nil {
					t.Fatalf("then: %v", shot)
				}
				return
			}
			m := ag.recv()
			if e, _ := m["error"].(map[string]any); m["id"] != float64(9) || e["message"] != tc.want {
				t.Fatalf("agent got %v", m)
			}
			select {
			case m := <-c.got:
				t.Fatalf("Chrome got %v", m)
			case <-time.After(100 * time.Millisecond):
			}
		})
	}
}

func boolResult(id any, v bool) map[string]any {
	return map[string]any{"id": id, "result": map[string]any{"result": map[string]any{"type": "boolean", "value": v}}}
}

// Before a press the host notes which fields are passwords, so a field the
// press unmasks is still known as one when a screenshot is asked for. A
// page that cannot be checked is not pressed.
func TestAPressFollowsTheRecordOfPasswordFields(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	ag.send(map[string]any{"id": 1, "sessionId": "S1", "method": "Input.dispatchMouseEvent", "params": map[string]any{"type": "mouseMoved", "button": "none", "x": 5, "y": 5}})
	if m := c.next(); m["method"] != "Input.dispatchMouseEvent" {
		t.Fatalf("a move waited for %v", m)
	}
	ag.send(map[string]any{"id": 2, "sessionId": "S1", "method": "Input.dispatchMouseEvent", "params": map[string]any{"type": "mousePressed", "button": "left", "x": 5, "y": 5}})
	record := c.next()
	if record["method"] != "Runtime.evaluate" || record["sessionId"] != "S1" || record["params"].(map[string]any)["expression"] != recordPasswordsScript {
		t.Fatalf("before the press: %v", record)
	}
	c.send(map[string]any{"id": record["id"], "error": map[string]any{"code": -32000, "message": "dialog"}})
	if m := ag.recv(); m["id"] != float64(2) || m["error"].(map[string]any)["message"] != RecordFailed {
		t.Fatalf("agent got %v", m)
	}
	select {
	case m := <-c.got:
		t.Fatalf("pressed anyway: %v", m)
	case <-time.After(100 * time.Millisecond):
	}
}

// A screenshot sent right after a press, without waiting for its answer, is
// checked only once the press has been handled; and a check made while
// control went to the person and back is not trusted.
func TestAScreenshotIsCheckedOnTheCurrentPage(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	ag.send(map[string]any{"id": 1, "sessionId": "S1", "method": "Input.dispatchMouseEvent", "params": map[string]any{"type": "mousePressed", "button": "left", "x": 5, "y": 5}})
	record := c.next()
	c.send(boolResult(record["id"], true))
	press := c.expect("Input.dispatchMouseEvent")
	ag.send(map[string]any{"id": 2, "sessionId": "S1", "method": "Page.captureScreenshot", "params": map[string]any{"format": "png"}})
	select {
	case m := <-c.got:
		t.Fatalf("checked before the press was handled: %v", m)
	case <-time.After(150 * time.Millisecond):
	}
	c.send(map[string]any{"id": press["id"], "result": map[string]any{}})
	if m := ag.recv(); m["id"] != float64(1) {
		t.Fatalf("press answer %v", m)
	}
	check := c.expect("Runtime.evaluate")
	if check["params"].(map[string]any)["expression"] != revealedPasswordScript {
		t.Fatalf("check %v", check)
	}
	// The person takes control and gives it back while the check runs.
	c.mux.setControl(true)
	c.mux.setControl(false)
	c.send(boolResult(check["id"], false))
	if m := ag.recv(); m["id"] != float64(2) || m["error"].(map[string]any)["message"] != PersonTookControl {
		t.Fatalf("stale check let through: %v", m)
	}
	select {
	case m := <-c.got:
		t.Fatalf("Chrome got %v", m)
	case <-time.After(100 * time.Millisecond):
	}
}

// A command that waited for the host's own check while the person took and
// gave back control is answered as held, never sent onto their changed page;
// so is a picture taken while they took control.
func TestNothingCrossesThePersonsTurn(t *testing.T) {
	c := newFakeChrome(t)
	ag := connectAgent(t, c)
	ag.send(map[string]any{"id": 1, "sessionId": "S1", "method": "Input.dispatchMouseEvent", "params": map[string]any{"type": "mousePressed", "button": "left", "x": 5, "y": 5}})
	record := c.next()
	c.mux.setControl(true)
	c.mux.setControl(false)
	c.send(boolResult(record["id"], true))
	if m := ag.recv(); m["id"] != float64(1) || m["error"].(map[string]any)["message"] != PersonTookControl {
		t.Fatalf("press across the turn: %v", m)
	}
	select {
	case m := <-c.got:
		t.Fatalf("Chrome got %v", m)
	case <-time.After(100 * time.Millisecond):
	}
	ag.send(map[string]any{"id": 2, "sessionId": "S1", "method": "Page.captureScreenshot", "params": map[string]any{"format": "png"}})
	c.send(boolResult(c.expect("Runtime.evaluate")["id"], false))
	shot := c.expect("Page.captureScreenshot")
	c.mux.setControl(true)
	c.send(map[string]any{"id": shot["id"], "sessionId": "S1", "result": map[string]any{"data": "c3ludGhldGlj"}})
	m := ag.recv()
	if e, _ := m["error"].(map[string]any); m["id"] != float64(2) || m["sessionId"] != "S1" || e["message"] != PersonTookControl || m["result"] != nil {
		t.Fatalf("picture from the person's turn: %v", m)
	}
}

// An agent whose screenshot is never answered is disconnected rather than
// let send a press that could land before the picture.
func TestAnUnansweredScreenshotEndsTheAgent(t *testing.T) {
	c := newFakeChrome(t)
	c.mux.shotWait = 100 * time.Millisecond
	ag := connectAgent(t, c)
	ag.send(map[string]any{"id": 1, "sessionId": "S1", "method": "Page.captureScreenshot"})
	c.send(boolResult(c.expect("Runtime.evaluate")["id"], false))
	c.expect("Page.captureScreenshot")
	go io.Copy(io.Discard, ag.conn)
	go func() {
		b, _ := json.Marshal(map[string]any{"id": 2, "sessionId": "S1", "method": "Input.dispatchMouseEvent", "params": map[string]any{"type": "mouseMoved", "button": "none", "x": 5, "y": 5}})
		_, _ = ag.conn.Write(wsframe.AppendFrame(nil, wsframe.OpText, b, true))
	}()
	for deadline := time.Now().Add(3 * time.Second); ; time.Sleep(10 * time.Millisecond) {
		c.mux.mu.Lock()
		gone := c.mux.agent == nil
		c.mux.mu.Unlock()
		if gone {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("agent kept")
		}
	}
	for {
		select {
		case m := <-c.got:
			if m["method"] == "Input.dispatchMouseEvent" {
				t.Fatalf("press after an untaken picture: %v", m)
			}
		case <-time.After(100 * time.Millisecond):
			return
		}
	}
}
