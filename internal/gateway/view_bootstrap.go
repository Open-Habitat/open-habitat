package gateway

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/text/encoding/unicode"
)

// This is a presentation signal, never authorization. The opaque sandbox and
// CSP remain the enforcement boundary even if a view spoofs or removes it.
// A view's own pages may be framed inside it and carry the same script, but
// only the view's document holds the app's challenge. So a refusal is passed
// to every ancestor ('*': their origins are opaque), and a document accepts
// one from any frame below it, past a srcdoc frame that has no script of its
// own. A refusal the framer's policy does not see (the entry, a non-HTML
// file or an error, all of which keep frame-ancestors) shows as a URL frame
// that loaded without its document announcing itself; a srcdoc or non-URL
// frame is not fetched, and one sandboxed without scripts cannot announce.
func viewBootstrap(origin string) string {
	parent, _ := json.Marshal(origin)
	return `<script>(function () {
 var origin = ` + string(parent) + `, challenge, blocked = false, seen = [];
 function report() {
  if (challenge) parent.postMessage({type: "oh-view-status", challenge: challenge, blocked: blocked}, origin);
 }
 function refuse() {
  if (blocked) return;
  blocked = true;
  report();
  for (var w = window; w !== w.parent; ) {
   w = w.parent;
   w.postMessage({type: "oh-view-frame-blocked"}, "*");
  }
 }
 function below(source, w, depth) {
  for (var i = 0; i < w.frames.length; i++) {
   if (w.frames[i] === source || depth < 8 && below(source, w.frames[i], depth + 1)) return true;
  }
  return false;
 }
 function record(w) {
  for (var i = 0; i < seen.length; i++) if (seen[i].w === w) return seen[i];
  seen.push({w: w, ready: 0, loads: 0});
  return seen[seen.length - 1];
 }
 if (parent !== window) parent.postMessage({type: "oh-view-frame-ready"}, "*");
 addEventListener("message", function (event) {
  var data = event.data;
  if (!data || !event.source) return;
  if (data.type === "oh-view-frame-blocked" && below(event.source, window, 0)) return refuse();
  if (data.type === "oh-view-frame-ready") {
   for (var i = 0; i < frames.length; i++) if (frames[i] === event.source) record(event.source).ready++;
   return;
  }
  if (event.source !== parent || event.origin !== origin || data.type !== "oh-view-check" || typeof data.challenge !== "string") return;
  challenge = data.challenge;
  report();
 });
 document.addEventListener("load", function (event) {
  var frame = event.target;
  if (!frame || frame.tagName !== "IFRAME" || frame.hasAttribute("srcdoc") || !frame.contentWindow || !/^https?:/.test(frame.src) || frame.hasAttribute("sandbox") && !frame.sandbox.contains("allow-scripts")) return;
  var r = record(frame.contentWindow), n = ++r.loads;
  setTimeout(function () { if (r.ready < n) refuse(); }, 1500);
 }, true);
 addEventListener("securitypolicyviolation", function (event) {
  if (event.disposition === "enforce" && (event.effectiveDirective === "frame-src" || event.effectiveDirective === "child-src")) refuse();
 });
})();</script>`
}

// Insert before executable content, retaining the original doctype (including
// quirks mode) and UTF-8 bytes. BOM-marked UTF-16 is decoded first, so the ASCII
// bootstrap cannot hide its encoding marker. All paths stream with bounded
// buffers; the frozen export and downloads are never changed.
func writeViewHTML(w io.Writer, r io.Reader, bootstrap string) {
	reader := bufio.NewReader(r)
	// A leading UTF-8 BOM must stay before both the doctype and our script.
	if bom, _ := reader.Peek(3); bytes.Equal(bom, []byte{0xef, 0xbb, 0xbf}) {
		if _, err := w.Write(bom); err != nil {
			return
		}
		_, _ = reader.Discard(3)
	}
	r = reader
	if bom, _ := reader.Peek(2); bytes.Equal(bom, []byte{0xff, 0xfe}) || bytes.Equal(bom, []byte{0xfe, 0xff}) {
		r = unicode.UTF16(unicode.LittleEndian, unicode.ExpectBOM).NewDecoder().Reader(reader)
	}
	z := html.NewTokenizer(r)
	// Tenant-controlled comments/text must not buffer a whole export in the
	// shared gateway. On oversized preambles we preserve bytes and insert at
	// the bounded tokenizer's stopping point instead.
	const maxToken = 64 << 10
	z.SetMaxBuf(maxToken)
	for {
		kind := z.Next()
		raw := z.Raw()
		// A limit-sized comment may be truncated even though Next reports a
		// CommentToken. Never insert inside that still-open comment.
		if len(raw) < maxToken && (kind == html.DoctypeToken || kind == html.CommentToken || (kind == html.TextToken && strings.TrimSpace(string(raw)) == "")) {
			if _, err := w.Write(raw); err != nil {
				return
			}
			continue
		}
		if _, err := io.WriteString(w, bootstrap); err != nil {
			return
		}
		if _, err := w.Write(raw); err != nil {
			return
		}
		if _, err := w.Write(z.Buffered()); err != nil {
			return
		}
		_, _ = io.Copy(w, r)
		return
	}
}
