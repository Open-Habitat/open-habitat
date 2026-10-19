---
created: 2026-10-19
updated: 2026-10-19
type: bug
status: untriaged
priority: normal
provenance: agent
source_ref: taskfleet:01m59w27sr3kz2jsw4h3t63car/test-failure:idle-activity-proof
originating_run: 01m59w27sr3kz2jsw4h3t63car
originating_run_kind: spinoff
---

# Loaded idle archive and resume tests fail native activity proof

## Description

## Observed failure

An additional complete Go/race run under eight-worker browser load failed two daemon idle/activity journeys. Command: `umask 077; export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX); go test -race -count=1 ./...`. Log: `/var/tmp/oh-harvest-http-recovery-go.log` on Alder, daemon package 99.8 s.

- `TestArchiveStopsIdlePiButNotBackgroundWork`, `pi_activity_linux_test.go:234`: `h.archive` returned 409 `control_uncertain`. The response alone does not identify which native-history, writer or archive observation was uncertain.
- `TestIdleTimeoutResumesOnce`, `pi_activity_linux_test.go:319`: after the idle Pi was reaped, the resumed "Jatketaan" turn did not settle within the harness's 15-second budget. Startup state was not captured in this run, so neither native-proof rejection nor a product startup race is established.

Earlier complete Go/race runs, including the concurrent Go/contracts phase of `/var/tmp/oh-harvest-clean-gate.log`, passed both cases. No activity implementation or fixture changed in the adopting run. Conservative census uncertainty is a possible shared cause, not a proven one. Capture the exact native admission/refusal state before changing product policy or adding retries, especially after Pi exit.

## Reproduction

Repeat the full Go/race suite concurrently with eight isolated synthetic browser workers. This is an intermittent observed occurrence, not a deterministic reproducer. No live user or provider data was involved.

## Impact

The required suite can go red on idle stop/resume and archive behavior under load. The adopting harvest run lands its separately verified gateway/empty-close/test synchronization repairs instead of silently widening or discarding them.

## Re-check after orphan cleanup — 2026-10-19

**Did not reproduce in 60 repetitions per test (120 top-level test executions)** on main snapshot
`d538709e00f89f714fb5c57e5b685ddef2bf90aa` (alder, other agents active).
Tests: TestArchiveStopsIdlePiButNotBackgroundWork; TestIdleTimeoutResumesOnce. Alone: 20/20 each passed, 0 failed;
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
