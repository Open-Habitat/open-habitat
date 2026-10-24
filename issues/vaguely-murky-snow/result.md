# Result

This was a test-observation race, not a product resume defect. The fake rclone appends to `resyncs` before exiting. `tryResume` still owns the active attempt until `resumeInitial` returns and `finishResume` releases it; `Catalog.check` correctly reports syncing during that interval rather than probing a provider whose native pass is active. Counting two starts does not establish that the second attempt has finished.

The test now waits for both two starts and an unreachable service observation. It retains the subsequent named-failure, interrupted-evidence cleanup and no-repeat assertions. No production code changed and no sleep/backoff increase was needed.

## Verification

Tested base `35592c4b0312a10a97af2df5b47516a1bea3251d` plus test-file blob `386dfeb9140473c15ea01a480b31648724e593dd` (the runnable change in this fix).

With `umask 077; export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX)` (actual directory `/var/tmp/oh-7Jy4`):

- `go test -race -count=50 -run '^TestResumeRetriesUnreachableAndNamesItsFailure$' ./internal/daemon/integrations` — passed, 21.767 s.
- `go test -race -count=1 ./internal/daemon/integrations` — passed, 30.426 s.

A disposable Go overlay inserted `sleep 0.2` immediately after the fake's resync-start marker, only in this test. The original test failed with the exact reported `state:syncing` / `phase:preparing` card. The corrected test passed five repetitions with that same delay under `-race`. This directly exercises the scheduling window without committing artificial timing to the fixture. Scratch overlays and baseline output are in `/var/tmp/oh-resume-repro-flhh8flp` on the test host.

`./scripts/test-focused.sh --area contracts` passed generated-contract drift and validation (67 schemas, 83 fixtures, 40 scenarios). `git diff --check` passed. `issuectl doctor --json` passed (existing nonblocking attachment advisories remain); `python3 scripts/validate-project-view.py` passed (12 pages, 12 navigation entries).

All integration evidence uses synthetic homes and native-tool fixtures. No live provider behavior, full gate or deployment is claimed.
