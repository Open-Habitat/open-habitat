---
created: 2026-10-26
updated: 2026-10-26
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-26/jump-latest-chip
lane: unlaned
collision: [web/src/components/Conversation.tsx]
preparation: ready
---

# Viimeisimpään-siru: teksti ylälaidassa, nuoli rivin alla, liian ahdas

## Description

Jari 2026-10-26 testatessa (kuvakaappaus: attachments/jump-latest.png): keskustelun kelluva Viimeisimpään-siru (data-testid jump-latest, web/src/components/Conversation.tsx, Button presentation=floating, ConversationFloatingAction) näyttää hassulta. Teksti on sirun ylälaidassa ja alanuoli on sen alla omalla rivillään, joten sirussa on liian vähän tilaa. Sirulla on kolme muotoa, ja kaikkien pitää näyttää siistiltä työpöydällä ja puhelimessa, vaaleana ja tummana: 'Viimeisimpään' (agentti ei työskentele), '● Uusi vastaus (n)' ja '● Agentti työskentelee 3 min (n)' (agentti työskentelee).

## Acceptance Criteria

- [ ] Teksti ja nuoli ovat samalla rivillä ja pystysuunnassa keskellä, ja sirussa on riittävästi sisätilaa kaikissa kolmessa muodossa
- [ ] Selaintesti tai visuaalinen tarkistus kattaa kaikki kolme muotoa; kuvat skaalalla 2
