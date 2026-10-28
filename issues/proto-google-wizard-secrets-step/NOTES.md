# Opas: asiakas ja tunnukset samassa vaiheessa

Tällä kierroksella poistetaan ohjeesta erillinen viimeinen Tunnukset-näyttö.
Kentät tulevat siihen vaiheeseen, jossa konsoli näyttää arvot. Kaikki
suunnat tekevät saman yhdistämisen. Ne eroavat siinä, miten ohje ja kentät
asettuvat samaan näyttöön.

## Avaaminen

Prototyyppi on yksi offline-tiedosto:
`issues/proto-google-wizard-secrets-step/prototype/index.html`. Avaa se
selaimessa, esimerkiksi `tw browser-open <polku>`. Alhaalla on valitsin:

- **1 Perään**: nykyinen OAuth-asiakas-vaihe sellaisenaan. Lopussa on viiva,
  otsikko *Google näyttää ikkunan OAuth client created* ja kentät.
- **2 Rinnakkain**: vasemmalla *Google Cloudissa* tehtävät asiat, oikealla
  harmaa *Tähän*-laatikko kenttineen. Työpöydällä ikkuna levenee tässä
  vaiheessa 920 pikseliin. Puhelimessa laatikko tulee ohjeen alle.
- **3 Vuorotellen**: vaihe numeroituna konsolin järjestyksessä. Ensin avataan
  luonti, sitten täytetään lomake ja valitaan Create. Kentät ovat kohdissa
  *Kopioi ikkunasta Client ID* ja *… Client secret*.
- **Nykyinen**: tuotannon viisivaiheinen ohje vertailua varten.

Suunnan vaihtavat numerot 1–4 ja nuolet. Yläpalkissa valitaan työpöytä tai
puhelin ja vaalea tai tumma teema. Siinä ovat myös painikkeet **Täytä arvot**
(synteettiset arvot avoimeen ohjeeseen) ja **Alusta** (rivit takaisin tilaan
Ei tarjolla).

## Kokeile

1. Avaa Googlen rivin **Aseta tunnukset…** ja kulje Seuraava-painikkeella
   loppuun. Uusissa suunnissa vaiheita on 4/4, nykyisessä 5/5. Kolme
   ensimmäistä vaihetta ovat samat kuin tuotannossa.
2. Viimeisessä vaiheessa valitse Tallenna tyhjänä. Kentät näyttävät
   tuotannon virheet. Valitse sitten Täytä arvot ja Tallenna. Hetken näkyy
   *Odottaa palvelinta…*, sen jälkeen rivillä lukee Tarjolla.
3. Kokeile samaa **Microsoft 365**:llä. Kentät ovat viimeisessä
   Hyväksyntä-vaiheessa, ja ne kopioidaan Overview-sivulta. Kun molemmat
   arvot on liitetty, *Jos rooli puuttuu* -linkki täyttyy niillä ja sen voi
   kopioida. Nykyisessä ohjeessa linkki on pelkkä pohja.
4. Kokeile **Dropboxia**. Käyttöoikeudet on siirretty ennen Asetuksia, joten
   ohje päättyy Settings-sivulle. Sillä sivulla ovat sekä uudelleenohjaus
   että App key ja App secret. Vaiheita on 3, nykyisessä 4.
5. Valitse ensimmäisessä vaiheessa **Minulla on jo asiakas**. Uusissa
   suunnissa avautuu pelkät kentät ja ohje, mistä arvot löytyvät. Googlella
   tämä tarkoittaa uuden salaisuuden lisäämistä (*Add secret*), koska Google
   ei näytä vanhaa salaisuutta enää. Takaisin palaa ohjeen alkuun.
6. Katso suunnat puhelimessa ja tummassa teemassa.

## Kuvat

- `baseline/`: nykyinen ohje synteettisestä labista vaihe vaiheelta,
  työpöytä ja puhelin, vaalea ja tumma (kuvat skaalalla 2).
- `shots/`: prototyypin kuvat. Nimi kertoo suunnan, palvelun, laitteen,
  teeman ja vaiheen. `-end` on sama vaihe vieritettynä loppuun. `-skip` on
  Minulla on jo asiakas, ja `-done` on rivi tallennuksen jälkeen. Kolme
  ensimmäistä vaihetta ovat kaikissa suunnissa samat, joten ne on kuvattu
  vain Nykyisestä.

Kuvat ja prototyyppi rakennetaan uudelleen komennolla
`PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-28-google-tunnukset/verify.mjs`.
Baselinen kuvat otetaan labista komennolla
`scripts/lab.sh start && node web/lab/capture-google-wizard-baseline.mjs`.

## Mitä sinulta tarvitaan

Valitse suunta tai pyydä uusi kierros. Tarkista myös `result.md`:n kohta
*Decisions for later review*, erityisesti Microsoftin ja Dropboxin
järjestys.
