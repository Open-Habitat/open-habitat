---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: open
priority: normal
lane: server-browser-settings
lane_seq: 1
preparation: ready
---

# Server browser settings for real sites (JavaScript, pop-ups, downloads)

## Question

Jari 22.11.2026: are the server browser's settings what real sites need? JavaScript must be allowed by default, and opening pop-up windows (and similar: several downloads at once) should be allowed, as real e-services require. A sibling project of his configured exactly this for its agent browser with Chrome enterprise policies (e.g. `PopupsAllowedForUrls`, `AutomaticDownloadsAllowedForUrls`). Investigate what our server browser sets today and what it should set.
