---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
lane: server-browser-settings
lane_seq: 1
preparation: ready
closed: 2026-11-22
---

# Server browser settings for real sites (JavaScript, pop-ups, downloads)

## Question

Jari 22.11.2026: are the server browser's settings what real sites need? JavaScript must be allowed by default, and opening pop-up windows (and similar: several downloads at once) should be allowed, as real e-services require. A sibling project of his configured exactly this for its agent browser with Chrome enterprise policies (e.g. `PopupsAllowedForUrls`, `AutomaticDownloadsAllowedForUrls`). Investigate what our server browser sets today and what it should set.

## Acceptance Criteria

- [x] Choose per-person site defaults without weakening the browser sandbox or installing host-wide policy; record trade-offs in result.md.
- [x] Verify a synthetic local page opens a popup and completes two downloads in sandboxed Chrome, with a negative control.
- [x] Preserve subsequent user choices across restarts and pass focused checks plus independent browser-settings review.
