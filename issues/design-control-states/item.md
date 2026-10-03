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
blocked_by: ['@unify-ui-primitives', '@migrate-bespoke-controls', '@refine-agent-status', '@inventory-ui-states']
---

# Design the interaction states of every primitive

## Purpose

Shared controls should give recognisable feedback wherever they appear. The
[investigation](../consistent-control-feedback/investigation.md) found that
missing interaction-state designs had left implementers inventing appearances
view by view. Jari chose a shared design round on 3 October 2026: the designer
specifies the controls' states and the visual language for agent states together.

## Design work

Prepare the round with the repository's `design-package` skill using the shared
controls established by @unify-ui-primitives and completed by
@migrate-bespoke-controls. Inventory the actual controls, their variants and
relevant states from the implemented catalog, with current captures in both
light and dark themes. Identify provisional design values so the designer can
see what still needs a deliberate choice.

Cover rest, hover, pressed, keyboard focus, selected or current, disabled and
pending where they apply to the control's behavior. The design should make the
control's availability and response understandable, including why an action is
unavailable when that matters to the person. Each control needs its meaningful
states designed; the inventory explains which apply instead of requiring the
same set for every control.

Include the meanings and examples prepared in @refine-agent-status. The designer
uses them to develop one recognisable presentation across the agent list,
sidebar and conversation, including compact uses. Agent activity and attention
are distinct from a control's interaction states; designing them in the same
round makes their appearances work together.

Make state coverage part of the maintained design-package instructions, so
future requests carry the same expectation: anything a person can point at,
press or reach by keyboard has its relevant interaction states designed.
The current skill owns how the brief is written; the rule belongs there rather
than depending on someone remembering it for each round.

## Delivery

Jari conducts the design round. Deliver the package and keep its brief in this
issue. Reconcile the returned handoff with the current design in
`design-system/design.md` and its drafts in `design-system/drafts/`, so there is
one current design to implement. Earlier versions remain in Git history.

@apply-control-state-design implements the resulting control and agent-state
presentation. @design-pi-event-blocks uses these shared controls when designing
the conversation blocks.

## Acceptance Criteria

- [ ] The delivered package shows the actual shared controls, relevant states and provisional values in both themes, together with the agent-state meanings and examples; its brief is kept in this issue.
- [ ] The designer's handoff covers those states and a shared agent-state presentation, and is incorporated into the current design sources.
- [ ] The maintained design-package instructions carry the state-coverage requirement into future rounds.
