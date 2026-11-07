---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: rail-rework
lane_seq: 2
---

# Rail row button tooltip covers the row below

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Sivupalkin rivin pikkupainikkeiden vihje peittää alemman rivin (Jari 7.11., pilot.612, työpöytä): kun hiiri on keskustelurivin arkistointipainikkeen (ja muiden rivin pikkupainikkeiden) päällä, vihje avautuu alla olevan keskustelurivin painikkeen päälle ja on tiellä siirryttäessä seuraavaan riviin. Rivin pikkupainikkeissa vihje ei toimi tässä muodossa: se pitää sijoittaa niin, ettei se peitä viereisiä rivejä, tai jättää pois (`icon-tooltips-slow`, `sidebar-archive-on-hover`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa
