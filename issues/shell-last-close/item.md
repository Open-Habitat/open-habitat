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

# Closing the last shell should close the terminal panel

## Description

Jari on the test server, 2026-10-21: the last bash tab can be closed, but then the panel goes into an odd state with an unnecessary notice that bash has closed. Expected: closing the last shell closes the whole terminal panel (as if hidden), no leftover notice; reopening Pääte starts a fresh shell.

## Acceptance Criteria

- [x] Closing the last shell tab hides the terminal panel without an end notice.
- [x] Reopening the terminal starts one fresh, usable shell.
- [x] Closing one of several tabs and hiding a running shell still work.
