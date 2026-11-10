---
created: 2026-11-10
updated: 2026-11-10
type: feature
reporter: jari
status: open
priority: normal
related: ['@pi-web-search-capability']
preparation: ready
lane: web-search
lane_seq: 3
---

# Headless browser page reading for every agent

## Description

Jari 10.11.2026: the headless browser for reading JavaScript-rendered pages
belongs to every installation (core runtime), not only the optional
`browser` profile. Give agents a page-reading tool (render a URL, return
readable text and links, optional screenshot) running as the person, using
the already qualified headless Chromium, with time and size bounds. Hosted
renderers stay a personal opt-in only. Research:
`issues/pi-web-search-capability/research.md` section C.
