---
created: 2026-10-19
updated: 2026-10-19
type: bug
status: untriaged
priority: normal
provenance: agent
source_ref: taskfleet:01m59w27sr3kz2jsw4h3t63car/test-failure:browser-empty-close-refusal
originating_run: 01m59w27sr3kz2jsw4h3t63car
originating_run_kind: spinoff
---

# Real-controller browser empty close intermittently returns writer_conflict

## Description

## Observed failure

The final rebased clean gate failed the unchanged browser test `browser-conversation.spec.ts:2447`, "empty browser conversation closes without confirmation". It creates an empty real-controller conversation, waits for the enabled Close control, clicks it, and expects the header control to disappear. The route moved optimistically toward the workspace but the control returned/remained; the five-second assertion found one Close button instead of zero.

The retained trace confirms POST /close returned 409 `writer_conflict`. Extracted trace `/var/tmp/oh-trace.C89fM1NJ`, original `web/test-results/browser-conversation--brow-1b8f0-closes-without-confirmation-chromium/trace.zip`. Complete gate log `/var/tmp/oh-harvest-rebased-final-clean-gate.log` on Alder, revision f43cb631988e559fe58dd6eff6820d1f0c999262, tree e29e85818206d3c8ec30deefadb3b8e25c0ce75b, 371 s.

The isolated unit census repair in @gate-empty-close-writer-conflict does not change the production controller's host-wide /proc default. Earlier loaded browser close repetitions and two completed browser gates passed this journey, but the real controller can still refuse a later uncertain census or retained writer lock. The trace alone does not distinguish those two branches. Capture the exact refusal branch before changing native safety or retrying a close, especially after child exit. No product race or competing writer is yet proven.

## Reproduction

Repeat the original browser case at eight workers concurrently with the full Go/race suite, using synthetic isolated browser hosts. This is an observed intermittent failure, not a deterministic reproducer.

## Impact

The clean gate remains intermittently red on actual controller empty-close admission. Production writer fences must not be weakened to satisfy a synthetic test. No live user, data loss or provider behavior is established.

## Re-check after orphan cleanup — 2026-10-19

**Did not reproduce in 30 browser repetitions** on main snapshot
`d538709e00f89f714fb5c57e5b685ddef2bf90aa` (alder, other agents active).
Tests: empty browser conversation closes without confirmation. Alone: 10/10 passed, 0 failed;
confirmation concurrent with the complete Go/race suite: 10/10 passed, 0 failed.
An additional first loaded batch had the same focused pass counts, but its
full-suite command had a package-discovery race and gateway 503; the two
confirmation full Go/race cycles both passed. Totals above include that extra
focused batch, excluding the single passing execution in the gate.

The full clean gate nevertheless **failed**: normal browser 251 passed /
3 skipped / 4 failed (two process-tray and two queued-send cases); Go/race
failed native bridge-ready and restart provider-request tests. This issue's
cases passed that gate. Gate load average reached 42.83, available RAM fell
to 947 MiB. The host scan before/after reported the same one pre-existing
stray, no new reported hosts; nothing killed. Not a causal proof or a zero-load
experiment. Status/lane/metadata intentionally unchanged for Jari's triage.

Commands, counts, all gate failures, before/after host details, resource ranges
and local raw-log location: [shared re-check report](../gate-load-flakes-1019/recheck-2026-10-19.md).
Originating investigation run: `01m5a019kts9kcfpp1fxa49b42`.
