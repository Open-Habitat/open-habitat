# Result

## Cause

The daemon already emitted workspace and Pi-history measurements, but the browser rendered only cache/build/Trash rows and subtracted neither workspace nor history bytes from its grey residual. The daemon did not measure native integration folders or Habitat's offered-file store at all. The non-experimental label incorrectly described all non-Trash usage as workspaces/history/caches.

Empty Trash had two separate causes: the breakdown measured the Trash directory scaffolding and metadata rather than discarded contents, while the ordinary size formatter rounded zero up to 1 KiB. The clean-up dialog edited a draft and then passed it to another editable composer, creating two confirmation steps.

## Changes

- Native integration inventory supplies Dropbox, OneDrive, Google Drive and SharePoint directories without starting clients or contacting providers. The existing bounded, no-symlink, same-filesystem walker measures them.
- Cloud services, offered files, agent history and workspaces have named bar segments and read-only detail rows. Only cache/build groups enter clean-up requests. The residual is labelled Other files in both storage views.
- Trash measures discarded contents, excluding its directory scaffolding and metadata. Both zero-byte formatters display `0 B`.
- Clean-up opens the prefilled, unsent composer directly. Removed the intermediate dialog. Added Finnish/English Explain cards with distinct control selectors.

## Decisions for later review

1. **Keep the composer, remove the dialog.** The alternative was to send from the dialog. The composer preserves the familiar review/edit/send step without changing message-sending authority or creating another submission path. The existing largest-build-workspace preference picks the conversation's location, falling back to the first workspace; no workspace yields an inline error.
2. **Group synced folders by service and show individual paths in details.** The alternative was one generic cloud total or a top-level group per account. Named services explain the large allocation without exposing account/path detail until requested. Only native inventory-known folders qualify; a familiar directory name alone is not enough.
3. **Keep data groups read-only.** Cloud files, offered files, history and workspaces explain usage but are not added to regenerable clean-up selections.
4. **Keep the breakdown's own Trash measurement.** The workspace Trash listing excludes regular files and is bounded, so using its sum as an override would hide measured data. Review caught and removed that initial approach. Existing measurement timestamps/re-measure behavior remain unchanged.

## Verification

- Focused Go checks: `./internal/daemon` and `./internal/daemon/integrations` passed. Regression coverage includes native Dropbox discovery, unconnected lookalike exclusion, offered-file measurement and empty Trash payload size.
- Focused contracts: generated fingerprints clean; 98 schemas, 157 fixtures and 44 scenarios validated.
- Focused web checks: lint, types, catalogs and unit/component tests passed. Covers named/nonselectable data groups, residual arithmetic, zero-byte formatting and direct draft handoff.
- Only `storage-breakdown.spec.ts` was run in the browser, with two workers and port base 17100. Both cases passed: cloud-heavy usage with empty Trash, and selection-to-unsent-composer routing. Includes axe checks and a measured-positive Trash regression against an empty workspace Trash listing.
- Independent review: claude-fable-5-2 finder and gpt-6-astra verifier, then assessment. One confirmed source-substitution defect fixed; one proposed directory-allocation suppression dropped because those blocks really consume quota. No remaining actionable findings.
- Synthetic visual inspection at 1440 and 390 CSS pixels; Explain cards captured in Finnish and US English. Captures are outside the repository under the worker-results directory for run `01m7dxc1ys1erx46c2rqybsanf`, not committed. This is synthetic host-backed evidence, not a live installation check or UID-isolation proof.
- UI-reference regeneration/check succeeded, but also regenerated unrelated pre-existing drift; generated reference changes were discarded. Release packaging regenerates the guide from the changed catalogs.

Live check: Open Storage with the breakdown experiment enabled and remeasure. Verify named cloud/offered/history/workspace groups, empty Trash at zero, and that asking for clean-up opens one editable, unsent composer without a dialog. With the experiment off, the residual label must not claim cloud data is workspace/history usage.
