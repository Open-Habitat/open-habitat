---
created: 2026-10-14
updated: 2026-10-14
type: improvement
reporter: jari
status: in-progress
priority: normal
lane: web
lane_seq: 25
collision: [web/]
---

# Give conversation cards one inner padding and one right edge

Jari's observations on pilot.59 (2026-10-14), conversation view:

- **Inner padding.** The bash card and the "Vastaus valmis" answer box use different inner padding, and the answer box's is broken: its text and inner blocks (code/output boxes, copy button) sit against the box edge. Every card uses the same inner padding token.
- **One right edge.** The full-width rows (the model/thinking marker row, the Tilannekatsaus card, the composer pill and its button) end at the same right edge, but the bash card and the answer box end about a fingertip short of it. All full-width blocks end at one shared right edge. Blocks inside a card are of course narrower.
- **Stop button.** The square in the Stop button is not centred in its circle.
- **Wrap button.** Show the code/output box's wrap toggle only when the content actually has lines that overflow (check this on resize as well), not on every box.

Screenshot: `pilot59-spacing.png` in this folder (the answer box's content touching its edge, and the general looseness).

Jari also finds the overall spacing too loose (gaps between blocks and the card paddings). A density/spacing-scale prototype round is queued (TODO.md). Do not retune the global scale here. Fix only the inconsistencies, using the existing tokens from `design-system/design.md` and the draft `design-system/drafts/Agentin vuoro.proto.html`.

## Acceptance Criteria

- [ ] Bash, file and answer cards share one inner-padding token, and no content touches a card edge (lab screenshots, desktop and phone width).
- [ ] Every full-width block in a turn ends at the same right edge as the marker row, the recap card and the composer (measured in the lab with element rectangles, not by eye).
- [ ] The Stop square is centred (rectangle centres within 0.5 px).
- [ ] The wrap toggle appears only when a line overflows, and it disappears or appears correctly on resize.
