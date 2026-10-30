---
created: 2026-10-30
updated: 2026-10-30
type: improvement
reporter: jari
status: done
priority: normal
lane: speech-input
lane_seq: 20
preparation: ready
closed: 2026-10-30
---

# Dictation starts at once, Enter finishes it, and a shortcut starts it

## Description


## Description

Jari 2026-10-30 (Birch, pilot.15, kirjoituskentän painikerivin prototyypin
yhteydessä):

- **Käynnistys on hidas.** Kun *Sanele*-painiketta painaa, menee sekunti
  tai pari ennen kuin voi alkaa puhua.
- **Enter ei lopeta sanelua.** Sanelun aikana Enter lisää kenttään
  rivinvaihdon; sen pitäisi tehdä sama kuin *Valmis*-painike.
- **Sanelulle ei ole pikanäppäintä.** Sanelun pitäisi käynnistyä
  näppäimistöltä.

Nykyinen sanelun kuuntelutila (painike kasvaa isommaksi, *Valmis*) on Jarista
hyvännäköinen; sen ulkoasua riffataan erikseen `proto-composer-actions`-
kierroksella 2, joten tämä työ ei muuta ulkoasua.

## Acceptance Criteria

- [x] Mitattu, mistä käynnistysviive koostuu (mikrofonilupa ja
      `getUserMedia`, avaimen tai istunnon haku, yhteys puhepalveluun,
      äänimoottorin käynnistys), ja puhe tallentuu heti painalluksesta,
      vaikka yhteys valmistuisi myöhemmin; ensimmäiset sanat eivät katoa.
- [x] Enter sanelun aikana = *Valmis* (sanelu loppuu ja teksti jää
      kenttään; ei lähetä). Esc toimii kuten ennen.
- [x] Pikanäppäin käynnistää ja lopettaa sanelun, näkyy painikkeen
      vihjeessä, ei törmää selaimen, käyttöjärjestelmän tai kentän olemassa
      oleviin näppäimiin; työpöytä (Mac ja muut).
- [x] Selainspec Enterille ja pikanäppäimelle.
