# Result

## Cause

A test race, not a product one. After the folder choice, the login worker
publishes `completed` (deliberately before reconciliation, so a cancellation
cannot report failure while keeping tokens) and then runs `c.reconcile()`
under `c.write`. Reconciliation starts the sync client, creates the boot
signal and finally writes the skill with `writeFileAt`, which fsyncs. The test
treated "completed + sync supervised + boot signal present" as the end of the
worker and sent the account `DELETE` at once. `remove` takes `c.write` with
`TryLock` and refuses a busy catalog with 503 `native_unavailable` by design
(it must never queue a browser write behind an hours-long first import). If
the fsync is still running, the removal hits that refusal.

The window lasts as long as one fsync, so it opens under **disk** load, not CPU
load. That explains why CPU hogs alone never reproduced it, and why the gate
did (Go builds and test temp files saturate the disk).

The instrumented build (the dead worker's `println` probes on the four 503
paths of `remove`) attributed all 12 failures in one run to
`write busy`. None came from inventory, abandon or native `Remove`.

A person cannot hit this in the product: removing needs a click and a
confirmation after seeing completion, which takes far longer than an fsync.

## Fix

`TestMicrosoftCatalogRelaysOneCodeAndSupervisesChoice` waits for the login
worker (`waitLoginWorker`, whose own comment states this contract for tests
that inspect supervised clients) before inspecting supervision and removing.
`TestDropboxInterruptedFirstChoiceCanBeRetried` gets the same wait before its
`supervised` check, which is the same race in its other direction (checking
before reconciliation has started the client). It was adopted from the dead
worker's branch but not observed failing (60/60 under the same load).

Not adopted from the harvested branches: the instrumentation in
`handler_linux.go` (diagnostic only), and a `c.write` barrier at the end of
`TestMicrosoftDaemonStartFollowsTheTenant`, which was never observed failing
and passed 60/60 under the load below.

## Evidence

Load (Birch, 8 CPUs): four `dd bs=1M count=128 conv=fsync` loops into the test
`TMPDIR` filesystem plus four `while :; do :; done` CPU hogs, all under
`timeout`.

- Before, unpatched test binary:
  `-test.run 'TestMicrosoftCatalogRelaysOneCodeAndSupervisesChoice$' -test.count=20 -test.cpu 1,8`
  → 7/40 failed, and 11/40 in a second run, every one with the gate's exact
  `microsoft_linux_test.go:405: 503 … native_unavailable`.
- Without the fsync load (8 CPU hogs, also 8 concurrent processes, also 4
  concurrent full-package runs, also pinned to one core): 0 failures in
  hundreds of runs.
- After, same load:
  `-test.run 'TestMicrosoftCatalogRelaysOneCodeAndSupervisesChoice$|TestDropboxInterruptedFirstChoiceCanBeRetried$' -test.count=20 -test.cpu 1,8`
  → 80/80 passed.
- `./scripts/test-focused.sh --area go --go-package` for
  `./internal/daemon/integrations`, `./internal/provision` and
  `./internal/daemon` (its callers) all pass. `internal/daemon` needs the
  `requirements-ci.txt` venv as `PYTHON`, which `ci-local.sh` provides. Without
  it two snapshot schema tests fail on a missing `referencing` module on Birch.

## Untested

The full clean gate was not rerun.
