---
created: 2026-10-15
updated: 2026-10-15
type: bug
reporter: jari
status: in-progress
priority: normal
lane: web
lane_seq: 33
collision: [web/]
---

# Bash card hides its command until toggled

Jari, pilot.65 (2026-10-15): in a bash tool card the command is not visible by default. After the card is opened and closed once, the command shows. The command is part of the collapsed card's header (`design-system/design.md` Keskustelu; draft `design-system/drafts/Agentin vuoro.proto.html`) and must be visible from the first render, including for cards loaded from history.

## Acceptance Criteria
- [x] The bash command is visible in the collapsed header on first render, for live and history-loaded cards (browser test).
