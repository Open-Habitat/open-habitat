# Result

Fixed in `web/src/components/MarkdownRenderer.tsx` and the `.ah-markdown-table`
rules in `web/src/components/components.css`. Every Markdown view (replies,
history, file and editor previews, workspace intro, spinoffs) uses this
renderer, so the one fix covers them all.

The cause was `overflow-wrap: anywhere` on `.ah-markdown`. It shrinks the
min-content width of each table cell to a single character, so the automatic
table layout gave the long column the width and broke short cells anywhere.
Now:

- table cells use `overflow-wrap: normal`, so a word stays whole and the
  table scrolls in its wrapper rather than crushing columns;
- a cell with at most 16 characters of text gets `.ah-markdown-cell-short`
  (`white-space: nowrap`). Without it, a column sized between its min and max
  width still broke "11-10" at the hyphen;
- other cells keep at least `8em`, so a long text column stays readable on a
  phone (a table with many long columns scrolls instead);
- the wrapper is a focusable, labelled `role="group"` ("Taulukko"/"Table")
  with a focus ring, so a keyboard user can scroll it with the arrow keys.

Evidence (device scale factor 2, Jari's table plus a wide seven-column
table): `evidence/before-{1440,390}-{light,dark}.png` and
`evidence/after-…`. The before shots reproduce the screenshot ("Pv/m",
"8,/2/5", "11-/10").

Tests: `web/tests/markdown-table.spec.ts` (each short cell stays on one line
at 1440 and 390 px, the hour table fits, the wide table scrolls inside its
wrapper with ArrowRight while the page does not scroll, axe is clean) fails
on the old CSS and passes now. `Markdown.test.tsx` covers the short-cell
classification and that column alignment survives.
`./scripts/test-focused.sh --area web` passed, and so did
`markdown-block-preview.spec.ts`.

## Decisions for later review

- **Short-cell threshold of 16 characters, decided in the renderer.**
  Alternatives: CSS only (cannot keep "2026-11-10" off its hyphen break),
  or `nowrap` for cells without spaces (misses "8,25 h" and "Jari
  Mustonen"). 16 characters covers dates, amounts, short names and headers;
  a longer cell wraps normally.
- **`role="group"` instead of a `region` landmark.** A landmark per table
  repeats the same name (axe `landmark-unique`) and crowds landmark
  navigation in a long conversation. The group is still named and
  focusable.
- **`min-width: 8em` for wrapping cells.** It keeps a description column
  from collapsing to one word per line on a phone. The cost is that a table
  with several long columns scrolls sooner.
