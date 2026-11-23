# role-bob

Bob: sales and orders. The three glimpses the page shows (customer list
cleanup, Thursday deliveries, Harbour Hotel quote) now show real program
output. Every number in their screens comes from a run of the scripts in
`src/`, driven by `assets.mjs`. The three sidebar-only glimpses (briefing,
orders map, tender) are as they were ported.

## What changed and why

- **Customer list cleanup.** `src/dedup.py` generates an invented register
  (seeded, 4,205 rows: web buyers, shops and hotels, with planted spelling
  drift and 80 look-alikes at other addresses) and matches it with rapidfuzz:
  names normalised (Ltd/Oy, case, spaces), addresses normalised (Ln. → Lane,
  number order), compared within each postcode, and merged only when the
  address or a company email domain agrees as well. Similar names with a
  matching email at another address go to `ask-bob.csv`. Real result:
  **4,205 rows → 3,901 customers, 304 rows merged into 270 customers, 90 pairs
  to ask, orders 21,733 before and after**. The view shows those counts,
  Corner Books' three real rows before and after the merge (23 + 11 + 7 = 41
  orders), and the first pair from `ask-bob.csv`. The ask is now shorter and
  says "without losing an order", and the work proves it with an order-count check.
- **Thursday deliveries.** `src/route.py` builds the drivable road graph from
  an OpenStreetMap extract of an ordinary Finnish small town, with one-way
  streets respected (9,423 junctions), puts the twenty invented stops on it
  by a fixed seed, measures every leg with Dijkstra, and solves the round
  with OR-Tools: bakery first, three deliver-by times, 4 minutes per stop.
  Real result: **41.5 km, 69 min driving, out 11:00, back 13:28, all times
  met**. Driving to the nearest unvisited stop each time instead would be
  48.8 km. The map is drawn by matplotlib from the same OSM data, with no
  street names and no town name. The view adds Bob's phone list (20 stops with
  arrival times) and the attribution. The old "38 km against 52 last
  Thursday" was invented, so it is gone, and so is the ask's "before noon",
  which the windows did not match.
- **Harbour Hotel quote.** `src/quote.typ` is the studio's quote, typeset by
  Typst 0.15.1 in its built-in Libertinus Serif: an indigo letterhead with a
  block-print strip, the three lines, and the terms. The view shows page 1 as
  rendered (trimmed below the signature) on a desk. The old mock said "VAT
  0 % (business)", which is wrong for a domestic sale. The quote now reads
  €4,980 + VAT 25.5 % (the rate `role-kirsi` uses) = **€6,249.90**, and the
  reply says so.
- `block.css` is new: the dedup card, the map with its stop list (two
  columns on desktop, one on the phone), and the page-on-desk frame. Tokens
  are used throughout. The only hard-coded colour is the bakery marker's
  terracotta, which matches the map.

## Assets (`$ETUSIVU_ASSETS/role-bob/`)

| File | Made by | Size |
|---|---|---|
| `route-map.webp` | OSM (Overpass `out geom`, bbox 60.365,25.60,60.425,25.73) → NetworkX 3.7 + OR-Tools 9.15.6755 → matplotlib 3.11.2 → ImageMagick WebP | 1200×900, 91 KB |
| `quote.webp` | Typst 0.15.1 `compile --format png --ppi 144 src/quote.typ` → ImageMagick crop + WebP | 1191×1330, 71 KB |

The dedup ships no file. Its counts are copied into `block.js` from the
output of `src/dedup.py` (rapidfuzz 3.14.6), which is deterministic.

Reproduce: `TMPDIR=<scratch> node blocks/role-bob/assets.mjs`. It downloads
Typst's official static build and makes a uv venv with pinned versions under
`$TMPDIR/role-bob-assets`, fetches the OSM extract once, runs the three
scripts and prints their results. The Overpass data changes over time, so a
later run can move a stop or a kilometre. If it does, update the numbers in
`block.js` from the printed lines.

`src/` holds the three scripts `assets.mjs` runs. They are kept as their own
files in this block directory rather than as strings inside `assets.mjs`,
because Python and Typst are easier to read and diff that way. They are text,
not binaries, and are not shipped to the page.

## Sources and licences

- Map data © OpenStreetMap contributors, ODbL 1.0
  (https://www.openstreetmap.org/copyright). The attribution is drawn in the
  map image and repeated as text under it in the view. The rendered map is a
  Produced Work. The data itself is not shipped.
- Typst (Apache-2.0) and its bundled Libertinus Serif (OFL-1.1) were used as
  tools. The PDF page is our own content.
- Everything else (register, stops, hotel, prices) is invented. Names come
  from Example Studio's frame (Corner Books, Harbour Gifts and Mill Lane Deli
  also appear in `alice-11`). The register's people are random combinations
  of first and last names.

## Assumptions about the product

The agent writes and runs Python with `uv run --with …`, installs Typst, and
reads an OSM extract the person keeps in `maps/`. All of these are ordinary
programs on a well-configured host. The send happens only after Bob says
"Send it." (unchanged).

## For Jari / the conductor

- `caps-maps` row 13 still says "38 km against last week's 52". The real
  route is **41.5 km**; the honest comparison is nearest-stop-next at 48.8 km.
  That row's owner (or the conductor) should update it.
- The map shows a real town's street geometry with no names on it. The stops
  and the studio are invented and placed by a seed.

## Engine needs

None.
