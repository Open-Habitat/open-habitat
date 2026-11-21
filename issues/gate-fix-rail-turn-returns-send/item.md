---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: release gate flake
source_ref: taskfleet:01m7zx3v09s1jhxyh9xp692gtz/gate-flake:rail-turn-returns
originating_run: 01m7zx3v09s1jhxyh9xp692gtz
originating_run_kind: spinoff
closed: 2026-11-21
---

# Typing over a given-back send can be cleared when the send proves accepted

## Description

`web/tests/rail-turn-returns.spec.ts` failed in one of every four to eight runs
with two browser workers: in the second conversation pass the writer tab
filled the composer, but Lähetä stayed `aria-disabled` until the test
timed out. The clean release gate runs without retries, so this blocked
the v0.1.4 gate.

Reproduce: run the spec repeatedly with `OH_BROWSER_WORKERS=2`.
