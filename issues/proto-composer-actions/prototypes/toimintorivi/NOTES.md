# Kirjoituskentän toimintorivi — opas

Avaa `index.html` selaimessa (toimii ilman verkkoa). Alhaalla oleva valitsin
vaihtaa suuntaa (1–4 tai ← →), yläpalkki tilaa:

- **Agentti: Levossa / Työssä.** Vaihda edestakaisin ja katso, liikkuuko
  mikään. *▶ Vuorottele* vaihtaa tilaa itsestään 1,4 sekunnin välein.
- **Haamut: Toisen tilan paikat.** Toisen tilan painikkeet piirretään
  katkoviivoina samaan riviin. Jos viiva ei osu painikkeeseen, painike
  hyppää tilanvaihdossa. *Nyt*-versiossa Sanelen ja Lähetän haamut osuvat
  ohi, suunnissa kaikki osuvat.
- **Kenttä: Tyhjä / Tekstiä.** Voit myös kirjoittaa kenttään. Enter
  lähettää, Alt/⌥+Enter lähettää toisella tavalla ja Esc pysäyttää agentin.
- **Teema** ja **Leveys** (työpöytä / puhelin). Puhelimessa kannattaa
  kokeilla myös kapeaa näyttöä: lisää osoitteeseen `&pw=360`.

Tilasiru vaihtaa Ohjaa ↔ Työn jälkeen. Liitä, Komennot, Tiedosto ja +
avaavat synteettisen valikon. Sanelu ei käynnisty, vaan painike kertoo,
mitä tapahtuisi.

## Mitä tuotannossa nyt tapahtuu (*Nyt*)

- **Sanele hyppää**, koska Ohjaa-siru ja Stop lisätään työn ajaksi sen ja
  Lähetän väliin. Työpöydällä hyppy on noin 130 px, ja se toistuu, kun
  vaihdat Ohjaa ↔ Työn jälkeen, koska sanat ovat eri pituisia.
  Puhelimessa työtila piilottaa lisäksi kaikkien apupainikkeiden tekstit,
  joten koko rivi järjestyy uudelleen.
- **Liitä on täytetty**, koska se on ainoa rivin painike, joka on tehty
  yhteisellä painikekomponentilla. Sen sääntö antaa tekstillisille
  painikkeille aina vaalean pinnan. Muut rivin painikkeet ovat rivin
  omia, ja niillä pinta näkyy vain hiiren ollessa päällä. Ero ei siis johdu
  hoverista eikä fokuksesta.
- Puhelimella löytyi kaksi sivuvikaa. Apupainikkeiden ja sirun
  36 px:n kosketuskoko ei toteudu, vaan ne jäävät 28 px:iin. Lisäksi
  levossa 390 px:n rivi on niin täynnä, että Sanele piirtyy osittain
  Lähetän alle.

## Suunnat

1. **Ankkuroitu**: järjestys pysyy entisellään, mutta oikea reuna on
   ankkuroitu. Sanele ja Lähetä eivät liiku. Ohjaa ja Stop syntyvät
   tyhjään väliin ohuen viivan vasemmalle puolelle. Kaikki apupainikkeet
   ovat samannäköisiä.
   *Hinta:* Stop ei ole enää Lähetän vieressä.
2. **Roolit**: vasemmalla on kaikki, millä viesti tehdään (Liitä, Komennot,
   Tiedosto, **Sanele**), ja oikealla se, miten viesti lähtee (Ohjaa, Stop,
   Lähetä). Lähetä on rivin ainoa täytetty painike, ja Stop on
   ääriviivallinen. Ohjaa saa kevyen korostusvärin, joten se erottuu työn
   aikana entistä selvemmin.
   *Hinta:* työpöydällä Sanele on kaukana Lähetästä, ja Stop on nykyistä
   kevyempi.
3. **Yksi painike**: Liitä, Komennot ja Tiedosto ovat yhdessä +-valikossa.
   Oikean reunan pyöreä painike on levossa Lähetä, työn aikana tyhjällä
   kentällä Stop ja tekstin kanssa taas Lähetä.
   *Hinta:* kun kentässä on tekstiä, Stopia ei voi napauttaa, vaan
   agentti pysähtyy vain Escillä. Apupainikkeet näkyvät vasta valikon
   takaa.

## Suositus

**Roolit.** Siinä rivi luetaan merkityksen mukaan, ja painoarvo seuraa
sitä: yksi päätoiminto (Lähetä), yksi erottuva tila (Ohjaa) ja muut hiljaa.
Mikään nykyinen ei katoa eikä piiloudu, eikä mikään liiku. Arvioi erityisesti,
riittääkö ääriviivallinen Stop vai pitäisikö sen olla täytetty kuten nyt.

Tehdyt valinnat, jotka odottavat arviotasi (esimerkiksi puhelimen
pelkät kuvakkeet molemmissa tiloissa ja sirun vaihtonuolen puuttuminen
puhelimessa), ovat issuen `result.md`-tiedostossa.
