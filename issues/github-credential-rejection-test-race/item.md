---
created: 2026-11-22
updated: 2026-11-22
type: bug
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m821tvxs8gs3heebgma8fjgb/test-failure:nativegh-verify-after
originating_run: 01m821tvxs8gs3heebgma8fjgb
originating_run_kind: spinoff
---

# GitHub credential rejection test races its background verifier

## Description

# GitHub credential rejection test races its background verifier

During `./scripts/test-focused.sh --area go`, the race detector reported an unsynchronized write to `Adapter.verifyAfter` in `internal/nativegh/native_test.go:1596` (`TestRejectionIsConfirmedAgainstTheSameCredential`) against a read in `Adapter.settle` (`internal/nativegh/native.go:810`). The test changes the delay from zero to an hour after two Status calls, while the background settlement goroutine can still read it. These files were unchanged by the icon-suggestion work that encountered the failure.

The observable impact is an intermittent red Go race suite; this is not evidence that production mutates the field concurrently. A subsequent complete run passed, consistent with a scheduling-dependent test failure. Synchronize the test with background verifier completion or use a separate adapter for the second credential phase instead of mutating a live timing field without synchronization. Preserve the assertion that rejection confirmation belongs to the same credential.

Reproduce with repeated race-enabled runs of the named test, using the repository's test scratch policy. The original race report identifies the test write and `settle` read; no live credentials or installations were involved.
