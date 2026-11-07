---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
lane: limit-reset-proto
lane_seq: 2
blocked_by: ['@proto-limit-reset-placement']
collision: [web/src/components/ServerSection.tsx]
preparation: ready
---

# Person row's own-limit reset is an icon beside the stepper

## Description

Implementation of Jari's decision on `proto-limit-reset-placement` (round 1,
direction **A Säädin**, 7.11.2026). Today the shared `LimitReset` in
`web/src/components/ServerSection.tsx` puts *Oletukseen* as its own button on
a line under the usage bar, so rows with an own limit are much taller (130 vs
92 px in the narrow settings pane). Jari called this a defect.

The prototype is the specification:
`design-system/prototypes/rounds/2026-11-07-oletukseen-paikka/` (direction A)
and `issues/proto-limit-reset-placement/evidence/r1-a-saadin-*`. A small
restore-icon button sits right of the − n + stepper; rows without an own
limit reserve the same empty space so steppers stay aligned; every row is the
same height in Levytila and Keskustelut at every width. The button has no
text; its tooltip and accessible name say what it restores to, e.g.
*Palauta oletukseen (20 GiB)* / *Reset to default (20 GiB)*.

Jari 7.11.2026: "täällä suositaan aina symboleita". Record that preference in
`design-system/design.md` next to the existing icon/text rule.

Defect fix, not an experimental feature.

## Acceptance Criteria

- [ ] Reset is an icon button beside the stepper in Levytila and Keskustelut;
      rows equal height with and without own limit (440/720 pane, 390,
      light and dark).
- [ ] Tooltip and accessible name name the default value, both languages.
- [ ] Touched specs/stories green; screenshots at 2x; `KOKEILTAVAA.md` line.
