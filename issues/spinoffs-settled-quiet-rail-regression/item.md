---
created: 2026-11-08
updated: 2026-11-08
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m6y51t8b789y23r93vc2g1gx/spinoffs-quiet-rail
originating_run: 01m6y51t8b789y23r93vc2g1gx
originating_run_kind: spinoff
closed: 2026-11-08
---

# Spinoff restart browser test cannot find settled conversation in quiet rail

## Description

Observed on Birch: web/tests/spinoffs.spec.ts:387 fails at line 467, expecting the parent conversation under rail-quiet after its worker settles. Reproduced twice with the terminal-row removal and once with all changes stashed on main ancestor 97b030bb5a8e9724394bb07a25e64779c05f4533. Command: OH_BROWSER_WORKERS=2 OH_PORT_BASE=13000 ./scripts/test-focused.sh --area browser --spec spinoffs.spec.ts (umask 077, disk-backed TMPDIR). Four other cases pass. Investigate whether settled conversation classification regressed or this expectation is stale; the failure currently prevents green spinoffs coverage. No production cause established.

## Resolution

Fixed by `main-suite-red-r68b` (8.11.2026); closed on Jari's standing approval to close intake reports a landed fix covers.
