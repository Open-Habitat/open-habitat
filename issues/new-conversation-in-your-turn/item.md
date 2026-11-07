---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: rail-rework
lane_seq: 1
closed: 2026-11-07
---

# A new conversation appears in Hiljaiset instead of Sinun vuorosi

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Uusi keskustelu ilmestyy Hiljaisiin eikä Sinun vuorosi -osioon (Jari 7.11., pilot.612): +-painikkeella avattu, vielä tyhjä tai juuri aloitettu keskustelu näkyy sivupalkissa Hiljaiset-listassa. Jarin mielestä sen paikka on Sinun vuorosi, koska se odottaa häntä (`rail-quiet-all-flat`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa
