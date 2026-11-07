---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: graduate
lane_seq: 1
---

# Next waiting row missing on return to a still-working conversation

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Seuraava odottava ei näy, kun palaa työskentelevään keskusteluun (Jari 7.11., pilot.612): tämän keskustelun agentti työskenteli (60 s vuoro), Jari avasi testikeskustelun, jonka vuoro valmistui, ja palasi tähän agentin vielä työskennellessä. *Sillä aikaa · … odottaa sinua* -riviä ei tullut, vaikka testikeskustelu odotti häntä. Nykyinen sääntö (`next-waiting-on-send`) näyttää rivin vasta omasta lähetyksestä tässä keskustelussa; Jari odottaa sitä myös, kun palaa keskusteluun, jonka agentti yhä työskentelee. Muu toimi: rivi tulee ja katoaa luonnoksen mukaan (`next-waiting-hides-while-typing`).

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa
