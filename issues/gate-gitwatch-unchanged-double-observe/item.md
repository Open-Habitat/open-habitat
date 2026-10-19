---
created: 2026-10-19
updated: 2026-10-19
type: bug
status: untriaged
priority: normal
provenance: agent
source_ref: taskfleet:01m59w27sr3kz2jsw4h3t63car/test-failure:gitwatch-unchanged-double-observe
originating_run: 01m59w27sr3kz2jsw4h3t63car
originating_run_kind: spinoff
---

# Git-watch cache test observes an unchanged workspace twice under load

## Description

## Observed failure

In the final rebased clean gate, `TestGitWatchAnswersUnchangedWorkspaceFromMemory` failed at `internal/daemon/snapshot_facts_linux_test.go:255`: "observed 2 times for an unchanged workspace". The first two immediate reads of the newly initialized synthetic Git workspace called the observe callback twice instead of reusing its first result. No files are changed between those two reads. The later ignored-file invalidation assertions were not reached.

Complete log `/var/tmp/oh-harvest-rebased-final-clean-gate.log` on Alder, revision f43cb631988e559fe58dd6eff6820d1f0c999262, tree e29e85818206d3c8ec30deefadb3b8e25c0ce75b. Daemon package 211.5 s; whole gate failed after 371 s. The browser phase concurrently had two failures described in separate issues. Earlier full Go runs, including one complete successful clean gate in the harvest run, passed this test unchanged.

## Reproduction

Repeat the full Go/race suite while the gate's eight-worker synthetic browser phase is running. The occurrence is intermittent. No git-watch implementation or test was changed by the harvest run.

## Impact and investigation

A required gate fails on the unchanged-workspace caching invariant. Inspect watcher initialization, queued setup events and registration timing before treating the observation count as a product regression or increasing timing budgets. This is not the native Pi /proc writer-census family, and no missing user-visible update or stale real workspace has been demonstrated.

## Re-check after orphan cleanup — 2026-10-19

**Did not reproduce in 60 repetitions** on main snapshot
`d538709e00f89f714fb5c57e5b685ddef2bf90aa` (alder, other agents active).
Tests: TestGitWatchAnswersUnchangedWorkspaceFromMemory. Alone: 20/20 passed, 0 failed;
confirmation concurrent with the complete Go/race suite: 20/20 passed, 0 failed.
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
