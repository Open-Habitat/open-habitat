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
