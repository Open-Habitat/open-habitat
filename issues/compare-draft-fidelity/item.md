---
created: 2026-10-03
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: normal
related: ['@design-control-states']
lane: design-tooling
lane_seq: 20
collision: [web/lab/]
blocked_by: ['@inventory-ui-states']
---

# Measure implementation fidelity against the drafts

## Purpose

Fidelity to the designer's drafts is judged by eye after the fact, which is why
line widths, spacing and missing controls keep slipping through. The
[design round](../../design-system/process.md) agreed with Jari on 3 October
2026 makes fidelity a measurement: the draft is HTML, so its computed styles
and its controls can be read with the same tooling as the lab's.

## Work

- A landmark map per view and state between the draft (`design-system/drafts/`)
  and the production view (role, name or stable test id), kept with the state
  inventory from @inventory-ui-states.
- A comparison that opens the draft state and the lab state, reads the computed
  styles of mapped landmarks (borders, padding, font size and weight, widths,
  radii, colours as tokens) and reports differences per landmark.
- An element comparison that lists interactive elements (role and accessible
  name) in the draft state and the lab state and reports missing and extra
  controls.
- Recorded deviations from `design-system/design.md` are excluded from the
  report by reference; everything else is a difference. The report is written
  into the round's issue next to the side-by-side pairs.
- The existing `lab-foundation.spec.ts` metric assertions become one consumer
  of the same mapping rather than a separate hand-written list.

## Acceptance Criteria

- [ ] For the views that have drafts, the comparison reports style and element differences per landmark and state, in both themes and widths.
- [ ] A known deviation recorded in `design.md` is excluded; an unrecorded difference is reported.
- [ ] A design round's issue can include the report as its fidelity evidence; the process page links it.
