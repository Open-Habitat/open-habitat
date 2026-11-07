---
created: 2026-11-07
updated: 2026-11-07
type: task
reporter: jari
status: done
priority: normal
preparation: pending
lane: server-norm-proto
lane_seq: 1
closed: 2026-11-07
---

# Prototype: one component norm for the server settings sections (Keskustelut, Levytila)

## Description

Jari 7.11.2026 (testikone): palvelimen asetusten *Keskustelut*- (Conversations)
ja *Levytila*- (Disk space) näkymien pitää käyttää samannäköisiä
komponentteja. Toinen on hiottu ja tyylikäs, toinen rujo. Prototyyppikierros
(`AGENTS-WORKFLOW.md`), jossa näkymät normeerataan jompaankumpaan tyyliin,
niin että uusi palvelinosio (esim. levyt) tehdään jatkossa samalla mallilla.
Inventoi palvelinalueen kaikki osiot ja niiden komponentit (rivit,
numerokentät/stepperit, mittarit, otsikot, selitteet); kolme suuntaa: normi
Keskustelut-näkymän tyyliin, Levytila-näkymän tyyliin tai yhdistelmä; kaikki
palvelinosiot samalla normilla oletusnäkymässä.

## Acceptance Criteria

- [ ] kierros 1: nykytila, kolme suuntaa, näkymätarjous ja kysymykset Jarille

## Decision (Jari 2026-11-07, kierros 1)

Normi **C Yhdistelmä**. Koskee myös Käyttäjien, tekoälyavaimen ja
Integraatioiden listoja, jos se sopii niihin hyvin ja siististi. Kysymys 2
(seuraako levyraja oletusta) jäi vastaamatta: toteutus ei muuta hostia,
*Oletukseen* asettaa levylle nykyisen oletusarvon, ja kysymys kirjataan
myöhempään katselmointiin. Toteutus: `server-sections-norm`.
