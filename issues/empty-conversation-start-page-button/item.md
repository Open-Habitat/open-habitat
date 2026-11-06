---
created: 2026-11-03
updated: 2026-11-06
type: feature
reporter: jari
status: done
priority: normal
lane: start-page-button
lane_seq: 2
preparation: ready
closed: 2026-11-06
---

# Luo aloitussivu button in the empty new conversation

## Description

Jari 3.11. chose direction 1 (*Rivi ja painike*) of `proto-empty-conversation-start-page` (round `design-system/prototypes/rounds/2026-11-02-aloitussivun-painike/`). On press the agent starts at once with a template prompt and continues in this conversation. How the sent request reads in the history follows `proto-start-page-request-presentation`; build after Jari has answered that round.

## Decision (Jari 2026-11-06): miten pyyntö esitetään

Prototyyppi `proto-start-page-request-presentation` on valmis (kierrokset
`design-system/prototypes/rounds/2026-11-03-aloitussivupyynto-2/` ja
`2026-11-06-aloitussivupyynto-3/`, result.md):

- Painike laittaa kenttään mallipyynnön, ja *[anna lisäohjeita]* on
  valittuna (Jari 3.11.). Esitys: **Siru ja lause**. Ei vihjerivejä.
- Koskematon paikkamerkki jätetään pois lähetettäessä (**Aina pois**),
  myös tavoitteiden `[kysymys]`. Historiassa pelkkä siru riittää.

Rakenna nyt.

## Acceptance Criteria

- [x] With the experiment enabled, an empty new conversation in a workspace without a start page shows the row and button as in direction 1; pressing it prepares the request without sending (the later Decision supersedes immediate start); no command or file name on screen.
- [x] Both start-page entry points prepare a chip and sentence with the placeholder selected, with no hint line.
- [x] Send cuts only the exact prepared trailing placeholder, for start pages and goals; a goal with no arguments has a chip-only history entry.
