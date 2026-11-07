---
created: 2026-11-06
updated: 2026-11-07
type: feature
reporter: jari
status: done
priority: normal
closed: 2026-11-06
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/composer-lists-in-field
lane: composer-lists
lane_seq: 1
---

# Composer lists inside the field: folder tree, changed as state, preview, list search (experimental)

## Description

Jari 6.11.2026: toteutus prototyypistä `proto-composer-popover-placement`
(kierrokset 1–4, result.md; viimeisimmät
`design-system/prototypes/rounds/2026-11-06-kentan-listat-3/` ja
`2026-11-06-kentan-listat-4/`). Kirjoituskentän listat (Tiedosto,
Komennot, kirjoitettu `@`) avautuvat kentän sisään kaikella nykyisellä
toiminnallisuudella, ilman yksinappisia välidialogeja (Jari 3.11.):
selaus kansiopuuna (Puu), *Muutetut* tiedoston tilana listassa eikä omana
välilehtenä, esikatselu listan vieressä työpöydällä, ja haku **Lista**:
nimi ensin ja kansio perässä, muutetut ensin ja sitten matalimmat, → näyttää
tiedoston kansiossaan. Kokeellinen ominaisuus, ellei Jari toisin sano.
Kierrosten host-tiedot kertovat, mitä daemonilta tarvitaan (kansion suorat
lapset ja muutosmäärät myös isossa työtilassa, esikatseluluku).

## Acceptance Criteria

- [x] listat kentän sisällä prototyypin mukaan kokeellisena ominaisuutena; testit selaukselle, haulle ja usean valinnalle; puhelin
