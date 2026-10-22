# Result

Fixed the CodeMirror mount height. `0b8c49dd` removed its `height: 100%` while deleting Monaco styles and accidentally joined the mount selector to the warning-text rule. The auto-height editor grew with the document behind `.ah-browser-document`'s clipped viewport. The header and Viivasto changes were not the cause.

Restored the bounded mount and separated warning styling. Made the editable content an explicit tab stop: the long-file axe audit exposed missing keyboard access in its scrollable region. Added the production component's `LongFile` Storybook state with a bounded flex wrapper.

## Evidence

- First ran the new browser regression before fixing CSS: all four width/theme cases failed with the final line outside the viewport after Ctrl+End.
- Final `./scripts/test-focused.sh --area browser --spec browser-editor.spec.ts`: **15 passed**. The 250-line buffer reaches its final line via Ctrl+End, PageDown and wheel input (mouse/trackpad event path), in split and maximized layouts, at 1366 and 390 px, light and dark. Native Chromium touch gestures also reach the end at 390 px. Long-buffer axe audits pass in both layouts.
- `./scripts/test-focused.sh --area browser --spec lab-browser-editor.spec.ts`: **4 passed**. [Evidence](evidence/) contains eight paired PNG/offline HTML captures: 1440 and 390 px, both themes, split/full. Synthetic lab only; no live data. Retrieved generated evidence from the remote warm runner.
- Reviewed captures against `design-system/prototypes/rounds/2026-10-22-tiedostopuu-r2` and `2026-10-21-editorin-painikkeet-2`: retained tree hierarchy, neutral current-file row, editor-local controls, desktop side-by-side layout, compact stacking and collapsed-conversation strip. Final line and save control remain visible. No token or shared-state changes.
- `npm ci --prefix web`: passed. Final `./scripts/test-focused.sh --area web`: format, lint, typecheck and **89 files / 500 tests passed**.
- `npm run storybook:test --prefix web`: passed, including the updated long-file story.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed.

Browser evidence is Chromium-backed synthetic behavior, not physical trackpad/device or Safari verification. No contracts or Go changed; those checks and the full gate are intentionally out of scope.

Tested implementation: parent `754ffcebf507f2a7a0268d6c4f8cbf92400131fd` plus this commit's runnable changes; `git diff -- web/src web/tests` SHA-256 `cf030fe187e3229dcf238d4f6c1b3366ab361c6d90587720043847d43162d0f1`.

## Failed attempts (resolved)

- Initial skill read used the wrong path (`ENOENT`); loaded the declared pi-processes location before starting commands. A diagnostic `find .cache` found no local build cache; remote placement explains this and no cache was needed locally.
- Pre-fix browser run intentionally failed all four new cases, confirming the regression (`/var/tmp/editor-scroll-before.log`).
- First post-fix browser run: 11 passed, four new long-file audits failed `scrollable-region-focusable`. Added explicit `tabindex=0` to editable content and reran: 15 passed (`/var/tmp/editor-scroll-browser-recheck.log`). No unresolved required step remains.
