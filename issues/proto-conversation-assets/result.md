# Kierros 1: missä keskustelun näkymät ja tiedostot ovat listana

Kierros: `design-system/prototypes/rounds/2026-11-08-keskustelun-aineisto/`
(`NOTES.md` kertoo sivun, suunnat ja tarkistuksen). Akseli on listan
paikka. Sisältö on kaikissa sama: kuusi näkymätarjousta (kolme raporttia,
saman raportin versiot yhdellä rivillä) ja neljä tiedostotarjousta, uusin
ylimpänä. Rivin painallus avaa kohteen ilman kelaamista, ja puhekupla
*Näytä keskustelussa* vierittää kortin näkyviin.

- **Nyt**: tuotanto tänään. Kortit vain keskustelussa; yläpalkin tiedostopainike avaa Tiedostot-paneelin, jossa on vain tiedostot. Näkymillä ei ole listaa.
- **1 Siru**: yläpalkin siru näyttää näkymien ja tiedostojen määrän ja avaa sen alle listan, uusin ylimpänä; saman raportin versiot yhdellä rivillä.
- **2 Paneeli**: oikean reunan tiedostopaneeli on Näkymät ja tiedostot: näkymät ylimpänä, tiedostot tuotannon riveinä alla; näkymä avautuu samaan paneeliin.
- **3 Sivupalkki**: keskustelun rivin alla sivupalkissa on sen näkymät ja tiedostot, uusimmat neljä ja loput yhden painalluksen takana.

Kuvat: `evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`. Vaiheet ovat
`0-oletus` (lista auki), `0-lahi` (yläpalkin painike), `1-versiot`,
`2-nakyma` (ensimmäinen versio avattuna; Nyt: kortista ylös kelaamalla) ja
`3-loyda` (kortti löydettynä keskustelusta).

## Nykytila

Tuotannossa näkymäkortilla ei ole muuta paikkaa kuin keskustelu.
Tiedostoilla on yläpalkin `▯ 8` -painike (puhelimessa `…`-valikossa), joka
avaa oikean reunan Tiedostot-paneelin; samaan paneeliin avautuu myös
näkymä, mutta vain kortin Avaa-painikkeesta. Saman raportin kolme versiota
ovat kolme erillistä korttia eri kohdissa keskustelua.

## Host-tiedot

Lista ei tarvitse uutta tallennetta. Näkymät tulevat nykyisestä
`GET /api/v1/views` -listasta (henkilön kaikki näkymät), josta valitaan ne,
joiden `conversation_id` on tämä keskustelu; `title`, `entry` ja
`created_at` riittävät riviin. Tiedostot tulevat samasta keskustelun
tarjouslistasta, jota Tiedostot-paneeli jo käyttää. Versiot tunnistetaan
samasta `entry`-polusta. Se ei ryhmittele 7.11. tapausta, jossa agentti
vei tumman version eri tiedostoon (`reports/kirjastot-tumma.html`); siihen
tarvittaisiin agentin oma merkintä tarjouksessa tai ohje viedä uusi versio
samaan polkuun. *Näytä keskustelussa* löytää kortin vain, jos se on
ladatussa historiassa; vanhan kortin kohdalla toteutuksen pitää ladata
historiaa taaksepäin (prototyypissä koko keskustelu on ladattu).

## Suositus

**2 Paneeli.** Se laajentaa paikkaa, joka on jo olemassa: tiedostot ovat
siellä nyt, ja näkymä avautuu jo samaan paneeliin, joten lista, avattu
näkymä ja paluu listaan pysyvät yhdessä paikassa. Siru on kevyempi, mutta
se on toinen tapa näyttää samat tiedostot, ja ponnahdus sulkeutuu aina
kun jotain avataan. Sivupalkki näyttää vain valitun keskustelun kohteet,
pidentää sivupalkkia juuri siellä, missä keskustelut ovat, ja on
puhelimessa valikon takana. Paneelin tiedostoriveiltä puuttuu vielä
*Näytä keskustelussa*; jos suunta valitaan, se lisätään tarjouksen
otsikkoriville.

## Kysymykset Jarille

1. Mikä paikka: siru (`r1-1-siru-0-oletus-1440-light`), paneeli
   (`r1-2-paneeli-0-oletus-1440-light`) vai sivupalkki
   (`r1-3-sivupalkki-0-oletus-1440-light`)?
2. Riittääkö versioille yksi rivi, jossa on uusin ja *3 versiota* -siru
   (`r1-2-paneeli-1-versiot-1440-light`), vai pitääkö jokaisen version olla
   listassa omana rivinään?
3. Tarvitaanko puhekuplaa *Näytä keskustelussa*
   (`r1-1-siru-3-loyda-1440-light`), vai riittää, että rivi avaa kohteen?

## Ympäristö ja näyttö

Rakennettu tuotannon komponenteista tämän worktreen puusta (pohja
`13a310340`), Playwright Chromium headless, 1440 × 900 ja 390 × 844
(kosketus), DPR 2, vaalea ja tumma. `check.mjs`: 248 tarkistuspistettä,
konsoli puhdas.

```
node design-system/prototypes/rounds/2026-11-08-keskustelun-aineisto/build.mjs
open-habitat agent view offer --current --source design-system/prototypes/dist/keskustelun-aineisto/offline.html --title "Keskustelun näkymät ja tiedostot · kierros 1" --idempotency-key df7a771e-afd6-4ed7-b9ac-bb25c291108b --json
```
