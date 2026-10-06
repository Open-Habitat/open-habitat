---
created: 2026-10-03
updated: 2026-10-06
type: task
reporter: jari
status: in-progress
priority: normal
related: ['@refine-agent-status']
lane: ui-foundation
lane_seq: 30
collision: [web/src/components/, design-system/]
blocked_by: ['@design-control-states', '@compare-draft-fidelity']
preparation: pending
---

# Apply the designed control states and agent presentation

## Why

Phase c of the path agreed with Jari on 3 October 2026: the designer's state
matrix from @design-control-states replaces the provisional values that
@unify-ui-primitives shipped.

## Scope

- Token values for hover, pressed, selected and focus per variant and theme
  from the handoff; any new colour tokens added to `design-system/tokens/`.
- The Storybook state matrix and the lab state captures compared with the
  designer's frames side by side, pairs kept in this issue folder.
- Agent-state presentation implemented as one `agentPresentation` function
  from host facts (per @refine-agent-status's design), used by sidebar, header
  and return view; Finnish strings never feed back into state logic.

## Acceptance Criteria

- [x] Designed states are represented by production controls in both themes; the paired captures and unmeasured deviations are recorded in result.md. Visual acceptance remains Jari's after deployment.
- [x] The final committed runtime tree passes the TESTING.md clean gate (result.md records its scope).
