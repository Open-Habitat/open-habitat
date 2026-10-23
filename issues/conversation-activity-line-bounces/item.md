---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: conversation-ui
lane_seq: 1
collision: [web/src/components/conversation-message]
closed: 2026-10-23
---

# Conversation: the activity line bounces by a line while the agent works

## Description

Jari 2026-10-23: while the agent works, the bottom activity line (tools/work in progress) bounces up and down by about one line now and then, as if an empty line appears in between and disappears; nothing visible appears in it. Layout shift in the live conversation tail.

Find the element that changes height (likely a status/streaming placeholder, a thinking/tool row mounting empty, or the scroll anchoring of the composer area) and make the tail height-stable while streaming: reserve space or avoid mounting empty rows. Reproduce with a synthetic streaming session.

## Acceptance Criteria

- [x] No vertical jump of the activity line during a synthetic run with thinking, several tool calls and streamed text; a browser test measures the line's position across updates (layout-shift assertion).
