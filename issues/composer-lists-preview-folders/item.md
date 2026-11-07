---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: composer-lists-fixes
lane_seq: 1
closed: 2026-11-07
---

# In-field lists: preview keeps its scroll, folders cannot be opened

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Kentän sisäisen listan esikatselu jää vieritetyksi (Jari 7.11., pilot.612, Listat kirjoituskentän sisällä, taitolista): kun yhden taidon esikatselua oikealla vierittää alas ja siirtyy seuraavaan taitoon, uuden taidon esikatselu näkyy samassa vierityskohdassa eikä alusta. Esikatselun pitää alkaa ylhäältä jokaisella uudella valinnalla (`composer-lists-in-field`).

Kentän sisäisen tiedostopuun kansioita ei saa auki (Jari 7.11., pilot.612): jokainen napautus kansiorivillä merkitsee koko kansion valituksi. Jarin odotus: ruutu merkitsee kansion, ja rivin avausnuoli (caret) avaa ja sulkee sen. Nyt kansioon ei pääse sisälle muuten kuin haulla, joka toimi hyvin (`composer-lists-in-field`).

## Acceptance Criteria

- [x] havainto korjattu; testi rajapinnassa
