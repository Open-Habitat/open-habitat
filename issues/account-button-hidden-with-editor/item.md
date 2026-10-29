---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: settings-polish
lane_seq: 2
preparation: ready
---

# Account button disappears while the editor is open

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Asetuksia ei voi avata, kun editori on auki (Jari 29.10., pilot.511, työpöytä): kun keskustelussa on editori auki, tilivalikon henkilökuvapainike katoaa näkyvistä, joten Asetuksia ei pääse avaamaan tilivalikosta. Kun editori on kiinni, Asetukset avautuvat ja sulkeutuvat oikein (X ja Esc palauttavat keskustelun luonnoksineen). Tilivalikko on `web/src/components/Account.tsx`. Selvitettävä, piilottaako editorin asettelu sivupalkin tai yläpalkin kohdan, jossa painike on (`settings-close-returns`).
