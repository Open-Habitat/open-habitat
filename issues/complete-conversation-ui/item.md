---
created: 2026-09-21
updated: 2026-10-18
type: task
status: obsolete
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 60
closed: 2026-10-05
collision: [docs/, AGENTS.md, design-system/]
preparation: reviewing
closed_by: jari
---

# Complete the accepted conversation and navigation experience

## Outcome

Jari retired this umbrella task after the joint reading on 5 October 2026.
The first conversation UI already exists. Its remaining design problems belong
to newer, focused issues rather than another attempt to complete the whole UI
under this old implementation brief. Closure as obsolete is not acceptance of
the current appearance or a claim that every original requirement is complete.

## Work and successors

[Implementation results](result.md) retain the evidence for the initial
conversation, tool groups and safe content fallback, queue/steering controls,
per-agent drafts, focus and reading-position preservation. @build-agent-control
delivered the native control path; @carry-typed-pi-events subsequently carried
structured history and live content into the browser.

The remaining work has these owners:

- @design-pi-event-blocks owns finished conversation-block designs and the
  follow-up rendering work, including tools, diffs and unknown content.
- @align-navigation-design owns navigation and return-view composition.
- @design-control-states and @apply-control-state-design own shared control
  states and agent-state presentation.
- @recover-sends-after-disconnection owns send failure and connection recovery.
- @generate-conversation-titles carries the unfinished model-generated titles
  and title-adjacent regeneration requested by Jari in this reading. It was
  filed separately in intake, without a lane.

Verification and visual comparison accompany the relevant feature changes.
The old broad state matrix, demonstration and final-review requirements are
not a separate completion gate. Existing results and screenshots remain
historical evidence with their original limits; closing this task does not
turn synthetic or unreviewed evidence into live or human acceptance.
