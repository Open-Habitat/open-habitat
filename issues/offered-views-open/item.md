---
created: 2026-11-24
updated: 2026-11-24
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-24
---

# Offered views open as a blank page

## Observed (Jari 24.11.2026, v0.1.7 on a pilot installation, Chromium-based browser)

Two offered views (prototype offline.html files of about 5 and 9 MB, built by the
prototype round build scripts) open as a blank white page, both in the conversation's view
panel and in their own tab (`/n/<token>`). DevTools: the document request chain
`handoff?token=… 303 → <view address> 302 → offline.html 200 (5,091 kB, 5.7 s)` completes,
fonts from data: URLs load, and the page stays blank. Jari says views of this kind have
behaved like this "for ages", now both of today's.

The same files render in Chromium when opened as file:// and when served with the view
host's exact Content-Security-Policy (sandbox allow-scripts, script-src 'self'
'unsafe-inline' 'unsafe-eval' …) from a plain local server, so the file and the CSP alone
are not the cause. Suspects: what the view host or the browser shell adds around a view
(the v0.1.7 recovery for a view that loses its document, a9b58a52e; the own-tab route;
handoff; frame-ancestors; size/streaming), or the browser's own handling.

## Done when

The cause is found and fixed, with a browser spec that offers a large prototype-style
offline.html (inline module scripts, data: fonts, several MB) and asserts it renders in
the panel and in its own tab. If the cause is in how prototype builds produce offline.html
(something the view sandbox legitimately forbids), fix the build helper instead and say so.

## Resolution

### 2026-11-24T16:59:56Z · @issuectl

Cause: the daemon socket's five-second response deadline cut view files the gateway relayed at the browser's pace, and the gateway ended the HTML reply as if complete. Fixed on both sides; see result.md.
