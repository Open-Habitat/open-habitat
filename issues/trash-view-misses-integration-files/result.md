# Result

## Cause and existing data

Read-only, names-only inspection through Fleetrepo’s pinned SSH helper found three native Trash directories with matching `.trashinfo` filenames, including the reported integration folder. No contents were read or live files changed; private identities/names are omitted here.

Removal already wrote a freedesktop entry. The reader filtered labelled entries to direct `~/src` children. It now includes other directories, displays original locations, and restores canonical home-relative destinations through existing, owned, non-writable-by-others parents without symlinks, filesystem crossings or overwrites. Unknown/unsafe destinations remain deletion-only. Missing parents are explained explicitly. Directory restores do not create workspace identities.

**No migration is needed for the reported folder.** Deployment of this fix makes its existing entry visible. A missing destination parent disables restoration with instructions to recreate it. This worker did not deploy or mutate the VM.

## Final validation and landing

Adopted all three preserved commits from run `01m5kfsfvgksp4qs8s7exgbx1b` into run `01m5kh084xtc4hdjcadqpcyxzs`. They applied cleanly, including generated fingerprints. Final implementation/evidence revision `9890b8fd`, tree `73fed01e29c25114ca8ef9e3e5ed1121d769d2a2`, is rebased onto main `2c7c3257`.

- Installed web and Pi fixture dependencies with `npm ci`.
- `go test -count=1 ./internal/daemon ./internal/daemon/integrations ./test/browser-host`: passed after integration with the Microsoft single-code change on main `8057ac2d`. The subsequent rebase adds only unrelated conversation UI/evidence; Go/contracts inputs are unchanged.
- `./scripts/test-focused.sh --area contracts`: generated files clean; 63 schemas, 71 fixtures, 40 scenarios passed.
- `./scripts/test-focused.sh --area web`: final combined tree passed format, lint, types and 534 tests.
- Sequential `./scripts/test-focused.sh --area browser --spec <spec>` runs: `lab-integration-trash.spec.ts` 4 passed (light/dark, desktop/390px, axe); `lab-workspace-trash.spec.ts` 1 passed; `integrations.spec.ts` 6 passed, including a11y. Fleet routing placed the commands remotely; suites were sequential, with runner-selected worker counts.
- Reinspected the preserved eight screenshot/HTML pairs below against the prototype and component idiom. No new UI design changes were needed; final browser journeys reproduce the interactions.
- Project-view validation, issue doctor and `git diff --check`: passed, with unrelated existing doctor advisories.

### Recovered tool failures and limits

Browser dispatch refused fresh Cedar pressure/inference admission after the first current-main rebase. No browser tests ran during that refusal. The bounded retry also refused once, then succeeded five minutes later; all required specs subsequently passed twice. Logs: `/tmp/pi-processes-t6hnnT/proc_5fca-stderr.log`, `/var/tmp/trash-browser-retry-1.log`, `/var/tmp/trash-browser-retry-2.log`, and `/tmp/pi-processes-t6hnnT/proc_8dd9-stdout.log`. No admission override or native fallback was needed. System Pillow lacked AVIF support for visual inspection; a disposable `/var/tmp/trash-review-venv` with current Pillow decoded the captures successfully. No required check remains incomplete. Full gate, deployment and live post-deployment verification were not run in this worker.

## Pre-rebase verification

The fully tested pre-rebase implementation was `ac0913f7`, tree `c2e2c7dd743eb4136769a6609c9ca12f94e3dc4f`. All runnable inputs were checked; the last rerun changed only the capture spec to disable theme transitions.

On the remote runner, with `TMPDIR=/var/tmp`, private umask, one browser worker and disposable Python dependencies:

- `go test -count=1 ./internal/daemon ./internal/daemon/integrations ./test/browser-host`: passed. Includes both producers, restore/purge, collisions, symlinks, long names, swapped inodes, parent permissions/absence and metadata-cleanup failure.
- `./scripts/test-focused.sh --area web`: formatting, lint, types and 504 tests passed (also rerun after the capture adjustment).
- `./scripts/test-focused.sh --area contracts`: 63 schemas, 70 fixtures and 40 scenarios passed.
- Browser specs `lab-integration-trash.spec.ts` (4 light/dark × desktop/390px journeys with axe), `lab-workspace-trash.spec.ts` (1 journey), `integrations.spec.ts` (6 journeys): all passed. Capture spec rerun: 4 passed.
- `git diff --check`, project-view validator and issue metadata doctor: passed; existing unrelated doctor advisories remain.

One targeted reviewer, `claude-fable-5-1`; all four findings addressed and regression-checked. Early attempts hit lost remote umask/worker limits, one unit timeout, missing Python dependencies, a download timeout and a test missing its provider-link click. Tests also caught an interim long-name regression. All initial problems were corrected/retried in the pre-rebase run. Post-rebase validation remains blocked as described above. Full clean gate and live post-deployment UI verification were not run.

## Visual review

Compared removal against `design-system/prototypes/rounds/2026-10-18-integraatiot/round.js` and Storage against its production component idiom: existing opt-in checkbox, confirmation controls, tokens and muted monospace locations retained. Removed misleading workspace-only “only here” claims from synced folders. Final captures have settled colors, wrapped paths, visible actions and no horizontal overflow at 390px. These are synthetic review material, not automated visual comparisons; matching offline HTML sits beside each image.

- Removal desktop: [light](attachments/removal-1280-light.avif), [dark](attachments/removal-1280-dark.avif); mobile: [light](attachments/removal-390-light.avif), [dark](attachments/removal-390-dark.avif).
- Trash desktop: [light](attachments/trash-1280-light.avif), [dark](attachments/trash-1280-dark.avif); mobile: [light](attachments/trash-390-light.avif), [dark](attachments/trash-390-dark.avif).
