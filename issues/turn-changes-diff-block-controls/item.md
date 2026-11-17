---
created: 2026-11-17
updated: 2026-11-17
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-17/turn-changes-diff-block-controls
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-17
---

# Turn changes block: diff lacks the code block's wrap control, and a single file needs an extra click

## Description

Jari 17.11.2026 (test server), in the 'Changes' block of a turn (what the agent changed; Changes AGENTS.md +1 -1, Timeline on the right):
1. The diff text view should be the same as a Markdown code block in the agent's chat reply: the same controls on the right side, especially the line-wrap toggle, which is missing now. Long lines are cut off at the right edge (only a copy icon sits outside the block).
2. When the turn changed only one file, that file's diff should open directly. Now the person opens the Changes block and then has to click the single file open as well.
