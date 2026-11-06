# Integraatioiden tasot – kierros 2

Issue `proto-integration-levels`. Riffaa kierroksen 1 Ruudukkoa
(`../2026-11-06-integraatiotasot/`) Jarin 6.11. päätöksen mukaan: kohdat,
joissa ei ole oikeutta, olivat epäselviä, ja neljä täyttä ruudukkoa
ylläpitäjän listassa tekivät näkymästä tukkoisen. Samat kolme näkymää kuin
kierroksella 1 (ylläpitäjän Palvelinintegraatiot, henkilön tason valinta,
henkilön tilikortti), samat tuotannon palaset (`ServerIntegrations.css`,
`Integrations.css`, `Settings.css`, `ControlButton`, `Segmented`,
`StatusMark`, `ProviderMark`, React Arian `Modal`/`RadioGroup`). Palvelin,
tilit ja osoitteet ovat synteettisiä.

## Akseli ja riffit

Akseli: missä ja missä muodossa tason oikeudet näytetään.

1. **Vertailutaulukko**: tasot rinnakkain sarakkeina ja oikeudet riveinä, jokaisessa solussa ✓ Kyllä tai ✕ Ei; ylläpitäjän tasorivit ovat yhden rivin mittaisia.
2. **Avautuva ruudukko**: tasot ovat yhden rivin mittaisia, ja tason ruudukko avautuu rivin alle yksi kerrallaan.
3. **Erillinen ikkuna**: listat pysyvät tiiviinä, ja ruudukko avautuu omaan ikkunaansa, jossa tasoa vaihtamalla näkee, mitkä solut muuttuvat.

Suositus: **Vertailutaulukko**.

## Ero kierrokseen 1, kaikissa riffeissä

- Solu ilman oikeutta on ✕ ja kieltomuoto: ”Ei lähetä”, ”Ei muokkaa eikä
  lähetä kutsuja”, ”Ei muokkaa eikä jaa”. Kierroksella 1 solussa luki sama
  teksti kuin sallitussa, vain harmaana ja vinoviivalla. Sallittu solu on
  vihertävällä pohjalla, lihavoitu ja ✓. Ero on sanassa ja merkissä, ei vain
  värissä.
- Yhdistettyjen solujen vinoviivoitus on poistettu: se näytti
  käytöstä poistetulta. Kahden sarakkeen solu kertoo varoitusrivillä, mitä
  palvelu ei anna estää (”Osallistujat saavat aina kutsun”).
- Ruudukon alla on selite: ✓ sallittu, ✕ ei sallittu, kahden sarakkeen solu.
- Tasot ovat kierroksen 1 Neljä tasoa -joukko (Microsoft: Täysi, Kaikki
  paitsi postin lähetys, Luonnokset muu vain luku, Vain luku; Google: ilman
  luonnostasoa; Dropbox: Koko, Kaikki paitsi jakaminen, Sovelluskansio,
  Vain luku). Henkilö valitsee tason, ei soluja: Microsoftilla jokainen
  yhdistelmä on silti oma sovelluksensa.
- Palveluiden tekniset rajat ovat kierroksen 1 result.md:n mukaiset.

## Vuorovaikutukset

- Vertailutaulukko: henkilö valitsee tason sarakkeen otsikosta; sarake
  rajataan, ja tunnuksettoman tason otsikko on pois käytöstä (”Ei käytössä”).
  Tilikortti näyttää oman tason sarakkeen.
- Avautuva ruudukko: ylläpitäjän listassa Näytä oikeudet / Piilota oikeudet,
  yksi auki kerrallaan; alussa auki ensimmäinen taso ilman tunnuksia.
  Henkilön valinnassa valitun kortin ruudukko avautuu korttiin.
- Erillinen ikkuna: Mitä taso sallii / Vertaa tasoja ruudukkona avaa
  ikkunan, jonka tasovalitsin vaihtaa ruudukon. Ylläpitäjän ikkunassa on
  Aseta tunnukset…, henkilön ikkunassa Valitse tämä taso.
- Aseta tunnukset… näyttää tason ruudukon ennen tunnuksia kaikissa
  riffeissä. Palauta alkutila palauttaa alun (Microsoftin Täysi ja Vain luku
  asetettu).

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-integraatiotasot-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-integraatiotasot-2/check.mjs \
  design-system/prototypes/dist/integraatiotasot-2/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen riffin läpi 1440 ja 390 px:n levyisenä, vaaleana ja
tummana, tarkistaa että jokainen solu ilman oikeutta alkaa sanalla ”Ei”, ettei
ylläpitäjän listassa ole pinottuja ruudukkoja, asettaa puuttuvat tunnukset,
valitsee tason kaikille kolmelle palvelulle, tarkistaa tilikortin, ottaa
kuvat kertoimella 2 nimillä `r2-d<riffi>-<näkymä>-<leveys>-<teema>` ja vaatii
konsolin puhtaaksi (552 tarkistuspistettä).
