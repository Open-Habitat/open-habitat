---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: normal
lane: trash
lane_seq: 1
collision: [internal/daemon/trash]
---

# Workspace deletion keeps reporting a git process in the directory

_Source: chat:ville-test-2026-10-20_

## Description

Ville (2026-10-20, pilot.237) deleting a workspace repeatedly got the notice that a git process is running in the directory. Hypothesis (Jari): the deletion itself, or the browser's snapshot polling (the user's daemon logged /api/v1/snapshot every ~1-2 s during the test, which runs git in workspaces), starts the git process that the busy check then sees. Reproduce in the lab with snapshot polling active, find which git process blocks, and make the busy check ignore the daemon's own short-lived inspection processes (or avoid running them on a workspace being deleted) while still blocking on the person's real processes. Done: deleting an idle workspace with the browser open succeeds on first try; a real shell or git in the directory still blocks and is named.
