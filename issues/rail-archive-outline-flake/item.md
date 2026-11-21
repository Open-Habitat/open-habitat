---
created: 2026-11-16
updated: 2026-11-21
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: observed during gate-red-v013 verification
source_ref: taskfleet:01m7hgja0zwn7w1d9te2yww0xp/observed:rail-archive-outline-flake
originating_run: 01m7hgja0zwn7w1d9te2yww0xp
originating_run_kind: spinoff
lane: test-stability
lane_seq: 4
preparation: ready
closed: 2026-11-21
---

# rail-archive outline spec fails intermittently on a CSS assertion

## Description

`web/tests/rail-archive.spec.ts:16` ("rail titles have no field outline at rest, selected, hovered or focused") failed once with `expect(locator).toHaveCSS(expected) failed` in a focused run of four archive/settings spec files with three Playwright workers on a loaded host (16.11.2026). It passed on the immediate rerun (4/4 with `--repeat-each 4`). The fix for `archive-restore-damaged-history-banner` (7ecb34fe) also recorded this assertion failing once and passing on rerun with no product change.

So it fails intermittently, probably on timing: a CSS state is read before a hover/focus/selection transition has settled. The failing step and value were not kept. Next step: rerun under `OH_CPU_THROTTLE=4 OH_REPLY_DELAY_MS=250 --repeat-each 20 --trace retain-on-failure`, find which state's outline assertion fails, and make the spec wait for that state, with no sleep or longer timeout.

Found while fixing gate-red-v013. That work did not touch rail title styling.

## Resolution

### 2026-11-21T17:43:16Z · @issuectl

Test ran out of time under load; per-state checks collapsed into one polled read. See result.md.
