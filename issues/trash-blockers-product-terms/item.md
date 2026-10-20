---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: normal
lane: trash
lane_seq: 2
collision: [internal/daemon/trash]
---

# Workspace deletion blockers are shown as raw processes (bash, MainThread) instead of the person's terminal and editor

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 deleting workspace issuectl got: 'Prosessi bash (PID 1045372) on työtilan hakemistossa' and 'Prosessi MainThread (PID 1204433) …'. On the server, 1045372 is the browser terminal's shell (parent: the daemon-started tmux at /run/user/21032/open-habitat/tmux.sock, cwd ~/src/issuectl); MainThread was almost certainly the workspace editor (code-server/node) — both started by the person through Open Habitat, so blocking is right, but the dialog must name them in product terms ('Pääte issuectl-työtilassa', 'Editori on auki tässä työtilassa') and offer the action that resolves them (close the terminal / stop the editor, then re-check), instead of PIDs. Unknown processes keep the current wording. Done: lab case with open browser terminal and editor shows the product names and working close actions.
