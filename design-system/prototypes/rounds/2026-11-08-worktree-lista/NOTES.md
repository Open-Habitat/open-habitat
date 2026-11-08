# Worktree-lista – kierros 1: mitä rivi on ja mitä sille voi tehdä

- **Nyt**: tuotanto tänään. Gitin hakemistonimet, polut ja haarat; omistettu rivi sanoo "Taskfleet-ajo … omistaa", ja vain jäänteellä on painike.
- **1 Huomio**: näkyvissä vain rivit, jotka tarvitsevat sinua (jäänne, päätöstä odottava worker); itsestään hoituvat ovat yhdellä rivillä alla.
- **2 Keskustelut**: rivit ryhmitelty keskustelunsa alle; ryhmällä on yksi toiminto (avaa, palauta arkistosta), ja itsestään hoituva ryhmä on suljettu.
- **3 Yhteenveto**: muutama lause tilasta toimintoineen ja levyn käyttö palkkina; yksittäiset worktreet vasta Näytä kaikki -valinnan takana.

Issue `proto-worktree-list-meaning`. Akseli on se, miten työtilan sivun
Worktreet-osio järjestää rivit ja mitä se näyttää oletuksena. Kaikissa
suunnissa rivi nimetään sen mukaan, mitä se henkilölle on (avustajan nimi,
workerin tehtävä, päättyneen workerin jäänne), kerrotaan keskustelu ja sen
tila (käynnissä/arkistoitu), mikä työkopion pitää ja milloin se vapautuu,
ja toiminto vie keskusteluun, jossa agentti yhdistää tai lopettaa ajon.
Habitat ei itse pysäytä mitään (Jari 6.11.). Gitin nimet, polut ja ajon
tunnus ovat Git-tiedot-valinnan takana.

## Tarina

Jarin neljä riviä 8.11. (`evidence/jari-worktrees-2026-11-08.avif`) ja
hänen ainoan käynnissä olevan keskustelunsa worker:

- `wt-ej30796brt-r69-wtlist`: worker *Worktree-listan prototyyppi*, työssä,
  keskustelu *Worktree-lista selväksi* (käynnissä).
- `wt-vwek5m102j-testi-interaktiivinen-odottaa`: interaktiivinen worker,
  valmis ja odottaa yhdistämistä tai hylkäämistä; keskustelu *Avustajien
  kokeilu* on arkistoitu, joten kukaan ei tee sitä.
- `wt-wn4g5vgp8d-testi-headless-p-ttyy-merge-m-tt`: worker päättyi
  yhdistämättä, kukaan ei pidä työkopiota; 1 commit haarassa.
- `wt-hw4ctnr0kf-testi-avustaja`, `wt-d0qmfx5v37-testaaja`: avustajat
  arkistoiduista keskusteluista, kaikki kierrokset yhdistetty; Taskfleetin
  joutoaika (24 h raportista) poistaa työkopion itsestään.

Nyt on tuotannon `WorktreeCleanup` muuttamattomana; sama lista tulee
hostin vastauksena. Poisto kaikissa suunnissa käyttää tuotannon
`WorktreeRemoveDialog`ia. "Avaa/Palauta keskustelu" kertoo tilarivillä,
minne se veisi.

## Rakentaminen ja tarkistus

```
node build.mjs <out-dir>                 # offline.html (fontit) ja index.html
node check.mjs <out-dir>/offline.html <evidence-dir>
```

`check.mjs`:n alku kertoo kuvat ja väitteet; viimeisin ajo: 216
tarkistuspistettä, konsoli puhdas, ei vaakavieritystä.
