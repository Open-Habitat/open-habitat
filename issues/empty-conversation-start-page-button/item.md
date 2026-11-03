---
created: 2026-11-03
updated: 2026-11-03
type: feature
reporter: jari
status: open
priority: normal
lane: start-page-button
lane_seq: 2
preparation: ready
---

# Luo aloitussivu button in the empty new conversation

## Description

Jari 3.11. chose direction 1 (*Rivi ja painike*) of `proto-empty-conversation-start-page` (round `design-system/prototypes/rounds/2026-11-02-aloitussivun-painike/`). On press the agent starts at once with a template prompt and continues in this conversation. How the sent request reads in the history follows `proto-start-page-request-presentation`; build after Jari has answered that round.

## Acceptance Criteria

- [ ] An empty new conversation in a workspace without a start page shows the row and button as in direction 1; pressing it starts the agent at once; no command or file name on screen.
