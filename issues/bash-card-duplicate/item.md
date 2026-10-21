---
created: 2026-10-21
updated: 2026-10-21
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# A ! command shows two cards; the lower, over-wide one appears first

## Description

Jari on the test server (d71151f1), 2026-10-21: typing `!git status` / `!!ls` shows the command as two cards. The lower card is too wide and is the one that appears first. Expected: one Kortit card per command (implement-bash-cards), within the transcript column width, appearing once from start to settlement (live and saved).
