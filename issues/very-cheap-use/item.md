---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: clean gate run by worker
source_ref: taskfleet:01m5q3xpe3f8vrd4ryg9am21zh/gate-race:integrations-unreadable-inventory
originating_run: 01m5q3xpe3f8vrd4ryg9am21zh
originating_run_kind: spinoff
lane: unlaned
collision: [internal/daemon/integrations]
preparation: ready
closed: 2026-10-24
---

# Data race in TestUnreadableInventoryChangesNothing fails the clean gate

## Description

`go test -race ./internal/daemon/integrations` fails in `TestUnreadableInventoryChangesNothing` (seen in the clean gate on 2026-10-24, tree 77676cec, and reproduced with `-race -count=5 -run TestUnreadableInventoryChangesNothing`).

The race detector reports a write at `integrations_linux_test.go:823` (the test appends `brokenEntry` to `c.entries`) against a read in `catalog_linux.go:582` (`Catalog.entry`, via `accounts` from the background `alignAll` goroutine started by `testCatalog`/`Start`). The test mutates the catalog's entry list while the catalog's own goroutines read it without the write lock.

Effect: the clean gate's Go phase fails and writes no receipt, independent of the change under test. Fix belongs in the test (build the catalog with the broken entry from the start, or mutate under the lock the readers use).

## Acceptance Criteria

- [x] Identify whether the race is in product code or the fixture, and remove its cause.
- [x] Run the full integrations package 20 times under the race detector with umask 077 and a private disk-backed TMPDIR.

## Result

The race is test-only. The pre-fix focused run reproduced the test's assignment to `c.entries` racing `Catalog.entry` in the startup `alignAll` goroutine. Production constructs its catalog from `Production()` once in `newIntegrations`; no product path mutates the entries afterward. Taking `c.write` around the test assignment would not fix this, because `alignAll` reads the inventory before taking that lock.

The fixture now seeds the native IMAP account and its skill using an unstarted catalog, then starts a separate catalog whose fixed entry list already includes the unreadable provider. It retains the HTTP 503 and byte-for-byte skill preservation checks, now including startup reconciliation, and explicitly verifies that the baseline skill exists and contains the connected account. No production change is needed.

Validation on the changed test source based on `aee13af1`:

- Before fix: `umask 077; export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX); go test -race -count=5 -run '^TestUnreadableInventoryChangesNothing$' ./internal/daemon/integrations` — failed with the expected entry-list data race (`TMPDIR=/var/tmp/oh-KEN1`).
- After fix: `umask 077; export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX); go test -race -count=20 ./internal/daemon/integrations` — passed, 589.973 seconds (`TMPDIR=/var/tmp/oh-MRwJ`). Optional native-runtime tests retain their prerequisite skips; this is package/race evidence, not live-provider acceptance.
- `git diff --check` — passed.
- `issuectl doctor --json` — no schema/transition errors; existing repository advisories concern 1 large binary and 1065 non-AVIF images.
