---
created: 2026-10-26
updated: 2026-10-27
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-10-26/agent-file-offer
lane: file-offer
lane_seq: 3
blocked_by: ['@proto-agent-file-offer', '@proto-file-offer-types', '@proto-file-offer-many']
preparation: ready
closed: 2026-10-27
---

# Agent hands a produced file to the person: implementation

## Description

Jari 2026-10-26, keskustelusta toisen kehittäjän kanssa (ulkopuolinen käyttäjä, joka arvioi Habitatia omaan ja asiakkaidensa käyttöön). Toteutetaan proto-agent-file-offer-kierroksella Jarin valitsema tapa, jolla agentti antaa tuottamansa tiedoston ihmiselle ladattavaksi keskustelussa. Tarkempi sisältö kirjataan, kun prototyyppi on valittu.


## Specification (Jari 2026-10-27)

The accepted prototypes are the specification: Kortti (issues/proto-agent-file-offer, direction 1), content types Tunniste (issues/proto-file-offer-types, direction 1: type mark, details and a button saying what you get; content opens in the preview dialog), many files Hylly (issues/proto-file-offer-many, direction 3: compact card plus a conversation file panel). Read each result.md for the host facts.

## Acceptance Criteria

- [x] `open-habitat agent file offer` (or the chosen command shape) offers one or more workspace files to the person in the current conversation; the card, the preview dialog and the file panel follow the prototypes; download works on desktop and phone; only the signed-in user's own files; tests at the contract and in the browser
