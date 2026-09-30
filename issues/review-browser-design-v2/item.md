---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: open
priority: high
related: ['@assemble-browser-redesign-handoff']
lane: design-review
collision: [design-system/, docs/, web/src/components/Conversation.tsx]
---

# Assess the UI foundation against browser design v2

## Goal

Use the supplied browser design as a concrete benchmark for our UI codebase.
Determine how far we are from implementing it faithfully, how well the current
UI works, and whether the component library and shared layout and styling
structures provide a sound foundation for getting there.

The desired result is precise placement, sizing and alignment, with visual
appearance that is easy to refine consistently across views. Composing and
adjusting components should naturally produce screens that follow this design.
The review should explain whether that is achievable with local refinements
or whether shared foundations need work, and recommend a path to the result.

## Input

Jari provided the design extracted in `design/`.

## Assessment

Compare the design with current production components and rendered screens,
including their interaction states. Look at how layouts, spacing, typography,
tokens and component variants combine, where those decisions live, and how
predictably a shared change carries through the application. Existing stories,
browser tests and visual evidence help establish what works and what remains
uncertain.

Ground the assessment in representative screens and concrete code. Explain
which parts already fit, which need component-level refinement, and which
expose recurring problems in the shared structure or styling approach. A
component map is useful where it explains those gaps. The central question is
whether the foundation can reliably produce the intended interface and remain
easy to adjust as the design evolves.

Recommend the shared improvements that matter and an ordered implementation
path: foundation work, component refinements and screen composition, with the
dependencies and existing issue ownership made clear. Explain how visual
comparison will establish precise fidelity and consistent behavior across the
relevant screen sizes and states. Propose abstractions where repeated needs
justify them; conclusions should follow from the current code and observed
gaps.

The [first reading](first-read.md) supplies design context and known behavioral
differences. It has not assessed the quality or readiness of the UI foundation.
Functional decisions from @rethink-project-docs inform the target: uncertain
native writes, identity boundaries and preserved user input still need honest
UI behavior. Bring material product or architecture choices to Jari with a
recommendation; routine layout and styling choices belong to the implementer.

## Acceptance Criteria

- [ ] A source- and screen-grounded assessment explains how well the current UI
  works and how far its components and shared structures are from the design.
- [ ] Concrete examples distinguish local refinements from shared improvements
  needed for precise layout and easy, consistent visual tuning.
- [ ] A recommended implementation path identifies dependencies, existing work
  and how the resulting screens will be compared with the design.
