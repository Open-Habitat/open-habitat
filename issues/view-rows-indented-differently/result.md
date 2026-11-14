# Result

## Cause and fix

The small marks in the assets list use `ah-offer-mark-s` (24 px), but the
view mark also uses `ah-view-offer-mark` (32 px). Those rules had equal
specificity, so loading the view defaults later replaced the compact width,
height, radius and font size. The extra 8 px of width shifted the title;
the larger centered mark also moved the visible icon.

`OfferCard.css` now qualifies compact sizing with the view/file mark class,
so it wins independently of stylesheet order. Full-size offer-card marks
and the list's row padding are unchanged. No switch or prototype was added.

## Folding check

`assetEntries` groups by exact source path plus entry file, regardless of day,
intervening offers or title changes. Offers without a recorded source group
separately by title plus entry. Consequently an older source-less offer, a
different source, or a different entry intentionally remains separate. There
is no same-day or consecutive-offer restriction. This preserves the
source-based re-offer behavior requested in `assets-chip-view-list-cap`.
The original report does not include the source/entry metadata needed to
identify which distinction explains its older row; no live personal records
were inspected and no folding behavior was changed.

## Verification and review

- Focused web checks passed: lint, TypeScript, 218 test files / 1,694 tests.
- New compact-mark unit test reproduced the 32 px override before the fix
  and passes with both view and representative file marks at 24 px.
- New grouping unit test covers cross-day and nonconsecutive matching sources,
  changed titles, different entries and missing sources.
- `lab-asset-row-alignment.spec.ts` passed against the synthetic host: a real
  conversation with view, folder, image and spreadsheet offers; equal icon and
  title positions across all nine rows in light, dark and contrast themes at
  1366 px and 390 px. It also checks the compact view mark's font size.
- The six agent-view browser cases passed during initial regression development;
  the alignment case was then moved into its dedicated lab spec for offline
  capture. The existing agent-view spec has no final changes.
- Six synthetic screenshot/static HTML pairs are outside git in the assigned
  worker-results directory for run `01m7dxc36jf4dxcma6dcbfedtr`. Capture omits
  failed image sources outside the assets list after waiting for image decoding;
  this avoids attempting to embed unsupported fixture thumbnails offline.
- Focused self-review: the production change is CSS only; compact selectors
  beat kind defaults without changing full-size cards, row behavior, contracts,
  daemon state or authority. No independent model review was needed.
- No full browser suite, clean gate, deployment or live-host validation was run.

## Decisions for later review

- Keep the existing source-plus-entry grouping rather than guessing that an
  older source-less offer belongs to a newer source. Guessing would merge
  unrelated reports with the same title. No product behavior was changed.

Live check: open “Näkymät ja tiedostot” in a conversation containing views,
folders, images and spreadsheets; compare the icon and title columns in each
theme, including a 390 px viewport. Re-offer the same view source and entry
and check that its versions remain under one row.
