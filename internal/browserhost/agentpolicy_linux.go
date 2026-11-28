//go:build linux

package browserhost

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

// What an agent may ask of Chrome.
//
// The person signs in by typing into this same browser. Any way for the
// agent to run its own JavaScript in a page, read the DOM, watch the network
// or send keys would also let it read what they typed: a script can flip a
// password field to text, collect it with FormData, or wait in a keydown
// listener installed before they take control, and the Network domain sees
// the sign-in request's body. Filtering results cannot close that, so the
// host forwards only a fixed set of commands, rebuilt from validated
// parameters, and runs page scripts only from its own templates
// (PageActionMethod, pagescript_linux.go). Everything else is refused before
// it reaches Chrome. The agent runs as the same Unix user; this closes the
// browser's own routes, not that user's files and sockets.

// PageActionMethod is the host's own CDP method for its page scripts. The
// agent names an action; the host writes the script.
const PageActionMethod = "OpenHabitat.pageAction"

// agentRefused answers every command outside the set.
const agentRefused = "not available to the agent: page script, DOM, network and keyboard access could read what the person typed"

// RevealedRefused answers a screenshot of a page showing a password in clear.
const RevealedRefused = "a password field on this page shows its value in clear; the screenshot was not taken"

// GuardFailed answers a screenshot when the page could not be checked.
const GuardFailed = "the page could not be checked for a password shown in clear; the screenshot was not taken"

// RecordFailed answers a press when the page's password fields could not be
// noted first.
const RecordFailed = "the page could not be prepared for the press; nothing was pressed"

// agentCommand returns the command to send to Chrome in place of fields, or
// the reason it is refused. Only id, sessionId, method and the parameters
// read here survive.
func agentCommand(fields map[string]json.RawMessage) (map[string]json.RawMessage, string) {
	var method string
	if json.Unmarshal(fields["method"], &method) != nil {
		return nil, agentRefused
	}
	raw := fields["params"]
	if len(raw) == 0 || string(raw) == "null" {
		raw = json.RawMessage("{}")
	}
	// Permissions are not among them: a clipboard grant would let a page
	// read what the person pasted.
	var p map[string]json.RawMessage
	if json.Unmarshal(raw, &p) != nil {
		return nil, agentRefused
	}
	// Keys are matched exactly, as Chrome matches them; only what is read
	// here is sent on.
	str := func(key string) (string, bool) {
		var s string
		v, ok := p[key]
		if !ok {
			return "", false
		}
		err := json.Unmarshal(v, &s)
		return s, err == nil
	}
	num := func(key string) (float64, bool) {
		var f float64
		v, ok := p[key]
		if !ok {
			return 0, false
		}
		err := json.Unmarshal(v, &f)
		return f, err == nil
	}
	params := map[string]any{}
	switch method {
	case "Browser.getVersion", "Target.getTargets", "Page.enable", "Page.getFrameTree":
	case "Target.createTarget":
		u, ok := str("url")
		if !ok || !pageURL(u, true) {
			return nil, agentRefused
		}
		params["url"] = u
	case "Target.attachToTarget":
		t, ok := str("targetId")
		if !ok || t == "" {
			return nil, agentRefused
		}
		// Nested sessions would carry commands past this check inside a string.
		params["targetId"], params["flatten"] = t, true
	case "Target.detachFromTarget":
		s, ok := str("sessionId")
		if !ok || s == "" {
			return nil, agentRefused
		}
		params["sessionId"] = s
	case "Target.closeTarget":
		t, ok := str("targetId")
		if !ok || t == "" {
			return nil, agentRefused
		}
		params["targetId"] = t
	case "Page.setLifecycleEventsEnabled":
		var on bool
		if json.Unmarshal(p["enabled"], &on) != nil {
			return nil, agentRefused
		}
		params["enabled"] = on
	case "Page.navigate":
		// A javascript:, data: or chrome: address would run or show what
		// the agent chose in the person's signed-in context.
		u, ok := str("url")
		if !ok || !pageURL(u, false) {
			return nil, agentRefused
		}
		params["url"] = u
	case "Page.captureScreenshot":
		if f, ok := str("format"); ok {
			if f != "png" && f != "jpeg" && f != "webp" {
				return nil, agentRefused
			}
			params["format"] = f
		}
		if q, ok := num("quality"); ok {
			params["quality"] = q
		}
	case "Input.dispatchMouseEvent":
		// A left button press, as the CLI's click; other buttons open menus
		// or paste the X selection.
		kind, _ := str("type")
		button, _ := str("button")
		x, okX := num("x")
		y, okY := num("y")
		if (kind != "mouseMoved" && kind != "mousePressed" && kind != "mouseReleased") || (button != "left" && button != "none") || !okX || !okY {
			return nil, agentRefused
		}
		params["type"], params["button"], params["x"], params["y"] = kind, button, x, y
		for _, key := range []string{"buttons", "clickCount"} {
			if n, ok := num(key); ok {
				params[key] = n
			}
		}
	case "Network.loadNetworkResource":
		u, okU := str("url")
		frame, okF := str("frameId")
		if !okU || !okF || !pageURL(u, false) {
			return nil, agentRefused
		}
		var opt struct {
			DisableCache       bool `json:"disableCache"`
			IncludeCredentials bool `json:"includeCredentials"`
		}
		if json.Unmarshal(p["options"], &opt) != nil {
			return nil, agentRefused
		}
		params["url"], params["frameId"] = u, frame
		params["options"] = map[string]bool{"disableCache": opt.DisableCache, "includeCredentials": opt.IncludeCredentials}
	case "IO.read", "IO.close":
		h, ok := str("handle")
		// Only streams the host handed out; blob: handles name page data.
		if !ok || h == "" || strings.Contains(h, ":") {
			return nil, agentRefused
		}
		params["handle"] = h
		if method == "IO.read" {
			if n, ok := num("size"); ok {
				params["size"] = n
			}
		}
	case PageActionMethod:
		action, _ := str("action")
		selector, _ := str("selector")
		value, _ := str("value")
		expr, ok := pageScript(action, selector, value)
		if !ok {
			return nil, agentRefused
		}
		method = "Runtime.evaluate"
		params = map[string]any{"expression": expr, "awaitPromise": true, "returnByValue": true}
	default:
		return nil, agentRefused
	}
	out := map[string]json.RawMessage{"id": fields["id"]}
	if s, ok := fields["sessionId"]; ok {
		out["sessionId"] = s
	}
	out["method"], _ = json.Marshal(method)
	out["params"], _ = json.Marshal(params)
	return out, ""
}

// pageURL is an address the agent may load: an absolute http(s) URL, and
// about:blank for a new tab.
func pageURL(s string, blank bool) bool {
	if blank && s == "about:blank" {
		return true
	}
	u, err := url.Parse(s)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != "" && utf8.ValidString(s) && !strings.ContainsAny(s, "\r\n\x00")
}

// hostEvaluate runs one of the host's own scripts in a session and returns
// its value, or false when it failed.
func (m *cdpMux) hostEvaluate(session, script string) (json.RawMessage, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	res, err := m.call(ctx, "Runtime.evaluate", map[string]any{"expression": script, "returnByValue": true}, session)
	if err != nil {
		return nil, false
	}
	var out struct {
		Result struct {
			Value json.RawMessage `json:"value"`
		} `json:"result"`
		Exception json.RawMessage `json:"exceptionDetails"`
	}
	if json.Unmarshal(res, &out) != nil || len(out.Exception) != 0 || len(out.Result.Value) == 0 {
		return nil, false
	}
	return out.Result.Value, true
}

// agentIdle waits until every command the agent sent has been answered, so
// what the host checks next is the page those commands left. A client that
// sends a press and a screenshot without waiting would otherwise have the
// check run before the press unmasks a field.
func (m *cdpMux) agentIdle(a *agentConn, limit time.Duration) bool {
	for deadline := m.now().Add(limit); ; time.Sleep(5 * time.Millisecond) {
		m.mu.Lock()
		busy := false
		for _, r := range m.pending {
			if r.owner == a && !r.dropped {
				busy = true
				break
			}
		}
		gone := m.agent != a
		m.mu.Unlock()
		if !busy || gone {
			return !busy
		}
		if m.now().After(deadline) {
			return false
		}
	}
}

// recordPasswords notes the fields that are passwords now in every page,
// through the host's own sessions. It runs when the person takes control,
// so a field they unmask themselves before giving control back stays known.
func (m *cdpMux) recordPasswords() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	res, err := m.call(ctx, "Target.getTargets", map[string]any{}, "")
	if err != nil {
		return
	}
	var out struct {
		Targets []struct {
			ID   string `json:"targetId"`
			Type string `json:"type"`
		} `json:"targetInfos"`
	}
	if json.Unmarshal(res, &out) != nil {
		return
	}
	for _, t := range out.Targets {
		if t.Type != "page" || !TargetPattern.MatchString(t.ID) {
			continue
		}
		if s, err := m.hostSessionFor(ctx, t.ID); err == nil {
			m.hostEvaluate(s, recordPasswordsScript)
		}
	}
}

// screenshotGuard refuses a screenshot of a page where a password field
// shows its value in clear. The agent can click a site's own "show
// password" control without running script; the picture would then carry
// what the person typed. A field counts as a password when the host saw it
// as one (recordPasswordsScript) or its autocomplete token says so.
func (m *cdpMux) screenshotGuard(session string) string {
	v, ok := m.hostEvaluate(session, revealedPasswordScript)
	var revealed bool
	if !ok || json.Unmarshal(v, &revealed) != nil {
		return GuardFailed
	}
	if revealed {
		return RevealedRefused
	}
	return ""
}
