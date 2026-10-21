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

Runnable changes originally tested as `64699ebb` (based on `266d93f8`),
rebased unchanged as `92480269` onto `01b79533`. The only rebase conflict was
`KOKEILTAVAA.md`: retained all three workers' independent pilot checks.

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

The first post-rebase conversation run passed warm-return but exposed a further
lost-accepted-send fixture race: the test rejected every status read before the
write, allowing a background read to disable Send before its deliberate click.
The status interception now fails only once the send begins, matching that
journey's purpose (hide the accepted write's observation until reload).

## Post-rebase landing checks

Final runnable revision: `00c6c319` on `01b79533`. Repeated all affected checks:

- `./scripts/test-web-fast.sh`: 85 files / 489 tests passed
  (`/var/tmp/warm-return-rebased-fast-web-final.log`).
- Conversation spec: 67 passed, including the unmodified warm-return assertion
  (`/var/tmp/warm-return-rebased-browser-final.log`).
- Start-page/a11y spec: four passed
  (`/var/tmp/warm-return-rebased-start-page-final.log`).

No required validation remains failed or incomplete. Earlier failures above are
resolved and disclosed in the terminal run report.
