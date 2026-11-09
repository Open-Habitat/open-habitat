# Result

The rail row's worker mark is now one 18 px branch glyph (`WorkerBranchMark`
in `web/src/components/WorkerMark.tsx`). Its end node is the worker's ball:
accent and pulsing while working (still under reduced motion), yellow when a
worker waits for the person, a hollow ring when the state is unknown. The
waited-on ring is drawn round the ball inside the glyph's own box, so the mark
is the same width in every state. The worker slot keeps 6 px from the row's
rounded edge, and the times in the rail line up again: the old ring made the
slot wider in one row. Hover and focus still hide the whole mark beneath the
row's actions. The S11 Explain card describes the ball, the ring and how
several workers are shown, in both languages.

Evidence (`evidence/`, device scale factor 2, synthetic lab): `before-*` and
`after-*` for 1440 and 390, light and dark; `after-card-390` is the S11 card
opened by tapping the mark. `worker-badges.spec.ts` now asserts that the rail
ball pulses (and stays still under reduced motion) and that the mark ends at
least 4 px inside the row at 1440 and 390. `rail-hover-marks.spec.ts` (touch)
asserts that tapping the mark in Explain mode opens S11 with the legend.
`OH_RAIL_BALL_CAPTURE=<prefix>` regenerates the screenshots.

## Decisions for later review

- **Several workers in different states.** The rail row only knows whether
  some worker works, some waits for the person and whether the agent waits on
  one, and it shows one ball. *Waits for you* (yellow) now outranks *working*,
  where before working won. The conversation's own ball already says work
  continues, and a worker waiting for the person is what needs them. The ring
  appears when the agent waits on any of them. Alternatives: keep working
  first (a worker waiting for you then shows only in the row's description),
  or one ball per state (wider again and back towards the row edge).
- **Quiet branch, coloured ball.** The branch stroke is `--ah-muted` (before:
  accent) so that the ball alone carries the state colour and a yellow or
  hollow ball reads at a glance. Alternative: an accent branch as before,
  which competes with the accent working ball.
- **Own glyph, not the icon set's `branch`.** The Workers chip keeps
  `Icon name="branch"`. The rail glyph draws its own trunk and branch around
  a larger end node, because the icon set's 2-unit end circle is too small to
  carry a state colour at rail size.
- **S11 is still not reachable by pointer.** With a pointer, hovering the row
  reveals its actions over the mark (`rail-worker-mark-under-hover-actions`),
  so pointing at the mark in Explain mode explains the action button. On touch
  it works and is tested. Left as it is; changing it means revisiting the
  hover-hiding decision.
- Reference regeneration also added `app--HelperArchiveFlow.tsx.md`, which was
  missing from main after an earlier landing (drift, not this change).
