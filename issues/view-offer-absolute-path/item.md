---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: view-offer-path
lane_seq: 1
closed: 2026-11-07
---

# Agent's first view offer fails on an absolute --source path

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, 7.11.2026):

Agentin ensimmäinen näkymätarjous epäonnistuu absoluuttisella polulla (agentti 7.11., pilot.612): sekä testi-repon agentti (07:58:25Z) että tämän keskustelun agentti antoivat `--source`-polun absoluuttisena (esim. `/tmp/…`) ja saivat `invalid_arguments: --source requires a workspace-relative file or directory path, not an absolute path`; tarjous onnistui vasta toisella yrityksellä (keskustelussa *1 epäonnistui*). Ohje ja `--help` eivät sano, että polun pitää olla työtilan sisällä, eikä esimerkki näytä tiedoston paikkaa. Joko hyväksy absoluuttinen polku työtilan sisältä ja kopioi muualta, tai sano rajoitus ohjeessa (`open-habitat skill print agent`) ja `view offer --help`:ssä (`agent-view-offer-title`).

## Acceptance Criteria

- [x] havainto korjattu; testi rajapinnassa
