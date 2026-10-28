# Kansiotarjouksen tiedostot: rivin omat toiminnot

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, joka on koottu
prototyyppikirjastosta käsin kirjoitetulla koodilla. Tuotantokomponenttien
bundlea siinä ei ole. Rakennus ja tarkistus tehdään komennolla
`node design-system/prototypes/rounds/2026-10-28-kansion-tiedostorivit/verify.mjs`
(Playwright `web/node_modules`ista). Kuvat ovat `evidence/`-hakemistossa
laitteen skaalauksella 2.

## Mistä lähdetään

Tuotannossa **Näytä tiedostot** avaa paneelin, valitsee tarjouksen ensimmäisen
tiedoston ja näyttää siitä yläreunassa ison esikatselun, tiedot ja painikkeet.
Rivin painaminen vain vaihtaa valintaa, joten lataaminen ja esikatselu vaativat
aina kaksi askelta, ja iso kuva vie puolet paneelista. Tässä prototyypissä
yläreunan esikatselua ei ole missään suunnassa. Rivien pikkukuvat jäävät, ja
jokainen rivi saa omat toimintonsa.

## Kokeile näin

1. Sivu aukeaa siihen tilaan, johon kortin **Näytä tiedostot** jättää:
   paneeli auki ja uusin tarjous (*Kevätjuhlan aineisto*, 54 tiedostoa)
   ylimpänä.
2. Vie osoitin rivin päälle, paina riviä ja kokeile rivin painikkeita.
   Kokeile myös näppäimistöllä: Tab kulkee rivistä sen painikkeisiin.
3. Avaa `kuvat/` → `juhla/` → `valitut/`. Alikansiot ovat aluksi kiinni,
   ylimmät kansiot auki.
4. Kokeile tiedostoja, joilla on eri esikatselu: `ohjelma.pdf`,
   `osallistujat.csv`, `LUE-MINUT.md`, `tervehdys-rehtorilta.mp4` ja
   `logo.svg`. `juliste-painoon.indd` on tiedosto, jota selain ei osaa näyttää,
   joten sillä ei ole esikatselupainiketta.
5. Hae `ryhmakuva`. Haku on kaikista tarjouksista, ja osuman alla näkyy sen
   kansio.
6. Esc sulkee ensin esikatselun ja sitten paneelin. Yläpalkin
   tiedostopainike (55) ja kortin **Näytä tiedostot** avaavat paneelin
   uudelleen.
7. Valitse sivun yläreunasta **Puhelin**. Silloin paneeli peittää keskustelun
   kuten tuotannossa, ja kosketuksella ei ole hover-tilaa.

## Sama kaikissa suunnissa

- Yläreunan iso esikatselu ja "valittu tiedosto" poistuvat.
- Esikatselu avautuu samaan dialogiin kuin nyt (`AttachmentPreview`).
  Dialogissa on tiedoston kansio, tiedot ja **Lataa**.
- Kansiot ovat sisäkkäin. Tuotannossa `kuvat/juhla/valitut/` on oma
  litteä ryhmänsä.
- Tarjouksen otsikkorivillä on edelleen **.zip**, joka lataa koko tarjouksen.
- Kortti keskustelussa on tuotannon kortti sellaisenaan.

## Suunnat (akseli: missä ja milloin rivin toiminnot näkyvät)

1. **Leijuva.** Rivi on yksirivinen kuten nyt. Rivin painaminen avaa
   esikatselun. Kun osoitin tai fokus on rivillä, koon paikalle tulevat
   **Esikatsele** (silmä) ja **Lataa**. Puhelimessa ja muilla
   kosketuslaitteilla painikkeet ovat aina näkyvissä, ja koko siirtyy nimen
   alle.
2. **Näkyvä.** Jokaisella rivillä on aina kaksi riviä tekstiä (nimi sekä
   tyyppi, mitat ja koko) ja kaksi painiketta. Rivi itse ei tee mitään.
   Kaikki on näkyvissä ilman osoitinta, mutta työpöydällä lista on noin viidenneksen
   pidempi.
3. **Avautuva.** Rivi näyttää vain nimen ja koon. Painettu rivi aukeaa
   paikallaan: tiedot, kansio ja nimetyt painikkeet (**Lataa**,
   **Näytä isona** / **Lue** / **Näytä taulukko** …). Kerrallaan on auki
   yksi rivi. Rivi on rauhallinen, mutta tiedosto vaatii aina kaksi painallusta.

## Mitä katsoa

- Löytyvätkö toiminnot Leijuvasta ilman ohjetta, vai jääkö lataus huomaamatta,
  kun painikkeet eivät näy ennen kuin osoitin on rivillä?
- Onko Näkyvän kahden rivin tieto hyödyllistä vai pelkkää kohinaa, kun
  tiedostoja on 54?
- Tuntuuko Avautuvan kaksi askelta raskaalta, kun haluat vain ladata yhden
  kuvan?

Kuvat: `1-leijuva-*`, `2-nakyva-*`, `3-avautuva-*` (työpöytä/puhelin,
vaalea/tumma). Lisäksi `-osoitin` (Leijuva hoverissa), `-rivi-auki`
(Avautuva), `-alikansiot`, `-haku`, `-esikatselu` ja `0-keskustelu-*`
(paneeli kiinni).
