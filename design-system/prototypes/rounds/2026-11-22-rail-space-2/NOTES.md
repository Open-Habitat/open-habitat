# Sivupalkki, joka mukautuu näytön korkeuteen (kierros 2)

Jarin palaute kierrokselle 1 oli, että A Tiivis on paras, mutta sivupalkin
pitäisi mukautua korkeuteen. Pienellä näytöllä yläosa on A:n kuvakerivi.
Kun tilaa on enemmän, samat kohteet saavat nimensä ruutuina, ja reilulla
tilalla kullakin on oma rivinsä. Isolla näytöllä Työtilat saa enemmän kuin
kolmen rivin minimin.

Akseli: **mikä päättää askeleen ja miten keskustelut ja Työtilat jakavat
tilan**. Askeleet ovat kaikissa suunnissa samat: kuvakkeet, ruudut ja rivit.
Luvut ovat kokonaan näkyviä keskustelu- ja työtilarivejä tavallisessa
arjessa (4 / 2 / 12, 18 työtilaa) 720 ja 1080 px korkeassa ikkunassa.

- **A Portaat** (9 / 16): askel tulee pelkästä korkeudesta. Alle 850 px
  näkyvät kuvakkeet, 850–1049 px ruudut ja 1050 px alkaen rivit. Työtilojen
  alue on kolmannes keskustelualueesta, vähintään 11rem.
- **B Sisältö ensin** (11 / 19): ruudut tulevat, kun odottavat ja käynnissä
  olevat keskustelut sekä kuusi Hiljaisten ja kuusi työtilojen riviä
  mahtuvat ruutujen kanssa. Rivit tulevat, kun kumpaakin mahtuu kaksitoista.
  Tila jaetaan järjestyksessä: odottavat ja käynnissä olevat, työtilat ja
  viimeisenä Hiljaiset, joka taittuu itsestään kuten tuotannossa.
- **C Suhteessa** (11 / 16, suositus): askel tulee korkeudesta kuten
  A:ssa. Työtilojen alue on keskustelualueesta työtilojen osuus kaikista
  riveistä (työtilat / (työtilat + keskustelut)), vähintään 11rem ja
  enintään koko lista.
- **Nyt** (4 / 13): tuotannon sivupalkki vertailuksi.

Issue `rail-space-small-screens`. Luvut, taulukko, suositus ja kysymykset
ovat issuen `result.md`:n kohdassa *Kierros 2*.

Sivu on tuotannon kehys: `AppShell`, `WorkspaceRail`, `NowSections`,
`QuietSection`, `WorkspaceNavRow`, `WorkspaceActions`, `SearchDoor`,
`AccountShelf` sekä avoin keskustelu (`ConversationFrame`, `AgentHeader`,
`ConversationTimeline`, `Composer`). Nyt-suunta käyttää lisäksi tuotannon
`BrowserRailRow`-korttia. Kierroksen omia osia ovat:

- mukautuva yläosa `Head` kolmessa askeleessa,
- `Measure`, joka piirtää kaikki kolme askelta näkymättömiin, jotta sääntö
  tietää niiden korkeudet ennen valintaa,
- sääntö `decide` / `useAdapt`, joka asettaa askeleen ja Työtilojen alueen
  minimin (`--rsp-ws-floor`, tuotannossa `min-height: 11rem`),
- Työtilat-otsikon Päivitä-kuvake ja kierroksen 1 A:sta peritty suodatin,
  joka näkyy vasta yli 12 työtilalla,
- kaksi uutta kuvaketta: Tuotokset on lähtevä laatikko ja Oma selain
  selainikkuna. Tuotannossa molemmilla on maapallo.

Kaikilla kohteilla on samassa askeleessa sama käsittely, eikä mikään niistä
ole oma korttinsa. Oman selaimen tila näkyy sen omassa paikassa: kuvakkeena
pisteenä ja nimettynä `aria-label`issa, ruudussa toisena rivinä ja rivillä
sanana oikeassa reunassa. Agentti työssä -tila näkyy ok-värillä,
Odottaa sinua -tila Sinun vuorosi -värillä (`--ah-turn`). Erillistä
selainriviä ei tule. Palvelinselaimen siru on poistettu keskustelusta, koska
`server-browser-entry-points` valitsi selaimen kodiksi sivupalkin.

Katselmoinnin palkissa on korkeuden esivalinnat 720, 800, 900, 1080 ja
1440 sekä liukusäädin 560–1600 (ikkuna on aina 1280 px leveä). Lisäksi
palkissa valitaan tilanne, Oman selaimen tila, teema ja kieli, ja siellä on
kuvakesarja. Askelnauha näyttää rajat (B:ssä tilanteesta lasketut) ja
nykyisen korkeuden, ja sääntörivi kertoo, mikä askeleen päätti ja montako
työtilariviä näkyy. Samat valinnat saa osoitteella: `?h=900`,
`?world=like|crowded`, `?browser=agent|ask`, `?theme=dark|contrast`,
`?lang=en` ja `?d=0..3`. `?bare=1` piilottaa palkin ja täyttää ikkunan.
Tarkistus mittaa tällä tavalla.

Puhelin on rajattu pois, kuten kierroksella 1.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-rail-space-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node design-system/prototypes/rounds/2026-11-22-rail-space-2/check.mjs \
  design-system/prototypes/dist/rail-space-2/offline.html <kuvahakemisto> [--quick]
```

Linuxissa komennot ajetaan scratch-leasen alla yksityisellä `TMPDIR`:llä ja
`umask 077`:llä. Rakennus kirjoittaa hakemistoon
`design-system/prototypes/dist/rail-space-2/` tiedostot `offline.html`
(fontit upotettuina) ja `index.html` (ilman fontteja). `check.mjs`:n alussa
kerrotaan, mitä se tarkistaa. Se kirjoittaa `rows.json`-taulukon, josta
`text.ts`:n `ROWS` ja `result.md`:n luvut tulevat, ja epäonnistuu, jos
sivulla näkyvä luku ja mittaus eroavat.
