---
created: 2026-11-13
updated: 2026-11-13
type: bug
status: open
priority: normal
provenance: other
provenance_detail: pilot.29 clean gate failure (taskfleet run)
source_ref: taskfleet:01m79mf2ybkz1qpjbr18wj5ng3/gate-failure:catalog-background-outlives-stop
originating_run: 01m79mf2ybkz1qpjbr18wj5ng3
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# Integration catalog background work outlives daemon shutdown

## Description

`TestMicrosoftConfigWithATokenPerRootMigratesAtStart` failed in pilot.29's clean gate: "TempDir
RemoveAll cleanup: ... directory not empty", meaning something still wrote into the home after
the test returned. Reproduced ~9/400 under load.

Cause (product): `Catalog.Start` launches its align / interrupted-resume / Microsoft recovery and
migration goroutine, and the login drivers run in their own goroutines, but nothing waited for
them. After shutdown (context cancelled) a recovery or migration still finished its step
(`finishResume`, `reconcile`), and in the daemon the process could exit in the middle of that
step. Tests reproduced the shutdown sequence by hand without waiting either.
