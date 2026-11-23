# caps-web

Capabilities: The web. Two capabilities are drawn in full, and both are real:
the shop check shows what lychee, pa11y and Lighthouse actually found on a
shop with planted problems, and the club site is a Chromium capture of a site
Hugo built from Markdown. Rows 25 and 44 stay in the list.

## What changed and why

- **Group line** now says what the reader gets from the two showpieces: "Ask
  whether your site still works and get the true answer, fixed. Hand over a
  folder of texts and get a site you can keep up in a sentence."
- **Shop check (35, Alice).** Her ask is her own worry, and it names the three
  things she cares about (links, speed, whether everyone can use it). The work
  runs the three programs on the whole sitemap; each tool row's output is the
  program's real result, in the program's own words (lychee's summary line,
  pa11y-ci's "✘ 104/105 URLs passed" and HTML_CodeSniffer's message). The
  reply ranks the findings by harm. Alice says "Fix them, and show me before
  anything goes live"; the second turn fixes all three in the shop's files and
  runs the same checks again. **Nothing is published**: the scene ends on
  "Say yes and I publish", and the report's last row is "Waiting for your
  yes".
- **The view is a report, not a mock.** `shop-check.html` draws the numbers
  from `src/check/findings.json`, which `assets.mjs` writes from the programs'
  JSON. A toggle (the engine's `data-view`) switches between *Found* and
  *After the fixes*. The checkout row shows the button in its real colour
  (#D9805A, 2.92 : 1) next to #B65D37, which is the colour HTML_CodeSniffer
  itself recommended (4.6 : 1). State is carried by mark shape and word as
  well as colour (✕ circle, ! diamond, ✓ circle, open ring).
- The shop is 105 pages, not the 640 the round-6 copy invented, and the
  capability row's result now quotes the true counts.
- **Club site (34, Peggy, Riverside Rowing Club).** The club stays the page's
  recurring club (caps-data shows its results site in the same teal and gold;
  this site uses the same palette, so they read as one club). Hugo is missing,
  is fetched from its official release into `~/.local/bin`, and builds the
  site from seven Markdown files, one YAML file of training times and one
  layout. Peggy then sends one sentence ("Add Saturday: our women’s four
  won…") with her yes, and the agent writes the news item, rebuilds and
  publishes. That is the selling point of the row: keeping the site up is one
  sentence. The view is the live site, with Saturday's win marked *New*.
- Durations are on every turn.

## Assets

| File | Size | Made by |
|---|---|---|
| `$ETUSIVU_ASSETS/caps-web/club.webp` | 186 KB, 880 × 2604 | Hugo 0.170.1 extended (official linux-arm64 release): `hugo --minify` over `src/club/` with three photographs in `assets/photos/`, resized by Hugo's own image pipeline (`.Fill … webp`); served by `python3 -m http.server`, captured by Playwright 1.63.0 Chromium at 440 CSS px wide, the whole page, 2×; ImageMagick 6.9.12 WebP q80. |
| `src/check/findings.json` (committed text, not shipped) | 19 KB | `src/shop/make_shop.py` writes the shop (105 pages; seeded) and, with `--fixed`, the shop as repaired. Each version is served locally, the supplier from a second local server, and checked by lychee 0.24.2 (`lychee --format json --remap 'https://northside.example.org <local>' <every sitemap URL>`), pa11y-ci 4.1.1 with axe-core 4.14.0 and HTML_CodeSniffer (`--sitemap … --sitemap-find https://shop.example.org --sitemap-replace <local>`, WCAG2AA, Playwright's Chromium), and Lighthouse 13.6.0 (`--only-categories=performance`, default simulated mobile throttling) on every product page before and on the eleven slow ones after. |

The checks were run against `127.0.0.1`; the report and the tool rows show the
shop's fictional address. The shop's product photographs are linen swatches
ImageMagick draws (`+noise Gaussian -motion-blur`); eleven pages carry the
4000 px original (4.4 MB), the rest a 1200 px copy (about 50 KB).

Rebuild: `TMPDIR=<scratch> PROTO_WEB=<web/ with node_modules> node blocks/caps-web/assets.mjs`
(about ten minutes, mostly Lighthouse and pa11y). `CAPS_WEB_ONLY=club`
remakes the club picture alone. Tools are cached in `$CAPS_WEB_TOOLS`
(default `$TMPDIR/caps-web-tools`); the first run needs network for Hugo,
lychee, the npm packages and the three photographs.

## Sources and licences

The three photographs on the club site, all from Wikimedia Commons under
**CC0 1.0** (no attribution required; credited here anyway). They are
downloaded by `assets.mjs`, not committed, and appear only inside `club.webp`.

| In the site | Commons file | Author | Licence |
|---|---|---|---|
| Front page: an eight from above on a tree-lined river | [St George's College Boat Club, Desborough Cut, River Thames.jpg](https://commons.wikimedia.org/wiki/File:St_George%27s_College_Boat_Club,_Desborough_Cut,_River_Thames.jpg) | Mertbiol (own work) | CC0 1.0 |
| Training card: fog on the water | [Ripple on a foggy buoyed late.jpg](https://commons.wikimedia.org/wiki/File:Ripple_on_a_foggy_buoyed_late.jpg) | Alachofra (own work) | CC0 1.0 |
| History card: a 1949 regatta (cropped to the picture) | [Rowing on the River Murray(GN14199).jpg](https://commons.wikimedia.org/wiki/File:Rowing_on_the_River_Murray(GN14199).jpg) | State Government Photographer, South Australia; History Trust of South Australia | CC0 1.0 |

The real places in those photographs are not named anywhere on the page; the
club, its address, its rowers and its news are invented. Font in the club
site: Instrument Sans from `design-system/fonts/` (SIL OFL 1.1). The shop,
its products, the supplier and every number are invented or come from the
runs above.

## Assumptions about the product

- `publish` as a tool that puts a site at an address the person controls, as
  in `caps-data` and `alice-11`, and only after the person's yes.
- Installing Hugo and lychee without root into `~/.local/bin`, and `npx` for
  pa11y-ci and Lighthouse, in the person's own account.
- The agent can reach the person's shop over HTTP from the server.

## Engine needs

- A caps screen opens scrolled to its last turn, and the view scrolls with the
  conversation, so a tall view shows its middle and hides its own header. This
  block pins its view (`position: sticky` on `.scr-view` beside the
  conversation) and gives the club site a 560 px window with its own scroll.
  Other blocks with tall views have the same problem; the engine could pin
  every view.
- `.scr-view-b` is a size container, so a block cannot ask with `@container`
  whether the screen is in its side-by-side layout; the club window uses
  `@media (min-width: 900px)` instead.

- `view()` always prints "· Only for you" after the kind. The club view is
  `Live` and public after Peggy's yes, so the header reads "Live · Only for
  you" (caps-data and alice-11 have the same contradiction). An audience
  argument, or no "Only for you" on `Live`, would fix it.
- There is no warning colour token; the slow-pages mark uses
  `--ah-syntax-number` (amber in both themes). A `--ah-warn` token would be the
  right source.

## For Jari

- The shop check ends before publishing on purpose. If you want the close,
  one more "Yes" → `publish` turn is easy.
- The tool rows' outputs are condensed from the real outputs (the full lychee
  list is 23 lines); the counts and messages are verbatim.
