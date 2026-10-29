---
created: 2026-10-29
updated: 2026-10-29
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: pilot.14 clean gate run
source_ref: taskfleet:01m62ynpgv06yv7g72pe6r66pe/nativegh-status-test-races-scheduled-check
originating_run: 01m62ynpgv06yv7g72pe6r66pe
originating_run_kind: spinoff
---

# nativegh status test races the adapter's scheduled re-check (data race under -race)

## Description

The second pilot.14 clean gate on Birch (29.10. 06:38, main `f93e6846`) failed
`internal/nativegh` with the race detector: `TestStatusFreshSyntheticIdentityAndErrors`
writes the fake's `apiErr` (native_test.go:194) while the adapter's own scheduled
re-check, armed by the first rejection with `verifyAfter = 0` since `63d8a265`,
reads it in `fake.Run` from a background goroutine. The fake has no
synchronisation. The product's background check is intended; the test fake is
not safe for it. Reproduced 9 times in 600 runs of that test with `-race`.
