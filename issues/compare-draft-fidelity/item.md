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

Line widths, spacing and missing controls slip through visual review. The
[design round](../../design-system/process.md) needs a repeatable comparison
between the HTML drafts and production views, so these differences are visible
without relying on someone noticing them in screenshots.

## Comparison

Use the state inventory from @inventory-ui-states to connect corresponding
draft and lab states. Keep their landmark mapping with the inventory, using
roles, names or stable identifiers to identify equivalent elements. Compare
like states with matching content, theme and viewport, so fixture differences
do not masquerade as design differences.

Read the landmarks' computed styles and rendered dimensions in the browser:
borders, spacing, typography, widths, radii and colours are the initial concerns.
Computed colours are resolved values; relate them to shared tokens where that
helps explain a difference. Compare interactive elements by role and accessible
name as well, so missing or extra controls appear in the report.

Report differences by view, state and landmark. Jari's agreed deviations in
`design-system/design.md` are identified by reference and distinguished from
unresolved differences. A deviation applies to the named difference, not every
future change to that element. A missing counterpart or failed comparison stays
visible as a gap rather than looking like a match.

Keep the report beside the round's paired captures in its issue, identifying
the compared revisions and coverage. The report measures the mapped properties;
the pairs let a person assess the overall appearance. The existing metric
assertions in `web/tests/lab-foundation.spec.ts` should use the same mapping
where they check the same properties, avoiding a second account of the design.

## Acceptance Criteria

- [ ] For corresponding draft and lab states, the comparison reports style, dimension and control differences in both themes and at desktop and phone widths; missing counterparts and failed comparisons are visible.
- [ ] A recorded deviation is identified separately by its design reference, while an unrecorded difference remains unresolved.
- [ ] A round's issue can carry the report and paired captures with the compared revisions and coverage; the process page points to this evidence.
