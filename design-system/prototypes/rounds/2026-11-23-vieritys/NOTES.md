# Vieritys: how the story steps come into place (23.11.2026)

## The problem

On the landing page v1 (`2026-11-23-etusivu-v1`) a story is steps on the
left and one sticky product screen on the right (on the phone: the screen
inline in each step under a sticky status bar). A step became active when it
crossed the middle band of the viewport (`IntersectionObserver`,
`rootMargin: '-45% 0px -45% 0px'`), while the screen's top edge rests 20px
from the top. So the text beside the screen's top was the previous, greyed
step, and the active text sat lower down. Jari: the text in focus should be
the one beside the screen's top, and scrolling on advances the screen.

All three variants share one change: a step is active when its top has
reached **the line**, the screen's resting top edge (on the phone, the status
bar's bottom edge), plus a band that differs per variant. Steps start with
their text at the top of their box (v1 centred it vertically), and every step
has `scroll-margin-top` set to the line, so `#g-alice-…` anchors and the
capability links land with the step in place.

## The three variants

| # | Variant | Axis | When it wins | Its cost |
|---|---|---|---|---|
| 1 | **Napsahdus** | The browser's CSS scroll snapping (`proximity`) puts each step's text on the line; the text scrolls with the page. Steps are 75vh, so the next step's time and ask show faded below. | The reader moves in gestures (flick, Page Down, Space) and wants every stop to be a clean step. Least JavaScript; the one closest to plain scrolling. | A short scroll (one wheel event, a small touchpad nudge, under half a step) is pulled back to the step it started from: it resists slow reading. Desktop only: on the phone it would trap the reader inside tall steps (below). With reduced motion there is no snapping; the steps are then 87.5vh so Page Down still lands level, but the wheel rests wherever the reader stops. |
| 2 | **Kiinnitetty teksti** | The text does not move. Each step's text is pinned at the line; when the next step arrives the old text fades out and the new one fades in (220ms, 10px rise) in the same place. A counter level with the screen's bottom edge shows 5 / 12 and twelve ticks. On the phone the status bar becomes the caption: "5 / 12" and the ask. | Reading is calm: the eye never chases the text, and the left and right change together like a slideshow while scrolling still sets the pace. Alignment is exact at every scroll position, not only at rest. | The text that is not active is invisible, so the page gives no preview of what comes next, and a browser find for a hidden step's words needs the landing handler (below) to show it. The most CSS (overlapping step boxes). |
| 3 | **Yläreunan aktivointi** | Free scrolling. Each text rises with the page, comes to rest beside the screen's top while its step lasts, and is pushed off by the next text rising under it. The step becomes active within 64px of the line. Every text's opacity follows its distance from the line, so the next one brightens as it comes up and the old one dims as it leaves. | The page should feel like ordinary scrolling with nothing taking over; the motion itself shows that time moves. | Continuous motion on the left; for 64px of scroll the new screen is already showing while its text is still settling. Opacity is recomputed on every scroll frame. |

On the phone all three activate at the status bar. Variant 2 adds the
caption in the bar; variants 1 and 3 behave the same there (1 without its
snapping), which is the honest result: the phone already has the screen
beside its text, so only the activation line mattered there.

### Why proximity, and why not on the phone

`mandatory` snapping on the page's root would make every resting position a
step, so the reader could not stop in the intro or leave the story at its
end; toggling it on only inside the story makes the browser re-snap to the
nearest step at the moment of switching, which pulls the reader back to the
first step. `proximity` lets the reader rest outside the story. Measured in
Chromium: a gesture shorter than half a step (one 100–300px wheel event)
snaps back to where it started; a flick of 400px or Page Down moves on one
step. On the phone the steps are 1,080–2,370px tall (each carries its
screen), and the same rule pulled every 400px drag back to the step's start,
so the end of a screen could never be read. So on the phone the variant does
not snap.

### Shared details

- **Keyboard.** Page Down and Space scroll 87.5% of the viewport in Chromium,
  so the steps of variants 2 and 3 (and of 1 with reduced motion) are
  exactly 87.5vh: each press is one step and none is skipped. Variant 1's
  75vh steps rely on the snap.
- **Find-in-page and screen reader jumps.** The browser centres what it
  found, which puts the found step mid-screen (and in variant 2 invisible).
  A scroll that ends without wheel, key, touch or pointer input in the last
  700ms and leaves a step's top between the line and 62% of the viewport
  moves that step to the line. The check simulates this with
  `scrollIntoView({ block: 'center' })` on step 8's story.
- **Screen readers** read the steps in order: the DOM order is unchanged,
  and the invisible texts of variant 2 are only `opacity: 0`, still in the
  accessibility tree. The counter and the phone caption are `aria-hidden`.
- **Reduced motion.** No snapping (1), no cross-fade or slide (2), smooth
  scrolls become jumps. Variant 3's distance fade stays: it follows the scroll
  and does not move anything by itself.
- **The last step** of variants 2 and 3 holds its text as tall as the screen,
  so the section's end lets both go at the same moment.

## Measured alignment

`check.mjs` walks Alice's 12 steps (and Carol's 3) and records, for each
step, how far its text's top is from the screen's top edge (phone: from 16px
under the status bar) at the first rest after the step became active. 0 is
level; negative is above. "Flick" is four 100px wheel events 16ms apart.
1440×900, motion allowed:

| Variant | Flick | Page Down / Space | Arrow ↓ | Page Down, reduced motion | Carol, flick / Page Down |
|---|---|---|---|---|---|
| 1 Napsahdus | 0 on all 12 | 0 on all 12 | 0 or +235 (the arrow's 40px steps activate the step 235px below the line and do not trigger the snap until the next press) | 0 … +5 (no snap; 87.5vh steps) | 0 0 0 / 0 0 0 |
| 2 Kiinnitetty | 0 on all 12 | 0 … +2 | 0 on all 12 | 0 … +2 | 0 0 0 / 0 0 +1 |
| 3 Yläreuna | 0 on all 12 | +1 … +6 (Page Down is 787px, a step 787.5px: the half pixel adds up) | 0 … +30, then 0 once the text pins (activation band 64px) | +1 … +6 | 0 0 0 / 0 0 +1 |

A single 100px wheel event ("nudge") never moved variant 1 off the first
step: the snap pulls it back each time. In variants 2 and 3 it takes about
eight nudges per step, which is just their scroll length.

390×844:

Every variant activates the step when its top passes under the status bar,
and no step is skipped. Where the text then *rests* depends on the gesture,
because a phone step (text plus its screen) is 1,080–2,370px tall, taller
than the viewport: with arrow keys the text is within −46 … +15px of the
line when the bar switches; a 400px flick or a Page Down leaves it anywhere
from 0 to −695px (scrolled under the bar, the step's screen in view). That
is the same for all three: on the phone only the activation line and, in
variant 2, the caption in the bar differ. Holding the phone text at the line
would need the text pinned over its own screen, which covers the screen.

Landings, all variants and both sizes: `#g-alice-receipts` on load, the
capability-style link to `#g-alice-orders`, and the simulated find of step 8
each end with that step active and its text level (|offset| ≤ 3px); all
twelve asks are in the accessibility tree in order; the console is clean.

## The port (after Jari chooses)

In every case the change is to `engine/client.js` and `engine/screen.css`
(the `.s1` rules live in `page.css`, which loads first, so rules appended to
`screen.css` win). `client.js` here is the v1 engine with the changes marked
`SCROLL`; take only the chosen variant's parts.

Common to all three:

1. `client.js`: delete the `IntersectionObserver` at the end of `initStory`
   and add `update()` (the line, the band, `show(i)` for the last step whose
   top is at or above line + band) on a requestAnimationFrame-throttled
   `scroll` and `resize`. About 25 lines.
2. `client.js`: the capability link scrolls with `block: 'start'`, not
   `'center'`.
3. `screen.css`: `.s1-step` without vertical centring or padding, with
   `scroll-margin-top: 20px` (phone: the bar's height, measured into
   `--vr-bar`), and the last step at least as tall as the screen.

Then, per variant:

- **1 Napsahdus**: band 30% of the viewport (phone 48px); in `screen.css`
  `html { scroll-snap-type: y proximity }` in a desktop,
  `prefers-reduced-motion: no-preference` query, and
  `.s1-step { scroll-snap-align: start; height: 75vh }`. No wrapper needed.
- **2 Kiinnitetty teksti**: band 2px; the step text in a
  `<div class="s1-txt">` (one line in `story.mjs`, or the few lines that wrap
  it in `client.js` here); the counter and the phone caption (about 15 lines
  in `initStory` and `show`); the landing handler (about 20 lines); the
  variant's CSS block (overlapping 87.5vh step boxes, the sticky invisible
  texts, the counter, the bar caption): about 25 rules.
- **3 Yläreunan aktivointi**: band 64px; the `.s1-txt` wrapper; the distance
  fade (6 lines in `update()`); the landing handler; CSS: 87.5vh steps and a
  sticky `.s1-txt` with `opacity: var(--vr-o)`, 4 rules.

## Build and check

```
cd design-system/prototypes/rounds/2026-11-23-vieritys
export TMPDIR=/var/tmp/agent-scratch/<unique> PROTO_WEB=<web/ with node_modules>
node build.mjs ~/src/open-habitat-dev/worker-results/vieritys
node check.mjs ~/src/open-habitat-dev/worker-results/vieritys [desktop|phone]
```

Assets come from `$ETUSIVU_ASSETS` as in v1. `build.mjs` calls the v1
round's `render({ only })` twice (`alice-day`, `role-carol`), takes the
engine CSS once, swaps the engine's `client.js` for this round's, and layers
`scroll.css` on top; it fails if the renderer's output no longer starts with
the engine files. `check.mjs` writes `check/measure-<size>.json`,
screenshots at three positions per variant (Alice's first step, between
steps 4 and 5, Carol's second step), and a short video per variant and size
(`check/video/*.webm`) into the output directory. The picker is the library's
`lib/picker.css` with PICKER.md's behaviour, checked by `picker-check.mjs`;
the buttons say Napsahdus / Kiinnitys / Yläreuna (short so they do not wrap
at 390px), and their titles and the line above the page carry the Finnish
description. `1`–`3` or `←`/`→` switch. Switching keeps the reader at the step they are at.
