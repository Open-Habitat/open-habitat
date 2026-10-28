---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: fixed
priority: normal
lane: file-offers
lane_seq: 1
preparation: ready
provenance: chat
source_ref: kokeiltavaa:2026-10-28/file-offer-preview-height-flicker
closed: 2026-10-28
---

# Offered file preview keeps changing height

Tiedostotarjouksen esikatselu vilkkuu (Jari 27.10., pilot.442): *Näytä taulukko* CSV:lle (`viikon-luvut.csv`) avaa esikatselun, jonka korkeus vaihtelee koko ajan koko sivun korkuisen ja matalamman välillä. Sama näkyy Excelillä (`.xlsx`) ja PDF:llä, joten vika on luultavasti yhteisessä dialogissa eikä yhdessä tyypissä: `OfferedFilePreview` → `AttachmentPreview` (`web/src/components/FileOffer.tsx`, `web/src/components/AttachmentPreview.tsx`). PDF-sivun korkeus tulee `aspectRatio`sta ja `IntersectionObserver`ista (`web/src/components/DocumentPreview.tsx`), mikä voi tuoda oman silmukkansa (`agent-file-offer`).
