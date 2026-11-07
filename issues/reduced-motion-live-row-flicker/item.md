---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: reduced-motion
lane_seq: 1
---

# Live work row still flickers with reduced motion

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, 7.11.2026):

Vähennetty liike: työrivi vilkkuu vielä (Jari 7.11., pilot.613, macOS *Reduce motion* päällä): ajon lopun 12 px siirtymä yhdellä askeleella toimii ja tuntuu hyvältä. Ajon aikana live-rivi (*Agentti työskentelee · Ajaa bashia* jne.) vaihtuu ja vilkkuu jokaisen työkalun kohdalla; vähennetyllä liikkeellä sen pitäisi olla staattisempi, esim. vaihtaa tekstiä ilman animaatiota tai harvemmin (`gate-r56-deterministic-reds`, `live-row-gap-above-composer`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa
