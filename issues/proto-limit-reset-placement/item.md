---
created: 2026-11-07
updated: 2026-11-07
type: task
reporter: jari
status: open
priority: normal
preparation: pending
lane: limit-reset-proto
lane_seq: 1
---

# Prototype: where Oletukseen sits on a person's limit row

## Description

Jari 7.11.2026 (pilot.619, Palvelimen ylläpito › Levytila, tumma, kuvakaappaus):
henkilörivin *Oletukseen*-painike on oudossa kohdassa. Se istuu omana isona
painikkeenaan rivin alla käyttöpalkin jälkeen (*maintainer · oma raja ·
9,54 GiB / 30 GiB*, palkki, sitten *Oletukseen*), vaikka säädin (− 30 +) on
rivin oikeassa reunassa. Rivit ilman omaa rajaa ovat siksi eri korkuisia kuin
rivit, joilla se on. Sama malli on Keskustelut-osion poikkeuksissa
(`server-sections-norm`, jaettu komponentti `LimitReset` kohdassa
`web/src/components/ServerSection.tsx`).

Prototyyppikierros (`AGENTS-WORKFLOW.md`), yksi näkymä: missä oman rajan
palautus oletukseen on henkilörivillä (esim. säätimen vieressä pienenä
toimintona, *oma raja* -merkinnän kohdalla linkkinä, rivin valikossa), niin että
rivit pysyvät samankorkuisina. Levytila ja Keskustelut samalla ratkaisulla;
1440 ja 390, vaalea ja tumma.

## Acceptance Criteria

- [ ] kierros 1: nykytila, kolme suuntaa, näkymätarjous ja kysymykset Jarille
