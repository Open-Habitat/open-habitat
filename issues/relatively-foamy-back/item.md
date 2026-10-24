---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: gate run in taskfleet worker
source_ref: taskfleet:01m5phrd9kn11x3wa2mz8qcdqk/gate-flake:start-here-focus
originating_run: 01m5phrd9kn11x3wa2mz8qcdqk
originating_run_kind: spinoff
---

# Gate flake: start-here 390 dark loses composer focus after the safe draft

## Description

Observed once in the full gate (`./scripts/ci-local.sh --clean --json`, 2026-10-24,
branch of `stop-turn-flicker`, which does not touch the start page):

`tests/start-here.spec.ts:8` "@lab @a11y authored start page and safe draft 390 dark"
failed at line 130, `await expect(field).toBeFocused()` on `message-input`: the
field held the expected start-page draft but was not focused within 5 s
("inactive"). The same case passed 8/8 when rerun alone (default and repeat-each 4).

Likely a focus race under the gate's parallel load. It makes the gate red
without a product change, so the gate needs a rerun.
