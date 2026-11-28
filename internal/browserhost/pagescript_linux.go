//go:build linux

package browserhost

import (
	"encoding/json"
	"strings"
	"unicode/utf8"
)

// Page actions the agent may run. These are the only scripts that reach a
// page on the agent's behalf; none of them reads an input's value, and the
// agent's selector and text enter them only as JSON string literals.
const (
	PageLoaded   = "loaded"
	PageMetadata = "metadata"
	PageText     = "text"
	PageLinks    = "links"
	PageClick    = "click"
	PageType     = "type"
)

// Limits of what the agent may put into a page action.
const (
	SelectorLimit  = 4096
	TypeValueLimit = 64 << 10
)

// pageScript is the script of one action, or false for anything else.
func pageScript(action, selector, value string) (string, bool) {
	needsSelector := action == PageClick || action == PageType
	if needsSelector != (selector != "") || (action != PageType && value != "") {
		return "", false
	}
	if needsSelector && (strings.TrimSpace(selector) == "" || len(selector) > SelectorLimit || !utf8.ValidString(selector)) {
		return "", false
	}
	if len(value) > TypeValueLimit || !utf8.ValidString(value) {
		return "", false
	}
	switch action {
	case PageLoaded:
		// Wait on the document's load event, not a guessed sleep or
		// network-idle heuristic (a signed-in application may keep
		// connections open indefinitely).
		return `new Promise(resolve => { if (document.readyState === 'complete') resolve(true); else window.addEventListener('load', () => resolve(true), {once:true}); })`, true
	case PageMetadata:
		return `({url:location.href,title:document.title})`, true
	case PageText:
		return `({url:location.href,title:document.title,text:document.body?.innerText.slice(0,200000) || '',truncated:(document.body?.innerText.length || 0)>200000})`, true
	case PageLinks:
		return `({links:Array.from(document.querySelectorAll('a[href]')).slice(0,2000).flatMap(a=>{try{return [{text:(a.innerText ?? a.textContent ?? '').slice(0,1000),url:new URL(a.getAttribute('href'),a.baseURI).href}]}catch{return []}}),truncated:document.querySelectorAll('a[href]').length>2000})`, true
	case PageClick, PageType:
	default:
		return "", false
	}
	sel, _ := json.Marshal(selector)
	expr := `(()=>{let es;try{es=document.querySelectorAll(` + string(sel) + `)}catch{return {refused:'invalid_selector'}};if(es.length!==1)return {refused:'selector_must_match_one',count:es.length};const e=es[0];if(e.disabled)return {refused:'disabled'};`
	if action == PageClick {
		return expr + clickPointScript, true
	}
	val, _ := json.Marshal(value)
	// The probe answers only whether the agent's own text fits; the guard
	// refuses password fields so typing never touches what the person
	// entered there.
	return expr + `
if(!(e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement))return {refused:'expected_input_or_textarea'};
if(e.readOnly || ['password','file','checkbox','radio','button','submit','reset','image','hidden'].includes(e.type))return {refused:'unsupported_input'};
const value=` + string(val) + `;
const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
const set=Object.getOwnPropertyDescriptor(p,'value').set;
const probe=e.cloneNode(false);set.call(probe,value);
if(probe.value!==value)return {refused:'value_rejected'};
e.focus();set.call(e,value);
if(e.value!==value)throw Error('live input rejected value');
e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return {typed:true};})()`, true
}

// clickPointScript finishes the selector guard for click: it scrolls the
// element into view and returns the visible centre that a real pointer click
// will hit. Widgets that select on pointerdown or mousedown (ARIA listbox
// options in React selects, for example) ignore a synthetic element.click(),
// so the click itself goes through Input.dispatchMouseEvent. Hit-testing here
// refuses before anything is sent when another element would receive the press.
const clickPointScript = `
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

// revealedPasswordScript is true when a field marked as a password holds a
// value but no longer masks it, in the document, its open shadow roots and
// its same-origin frames.
const revealedPasswordScript = `(()=>{const walk=r=>{for(const e of r.querySelectorAll('*')){
if(e.shadowRoot&&walk(e.shadowRoot))return true;
if(e.localName==='input'&&e.type!=='password'&&e.value&&/(^|\s)(current|new)-password(\s|$)/i.test(e.getAttribute('autocomplete')||''))return true;
if(e.localName==='iframe'||e.localName==='frame'){let d=null;try{d=e.contentDocument}catch{}if(d&&walk(d))return true;}
}return false};return walk(document)})()`
