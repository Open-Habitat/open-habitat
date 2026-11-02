# Result

## Cause

The preview drew pages with pdf.js 6's modern build, which calls
`Map.prototype.getOrInsertComputed` and `Math.sumPrecise` without a guard.
Only the newest engines have them (the test Chromium 153 does). On a browser
without them, `page.render` throws on its first line, and `PdfPage` swallowed
the error with `.catch(() => {})`: the dialog showed every page as an empty
canvas while the document itself loaded. In the worker, every embedded
TrueType font (Typst's Type0/CIDFontType2 + `FontFile2`, as in Kaisa's
layout samples) also failed to rebuild (`createNameTable` → `Math.sumPrecise`).
The download worked because the browser's own viewer opened it.

The PDF was not the trigger. Her two offered files (`taittomalli-*.pdf`, a
two-file offer from 1.11.) render fully in plain pdf.js, in the app's
attachment dialog and through the offer's file panel on Chromium 153; with
those built-ins deleted, every page came out fully transparent, and with
pdf.js's legacy build identical to the normal render. Gateway headers, CSP,
MIME types and the offer relay were not involved.

## Fix

- `DocumentPreview` loads pdf.js's legacy build (page and worker), which
  carries the missing built-ins as polyfills that a newer engine leaves
  unused.
- A page whose drawing fails says "Sivua N ei voitu näyttää…" instead of
  staying blank; a draw cancelled by scrolling away is not a failure.
- `pdfFixture({ embeddedFont: true })` builds a PDF that embeds a generated
  two-glyph TrueType font the way Typst does. The new browser test deletes the
  built-ins in the page and the worker script and asserts that the font's
  squares are drawn and pdf.js logs no "is not a function". It fails on the old
  code both ways: blank canvas with the page built-ins gone, and the font
  warning with only the worker's.

## Decisions for later review

- **Legacy build instead of own polyfills or a browser floor.** Alternatives:
  polyfill the two or three methods ourselves before loading pdf.js (smaller,
  but the next pdf.js update can add another unguarded call and blank pages
  again silently), or declare such browsers unsupported. The legacy build is
  pdf.js's own answer for browsers that are not the newest; its larger chunk
  loads only when a PDF is previewed.
- **A failing page shows a note, not the whole preview's "failed" text.**
  Other pages may still draw, so the note sits in the failed page's place.

## Evidence handling

Her files were read through the user-manager sudo route, read only, copied
into a private scratch directory, and deleted after the reproduction. Nothing
of hers is committed or quoted.
