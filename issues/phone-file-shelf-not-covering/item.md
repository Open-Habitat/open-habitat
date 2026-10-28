---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: fixed
priority: normal
lane: file-shelf
lane_seq: 2
preparation: ready
provenance: chat
source_ref: kokeiltavaa:2026-10-28/phone-file-shelf-not-covering
closed: 2026-10-28
---

# Phone: file shelf does not cover the conversation

Tiedostopaneeli ei peitä keskustelua puhelimella (Jari 27.10., pilot.444): yläpalkin tiedostopainike avaa paneelin, mutta keskustelu jää näkyviin sen rinnalle, vaikka paneelin pitäisi peittää keskustelu kuten HTML-näkymän paneeli puhelimessa. Paneeli (`FileShelf`) piirretään `ViewHost`issa (`web/src/app/ViewHost.tsx`), joten vertaa näkymäpaneelin kapean ruudun sääntöihin. Muuten puhelimella kokeiltu: kansion *Lataa kaikki (.zip)* toimi. PDF:n lataus ja Chrome jätettiin kokeilematta (`agent-file-offer`).
