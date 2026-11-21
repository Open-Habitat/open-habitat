# Result: rail-section gate failures on v0.1.4

There were three separate causes. One was a product defect and one was two
specs that no longer matched an agreed change. The third belongs to the
archive cluster.

## Hiljaiset folds itself on the Desktop Chrome rail (specs outdated)

`rail-turn-returns.spec.ts:52` and `rail-section-filter.spec.ts:109`.

The rail scroll region makes Hiljaiset fold itself while the rail is crowded
and the device has not chosen (`nah:rail-quiet-folded` absent). The
graduation made Tuotokset and Agentin käytössä permanent rail links, so the
rail's content area is about 60 px shorter. At 1280 × 720 it is 459 px, and
the ordinary fixture (3 workspaces, empty Sinun vuorosi and Käynnissä, 2
quiet rows) now counts as crowded by 7 px. Opening Hiljaiset would push
Työtilat under its 11rem floor. The rule is applied as agreed, so this is
not a product defect.

- rail-turn-returns follows a row into and out of Hiljaiset. In the folded
  list the row is not rendered, so its link is not visible.
- rail-section-filter counted the quiet rows while the list was folded (0).
  Narrowing Sinun vuorosi then freed room, Hiljaiset opened by itself, and
  one row appeared. That is crowding working as designed, not the
  narrowing moving a row.

Both specs now start from a device that has opened Hiljaiset. This is the
same fix `rail-icons-quiet.spec.ts` got, now in `web/tests/quiet-open.ts`.
rail-section-filter also asserts that the open list has rows, so its
"nothing else moves" check cannot pass trivially on an empty list.
`lab-rail-scroll-region.spec.ts` still covers the automatic fold.

## A short window cannot reach Työtilat (product defect, fixed)

`settings-close.spec.ts:200` (1280 × 360) and `lab-foundation.spec.ts:8`
(390 × 390 drawer, line 107).

The regions' rail never scrolls (`overflow: clip`), and Työtilat keeps an
11rem floor. When the window is shorter than the rail's head plus that
floor, the workspace list is clipped and nothing can scroll it into reach.
Playwright reported "element is outside of the viewport", and the lab
spec's agreed expectation that a short drawer scrolls failed. Without the
fix lab-foundation fails at :107; with it, it passes.

Fix: below a 560 px tall window the rail scrolls as a whole again, as the
narrow rail does. The conversations' region and Työtilat give up their own
scrolling and floor. This is CSS only (`components.css`, after
`.ah-rail-ws-scroll`). It does not affect windows of 600 px and taller,
which covers every rail-scroll-region case (700, 900, 1000 and the 844
phone).

## Archive from a rail row (archive cluster)

`next-waiting-row.spec.ts:99` and `:215` failed at the archive step: the row
stayed. Archive now reads the conversation's helpers first, and the
synthetic host's unreadable default Taskfleet makes it ask before
archiving. The archive cluster's answering-Taskfleet fixture covers this
spec too. With that fixture applied locally, all next-waiting-row cases
pass, and nothing else in them needed changing. This work does not change
the spec, so the archive cluster's change does not conflict with it.

## Checks

- Three consecutive green runs with `OH_BROWSER_WORKERS=2`:
  `next-waiting-row`, `rail-section-filter`, `rail-turn-returns` and
  `settings-close` (16 cases, next-waiting-row with the archive cluster's
  fixture), and with `--lab` `lab-foundation` and `lab-rail-scroll-region`.
  `lab-shell-header` (600 px) passed once.
- `./scripts/test-focused.sh --area web` passed.

## Decisions for later review

- **The rail is crowded on a 720 px laptop with two quiet rows.** After the
  graduation the rail's head is taller, so an almost empty rail folds
  Hiljaiset to save 7 px of Työtilat's floor. The rule is as agreed and the
  specs were updated to it. Whether the floor (11rem) or the crowding
  margin should leave more room on ordinary laptop heights is a design
  question for Jari.
- **The short-window threshold is 560 px.** Below it the rail returns to a
  single scroll instead of keeping the regions. The value was chosen to
  leave the conversations about two rows over Työtilat's floor, and it
  stays clear of the tested 600 px and taller layouts. Edge chips and
  Työtilat's own scrolling do not appear below it.
- **The spec fix for the auto-fold is to open Hiljaiset on the device.** The
  alternative was a taller viewport. Opening it states the precondition
  directly and does not depend on the head's height.
