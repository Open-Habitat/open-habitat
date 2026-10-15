---
created: 2026-10-15
updated: 2026-10-15
type: feature
reporter: jari
status: done
priority: high
lane: web
lane_seq: 38
collision: [web/]
preparation: ready
closed: 2026-10-15
---

# Quiet agent work: hidden by default behind the information row

Jari chose on 2026-10-15, over five `/prototype` rounds, that a Pi turn's work is
hidden by default. The reader sees that the agent is working and what it is
doing now, and opens the work only when they want it. The agreed behaviour is
written in `design-system/design.md` (Keskustelu, the paragraph beginning
"Agentin työ on oletuksena piilossa") and shown in the draft
`design-system/drafts/Agentin vuoro.proto.html` (`R` replays the turn). The
draft's code for it is `design-system/prototypes/lib/quiet.js`, `quiet.css`,
`live.js` and `stage.js`; the draft is a presentation reference, not production
code.

## What the reader gets

- **Working turn:** the thread is closed. One information row shows
  "Agentti työskentelee", the current phase (Ajattelee, Ajaa bash, Vastaa …)
  and the elapsed time; the reply appears below it as it streams. At the
  start of the row is a "Näytä työ" button (label "Piilota työ" when open,
  same width either way, chevron turns).
- **Opening and closing:** the button stays under the pointer: the work
  appears above it and the scroll position compensates in the same frame, so
  the button never visibly jumps. On opening, the revealed steps fade in
  staggered (about 45 ms apart, 160 ms each; none under
  `prefers-reduced-motion`). Round `rounds/2026-10-15-nayta-tyo`, direction
  Porrastettu (C).
- **The row is stable:** the clock tick and phase changes update only that
  text. Re-rendering the row (and so replacing the button element) loses
  clicks and makes the hover flicker; Jari hit exactly this in the prototype.
  A test must hold the button element across ticks and toggle it on every
  click.
- **Settled turn and history:** the thread is closed and shows as its summary
  line in the head (already implemented); it opens on click. A thread the
  reader opened or closed stays that way.
- **Inside an open or live thread:** the block that is streaming is open and
  closes when it finishes; finished blocks are closed unless the reader opened
  one (round `2026-10-15-saikeet`).
- **Following:** the view follows the newest content until the reader scrolls
  up themselves (wheel, touch, keys, scrollbar). Content shrinking because a
  block closes is not the reader scrolling and must not stop following
  (`prototypes/lib/stage.js`).
- **Density:** Tiivis (`prototypes/lib/density.css`, round
  `2026-10-14-tiheys`) expressed as tokens, not view-level overrides.
- **Default switch:** the account menu has "Agentin työ: Piilossa /
  Näkyvissä" next to the theme. It is a device presentation preference like
  the theme, not host state.

## Acceptance Criteria

- [x] The lab shows a working turn closed behind the information row, and the
      button toggles the work on every click while the clock runs (browser
      test holding the same element across at least two ticks).
- [x] Opening keeps the button's viewport position within 1 px in the frame
      after the click (browser test).
- [x] History and settled threads start closed; a reader's open/close choice
      survives new events in that conversation.
- [x] Following stops only on the reader's own scroll, not on content
      shrinking.
- [x] Tiivis density is in the tokens; the account menu switch changes the
      default and survives a reload.
- [x] Lab screenshots compared with the draft in the same states (working
      closed, working open, settled, phone width), every deviation fixed or
      justified in `result.md`.
- [x] `result.md` has a "Decisions for later review" section.
