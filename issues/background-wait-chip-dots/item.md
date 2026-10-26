---
created: 2026-10-26
updated: 2026-10-26
type: feature
reporter: jari
status: open
priority: normal
lane: ui-impl
lane_seq: 3
collision: [web/src/components/BackgroundStrip.tsx, web/src/app/]
preparation: ready
blocked_by: ['@settings-three-pages']
---

# Worker chip shows waits as dots; expected exits read neutral

## Description

Implement Jari's accepted direction from proto-background-waits (direction 3's dots on the worker chip, direction 2's neutral exit codes; prototype in issues/proto-background-waits/prototypes/background-waits): a wait shows on the run it waits for, a run nobody waits on is visible as such, waits leave the terminal chip, and an exit the agent expected (wait timeout/check-in, watcher skipped) is not shown as a crash.

## Acceptance Criteria

- [ ] As accepted; tests at the presentation layer; screenshots for Jari.

