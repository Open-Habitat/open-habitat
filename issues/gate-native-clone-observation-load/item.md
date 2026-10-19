---
created: 2026-10-19
updated: 2026-10-19
type: bug
status: untriaged
priority: normal
provenance: agent
source_ref: taskfleet:01m59w27sr3kz2jsw4h3t63car/test-failure:native-clone-observation
originating_run: 01m59w27sr3kz2jsw4h3t63car
originating_run_kind: spinoff
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
