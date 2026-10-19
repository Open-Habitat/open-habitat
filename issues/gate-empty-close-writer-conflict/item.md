---
created: 2026-10-19
updated: 2026-10-19
type: bug
status: untriaged
priority: normal
provenance: agent
source_ref: taskfleet:01m59s0gver2290c0gbgedgwt1/test-failure:go-empty-close-writer-conflict
originating_run: 01m59s0gver2290c0gbgedgwt1
originating_run_kind: spinoff
related: ['@gate-load-flakes-1019']
---

# Loaded empty browser-child close test returns writer_conflict

## Description

## Observed occurrence

During loaded verification for @gate-load-flakes-1019, `go test -race -count=1 ./...` failed in `TestCloseEmptyBrowserChild/empty` at `internal/daemon/close_linux_test.go:109`: closing the empty browser-owned child returned 409 `writer_conflict` instead of 200. Complete retained log on Alder: `/var/tmp/oh-gate-load-held-reload-go.log`.

The suite ran with `umask 077`, a fresh short disk-backed TMPDIR under `/var/tmp`, and eight simultaneous Playwright workers repeating held-message reloads. Earlier full Go/race runs and gates passed this test. No close implementation or test code changed during this worker.

## Impact and limits

This required validation run is red. The failure is a definite writer-conflict response, not enough evidence to call the close implementation wrong or to retry it indiscriminately. Establish whether the close test's synthetic child has actually settled and which ownership/native-writer fence refused it. Do not weaken the product writer fence to make the fixture pass.

## Reproduction

Run `go test -race -count=1 ./...` concurrently with an eight-worker repeated host-backed browser suite. This is an intermittent observed occurrence, not a deterministic reproducer. A gateway restart test independently failed in the same run; the log contains both failures.
