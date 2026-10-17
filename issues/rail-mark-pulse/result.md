# Result: rail marks pulse only the dot; working is the accent dot

## Cause

- **Agent working:** the row mark came from a regex on the activity label.
  A working turn mapped to the `◌` glyph in the muted colour, which at 14 px
  renders as a grey dotted ring. That is what Jari saw as the "harmaa
  katkoviiva".
- **Spinoff working:** the whole branch mark was a CSS mask on `::after`
  with an opacity blink, so the entire mark blinked.

## Change

- `AgentNavItem` gets the observed `activity` from `agentPresentation`
  (`WorkspaceRailView` passes it). The mark follows that activity; the label
  regex remains only as a fallback for callers without it.
- A working row draws the accent dot from the "Kontrollitilat ja agentin tila"
  draft: 8 px, pulsing with `ah-pulse`. With reduced motion it is a still
  dot with a 2 px accent-line ring, so it stays distinct from Uusi vastaus.
- The working-spinoff mark is an inline SVG in the row's trailing slot. The
  trunk (top dot and stem) stays steady; only the branch and its end dot
  (`.ah-nav-spinoff-branch`) pulse.

## Evidence

- Unit: `Navigation.test.tsx` "rail activity marks":
  - a working turn (`daemon_managed_live`, `runActive`) maps to
    `.ah-nav-working` and its description says "Työskentelee";
  - waiting keeps `○`;
  - the spinoff mark's pulsing group holds only the branch and the end dot.
- Browser: `process-tray.spec.ts` checks that the branch group animates
  `ah-pulse` and the SVG itself does not.
- Lab frame series (400 ms apart, row crops), captured live from the real
  controller and fake Pi with `web/lab/capture-rail-marks.mjs`:
  - `before-working-*-frame*.png`: the grey dotted ring.
  - `after-working-{light,dark}-frame{0,1,2}.png`: the dot's opacity changes.
  - `before-spinoff-*` and `after-spinoff-*`: in the after frames only the
    branch fades.
  - `*-working-rail-*.png`: the whole rail.
- Limits: synthetic lab only. The spinoff comes from the lab's fake
  Taskfleet.

## Decisions for later review

- A row that is both working and has a working spinoff shows both marks
  side by side.
