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

## Kierros 3: korkeus jaetaan hyödyn mukaan

### Saatesanat

Toteutin mallisi sääntönä, jonka voi lukea, säätää ja testata. Kummallakin
listalla on minimi ja riittävä raja. Tila annetaan järjestyksessä:
minimit, riittävät, paikat (kuvakkeet → ruudut → rivit) ja lopuksi
molemmat listat suhteessa 2 : 1. Sivulla näet kummankin listan rivit
suhteessa rajoihin, kaavion siitä, mihin kukin korkeus johtaa, ja
hyötykäyrät. Rajat-laatikosta voit muuttaa rajoja ja nähdä tuloksen heti.

Kaksi asiaa selvisi mitatessa. Ensinnäkin 720 px:n korkeuteen eivät mahdu
edes molemmat minimit. Keskustelut 7 ja Työtilat 6 riviä otsikoineen
tarvitsisivat noin 670 px, mutta tilaa on noin 550 px. Läppärillä
ratkaisevaa on siis se, kumpi joustaa, ja sitä suunnat A ja B vertaavat.
Toiseksi käyrän muoto, kulmat tai pehmeä, ei muuttanut yhtään riviä
720–1080 px:ssä. Se siirtää vain kohtaa, jossa paikat kasvavat, joten
jätin muodon Rajat-laatikkoon enkä tehnyt siitä omaa suuntaa.

Suosittelen suuntaa **C Leveämpi (720: 11 riviä, 900: 16, 1080: 21; nyt 4,
9 ja 13)**. Siinä on A:n sääntö 356 px leveässä sivupalkissa. Leveys
ostaa korkeutta: Työtilojen suodatin mahtuu otsikkoriville, mikä antaa
yhden työtilarivin lisää. Ruudut mahtuvat yhdelle riville ja tulevat
siksi 60 px aiemmin, ja keskustelurivillä näkyy työtilan nimi kuten
Jonossa. **A Tasan** antaa samat rivit nykyleveydellä yhtä vähemmän.
**B Keskustelut ensin** antaa 720 px:ssä keskusteluille koko minimin,
mutta Työtiloja näkyy silloin vain kolme (yhteensä 9). Kun minimit
mahtuvat, B ja A ovat samat.

Säännön mukaan tavallisen arjen sisällöllä yläosa pysyy kuvakkeina noin
1290 px:iin asti (C:ssä 1230 px), koska listat eivät ole sitä ennen
riittävässä. Ruutuaskel kestää vain 60–80 px. Vähällä sisällöllä ruudut
tulevat jo 920 px:ssä. Kokeile liukusäädintä ja tilannevalitsinta, ja
katso kaaviosta, miten askeleet liikkuvat.

### Sivu

Rakennettu sivu tällä työhostilla:
`/var/tmp/agent-keep/rail-space-small-screens/round-3/offline.html`.
Lähteet ovat hakemistossa `design-system/prototypes/rounds/2026-11-22-rail-space-3/`,
ja rakennus- ja tarkistuskomennot sen `NOTES.md`:ssä. Tarkistuksen kuvat ja
`rows.json` ovat hakemistossa
`/var/tmp/agent-keep/rail-space-small-screens/round-3/check/`.

### Sääntö toteutusta varten

Sääntö on funktio `allocate(params, consts, height)` tiedostossa
`model.ts`. Sivu, kaavio ja tarkistus käyttävät samaa funktiota, eikä se
koske DOMiin.

1. **Vakiot** luetaan sivupalkista. Ne eivät riipu jaosta, joten
   mittaus ei kierrä takaisin itseensä.
   - `fixed`: sivupalkin korkeus, josta on vähennetty paikkojen yläosa ja
     listojen alueet (palvelinrivi, tili, välit).
   - `head[s]`: yläosan korkeus askeleessa s (0 kuvakkeet, 1 ruudut,
     2 rivit). Kaikki kolme mitataan piilossa.
   - Kummallekin listalle `over` (otsikot, suodatin, täytteet ilman
     rivejä), `pitch` (rivi ja väli), `n` (rivien määrä) ja `cue`
     (reunasirun korkeus: keskusteluilla 26 px, Työtiloilla 22 px).
2. **Täyttö** tehdään jokaiselle askeleelle s. Rivien tila on
   `height − fixed − head[s] − over_k − over_t`. Seuraava rivi menee
   listalle, jonka seuraava rivi on arvokkain pikseliä kohden
   (`value(r) / pitch`), kunhan rivi mahtuu ja listassa on rivejä
   jäljellä. Lista, joka ei näytä kaikkia rivejään, maksaa lisäksi
   reunasirunsa. Siksi varataan ensin molemmat sirut ja palautetaan sen
   listan siru, joka näyttää kaiken.
3. **Askel** on suurin s, jolla täytön jälkeen kummankaan listan
   seuraava rivi ei ole pikseliä kohden arvokkaampi kuin yläosan pikseli
   (`button / pitch_k`) tai lista näyttää kaiken. Askel 0 käy aina.
   Ehto on monotoninen korkeuden suhteen, joten yläosa kasvaa vain
   ikkunan kasvaessa. Suurimman kokonaishyödyn valinta välkkyi askelten
   välillä noin 200 px:n matkalla, koska rivit tulevat kokonaisina.
4. **Ylijäämä**, joka on alle rivin, menee keskustelualueelle, jos siinä
   on piilossa olevia rivejä, muuten Työtiloille ja muuten tyhjäksi
   Työtilojen alle. Tulos asetetaan alueiden korkeuksiksi.

Rivin arvo, kun listassa on jo r riviä (yksikkönä riittävän rajan rivi):

| Vyöhyke | Kulmat (A, C) | Pehmeä (laatikossa) |
| --- | --- | --- |
| alle minimin | 3…4, laskee tasaisesti | `2 · 2^(−(r − min) / (riittävä − min))` |
| minimistä riittävään | 1,5…2, laskee tasaisesti | sama kaava |
| riittävän jälkeen | `1 / (1 + (r − riittävä) / paino)`; keskustelujen paino on suhde (2), Työtilojen 1 | sama kaava |
| rivit loppuneet | 0 | 0 |

Yläosan pikselin arvo (oletus 1,25) on kulmien vyöhykkeiden välissä: alle
minimistä riittävään -vyöhykkeen 1,5:n ja yli riittävän 1:n. Siksi
paikat kasvavat riittävän jälkeen ja ennen suhdetta. Vyöhykkeen sisällä
arvo laskee tasaisesti, jolloin vaje jakautuu vyöhykkeiden suhteessa.
B:ssä keskustelurivin arvo alle minimin on 5…6 ja Työtilojen kolmen
ensimmäisen rivin 7.

Säännön rivimäärä on keskusteluissa lattia. Se maksaa jokaisen otsikon,
mutta kun lista on vieritetty avoimen rivin kohdalle, osa otsikoista on
näkyvistä poissa, jolloin näkyy jopa kolme riviä enemmän. Työtiloissa
luku täsmää mittaukseen rivin tarkkuudella.

### Suunnat

| Suunta | Leveys | Kun minimit eivät mahdu | Mitä leveys tuo |
| --- | --- | --- | --- |
| A Tasan | 296 px | molemmat joustavat suhteessa | – |
| B Keskustelut ensin | 296 px | keskustelut saavat miniminsä ensin, Työtiloille jää 3 riviä | – |
| C Leveämpi | 356 px | kuten A | suodatin otsikkorivillä (+1 työtilarivi), ruudut yhdellä rivillä, työtilan nimi keskustelurivillä |

Kaikissa suunnissa oletusrajat ovat keskustelut 7 / 14 ja Työtilat 6 / 10
riviä, riittävän jälkeen 2 : 1 ja yläosan arvo 1,25. Hiljaiset pysyy omana
uusin ensin -listanaan eikä taitu itsestään. Työtiloissa on ylä- ja
alareunassa sirut "↑ 3 työtilaa" ja "↓ 8 työtilaa", jotka selaavat
painettaessa.

### Mittaus

Rivit näkyvät kokonaan ilman vieritystä. Muoto on *yhteensä (keskustelut +
työtilat)*, ja suluissa oleva kirjain kertoo askeleen: k = kuvakkeet,
r = ruudut, R = rivit. Ikkuna on 1280 px leveä.

| Korkeus | Tilanne | A Tasan | B Keskustelut ensin | C Leveämpi | Nyt | Kierros 2 C |
| --- | --- | --- | --- | --- | --- | --- |
| 720 | tavallinen (4 / 2 / 12, 18) | **11** (6+5) k | **9** (6+3) k | **11** (6+5) k | **4** (1+3) | 11 |
| 720 | vähän sisältöä (3 / 0 / 5, 6) | 10 (5+5) k | 10 (7+3) k | 10 (5+5) k | 5 (2+3) | 9 |
| 720 | ruuhka (6 / 4 / 30, 40) | 11 (7+4) k | 10 (7+3) k | 13 (7+6) k | 4 (1+3) | 11 |
| 800 | tavallinen | 12 (6+6) k | 12 (8+4) k | 13 (7+6) k | 7 (4+3) | 13 |
| 800 | vähän sisältöä | 14 (8+6) k | 13 (8+5) k | 14 (8+6) k | 6 (3+3) | 9 |
| 800 | ruuhka | 13 (7+6) k | 13 (9+4) k | 14 (8+6) k | 7 (4+3) | 14 |
| 900 | tavallinen | **15** (8+7) k | **15** (8+7) k | **16** (8+8) k | **9** (6+3) | 13 |
| 900 | vähän sisältöä | 14 (8+6) k | 14 (8+6) k | 14 (8+6) r | 8 (3+5) | 9 |
| 900 | ruuhka | 16 (9+7) k | 16 (9+7) k | 17 (10+7) k | 10 (7+3) | 14 |
| 1080 | tavallinen | **20** (11+9) k | **20** (11+9) k | **21** (11+10) k | **13** (6+7) | 16 |
| 1080 | vähän sisältöä | 14 (8+6) R | 14 (8+6) R | 14 (8+6) R | 14 (8+6) | 14 |
| 1080 | ruuhka | 20 (11+9) k | 20 (11+9) k | 21 (11+10) k | 13 (10+3) | 17 |
| 1440 | tavallinen | 27 (15+12) R | 27 (15+12) R | 28 (16+12) R | 25 (18+7) | 24 |
| 1440 | vähän sisältöä | 14 (8+6) R | 14 (8+6) R | 14 (8+6) R | 14 (8+6) | 14 |
| 1440 | ruuhka | 27 (16+11) R | 27 (16+11) R | 28 (17+11) R | 21 (10+11) | 25 |

Viimeinen sarake on kierroksen 2 suositus (C Suhteessa) kierroksen 2
tarkistuksen mittaamana, samoilla tilanteilla ja samalla mittarilla.

**Missä askel vaihtuu** (sivupalkin korkeus px; sama kuin ikkunan):

| Tilanne | A ja B: ruudut / rivit | C: ruudut / rivit |
| --- | --- | --- |
| tavallinen | 1290 / 1346 | 1230 / 1310 |
| vähän sisältöä | 923 / 979 | 899 / 979 |
| ruuhka | 1305 / 1361 | 1245 / 1325 |

Mitä luvuista näkyy:

- **720 px**: A ja C antavat 11 riviä, B 9. Työtiloja on B:ssä vain
  kolme, koska keskustelut saavat ensin seitsemän riviä ja otsikot vievät
  paljon. Kokonaan näkyviä keskusteluja on silti kuusi, kuten A:ssa.
- **900 ja 1080 px**: minimit mahtuvat, joten A ja B ovat samat. C antaa
  suodattimen ansiosta yhden työtilarivin enemmän. Kierrokseen 2
  verrattuna rivejä on 1080 px:ssä 3–5 enemmän, koska säännön mukaan
  yläosa pysyy kuvakkeina niin kauan kuin listat ovat alle riittävän.
- **800 px** on ainoa kohta, jossa A jää kierroksen 2 C:stä (12 vs. 13
  tavallisessa arjessa, 13 vs. 14 ruuhkassa). Tavallisessa arjessa
  Työtiloja näkyy yksi vähemmän (6 vs. 7), koska sääntö pitää
  keskustelulistan minimin lähellä ja jakaa vajeen. C on 800 px:ssä yhtä
  hyvä kuin kierroksen 2 C tai parempi.
- **Vähän sisältöä**: listat näyttävät kaiken jo 800 px:ssä, ja ylijäämä
  menee paikoille. Ruudut tulevat noin 920 px:ssä ja rivit 980 px:ssä.

### Suositus ja oletusrajat

**C Leveämpi** A:n säännöllä ja näillä oletuksilla:

| Arvo | Oletus | Miksi |
| --- | --- | --- |
| Keskustelut, minimi | 7 riviä | tavallisen arjen 4 odottavaa ja 2 käynnissä olevaa sekä yksi Hiljainen tai reunasiru |
| Keskustelut, riittävä | 14 riviä | kaikki odottava ja käynnissä oleva sekä noin kahdeksan viimeisintä Hiljaista |
| Työtilat, minimi / riittävä | 6 / 10 riviä | Jarin esimerkki |
| Riittävän jälkeen | 2 : 1 keskusteluille | keskustelulistaa käytetään useammin |
| Yläosan pikselin arvo | 1,25 | kulmien vyöhykkeiden välissä, jolloin järjestys on Jarin |
| Kun minimit eivät mahdu | molemmat joustavat suhteessa | B:n kolme työtilariviä on liian vähän 18 työtilalle |
| Sivupalkin leveys | 356 px | 20 % nykyistä leveämpi |

Rivit ovat sisältörivejä. Otsikot, suodatin ja reunasirut tulevat
lisäksi, ja ne mitataan, joten rajat pysyvät samoina, vaikka rivin
korkeus muuttuu (esimerkiksi kosketusnäytöllä).

Leveys on ilmainen niin kauan kuin keskustelupalsta mahtuu 760 px:n
leveydelle: 356 px:n sivupalkilla noin 1170 px:n ikkunasta ylöspäin
(nykyisellä noin 1110 px). Kapeammassa ikkunassa keskustelu kapenee 60 px.

### Questions for Jari

1. Valitaanko **C Leveämpi** A:n säännöllä? Leveys kaventaa keskustelua
   vain alle noin 1170 px leveissä ikkunoissa.
2. Säännön mukaan 1080 px korkea läppäri pysyy tavallisella sisällöllä
   kuvakkeissa, koska listat eivät ole vielä riittävässä. Onko tämä oikein?
   Jos haluat ruudut aiemmin, laske Rajat-laatikossa keskustelujen
   riittävää, niin näet kaaviosta, missä askel vaihtuu.
3. Ruutuaskel kestää vain 60–80 px, koska riittävän jälkeen kaikki
   lisätila menee paikoille. Jätetäänkö ruudut pois, jolloin askel on
   suoraan kuvakkeista riveihin?
4. Kun sisältöä on alle riittävän, askel riippuu sisällöstä. Uusi
   keskustelu voi siis vaihtaa ruudut takaisin kuvakkeiksi, esimerkiksi
   vähällä sisällöllä noin 920–980 px:ssä. Käykö tämä, vai pitäisikö askel
   laskea rajoista sisällöstä riippumatta, jolloin vähällä sisällöllä jää
   tyhjää tilaa?
5. Ovatko Työtilojen reunasirut "↓ 8 työtilaa" se näkyvä merkki, jota
   tarkoitit?

### Decisions for later review

- **Akselina on se, kuka joustaa, eikä käyrän muoto.** Kokeilin pehmeitä
  käyriä omana suuntanaan. Rivit olivat 720–1080 px:ssä täsmälleen samat
  kuin kulmilla, ja vain paikkojen kasvukohta siirtyi. Muoto on
  Rajat-laatikossa.
- **Askel valitaan monotonisella ehdolla** (vaihe 3) eikä suurimmalla
  kokonaishyödyllä. Kokonaishyöty välkkyi askelten välillä 1158–1344 px:n
  matkalla. Ehto sanoo saman asian: yläosa kasvaa, kun kummankaan listan
  seuraava rivi ei ole pikseliä arvokkaampi.
- **Hiljaiset ei taitu itsestään A:ssa, B:ssä eikä C:ssä.** Sääntö antaa
  keskustelulistalle sen tilan, ja loput vierivät sirujen kanssa.
  Automaattinen taitto olisi jättänyt annetun tilan tyhjäksi.
  Hiljaiset taittuu yhä painamalla, jolloin vapautuva tila menee
  Työtiloille.
- **Reunasirut maksavat tilansa.** Siru peittää reunarivin, joten lista,
  joka ei näytä kaikkea, saa sirun korkeuden lisää. Muuten "7 riviä"
  näkyisi kuutena.
- **Ylijäämä, joka on alle rivin, menee keskusteluille**, sitten
  Työtiloille ja muuten tyhjäksi alas. Vaihtoehtona olisi ollut jakaa se
  suhteessa, mutta puolikas rivi ei hyödytä kumpaakaan.
- **B:n Työtilojen lattia on 3 riviä**, kuten tuotannon 11rem. Ilman
  lattiaa Työtilat olisi 720 px:ssä kadonnut kokonaan.
- **C:n työtilan nimi**: Sinun vuorosi ja Käynnissä pitävät kuvakkeensa ja
  saavat lisäksi nimen (tuotannon `workspaceTag`). Ilman kuvakkeita
  tuotanto ryhmittelee rivit työtilaotsikoiden alle, mikä veisi rivejä.
  Hiljaisissa nimi korvaa kuvakkeen, koska `QuietSection` näyttää nimen
  vain ilman kuvakkeita. Toteutuksessa sama käsittely kaikille kuuluu
  yhdeksi propsiksi.
- **C:n suodatin on otsikkorivillä vain yli 12 työtilalla**, kuten
  suodatin ylipäätään (kierros 1, A).
- **Liukusäädin alkaa 600 px:stä.** Sen alla tuotanto vierittää koko
  sivupalkkia, eikä jakoa tehdä.
- **Leveys 356 px** on 296 px × 1,2. Kokeilin vain tätä yhtä leveyttä.
