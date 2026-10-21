---
created: 2026-10-21
updated: 2026-10-21
type: bug
status: cannot-reproduce
priority: normal
provenance: other
source_ref: taskfleet:01m5ek6zt9jh7v54nffsxk3ccv/observed-lab-held-tool
originating_run: 01m5ek6zt9jh7v54nffsxk3ccv
originating_run_kind: spinoff
closed: 2026-10-21
---

# Lab live-stage test intermittently misses the held running tool

## Description

## Description

The host-backed lab suite intermittently fails `web/tests/lab-turn-stages.spec.ts`, case `@lab live turn shows its interim reply once and runs the next stage in place`, while the fake Pi is deliberately held at its running tool. The test opens `turn-work-toggle` and then finds zero `[data-tool-name="bash"][data-state="running"]` rows for the full existing five-second assertion window. This makes required lab validation unreliable; it is not yet evidence of a live product defect.

## Reproduction and evidence

Run `cd web && npx playwright test --config playwright.lab.config.ts` through the configured Cedar runner, with `umask 077` and `TMPDIR=/var/tmp`.

Observed in Taskfleet run `01m5ek6zt9jh7v54nffsxk3ccv`, based on `6266a39f` plus cherry-picked wording commit `89546276` and synchronization edits only in server-version-reload/mutation-layer. The failing lab spec was unchanged. Initial lab suite: 61 passed, 1 failed, 41 s routed; log `/var/tmp/wording-land-lab.log` on Alder. Failure was at line 234, expected one running bash row, received zero. The interim reply and working status assertions before the click had passed. Finally cleanup released the fixture hold only after the assertion failed.

Unchanged focused spec with `--repeat-each 10 --trace on` subsequently passed all 30 tests; `/var/tmp/wording-land-stages-repro.log`. A whole lab rerun with `--trace on` also passed all 62 cases (46 s routed / 44.4 s Playwright), `/var/tmp/wording-land-lab-trace.log`. The initial error context was replaced by the subsequent successful run, so no failing trace is available. The fake Pi hold is bounded at 90 seconds, well beyond the failing assertion; no cause is confirmed. Inspect disclosure state, native-history/live-tail reconciliation and component identity if it recurs; do not just increase the assertion timeout or remove it.

## Acceptance Criteria

- [ ] Identify why the held running tool can be absent after disclosure, using failing browser evidence.
- [ ] Synchronize the test or fix the product according to evidence without removing behavior assertions, adding sleeps or raising timeouts.

## Decisions

### 2026-10-21T16:09:48Z · @jari

Jari 2026-10-21: close as cannot-reproduce — single untraced failure; later 30/30 focused repeats and lab ×5 (310 runs, f4db6e69) passed. Reopen with a failing trace if it recurs.
