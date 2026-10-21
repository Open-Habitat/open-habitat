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

# Closing the last shell should close the terminal panel

## Description

Jari on the test server, 2026-10-21: the last bash tab can be closed, but then the panel goes into an odd state with an unnecessary notice that bash has closed. Expected: closing the last shell closes the whole terminal panel (as if hidden), no leftover notice; reopening Pääte starts a fresh shell.
