---
created: 2026-10-21
updated: 2026-10-21
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# A ! command shows two cards; the lower, over-wide one appears first

## Description

Jari on the test server (d71151f1), 2026-10-21: typing `!git status` / `!!ls` shows the command as two cards. The lower card is too wide and is the one that appears first. Expected: one Kortit card per command (implement-bash-cards), within the transcript column width, appearing once from start to settlement (live and saved).

## Acceptance Criteria

- [x] Each `!` / `!!` invocation has one card after native history takes over; repeated identical commands remain distinct.
- [x] The live card stays within the transcript column, including while running and stopping.
- [x] Saved command cards survive reload; stop and accessible expand/collapse still work.
