# alice-02-northside-prices

Alice · 08:34 · Northside prices: last week’s margin checker on Bob’s new
supplier list.

## What changed and why

- **The checker is real and the screen shows its true output.**
  `checker/margin_check.py` is the “small program Alice and her agent wrote
  last week”. It reads the supplier’s CSV (semicolons, decimal commas, 2026
  and 2027 unit cost), joins it to the shop’s catalogue by supplier item
  number, and computes the gross margin on shelf price less 25.5 % VAT at the
  old and the new cost. It prints the products under the 40 % minimum and
  draws a chart. The work row
  `python3 tools/margin_check.py inbox/northside-2027.csv` shows its stdout
  verbatim (`checker/run.txt`). The `head -4` row shows the CSV’s real first
  lines (`checker/head.txt`). The reply’s numbers (4 of 64, 11–16 % cost rise
  vs about 5 % average, three just above the line) are parsed from `run.txt`,
  so the copy cannot drift from the run.
- **The view is the checker’s chart**: a dumbbell of the eight lowest margins,
  2026 cost (hollow) to 2027 cost (filled), with the 40 % line. The four under
  the line are in the error colour and labelled. Phones get a narrow drawing
  of the same chart (names above each row) through `<picture>`.
- **The 09:15 “send it to Bob” exchange was removed from this screen.** The
  glimpse is at 08:34, and showing a 09:15 message and a sent mail there was
  out of time. The reply now ends with the question, “Shall I send Bob the
  table and ask what Northside says?”. Nothing is sent without her yes. The
  sidebar (alice-day) still shows “Writing to Bob” at 09:15 and “Sent to Bob”
  at 09:16, which now reads as her answer.
- The reply carries no Markdown table. With a table, the reply plus the chart
  pushed the summary row out of the sticky screen (see Engine needs). The
  table is in the run output under Show work, and the chart carries the
  picture.
- The product list is 64 stocked items of a hand-printed linen shop (totes,
  aprons, tea towels, napkins…). Northside’s file has 71 rows; 7 are items the
  shop does not stock.

## Assets and how they are made

`node blocks/alice-02-northside-prices/assets.mjs` (set `TMPDIR` to your
scratch):

1. `checker/make_data.py <shop>` writes the fictional `catalog/products.csv`
   and `inbox/northside-2027.csv` (deterministic, seeded).
2. The design system’s `instrument-sans-latin.woff2` is cut into static
   Regular and SemiBold TTFs with fontTools (`varLib.instancer`). matplotlib
   reads neither WOFF2 nor variable weights. The TTFs go into the shop’s
   `tools/fonts/`, where the checker picks them up.
3. The command the screen shows, run in the shop folder; stdout →
   `checker/run.txt`, first four CSV lines → `checker/head.txt`.
4. A second run with `--chart-width 4.4 --chart reports/northside-2027-narrow.png`
   for phones (only the chart differs).
5. ImageMagick `convert -quality 86 -define webp:method=6` → WebP.

Programs: Python 3.12 via `uv run --no-project --with matplotlib==3.11.2
--with fonttools[woff]==4.61.1`; ImageMagick `convert`.

Output in `$ETUSIVU_ASSETS/alice-02-northside-prices/`:
`northside-2027.webp` (1056 × 790, 34 KB) and `northside-2027-narrow.webp`
(704 × 1148, 34 KB).

`run.txt` and `head.txt` are small generated text files committed with the
block, because `block.js` reads them at build time. Re-running `assets.mjs`
rewrites them identically.

## Assumptions about the product

- `gog gmail attachment … --out inbox/` saves Bob’s attachment; the `gog`
  flag syntax is plausible, not verified.
- Alice’s folder is a git repository holding `tools/`, `catalog/` and
  `inbox/`.

## Sources and licenses

No third-party files. Instrument Sans is the design system’s bundled font
(SIL OFL 1.1, see `design-system/fonts/AGENTS.md`); it is used only to render
the chart, not shipped as a separate file.

## Engine needs

- Same as alice-01: the sticky screen anchors to the bottom, so a view
  stacked under the conversation hides the summary row unless the block keeps
  the screen short.
- `image()` has no responsive source. I wrapped it in my own `<picture>`; a
  `srcset`/`<source>` option in the kit would be cleaner.
