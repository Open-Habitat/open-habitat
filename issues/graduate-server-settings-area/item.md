---
created: 2026-11-07
updated: 2026-11-07
type: improvement
reporter: jari
status: open
priority: normal
preparation: ready
lane: graduate
lane_seq: 4
---

# Graduate the server settings area; make its entry row read as a way elsewhere

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Palvelimen asetukset omana alueena pois kokeellisista (Jari 7.11., pilot.612): toimi kokonaan, ja Jari haluaa siitä tavallisen ominaisuuden: poista kokeiluvalinta ja jätä palvelinalue aina päälle. Yksi muutos samalla: omien asetusten listan *Palvelimen ylläpito* -rivi (otsikon *PALVELIMEN YLLÄPITO* alla) näyttää samalta kuin tavalliset osiorivit, vaikka se avaa toisen alueen. Rivin pitää erottua muista, esim. siirtymää kertovalla nuolella tai linkin ulkoasulla, jotta näkee, että se vie muualle (`server-settings-own-area`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa
