---
created: 2026-11-09
updated: 2026-11-09
type: task
reporter: jari
status: open
priority: normal
lane: model-details-proto
lane_seq: 1
preparation: pending
---

# Design and prototype: the top bar's model details look like a picker but are not

## Description

Kaisa via Jari 9.11.2026 (screenshot `evidence/`): the popover from the
conversation top bar's model chip (*Opus 5.5* → *Malli* with Fable 5.1,
Opus 5.5, Sonnet 5.5, Haiku 5.5, the model id, *Ajattelutaso* Low … Max)
looks too much like you could choose the model there. It cannot:
`web/src/components/ConversationModelDetails.tsx` is a presentation of the
native settings ("alternatives are not controls"), but the rows are drawn as
bordered, button-like options with the current one highlighted.

Prototype round per `AGENTS-WORKFLOW.md`, three directions visible on the
default view: (1) make it a real picker for this conversation (what changing
model/thinking mid-conversation does natively, and how the composer's own
model control relates); (2) keep it read-only but make it read as
information (plain text, current values stated, alternatives as a quiet
list or omitted); (3) a short summary with a pointer to where the model is
actually changed. 1440 and 390, light and dark. Record which host facts each
needs.

## Acceptance Criteria

- [ ] Prototype round 1 with view offer, directions and questions for Jari.
