# Keskustelukäyttöliittymän v0.1-toimituksen vastaanotto

Päivitetty 2026-09-20. Tämä on toimituksen vastaanotto ja alustava projektisovitus,
ei vielä Jarin hyväksyntä toteutuskohteeksi.

## Vastaanotettu aineisto

- Lähde vastaanotettaessa: Hauiksen `/Users/maintainer/Downloads/Suunnittelusuunta arviointiin.zip`
- Vastaanotetun zipin SHA-256: `a517af7bab5261a9e51c5c8df21da37d74c25fe9bb9816d74d4d232dd8f62744`
- Zipiä ei säilytetä repossa. Yhteiset tokenit ja komponentit on erotettu pysyvään [`../../design-system/`](../../design-system/)-hakemistoon.
- Toimituskohtainen aineisto: [`design/`](design/)
- Klikattava pääpolku: [`design/vedokset/Keskustelu paapolku.dc.html`](design/vedokset/Keskustelu%20paapolku.dc.html)
- Tilat: [`design/vedokset/Tilat B1-B12.dc.html`](design/vedokset/Tilat%20B1-B12.dc.html) ja [`design/vedokset/Tilat B5.dc.html`](design/vedokset/Tilat%20B5.dc.html)
- Ilme: [`design/vedokset/Ilme-maaritys.dc.html`](design/vedokset/Ilme-maaritys.dc.html)

Toimitus sisältää B1–B10-, B12- ja B5a–B5f-tilat, klikattavan simulaation,
vaalean ja tumman teeman, tokenit, 12 JSX-komponenttia sekä niiden tyyppi- ja
ohjetiedostot. B11 on rajattu sovitusti pois. Vastaanoton jälkeen yhteinen design
system ja tämän kierroksen näkymäkohtainen aineisto erotettiin omiin paikkoihinsa.

## Suositus

Otetaan visuaalinen suunta ja tokenit paketin 1 lähtökohdaksi. Rauhallinen
vaalea pinta, hillitty sinivihreä korostus, yksi luettava keskustelupalsta,
konekielisen sisällön monospace ja tiiviit työkalurivit sopivat tuotteeseen.
Työkaluryhmät, virheen näkyminen suljetussa ryhmässä, unified diff ja rehelliset
tuntematon/vain luku/katkos -tilat ovat käyttökelpoinen v1-pohja.

JSX-tiedostot käsitellään tässä vaiheessa suunnittelureferenssinä, ei valmiina
tuotantokomponenttikirjastona. Tuotantototeutus valitaan vasta sovelluksen stackin
ja Pi-adapterikokeen yhteydessä.

## Ennen toteutuskohteen hyväksymistä ratkaistavat asiat

1. **Viestijono ja kesken vuoron ohjaus eivät kuulu sovittuun v1:een.** Vedos lisää
   molemmat näkyvästi. Ne pidetään ehdotuksina, kunnes Pi:n todellinen rajapinta on
   kokeiltu ja Jari päättää niiden asemasta. Perus-v1:n pitää toimia ilman niitä.
2. **Mobiili puuttuu.** Alkuperäinen toimeksianto pyysi mobiilivedokset, mutta
   toimitus kirjaa työpöytä-ensin-päätöksen. Paketin 1 päivitys noudattaa nyt
   työpöytä-ensin-linjaa; tämä täytyy vielä hyväksyä osana UI-katselmointia.
3. **Komponentit eivät vielä täytä omaa saavutettavuusohjettaan.** Avattavat rivit
   ovat klikattavia `div`-elementtejä ilman näppäimistöroolia, yläpalkin lisätiedot
   näkyvät vain hoverilla ja inline-tyylit eivät toteuta yhteistä hover-/focus-
   käytöstä. Tuotantokomponenteissa käytetään semanttisia kontrolleja, näkyvää
   näppäimistöfokusta ja tarvittaessa aina näkyvää poikkeustilaa.
4. **Vedokset tarvitsevat verkkoa.** Fontit tulevat Google Fontsista ja `.dc.html`-
   vedosten tuki lataa Reactin ja Babelin unpkg:stä. Tämä sopii arviointiin, mutta
   tuotantokäyttö, CSP, offline-käyttö ja riippuvuksien lukitus ratkaistaan erikseen.
5. **Uudet tuotekäytökset eivät ole vielä päätöksiä.** Automaattisesti generoitu ja
   vuoromäärillä päivittyvä otsikko, kaksois-Escape sekä harnessin täydellinen
   piilottaminen ovat ehdotuksia. Agenttilistassa harness pitää edelleen erottaa,
   jos useita harnesseja myöhemmin tuetaan.
6. **Esimerkkikomponentin nimet eivät saa kovakoodautua.** `Message.jsx` käyttää
   nimiä Jari ja Pi. Tuotannossa puhujatunniste tulee roolista ja adapterin tiedosta.

## Paketin 1 sovitus

Palvelin-, workspace- ja agenttinäkymien toimeksianto päivitetään käyttämään tämän
toimituksen token-, tila- ja komponenttikieltä. Päivitetty luovutuspaketti sisältää
myös design systemin ja keskusteluvedokset viitteenä, jotta navigointi suunnitellaan
samaan sovelluskehykseen eikä rinnakkaiseksi tuotteeksi.

Paketin 1 suunnittelija ei saa tulkita keskusteluvedoksen jonoa, steeringiä,
automaattista otsikointia tai muita tässä listattuja avoimia ehdotuksia hyväksytyiksi
backend-vaatimuksiksi.
