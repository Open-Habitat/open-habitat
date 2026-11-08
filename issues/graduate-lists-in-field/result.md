# Result

The in-field command and file lists are now the default, including for a fresh account. The experimental card, settings-search entry, catalog text and preference gate are gone. Unknown stored experiment IDs are ignored by the existing preference reader; no migration or extra write is needed.

Removed the retired caret/button popovers, modal palette, positioning helper, old file-list rendering, palette styles and obsolete stories. The preview shared by the surviving list is now `PreviewPane.tsx`. Ctrl/⌘+P, the file button and typed @ all use the same in-field tree. Explain-mode copy and the generated agent UI reference match it.

Rebased onto `0f71d79bc` (root-folder labels) and subsequent main. The Composer conflict was resolved by keeping the unconditional in-field groups and the other worker's removal of workspace-name arguments. No other issue was edited.

## Verification

On Birch, after rebase (implementation based on `919c7fd07`, plus the generated reference refresh and preservation of in-field shortcut guards):

- `./scripts/test-focused.sh --area web`: all 190 files / 1,429 tests passed, including typecheck, lint and catalogs.
- `./scripts/test-focused.sh --area browser --spec NAME.spec.ts`, one invocation per name, `OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=23700`: 34 cases passed across `lab-composer-lists-in-field` (4), `lab-composer-area` (10), `composer-english` (1), `settings-experimental` (3), `composer-geometry` (4), `lab-composer-bang-spacing` (4), `lab-composer-focus` (2), `lab-composer-live-focus` (2), `long-pause-composer` (2) and `phone-composer-keyboard` (2). The list and area specs were rerun after the shortcut-guard self-review correction.
- `python3 scripts/generate-ui-reference.py --check`, `python3 scripts/validate-project-view.py`, `git diff --check` passed. `issuectl doctor --json` had no metadata findings (only the repository's non-AVIF screenshot inventory).
- Focused self-review: compared the surviving branch with the former enabled path, checked keyboard/focus guards, all production sources supplying the tree, stale preference handling, settings removal and generated references. No daemon, contract, authority or conversation-state behavior changed.
- Synthetic host-backed screenshots and adjacent HTML: `evidence/tree-1440-light.*` and `evidence/marked-390-dark.*`. Inspected both images; desktop preview and phone marking remain inside the field. These are not live-host or separate-UID evidence.

Removed tests: the old palette's all/changed tabs no longer exist. Its Git-mark assertion and search behavior remain in the in-field tests; multi-mark insertion, keyboard navigation, preview, cancellation, phone layout and accessibility remain in `lab-composer-lists-in-field`. The caret-file unit test now asserts the native path attribute rather than the old concatenated path label, and checks name-ranked reads. Settings save-failure tests now exercise another remaining experiment.

Development failures were corrected: formatter/type errors, old path-label expectations, a search fixture matching two files rather than one, and the rebase conflict above. A repeated `--spec` invocation selected only the last spec; all names were then run individually. No unresolved failure or new issue remains. Full clean gate and whole browser suite were intentionally not run.

## Decisions for later review

- Remove the modal Ctrl+P palette rather than keep it as a second picker: the approved in-field path already routes Ctrl+P to @, so the modal was entirely off-path. The shortcut itself stays.
- Keep the spec's `lab-` name: it still needs the lab's Git checkout and fixtures; this describes its test environment, not an experimental product feature.
