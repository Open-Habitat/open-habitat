# Start page: invalid is no longer absent

## Cause and result

Read-only inspection through Fleetrepo's pinned VM helper confirmed that daemon
workspace discovery selects the monorepo root and its regular, owner-readable
`.agents/start-page.md`. The file uses the previous goal format: `what` and
`steps` are missing. This is not a monorepo discovery problem. No private page
content, home paths or identities are reproduced here or in fixtures.

The strict format remains unchanged. Missing pages still return null; rejected
or unreadable pages now return only `{ "state": "needs_update" }`. The daemon
logs fixed reasons such as `invalid_goal_fields`, `open_failed`, `not_regular`
and `too_large`, without file content, paths or raw errors. Dangling page
symlinks also produce the update state, not absence. Existing confinement,
ownership and size checks remain in force.

The update state explains what to do in Finnish and retains the ordinary message
field. The empty hint now says to create a start page by writing the native
`/skill:open-habitat-start-page` command, without mentioning repository paths.
The actual VM file was deliberately **not changed or regenerated** (read-only
brief). Its owner can regenerate it with that command. A synthetic monorepo
fixture reproduces the root page plus separately instructed subdirectories,
proves the old shape needs updating, and proves a current-format replacement
loads successfully. No compatibility parser was added.

## Validation

Based on `1362b57f`; all checks below ran against this worker's implementation.

- Installed web and pinned Pi-fixture dependencies with `npm ci`.
- `./scripts/test-focused.sh --area web`: static checks and 89 files / 501 tests.
- `./scripts/test-focused.sh --area browser --spec start-here.spec.ts`: 4 passed,
  1440/390 × light/dark, through Fleetrepo's remote warm runner. Extends the existing
  guide journey with separate absent/update states, draft retention, no send,
  no horizontal overflow and axe audits. The unavailable response is injected
  at the validated HTTP boundary; filesystem rejection/regeneration is covered
  by Go, not claimed as an end-to-end live regeneration.
- `GOMAXPROCS=2 go test -p 1 -count=1 ./internal/daemon ./test/browser-host`:
  both passed with `umask 077` and `/var/tmp` scratch.
- Focused contracts: generated fingerprints clean; 63 schemas, 69 fixture files
  and 40 scenarios valid. Adds the unavailable example and rejects native
  diagnostics in that response.
- Storybook production catalogue built with the new `NeedsUpdate` story.
- One targeted reviewer (`claude-fable-5-1`) verified the JSON union, confinement,
  fixed diagnostics and browser integration. Its fixture-map finding was fixed
  during the review: the example is now explicitly validated (69 fixtures).
  Kept conservative update signaling when workspace access fails or `.agents`
  is not a directory: absence is not established there, and the suggested null
  would misleadingly invite creation. No additional issue filed for those
  low-severity edge cases.
- Project-view validator, issue doctor and staged whitespace checks passed;
  doctor retains unrelated pre-existing image advisories, none for this issue.
- No full clean gate, deployment, provider or distinct-UID acceptance claim.

[evidence/](evidence/) contains 8 AVIF/static-HTML pairs from the synthetic lab:
absent and update states at both widths/themes. Inspected desktop/light and
390/dark update states plus 390/light absence: readable command wrapping,
visible message field, no clipped text. Compared with the accepted
`design-system/prototypes/rounds/2026-10-22-aloitussivu-2` source: retains the
same token-based reading column, heading/body hierarchy and bottom-adjacent
catalogue placement. The prototype has no invalid-file state; this adds plain
text in the existing component idiom rather than a new panel or control.
The normal catalogue's cards/guide interactions remain unchanged.

## Failure inventory

- Initial browser extension intercepted only workspace command reads. Reload
  selects a conversation command endpoint, so all four cases timed out looking
  for the update state. Broadened the interception to both documented command
  endpoints, restored the selected theme after reload, and reran: all four
  pass. Log: `/var/tmp/start-invalid-browser.log`; successful retry:
  `/var/tmp/start-invalid-browser-final.log`.
- Early scoped lookups guessed a nonexistent lowercase component directory and
  composer test filenames. Located the real `StartHere` component and
  `StartPageRead` tests and continued; no required evidence depended on those
  guesses. An intermediate parser-edit script placed multiple return values on
  one line; caught during diff inspection and corrected before tests/review.

Working logs: `/var/tmp/start-invalid-{deps,web-final,go,contracts-final,storybook,review}.log`.
