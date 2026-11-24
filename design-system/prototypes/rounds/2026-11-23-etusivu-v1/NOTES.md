# Landing page v1: the frame for polishing blocks in parallel (23.11.2026)

Round 6 (`2026-11-22-etusivu-kierros-6`) settled the content. This round is
the frame in which about twenty workers polish it at the same time, one
block each, without touching each other's files. The content is round 6
variant 1 (“Oma osio”) ported unchanged, except that the agent's work is now
closed when the page opens and the screens follow the product. The block
workers' contract is [BLOCKS.md](BLOCKS.md).

## Structure

Hero → Alice's Thursday (12 glimpses beside one sticky product screen) →
“Same place, other work” (Bob, Kirsi, Carol, Dave, Erin, Frank, three
glimpses each) → the library intro and eight capability groups → install
stub. The picker and variants 2 and 3 are gone; so are Alice's other weeks
(variant 3 only).

```
build.mjs  check.mjs  BLOCKS.md  NOTES.md
render.mjs                  the page rendered from the blocks; build.mjs and the
                            website's front page (website/landing.mjs) both use it
engine/                     shared: the conductor's
  kit.mjs                   components a block draws with (product markup)
  story.mjs                 day model, sidebar, story sections rendered to HTML
  nav.mjs  nav.css          the page's navigation: desktop rail, phone bar, strips
  client.js                 browser half: sticky screen, sidebar rows, disclosures,
                            phone rows, navigation
  views.mjs                 the five round-6 mock helpers several blocks share
  page.css screen.css       page, story layout and the slim window (from round 6)
  product.css               the conversation in the product's shapes
  views.css                 round 6's mock-view styles (legacy, shared)
blocks/
  index.js                  the order; only the conductor edits it
  <block-id>/  block.js  block.css?  client.js?  assets.mjs?  NOTES.md
```

The page is rendered at build time in Node from the blocks, so every block's
text reads without JavaScript (the work is then shown open). The browser
script holds no content: each step's screen is its own inline copy, and the
sidebar state at each step and the screens a sidebar row opens are
`<template>`s that `client.js` swaps in. A block's own browser behaviour is
its `client.js`, appended in its own scope. That also keeps a later move to
Astro simple: a block is data plus string-returning functions.

## Block ids: the conductor's division of work

| Block | What | Notes for the worker |
|---|---|---|
| `hero` | top bar, headline, product capture | `assets.mjs` makes `hero.webp` from `docs/assets/readme/hero.png` |
| `alice-day` | Alice, her places, her ten conversations and their sidebar states; intro and end | owns the sidebar lines the glimpses show |
| `alice-01-whats-waiting` | 08:04 notes, mail and calendar on one screen | |
| `alice-02-northside-prices` | 08:34 last week's margin check on a new price list | |
| `alice-03-october-receipts` | 08:41 1,284 emails, 23/26 receipts matched | |
| `alice-04-market-video` | 09:02 ffmpeg installed, 30 s video with captions | showpiece: a real ffmpeg cut; stand-in player in `client.js` |
| `alice-05-shipping-banner` | 09:44 the site's history, publish on “Yes” | |
| `alice-06-planning-memo` | 11:24 recording transcribed on the server, memo, tasks | |
| `alice-07-lunch-phone` | 12:38 phone, summary, dictated answer | |
| `alice-08-returns-workers` | 13:35 five workers, checker on another model | |
| `alice-09-december-newsletter` | 14:30 message queued mid-work, 386 recipients | |
| `alice-10-undo-one-page` | 15:30 one page undone, the undo recorded | |
| `alice-11-wholesale-order-page` | 16:50 her own order page, live, three orders | the order page counts (`client.js`) |
| `alice-12-before-i-go` | 17:28 her own skill, notes for her and the team | |
| `roles-intro` | “Same place, other work” and the people links | |
| `role-bob` | sales: customer list, deliveries, hotel quote | |
| `role-kirsi` | books: October, VAT, cash slide | |
| `role-carol` | design: logo, tote turntable, cut-outs | showpiece: a real Blender turntable, rembg cut-outs |
| `role-dave` | office: new packer, rota, redaction | |
| `role-erin` | courses: animation, ink page, sign-ups | showpiece: a real Manim animation |
| `role-frank` | research: lab database, R model, rerun and care note | showpiece: a real R figure |
| `library-intro` | tens of thousands of programs, four sourced claims | claims only with their source |
| `caps-video-sound` | time-lapse, stems | |
| `caps-pictures` | upscale, blurred faces | |
| `caps-3d` | spare part from measurements | |
| `caps-paper` | old mailbox as archive, lease diff | |
| `caps-maps` | drone map, neighbourhood poster | |
| `caps-print` | certificates, choir parts | |
| `caps-data` | process chart, results site | |
| `caps-web` | site check, club site from text | |
| `install` | install stub and footer | |

31 blocks; for twenty workers the obvious pairs are the two Alice glimpses
of one conversation (`03`+`07` receipts, `08`+`10` returns), `alice-day`
with `roles-intro`, and `library-intro` with `install`.

## How the screen was matched to the product

Sources: `docs/assets/readme/agent-at-work.png`, `view.png`, `workers.png`,
`your-turn.png`; `web/src/components/AgentTurn.tsx` (stages, summary row,
interim and final reply), `Conversation.tsx` (`Message`, `ToolRow`),
`PiBlocks.tsx`, `OfferCard.tsx`, `AdaptiveRail.tsx`, the CSS in
`components.css` and `Controls.module.css`, and the design-system tokens.
`engine/product.css` uses the product's class names (`ah-agent-turn`,
`ah-turn-stage`, `ah-turn-work`, `ah-turn-reply`, `ah-message`,
`ah-tool-row`…) with the values that win in the product's reading view: the
turn's 18 px rail column and 2 px rail line, the dashed stage node, filled
teal squares for finished tools, the filled reply node and the accent ring
of an interim reply, the summary row's chevron that straightens into a bar
when open, the tool row's 9 × 12 px padding with name, mono target and
“✓ done”, 10 px card radii, the uppercase YOU header and the “✓ Reply done”
and “Interim reply” headers. The screenshots were compared at full size with
`agent-at-work.png`: same order and shapes.

**One decision for Jari:** the brief asks for a summary line *and* a “Show
work” button. In the product, a settled turn has no separate button: the
summary row itself (“▸ 3 tools · 2 min 07 s”) opens the work, and the
“Show work / Hide work” pill exists only while a turn runs. The frame
follows the product; the row's accessible name says “Show work: …” and
“Hide work: …”. A visible pill is a few lines in `kit.mjs` `stage()` if he
wants it.

The durations in the summary rows did not exist in round 6. The port derived
them from the time of the person's message to the moment shown (the next
message or the glimpse's time), in the product's format; capability screens
have no times. Block workers may correct them.

Not ported: round 6's work rows that were open to carry a glimpse are now
closed like everything else, so a diff or mail draft that sat in the work is
seen only after Show work. Diffs and drafts that were in the reply stay
visible. The workers list moved out of the work into the product's workers
panel under the turn.

## Budgets

Per file: images WebP/AVIF/SVG ≤ 300 KB, video MP4 ≤ 2 MB (with a poster),
other files ≤ 500 KB; per block ≤ 4 MB; every file in a block's asset
directory must be used. `check.mjs` enforces them from `manifest.json`. The
hero is 110 KB (2000 px WebP). Fonts are copied as files, not inlined. The
built `index.html` is about 0.9 MB, mostly the sidebar screens repeated as
templates; it compresses well, and the website build can render them lazily.

## Build and check

```
cd design-system/prototypes/rounds/2026-11-23-etusivu-v1
export TMPDIR=/var/tmp/agent-scratch/<unique> PROTO_WEB=<web/ with node_modules>
node build.mjs [--only <block-id>] <out-dir>
node check.mjs [--only <block-id>] <out-dir> <shots-dir>
```

Assets come from `$ETUSIVU_ASSETS` (default
`~/src/open-habitat-dev/worker-results/etusivu-assets/`). The whole page was
built to `~/src/open-habitat-dev/worker-results/etusivu-v1/` and passes the
check at 1440 and 390 px; every block passes `--only`.

The port itself was a one-off script (TypeScript's parser over round 6's
`round.js`, `roles.js` and `caps.js`) that is not kept: the blocks are now
the source.

## Navigation and the phone (24.11.2026)

Ported from two rounds, chosen by the conductor for Jari:
`2026-11-24-navigaatio` variant 2 "Hakemisto" (desktop part only) and
`2026-11-24-mobiili` variant 3 "Aikajana" with Alice's first row open. The
rounds themselves stay as they were; their NOTES give the reasons.

- **Desktop (≥ 901 px)**: a quiet rail at the left edge (`engine/nav.mjs`
  `pageRail`, `nav.css`): the four sections, a segment per person and
  capability group that fills as its steps are read ("Carol 2/3"), and Back
  to the top. It appears once the hero is past. Nothing else on the desktop
  changed: with the rail hidden, the page is pixel-identical to the build
  before the port at 1440 and 1024 px (same height, same frames down the
  page), except the hero's top bar, which gained The team.
- **Phone (≤ 900 px)**: each story is a timeline. `storySection` writes a row
  per step (`h3.s1-row` with one button: time, the conversation's sidebar line
  at that moment as a chip, the ask) in front of the step's `.s1-txt` (now
  written at build time, not by `client.js`) and `.s1-inline`. A tap opens the
  step in place, one open per story, and the row keeps its place. Alice's
  first row starts open. The engine's per-story status bar (`.s1-bar`) is
  gone; the page's sticky bar (`phoneBar`) replaces it and the hero's top
  bar. It shows the mark (to the top), the person under it with the moment
  ("13:35 · 2 waiting", from the step's `data-now`), and Install. The person
  opens a list of the seven people and eight groups with Install, Docs and
  GitHub. The same strip sits after Alice's day and after the team. The
  library's four claims are one row to swipe. Without JavaScript there are no
  rows and every step is open, as before.
- **Dropped on the phone**: the status bar's drop-down sidebar, the only way
  on the phone to open *another* conversation as it stood at that moment
  (the mobiili round flagged this; no variant brought it back).
- **Engine**: `jumpTo()` is the one jump (rail, bar, list, capability lines
  into a day): the target lands at its scroll-margin, the hash is pushed,
  focus moves there, and on the phone a step's row opens first. The phone's
  line is the sticky bar's bottom (`--pn-h`, 52 px). Landing (moving a step
  that a scroll nobody drove left in the upper middle to the line) now
  ignores its own scrollend even when it is instant: before, with reduced
  motion, each placement set off the next, which never showed with 87.5vh
  desktop steps but ran a page of short rows to the end. On the phone it
  only moves an open row. A row toggle turns the browser's scroll anchoring
  off for two frames, or it would correct the same shift twice.
- `check.mjs` opens each phone row before exercising its screen, checks
  that one row is open per story, that the bar names Carol in her day, and
  that the bar's list lands at Frank.

