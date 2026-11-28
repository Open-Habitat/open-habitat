//go:build linux

package cli

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/browserhost"
	"github.com/open-habitat/open-habitat/internal/daemon"
)

type browserAction struct {
	verb, tab, value, selector, name string
	timeout                          time.Duration
}

func isBrowserAction(s string) bool {
	switch s {
	case "goto", "text", "links", "click", "type", "screenshot", "download", "tabs", "close", "eval":
		return true
	}
	return false
}

func parseBrowserAction(args []string) (browserAction, error) {
	a := browserAction{verb: args[0], timeout: browserCommandTimeout}
	values := map[string]string{}
	var positional []string
	for i := 1; i < len(args); i++ {
		flag := args[i]
		if !strings.HasPrefix(flag, "--") {
			positional = append(positional, flag)
			continue
		}
		if flag == "--dry-run" {
			return a, &cliError{code: "dry_run_unsupported", message: "browser actions cannot be previewed without executing page code", exit: 1}
		}
		allowed := flag == "--timeout-seconds" || (flag == "--tab" && a.verb != "tabs") || (flag == "--name" && (a.verb == "download" || a.verb == "screenshot")) || (flag == "--selector" && (a.verb == "click" || a.verb == "type")) || (flag == "--text-file" && a.verb == "type")
		if !allowed || i+1 == len(args) {
			return a, usage("invalid browser argument " + flag + "; see agent browser " + a.verb + " --help")
		}
		if _, ok := values[flag]; ok {
			return a, usage("duplicate " + flag)
		}
		i++
		values[flag] = args[i]
	}
	a.tab, a.selector, a.name = values["--tab"], values["--selector"], values["--name"]
	switch a.verb {
	case "goto", "download", "eval":
		expected := "a URL"
		if a.verb == "eval" {
			expected = "JavaScript"
		}
		if len(positional) != 1 || strings.TrimSpace(positional[0]) == "" {
			return a, usage(a.verb + " requires exactly one positional argument: " + expected)
		}
		a.value = positional[0]
		if a.verb == "eval" {
			if len(a.value) > 64<<10 {
				return a, usage("eval JavaScript exceeds 64 KiB")
			}
		} else {
			u, err := url.Parse(a.value)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || strings.ContainsAny(a.value, "\r\n\x00") {
				return a, usage("expected an absolute http(s) URL without embedded credentials")
			}
		}
	case "click", "type":
		_, named := values["--selector"]
		if len(positional) > 1 || (len(positional) > 0 && named) {
			return a, usage(a.verb + " requires exactly one CSS selector: positional or --selector, not both")
		}
		if len(positional) == 1 {
			a.selector = positional[0]
		}
	default:
		if len(positional) != 0 {
			return a, usage(a.verb + " expects no positional arguments; see agent browser " + a.verb + " --help")
		}
	}
	if s, ok := values["--timeout-seconds"]; ok {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > 120 {
			return a, usage("invalid --timeout-seconds; expected 1–120")
		}
		a.timeout = time.Duration(n) * time.Second
	}
	if _, supplied := values["--tab"]; supplied && !browserhost.TargetPattern.MatchString(a.tab) {
		return a, usage("invalid --tab; expected an id from browser status or goto")
	}
	if a.verb != "tabs" && a.verb != "goto" && a.tab == "" {
		return a, usage("--tab is required; use the id returned by goto")
	}
	if (a.verb == "click" || a.verb == "type") && (strings.TrimSpace(a.selector) == "" || len(a.selector) > 4096) {
		return a, usage("expected a nonempty CSS selector of at most 4096 bytes, positional or --selector")
	}
	if a.verb == "download" || a.verb == "screenshot" {
		if a.name == "" || a.name == "." || a.name == ".." || filepath.Base(a.name) != a.name || strings.ContainsAny(a.name, "\x00\r\n") || len(a.name) > 200 {
			return a, usage("--name is required: a filename, not a path (at most 200 bytes)")
		}
	}
	if a.verb == "type" {
		p, ok := values["--text-file"]
		if !ok || p == "" {
			return a, usage("type requires --text-file PATH (or - for stdin); text is never an argv credential")
		}
		b, err := readBrowserInput(p)
		if err != nil {
			return a, err
		}
		a.value = string(b)
	}
	return a, nil
}

func readBrowserInput(p string) ([]byte, error) {
	var f *os.File
	if p == "-" {
		f = os.Stdin
	} else {
		var err error
		f, err = os.Open(p)
		if err != nil {
			return nil, system("input_unavailable", "cannot read browser input file")
		}
		defer f.Close()
	}
	b, err := readBoundedBrowserInput(f)
	return b, err
}

type browserConnectionInfo struct {
	Enabled   bool   `json:"feature_enabled"`
	State     string `json:"state"`
	Control   string `json:"control"`
	Socket    string `json:"socket_path"`
	Path      string `json:"ws_path"`
	Downloads string `json:"default_download_directory"`
}

func executeBrowserAction(a browserAction, st browserConnectionInfo) (any, error) {
	if !st.Enabled {
		return nil, &cliError{code: "browser_feature_off", message: "remote-browser is off; ask the person to enable it before using their browser", exit: 1}
	}
	if st.State != "running" {
		return nil, &cliError{code: "browser_not_running", message: "read browser status; enable remote-browser and start the browser before using it", exit: 1}
	}
	if st.Control != "agent" {
		return nil, &cliError{code: "browser_person_control", message: "the person has control; wait for them to return it before acting", exit: 1}
	}
	if !filepath.IsAbs(st.Socket) || st.Path != "/devtools/browser" {
		return nil, system("browser_protocol", "browser status has no usable socket_path/ws_path; check the installed versions")
	}
	ctx, cancel := context.WithTimeout(context.Background(), a.timeout)
	defer cancel()
	c, err := dialBrowserCDP(ctx, st.Socket, st.Path)
	// A disconnected command's host cleanup may still own the slot. Only
	// retry the refused handshake, never a CDP command or page side effect.
	backoff := 50 * time.Millisecond
	for errors.Is(err, errBrowserCDPBusy) && ctx.Err() == nil {
		select {
		case <-ctx.Done():
		case <-time.After(backoff):
		}
		if ctx.Err() != nil {
			break
		}
		c, err = dialBrowserCDP(ctx, st.Socket, st.Path)
		backoff = min(backoff*2, time.Second)
	}
	if err != nil {
		return nil, system("browser_connection_failed", "cannot connect; another agent may be using the browser; inspect status before retrying")
	}
	defer c.conn.Close()
	result, err := runBrowserAction(c, a, st.Downloads)
	if err != nil {
		var refused *cliError
		if errors.As(err, &refused) {
			return nil, refused
		}
		return nil, system("browser_action_uncertain", fmt.Sprintf("%s failed or timed out; it may have acted. Inspect browser status/page before any retry: %s", a.verb, err))
	}
	return envelope(map[string]any{"cli_version": version, "result": result}), nil
}

func agentBrowserAction(args []string) (any, error) {
	a, err := parseBrowserAction(args)
	if err != nil {
		return nil, err
	}
	raw, err := exchangeAgent(daemon.AgentBrowserPath)
	if err != nil {
		return nil, err
	}
	var st browserConnectionInfo
	if err = json.Unmarshal(raw, &st); err != nil {
		return nil, system("browser_protocol", "cannot decode browser status")
	}
	return executeBrowserAction(a, st)
}

func browserActionRefused(message string) error {
	return &cliError{code: "browser_action_refused", message: message, exit: 1}
}

func runBrowserAction(c *browserCDP, a browserAction, downloads string) (any, error) {
	if a.verb == "tabs" {
		var out struct {
			Targets []struct {
				ID               string `json:"targetId"`
				Type, Title, URL string
			} `json:"targetInfos"`
		}
		if err := c.call("Target.getTargets", map[string]any{}, &out); err != nil {
			return nil, err
		}
		rows := []map[string]string{}
		for _, t := range out.Targets {
			if t.Type == "page" {
				origin := ""
				if u, err := url.Parse(t.URL); err == nil && (u.Scheme == "http" || u.Scheme == "https") {
					origin = u.Scheme + "://" + u.Host
				}
				title := []rune(t.Title)
				if len(title) > 200 {
					title = title[:200]
				}
				rows = append(rows, map[string]string{"id": t.ID, "title": string(title), "origin": origin})
			}
		}
		return map[string]any{"tabs": rows}, nil
	}
	tab := a.tab
	if tab == "" {
		var out struct {
			ID string `json:"targetId"`
		}
		if err := c.call("Target.createTarget", map[string]any{"url": "about:blank"}, &out); err != nil {
			return nil, err
		}
		tab = out.ID
	}
	// Attaching marks this window as the agent's in the existing window list.
	var attached struct {
		Session string `json:"sessionId"`
	}
	if err := c.call("Target.attachToTarget", map[string]any{"targetId": tab, "flatten": true}, &attached); err != nil {
		var rejected *browserCDPRejected
		if errors.As(err, &rejected) {
			return nil, browserActionRefused("cannot attach to tab " + tab + "; inspect tabs; a newly created tab may remain")
		}
		return nil, fmt.Errorf("tab %s: %w", tab, err)
	}
	c.session = attached.Session
	result := map[string]any{"tab": tab, "browser_action": a.verb}
	if a.verb == "click" || a.verb == "type" {
		result["selector"] = a.selector
	}
	switch a.verb {
	case "goto":
		if err := c.navigate(a.value); err != nil {
			return nil, fmt.Errorf("tab %s: %w", tab, err)
		}
		result["loaded"] = true
	case "close":
		// Keep close usable even when a modal dialog or stuck renderer prevents
		// page evaluation. A closed target has no after-state: use its last
		// browser-level metadata, not JavaScript in the page.
		c.session = ""
		var targets struct {
			Targets []struct {
				ID               string `json:"targetId"`
				Type, Title, URL string
			} `json:"targetInfos"`
		}
		if err := c.call("Target.getTargets", map[string]any{}, &targets); err != nil {
			return nil, err
		}
		pages := 0
		for _, target := range targets.Targets {
			if target.ID == tab {
				result["url"], result["title"] = target.URL, target.Title
			}
			if target.Type == "page" {
				pages++
			}
		}
		if pages <= 1 {
			return nil, browserActionRefused("cannot close the last tab without stopping the browser; leave it open")
		}
		var out struct{ Success bool }
		if err := c.call("Target.closeTarget", map[string]any{"targetId": tab}, &out); err != nil {
			return nil, err
		}
		if !out.Success {
			return nil, fmt.Errorf("tab could not be closed")
		}
		result["closed"] = true
		return result, nil
	case "download":
		download, err := c.download(tab, a.value, downloads, a.name)
		if err != nil {
			return nil, err
		}
		for key, value := range download {
			result[key] = value
		}
	default:
		if err := c.loaded(); err != nil {
			return nil, err
		}
		if a.verb == "screenshot" {
			var out struct{ Data string }
			if err := c.call("Page.captureScreenshot", map[string]any{"format": "png"}, &out); err != nil {
				return nil, err
			}
			b, err := base64.StdEncoding.DecodeString(out.Data)
			if err != nil {
				return nil, err
			}
			path, err := saveBrowserFile(downloads, a.name, b)
			if err != nil {
				return nil, err
			}
			result["path"] = path
			result["bytes"] = len(b)
		} else {
			expr := ""
			switch a.verb {
			case "text":
				expr = `({url:location.href,title:document.title,text:document.body?.innerText.slice(0,200000) || '',truncated:(document.body?.innerText.length || 0)>200000})`
			case "links":
				expr = `({links:Array.from(document.querySelectorAll('a[href]')).slice(0,2000).flatMap(a=>{try{return [{text:(a.innerText ?? a.textContent ?? '').slice(0,1000),url:new URL(a.getAttribute('href'),a.baseURI).href}]}catch{return []}}),truncated:document.querySelectorAll('a[href]').length>2000})`
			case "eval":
				expr = a.value
			case "click", "type":
				sel, _ := json.Marshal(a.selector)
				expr = `(()=>{let es;try{es=document.querySelectorAll(` + string(sel) + `)}catch{return {refused:'invalid_selector'}};if(es.length!==1)return {refused:'selector_must_match_one',count:es.length};const e=es[0];if(e.disabled)return {refused:'disabled'};`
				if a.verb == "click" {
					expr += clickPointExpression
				} else {
					val, _ := json.Marshal(a.value)
					expr += `
if(!(e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement))return {refused:'expected_input_or_textarea'};
if(e.readOnly || ['password','file','checkbox','radio','button','submit','reset','image','hidden'].includes(e.type))return {refused:'unsupported_input'};
const value=` + string(val) + `;
const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
const set=Object.getOwnPropertyDescriptor(p,'value').set;
const probe=e.cloneNode(false);set.call(probe,value);
if(probe.value!==value)return {refused:'value_rejected'};
e.focus();set.call(e,value);
if(e.value!==value)throw Error('live input rejected value');
e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return {typed:true};})()`
				}
			}
			if a.verb == "click" || a.verb == "type" || a.verb == "eval" {
				if err := c.pageMetadata(result); err != nil {
					return nil, err
				}
				result["source_url"], result["source_title"] = result["url"], result["title"]
			}
			if a.verb == "click" {
				if err := c.prepareClick(); err != nil {
					return nil, err
				}
			}
			v, err := c.evaluate(expr)
			if err != nil {
				return nil, err
			}
			if a.verb == "click" || a.verb == "type" {
				var guard struct {
					Refused string
					Count   int
					Covered string
				}
				if json.Unmarshal(v, &guard) == nil && guard.Refused != "" {
					if guard.Refused == "covered" {
						return nil, browserActionRefused("covered by " + guard.Covered + " at the element's visible centre; nothing was clicked; close or scroll past what covers it, or adjust --selector")
					}
					return nil, browserActionRefused(fmt.Sprintf("%s (selector matches: %d); inspect text/links or adjust --selector/input", guard.Refused, guard.Count))
				}
			}
			if a.verb == "click" {
				var point struct{ X, Y float64 }
				if err := json.Unmarshal(v, &point); err != nil {
					return nil, err
				}
				if err := c.pointerClick(point.X, point.Y); err != nil {
					return nil, err
				}
				result["point"] = map[string]float64{"x": point.X, "y": point.Y}
				v = json.RawMessage(`{"clicked":true}`)
			}
			result["value"] = v
		}
	}
	if a.verb == "click" {
		if err := c.settleClick(); err != nil {
			return nil, err
		}
	}
	if err := c.pageMetadata(result); err != nil {
		return nil, err
	}
	return result, nil
}

// clickPointExpression finishes the selector guard for click: it scrolls the
// element into view and returns the visible centre that a real pointer click
// will hit. Widgets that select on pointerdown or mousedown (ARIA listbox
// options in React selects, for example) ignore a synthetic element.click(),
// so the click itself goes through Input.dispatchMouseEvent. Hit-testing here
// refuses before anything is sent when another element would receive the press.
const clickPointExpression = `
e.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
if(e.checkVisibility && !e.checkVisibility({visibilityProperty:true}))return {refused:'not_visible',count:1};
const vw=document.documentElement.clientWidth||innerWidth, vh=document.documentElement.clientHeight||innerHeight;
let x, y;
for(const r of e.getClientRects()){
  const l=Math.max(r.left,0), t=Math.max(r.top,0), rr=Math.min(r.right,vw), b=Math.min(r.bottom,vh);
  if(rr-l>=1 && b-t>=1){x=(l+rr)/2;y=(t+b)/2;break;}
}
if(x===undefined)return {refused:'not_visible',count:1};
const hit=document.elementFromPoint(x,y);
if(!hit || (hit!==e && !e.contains(hit))){
  let d='nothing';
  if(hit){d=hit.localName+(hit.id?'#'+hit.id:'');for(const c of Array.from(hit.classList).slice(0,3))d+='.'+c;}
  return {refused:'covered',count:1,covered:d.slice(0,200)};
}
return {x,y};})()`

// pointerClick sends the press a person's mouse would: move, left press and
// release at one point in the viewport's CSS pixels, so the page receives
// pointer, mouse and click events with user activation.
func (c *browserCDP) pointerClick(x, y float64) error {
	for _, event := range []map[string]any{
		{"type": "mouseMoved", "x": x, "y": y, "button": "none", "buttons": 0},
		{"type": "mousePressed", "x": x, "y": y, "button": "left", "buttons": 1, "clickCount": 1},
		{"type": "mouseReleased", "x": x, "y": y, "button": "left", "buttons": 0, "clickCount": 1},
	} {
		if err := c.call("Input.dispatchMouseEvent", event, nil); err != nil {
			return err
		}
	}
	return nil
}
