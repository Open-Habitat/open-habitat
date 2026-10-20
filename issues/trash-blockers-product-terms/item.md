---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: fixed
priority: normal
lane: trash
lane_seq: 2
collision: [internal/daemon/trash]
closed: 2026-10-20
---

# Workspace deletion blockers are shown as raw processes (bash, MainThread) instead of the person's terminal and editor

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 deleting workspace issuectl got: 'Prosessi bash (PID 1045372) on työtilan hakemistossa' and 'Prosessi MainThread (PID 1204433) …'. On the server, 1045372 is the browser terminal's shell (parent: the daemon-started tmux at /run/user/21032/open-habitat/tmux.sock, cwd ~/src/issuectl); MainThread was almost certainly the workspace editor (code-server/node) — both started by the person through Open Habitat, so blocking is right, but the dialog must name them in product terms ('Pääte issuectl-työtilassa', 'Editori on auki tässä työtilassa') and offer the action that resolves them (close the terminal / stop the editor, then re-check), instead of PIDs. Unknown processes keep the current wording. Done: lab case with open browser terminal and editor shows the product names and working close actions.

## Acceptance Criteria

- [x] Native product terminal/editor processes are named in product terms; unrelated processes keep the original wording and blocking checks remain intact.
- [x] Explicit terminal close and editor-wide stop actions request a fresh deletion check without deleting implicitly.
- [x] Independent security/process-lifetime review findings are assessed and addressed.
- [x] Focused checks pass, with any pre-existing failures demonstrated against unchanged main and all limits disclosed.

## Result

Implementation, evidence, review decisions and coverage limits: [result.md](result.md).
