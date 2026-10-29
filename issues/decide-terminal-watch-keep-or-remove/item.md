---
created: 2026-10-29
updated: 2026-10-29
type: task
reporter: jari
status: open
priority: normal
scheduling: excluded
scheduling_reason: awaiting Jari's product decision
preparation: pending
---

# Decide: keep or remove the experimental terminal Pi watch

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Päätteen Pi:n katselun tarpeellisuus kyseenalainen, eikä ominaisuus toiminut (Jari 29.10., pilot.511, tuotepalaute): Jari käynnisti asetus päällä selaimen päätteessä (tmux) `pi` ja kirjoitti sille, mutta keskustelun alareunaan ei tullut riviä *Pi kirjoittaa tähän tmux-ikkunassa …*. Jarin mukaan koko ominaisuus kuulostaa tarpeettomalta: hän ei halua käynnistää Pi-prosesseja päätteessä. Ennen jatkotyötä on päätettävä, jatketaanko tätä vai poistetaanko se. Perusteena on ollut, että SSH:n yli käytetty natiivi Pi ja selain kirjoittavat samaan keskusteluun (`terminal-watch-experimental`).
