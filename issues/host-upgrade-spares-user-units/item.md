---
created: 2026-10-25
updated: 2026-10-25
type: bug
reporter: conductor
status: fixed
priority: normal
related: ['@upgrade-keeps-agent-processes']
lane: unlaned
collision: [internal/hostop]
preparation: ready
closed: 2026-10-25
---

# host upgrade stops every user unit and can get stuck closed

## Description

Found by the `upgrade-keeps-agent-processes` research (2026-10-25, its
`research.md` §§ 2–5, reproduced on the test server): the product's
`host upgrade` (used on Birch and the pilot) stops every account's user
manager units, including the browser shell's tmux, the editor, Taskfleet
supervisors and workers and Fleetrepo timers, and then fails to start
`systemd-run` transient units again, so an upgrade with any live Taskfleet run
or browser shell stays stuck in its closed state. This contradicts Jari's
2026-10-19 decision that the shell and editor outlive daemon restarts and
upgrades (`broker-enable-linger`, `research-shell-editor`).

Fix (research option A, adopted as a defect fix, not a new architecture):
`host upgrade` stops and restarts only the product's system units and leaves
user managers alone; it drops the exact-set verification of user units,
since surviving workloads start and stop units during the upgrade; live
daemons still need interruption approval and their active turns are reported
as today. Correct the `docs/operations.md` sentence. Not in scope: keeping
browser-Pi turns alive across a daemon restart (option B, Jari's decision).

## Acceptance Criteria

- [x] `host upgrade` leaves user units running; a live transient user unit
  (tmux, Taskfleet supervisor) survives an upgrade and the upgrade completes.
- [x] Tests at the operator boundary, and a real-systemd check (qualification
  VM or disposable test host), with evidence in `result.md`.

