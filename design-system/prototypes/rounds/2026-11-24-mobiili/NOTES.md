# The landing page on a phone (24.11.2026)

Jari, 24.11.: on a phone the live page is one endless scroll. The reader
cannot choose whose day to look at, the page never says where they are, and
the calls to action and all navigation disappear. This round is about the
phone experience itself (≤ 900 px): how the stories are presented, chosen and
followed, and where the calls to action live. The desktop stays as it is.
General navigation chrome on both sizes is the parallel round
`2026-11-24-navigaatio`; the last section says how the two meet.

The starting point, measured: the v1 page at 390 px is **80 269 px** tall,
about 95 screens. 45 story steps (Alice 12, six colleagues 3 each, eight
capability groups 1 to 2 each), each with a product screen 600 to 1 900 px
tall. After the hero the only link left in the top bar is GitHub.

## How the round is built

`build.mjs` renders the whole page with v1's own `render.mjs` and leaves it
as it is: same markup, same engine script, same block scripts. On top come
`mobile.css` (after the engine CSS) and `mobile.js` (after the engine and
block scripts). Everything in `mobile.css` except the harness chrome is
inside `(max-width: 900px)` and under `html.mb-on`, a class `mobile.js` sets
only while it has a layer mounted; above 900 px the script mounts nothing.
The layer moves nodes and never clones them, so the engine's and the blocks'
listeners stay attached, and every change is undone in reverse when the
variant is switched or the window grows past 900 px.

The layer holds no content. People, times, asks, counts and result lines are
read from the HTML the engine wrote. The exceptions are a few strings of
interface copy, listed under "New copy" below.

Two things are harness chrome and not part of any variant: the Finnish line
above the page, and on the phone a dark 72 px band under the picker. Both
ends of a phone screen are in use in these variants, so wherever the picker
floats it would cover a bar; the band gives it a place of its own and the
variants' bottom bars sit on the band (`--mb-dock`, 0 in a port). The page is
therefore judged in a viewport 72 px shorter than the device, which is about
what a phone browser's own toolbar takes.

```
cd design-system/prototypes/rounds/2026-11-24-mobiili
export TMPDIR=/var/tmp/agent-scratch/<unique> PROTO_WEB=<web/ with node_modules>
node build.mjs <out-dir>
node check.mjs <out-dir> [<v1-out-dir>]     # the v1 round built with its own build.mjs
```

Built to `~/src/open-habitat-dev/worker-results/mobiili/index.html`
(`?v=1…3`; keys 1 to 3 and ←/→ switch). Screenshots, three videos and
`measure.json` are in `check/` beside it.

## The variants

| # | Variant | Axis: how a day is entered and followed | When it is the right choice | Its cost |
|---|---|---|---|---|
| 1 | **Valinta** (chooser first) | Hub and spoke. After the hero a list of seven people and a grid of eight capability groups; a tap opens that day as its own view, one step per screen, with "Carol’s Thursday · 2 / 3" in the bar, Previous/Next at the bottom, Choose and Install always on top. | The reader should decide what to look at, and the page should be short until they do. Strongest answer to "where am I". | No product screen is seen before a tap (only the hero's capture). The day stops being something one sees whole. A second mode with its own back behaviour and URL (`#/carol/2`). |
| 2 | **Pyyhkäisy** (swipe decks) | One place for all days: avatar chips choose the person, the day is a horizontal deck of step cards with a segment indicator, the screen in each card shows its newest part until "Show the whole screen". Capabilities the same with group chips. Install and "Whose day?" stay at the bottom. | The page should feel like an app and stay a few screens long without hiding the screens. | Sideways swiping has to be discovered and competes with vertical scrolling; cards are still tall (the story text is long), so a card rarely fits one screen; the screen is clipped by default. Most moving parts. |
| 3 | **Aikajana** (compact timeline) | The page keeps its order and scrolls normally. Each day is a list of rows (time, the result line from the sidebar as a chip, the ask); a tap opens that row's story and screen in place, one open per day. A bar on top says "Alice · 13:35 · 2 waiting" and opens a list of people and capability groups; Install, Docs and GitHub sit between the sections. | The day should be readable at a glance, which is the page's argument (one person, ten things, one day), and the page should stay an ordinary page: no modes, links and the back button work as before. | The longest of the three. No product screen is seen before a tap unless a row starts open. The chip shows a conversation's state at that moment, so the same conversation's line can appear on two rows (Alice 08:41 and 12:38). |

## Measurements

`check.mjs`, 24.11.2026, all passing:

| | v1 page | 1 Valinta | 2 Pyyhkäisy | 3 Aikajana |
|---|---|---|---|---|
| Page height at 390×844 | 80 269 px | 5 023 px (home) | 6 844 px | 14 459 px (rows closed) |
| Page height at 360×740 | | 5 289 px | 6 940 px | 14 991 px |
| Taps to any of the 7 days, from anywhere | scrolling only | ≤ 2 (card; or Whose day?/Choose, card) | ≤ 2 (chip; or Whose day?, chip) | 2 (name in the bar, person) |
| Taps to the install section, from anywhere | scrolling only | 1 (bar) | 1 (bottom bar) | 1 (bar) |
| Says whose day and which step | time and counts only | all 45 steps: bar title | all 45: indicator under the chips | all 45: bar (name, time, waiting) |
| Keyboard reaches every step in order | yes | 45 (Enter on a card, then Next) | 45 (chip, then Tab through the cards) | 45 (Tab; Enter opens) |

"From anywhere" was sampled: the top, 30 %, 60 % and the end of the page,
and in 1 also from inside two stories, in 2 from the capabilities, in 3 with
a row open. A tap in the check only counts on something that is in view and
not covered; it never scrolls to find its target. Also checked at both sizes:
clean console, no sideways overflow, a visible focus ring on the layer's
controls, no transition or animation left under reduced motion, the picker
(`picker-check.mjs`), the steps on the page in the accessibility tree in
order (2 and 3; in 1 only the step on screen is in the tree, by design), and
that switching variants or widening the window leaves nothing of a layer
behind.

**Desktop:** at 1440×900 the `.pg` markup is byte-identical to the v1 build
for all three variants, the page is the same 44 980 px, and seven viewport
screenshots down the page are pixel-identical. The harness line and picker
are taken out before the first layout for that comparison; hidden afterwards,
Chromium keeps faded text rastered at the offset the line gave it.

Not measured: a real phone. Scroll snapping, momentum and the browser's
collapsing toolbar behave differently there, which matters most for 2.

## What all three change on the phone, and what they drop

- The engine's phone bar (`.s1-bar`: time, place, three state chips, and the
  conversation list that drops from it) is hidden; each variant has its own
  bar. With it goes the phone's only way to open *another* conversation as it
  stood at that moment. No variant brings it back; say if it should.
- "Scroll: her sidebar moves through the day." is hidden (there is no sidebar
  on the phone).
- The four sourced library claims become one row to swipe.
- v1 leaves role and capability steps their desktop `min-height: 66vh` on the
  phone. Its tall screens hide that; 3's closed rows do not, so the layer
  resets it.
- The engine's "landing" (a scroll nobody drove that ends with a step in the
  upper middle is moved to the line) is switched off while a layer is on: it
  put steps under the layer's bar after every scroll the layer made. A port
  gives it the new bar's height instead.

### New copy (to confirm; everything else is the blocks' text)

1: "Whose day?", "One Thursday at Example Studio. Pick a person.", "N
moments", "Choose", "Previous", "Next", "Install". 2: "Whose day?", "Show the
whole screen", "Show less", "End of Carol’s Thursday", "Next: Dave’s
Thursday". 3: "Whose day", "N waiting / N running / all quiet", "What it can
do". All three: the strip "Install on your server · Docs · GitHub", and "N
examples" for a capability group. "Carol’s Thursday" is composed from the
name; the day is Thursday in every block, but the port should take the title
from the day's data.

## Port

Each list is against the v1 round's files; `website/landing.mjs` gets the
result through `render.mjs`. In every port the rules stay inside
`(max-width: 900px)`, and the no-JS page shows everything open.

### 1 Valinta

- `render.mjs`: after the hero, emit the people chooser (`days` from the day
  and role blocks: name, kicker or role, step count, first and last time) as
  links to `#role-<id>` / `#day`; after `caps-intro`, the group chooser
  (links to `#cap-<id>`); the bar (brand, Whose day?, Install) in place of the
  hero block's `.top` on the phone; the pager and the end strip once per page.
- `engine/client.js`: the story mode: `open(story, i)` / `close()`, the
  hidden-siblings pass, `#/id/n` with `pushState` on entering and
  `replaceState` between steps, `popstate`, focus to the step's ask, Next
  running on into the next story and finally to install; in-page links
  (`a.cap-role`, `#role-*`, `#g-*`) open the story instead of scrolling. The
  phone branch of `update()`/`restLine()` and `.s1-bar` go away.
- `engine/page.css`: section 1 of `mobile.css`, without `html[data-v]`.
- `blocks/hero/block.js`: `.top` hidden ≤ 900 px. `blocks/roles-intro`: its
  text is not shown on the phone at all in this variant; decide whether it
  becomes the chooser's lead.

### 2 Pyyhkäisy

- `render.mjs`: wrap `#day`, Alice's story and `.roles` in one section with
  the people switcher in front; a group switcher in front of the first
  `.cap-g`; the bottom bar once per page. `rolesSection` puts `roles-intro`
  after the roles on the phone (`order` is enough).
- `engine/story.mjs` `storySection`: per step the "Show the whole screen"
  button before `.s1-inline`; an end card after the steps (for Alice the
  `day-end` block goes inside it, so `daySection` hands it in).
- `engine/client.js`: `select(story)`, deck tracking (which card is at the
  left edge), the indicator, closing a card left behind, keeping keyboard
  focus clear of the two bars, links selecting a person and card. Phone
  branch of `update()` and `.s1-bar` go away.
- `engine/page.css`: section 2 of `mobile.css`.

### 3 Aikajana

- `engine/story.mjs`: `dayStep` adds the step's result line and state
  (`segAt(d.SID[g.s], g.t)`, which `railAt` already computes) and the count of
  waiting and running; `capStep` adds the program tag. `storySection` writes
  the `.s1-txt` wrapper itself (today `client.js` builds it) and, in front of
  it, `<h3 class="s1-row"><button aria-expanded aria-controls>` with time,
  chip and ask; the body (`.s1-txt` without its ask, `.s1-inline`) gets the
  id. The `.s1-bar` markup and the `rail`/`chips`/`when`/`av` template parts
  that only it used are dropped.
- `render.mjs`: the bar once per page (mark, the switcher button, the "now"
  text, Install) with the list of people and groups, and the CTA strip after
  `day-end` and after `.roles`.
- `engine/client.js`: the row toggle (one open per story, the tapped row
  keeps its place on screen), the bar's tracking (story and row at the line
  under the bar; an open row in view wins), the list, `a.cap-role` opening
  its row before scrolling. `restLine()` on the phone is the new bar's bottom;
  the phone `BAND`, `--vr-bar` and the `.s1-drop` handling go away.
- `engine/page.css`, `engine/screen.css`: section 3 of `mobile.css`;
  `min-height: 0` for `.s1-role`/`.s1-cap` steps ≤ 900 px; the library row.
  `.no-js .s1-step` shows row bodies open.
- `blocks/hero/block.js`: `.top` hidden ≤ 900 px. `blocks/alice-day/block.css`:
  `.ad-hint` hidden ≤ 900 px.

## With the sticky bar and index from the navigation round

- **1 and 3 bring a top bar of their own, and there must be only one.** In 3
  the navigation round's sticky bar is this bar: its index is the list that
  opens from the name (sections, with the people under "a day" and the groups
  under "what it can do"), and the "now" text sits beside it. In 1 the
  navigation bar is the home state (plus "Whose day?"), and a story replaces
  its contents with Choose, the title and Install.
- **2 stacks badly with a sticky top bar**: its switcher and indicator are
  92 px, and with a 52 px bar above them a 740 px phone loses a fifth of the
  screen before the card starts. With 2 the top bar should scroll away (or
  hide on scroll down), and Install lives in 2's bottom bar instead.
- Back-to-top: 1 does not need one inside a story (every step opens at its
  top). In 3 the mark in the bar is the way to the top. In 2 a floating
  back-to-top button would sit above the bottom bar.
- The picker's ←/→ keys switch variants in the harness; they are not part of
  any variant, and a port of 2 can give them to the deck.

## Recommendation

**3 Aikajana**, with one change to try before porting: Alice's first row
starts open, so the first thing under her intro is a product screen and the
reader learns that rows open.

The reason is what the page is for. Its argument is a day: one person asked
ten things and never waited. On the phone today that day cannot be seen,
only scrolled through. The timeline makes it visible in two screens, in the
blocks' own words (time, what she asked, what came back), and the product
screen is one tap from each line. It is also the smallest departure from the
page as it is: one order of content for both sizes, ordinary scrolling,
links and the back button unchanged, nothing to discover. It answers all
three of the complaints: the bar says whose day and what time, the same bar
changes person in two taps, and Install is always in it.

1 answers "let me choose" most directly and is the shortest, and its bar is
the clearest statement of place. Its price is that the landing page stops
showing anything until the reader commits to a person, and that it adds a
mode. If the timeline feels too long on a real phone, the cheap combination
is 3 for Alice (the page's lead) with 1's chooser cards for the six
colleagues and the capability groups, each opening as a timeline.

2 is the most app-like and the one I would not port: the cards are too tall
to work as a deck, the screen is clipped by default, and sideways swiping is
the one thing here a reader has to find out for themselves.
