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

# Kierros 2: siru kentän luona

Kierros: `design-system/prototypes/rounds/2026-11-08-keskustelun-aineisto-2/`
(`NOTES.md` kertoo sivun, suunnat ja tarkistuksen). Akseli on se, miten
kierroksen 1 Siru elää kentän yllä olevassa taustatyön palkissa
Workerit-sirun vieressä. Lista ja sen rivit ovat kierrokselta 1
sellaisinaan. Keskustelu on sama, ja lopuksi agentti käynnistää kaksi
workeria. Lista avautuu kaikissa suunnissa Workerit-paneelin paikkaan
kentän yllä, ja rivin painallus avaa kohteen tarjouskortin paikkaan
(`proto-offer-cards-consistent` kierros 2): oletuksena oikeaan paneeliin.
Arviointipalkin *Kohde avautuu: ikkunaan* näyttää saman ikkunana
keskustelun päällä.

- **Nyt**: tuotanto tänään. Kentän yllä on vain Workerit-siru; yläpalkin tiedostopainike avaa Tiedostot-paneelin, näkymillä ei ole listaa.
- **1 Oma siru**: Workerit-sirun vieressä on oma siru, jossa näkymien ja tiedostojen määrät; se avaa listan kenttää kohti samaan paikkaan kuin Workerit-paneeli.
- **2 Yhteinen**: workerit ja aineisto ovat yhdessä sirussa; sen paneelissa on välilehdet Workerit ja Näkymät ja tiedostot.
- **3 Kasvava**: pieni siru pelkin merkein; kun agentti tarjoaa uuden, siru kasvaa ja näyttää sen nimen hetken, sitten jää pisteeksi kunnes katsot.

Kuvat: `evidence/r2-<suunta>-<vaihe>-<leveys>-<teema>.avif`. Vaiheet ovat
`0-oletus` (lista kiinni), `0-lahi` (palkki lähikuvana), `0-pieni`
(Kasvava kutistuneena, piste jäljellä), `1-lista`, `1-workerit` (Yhteisen
toinen välilehti), `2-viereen` (CSV listasta oikeaan paneeliin; Nyt:
näkymä kortista) ja `3-ikkunaan` (uusin näkymä listasta ikkunaan).

## Host-tiedot

Kierroksen 1 tiedot pätevät: lista ei tarvitse uutta tallennetta.
Näkymät tulevat `GET /api/v1/views` -listasta keskustelun
`conversation_id`:llä, tiedostot samasta tarjouslistasta, jota
Tiedostot-paneeli käyttää. Palkki näyttää aineistosirun silloinkin, kun
taustatyötä ei ole; tuotannon `BackgroundStrip` piiloutuu silloin
kokonaan, joten sirun paikka on palkin rivi, ei `BackgroundStrip`in sisus.
Kasvavan "uusi" on selaimen havainto: uusi kortti saapuu keskustelun
tapahtumana, ja katsomatta-piste on selaimen tilaa, ei hostin. Toisella
laitteella piste ei näy, eikä sen pidäkään vaatia hostilta uutta
luettu-tietoa. Tarinassa ei ole nimettyjä avustajia; Yhteisessä ne olisivat
kolmas välilehti samaan tapaan.

## Suositus

**1 Oma siru.** Se pitää Workerit-sirun juuri sellaisena kuin se on, myös
odotuspisteet, joista näkee yhdellä silmäyksellä, odottaako agentti
workeria. Määrät kertovat ilman painallusta, mitä keskustelussa on, ja lista
avautuu samaan paikkaan kuin Workerit-paneeli. Yhteinen säästää yhden sirun
mutta vaihtaa workerien pisteet luvuksi ja lisää workereihin yhden
välilehtiaskeleen, juuri silloin kun worker tarvitsee huomiota. Kasvava
kertoo parhaiten, että jotain uutta tuli, mutta levossa siitä ei näe
määriä, ja kasvu jää huomaamatta, jos ei katso juuri silloin. Sen
saapumiskorostuksen voi lisätä Omaan siruun myöhemmin, jos uuden kohteen
huomaaminen osoittautuu ongelmaksi.

## Kysymykset Jarille

1. Mikä siru: Oma siru (`r2-1-oma-0-lahi-1440-light`), Yhteinen
   (`r2-2-yhteinen-1-lista-1440-light`) vai Kasvava
   (`r2-3-kasvava-0-lahi-1440-light`)?
2. Kasvaako siru hetkeksi, kun uusi kohde tulee
   (`r2-3-kasvava-0-oletus-1440-light`), vaikka valinta olisi Oma siru?
3. Kun yläpalkin tiedostopainike poistuu, riittääkö palkin siru ainoaksi
   reitiksi tiedostoihin (`r2-1-oma-0-oletus-390-light` vs.
   `r2-0-nyt-0-oletus-390-light`)?

## Ympäristö ja näyttö

Rakennettu tuotannon komponenteista tämän worktreen puusta (pohja
`6db68460b`), Playwright Chromium headless, 1440 × 900 ja 390 × 844
(kosketus), DPR 2, vaalea ja tumma. `check.mjs`: 356 tarkistuspistettä,
konsoli puhdas.

```
node design-system/prototypes/rounds/2026-11-08-keskustelun-aineisto-2/build.mjs
open-habitat agent view offer --current --source design-system/prototypes/dist/keskustelun-aineisto-2/offline.html --title "Keskustelun näkymät ja tiedostot · kierros 2" --idempotency-key c55ed8a7-bb72-44b7-8973-35c8cb861ec6 --json
```
