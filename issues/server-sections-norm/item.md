---
created: 2026-11-07
updated: 2026-11-07
type: improvement
reporter: jari
status: done
priority: normal
preparation: ready
lane: server-norm
lane_seq: 1
closed: 2026-11-07
---

# Server settings sections on one component norm (C Yhdistelmä)

## Description

Jari 7.11.2026: toteutus prototyypistä `proto-server-sections-norm`
(`design-system/prototypes/rounds/2026-11-07-palvelinosioiden-normi/`), normi
**C Yhdistelmä** kaikkiin palvelinalueen osioihin: Keskustelujen rakenne ja
paksu mittari, luvut mittarin otsikon vieressä, sarakeotsikot listan yllä,
henkilön lukema omassa sarakkeessaan ja raja stepperillä. Myös Käyttäjien,
tekoälyavaimen ja Integraatioiden listat, jos normi sopii niihin hyvin ja
siististi (muuten perustelu result.md:hen). Yhteiset osat jaettuina
komponentteina, joita uusi palvelinosio käyttää. Ei hostin muutosta: levyn
*Oletukseen* asettaa nykyisen oletusarvon. Korjaa olemassa olevan näkymän
ulkoasua, ei kokeellinen.

## Acceptance Criteria

- [x] palvelinosiot samalla normilla jaetuin komponentein; kuvat DSF 2 (1440, 390, vaalea ja tumma); muutetut selaintestit
