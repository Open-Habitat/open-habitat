# Viimeisimmät, kierros 2: opas

Avaa `raide.html`. Se on yksi offline-sivu, joka ei käytä verkkoa. Ylhäällä on
valitsin (näppäimet 1–3 tai ←/→):

- **Nykyinen** on main nyt (`d2646e25` ja myöhemmät).
- **1 · Kaikki keskustelut** ja **2 · Kesken oleva työ** ovat suunnat.

Oikeasta yläkulmasta vaihdat vaalean ja tumman teeman, työpöydän ja puhelimen,
leveän ja kapean raiteen (editori auki) sekä työtilojen kuvakkeet.

## Miksi tämä akseli

Toteutus teki neljä valintaa ilman prototyyppiä: mitkä keskustelut osioon
tulevat, miten määrä asetetaan, kursiivirivi avoimelle vanhalle keskustelulle
ja kapea raide ilman osiota. Koodia lukiessa yksi niistä osoittautui
painavammaksi kuin miltä se näytti. Worktree-keskustelut rajattiin pois, jotta
**Taskfleetin workerit** eivät veisi paikkoja. Mainissa workereiden paikat on
kuitenkin jo suodatettu snapshotista (`taskfleetOwned`), joten workerin
keskustelu ei ole raiteessa koskaan, vaan worker näkyy vanhempansa rivillä.
Rajaus osuu siksi vain worktree-agentteihin, jotka **sinä** aloitit selaimesta
(*Uusi worktree-agentti*). Akseli on siis: **mitkä valmiit keskustelut
kuuluvat Viimeisimpiin.** Muut kolme valintaa ovat sivulla mainin mukaisina
kaikissa näkymissä, ja niiden kysymykset ovat `result.md`:n lopussa.

## Miten sivua käytetään

- Vasemmalla on **kohdekeskustelun** tilakone. Korostettu laatikko on sen
  tila. Katkoviivainen laatikko ei näy raiteessa, ja paksu viiva on
  viimeisin siirtymä. Punainen katkoviiva on aukko, oranssi suunnan hinta ja
  vihreä pisteviiva siirtymä, jossa rivi pysyy.
- Oikealla valitset kohteen ja tapahtumat: agentti aloittaa, valmistuu tai
  kysyy, Pi lepää, **työ yhdistetään** (agentti tai terminaali yhdistää
  haaran), avaa kohde työtilan sivulta, arkistoi, daemonin uudelleenkäynnistys
  ja ajan kuluminen. *Uusi worktree-agentti* aloittaa uuden selaimesta.
- Raiteen rivit, työtilat ja Etusivu avautuvat klikkaamalla (puhelimessa ☰).
  Kohde ei vaihdu, kun avaat muita, joten näet, mitä kohteelle tapahtuu, kun
  siirryt muualle.
- **Määrä** asetetaan kuten mainissa: raiteen alareunan *Jari ⌄* ›
  *Asetukset* › Ulkoasu › *Viimeisimmät keskustelut* (1–20). Muutos näkyy
  heti raiteessa.

## Kokeile näin

1. **Nykyinen** → *Worktree-agentin ilta*. Aloitit klo 15.10 selaimesta
   worktree-agentin *Raiteen määräasetus*. Se valmistui 15.30, ja siirryit
   15.35 Verbien taivutukseen. Kohde on tuo worktree-agentti: se ei ole
   raiteessa missään, eikä myöskään 18 minuuttia sitten valmistunut
   *Asetushaku englanniksi* (aukko 1). Paina *Avaa työtilan sivulta*: olet
   keskustelussa, mutta raiteessa ei ole sen riviä (aukko 2).
2. **1 · Kaikki keskustelut** → *Worktree-agentin ilta*. Molemmat
   worktree-agentit ovat Viimeisimpien kärjessä haaramerkillä, ja yhdistetty
   *Kuvakkeiden välimuisti* on vihreällä yhdistysmerkillä. Paina *Uusi
   worktree-agentti* pari kertaa ja *Agentti valmistuu*, niin näet, miten
   tavalliset keskustelut putoavat pois (hinta A).
3. **2 · Kesken oleva työ** → *Worktree-agentin ilta* → *Työ yhdistetään*.
   Rivi lähtee osiosta, ja Git päättää sen, ei sinä (hinta B). Yhdistämätön
   päivän vanha *B1-sanasto* pysyy osiossa.
4. Missä tahansa näkymässä: *Kapea (editori)* näyttää pistenauhan ilman
   Viimeisimpiä, ja *+10 min*, *+1 t* tai *Daemon käynnistyy uudelleen* ei
   siirrä Viimeisimpien rivejä.

Suosittelen suuntaa **1 · Kaikki keskustelut**. Perustelut, hostin tiedot ja
kysymykset ovat issuen `result.md`:ssä. Kuvat ovat hakemistossa `kuvat/`
laitteen skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py`, joka upottaa tokenit ja
fontit tiedostosta `page.src.html`.
