---
created: 2026-10-19
updated: 2026-10-20
type: bug
status: cannot-reproduce
priority: normal
provenance: agent
source_ref: taskfleet:01m59w27sr3kz2jsw4h3t63car/test-failure:http-only-receipt-recovery
originating_run: 01m59w27sr3kz2jsw4h3t63car
originating_run_kind: spinoff
closed: 2026-10-20
---

# HTTP-only receipt recovery gate has a setup and final composer race

## Description

## Observed failure

The clean gate failed at `web/tests/browser-conversation.spec.ts:2167`, "lost accepted reply recovers on HTTP snapshot without an event", before any POST /send. The test created a conversation, waited for an enabled composer, installed snapshot/status outage handlers and froze the page clock. A late creation-invalidated snapshot then hit the outage, taking the UI offline while Playwright attempted Send. Log `/var/tmp/oh-harvest-clean-gate.log` (normal browser 252 passed, 3 skipped, 1 failed; Go/contracts passed). Trace extracted on Alder to `/var/tmp/oh-trace.gQNBYj48` with `scripts/inspect-trace.sh`; it shows create/status 200 followed by the failed snapshot and no send.

An experiment enabled the snapshot/status fault only after the send counter increments, and explicitly refreshed once before Send. It reached the original recovery assertions, but 9/20 repetitions failed the final "next deliberate message" Send-enabled check (20 paired warm-return tests passed). Trace `/var/tmp/oh-trace.YRNjDthA` shows accepted idle receipts being repeatedly fetched while the new composer draft disappears and Send remains disabled; raw status payloads remain idle/accepted. Restoring the page clock only after explicit HTTP recovery had been proven did not resolve it: 11/20 repetitions still failed the final enabled check. Logs `/var/tmp/oh-harvest-http-recovery-proof.log` and `/var/tmp/oh-harvest-http-recovery-scheduling.log`. Those experiments were discarded, not landed as a repair.

The first failure is a fixture fault-window race. The later behavior needs separate diagnosis of recovery/status refresh, draft remount and frozen clock; the trace is not enough to call it a product regression. Do not weaken exactly-one-send, retained-draft or next-deliberate-write assertions to quiet the gate. No production recovery behavior was changed.

## Reproduction

Run this test repeatedly at eight workers, alongside the warm-controlled-return journey and Go/race suite, using independent synthetic browser hosts. `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright OH_PORT_BASE=18200 npm run test:e2e --prefix web -- browser-conversation.spec.ts --grep 'lost accepted reply recovers on HTTP snapshot without an event|warm controlled return' --repeat-each=20 --workers=8`. The original failure is intermittent; the experimental final-composer failures are evidence for investigation, not a committed reproducer.

## Impact

The clean gate can fail on HTTP-only recovery even while the three harvested load repairs and the two newly accepted blockers pass. The harvest run preserves those verified improvements and leaves this distinct recovery/fixture issue untriaged and unlaned. Synthetic homes and fake providers only; no live-server or real-message loss is established.

## Further occurrence

The final rebased gate on f43cb631988e559fe58dd6eff6820d1f0c999262 (tree e29e85818206d3c8ec30deefadb3b8e25c0ce75b) reproduced the original pre-send detached/disabled button timeout. Log `/var/tmp/oh-harvest-rebased-final-clean-gate.log`; this journey remains unchanged after the discarded experiments.

## Re-check after orphan cleanup — 2026-10-19

**Did not reproduce in 30 browser repetitions** on main snapshot
`d538709e00f89f714fb5c57e5b685ddef2bf90aa` (alder, other agents active).
Tests: lost accepted reply recovers on HTTP snapshot without an event. Alone: 10/10 passed, 0 failed;
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
