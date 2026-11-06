# Kierros 1: keskustelun kontekstin analyysinäkymä

Kierros: `design-system/prototypes/rounds/2026-11-06-kontekstinakyma/`
(NOTES.md kertoo ohjaimet ja mikä on yhteistä). Akseli: mikä järjestää
analyysin. Ensimmäinen valitsin on tämänhetkinen tuotanto.

- **Nyt**: tuotannon Konteksti-sivu renkaasta. Osat, tiivistykset ja vuorot; luetut ja muutetut tiedostot näkyvät vain tiivistyksen kohdalla.
- **A Kohteet**: renkaasta aukeaa sivupaneeli, jossa jokainen luettu tai muutettu tiedosto, viesti ja komento on rivi: koko nyt ja onko se mallilla vai vain tiivistelmässä. Rivin voi merkitä tärkeäksi tai tarpeettomaksi ja pyytää luettavaksi uudelleen.
- **B Koko**: tuotannon sivu alkaa siitä, mihin konteksti kuluu. Jokainen luettu tiedosto ja tuloste on oma palansa palkissa ja listassa suurimmasta pienimpään; valitut voi tiivistää pois.
- **C Aikajana**: tuotannon sivu alkaa vuoroista. Jokainen vuoro näyttää, mitä se luki ja muutti ja paljonko konteksti kasvoi; tiivistyksen raja kulkee aikajanan poikki, ja vuorosta voi haarautua.

Kuvat: `evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`. Suunnat
`0-nyt`, `a-kohteet`, `b-koko`, `c-aikajana`. Vaiheet: `0-oletus` (myös
tummana), Nyt `1-tiivistykset`; A `1-merkitty`, `2-tiivista`,
`3-tiivistetty`, `4-lue-uudelleen`; B `1-merkitty`, `2-tiivistetty`; C
`1-vuoro`, `2-haaraudu`, `3-haara`, `4-tiivistetty`.

## Mitä kukin päättää

| | Missä | Järjestys | Ohjaus |
|---|---|---|---|
| Nyt | sivu keskustelun päällä | osat, seuraava tiivistys, vuorot | ei ohjausta |
| A | sivupaneeli keskustelun vieressä; alalinkki vie tuotannon sivulle | kohteet ryhmissä Muutti / Luki / Ajoi; suodatin Agentilla nyt / Tiivistetty / Kaikki | rivin Tärkeä / Ei tarvita → Tiivistä nyt ohjeella; tiivistetylle Pyydä lukemaan uudelleen |
| B | tuotannon sivu, uusi osio yläosan jälkeen | palat koon mukaan; Tiivistetty pois -lista alla | palan Ei tarvita → Tiivistä nyt; tiivistetylle Lue uudelleen |
| C | tuotannon sivu, aikajana korvaa vuorotaulukon | vuorot uusimmasta vanhimpaan, kohteet siruina, tiivistysrajat välissä | Haaraudu tästä vuorosta; Tiivistä nyt ennusterivistä |

## Suositus

**A Kohteet**, ja tuotannon sivulle (A:n alalinkin takana) B:n *Mihin
konteksti kuluu* -lista.

Jarin kiinnostus oli tilaloki, ja A on se loki kasvatettuna: sama paikka
keskustelun vieressä, samat kohteet, ja jokaisen rivin kohdalla vastaus
kahteen kysymykseen, jotka lokista puuttuivat: paljonko tämä vie nyt, ja
näkeekö agentti tämän vielä sellaisenaan. Henkilö ajattelee tiedostoina ja
viesteinä, ei tokeniluokkina tai vuoronumeroina, joten ohjaus (tärkeä, ei
tarvita, lue uudelleen) toimii luontevimmin kohteen kohdalla. B vastaa
parhaiten kysymykseen "miksi konteksti on täynnä" ja sopii siksi koko
erittelyn sivulle, jolle tullaan juuri sitä selvittämään; yksinään se
hukkaa muutetut tiedostot, joita ei näy kokolistassa. C on rehellisin
siitä, miten Pi tiivistää (aina vanhimmat vuorot, ei yksittäisiä
kohteita), mutta pitkässä keskustelussa se on pitkä lista, ja vastaus
kysymykseen "luiko agentti tämän tiedoston" vaatii selaamista.

## Host-tiedot

Valtuus pysyy daemonilla henkilön omana Unix-käyttäjänä. Kaikki luetaan
avoimen keskustelun Pi-sessiotiedostosta, kuten nykyinen sivu
(`internal/daemon/context_detail_helper.mjs`). Uutta tietovarastoa ei
tarvita.

- **Kohteet ja niiden koot ovat jo luettavissa.** Apuri käy jo jokaisen
  työkalutuloksen läpi ja arvioi sen koon (`largest_outputs`) ja tietää
  projektiosta, mitkä tulokset malli näkee nyt ja mitkä ovat tiivistyneet.
  Kohdelista tarkoittaa, että se palauttaa kaikki kutsut (nyt viisi
  suurinta) ryhmiteltynä polun mukaan: työkalu, polku, vuoro, aika, koko,
  näkyykö. Sopimukseen (`contracts/v1/context-detail.schema.json`) tulee
  uusi rajattu lista.
- **Pi:n oma tiedostoseuranta kattaa vain `read`-, `write`- ja
  `edit`-kutsut** (`extractFileOpsFromMessage`, kenttä `path`). Tiivistyksen
  `details.readFiles` ja `modifiedFiles` ovat näistä kerättyjä. Kierroksen
  tarinassa vuorot 1–7 lukivat kaiken komennoilla (docx2txt, pdftotext,
  himalaya), joten tuotannon sivu näyttää tiivistyksen kohdalla vain
  `make_report.py`:n (`r1-0-nyt-1-tiivistykset`). Komennolla luettu
  tiedosto, viesti tai kalenterimerkintä tunnistetaan komennosta (tunnetut
  muodot: `docx2txt`, `pdftotext`, `cat`, `himalaya message read`,
  kalenterityökalu); näkymä sanoo sen "Luki komennolla", ja tunnistamaton
  komento jää Ajoi-riviksi. Sama epävarmuus kuin M365-kierroksen
  bash-kirjoituksissa.
- **Integraatioiden kohteiden nimet** (viestin aihe, tapahtuman nimi)
  saadaan komennon tulosteesta, joka on jo sessiotiedostossa. Ei Graph-
  eikä IMAP-kutsuja.
- **Tiivistä nyt ohjeella** on Pi:n RPC `{"type":"compact","customInstructions":…}`.
  Selain ei nyt lähetä sitä; daemoniin tulee uusi komento, joka lähettää sen
  henkilön omalle Pi-prosessille. Pi:n leikkaussääntö päättää, mitkä vuorot
  tiivistyvät (vanhimmat, uusimmat noin `keepRecentTokens` säilyvät). Ohje
  vaikuttaa vain yhteenvedon sisältöön, joten "Ei tarvita" ei poista
  uusimmissa vuoroissa olevaa tulostetta. Tiivistysikkuna sanoo sen ja
  näyttää, mikä säilyy. Yksittäisen kohteen poistoa kontekstista Pi ei
  tue, eikä kierros ehdota sitä.
- **Haarautuminen** on Pi:n RPC `fork` (`entryId` = vuoron käyttäjäviesti).
  Pi palauttaa viestin tekstin kenttään. Uusi keskustelu on Pi:n oma sessio,
  ja daemon listaa sen kuten muut.
- **Pyydä lukemaan uudelleen** on pelkkä luonnosteksti viestikenttään. Ei
  hostin osuutta.
- **Merkinnät (Tärkeä / Ei tarvita)** ovat selaimen hetkellistä tilaa siihen
  asti, kun henkilö tiivistää. Niitä ei tallenneta; ne muuttuvat
  tiivistyksen ohjeeksi.

## Kysymykset Jarille

1. **Suunta A, B vai C?** `r1-a-kohteet-0-oletus-1440-light`,
   `r1-b-koko-0-oletus-1440-light`, `r1-c-aikajana-0-oletus-1440-light`.
   Suositus A, ja B:n lista tuotannon sivulle.
2. **Riittääkö ohjaukseksi Pi:n oma tiivistys ohjeella**
   (`r1-a-kohteet-2-tiivista-1440-light`), vaikka se ei poista uusinta
   isoa tulostetta (60 kassan testi jää)? Vaihtoehto olisi oma
   Pi-laajennus, joka jättää valitut tulokset pois mallin näkymästä. Se
   on uusi mekanismi, ja sitä suosittelen vasta tarpeen tullessa.
3. **Tarvitaanko C:n haarautuminen** (`r1-c-aikajana-2-haaraudu-1440-light`)
   kontekstinäkymässä, vai kuuluuko se keskustelun vuoron valikkoon?

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-kontekstinakyma/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/kontekstinakyma/offline.html \
  --title "Keskustelun konteksti – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```

## Tarkistus

`check.mjs`: 68 tarkistuspistettä, konsoli puhdas. Nyt ja kaikki suunnat
1440 ja 390 px vaaleana, A:n, B:n ja C:n vuorovaikutukset klikattuina,
oletukset myös tummana. Kuvat kertoimella 2 (AVIF). Synteettinen
komponenttilabra, ei hostia vasten ajettu. Kierros ei muuttanut
tuotantokoodia.

## Päätökset myöhempää katselmointia varten

- **Lähtökohta on tuotannon sivu, ei uusi näkymä.** B ja C lisäävät
  osionsa `ContextPage`-sivulle, ja A:n paneelista pääsee sille. Vaihtoehto
  oli kokonaan uusi analyysisivu, mutta se olisi ollut toinen kuvaus samasta
  kontekstista.
- **Ohjaus rajattiin Pi:n natiiveihin toimintoihin** (tiivistys ohjeella,
  fork, viesti). Kontekstin muokkaus kohde kohteelta hylättiin, koska se
  vaatisi oman laajennuksen ja loisi toisen totuuden siitä, mitä malli näkee.
- **Koko on tulosteen koko, ei kutsun.** Kirjoitus- ja muokkauskutsun
  argumentit (kirjoitettu sisältö) lasketaan tuotannon sivulla
  Työkalukutsuihin, joten kohteen koko on sen tulosteiden summa. Muutetun
  tiedoston koko voi siksi näyttää pieneltä.

# Kierros 2: B Koko vain todellisilla toiminnoilla

Kierros: `design-system/prototypes/rounds/2026-11-06-kontekstinakyma-2/`
(NOTES.md kertoo ohjaimet ja mikä on yhteistä). Jari valitsi kierroksen 1
B:n, mutta sen ohjaimet lupasivat kohteen poistoa, jota Pi ei tee. Ensin
tutkimus, sitten kolme riffiä B:stä pelkillä todellisilla toiminnoilla,
jokaisessa suodatin **Vain tiedostot**.

## Mitä Pi ja host oikeasti tarjoavat

Lähteet: Pi 1.3.0 (`internal/daemon/pi-device-test/node_modules/@earendil-works/pi-coding-agent/`:
`docs/rpc-commands.md`, `docs/compaction.md`, `docs/session-format.md`,
`docs/extensions.md`, `dist/modes/rpc/rpc-types.d.ts`, `dist/core/agent-session.js`,
`dist/core/compaction/utils.js`, `dist/core/tools/*.d.ts`) ja daemon
(`internal/daemon/pi_rpc_linux.go`, `context_detail_helper.mjs`,
`context_detail_linux.go`).

**Daemon lähettää Pi:lle nyt** vain `prompt`, `steer`, `follow_up`, `abort`,
`clear_queue`, `set_model`, `set_thinking_level`, `set_session_name`,
`get_state` ja `get_commands`. Kontekstiin vaikuttavia komentoja se ei
lähetä. Konteksti-sivu lukee sessiotiedoston Pi:n omilla funktioilla, eikä
mitään kirjoiteta.

### Todellisia jo nyt (vain luku)

- Mitattu koko (Pi:n viimeinen kelvollinen usage), arvioidut osat
  (Pi:n `estimateTokens`, merkit / 4), viisi suurinta tulostetta,
  tiivistykset yhteenvetoineen ja niiden `readFiles`/`modifiedFiles`,
  seuraavan tiivistyksen raja (`prepareCompaction` henkilön asetuksilla),
  vuorot tokeneineen ja hintoineen.

### Rakennettavissa ilman uutta mekanismia

- **Kaikki tulosteet riveinä** (nyt viisi suurinta). Apuri käy jo jokaisen
  projektion työkalutuloksen läpi; lista kasvaa ja ryhmittyy polun mukaan:
  työkalu, polku, vuoro, aika, arvioitu koko, onko mallilla vai vain
  tiivistelmässä, ja `prepareCompaction`in rajasta, tiivistyykö se
  seuraavaksi. Sopimukseen (`contracts/v1/context-detail.schema.json`) uusi
  rajattu lista.
- **Tiedostot**: Pi:n oma tiedostoseuranta (`extractFileOpsFromMessage`)
  tunnistaa `read`-, `write`- ja `edit`-kutsujen `path`-argumentin sekä
  codemode-skriptien `nestedCalls`-kirjanpidon. `read`-kutsussa on
  `offset`/`limit` (osittainen luku näkyy), `edit`-tuloksen `details.patch`
  antaa +/−-rivit. Komennolla luettu tiedosto tunnistetaan vain komennosta
  (tunnettu lukija ja sen polkuargumentti); skriptin kirjoittamaa tiedostoa
  ei tunnisteta.
- **Tiivistä nyt ohjeella**: RPC `{"type":"compact","customInstructions":…}`.
  Vastaus kertoo `tokensBefore`, `estimatedTokensAfter` ja
  `firstKeptEntryId`. Rajoitukset koodista: `compact()` kutsuu ensin
  `abort()`, joten käynnissä oleva vuoro keskeytyy (selain tarjoaa sitä vain
  agentin odottaessa); Pi valitsee rajan itse (`keepRecentTokens`, oletus
  20 000), ohje vaikuttaa vain yhteenvedon sisältöön; heti tiivistyksen
  jälkeen Pi kieltäytyy ("Already compacted") ja liian lyhyessä
  keskustelussa ("Nothing to compact"). Daemoniin uusi komento ja sopimukseen
  sen muoto.
- **Palaa aiempaan kohtaan** (`rewind-conversation`, sovittu, toteutus
  odottaa): Pi:n `navigateTree` laajennuksen komennolla. Tämä on ainoa
  todellinen tapa saada *uusimmissa vuoroissa* oleva iso tuloste pois mallin
  näkyvistä: myöhemmät vuorot siirtyvät toiseen haaraan. B3 avaa saman
  toiminnon kohteen riviltä.
- **Haarautuminen uudeksi keskusteluksi**: RPC `fork` (`entryId`) ja
  `clone`. RPC-prosessi siirtyy uuteen sessiotiedostoon, joten daemonin
  prosessin ja keskustelun omistussuhteen on seurattava. Rewind-kierroksella
  todettiin, ettei RPC sarjoita komentoja. Kontekstinäkymään sitä ei
  tarvita, joten riffeissä sitä ei ole.
- **Lue uudelleen**: luonnos viestikenttään. Ei hostin osuutta.
- **Avaa tiedosto**: työtilan editori on jo tuotannossa (tekstitiedostot).
- **Istunnon tilastot**: RPC `get_session_stats` (tokenit, hinta,
  `contextUsage`). Sivu saa saman jo sessiotiedostosta; ei tarvita.
- **Automaattinen tiivistys päälle/pois**: RPC `set_auto_compaction`. Se
  kirjoittaa henkilön *yleisen* Pi-asetuksen (`settingsManager.setCompactionEnabled`),
  ei vain tämän keskustelun asetusta, joten se kuuluu Asetuksiin, ei tähän
  näkymään.

### Ei todellisia ilman uutta mekanismia

- **Yksittäisen kohteen poisto tai lyhennys kontekstista.** Pi 1.3.0:ssa on
  tähän natiivi merkintä: `context_edit` (`replacement: null` jättää
  työkalutuloksen pois mallin näkymästä, muu arvo korvaa sisällön; raaka
  historia ja kirjanpito säilyvät, ja muutos on haarakohtainen). Sitä ei
  kuitenkaan voi kirjoittaa RPC:llä, eikä laajennuksen komento voi kirjoittaa
  sitä suoraan (komennon `sessionManager` on vain luku). Ainoastaan
  laajennuksen `turn_end`- ja `agent_before_settle`-käsittelijä voi ehdottaa
  `context_edit`-merkintää vuoron rajalla. Toteutus vaatisi daemonin
  Pi-laajennukseen jonon, jonka selain täyttää ja joka kirjoitetaan
  seuraavalla vuororajalla. Tieto pysyisi Pi:n omassa sessiossa (ei toista
  varastoa), mutta se on uusi mekanismi ja uusi ohjauspinta: kysymys 2.
- **Rajan valinta** (mitkä vuorot tiivistyvät) ja **`keepRecentTokens` per
  tiivistys**: ei RPC:tä; asetus on henkilön asetustiedostossa.
- **Tärkeä/Ei tarvita -merkinnät** sellaisinaan: Pi:llä ei ole käsitettä.
  Ne voivat olla vain tiivistyksen ohjeen tekstiä (B2), ja ne vaikuttavat
  vain niihin vuoroihin, jotka Pi joka tapauksessa tiivistää.
- **Tarkka koko kohteittain**: vain Pi:n arvio (merkit / 4); mitattu luku
  on olemassa vain koko kontekstille.

Korjaus kierroksen 1 tietoihin: kierroksen 1 B:n "Ei tarvita" ehdotti
60 kassan testille tiivistystä, vaikka se on säilyvissä vuoroissa; tällä
kierroksella valinnat näkyvät vain riveillä, jotka Pi oikeasti tiivistäisi.

## Riffit

- **Nyt**: tuotannon Konteksti-sivu renkaasta: osat, tiivistykset ja vuorot. Ei tiedostolistaa eikä ohjausta.
- **B1 Ennuste**: jokaisella osalla on sarake "Jos tiivistät nyt" (tiivistyy, säilyy, osin), ja ainoa ohjaus on listan alla Tiivistä nyt vapaalla ohjeella.
- **B2 Ohje riviltä**: seuraavaksi tiivistyvillä riveillä on Mainitse ja Ohita, jotka kirjoittavat yhteenvedon ohjetta listan yllä olevaan laatikkoon; säilyvillä riveillä ei ole nappeja.
- **B3 Raja**: lista on jaettu Pi:n tiivistysrajalla (tiivistyy seuraavaksi, säilyy, aina mukana, jo tiivistetty). Säilyvältä riviltä voi palata keskustelussa sitä edeltävään kohtaan.

Kuvat: `evidence/r2-<riffi>-<vaihe>-<leveys>-<teema>.avif`. Riffit
`0-nyt`, `b1-ennuste`, `b2-ohje`, `b3-raja`. Vaiheet: `0-oletus` (myös
tummana), kaikissa B:issä `1-tiedostot`; B1 `2-tiivista`, `3-tiivistetty`;
B2 `2-merkitty`, `3-tiivista`; B3 `2-palaa`, `3-palattu`, `4-tiivista`.

| | Mitä rivi kertoo | Ohjaus | Vain tiedostot |
|---|---|---|---|
| B1 | koko ja kohtalo tiivistyksessä nyt | Tiivistä nyt + vapaa ohje listan alla | sama sarake tiedostoille, myös tiivistetyt |
| B2 | koko; tiivistyvillä riveillä Mainitse/Ohita | ohjelaatikko listan yllä, muokattava, Tiivistä nyt | samat valinnat tiedostoille |
| B3 | koko ryhmässään (tiivistyy / säilyy / aina / tiivistetty) | Tiivistä nyt ryhmän otsikosta (ohje vahvistuksessa); isolta säilyvältä riviltä Palaa ennen vuoroa | samat ryhmät tiedostoille |

## Suositus

**B3 Raja.** Se näyttää rehellisimmin, miten Pi toimii: tiivistys menee
aina vanhimmista vuoroista, ja henkilö näkee yhdellä silmäyksellä, mitkä
tiedostot ja tulosteet lähtevät ja mitkä jäävät. Se on myös ainoa riffi,
joka vastaa kysymykseen "miten saan tämän ison tulosteen pois": säilyvältä
riviltä paluu edeltävään kohtaan, joka on jo sovittu toiminto. B1 on
selkeä, mutta sarake jää lukematta ja ohjaus on sivun lopussa. B2 antaa
tunteen kohdekohtaisesta ohjauksesta, vaikka vaikutus rajoittuu
yhteenvedon sanamuotoon; se on lähimpänä sitä, mistä kierros 1 sai
moitteita.

## Host-tiedot

Valtuus pysyy daemonilla henkilön omana Unix-käyttäjänä; kaikki luetaan
avoimen keskustelun Pi-sessiotiedostosta kuten nyt.

- Apuri palauttaa kaikki projektion työkalutulokset rajattuna listana
  (työkalu, polku tai komento, vuoro, aika, arvioitu koko, mallilla vai
  tiivistelmässä) ja jokaiselle tiedon, osuuko se `prepareCompaction`in
  tiivistettävään osaan. Tiedostorivit Pi:n file-op-säännöllä ja tunnetuista
  lukukomennoista; `edit`-tuloksen +/− `details.patch`ista.
- Uusi daemon-komento `compact` (valinnainen ohje, pituusraja) henkilön
  omalle Pi-prosessille; selain tarjoaa sitä vain, kun agentti odottaa, ja
  näyttää Pi:n kieltäytymisen syyn sellaisenaan.
- B3:n paluu käyttää `rewind-conversation`-toteutusta; tämä näkymä vain avaa
  sen kohteen vuorosta.

## Kysymykset Jarille

1. **B1, B2 vai B3?** `r2-b1-ennuste-0-oletus-1440-light`,
   `r2-b2-ohje-0-oletus-1440-light`, `r2-b3-raja-0-oletus-1440-light`.
   Suositus B3.
2. **Tehdäänkö yksittäisen tulosteen poisto omana issuena?**
   `r2-b3-raja-2-palaa-1440-light` näyttää ainoan nykyisen keinon: 60 kassan
   testin 24 800 tokenia lähtee vain palaamalla ennen vuoroa 15. Pi:n oma
   `context_edit` voisi jättää juuri sen tulosteen pois ilman paluuta, mutta
   se vaatii daemonin Pi-laajennukseen uuden jonon. Suosittelen odottamaan,
   kunnes paluu on käytössä ja näkee, riittääkö se.
3. **Kuuluvatko komennolla luetut tiedostot Vain tiedostot -listaan?**
   `r2-b3-raja-1-tiedostot-1440-light`: `Projektisuunnitelma.docx` ja
   `Viikkoraportti vko 45.docx` ovat mukana "Luki komennolla", koska ne
   tunnistetaan `docx2txt`-komennosta. Ilman niitä lista näyttäisi vain Pi:n
   varmat `read`/`write`/`edit`-tiedostot, ja Office-tiedostot puuttuisivat.
   Suositus: mukana, merkittynä.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-kontekstinakyma-2/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/kontekstinakyma-2/offline.html \
  --title "Keskustelun konteksti – kierros 2" \
  --idempotency-key "$(uuidgen)" --json
```

## Tarkistus

`check.mjs`: 84 tarkistuspistettä, konsoli puhdas. Nyt ja kaikki riffit
1440 ja 390 px vaaleana, suodatin ja riffin ohjaus klikattuina, oletukset
myös tummana. Kuvat kertoimella 2 (AVIF). Synteettinen komponenttilabra, ei
hostia vasten ajettu. Kierros ei muuttanut tuotantokoodia.

## Päätökset myöhempää katselmointia varten

- **Haarautuminen jätettiin pois kontekstinäkymästä.** Sovittu paluu
  samassa keskustelussa (`rewind-conversation`) kattaa sen, mihin
  kontekstinäkymä haarautumista tarvitsisi; fork uutena keskusteluna
  vaatisi lisäksi prosessin omistuksen seurannan.
- **Automaattisen tiivistyksen kytkin ei ole tässä näkymässä**, koska Pi:n
  `set_auto_compaction` muuttaa henkilön kaikkien keskustelujen asetuksen.
- **Tiivistys estetään agentin työskennellessä** sen sijaan, että se
  keskeyttäisi vuoron, kuten Pi:n `compact()` tekisi.
- **Ennuste poistuu heti tiivistyksen jälkeen**, koska Pi ei silloin
  tiivistä; sivu ei näytä rajaa, jota ei voi käyttää.
