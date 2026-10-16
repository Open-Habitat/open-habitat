# Result

## Changes and reproduction

Both reports reproduced in the synthetic lab on `OH_PORT_BASE=27900`.
The rail fetched `/api/v1/server` only on route changes; saving the name
refreshed administration's private data but never invalidated the mounted rail.
A confirmed administration write now notifies the rail to reread the validated
host information. Superseded/in-flight reads are aborted and cannot overwrite
the new name. Failed writes do not optimistically rename the server.

The browser's automatic table sizing could wrap `156,67 MiB / 8 GiB` between
its number and unit. The storage value is now indivisible, with room reserved
for the column. The existing stacked user layout now follows the administration
card's available width, not just the whole viewport: at 1024px the shell and
settings navigation can leave too little room for four columns. Roles, quota
editing and actions remain accessible. This retains direction 2 (Osiot), not
a new settings design.

## Evidence

Adjacent PNG/HTML pairs are synthetic lab captures, not live user data:

- `before-name` / `after-name`: saved name and the mounted rail.
- `before-users-desktop` / `after-users-desktop`: 1280 × 900, including a
  synthetic longer username and a MiB usage value, reproducing the reported wrap.
- `after-users-compact`: 1024 × 900, stacked rows despite a desktop viewport.
- `before-users-narrow` / `after-users-narrow`: 390 × 844.

The supplied `kayttajat-tallennustila.png` is the original report, not new lab
evidence. Before screenshots use the original production sources at `acb276b1`;
after screenshots use this issue's implementation on that base. Each HTML
records capture metadata; its commit identifies the base of the then-uncommitted
fix, not a claim that the after image is the unchanged base tree.

## Validation

- Added two host-backed browser regressions in
  `web/tests/settings-name-and-storage.spec.ts`. Both failed against the original
  production code: the rail never acquired the new name, and the storage text
  occupied two lines at 1280px. Both pass with the fix.
- Rename test also covers a refused PUT, preserved draft, confirmed host value
  and absence of navigation/reload. Layout test measures actual rendered text
  lines, card containment and reachable actions at 1280, 1024 and 390px, including
  opening the quota editor.
- `shell-accessibility.spec.ts`: 3/3 passed.
- `account-settings.spec.ts`: 11/11 passed after installing the pinned native
  test fixture with `npm ci --prefix internal/daemon/pi-device-test
  --ignore-scripts --no-audit --no-fund`. Initial 10/11 and isolated credential
  failures were a missing prerequisite, not a flaky pass: the fixture's missing
  SDK made credentials return unavailable, so “Lisää avain” was correctly absent.
- `./scripts/test-focused.sh --area web`: format, lint, typecheck, 131 unit and
  119 component tests passed.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed.
  `issuectl doctor --json` completed; its existing `superseded_by` unknown-key
  warning concerns `raw-thinking-history-blocks`, not this issue.
- Rebased cleanly onto `origin/main` (`c0bf1918`); implementation commit is
  `0d316589`.

### Full gate and isolation

`OH_PORT_BASE=27900 ./scripts/ci-local.sh --clean --json` ran on `491d3719`
(tree `42cc460c4fe4c4f853d1e76ce974bd576f88a58f`) and **failed** after 338s;
there is no clean-gate receipt. `free -g` showed at least 6 GiB available before
the run (Linux's reclaimable cache is not treated as unavailable memory).
Web static/unit/component checks and Storybook passed. Browser: 166 passed,
2 capture-only cases skipped, 9 failures. The two new settings tests passed.
Go failed in the daemon package; packaging and later gate phases were not run.

Isolation, using one browser worker and fresh production assets:

- Seven of the nine browser failures passed: unsupported account model,
  archive-offer expiry, Pi session switching, slow native reads, lost write
  acknowledgement, quiet-working clock and failed-read recovery. The initial
  unsupported-model failure was a timing-sensitive ambiguous text locator
  (`uusi malli` also occurred in the fake Pi reply), not a timeout.
- Two conversation tests still failed in isolation: empty-composer model
  replacement waited for a missing **Lähetä** button; latest-pill state waited
  for **Viimeisimpään, Pi työskentelee**. These belong to the concurrent
  conversation/model-control work, not settings. Replacing all four changed
  production files with `c0bf1918` and rebuilding reproduced the same
  empty-composer failure, proving it predates this fix; the latest-pill case
  passed in that baseline run (timing-sensitive). Restored sources were checked
  byte-for-byte via git diff before final focused validation.
- Both Go failures passed in isolation with `go test -race -count=1
  ./internal/daemon -run
  '^(TestExternalPiAppendReachesTwoStreamsAndNativeHistory|TestPiCredentialsAPIOnlyReadinessAndReplacement)$'`.
  The full gate had failed to start a filesystem watcher and to read the native
  API-key default model under concurrent load.

The gate is not reported as passed or as only timeout flakes. Per `TESTING.md`,
landing is based on affected checks, not on a clean full gate; unrelated
conversation failures are left to their existing parallel workers rather than
changing their code or tests from this scoped settings fix.

Final affected-suite rerun with the restored fix and `OH_BROWSER_WORKERS=2`:
`settings-name-and-storage.spec.ts`, `account-settings.spec.ts`, and
`shell-accessibility.spec.ts` passed together, **16/16**. The manual lab host
was stopped. All captured HTML/PNG pairs remain with this issue.

Focused self-review: notification carries no user data and adds no cache or
persistent state; name/role still come from the host's validated server read.
The change is restricted to administration, the rail reader and settings CSS.
No auth, daemon routing, quota enforcement or contracts changed. Browser/lab
checks are same-UID synthetic evidence, not proof of UID isolation or a live
server check. Live checks are listed in `KOKEILTAVAA.md` for the release watcher.
