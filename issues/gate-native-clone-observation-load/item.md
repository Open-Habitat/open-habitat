---
created: 2026-10-19
updated: 2026-10-20
type: bug
status: cannot-reproduce
priority: normal
provenance: agent
source_ref: taskfleet:01m59w27sr3kz2jsw4h3t63car/test-failure:native-clone-observation
originating_run: 01m59w27sr3kz2jsw4h3t63car
originating_run_kind: spinoff
closed: 2026-10-20
---

# Loaded native clone observations disagree before explicit removal

## Description

## Observed failure

An additional complete Go/race run under eight-worker browser load failed two native clone-observation cases, after the main clean gate had passed its Go phase. Command: `umask 077; export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX); go test -race -count=1 ./...`. Log: `/var/tmp/oh-harvest-http-recovery-go.log` on Alder, daemon package 99.8 s.

- `TestCloneInterruptedAfterRestartAndExplicitActions/remove`, `github_jobs_linux_test.go:393`: after successful interrupted observation, explicit removal returned 409 `not_interrupted`. The following restart subcase then failed at start with `checkout_exists` because the failed remove left the shared fixture checkout. That latter failure is cascading, not a separate root cause.
- `TestObserveWithNativeGit`, `github_observe_linux_test.go:121`: a freshly initialized unborn clone with canonical origin was classified `conflict`, size 0, instead of interrupted with positive size.

Earlier complete Go/race runs, including the concurrent Go/contracts phase of `/var/tmp/oh-harvest-clean-gate.log`, passed these cases. No clone implementation or tests changed in the adopting run. These failures concern native clone observation/explicit destruction, not gateway HTTP body consumption or empty-conversation close. Inspect the exact failing native safety/observation proof before adding retries or weakening destruction checks. The evidence establishes intermittent test failures, not live-host data loss.

## Reproduction

Repeat the full Go/race suite concurrently with eight isolated synthetic browser workers. This was an observed intermittent occurrence, not a deterministic reproducer. Synthetic homes, Git fixtures and providers only; no live users or services involved.

## Impact

Required validation can fail under load. The harvest run preserves the verified bounded improvements and records this separate native-clone blocker for a later lane-or-close decision.

## Re-check after orphan cleanup — 2026-10-19

**Did not reproduce in 60 repetitions per test (120 top-level test executions)** on main snapshot
`d538709e00f89f714fb5c57e5b685ddef2bf90aa` (alder, other agents active).
Tests: TestCloneInterruptedAfterRestartAndExplicitActions; TestObserveWithNativeGit. Alone: 20/20 each passed, 0 failed;
confirmation concurrent with the complete Go/race suite: 20/20 each passed, 0 failed.
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
