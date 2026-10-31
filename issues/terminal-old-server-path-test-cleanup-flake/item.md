---
created: 2026-10-31
updated: 2026-10-31
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed by worker during focused checks
source_ref: taskfleet:01m68j8pce6prn3t14y9bvqx9n/flake:terminal-old-server-path-tempdir
originating_run: 01m68j8pce6prn3t14y9bvqx9n
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# TestTerminalNewShellFindsInstalledToolWithOldServerPath fails intermittently in TempDir cleanup

## Description

`go test ./internal/daemon -run TestTerminalNewShellFindsInstalledToolWithOldServerPath -count=10`
fails about once in ten runs on Birch (2026-10-31), on main without changes:

    --- FAIL: TestTerminalNewShellFindsInstalledToolWithOldServerPath (0.41s)
        testing.go:1617: TempDir RemoveAll cleanup: unlinkat .../TestTerminalNewShellFindsInstalledToolWithOldServerPath.../002: directory not empty

The test's own assertions pass. The failure is the cleanup: something (the
tmux server or a shell it started) is probably still writing into the
fixture's temp directory while `t.TempDir` removes it. The focused daemon
tests then fail at random, and workers have to rerun them.
