---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-10-28/code-block-language-label-flickers
lane: conversation-select
preparation: ready
closed: 2026-10-28
---

# Code block language label flickers when the mouse moves over the copy button

## Description

Jari 2026-10-28 (Birch, pilot.13): koodiblokin yläkulman copy-painikkeen kohdalla, kun hiirtä liikuttelee, blokin kielimerkintä (esim. 'shell') välkkyy näkymättömiin ja takaisin. Hover-tila todennäköisesti vaihtaa merkinnän ja painikkeen paikkaa tai näkyvyyttä edestakaisin. Merkintä ja painike eivät saa välkkyä.

## Acceptance Criteria

- [x] Kielimerkintä ja copy-painike pysyvät vakaina hiiren liikkuessa; työpöytä ja kosketus
