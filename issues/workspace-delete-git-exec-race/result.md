# Result

The person's Git now reads a separate synthetic config FIFO. The test opens a hold descriptor before installing an inotify `IN_OPEN` watch, starts Git, and waits on that descriptor with a one-second deadline. Only Git opens that watched FIFO afterwards, so the event proves it reached config loading after exec; keeping the FIFO empty holds it there for the process scan. No new sleeps or retries. Descriptors and the child are cleaned up on failure as well as success. Production code is unchanged.

## Validation

On the source tree in the commit carrying this result, under `umask 077`, the scratch lease and bounded `timeout`:

- `GOFLAGS='-run=^TestWorkspaceDeleteDuringSnapshotGitInspection$ -v -exec=/var/tmp/agent-scratch/three-gate-repeat/repeat20' ./scripts/test-focused.sh --area go --go-package ./internal/daemon`: 20/20 passed. The focused runner hardcodes `-count=1`, so the disposable exec wrapper runs `exec "$@" -test.count=20`, overriding the binary's count while retaining the runner's short private TMPDIR and prerequisite setup. No failed-run retries.
- `GOFLAGS='-run=TestWorkspaceDelete|TestTrash|TestProductBlockersUseNativeAncestryNotComm' ./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed.
- `./scripts/test-focused.sh --area web`: passed lint, TypeScript, catalog checks and all 240 test files / 1,950 tests. An earlier attempt exposed private-field access in the lint fix; the fixture now returns its pager directly and the complete check was rerun successfully.

Logs: `/var/tmp/agent-keep/three-gate-red-fixes/` (`go-repeat.log`, `go-focused.log`, `web-fast.log`). These are synthetic tests, not live installation evidence. No browser suite or clean gate was run, as requested.

Self-review was proportionate: only test code changed, with no daemon state, contract, session or authorization changes. Checked FIFO event ordering, bounded waiting, cleanup, and unchanged blocker assertions.

## Decisions for later review

Used a kernel FIFO-open signal instead of polling `/proc/comm`: it proves Git reached the intended blocking point without sleeps or retries. No product decision was needed.
