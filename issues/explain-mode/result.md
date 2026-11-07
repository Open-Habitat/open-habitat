# Tulos: selitystila (kokeellinen)

Selitystila on toteutettu kokeellisena ominaisuutena (Kokeelliset
ominaisuudet › Selitystila, oletuksena pois) `proto-explain-mode-r6`:n
kierrosten 6–9 mukaan: tyyli 1, ei kiinnitystä, painallus toimii kuten aina
ja pysyvät teot odottavat, riffi 1 *Kuten aina* (piilopainikkeet heräävät ja
selittyvät, tyhjän kohdan yllä viimeisin kortti jää hiljaisena), kohta
selittyy vain näkyvän sisältönsä päällä, tila alkaa tilakortista ja palkin
tilanne (suunta C) tuo tilakortin takaisin. Selitä (?) lopettaa tilan.
Puhelimen palkissa on pelkkä tila.

## Mistä tila alkaa

- Keskustelun yläpalkin **?** (Selitä); toinen painallus lopettaa.
- **Tilivalikko › Selitä tämä näkymä** jokaisessa näkymässä.
- Puhelimella myös **⋯ › Selitä tämä näkymä**.
- Uuden keskustelun aloitussivun nauha **Mitä näytöllä on? · Selitä nämä
  mulle**, kunnes sen sulkee.

Tila päättyy Esc:llä, palkin Lopeta-painikkeella tai ?:lla.

## Mistä tekstit tulevat

Kaikki 179 korttia, kuuden tilanteen tilakortit ja tilan omat tekstit ovat
yhdessä katalogissa `web/src/text/explainMode.ts` suomeksi ja englanniksi
(kierroksen 6 `cards.mjs`, kierroksen 8 muutokset X01, X02 ja S02 sekä
kierroksen 9 suunnan C X05). Katalogin alussa on korttien tyyliohje.
`web/src/components/explainParts.ts` kertoo jokaisen kortin kohdan
(testitunniste tai luokka), lajin ja pikanäppäimen. Agentin
`open-habitat-ui`-viite kootaan katalogeista, ja
`scripts/generate-ui-reference.py` ottaa nyt mukaan myös
`explainParts.ts`:n, joten agentti ja selitystila lukevat samat tekstit ja
tietävät saman kohdan.

## Host-tiedot

- Uutta host-tietoa, daemonin tai sopimuksen muutosta ei ole. Ominaisuuden
  valinta kulkee olemassa olevan `account/preferences`-kokeiluvalinnan
  kautta (`explain-mode`).
- Tilakortin tilanne luetaan siitä, mitä näkymä jo näyttää: yläpalkin tila
  (`data-activity`, taustatyön merkki) ja viimeisin vuoro (epäonnistunut
  vastaus, vastaukseton pysäytetty vuoro, tyhjä keskustelu).
- Selitystilan kerros on `pointer-events: none`; kohta luetaan
  `elementsFromPoint`illa ja odottavat painallukset pysäytetään
  capture-vaiheessa (`pointerdown`/`pointerup`/`click` ja näppäimistön
  Enter/välilyönti).

## Tarkistukset

- `./scripts/test-focused.sh --area web`: 177 tiedostoa, 1335 testiä
  läpi (mukana uusi `ExplainMode.test.tsx`).
- `./scripts/test-focused.sh --area browser --spec lab-explain-mode.spec.ts
  --lab`: 3/3 läpi (työpöytä: tilakortti, osoitus, jäävä kortti, painallus
  toimii, Arkistoi odottaa, palkin tilanne, piilopainike, Esc ja ?;
  Tilivalikko ja nauha; puhelin: ⋯, ensimmäinen napautus selittää, toinen
  tekee, ×, palkin tilanne).
- `settings-experimental.spec.ts` (3/3) ja `settings-search.spec.ts` (5/5).
- Synteettinen labra, `OH_PORT_BASE=14100`, Birch.

## Kuvat

`evidence/` (AVIF, kerroin 2; HTML-kaksoset vaaleista pääkuvista),
kaapattu `web/lab/capture-explain-mode.mjs`:llä:

- `01-nauha-*`: aloitussivun nauha (1440/390, vaalea/tumma).
- `02-tilakortti-*`: tila alkaa tilakortista (1440/390, vaalea/tumma).
- `03-osoitus-kortti-1440-*`, `03-napautus-kortti-390-*`: osoitettu kohta;
  puhelimella kortissa on teko.
- `04-tyhja-kortti-jaa`, `05-painallus-toimii`, `06-arkistoi-odottaa`,
  `07-piilopainike`, `08-palkin-tilanne`, `09-tilivalikko` (avoimen valikon
  rivi selittyy valikon päällä), `10-etusivu`, `11-asetus` (1440, vaalea).

## Päätöksiä myöhempää katselmointia varten

1. **Ei ?-näppäintä.** Issue sanoi 1.11. "ei vielä pikanäppäintä", ja
   kierroksen 9 suunnan C X05-kortti ei mainitse sitä; kierroksen 7 riffi 2
   olisi tuonut ?-näppäimen. Näppäimen voi lisätä myöhemmin (tekstikentän
   ulkopuolella, `event.key === "?"`).
2. **Nauha näkyy jokaisella tyhjällä aloitussivulla, kunnes sen sulkee**, ja
   sulkeminen muistetaan tässä selaimessa (`nah:explain-strip-closed`).
   Vaihtoehdot: vain ensimmäisellä kerralla tai tilin asetuksena kaikilla
   laitteilla. Vihjeen sulkeminen ei ole tilin tietoa, joten uutta
   daemonin tallennetta ei tehty (sama kuin teeman valinta).
3. **Tilanne luetaan näkymästä**, ei host-faktoista. Näin tilakortti ei voi
   kertoa eri tarinaa kuin yläpalkin piste ja viimeisin vuoro. Vaihtoehto
   olisi keskustelukomponentin julkaisema tila; se olisi toinen paikka samalle
   päättelylle.
4. **Pysyvät teot odottavat myös näppäimistöllä ja Voit nyt -riveiltä:**
   Enter viestikentässä ei lähetä, ja Työskentelee-tilan rivi *Pysäytä…*
   näyttää ilmoituksen pysäyttämisen sijaan. Vaihtoehto: sallia rivin teko,
   koska se on harkittu valinta. Valitsin turvallisemman, koska rivi on
   samassa tilassa kuin muutkin kohdat.
5. **Kortin tunnusta (Y08 ym.) ei näytetä kortissa.** Prototyyppi näytti sen
   katselmointia varten; tunnukset ovat koodissa, joten niihin voi yhä
   viitata.
6. **Tumman teeman palkki** käyttää mustetokenia kuten prototyyppi, joten
   tummassa teemassa palkki on vaalea.
7. **Asetusten kortit** ovat asetusten navigaation riveillä (kierroksen 6
   valitsimet), yksi kortti asetussivua kohden.
8. **Ominaisuuden poiskytkentä lopettaa tilan** heti, jos se on päällä.
