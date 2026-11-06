---
created: 2026-11-03
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
lane: explain-mode
lane_seq: 0
preparation: ready
---

# Prototype: explain mode in detail, on the real views (round 6)

## Description

Jari 3.11.: where did the explain mode go? Status: Jari chose round 5's riff
1 (*Himmennys ja kortti osoittimessa*, whole screen, no shortcut) on 1.11.
and `explain-mode` was filed ready, but it was never started; nothing of it
is built. Before building, Jari wants a more precise prototype round.

Round 6 takes riff 1 further, on the real current views (built from the
production components, after the latest header and composer changes), not a
mock: how the mode is entered (the start page strip *Selitä nämä mulle*, ⋯ ›
*Selitä tämä näkymä*, and where it is found once the strip is gone), every
area it explains (header, rail, composer and its lists, panels, terminal,
editor, settings), what each card says (texts from the same source as the
agent's UI reference, both languages), pinning and *Kokeile*, phone (tap),
and how it ends. Three directions on the details that remain open, one line
each at the top, plus the recommendation; interactive.

## Decision (Jari 2026-11-06)

**Tyyli 1** (Mitä · tiedä · kokeile). Kierros 7 riffaa:

- Kiinnitys napsauttamalla poistetaan. Sen sijaan napsautettavat
  käyttöliittymäkomponentit toimivat selitystilassakin (esim. "1 ajatus ja
  3 työkalua" avautuu). Käyttöliittymää saa tarvittaessa vähän muokata.
- Selitystilassa on nyt kivasti opastusta myös keskustelun tilaan. Miten
  siihen pääsee muissa tilanteissa kuin keskustelun alussa, ja miten
  henkilö pääsee näkemään sen?

## Decision (Jari 2026-11-06, kierros 7)

**Selitä-painike** (riffi 2). Riffataan vielä (kierros 8): mitä tapahtuu,
kun hiiri on alueella, johon ei liity tietoa (nyt kirjoituskentän palkin
selitys näkyy koko ajan liikaa), ja kulmatapaukset, kuten vasemmalla
piilossa olevat painikkeet, jotka tulevat näkyviin hiiren ollessa päällä
(esim. ensimmäisessä rivissä).

## Decision (Jari 2026-11-06, kierros 8)

- Riffi **1 Kuten aina**: osoitin toimii kuten ilman tilaa (piilopainikkeet
  tulevat näkyviin ja selittyvät), tyhjän kohdan päällä viimeisin kortti jää.
- Kohta selittyy **vain näkyvän sisältönsä päällä**: kyllä.
- Kysymys 3 (avautuuko tilakortti napsauttamalla keskustelun tyhjää kohtaa)
  jäi epäselväksi: Jari ei hahmottanut, mikä kortti avautuisi. Kierros 9
  näyttää sen kuvina: tilakortti on kierroksen 7 kortti, joka kertoo
  keskustelun tilan (esim. *Odottaa sinua*) ja *Voit nyt* -rivit; näytä,
  miten siihen pääsee Selitä-painikkeella ja vaihtoehtoisesti tyhjän kohdan
  napsautuksella, rinnakkain.

## Acceptance Criteria

- [ ] A prototype round on the real views with three directions, phone and desktop, a recommendation and at most three questions.

## Jari 3.11.: what this round is

Riff 1 (*Himmennys ja kortti osoittimessa*) is the chosen mode; this round
does not riff alternatives to it. Its purpose is **all the texts**: the
prototype shows the guidance style (how a card speaks to the person) and then
every single explained element written carefully in that style, so Jari can
go through them all; implementation proceeds from those texts. Directions,
if any, are only about the style of the cards (tone, length, structure),
shown on the same few elements, with the full set written in the
recommended style.
