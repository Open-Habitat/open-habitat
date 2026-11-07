---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: archive-conflict
lane_seq: 2
closed: 2026-11-07
---

# Pi end during fast archives logged as unasked

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Pi päättyi pyytämättä samassa jaksossa (agentti 7.11., pilot.612): journalissa `conversation_pi_ended reason=unasked` klo 07:45:36.740Z ja heti perään `close`. Ajankohta on Jarin nopeiden arkistointien ja uusien keskustelujen keskellä; tarkista, oliko kyse arkistoinnin pysäytyksestä, joka kirjautuu pyytämättömäksi päättymiseksi (`conversation-pi-ends-mid-reply`).

## Acceptance Criteria

- [x] havainto korjattu; testi rajapinnassa
