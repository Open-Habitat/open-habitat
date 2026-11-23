# caps-data

Capabilities: Data and numbers. Two capabilities are drawn in full, and each
view shows a picture made by the program the screen names. The other seven
rows stay in the list; five point into someone's day (Frank's database,
Dave's rota and survey, Kirsi's forecast, Bob's list clean-up), so this block
does not show a rota or a forecast again.

## What changed and why

- **Group line** now says what the two showpieces do ("Say how something works
  and get the chart. Hand over a spreadsheet and get a site people can
  search.") instead of describing two capabilities that are shown elsewhere.
- **Process chart (39, Bob).** The quote is now his ask in his own words ("Draw
  it so the new packer can follow it"), not a stage direction. The dictated
  message tells the whole process, so the reader can check the chart against
  it. The work shows `dot` missing, Graphviz installed from conda-forge with
  micromamba, the `.dot` written and rendered. The view is the real Graphviz
  SVG: three people in three colours, three decisions, and the gap (refunds
  over €100, nobody named) as a dashed rust box. The reply asks Bob who
  approves; the gap is the point of the scene, so it stays open.
- **Results site (36, Peggy, Riverside Rowing Club).** Her ask now asks for the
  site. The work turns nine sheets into one table, loads it into SQLite with
  sqlite-utils, turns on full-text search and serves it with Datasette using a
  custom members' template. The agent then **asks before publishing**, Peggy
  says yes, and only then does the `publish` tool run, so nothing goes out
  without her yes. The view is a real Chromium capture of that Datasette page
  searched for "Peggy": 56 races, 9 wins, 11 seconds, 16 thirds, her name in
  bold in each crew.
- Durations added to the turns (1 min 52 s; 14 min 30 s; 40 s).

## Assets (`$ETUSIVU_ASSETS/caps-data/`, made by `assets.mjs`)

| File | Size | Made by |
|---|---|---|
| `returns.svg` | 21 KB | Graphviz 14.1.2 (conda-forge, linux-aarch64): `dot -Tsvg src/returns.dot`. Layout uses Instrument Sans through a private fontconfig that points at TTFs decompressed from `design-system/fonts/*.woff2` (fontTools 4.68.0). A WOFF2 subset of the glyphs used is then embedded with `pyftsubset`, so the `<img>` draws the same font the layout measured. |
| `results.webp` | 54 KB, 760 × 1200 | `src/make_results.py` (seeded, 214 invented rows) → sqlite-utils 4.2.1 `insert` + `enable-fts` → Datasette 0.65.6 `serve -m src/metadata.json --template-dir src/templates --static static:…` → Playwright 1.63.0 Chromium at 380 × 600 CSS px, 2× → ImageMagick 6.9.12 WebP q82. |

Rebuild: `TMPDIR=<scratch> PROTO_WEB=<web/ with node_modules> node blocks/caps-data/assets.mjs`.
Tools are taken from `$CAPS_DATA_TOOLS` (default `$TMPDIR/caps-data-tools`) and
installed there when missing: micromamba fetches Graphviz, and `uv venv` gets
Datasette, sqlite-utils, fontTools and brotli. The script needs network for
that first install only.

`src/` holds the inputs: `returns.dot`, `make_results.py`, `metadata.json`,
`templates/table-results-results.html` (the members' page; rows, the count and
the medal counts come from Datasette's own query and `place` facet) and
`club.css` (the club's own look, deliberately not Open Habitat's: it is
Peggy's site).

## Sources and licences

No third-party media. Fonts: Instrument Sans and JetBrains Mono from
`design-system/fonts/` (SIL OFL 1.1, see `design-system/fonts/AGENTS.md`),
embedded as a subset in `returns.svg` and used by the captured club page. The
dataset, names, club and regattas are invented (`src/make_results.py`).

## Assumptions about the product

- `publish` as a tool that puts a service at an address the person controls,
  as in `alice-11` and `docs/product.md` ("Agents can publish views and files
  at addresses that the person controls").
- Installing Graphviz without root through micromamba in the person's account.

## Engine needs

- `view()` always prints "· Only for you" after the kind. After Peggy's yes the
  view is `Live` and public, so the header reads "Live · Only for you", which
  contradicts the scene (`alice-11` has the same). A `view(title, html, kind,
  audience)` argument, or dropping "Only for you" for `Live`, would fix it.

## For Jari

- The flow chart's question stays unanswered on purpose: the selling point is
  that drawing the process exposed the gap. If you would rather see it closed,
  one more turn ("Kirsi approves those." → the chart with Kirsi) is easy.
- The capability row keeps "Graphviz, Mermaid" as the program list; the scene
  uses Graphviz.
