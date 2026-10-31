---
created: 2026-10-31
updated: 2026-10-31
type: bug
status: fixed
priority: normal
provenance: agent
source_ref: taskfleet:01m68jnnf7cv1yj08bdm89v7wy/flake:editor-roundtrip
originating_run: 01m68jnnf7cv1yj08bdm89v7wy
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-10-31
---

# TestEditorFilesRoundTripAndConflict flaked again in a full internal/daemon run

## Description

## Description

Second sighting of the flake recorded in the closed `amazingly-long-train`
(cannot-reproduce): on 2026-10-31 on Birch, a full `./scripts/test-focused.sh
--area go --go-package ./internal/daemon` run failed only
`TestEditorFilesRoundTripAndConflict (0.00s)`. The failure message was not
captured. The test passed alone 3x and in two full package reruns right after.
The branch touched only `internal/daemon/terminal_linux_test.go`, which is
unrelated to the editor.

That issue said a second sighting makes it worth fixing. The test compares
version tokens across two quick saves of the same file ("rename changes inode
ctime"), so a coarse or equal timestamp between saves is a plausible
suspect. Unverified.
