# Result

Collapsed Home, folder and account controls now use the same row-sized square
as the navigation arrow, with centred contents. Home's SVG uses the row icon
size too. Wide navigation and the editor header are unchanged.

## Decisions for later review

- Use the existing row role (32px desktop, responsive token on mobile), rather
  than expanding every target to 44px: these are navigation/list controls and
  this keeps the existing arrow's design role. Preserve the 28px avatar rather
  than shrinking a person's image to the 16px SVG icon size.

## Evidence and checks

Tested the change on base `8776b2477fff54f0dcb0f7174ae5cff8e9a8d4b0`.

- `./scripts/test-focused.sh --area web`: passed static, unit and component checks.
- `OH_PORT_BASE=10150 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts`:
  9 passed, including existing accessibility, light/dark and phone cases.
  Extended the existing editor-opening journey to compare all four target
  sizes, square shape, content centres and SVG sizes without hard-coding CSS values.
- Synthetic lab captures: `web/lab/capture-narrow-rail.mjs before|after`.
  `evidence/` contains paired PNG/offline HTML at device scale factor 2,
  light/dark, Home/account hover. Captures isolate the manually collapsed rail;
  the browser regression checks the same rail with the editor open.
- Focused self-review: inspected the CSS cascade, responsive token use,
  unchanged expanded styles, regression assertions and before/after images.
  No state, contract or authority changes. No live-host verification.

Initial web check caught selector ordering, a non-null assertion and capture
script formatting; all corrected and both focused checks rerun successfully.
Exploratory searches included guessed filenames that did not exist; corrected
by searching actual source paths. One exact-edit attempt was ambiguous and
applied nothing; retried with a unique anchor.
