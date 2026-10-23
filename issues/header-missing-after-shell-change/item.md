---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: web-shell
lane_seq: 2
collision: [web/src/app/shell]
closed: 2026-10-23
---

# Top bar missing (regression after the shell scroll change)

## Description

Jari 2026-10-23 10:44 on the test server (a67e4707): the whole top bar is missing. Most likely a regression from `page-scroll-moves-header` (viewport-bounded shell, single conversation scroll surface, landed today). Find the cause, restore the header in every view (workspace list, conversation, settings) on desktop and 390 px, and keep the page-scroll fix (header fixed, wheel over margins scrolls the conversation).

## Acceptance Criteria

- [x] Header visible in all views and viewports; browser test asserts the header is in the viewport after load and after scrolling; the page-scroll test still passes.
