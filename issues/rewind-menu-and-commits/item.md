---
created: 2026-11-07
updated: 2026-11-07
type: feature
reporter: jari
status: open
priority: normal
preparation: ready
lane: rewind-fixes
lane_seq: 1
---

# Palaa tähän: menu position, oversized Viimeisimpään, and committed changes

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Palaa tähän, kolme asiaa ennen jatkoa (Jari 7.11., pilot.612, työpöytä): (1) Oman viestin ⋯-painike ei ole viestikortin oikeassa yläkulmassa, vaan vasemmalla olevien painikkeiden jatkona kortin vasemmassa yläosassa. (2) Kun valikko avautuu, vasemmalle ilmestyy suhteettoman iso *Viimeisimpään*-painike; Jarin sanoin naurettavan iso, sen koko pitää korjata. (3) Tiedostomuutokset näkyvät hyvin, mutta toteutus ei ota kantaa committeihin: agentit commitoivat usein jokaisen muutoksen, joten pitää päättää ja näyttää, mitä palautus tekee jo commitoiduille muutoksille (palautetaanko työpuu commitista, tehdäänkö palauttava commit, vai kerrotaanko, ettei commitoitua palauteta). Jari palauttaa ominaisuuden toteutukseen näillä kommenteilla (`rewind-conversation`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa
