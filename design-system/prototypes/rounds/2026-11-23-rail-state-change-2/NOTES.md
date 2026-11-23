# Sivupalkki näyttää tilan muutoksen liikkeellä (kierros 2)

Issue `rail-state-change-visual`. Jari 23.11.2026 kierroksesta 1: se oli
sekava, "uusi"-merkki on luultavasti turha, ja muutoksen pitäisi näkyä
animaationa tai vastaavana. Tämä kierros jättää pysyvät merkit pois.
Liike kertoo muutoksen sillä hetkellä, kun se tapahtuu. Sen jälkeen
sivupalkki on tuotannon oma: osio, merkki, luku ja reunasiru.

Akseli: **millä liikkeellä muutos näkyy**. Kaikki suunnat ovat lyhyitä
(alle 2 s) ja rauhallisia. Kaikissa sama tapahtuma saa saman liikkeen
osuipa se kuinka moneen riviin tahansa.

- **A Siirtyy** (suositus): rivi nousee ja liukuu vanhasta paikastaan
  uuteen osioonsa (FLIP, 620 ms). Naapuririvit ja osioiden otsikot
  liukuvat mukana, joten mikään ei hyppää. Perillä rivi hehkuu tilan
  värissä ja hehku häipyy 1,8 sekunnissa. Osioiden luvut rullaavat kuin
  mittari. Jos rivin uusi paikka on näkymän ulkopuolella, rivi liukuu
  reunan yli, tuotannon reunasiru liukuu esiin tai sen luku rullaa, ja
  sirun ympärillä käy rengas. Viisi kerralla liukuu yhtenä liikkeenä
  ilman hehkua.
- **B Pyyhkäisy**: rivi hyppää paikalleen kuten nyt, ja sen yli kulkee
  kerran valojuova tilan värissä (950 ms): vuoro ja kysymys oranssina,
  epäonnistuminen virheen värisenä. Näkymän ulkopuolella juova kulkee
  reunasirun yli. Viidestä kerralla tulee yksi juova koko Sinun vuorosi
  -osion yli.
- **C Laskuri**: rivit eivät liiku. Osion luku, reunasirun luku ja rivin
  aika ("nyt") rullaavat. Osion luvun ympärille jää rengas kahdeksi
  sekunniksi. Viisi kerralla rullaa luvut kerran.

Käynnistyminen (Hiljaiset → Käynnissä) ei pyydä sinulta mitään. Siksi se
saa vain sen liikkeen, joka kertoo rivin paikan (A:n liu'un, C:n rullan),
eikä koskaan hehkua, juovaa tai puhelimen lentoa. Kolme tai useampi
muutos yhdessä tapahtumassa on ryöppy.

Ruudunlukija kuulee kaikissa suunnissa saman kohteliaan ilmoituksen
("Kevätkokouksen esityslista: uusi vastaus, Sinun vuorosi") ja ryöpystä
yhden ("5 keskustelua muuttui"). Se ei ole suuntien ero.

## Vähennetty liike

Laitteen asetus (`prefers-reduced-motion`) tai paneelin kytkin. Mikään
ei liiku eikä rullaa:

- A: rivi saa saman sävyn ja reunuksen paikallaan 4 s, ja muuttunut luku
  saa renkaan 4 s. Puhelimen nimilappu näkyy paikallaan 3 s.
- B: juovan tilalla on paikallaan pysyvä reunus tilan värissä 4 s.
- C: luku vaihtuu kerralla ja saa renkaan 4 s.

Väri ei ole koskaan ainoa merkki. Rengas on muoto, ja osio ja luku
kertovat tilan sanoin.

## Puhelin

Puhelimessa laatikko on kiinni, kun luet keskustelua, joten kaikki rivit
ovat näkymän ulkopuolella. Merkkinä on valikkonapin luku (tuotannon
`navigationBadge`, Sinun vuorosi -rivit):

- A: keskustelun nimi ilmestyy lappuna yläpalkin alle ("Kevätkokouksen
  esityslista → Sinun vuorosi"), viipyy hetken ja lentää kutistuen
  valikkonappiin. Napin luku rullaa tai ilmestyy vasta, kun lappu
  saapuu. Viidestä kerralla tulee yksi lappu, "5 keskustelua muuttui".
- B: valojuova kulkee yläpalkin yli.
- C: valikkonapin luku rullaa. Epäonnistuminen ei muuta lukua, joten C
  ei näytä sitä puhelimessa lainkaan.

Kun laatikko on auki, rivit liikkuvat kuten työpöydällä.

## Sivu Habitat-näkymänä

Sivu toimii Habitatin näkymänä: siinä ei ole iframea, navigointia eikä
verkkoa. Puhelin on laatikko eikä kehys. `build.mjs` muuttaa tuotannon
leveys- ja korkeuskyselyt (`@media (max-width: …)`) container-kyselyiksi
(`@container rscstage …`), ja nimetty kontti on työpöydän näyttämö tai
puhelinlaatikko. `round.tsx` vastaa tuotannon `matchMedia`-leveyskyselyihin
saman laatikon leveydellä. Näin tuotannon oma puhelinasettelu piirtyy
390 px:n laatikkoon. Kapeassa ikkunassa (oikea puhelin) paneeli on
ylhäällä ja puhelinasettelu täyttää loput. Pyynnöt `/api/`-osoitteisiin
vastataan sivulla itse. Valitsimen `?v=`-osoitepäivitys sallitaan
epäonnistua, koska hiekkalaatikon läpinäkymätön alkuperä voi estää sen.

## Mitä sivu käyttää

Kehys on tuotannon: `AppShell` puhelimen yläpalkkeineen ja laatikkoineen,
`WorkspaceRail` alueineen ja reunasiruineen, `NowSections`,
`QuietSection`, `AgentNavItem`-rivit, `WorkspaceNavRow`, `AccountShelf`,
`AgentHeader`, aikajana ja `Composer`. Liikkeet ovat kierroksen omia:
Web Animations -animaatioita ja hetkellisiä data-attribuutteja tuotannon
elementeillä. `round.css`:n alussa on attribuuttien luettelo, ja
`.rsc-shell`:n `data-fx` kertoo, mitä viimeisin tapahtuma ajoi
(tarkistusta varten).

Paneelissa ovat ylimpänä suuntien rivit ja suositus, sitten ▶ Yksi
muutos, ▶ Viisi kerralla, Seuraava tapahtuma ja Alusta, tapahtuman
kuvaus, ja sen alla Näkymä (Työpöytä/Puhelin), teema, kieli, Vähennä
liikettä ja Toista itsestään. Toisto on oletuksena päällä. Ensimmäinen
muutos soi 0,9 s kuluttua avaamisesta, joten suunnan ero näkyy heti.

Käsikirjoitus (7): vuoro päättyy, käynnistyminen, epäonnistuminen,
vieritys alas (Sinun vuorosi näkymän yläpuolelle), kysymys näkymän
ulkopuolella, vieritys ylös, viisi kerralla.

Osoitevalinnat: `?v=1..3`, `?view=phone`, `?theme=dark|contrast`,
`?lang=en`, `?reduce=1` ja `?auto=0`.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-23-rail-state-change-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-23-rail-state-change-2/check.mjs \
  design-system/prototypes/dist/rail-state-change-2/offline.html <kuvahakemisto> [--quick]
```

Linuxissa komennot ajetaan scratch-leasen alla yksityisellä `TMPDIR`:llä ja
`umask 077`:llä. Rakennus kirjoittaa `offline.html`:n (fontit upotettuina,
näkymäksi tämä) ja `index.html`:n (ilman fontteja). `check.mjs` tarjoilee
sivun näkymän CSP:llä, ja sen alussa kerrotaan, mitä se tarkistaa.
