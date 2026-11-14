---
created: 2026-11-10
updated: 2026-11-14
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m71zxxabyvwy0h1y2tec6n4g/observed:rail-parked-row
originating_run: 01m71zxxabyvwy0h1y2tec6n4g
originating_run_kind: spinoff
lane: gate-load-flakes
lane_seq: 5
preparation: ready
closed: 2026-11-14
---

# Parked first row disappears from the running group in the rail detector spec

## Description

On the unchanged product/spec tree fa85393db on Birch, `web/tests/rail-groups.spec.ts:15` failed once in three detector executions at line 88. After creating the second conversation and refreshing, its row appeared in `rail-running`, but the first conversation's row was absent from that group. The earlier checks of the first row's parked-worker state and aged time had passed.

Command from web: `OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=sweep-focus-repeat OH_BROWSER_WORKERS=2 OH_PORT_BASE=15500 npx playwright test tests/rail-groups.spec.ts --grep 'Käynnissä rows' --repeat-each 3` (the observed run selected other focus cases alongside it). This is NOT the sweep's old tooltip-intercept failure: the refresh click completed, and the assertion could not find the first row. The same full spec passed in the initial detector baseline with seed `sweep-focus`.

The spec synthesizes parked workers by rewriting snapshot replies (`spinoffs_idle = 1`), while real host events/status still describe a conversation with no such worker. Investigate whether a later unmodified host update legitimately removes the mocked parked state, before treating this as a product disappearance. The failure is concrete, but product vs spec remains unconfirmed. Avoid forced clicks or timeouts: neither addresses the missing row.

No product/spec changes were made by this run, so this reproduces on the main source tree. Disposable raw log: `/var/tmp/load-sweep-repeat.log`. Effect: an intermittent red in the ordering detector. Follow-up from load-race-sweep, outside the original focus-return mechanism.
