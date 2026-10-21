# Result

## Cause and fix

`StartPageRead` fetched the command-list response on every empty-view mount.
The retained history/status controller did not retain this new presentation read.
Its route-local abort also cancelled reads when navigating away before they
finished, so retaining only completed pages was insufficient (first browser run).

The existing identity-scoped `ConversationStore` window now owns one in-flight
read and its start-page result, including an absent page. It retains only the
page, not Pi's command inventory. Route unmount stops the old component's updates
without cancelling the window's read. Window eviction and identity disposal abort
and discard it; a rejected read is discarded so retry works. New conversations
and the workspace pre-start page still discover native content afresh. Nonempty
timelines do not mount the start page. No persistent store or global cache added.

## Verification

Runnable changes: `64699ebb` (based on `266d93f8`).

- `./scripts/test-web-fast.sh`: passed, final run
  `/var/tmp/warm-return-fast-web-landing.log` (85 files, 489 tests).
- `OH_PORT_BASE=16400 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts`:
  all 67 passed, `/var/tmp/warm-return-browser-final.log`. The original
  warm-return no-read assertion is unchanged.
- `OH_PORT_BASE=16800 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec lab-start-here.spec.ts`:
  all four desktop/mobile and light/dark start-page journeys passed, including
  authored Markdown/goals, draft preservation, absent-page hints, and axe audits
  (`/var/tmp/warm-return-start-page-browser.log`).
- New component/store cases cover authored and absent pages on remount,
  navigation during an in-flight read, retry after failure, eviction, identity
  disposal, fresh reads for another conversation, and goal-to-draft behavior.
  Disabling the retained-promise return made all three warm-return cases fail
  with two command reads instead of one; restored before final checks
  (`/var/tmp/warm-return-mutation.log`).
- `python3 scripts/validate-project-view.py`, `git diff --check`, and
  `issuectl doctor --json`: passed.

Browser evidence is host-backed synthetic evidence through the installed command
runner, not a live-server or distinct-UID claim. Full gate deliberately not run;
the conductor owns it on main. Finnish test-server check added to `KOKEILTAVAA.md`.

## Review and iteration

Focused self-review of request ownership, stale component updates, identity
isolation, eviction, retries, and palette freshness was proportionate: this is a
small browser-only lifetime fix using the existing read-model owner, with no
contract, host-authority, dependency, or security-boundary change. The existing
browser request-count test exercises the actual route interaction; the mutation
check establishes that the added component cases distinguish the defect.

Initial fast-web lint failed on an obsolete suppression, corrected. One test
hook returned a mock function, which Vitest treated as cleanup and waited on;
changed the hook to return nothing. Initial browser passes also exposed two
pre-existing test setup races: the creation placeholder has a visible composer
before the controller is ready. Receipt tests now wait for an enabled composer,
and the 401 test intercepts status only after initial readiness, so it tests the
explicit recheck instead of racing the initial status read. Final runs of both
affected browser specs passed.
