---
created: 2026-11-08
updated: 2026-11-08
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: Observed by prototype worker in synthetic lab
source_ref: taskfleet:01m6y7pa54ymerjamysezfphzn/observed:offer-acts-in-flow
originating_run: 01m6y7pa54ymerjamysezfphzn
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# Offer card's hidden corner icons stay in flow and squeeze the title

## Description

Observed 8.11.2026 while building the `proto-shares-own-place` round with the
production `OfferCard` (built CSS from `web/src/components/OfferCard.css`).

`.ah-offer > :not(.ah-offer-hit) { position: relative; pointer-events: none; }`
has specificity (0,2,0) and wins over `.ah-offer-acts { position: absolute;
top: 6px; right: 6px; … }` (0,1,0). On a pointer screen (`hover: hover`) the
corner icon row therefore stays in the card's flex flow: it is invisible
(`visibility: hidden`) but still takes its width (about 100 px for globe,
own tab and bin; more when public with the date and copy), so the title and
facts wrap early. In a ~340 px card the title "Testinäkymä – tarjouskortit"
gets a ~140 px column; in ~240 px cards titles break mid-word. Measured in
headless Chromium (1440 px, `matchMedia('(hover: hover)')` true): children
widths mark 32, body 142, acts 100 (computed `position: relative`), chevron 16.

Conversation cards are wider (`--ah-measure`), so the waste is less visible
there, but the narrow assets list and any narrow layout suffer the same.
Likely fix: `.ah-offer > .ah-offer-acts` (or raise the rule's specificity)
for the floating position, keeping the `hover: none` row as is; check with a
spec measuring the body width of a card with a long title.

## Acceptance Criteria

- [x] Pointer-screen corner actions consume no title-column width in narrow cards.
- [x] Touch actions remain visible on their final row and tooltip sizing still passes.
- [x] Browser regression, focused checks and paired 2x visual evidence recorded in result.md.
