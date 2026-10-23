---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: web-shell
lane_seq: 1
collision: [web/src/app/shell]
---

# Scrolling outside the text column scrolls the whole page and hides the header

## Description

Jari 2026-10-23: scrolling with the pointer in the empty area outside the conversation text column scrolls the whole page, so the top bar scrolls out of view. The app shell must not scroll as a page: header fixed, only the conversation (and other panes) scroll inside, regardless of where the wheel/trackpad gesture happens; wheel over the side margins should scroll the conversation.

## Acceptance Criteria

- [ ] Header never leaves the viewport on desktop and 390 px; wheel over empty margins scrolls the conversation; browser test.
