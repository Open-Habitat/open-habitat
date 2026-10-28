---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: open
priority: normal
lane: file-shelf
lane_seq: 1
preparation: ready
provenance: chat
source_ref: kokeiltavaa:2026-10-28/files-toggle-hover-too-narrow
---

# Top bar files button hover background too narrow for a two-digit count

Yläpalkin tiedostopainikkeen hover-tausta on liian kapea kaksinumeroiselle luvulle (Jari 27.10., pilot.442): kun luku on `11`, jälkimmäinen 1 valuu taustan oikean reunan yli. Painike on `ah-files-toggle` (`web/src/app/ViewHost.tsx`, `ControlButton size="row" variant="quiet"`). Luku on tiedostojen eikä tarjousten määrä (5 tarjousta, 11 tiedostoa), mikä on oikein. Tiedostopaneeli ja haku toimivat: tarjoukset uusin ensin, kansion kuvat alikansioittain, haku löytää kansion sisältä (`agent-file-offer`).
