---
created: 2026-10-28
updated: 2026-10-28
type: task
reporter: jari
status: done
priority: normal
lane: proto-folder-offer
lane_seq: 1
preparation: pending
provenance: chat
source_ref: kokeiltavaa:2026-10-28/proto-folder-offer-file-rows
closed: 2026-10-28
---

# Prototype: folder offer file list with per-row actions instead of a large preview

Kansiotarjouksen *Näytä tiedostot* -paneeli on prototyypattava (Jari 27.10., pilot.442, tuotepäätös): yläreunan isoa esikatselua valitusta tiedostosta ei haluta, koska rivien alussa olevat pikkukuvat riittävät. Jokaisella rivillä pitäisi olla rivin omat painikkeet (esikatselu, lataus), esim. hiiren ollessa rivin päällä. Tämä tehdään ensin prototyyppinä ennen toteutusta. Koodi: `FileShelf` (`web/src/components/FileOffer.tsx`) (`agent-file-offer`).

## Decisions

### 2026-10-28T11:29:01Z · @jari

Jari 2026-10-28: suunta Leijuva, paitsi että klikkaus ei jätä riviä harmaalle taustalle. Toteutus: folder-offer-file-rows.
