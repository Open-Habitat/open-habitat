---
created: 2026-11-24
updated: 2026-11-24
type: bug
status: untriaged
priority: normal
provenance: agent
source_ref: taskfleet:01m85ars0xxa88g6mmj6wb118f/observation:rewind-switch-deletion-under-load
originating_run: 01m85ars0xxa88g6mmj6wb118f
originating_run_kind: spinoff
---

# Rewind switch can leave a deleted file in place and still report success under load

## Description

## Observed

In a clean gate on an 8-core host under the gate's own load,
`TestTurnSnapshotsThroughPinnedPi` (`internal/daemon/turn_snapshots_native_linux_test.go`)
failed after "return to the replaced continuation with its files" (`switch`,
`files: true`). The switch answered 200 and three of the four files came back
as the continuation had left them, but a file that continuation had deleted
(`old.txt`, removed by `rm` in a shell command) was still present with its
original content. The rewind before it had answered `restored: 4`.

The same test passed 22 of 22 runs under 16 CPU hogs, and the gate's other
checks passed.

## Likely mechanism (not confirmed)

The rewind extension returns snapshot-covered files through the turn-snapshot
module's undo point (`restoreWithUndo`). That module captures the working tree
with several Git processes under `timeBudgetMs: 2_000`
(`internal/daemon/turn-snapshots/src/turn-snapshots/store.ts`), and when the
budget runs out it records no snapshot instead of failing. On a loaded host
the undo point can then be missing or partial: per-file copies still restore
edited files, but a deletion only the snapshot knew about is not replayed, and
the switch still reports success. The test checks only the switch's status
code, not its `file_errors`.

## Why it matters

A person returning to a replaced continuation is told it worked while a file
the agent had deleted is back. On a busy machine (several conversations, a
build) a 2 s budget for a person's explicit restore is easy to exceed.

## To decide

Whether a person-initiated restore should be bound by the recorder's per-turn
budget, and whether a missing undo point should make the switch report the
files it could not return instead of success.
