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
  `0d316589`. Full clean-gate outcome follows in the final validation record.

Focused self-review: notification carries no user data and adds no cache or
persistent state; name/role still come from the host's validated server read.
The change is restricted to administration, the rail reader and settings CSS.
No auth, daemon routing, quota enforcement or contracts changed. Browser/lab
checks are same-UID synthetic evidence, not proof of UID isolation or a live
server check. Live checks are listed in `KOKEILTAVAA.md` for the release watcher.
