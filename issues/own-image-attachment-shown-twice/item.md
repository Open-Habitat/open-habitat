---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-10-26/own-image-attachment-shown-twice
lane: composer
collision: [web/src/app/HistoryView.tsx]
preparation: ready
closed: 2026-10-27
---

# Own message's image attachment shows twice, with an unbounded 'Lataa lohkon sisältö' button

## Description

Testihavainto, kirjattu KOKEILTAVAA.md:stä 2026-10-27:

Oman viestin kuvaliite näkyy kahdesti (0.0.0-pilot.421, 26.10.): pikkukuvan lisäksi kuplassa on teksti *Kuva · image/png* ja painike *Lataa lohkon sisältö*. Painike lataa kuvan täysikokoisena ilman kokorajaa ja sotkee koko näkymän. Oman viestin kuvalohko pitäisi jättää näyttämättä, koska pikkukuvan voi avata esikatseluun. Agentin tai työkalun kuvalle painike voi jäädä, mutta kuvalle tarvitaan kokoraja. Koodissa `web/src/app/HistoryView.tsx`, `ReadableBlock`, `case "image"` (Jari).
