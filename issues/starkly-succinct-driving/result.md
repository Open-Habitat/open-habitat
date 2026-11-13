# Result

Reproduced at 2/400 (`GOMAXPROCS=2`, 16 CPU hogs under `timeout`, `-race`). Instrumentation
showed two legs of one race with the abandoned login's `microsoftLogin.Cancel`, which empties
and removes `.pending/<address>` while `microsoft.Remove` does the same:
1. `unlinkat .token-cache.json`: ENOENT (the file was already removed).
2. `readdirent .pending/<address>`: ENOENT (the directory was removed after it was opened).

Fix (product): `microsoftRemoveFiles` treats an already-gone file as removed. `listHomeDir`
treats a directory removed while it is being read as missing, which is its existing contract for
a missing directory, and all of its callers already handle `-1`. `microsoft.Accounts` skips a
staging directory that disappears after it was listed (found by the review).

Checks: the pair of tests ran 1000×, 500× and 400× under load with 0 failures (before the fix,
2/400 for this test). The integrations package passes at `-race -count=20` (see the
catalog-background-outlives-stop result).

## Decisions for later review
- I made both deleters tolerant rather than serialising `Cancel` under `microsoft.native`.
  Serialising would need a non-locking variant for `Commit` (which already holds the lock), and
  even then would not cover the native process being killed asynchronously. Both deleters intend
  the same end state, so tolerance is the honest fix.
