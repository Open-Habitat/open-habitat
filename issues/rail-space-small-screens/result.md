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
