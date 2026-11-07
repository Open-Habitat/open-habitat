---
created: 2026-11-07
updated: 2026-11-07
type: feature
reporter: jari
status: done
priority: normal
preparation: ready
lane: rail-rework
lane_seq: 3
closed: 2026-11-07
---

# Nosta and Ei nyt only in the rail, on every row; status mark shows only agent state

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Nosta ja Ei nyt on liian läsnä, palautetaan toteutukseen (Jari 7.11., pilot.612, työpöytä): painikkeet näkyvät ja toimivat, mutta Jarin tuomio on, että käyttöliittymä siistitään ennen jatkoa:
  1. Kirjoituskentästä pois sekä *Ei nyt* / *Nosta* että oranssi *Sinun vuorossasi ✕*. Kentässä ei tarvita näitä.
  2. Ohjaus vain sivupalkkiin: hiiren alla jokaisen keskustelurivin painikkeisiin (kuten arkistointi) ylös- ja alas-painike, myös *Hiljaiset*-listassa. Nyt painike näkyy vain osalla riveistä: Sinun vuorosi -osion toisella rivillä sitä ei tullut hiiren alla.
  3. Rivin tilamerkin paikalle ei ylöspäin osoittavaa nuolta nostetulle keskustelulle: tilamerkki kuvaa vain agentin tilaa (pallo / rengas kuten ennen).
  (`raise-to-your-turn-button`)

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa
