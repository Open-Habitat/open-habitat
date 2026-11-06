---
created: 2026-11-06
updated: 2026-11-06
type: bug
reporter: jari
status: open
priority: normal
preparation: pending
provenance: chat
source_ref: chat:2026-11-06/setup-console-path-too-small
lane: setup-wizard-fixes
lane_seq: 1
blocked_by: ['@proto-m365-setup-flow']
---

# Integration setup: console path lines are too small to read

## Description

Jari 6.11.2026 (kuvakaappaus Microsoft 365 -ohjatusta asetuksesta, vaihe
2/4 *Julkinen asiakas*): "navigaatio-ohjeet eli Authentication -> Settings
jne. on tosi pienellä." Polkurivi (`Path`, `.si-path` in
`web/src/components/ServerIntegrations.css`) on meta-koossa ja himmeällä
värillä, vaikka se on vaiheen tärkein ohje: mihin konsolissa mennään.
Edessä oleva nuoli näyttää lisäksi avattavalta, vaikka rivi ei avaudu.

Korjaus kaikkiin ohjattuihin asetuksiin (Google, Microsoft, Dropbox):
polku leipätekstin kokoon ja täyteen musteväriin, nuoli ei saa näyttää
avausnapilta. Korjaus nykyiseen toimintaan, ei prototyyppiä.

## Acceptance Criteria

- [ ] polkurivit luettavassa koossa kaikissa ohjatuissa asetuksissa, 1440 ja 390, vaalea ja tumma; tarkistettu kuvakaappauksin
