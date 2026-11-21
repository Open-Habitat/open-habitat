# Ohjeet agentille: muistilappu omin sanoin (kierros 4)

Issue `new-user-agent-instructions-template`. Jari 21.11.2026 kierroksesta 3:
A2 Muistilapun sanat ovat parhaat, ja A3 Esittelyn kenttä on paras, koska
ihminen voi muokata vapaata tekstiä itse. Tämä kierros yhdistää ne ja lisää
kaksi asiaa: vaiheen, jossa ihminen kirjoittaa omin sanoin, ja valinnan,
millä kielellä agentti vastaa. Suositus ja kysymykset Jarille ovat issuen
`result-4.md`:ssä.

Lappu näytetään **jaetussa ohje-editorissa**
(`../2026-11-21-instructions-settings-2/editor.tsx`). Sama lohko on
Asetusten Tili › Ohjeet agentille -näkymässä, joten molemmat näkymät
näyttävät ja muokkaavat samaa tiedostoa samalla tavalla. Editori avautuu
Esikatseluun, Muokkaa-välilehdellä on raaka Markdown, ja Tallenna on
reitin tallennus.

Muunnelmat eroavat siinä, missä omat sanat ja kieli ovat:

- **A4.1 Keskustelu** (suositus): kieli on agentin ensimmäinen kysymys.
  Habitatin kieli on ensimmäinen ja korostettu pikavastaus. Omat sanat ovat
  viimeinen vuoro, jossa on oma tekstikenttä ja Ohita. Lappu näytetään
  lopuksi editorissa.
- **A4.2 Ensin itse**: ensin kortti, jossa on kielivalinta valmiiksi
  valittuna ja tekstikenttä "Mitä agentin pitäisi tietää sinusta?" (Jatka /
  En keksi nyt, kysy sinä). Sen jälkeen agentti kysyy vain loput. Kieli jää
  pieneksi riviksi keskustelun yläpuolelle.
- **A4.3 Vieressä**: lappu näkyy keskustelun vieressä alusta asti ja täyttyy
  vastausten mukana. Kieli on lapun yläreunassa, omat sanat lapun alla.
  Editori on lukittu, kunnes kysymykset on käyty (syy näkyy), koska ihmisen
  ja agentin yhtä aikaa kirjoittama teksti pitäisi muuten yhdistää.
  Kaksi saraketta ei mahdu tuotannon 860 px:n reittikehykseen. Muunnelma
  levittää kehyksen tällä vaiheella 1280 px:iin. Tämä on tuotantomuutos,
  jonka muunnelma vaatisi. Kapeassa näkymässä lappu on keskustelun alla.

## Yhteistä kaikille

- A2:n sanat: otsikko "Muistilappu agentille" ja johdanto "Agentti ei muista
  aiempia keskusteluja…". GitHubista otettu tieto tarkistetaan (Kyllä, laita /
  Jätä pois).
- Lappu on vapaata Markdownia: otsikko, kappaleet ja ihmisen omat sanat
  omassa `## Omin sanoin` -osiossaan. Otsikoitu osio kertoo agentille
  myöhemmin, mikä teksti on ihmisen omaa ja säilytetään sanasta sanaan.
- Omat sanat: agentti saa korjata vain isot alkukirjaimet ja välimerkit.
  Korjattu versio tarjotaan erikseen (Pidä omani / Käytä korjattua), ja
  lappuun menee aluksi ihmisen oma teksti sellaisenaan.
- Kieli: oletus on Habitatin kieli (tuotannossa henkilön kielivalinta tai
  selaimen kieli, kun valintana on Järjestelmä). Vaihtoehdot ovat suomi,
  englanti ja ruotsi. Muun kielen voi kirjoittaa lappuun itse. Valinta
  kirjoittaa lappuun yhden lauseen ("Vastaa minulle suomeksi."). Keskustelu
  jatkuu käyttöliittymän kielellä.
- Lappu näytetään ennen tallennusta. Tallenna on editorin oma painike, eikä
  se näy ennen kuin kysymykset on käyty. Tee myöhemmin on aina näkyvissä.
- Tallennuksen jälkeen näytetään yksi selkokielinen lause, ja tekniset
  tiedot ovat "Missä ohjeet ovat?" -kohdan takana. Keskustelua ei näytetä
  sivupalkissa koskaan, kuten kierroksessa 3 (perustelu on sen kierroksen
  NOTES.md:ssä).
- Olemassa oleva tiedosto: vanha teksti on editorissa merkinnällä Ennallaan
  ja lisäys merkinnällä Uutta. Kieltä ei kysytä eikä lisätä, koska vanhassa
  tekstissä se jo on. Jätä ennalleen ei kirjoita mitään.

## Käyttö

```
node build.mjs <out-dir>          # offline.html ja index.html
node check.mjs <out-dir>/offline.html <shots-dir> [--quick]
```

`build.mjs` vaatii `web/node_modules`-hakemiston (`npm ci` hakemistossa
`web/`), ja `check.mjs` vaatii lisäksi Playwrightin Chromiumin
(`PLAYWRIGHT_BROWSERS_PATH`). Osoitteessa toimivat
`?theme=light|dark|contrast`, `?lang=en`, `?scenario=existing` ja
`?stage=login|reveal`. Rakennus paikkaa tuotannon
`OnboardingFrame`-komponentin vaiheen nimen samoin kuin kierrokset 2 ja 3.
Kirjastoon (`lib/`) ja tuotantokoodiin ei tehty muutoksia.
