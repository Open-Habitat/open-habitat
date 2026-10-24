---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: clean gate run by worker
source_ref: taskfleet:01m5q3xpe3f8vrd4ryg9am21zh/gate-race:integrations-unreadable-inventory
originating_run: 01m5q3xpe3f8vrd4ryg9am21zh
originating_run_kind: spinoff
---

# Data race in TestUnreadableInventoryChangesNothing fails the clean gate

## Description

`go test -race ./internal/daemon/integrations` fails in `TestUnreadableInventoryChangesNothing` (seen in the clean gate on 2026-10-24, tree 77676cec, and reproduced with `-race -count=5 -run TestUnreadableInventoryChangesNothing`).

The race detector reports a write at `integrations_linux_test.go:823` (the test appends `brokenEntry` to `c.entries`) against a read in `catalog_linux.go:582` (`Catalog.entry`, via `accounts` from the background `alignAll` goroutine started by `testCatalog`/`Start`). The test mutates the catalog's entry list while the catalog's own goroutines read it without the write lock.

Effect: the clean gate's Go phase fails and writes no receipt, independent of the change under test. Fix belongs in the test (build the catalog with the broken entry from the start, or mutate under the lock the readers use).
