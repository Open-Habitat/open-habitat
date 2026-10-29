---
created: 2026-10-28
updated: 2026-10-29
type: feature
reporter: jari
status: done
priority: normal
lane: desktop-header
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/conversation-header-shorten
closed: 2026-10-28
---

# Desktop conversation header: one row that shortens in place, lighter chips

Toteuttaa Jarin valinnan 2026-10-28 issuesta proto-conversation-header (speksi: sen prototyyppi, NOTES.md ja result.md, suunta 1 Lyhenee): työpöydän keskustelun otsake on yhdellä rivillä, ja sirut lyhenevät paikallaan kiinteässä järjestyksessä, kun tila loppuu; otsikko saa vähintään prototyypin osuuden. Korvaa desktop-header-title-squeezed-korjauksen kahden rivin otsakkeen. Yhteinen kevyt ulkoasu: lyhyemmät painikkeet ja ikonit, sirut ilman reunoja, Gitin nollalukemat piilossa, toiminnan tila pisteenä ilman pilleriä. Pisteellä tooltip: hover ja näppäimistöfokus näyttävät tilan tekstinä (tila ja kesto), kosketuksella napautus; tila on aina pisteen saavutettavassa nimessä. Puhelimen otsake ennallaan.

## Comments

### 2026-10-28T17:37:22Z · @conductor

Speksiin lisättiin kierros 2 (Jari 28.10.): suunta 1 Taso avattaessa, nimi 'Opus 5.5', Git-siru ilman haaran nimeä; muutokset tähän item.md:hen ovat proto-conversation-header/result.md:n kohdassa Muutokset toteutukseen.
