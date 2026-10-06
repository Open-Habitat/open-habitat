# Recoverable workspace deletion — blocked, not shipped

This run did not enable deletion or close the issue. It prototyped the quarantine and native-effect observer locally, then discarded the uncommitted runtime changes when source inspection exposed gaps that would make an enabled delete unsafe. The existing disabled UI and no-delete route remain intact.

## Evidence and unresolved behavior

- `internal/daemon/pi_rpc_linux.go` describes `piRPC.close()` as bounded but explicitly **not** proving native tool exit or settled Pi history. `internal/daemon/handoff_linux.go` constructs the workspace handler independently of the conversation controller; the current handler cannot verify managed-session settlement. Inspecting `/proc/<pid>/cwd` and `/proc/<pid>/fd` would not settle Pi history, and unreadable PIDs and a process starting after the scan must be treated as unknown rather than safe.
- Discovery distinguishes only linked worktrees whose Git-directory reference can be resolved beneath `~/src`. Git worktrees and Taskfleet-owned worktrees elsewhere are invisible to that scan; `git worktree list` alone does not establish Taskfleet ownership, so such effects must block deletion. The prototype conservatively blocked all Git control directories but did not solve the observer or ownership requirement.
- A durable quarantine intent written before `renameat2`, a post-rename inode comparison and `RENAME_NOREPLACE` restoration are necessary but insufficient. The prototype did not safely coordinate an active conversation starting between observation and quarantine, recover incomplete journal temp files, or reliably report persistent stages after disconnection. Also, a pre-unlink stat does not atomically compare the inode being unlinked, so concurrent same-UID mutations during recursive removal require additional handling. Shipping it would have risked silently deleting or stranding native data.

## Validation and limits

`TMPDIR=/var/tmp go test ./internal/daemon -run TestWorkspaceManagement$ -count=1` passed against the *temporary prototype*, but proved only that the pre-existing workspace management test still ran. The prototype was removed; no runtime, browser, contract, test, or packaged input changes remain. The clean gate was **not run**: it could not validate an implementation that was not safe to commit. No race, crash, partial-result, or disconnection evidence was obtained. This is not an acceptance result.

## Next action

Coordinate deletion admission with the conversation controller so it cannot start a managed session during cleanup, and expose a reliable settled-history/exit check. Design and test a durable quarantine recovery journal with injected crashes at each sync/rename/unlink boundary; cover source-name and nested-entry swaps using descriptor-pinned operations and conservative residual reporting. Observe mounts and process references fail-closed, classify Git worktrees including out-of-source and Taskfleet worktrees as unknown unless ownership can be proven, then build the UI confirmation and stage resume. Only enable delete after deterministic tests, independent critical review, assessment and the clean gate.
