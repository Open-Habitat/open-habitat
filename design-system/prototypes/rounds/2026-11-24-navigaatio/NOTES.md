# Navigation on the long landing page (24.11.2026)

The landing page (round `2026-11-23-etusivu-v1`, which the live site is
built from) is 45 000 px tall at 1440 × 900 and 80 300 px at 390 × 844,
about 50 and 95 screens. The hero's top bar scrolls away with the hero, so
far down the page there is no way back up and no way to jump to another
part. This round answers that three ways, each over the **whole page**
rendered by v1's `render.mjs` with all the real blocks. It does not change
the v1 round: each variant's CSS and JS sits on top of the page, switched by
`html[data-nav]`.

```
build.mjs  check.mjs  NOTES.md
nav/common.js           sections and the reader's place, read from the page; one jump
nav/common.css          the phone fix for stories without a status bar (below)
nav/v1-ylapalkki.*      variant 1
nav/v2-hakemisto.*      variant 2
nav/v3-valiotsikot.*    variant 3
harness/switch.js       picker → variant mount/unmount (keeps the reader's place)
harness/harness.css     the Finnish description strip, the phone picker clearance
```

```
cd design-system/prototypes/rounds/2026-11-24-navigaatio
export TMPDIR=/var/tmp/agent-scratch/<unique> PROTO_WEB=<web/ with node_modules>
node build.mjs [out-dir]          # default ~/src/open-habitat-dev/worker-results/navigaatio/
node check.mjs [out-dir] <shots-dir>
```

The picker is `../../lib/picker.css` and `picker.js` verbatim (1–3, ← →).
There is no replay button: no variant has an entrance worth replaying. The
variants are full-page states, not a stage, so each render function mounts
its variant on the page as a side effect (`harness/switch.js`). On the
phone the corner buttons of variants 2 and 3 sit 52 px higher so the
centred picker does not cover them. That offset (`--proto-dock`) is
prototype only; the port's is 0.

## The variants

| # | Variant | Axis | When it wins | Its cost |
|---|---|---|---|---|
| 1 | **Yläpalkki** (fixed top bar) | persistent chrome at the top, sections only | The reader should always see where they are and reach any section in one click (desktop) | On the phone it stacks on the stories' own status bar: 44 + 75 px of fixed chrome (14 % of 844 px) for the whole read. The Sections button is at the top, out of thumb reach. The rest line moves down 48 px, so the screen is 48 px shorter. |
| 2 | **Hakemisto** (index and progress) | the index as a separate instrument: at the side on desktop, under the thumb on the phone, with progress per part | The page is a story the reader moves through: it says where they are (Alice 5/12, Carol 2/3) and how much is left, with every person and group one or two taps away | The most code: progress follows the engine's active step. The desktop rail is discreet (4 px segments, labels on hover or focus), so some readers will not find it. On the phone the button covers a corner of the content. |
| 3 | **Väliotsikot** (between-section strips and Top) | no chrome while reading; navigation in the page's flow, plus Top on scroll-up intent | Uninterrupted reading matters most, and readers move section by section | Mid-story the only route is scroll up, Top, then the hero's links: three actions to another section. The strips add 1 800 px (desktop) and 2 800 px (phone) to the page. Top only appears when the reader scrolls up. |

**Kiinteä yläpalkki.** The bar appears as soon as the hero's own bar leaves
the viewport, not after the whole hero, so there is never a stretch without
navigation. It stays on both sizes once shown. I judged against hiding it on
scroll down: that would put three actions between the bottom and a section
on the phone (scroll up, Sections, choose). It would also move the stories'
status bar under the reader's thumb whenever the scroll direction changed.
The current section is underlined and carries `aria-current="location"`;
the mark goes to the top. On the phone the bar shows the mark, the current
section's name and Sections, which opens a sheet: the four sections with
their headings, Back to the top, Docs, GitHub.

**Sisällysluettelo / etenemispalkki.** Desktop: a rail at the left edge. The
day is one long segment, each person and capability group a short one, and
each segment fills as its steps are read. Collapsed, it takes 4 px of the
page margin. Hover or keyboard focus lays the labels over the page beside
the same segments, and the segments do not move. At 1440 px and wider the
current person's or group's name and count also show beside it while
collapsed. Phone: a button in the bottom-right corner shows a page-progress
ring and the reader's place ("Carol 2/3"). It opens a bottom sheet with the
whole index: Alice, the six people with avatar, role and progress, the eight
groups, Install. The sheet opens scrolled to the reader's place, and Back to
the top is at its bottom, under the thumb. The button's label has a fixed
width: anchored to the right edge, a label that changed width would move the
button. The first check caught exactly that as a layout shift of 0.028.

**Osioiden väliotsikot + paluu.** There is a strip after Alice's day, after
the team and after the capabilities. Each one has the next section as the
obvious way on, the people or groups in it as cards, the other sections,
and a path Top · A day · The team · What it can do · Install, with the
section just read marked `aria-current="location"`. A last strip between
install and the footer covers the whole page, so from the bottom every
section is one tap away. The day's and the library's headings stick while
their intro scrolls under them and leave with it (about 250 px). Top appears
after 56 px of upward scrolling past 1.5 screens and leaves after 16 px down.
It is a link in the page's tab order and shows on keyboard focus.

## Measurements (check.mjs, reduced motion unless stated)

All checks pass at 1440 × 900 and 390 × 844, plus load and alignment at
1024 × 768 and 700 × 800. The console is clean, nothing leaves the
directory and the page does not scroll sideways.

| | v1 desktop | v1 phone | v2 desktop | v2 phone | v3 desktop | v3 phone |
|---|---|---|---|---|---|---|
| Actions from the bottom to the top | 1 | 1 | 1 | 2 | 1 | 1 |
| … to each main section | 1 | 2 | 1 | 2 | 1 | 1 |
| Mid-page to the top | 1 | 1 | 1 | 2 | 2 (scroll up, Top) | 2 |
| The engine's line (px from top) | 68 | 119 (44 + status bar) | 20 | 75 | 20 | 75 |
| Fixed chrome while reading | 48 px | 44 px + status bar | 4 px rail in the margin | 52 px corner button | none | none, Top on scroll-up |
| First Tab lands on | the bar's mark | the bar's mark | the rail's Top | the corner button | (from the day's end) the strip | the strip |
| Layout shift, full scroll (none: 0 / 0.0011) | 0 | 0.0011 | 0 | 0.0011 | 0 | 0.0011 |
| Page height (none: 45 017 / 80 304) | 44 890 | 80 361 | 45 017 | 80 361 | 46 855 | 83 140 |

- **Activation.** Steps were placed at their anchors: Alice 1, 5 and 12,
  Carol 2, a capability step, and step 7 at the in-between widths. In every
  variant each was the active step, its text within 0.5 px of the sticky
  screen's top (desktop) or its top within 0.5 px of the status bar
  (phone), and no bar covered the screen or the status bar.
- **Anchors.** A capability line pointing into a day (`#g-carol-cut`) lands
  its step at the line. Loading at `#role-carol` puts its top at the bar's
  edge (47.7 px with a 48 px bar; 0 px without one), and loading at
  `#g-alice-video` puts the step at the line. With motion on (smooth
  scroll), a jump from the bottom to the team lands within 0.5 px.
- **aria-current** follows the reader in v1 and v2 (checked inside the team
  and after every jump); v3's strips each mark their own section.
- **Reduced motion:** no transitions on any variant's chrome, and jumps are
  instant. The design system's motion tokens already zero every transition.
- The phone page grows 57 px in every variant against `?nav=off`. That is
  the harness's description strip wrapping to more lines, not the
  navigation. Variant 1 makes the desktop page 127 px shorter: each story's
  last step is sized from `--vr-top` by the engine's own formula. It is a
  static difference, not a shift while reading (layout shift 0).

Screenshots of each variant at the top, mid-story (Alice 5), in the team
(Carol 2), near the end (the last capability group) and open (sheet, rail
or strip), both sizes, are in the built directory's `shots/`. I looked at
all of them.

## Found on the way (engine)

- **The phone's line in a story without a status bar.** On the phone the
  engine's line is the status bar's bottom edge. A capability group has no
  status bar, so `restLine()` returns 0 and its steps land under a
  scroll-margin of `--vr-bar` (49 px) for a bar that does not exist. In v1
  this is harmless, because the phone carries every screen inline. Under a
  top bar it is not: a capability step reached by its anchor would sit
  below a line it can never cross. The prototype wraps `restLine` and sets
  the scroll-margin in `nav/common.css`. The ports below include the
  one-line fix.
- **The hero's top bar has no link to the team** (A day, What it can do,
  Install, Docs, GitHub). Every port below adds it.

## The ports

Shared by all three: **`jumpTo(el)` in `engine/client.js`**. The cap-role
handler already does this inline (`selfScroll = true`, `scrollIntoView`,
`pushState`, reduced motion). Pull it into a function that also focuses
the target (`tabindex="-1"` when it has none, `preventScroll`). Add one
delegated handler for `a[data-jump]`, and use it for every link below.
`#top` scrolls to 0 and focuses the hero's `h1`. Without `selfScroll`, a
smooth jump to a section header that ends with a step in the upper middle
gets re-placed by the engine's landing code.

### Port of variant 1 (Yläpalkki)

1. `engine/screen.css`: `:root { --nav-h: 48px; --vr-top: calc(20px + var(--nav-h)); }`
   and at ≤ 900 px `--nav-h: 44px`. The phone step's
   `scroll-margin-top: calc(var(--vr-bar) + var(--nav-h))`, and
   `.s1-norail > .s1-steps > .s1-step { scroll-margin-top: var(--nav-h) }`.
   `:is(#day, #roles, #can, #install, .role, .cap-g) { scroll-margin-top: var(--nav-h) }`.
2. `engine/page.css`: `.s1-app { height: calc(100vh - 104px - var(--nav-h)) }`,
   `.s1-cap .s1-app { height: calc(100vh - 120px - var(--nav-h)) }`, and at
   ≤ 900 px `.s1-bar { top: var(--nav-h) }`.
3. `engine/client.js`: `restLine()` on the phone returns
   `st.bar ? st.bar.getBoundingClientRect().bottom : <--nav-h>`, plus `jumpTo`.
   Activation needs nothing more, because the desktop line is read from the
   screen's computed `top`.
4. `blocks/hero/block.js`: add The team (`#roles`) to `.top`. Add the
   `<header class="tb">` before it: the mark as a `#top` link, four
   `data-sec` links, Docs, GitHub, the phone's current-section label and the
   Sections button. Add the `<dialog class="tb-sheet">` (sections with their
   headings, Back to the top, Docs, GitHub). Copy the markup from
   `nav/v1-ylapalkki.js`. The four sections are static, as `.top`'s links
   already are.
5. `blocks/hero/block.css` (new): `nav/v1-ylapalkki.css`'s bar and sheet
   rules under `[data-block="hero"]`. The bar's z-index must stay above the
   status bar (5).
6. `blocks/hero/client.js` (new, about 40 lines): an IntersectionObserver on
   `.top` sets `data-shown` from the **last** entry (a deep link delivers
   two). The current section is the last of `#day #roles #can #install`
   whose top is above 30 % of the free viewport; it sets `aria-current` and
   the phone label. Also the sheet: `showModal()`, close on link, backdrop
   and ✕; Escape and focus return are the dialog's own.

### Port of variant 2 (Hakemisto)

1. `engine/client.js`: `jumpTo`, the `restLine` fix (with `--nav-h` = 0 it
   returns 0 as before), and in `update()` after `st.show(i)`, the index's
   progress: per story, done = `i + 1` while inside it, all once passed, 0
   before. This sets `--p` and the `n/m` text on the index item with
   `data-story` = the story's key, and `aria-current` on the current
   section and item. The engine already has `i` and the story's rect there,
   so this is about 25 lines. Stories off screen keep their last state;
   compute passed/next from the rect as `nav/common.js` does.
2. `engine/index.mjs` (new): `pageIndex(sections)` returns the rail, the
   corner button and the `<dialog>` (markup from `nav/v2-hakemisto.js`).
   `sections` is `[{ id, label, title, kids: [{ key, href, label, sub, avatar, steps }] }]`.
3. `render.mjs`: build that list from what it already holds: the day
   (`d.g.length`), the roles' `days` (name, role, avatar, picked step
   count), the caps groups (`b.group.name`, `b.show.length`). Append
   `pageIndex(list)` to the HTML. This is the conductor's file, so it is the
   one change a block worker cannot make.
4. `engine/page.css`: `nav/v2-hakemisto.css` without the `html[data-nav]`
   prefix, and the phone `.s1-norail` scroll-margin of 0.
5. `blocks/hero/block.js`: add The team to `.top`.
6. The rail and the button hide while the hero is in view, via an
   IntersectionObserver on `.hero`, last entry.

### Port of variant 3 (Väliotsikot)

1. `engine/next.mjs` (new): `whereNext(here, sections, { last })` returns
   one strip (markup from `nav/v3-valiotsikot.js`).
2. `render.mjs`: emit `whereNext('day')` after the day section,
   `whereNext('roles')` after the roles section and `whereNext('can')`
   after the caps section. Pass `whereNext` in `ctx`.
3. `blocks/install/block.js`: put `${ctx.whereNext?.('install', { last: true }) ?? ''}`
   between `</section>` and the footer, which the install block owns.
4. `engine/page.css`: the strip, card and Top styles from
   `nav/v3-valiotsikot.css`, plus
   `:is(.day-intro, .caps-intro) > h2 { position: sticky; top: 0; … }`.
5. `engine/client.js`: `jumpTo`, and the Top link's scroll-up intent: one
   passive scroll listener, 56 px up past 1.5 screens shows it, 16 px down
   hides it. Also the phone `.s1-norail` scroll-margin of 0 in `screen.css`.
6. `blocks/hero/block.js`: add The team to `.top`. From mid-story, Top
   leads here, so this is where the reader picks a section.

## Recommendation

**Variant 2, Hakemisto.** The trouble is worst on the phone, and there the
stories already keep a status bar fixed at the top. Variant 1 stacks a
second bar on it, 119 px of fixed chrome for 95 screens of reading, and
puts its menu where the thumb does not reach. Variant 3 keeps the reading
clean, but the reader lost in the middle of Carol's story still has no way
to the capabilities in under three actions. Variant 2 leaves the stories
untouched: the line, the screen height and the status bar all stay where
they are. Its button sits where the thumb already is, and it answers
"where am I" as well as "take me there". On a page that is a sequence of
stories, "Carol 2/3" is what tells a reader the end is near. It costs the
most code, mostly the progress in `update()` and a `render.mjs` list. The
quiet desktop rail is the part to watch: if Jari finds it too easy to miss,
the 1440 px label rule could start at 1280 px.
