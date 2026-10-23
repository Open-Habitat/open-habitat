# Result

## Cause and existing data

Read-only, names-only inspection through Fleetrepo’s pinned SSH helper found three native Trash directories with matching `.trashinfo` filenames, including the reported integration folder. No contents were read or live files changed; private identities/names are omitted here.

Removal already wrote a freedesktop entry. The reader filtered labelled entries to direct `~/src` children. It now includes other directories, displays original locations, and restores canonical home-relative destinations through existing, owned, non-writable-by-others parents without symlinks, filesystem crossings or overwrites. Unknown/unsafe destinations remain deletion-only. Missing parents are explained explicitly. Directory restores do not create workspace identities.

**No migration is needed for the reported folder.** Deployment of this fix makes its existing entry visible. A missing destination parent disables restoration with instructions to recreate it. This worker did not deploy or mutate the VM.

## Landing blocked after rebase

The first merge attempt encountered only generated fingerprint conflicts in `internal/contracts/v1_gen.go` and `web/src/contracts/v1.generated.ts`. Regenerated both from the combined schemas and completed the rebase onto `6d6f6bf3`; no hand-written conflict needed resolution. Combined contract checks pass (`/var/tmp/trash-rebased-contracts.log`). The implementation is now `2c937d0a`.

The required post-rebase validation attempt was refused before tests ran: `admission_closed`. The runner doctor reports fresh admission is required; the shared admission record explicitly says `admit:false`. No guard, Fleetrepo configuration or VM state was changed. **The branch is preserved, unmerged, and the issue is in testing until this combined-tree validation can finish.** Restore admission through its owner, rerun the affected Go/web/contracts/browser checks below, and then salvage/merge this exact run.

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
