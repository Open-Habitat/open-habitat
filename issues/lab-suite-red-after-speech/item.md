---
created: 2026-10-28
updated: 2026-10-28
type: bug
status: fixed
priority: high
provenance: other
provenance_detail: conductor full lab-suite run
source_ref: taskfleet:01m60r1fawvv8rgv07ztqxm9xm/lab-suite-817e9462
originating_run: 01m60r1fawvv8rgv07ztqxm9xm
originating_run_kind: spinoff
closed: 2026-10-28
---

# Lab browser suite: 9 failures on main 817e9462

## Description

The conductor ran the whole lab browser suite on main 817e9462 (`./scripts/test-focused.sh --area browser --lab`, Birch, 2026-10-28): 142 passed, 9 failed.

- `lab-composer-area.spec.ts:122` — mode chip not focused after tabbing from the file picker.
- `lab-composer-area.spec.ts:313` — phone bottom row has one more hidden label than expected.
- `lab-english-url-paths.spec.ts:13` — settings navigation lists `/settings/speech` and `/settings/speech-key`.
- `lab-skill-invocation.spec.ts:9` (all six sizes) — timeout clicking `history-block-load` in the skill panel.

Goal: suite green, fixing the test where its expectation is stale and the product where it regressed.
