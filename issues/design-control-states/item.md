---
created: 2026-10-03
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: high
related: ['@consistent-control-feedback', '@refine-agent-status']
lane: control-state-design
collision: [design-system/]
blocked_by: ['@unify-ui-primitives']
---

# Design the interaction states of every primitive

## Why

The v2 handoff specifies focus and the disabled state but no hover, pressed
or selected state, and the draft HTML's only hover rule is `a:hover { color }`.
Implementers invented states ad hoc, which is one root cause in
[the investigation](../consistent-control-feedback/investigation.md). Jari
decided on 3 October 2026 that the designer designs the states of every
primitive once, and that every future design package carries a standing rule
that anything a person can point at, press or reach by keyboard is designed in
all of its states.

## Work

Prepare a design package with the repository's `design-package` skill after
@unify-ui-primitives has landed, so the designer sees the real primitives:

- Inventory: each primitive (`Button` variants and sizes, `IconButton`,
  `LinkRow` variants, `MenuItem`, `Toggle`, `Field`, `StatusMark`) with its
  states rest, hover, pressed, keyboard focus, selected/current, disabled with
  reason, pending; light and dark; current lab captures of each as the
  comparison point; the provisional colour values marked as such.
- The standing rule for all future rounds, written once into the package
  request template so it is present in every later package without being
  remembered.
- Agent states (@refine-agent-status) go to the designer in this same package
  as the `StatusMark` chapter: which user-facing states exist, their meaning,
  and one visual language across sidebar, header and conversation.

Jari runs the design round. The returned drafts and handoff go to
`design-system/drafts/` as the next version and are applied in
@apply-control-state-design. @design-pi-event-blocks waits for this round so
that block designs use the agreed primitives instead of inventing controls.

## Acceptance Criteria

- [ ] Package delivered with the inventory, captures, provisional values and the standing states rule; the brief kept in this issue folder.
- [ ] Designer's answer covers every primitive and state in both themes, and the agent-state chapter.
