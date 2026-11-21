---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: open
priority: normal
provenance: other
provenance_detail: flaky test observed during a focused check in a taskfleet run
source_ref: taskfleet:01m7zc3ems89k12d01tkmqy6f8/flake:workspace-delete-snapshot-git-comm
originating_run: 01m7zc3ems89k12d01tkmqy6f8
originating_run_kind: spinoff
lane: gate-red
lane_seq: 3
preparation: ready
---

# Workspace delete test races git's exec: person's git is seen as daemon.test under load

## Description

## Observed

During a focused `./scripts/test-focused.sh --area go --go-package ./internal/daemon`
run on 2026-11-21 (under load: other daemon tests and Pi RPC children
running in parallel), `TestWorkspaceDeleteDuringSnapshotGitInspection`
failed:

```
workspace_delete_linux_test.go:1316: person's git must remain named: [{PID:31371 Comm:daemon.test}] complete=true
```

The same test passed in a full package run minutes earlier and 3/3 times on
its own (`GOFLAGS='-run=^TestWorkspaceDeleteDuringSnapshotGitInspection$'`).
The change under test then touched only the Pi companion
(`internal/daemon/process-extension.mjs`), not workspace deletion.

## Cause

`internal/daemon/workspace_delete_linux_test.go` starts `personGit` with
`exec.Command(...).Start()` and immediately calls `settledProcessScan`,
asserting the found process's `Comm` is `git`. `Start` returns after fork;
until the child has exec'd, `/proc/<pid>/comm` is still the test binary's
name (`daemon.test`). Under load the scan wins that race, so the
assertion fails although the product code is right.

## Direction

Before scanning, wait (bounded, e.g. up to 1 s) until
`/proc/<pid>/comm` of `personGit` reads `git`, or until its `exe`
link points at `/usr/bin/git`, as the snapshot half of the test already
does by polling for the inspection process.
