# Sivupalkki kertoo, että keskustelun tila muuttui

Issue `rail-state-change-visual`. Jari 22.11.2026: kokeile eri tapoja,
joilla vasen sivupalkki näyttää keskustelun tilan muuttuneen. Tärkein
muutos on vuoron päättyminen muualla, kun keskustelu siirtyy Sinun
vuorosi -osioon. Muita ovat käynnistyminen (Käynnissä), epäonnistuminen
ja selain, joka odottaa sinua. Muutos pitää huomata ilman ääntä ja silloin,
kun luet toista keskustelua. Ääni soi jo, kun vuoro päättyy muualla
(`attention-sound`); tämä kierros on sen hiljainen pari.

Akseli: **millä visuaalisella keinolla muutos näkyy ja kuinka kauan**.
Kaikissa suunnissa on sama kahdeksan tapahtuman käsikirjoitus:

1. Kuittien luokittelu käynnistyy (Hiljaiset → Käynnissä).
2. Kevätkokouksen esityslistan vuoro päättyy (Käynnissä → Sinun vuorosi).
3. Jäsenlomakkeen täyttö: selain odottaa sinua (rivi pysyy Käynnissä,
   ja tuotannon merkki "selain" korvaa ajan).
4. Laiturin korjaustarjoukset epäonnistuu. Pi kaatui kesken vuoron, joten
   rivi pysyy Käynnissä kuten tuotannossa.
5. Selaat Hiljaisia alas, jolloin Sinun vuorosi jää näkymän yläpuolelle.
6. Matkasuunnitelma Ouluun kysyy sinulta näkymän ulkopuolella.
7. Viisi muuttuu kerralla: kolme siirtyy Sinun vuorosi -osioon ja kaksi
   käynnistyy.
8. Avaat Kevätkokouksen esityslistan, ja sen merkki poistuu.

Suunnat:

- **Nyt**: tuotanto. Rivi vaihtaa osiota ja merkkiä ilman muuta ilmettä,
  ja reunasiru kertoo vain rivien määrän.
- **A Liuku**: rivi liukuu uuteen paikkaansa (FLIP, 520 ms), ja sen tausta
  hehkuu ja häipyy 3,5 sekunnissa. Vähennetyllä liikkeellä rivi ei liu'u,
  vaan sävy pysyy paikallaan 6 s ja poistuu kerralla.
- **B Merkki**: muuttuneella rivillä on reunaviiva alussa, otsikko on
  lihavoitu ja ajan tilalla on sana "uusi" kehyksessä, kunnes avaat
  keskustelun. Epäonnistumisen viiva ja kehys ovat virheen värisiä.
  Selainrivin oma "selain"-merkki täyttyy. Käynnistyminen ei saa merkkiä,
  koska se ei pyydä sinulta mitään.
- **C Laskuri ja siru**: osion otsikon luku sykähtää kerran, ja sen viereen
  jää "+n", kunnes rivit avataan. Kun uusi rivi on näkymän ulkopuolella,
  tuotannon reunasiru saa saman "+n":n ("↑ Sinun vuorosi 2 +2").
- **D Reuna**: sivupalkin oikea reuna hehkuu kahdesti ja jää ohueksi
  viivaksi, kunnes kaikki muutokset on avattu. Työtilat-listan rivi kertoo,
  montako uutta sen työtilassa on ("1 uusi").
- **E Yhdistelmä** (suositus): B:n merkki, C:n reunasiru ja yksi A:n hehku
  ilman liukua. Kun kolme tai useampi muuttuu kerralla, hehkua ei ole.
  Ruudunlukija kuulee kohteliaan ilmoituksen ("Kevätkokouksen esityslista:
  uusi vastaus, Sinun vuorosi"), ja ryöpyssä yhden ilmoituksen ("5
  keskustelua muuttui").

Värisokeus: mikään suunta ei kerro muutosta pelkällä värillä. B ja E
käyttävät sanaa "uusi" ja lihavointia, C käyttää merkkiä "+n" ja D sanaa
"n uutta". A:n hehku on kertaluonteinen huomion veto, eikä se kanna tietoa
yksin, ja juuri siksi E lisää siihen merkin.

Melu: viisi kerralla on käsikirjoituksen seitsemäs tapahtuma. A:ssa viisi
riviä liukuu ja hehkuu yhtä aikaa. B:ssä syntyy viisi rauhallista merkkiä
(käynnistymiset jäävät ilman). C:ssä luku on "+5" ja D:ssä yksi hehku.
E:ssä merkit tulevat ilman hehkua.

## Puhelin

Kierros on työpöydän sivupalkki; puhelinkehystä ei rakennettu. Näin suositus
vastaa puhelimen laatikkoa:

- **Laatikko kiinni**: navigaationapin luku (tuotannon `navigationBadge`,
  Sinun vuorosi -rivit) saa uuden muutoksen ajaksi saman merkin kuin rivi.
  Luvun ympärillä on rengas, ja napin nimi kertoo "n uutta". Rengas
  poistuu, kun uudet rivit avataan. Hehku on yksi pulssi napissa, ei
  koskaan vähennetyllä liikkeellä.
- **Laatikko auki**: samat rivimerkit ja reunasirun "+n" kuin työpöydällä.
  Hehku jää pois, koska laatikko avataan aina vasta muutoksen jälkeen.
- **Kapea sivupalkki** (työtilan kirjaimet palloina): pallon alle tulee sama
  reunaviiva ja pallon nimeen "uusi". Reunan hehku (D) sopisi tänne, mutta
  kapea palkki on harvinainen, joten sitä ei ehdoteta erikseen.

## Mitä sivu käyttää

Sivu on tuotannon kehys: `AppShell`, `WorkspaceRail` alueineen ja
reunasiruineen (`railRegions.tsx`), `NowSections`, `QuietSection`,
`AgentNavItem`-rivit `HabitatMark`-merkkeineen, `BrowserRowMarks`
(selainrivin merkki), `WorkspaceNavRow`, `AccountShelf`, `AgentHeader`,
aikajana ja `Composer`. Efektit ovat kierroksen omia. Ne ovat
data-attribuutteja, jotka kierros asettaa tuotannon riveille, luvuille,
siruille ja sivupalkille jokaisen piirron jälkeen. `round.css` piirtää ne,
ja sen alussa on luettelo attribuuteista. Rivin avaaminen on oikea
navigointi (`MemoryRouter`), joten voit avata minkä tahansa rivin ja nähdä
sen merkin poistuvan. Sisältö on synteettistä.

Paneelissa oikealla ovat teema, kieli, Vähennä liikettä (sama kuin
laitteen asetus), Toista itsestään, Seuraava tapahtuma ja Alusta.
Tapahtuman kuvaus on paneelissa, samoin jokaisen suunnan rivi ja
suositus. Toisto on oletuksena päällä ja etenee 3,4 sekunnin välein.

Osoitevalinnat: `?v=1..6`, `?theme=dark|contrast`, `?lang=en`, `?reduce=1`
ja `?auto=0`.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-rail-state-change/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1200 \
  node design-system/prototypes/rounds/2026-11-22-rail-state-change/check.mjs \
  design-system/prototypes/dist/rail-state-change/offline.html <kuvahakemisto> [--quick]
```

Linuxissa komennot ajetaan scratch-leasen alla yksityisellä `TMPDIR`:llä ja
`umask 077`:llä. Rakennus kirjoittaa hakemistoon
`design-system/prototypes/dist/rail-state-change/` tiedostot `offline.html`
(fontit upotettuina) ja `index.html` (ilman fontteja). `check.mjs`:n alussa
kerrotaan, mitä se tarkistaa.
