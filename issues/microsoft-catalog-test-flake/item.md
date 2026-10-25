---
created: 2026-10-25
updated: 2026-10-25
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m5rmvd1wntb0jpmf5n99p992/gate-flake:microsoft-catalog-remove
originating_run: 01m5rmvd1wntb0jpmf5n99p992
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-10-25
---

# Microsoft catalog removal test flakes with native_unavailable under gate load

## Description

## Description

Observed 2026-10-25 in a full clean gate (`OH_PORT_BASE=15300 ./scripts/ci-local.sh --clean --json`) on Alder, on the tree of the `declared-admin-binds-at-sign-in` branch, which does not touch `internal/daemon/integrations`. Load average was about 27 during the Go/contracts phase.

```
--- FAIL: TestMicrosoftCatalogRelaysOneCodeAndSupervisesChoice (1.17s)
    microsoft_linux_test.go:405: 503 map[error:map[code:native_unavailable correlation_id:req_00000000 message:Request could not be completed retryable:false] schema_version:1]
FAIL	github.com/Open-Habitat/open-habitat/internal/daemon/integrations	34.442s
```

Line 405 is the account `DELETE` (remove, `delete_directories: false`) after the sync was supervised, which answered 503 `native_unavailable`. Rerun in isolation, `go test ./internal/daemon/integrations -run TestMicrosoftCatalogRelaysOneCodeAndSupervisesChoice -count=5` passed all five times, so the failure looks timing or load dependent (perhaps the supervised sync child not yet in a removable state).

## Impact

A failed gate writes no receipt, so this flake can block a gated release and costs a rerun of the whole gate.

## Goal

Find what makes the remove return `native_unavailable` under load. Fix the test's wait or the product race, whichever it turns out to be.
