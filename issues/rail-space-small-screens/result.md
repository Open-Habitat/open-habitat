# Sivupalkki läppärin näytöllä – tulos

## Saatesanat

Kokeilin kolmea tapaa vapauttaa sivupalkin yläosa. Mittari on sama kuin
kuvakaappauksessasi: kuinka monta keskustelu- ja työtilariviä näkyy kokonaan
1280 × 720 -ikkunassa. Tavallisena arkena käytin neljää Sinun vuorosi
-keskustelua, kahta käynnissä olevaa, kahtatoista hiljaista ja 18 työtilaa.
Nykyisessä sivupalkissa niitä näkyy **4**. Kiinteä yläosa ja haku vievät noin
280 px, joten keskustelualueeseen mahtuu vain avoin rivi ja reunasirut.

Suosittelen suuntaa **B Muualle (11 riviä)**. Sivupalkkiin jäävät vain
keskustelut ja työtilat. Etusivu on palvelimen nimi, joka on jo nyt linkki,
ja haku on kuvake otsikkorivillä sekä ⌘K. Tuotokset ja Agentin käytössä
siirtyvät henkilövalikkoon, koska niitä avataan harvoin. Selain löytyy
keskustelun sirusta ja nousee sivupalkkiin riviksi, kun se tarvitsee sinua.
**A Tiivis (9 riviä)** on hyvä vaihtoehto, jos haluat jokaisen kohteen yhä
yhdellä painalluksella. Siinä viisi kohdetta on yhdellä kuvakerivillä.
**C Yksi vieritys (6 riviä)** häviää tässä mittarissa, koska ryhmä ja haku
ovat silti listan alussa. Sen etu on, ettei millään osiolla ole omaa pientä
laatikkoa.

Kokeile tilannevalitsimesta myös *Kuvakaappauksen kaltainen* ja ikkunaksi
1440 × 800. Kun Oma selain on tilassa *pyytää sinua*, näet, missä selaimen
pyyntö näkyy kussakin suunnassa.

## Sivu

Rakennettu itsenäinen sivu tällä työhostilla:
`/var/tmp/agent-keep/rail-space-small-screens/offline.html`.
Lähteet ovat hakemistossa `design-system/prototypes/rounds/2026-11-22-rail-space/`,
ja rakennus- ja tarkistuskomennot sen `NOTES.md`:ssä. Tarkistuksen kuvat ja
`rows.json` ovat hakemistossa `/var/tmp/agent-keep/rail-space-small-screens/check/`.
Sivu on tehty tuotannon komponenteista (sivupalkki, osiot, rivit, selainrivi
ja -siru, henkilövalikko, keskustelun otsikko ja kenttä). Kaikki nimet ovat
keksittyjä.

## Suunnat ja mittaus

Rivit näkyvät kokonaan ilman vieritystä. Muoto on *yhteensä (keskustelut +
työtilat)*. Hiljaiset taittuu itsestään ahtaassa sivupalkissa kuten
tuotannossa. C:ssä se alkaa taitettuna.

| Ikkuna | Tilanne | A Tiivis | B Muualle | C Yksi vieritys | Nyt |
| --- | --- | --- | --- | --- | --- |
| 1280 × 720 | tavallinen (4 / 2 / 12, 18) | **9** (6+3) | **11** (6+5) | **6** (6+0) | **4** (1+3) |
| 1280 × 720 | kuvakaappauksen kaltainen (3 / 0 / 5, 6) | 9 (3+6) | 12 (8+4) | 6 (3+3) | 5 (2+3) |
| 1280 × 720 | ruuhka (6 / 4 / 30, 40) | 11 (8+3) | 13 (9+4) | 10 (10+0) | 4 (1+3) |
| 1440 × 800 | tavallinen | 11 (6+5) | 14 (6+8) | 8 (6+2) | 7 (4+3) |
| 1440 × 800 | kuvakaappauksen kaltainen | 13 (8+5) | 14 (8+6) | 8 (3+5) | 6 (3+3) |
| 1440 × 800 | ruuhka | 13 (10+3) | 14 (10+4) | 10 (10+0) | 7 (4+3) |
| 1920 × 1080 | tavallinen | 21 (18+3) | 23 (18+5) | 17 (6+11) | 13 (6+7) |
| 1920 × 1080 | kuvakaappauksen kaltainen | 14 (8+6) | 14 (8+6) | 9 (3+6) | 14 (8+6) |
| 1920 × 1080 | ruuhka | 17 (10+7) | 20 (10+10) | 14 (10+4) | 13 (10+3) |

**1920 × 1080:ssa** nykyinenkin sivupalkki riittää kuvakaappauksen
kaltaiseen tilanteeseen, jossa kaikki 14 riviä näkyvät. Suunnat auttavat
vasta, kun sisältöä on enemmän. A ja B vapauttavat tilan, jolloin Hiljaiset
mahtuu auki, ja tuotannon nykyinen sääntö antaa keskusteluille kaiken
paitsi Työtilojen minimin. Siksi työtiloja näkyy silloin vain 3–5. Tämä on
nykyisen aluesäännön seuraus eikä tämän kierroksen valinta. Ks. kysymys 3.

### Mihin mikin siirtyy

| Kohde | A Tiivis | B Muualle | C Yksi vieritys |
| --- | --- | --- | --- |
| Etusivu | kuvakerivin 1. kuvake (myös palvelimen nimi) | palvelimen nimi otsikkorivillä | ryhmän ruutu |
| Tuotokset | kuvake, määrä merkkinä | henkilövalikko (ja Etusivu) | ruutu, määrä merkkinä |
| Oma selain | kuvake, tila pisteenä; pyyntö näkyy rivinä | keskustelun siru; henkilövalikko; pyyntö näkyy rivinä | ruutu tilarivillä |
| Agentin käytössä | kuvake | henkilövalikko (ja Etusivu) | ruutu |
| Haku | kuvakerivin viimeinen kuvake, ⌘K | kuvake otsikkorivillä, ⌘K | pysyy listan yläreunassa |
| Sinun vuorosi, Käynnissä, Hiljaiset | yhteinen alue kuten nyt | yhteinen alue heti otsikon alla | samassa listassa, otsikot jäävät yläreunaan |
| Työtilojen suodatin | näkyy vasta yli 12 työtilalla | suurennuslasi Työtilat-otsikossa | Työtilat-otsikon alla |
| Päivitä | Työtilat-otsikon kuvake | Työtilat-otsikon kuvake | Työtilat-otsikon kuvake |
| Henkilövalikko | alalaidassa kuten nyt | alalaidassa, saa kolme uutta kohtaa | alalaidassa kuten nyt |

### Miten suunnat sopivat yhteen palvelinselaimen avauspaikkojen kanssa

Rinnakkainen kierros `server-browser-entry-points` suosittelee vaihtoehtoa
*Molemmat*: sivupalkista avataan koko oma selain ja keskustelun sirusta
tämän keskustelun ikkunat.

- **A**: selain on kuvakerivin kolmas kuvake. Se toimii sivupalkin ovena
  vaihtoehdoissa *Rivi* ja *Molemmat* ilman omaa riviä. Vaihtoehdossa
  *Siru* kuvake voi jäädä pois, jolloin rivillä on neljä kuvaketta.
- **B**: sopii suoraan vaihtoehtoon *Siru*. Jos valitaan *Rivi* tai
  *Molemmat*, sivupalkissa tarvitaan pysyvä ovi selaimeen. Se kannattaa
  tehdä otsikkorivin kuvakkeeksi haun viereen eikä riviksi, koska rivi
  söisi noin 45 px eli yhden keskustelurivin.
- **C**: selain on ruutu ryhmässä. Kaikki kolme vaihtoehtoa toimivat, ja
  *Siru*-vaihtoehdossa ruudun voi poistaa.

Selaimen pyyntö näkyy sivupalkin rivinä kaikissa suunnissa (prototyypissä
A, B ja Nyt). Pyyntö tarvitsee huomiota, joten se ansaitsee tilansa niin
kauan kuin se on voimassa.

## Puhelin

Puhelin ei kuulu kierrokseen. Siellä sivupalkki on erikseen avattava laatikko,
joka saa koko näytön korkeuden, eikä se kilpaile keskustelun kanssa.

## Questions for Jari

1. Valitaanko **B Muualle**, vai haluatko jokaisen kohteen yhdellä
   painalluksella kuten **A Tiivis**, jolloin rivejä mahtuu kaksi vähemmän?
2. Jos selain saa pysyvän oven sivupalkkiin (*Rivi* tai *Molemmat*), käykö
   B:ssä otsikkorivin kuvake haun vieressä?
3. Isolla näytöllä vapautunut tila menee nykyisen säännön mukaan
   keskusteluille ja avaa Hiljaiset, jolloin työtiloja näkyy vain kolme.
   Haluatko, että Työtilat saa enemmän kuin minimin, kun tilaa on reilusti?

## Decisions for later review

- **Mittarina ovat kokonaan näkyvät rivit tavallisessa arjessa, 1280 × 720.**
  Vaihtoehtona olisi ollut kuvakaappauksen tilanne. Siinä on niin vähän
  sisältöä, että se ei erota suuntia isommissa ikkunoissa. Molemmat
  tilanteet ovat taulukossa.
- **A:n suodatinraja on 12 työtilaa.** Vaihtoehtoina olisivat aina näkyvä
  kenttä (maksaa noin 40 px) ja kuvakkeen takana oleva kenttä (kuten B:ssä).
  Raja on suunnilleen se, jossa lista ei enää mahdu yhteen katseeseen.
- **Tuotokset sai A:ssa ja C:ssä linkkikuvakkeen.** Tuotannossa Tuotokset ja
  Oma selain jakavat maapallon, joten pelkkinä kuvakkeina ne erottuisivat
  vain työkaluvihjeestä. Lopullinen kuvake kuuluu designiin.
- **B:n haku on kuvake otsikkorivillä.** Vaihtoehto oli koko sovelluksen
  yläpalkki keskustelupaneelin yläpuolella. Se veisi pystytilaa keskustelulta,
  jota sama ongelma koskee.
- **B ei yhdistä työtilojen suodatinta ⌘K-hakuun.** Nykyinen haku löytää vain
  keskusteluja. Työtilojen tuominen hakuun olisi erillinen ominaisuus.
  Siksi suodatin on otsikon suurennuslasin takana.
- **C:n Hiljaiset alkaa taitettuna.** Yhdessä vieritettävässä listassa ei ole
  alueita, joiden ahtautta tuotannon automaattinen taitto voisi mitata.
  Avattuna Hiljaiset työntäisi työtilat pois näkyvistä kaikissa ikkunoissa.
- **Etusivun omat kortit Tuotoksille ja Agentin käytössä -sivulle (B) ovat
  ehdotus.** Ne jätettiin pois prototyypistä. Etusivua suunnitellaan
  omassa kierroksessaan.

## Kierros 2: sivupalkki mukautuu korkeuteen

### Saatesanat

Tein kaksi muutosta toiveesi mukaan. Yläosassa on samat kohteet kolmessa
koossa: pienellä näytöllä A:n kuvakerivi, väljemmin nimetyt ruudut ja
reilulla tilalla oma rivi kullekin. Isolla näytöllä Työtilat saa enemmän
kuin kolme riviä. Suunnat eroavat kahdessa asiassa: mikä päättää askeleen
ja miten keskustelut ja Työtilat jakavat tilan. Mittarina on sama kuin
viimeksi, eli kokonaan näkyvät rivit tavallisessa arjessa. Nyt mittaan
sekä 720 että 1080 px korkeassa ikkunassa.

Suosittelen suuntaa **C Suhteessa (720: 11 riviä, 1080: 16, nyt 4 ja 13)**.
Askel riippuu vain ikkunan korkeudesta, joten yläosa ei vaihda muotoaan
kesken työn, kun uusi keskustelu tulee. Työtilojen alue kasvaa työtilojen
määrän mukaan: 18 työtilalla ja 18 keskustelulla tila jaetaan puoliksi, ja
1440 px korkeassa ikkunassa kaikki 18 työtilaa näkyvät. **B Sisältö ensin**
antaa 1080 px:ssä eniten rivejä (19), mutta sen yläosa vaihtuu sisällön
mukana. Ruudut voivat muuttua kuvakkeiksi juuri, kun keskustelu ilmestyy.
Lisäksi B pääsee riveihin vain, kun sisältöä on vähän. **A Portaat** pitää
Hiljaiset useimmin auki, mutta antaa työtiloille vähiten tilaa.

Kokeile korkeuden esivalintoja ja liukusäädintä. Askelnauha näyttää rajat,
ja sen alla oleva rivi kertoo, mikä askeleen päätti. Vaihda Oma selain
tilaan *agentti työssä* tai *odottaa sinua*, niin näet, miten sen paikka
kantaa tilan kussakin askeleessa.

### Sivu

Rakennettu sivu tällä työhostilla:
`/var/tmp/agent-keep/rail-space-small-screens/round-2/offline.html`.
Lähteet ovat hakemistossa `design-system/prototypes/rounds/2026-11-22-rail-space-2/`,
ja rakennus- ja tarkistuskomennot sen `NOTES.md`:ssä. Tarkistuksen kuvat ja
`rows.json` ovat hakemistossa
`/var/tmp/agent-keep/rail-space-small-screens/round-2/check/`.

### Suunnat ja säännöt

| Suunta | Mikä päättää askeleen | Miten tila jaetaan |
| --- | --- | --- |
| A Portaat | korkeus: alle 850 px kuvakkeet, 850–1049 px ruudut, 1050 px alkaen rivit | Työtilat saa kolmanneksen keskustelualueesta, vähintään 11rem (noin kolme riviä) |
| B Sisältö ensin | sisältö: ruudut, kun odottavat ja käynnissä olevat sekä 6 Hiljaisten ja 6 työtilojen riviä mahtuvat; rivit, kun kumpaakin mahtuu 12 | järjestyksessä odottavat ja käynnissä olevat, työtilat (kaikki, jos mahtuvat), viimeisenä Hiljaiset |
| C Suhteessa | korkeus, kuten A | Työtilat saa osuuden työtilat / (työtilat + keskustelut), vähintään 11rem ja enintään koko listan |

Hiljaiset taittuu kaikissa suunnissa itsestään, kun se ei mahdu. Tämä on
tuotannon nykyinen sääntö.

### Mittaus

Rivit ovat kokonaan näkyvissä ilman vieritystä. Muoto on *yhteensä
(keskustelut + työtilat)*, ja suluissa oleva kirjain kertoo askeleen:
k = kuvakkeet, r = ruudut, R = rivit. Ikkuna on 1280 px leveä.

| Korkeus | Tilanne | A Portaat | B Sisältö ensin | C Suhteessa | Nyt |
| --- | --- | --- | --- | --- | --- |
| 720 | tavallinen (4 / 2 / 12, 18) | **9** (6+3) k | **11** (6+5) k | **11** (5+6) k | **4** (1+3) |
| 720 | vähän sisältöä (3 / 0 / 5, 6) | 9 (3+6) k | 9 (3+6) k | 9 (3+6) k | 5 (2+3) |
| 720 | ruuhka (6 / 4 / 30, 40) | 11 (8+3) k | 11 (8+3) k | 11 (5+6) k | 4 (1+3) |
| 800 | tavallinen | 11 (6+5) k | 13 (6+7) k | 13 (6+7) k | 7 (4+3) |
| 800 | vähän sisältöä | 13 (8+5) k | 9 (3+6) k | 9 (3+6) k | 6 (3+3) |
| 800 | ruuhka | 13 (9+4) k | 13 (10+3) k | 14 (7+7) k | 7 (4+3) |
| 900 | tavallinen | 12 (6+6) r | 17 (6+11) k | 13 (6+7) r | 9 (6+3) |
| 900 | vähän sisältöä | 13 (8+5) r | 14 (8+6) k | 9 (3+6) r | 8 (3+5) |
| 900 | ruuhka | 13 (9+4) r | 16 (10+6) k | 14 (7+7) r | 10 (7+3) |
| 1080 | tavallinen | **16** (6+10) R | **19** (6+13) r | **16** (6+10) R | **13** (6+7) |
| 1080 | vähän sisältöä | 14 (8+6) R | 14 (8+6) R | 14 (8+6) R | 14 (8+6) |
| 1080 | ruuhka | 15 (10+5) R | 22 (10+12) k | 17 (8+9) R | 13 (10+3) |
| 1440 | tavallinen | 28 (18+10) R | 24 (6+18) r | 24 (6+18) R | 25 (18+7) |
| 1440 | vähän sisältöä | 14 (8+6) R | 14 (8+6) R | 14 (8+6) R | 14 (8+6) |
| 1440 | ruuhka | 24 (10+14) R | 30 (10+20) r | 25 (10+15) R | 21 (10+11) |

Mitä luvuista näkyy:

- **720 px**: kaikki kolme suuntaa ovat kuvakkeissa. Ne eroavat vain siinä,
  miten tila jaetaan. B ja C antavat kaksi riviä enemmän kuin A.
- **1080 px**: A ja C ovat riveissä. B pysyy ruuduissa ja antaa siksi kolme
  riviä enemmän, ja ruuhkassa se pysyy kuvakkeissa.
- **1440 px**: tavallisessa arjessa A antaa eniten rivejä (28), koska
  Hiljaiset mahtuu auki. Työtiloja näkyy kuitenkin vain 10. B ja C näyttävät
  kaikki 18 työtilaa, ja Hiljaiset taittuu.
- **Vähän sisältöä**: C taittaa Hiljaiset 800–900 px:ssä, koska kaikki kuusi
  työtilaa saavat paikkansa ensin. A pitää Hiljaiset auki.

### Kuvakkeet

| Kohde | Kuvake | Huom. |
| --- | --- | --- |
| Etusivu | talo | tuotannon |
| Tuotokset | lähtevä laatikko (nuoli ylös laatikosta) | uusi; ennen maapallo |
| Oma selain | selainikkuna, tila pisteenä | uusi; ennen maapallo |
| Agentin käytössä | kilpi | tuotannon |
| Haku | suurennuslasi | tuotannon |

Kaikilla kohteilla on samassa askeleessa sama käsittely. Kuvakkeissa ja
ruuduissa kaikilla on sama ohut reuna, riveillä ei ole reunaa, eikä Oma
selain ole enää ainoa kortti (`rail-icons-tuotokset-oma-selain`). Oman
selaimen tila näkyy sen omassa paikassa:

- kuvakkeissa pisteenä, ja tila on nimetty painikkeen nimessä,
- ruudussa toisena rivinä,
- rivillä sanana oikeassa reunassa.

*Agentti työssä* näkyy ok-värillä ja *Odottaa sinua* Sinun vuorosi
-värillä. Paikka jää siis valmiiksi sille pienelle tilalle, jonka
`server-browser-entry-points`-kierros 3 päättää.

### Questions for Jari

1. Valitaanko **C Suhteessa**? Vai haluatko, että yläosa kasvaa vain, kun
   sisältö jo mahtuu (**B**), vaikka se voi vaihtaa muotoaan kesken työn?
2. Ovatko rajat 850 ja 1050 px oikeat? Nyt 900 px korkea ikkuna saa ruudut
   ja 1080 px rivit.
3. C antaa isolla näytöllä kaikki työtilat ja taittaa silloin Hiljaiset.
   Onko se oikea järjestys, vai pitäisikö Hiljaisten saada osa tilasta ennen
   kuin viimeisetkin työtilat näkyvät?
4. Käyvätkö Tuotosten lähtevä laatikko ja Oman selaimen selainikkuna
   kuvakkeiksi?

### Decisions for later review

- **Askelia on kolme, ja kaikissa suunnissa ne ovat samat.** Vaihtoehto
  olisi ollut ohittaa ruudut ja siirtyä suoraan kuvakkeista riveihin. Pyysit
  kolmea askelta, joten suunnat eroavat säännössä eivätkä askeleissa.
- **Haku on kuvakkeissa viides kuvake, ruuduissa ja riveissä tuotannon
  hakukenttä.** Vaihtoehtona olisi ollut kuudes ruutu. Kenttä kertoo
  pikanäppäimen, ja sille on tilaa, kun yläosa on muutenkin isompi.
- **Työtilojen alueen minimi pysyy 11rem:nä kaikissa suunnissa**, ja
  sääntö vain kasvattaa sitä. Pienellä näytöllä tuotannon kolmen rivin
  lattia on yhä oikea.
- **B:n Hiljaisten raja on 6 ja 12 riviä, ei koko Hiljaiset.** Pitkä
  Hiljaiset (ruuhkassa 30) estäisi muuten isommat askeleet kokonaan. B:llä
  on 12 px:n hystereesi, jotta reunasirujen tulo ja meno ei vaihda askelta
  edestakaisin.
- **Työtilojen suodatin näkyy vasta yli 12 työtilalla ja Päivitä on
  otsikossa kaikissa suunnissa**, kuten kierroksen 1 A:ssa. Näin vertailu
  koskee vain tämän kierroksen akselia.
- **Palvelinselaimen siru on poistettu keskustelusta.**
  `server-browser-entry-points`-kierros 2 valitsi selaimen kodiksi
  sivupalkin, ja siru olisi vienyt pystytilaa keskustelulta.
- **Ikkuna on aina 1280 px leveä.** Leveys ei vaikuta sivupalkkiin, ja kapea
  kehys mahtuu katselijan ruudulle.
- **Odottaa sinua -tila käyttää väriä `--ah-turn`.** Pyyntö on sinun
  vuorosi, ja ok-väri olisi ollut liian lähellä Agentti työssä -tilaa.
