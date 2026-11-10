---
created: 2026-11-10
updated: 2026-11-10
type: bug
status: fixed
priority: normal
related: ['@race-skill-block-load-lost']
preparation: ready
lane: history-press
lane_seq: 1
closed: 2026-11-10
---

# Expanding output at the latest position stops following (regression from the history-press fix)

## Description

Regression from `46e1c7259` ("fix: preserve history controls through presses
and resizes", issue `race-skill-block-load-lost`). The clean gate on main
`46e1c7259` (10.11.2026, idle Birch) fails
`web/tests/browser-conversation.spec.ts:190` "latest action follows expanded
output" at line 216: after clicking `history-stage-toggle` at the bottom of a
followed conversation, `jump-latest` appears (expected 0, received 1). The
previous gate on `18d993000` passed it.

The fix makes any history control press claim the reading anchor, so
expanding a stage or tool at the end of a conversation that was following
now stops following and offers To the latest. The agreed behaviour (this
spec) is that expanding output at the latest position keeps following.
Keep both: a press must not lose its target to a scroll or resize between
pointer-down and pointer-up (the skill reader and Load cases), and expanding
output while at the latest position keeps the conversation following.
