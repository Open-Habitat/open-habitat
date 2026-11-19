# Verkkosivun etusivu, kierros 2 – mitä kuvan jälkeen (19.11.2026)

Riff kierroksesta `2026-11-19-verkkosivun-etusivu`. Jari valitsi sieltä
yläosaksi "Kuva edellä" -suunnan (keskitetty otsikko, lyhyt tagline, kaksi
toimintoa, iso tuotekuva), pyysi korjaamaan kuvan keskityksen ja halusi
kolmannen suunnan päivätarinan sivulle myöhemmäksi yhden käyttäjän
ensimmäisenä päivänä. Tämä kierros pitää yläosan samana kaikissa kolmessa ja
tutkii sivun loppua. Valitsin on `/prototype`-taidon kelluva valitsin
(`../../lib/picker.css`, `picker.js` sanatarkasti); suunnan suomenkielinen
kuvausrivi on sivun yläpuolella vierittyvänä kehyksenä ja valitsimen
napin `title`-vihjeenä.

**Kuvan keskitys.** Kierroksen 1 kuva nojasi vasemmalle kahdesta syystä:
`.pg figure { margin: 0 }` voitti kuvan `margin: auto`n, ja kaappauksen oma
kangas on epäsymmetrinen (taustaa vasemmalla 78 px, oikealla 67, alla vain
11, jolloin puhelimen varjo katkeaa reunaan). `build.mjs` leikkaa vasemmalta
11 px ja jatkaa alareunaa nauhalla, joka häivyttää viimeisen rivin taustaan,
joten sisältö on kankaan keskellä. Kuva on koko leveyden nauhalla, jonka väri
on kaappauksen oma tausta, joten kankaan reunaa ei näy, ja kuva on nauhassa
keskellä. `check.mjs` vaatii kuvan keskikohdan ja otsikon keskikohdan
osuvan näkymän keskelle pikselin tarkkuudella ja kuvan olevan kokonainen.

1. **Alicen päivä.** Akseli: yksi tarina kantaa sivun. Kahdeksan lukua
   kellonaikoineen (08:58 kirjautuminen – 16:50 varauspalvelu), ja oikealla
   tahmea ruutu, jonka kuva, kello ja edistymispalkki vaihtuvat luvun mukaan.
   Jokaisessa luvussa on "Underneath"-rivi, joka kertoo, mitä palvelimella
   tapahtuu (oma Linux-tili, agentti toimii Alicena, worktreet). Sitten
   "mitä Alicen ei tarvinnut miettiä", asennus ("hänen päivänsä alkoi yhdestä
   linkistä koodausagentille") ja rajat. Puhelimessa kuva on luvun alla.
2. **Kysymykset.** Akseli: lukijan kysymykset järjestyksessä. Yhdeksän
   kysymystä tahmean sisällysluettelon kanssa; lyhyt lihavoitu vastaus ensin,
   kuva todisteena. Ensimmäinen päivä on kysymys 3 ja kerrotaan
   filminauhana (kahdeksan ruutua sivuttain, nuolinapit). Rajat ovat osa
   vastauksia ("Can people see each other’s work?" sanoo samassa kohdassa,
   mitä erottelu ei tee).
3. **Tutki itse.** Akseli: lyhyt sivu, jota käytetään käsin. Ensimmäinen päivä
   heti kuvan jälkeen neljänä askeleena, sitten "Ask it something":
   kuuden pyynnön valikko (tablist, nuolinäppäimet eivät käännä valitsinta),
   joka vaihtaa ison kuvan; kolme faktaa, asennus yhtenä kopioitavana viestinä
   ja rajat kortteina. Noin puolet muiden pituudesta.

Kaikissa: sama yläosa, asennus antamalla oppaan linkki koodausagentille
(kopiointipainike, käsin-asennus avattavana), julkaisulinja 0.1, agentti
toimii omistajanaan, root on root, ylläpitäjä tarvitaan, sivu ei lataa
mitään muualta. Muita tuotteita ei nimetä tekstissä; kuvakaappausten omat
tekstit ovat README:n kuvia sellaisinaan. Ihmiset ovat kaappausten
synteettisiä (Example Studio, Alice).

## Rakentaminen ja tarkistus

```
TMPDIR=<oma scratch> node design-system/prototypes/rounds/2026-11-19-etusivu-kierros-2/build.mjs <out.html>
PROTO_WEB=<web-hakemisto, jossa node_modules> \
  node design-system/prototypes/rounds/2026-11-19-etusivu-kierros-2/check.mjs <out.html> <kuvahakemisto>
```

`build.mjs` tarvitsee ImageMagickin (`convert`, `identify`); tulos on noin
1,4 Mt. `check.mjs`:n tarkistukset on lueteltu sen alussa.
