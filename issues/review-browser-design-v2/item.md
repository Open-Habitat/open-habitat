---
created: 2026-09-30
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: high
related: ['@assemble-browser-redesign-handoff']
lane: design-review
collision: [design-system/, docs/, web/src/components/Conversation.tsx]
---

# Assess the UI foundation against browser design

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

The [design](../../design-system/design.md) and
[reference screens](../../design-system/drafts/) are the visual target.

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
differences. The [assessment](assessment.md) identifies shared sizing,
layout and component styling problems, with code examples and a component map.
It recommends proving shared improvements in a complete view before extending
them across the UI. Implementation mechanisms, work division and visual test
methods remain proposals; the target is faithful design and predictable shared
adjustments. Phone layouts and the design sizing are agreed; the repository filter is optional (see Decisions). The assessment uses source inspection and earlier synthetic screenshots,
not a new demonstration of the whole UI's behavior.
Functional decisions from @rethink-project-docs inform the target: uncertain
native writes, identity boundaries and preserved user input still need honest
UI behavior. Bring material product or architecture choices to Jari with a
recommendation; routine layout and styling choices belong to the implementer.

## Acceptance Criteria

- [x] A source- and screen-grounded assessment explains how well the current UI
  works and how far its components and shared structures are from the design.
- [x] Concrete examples distinguish local refinements from shared improvements
  needed for precise layout and easy, consistent visual tuning.
- [x] A recommended implementation path identifies dependencies, existing work
  and how the resulting screens will be compared with the design.

## Comments

### 2026-09-30T15:30:37Z · @agent

Assessment written: assessment.md (rev 82a5c4e). Foundation functionally sound, styling layer thin; recommends one foundation slice (tokens re-cut to the design, layout templates, button/status/icon primitives, one styling mechanism) before component refinement and screen composition. Awaiting Jari on mobile scope, default repo filter, and v2 sizing as token source.

### 2026-10-01T17:53:50Z · @jari

Jari 2026-10-01 (pilot.15): viivaleveydet ja paddingit ovat käyttöliittymässä ihan muuta kuin design-malleissa, ja fonttikoot pitää tarkistaa samalla. Konkreettinen esimerkki @composer-footer-layout.

## Decisions

### 2026-09-30T16:59:44Z · @jari

2026-09-30: Jari confirmed that the repository chooser behaviour agreed with the designer for browser design v2 is: all repositories visible by default, time filtering as a user choice. The delivered handoff and Onboarding v2 HTML start with a monthly filter enabled; implementation follows this agreement, not the handoff default.

### 2026-09-30T17:23:44Z · @night-ui

Provisional for the night of 2026-09-30, per issues/night-2026-09-30/plan.md (Jari may overturn in the morning; any effect is then scoped by a new issue): (1) phone fitting is in the implementation scope; (2) the v2 handoff sizing table is the source of the shared values, and the sentence in design-system/production-v1.md treating draft sizes as references is updated. Implementation slices: recut-ui-foundation, fit-conversation-v2, fit-sidebar-v2, fit-onboarding-v2, fit-account-and-history-v2, compare-v2-pairs (lane design-v2).

### 2026-10-01T02:18:48Z · @jari

2026-10-01 (Jari): the night's provisional choices stand (phone in scope, v2 sizing as token source); anything wrong will show in the UI and becomes an issue. Jari judged the night's lab rendering far from the design (compare-v2-pairs): visual fidelity to the draft is the bar, not the slices' self-reported completion.
