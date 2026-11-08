---
created: 2026-11-08
updated: 2026-11-08
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m6y4rht03925khrrnctctszy/test-failure:startup-background-control
originating_run: 01m6y4rht03925khrrnctctszy
originating_run_kind: spinoff
closed: 2026-11-08
---

# Queued-send Stop-before-start browser case fails on background-work control

## Description

## Observed failure

The named queued-send browser case `@lazy-resume Stop before Pi runs returns the waiting message to the field and Pi never receives it` fails at web/tests/queued-send.spec.ts:202: `background-work` has count 1, expected 0. The message is still waiting for Pi, but a background-work control is present. This breaks the focused queued-send suite and leaves the rest of this Stop-before-start journey untested.

Reproduced on unmodified main fb1c9c0db in a disposable git archive, with the same fixture dependencies, ordinary umask 077 and OH_BROWSER_WORKERS=2. Command: `OH_PORT_BASE=12400 ./scripts/test-focused.sh --area browser --spec queued-send.spec.ts --tag 'Stop before Pi runs'`. Also occurred in the queued-steer layout worker (13 other queued-send cases pass).

Determine whether the current background-work control is deliberately available before Pi starts; if so, narrow the stale assertion to the forbidden startup/process indicator rather than removing Stop coverage. Otherwise restore the intended suppression. No claim about real Pi or a live installation is made.

## Resolution

Fixed by `main-suite-red-r68b` (8.11.2026); closed on Jari's standing approval to close intake reports a landed fix covers.
