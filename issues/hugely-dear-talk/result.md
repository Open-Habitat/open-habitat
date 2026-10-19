# Result

The clone list retains Git/filesystem-confirmed interrupted candidates when the process scan is unreadable or incomplete, and reports `interrupted_complete: false`. A known process inside the directory still excludes it. No contract change or cache was needed.

Restart/remove callers and their strict process rejection checks are unchanged: `interruptedClone` always supplies `settledProcessScan`; only the list adapts uncertain results. Focused self-review checked this call graph and the final diff.

## Evidence

Tested the implementation based on `f0f641e2` (the code in this issue's fixing commit):

- Deterministic `TestCloneListInconclusiveProcessScan`: clear, unreadable, incomplete, known-inside, and mixed results. A Go overlay restoring strict-list rejection fails the unreadable/incomplete cases; the implementation passes. No timing sleeps in this regression.
- `go test -race -count=1 ./internal/daemon ./internal/cli ./internal/gateway ./test/browser-host`: passed (browser-host has no unit tests).
- `./scripts/test-focused.sh --area contracts`: generated files clean; schemas/fixtures valid.
- `./scripts/test-web-fast.sh`: passed, including a client regression retaining candidates with `interrupted_complete: false`.
- `OH_PORT_BASE=23800 OH_BROWSER_WORKERS=2 PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" npx playwright test tests/clone-page.spec.ts` (from `web/`): five consecutive runs passed while a managed same-UID loop repeatedly spawned `sleep 0.1`. Each run passed all seven functional/a11y cases; the opt-in visual capture case was skipped. Fresh assets and host built each run.
- `git diff --check`, project-view validator, and `issuectl doctor --json`: passed.

The expected red mutation test is the only intentional failure. No live-server or distinct-UID isolation claim is made. No push or deployment performed.

## Decisions for later review

Use the existing list-level completeness flag rather than add a per-entry flag or retry longer. This keeps the card available even on its first read during churn, preserves bounded scan behavior, and leaves every write dependent on a fresh strict check.
