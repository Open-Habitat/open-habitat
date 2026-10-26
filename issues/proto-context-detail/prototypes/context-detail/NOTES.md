# Kontekstin käyttö · tarkempi tila · Kierros 1

Perustasolla hyväksyttiin Rengas: rengas ja prosentti yläpalkissa
mallisirun vieressä (tuotannossa nyt). Tämä kierros koskee sitä, mitä
renkaasta avautuu ja missä. Erittely näyttää, mistä konteksti koostuu
(ohjeet ja järjestelmäkehote, työkalut, tiivistelmä, keskustelu,
työkalujen tulosteet, liitteet), mitä seuraava tiivistys korvaisi
yhteenvedolla, aiemmat tiivistykset ja koon vuoroittain.

Sisältö on sama kaikissa neljässä suunnassa. Ne eroavat siinä, missä
erittely avautuu ja kuinka paljon siitä näkyy kerralla. Nimet, keskustelu ja
luvut ovat keksittyjä. Säännöt ovat Pi:n omat: tiivistys alkaa, kun
ikkunasta on jäljellä alle 16 384 tokenia (272k-ikkunassa raja on 255 616), ja
tiivistys säilyttää uusimmat noin 20 000 tokenia vuoron alusta lähtien.
Kehoteosioiden suhteet on otettu Birchlla olevasta oikeasta Pi-sessiosta,
jossa skillit ovat suurin yksittäinen osa.

## Neljä suuntaa

| Suunta | Mikä se on | Vahvuus | Hinta |
| --- | --- | --- | --- |
| **Ponnahdus** | Nykyinen renkaan ponnahdus kasvaa: luku, värijakopalkki, kuusi osaa, seuraava tiivistys yhdellä lauseella, pieni kaavio koosta vuoroittain ja tiivistysten määrä. Puhelimessa alalaatikko. | Vastaa yhdellä silmäyksellä ja on pienin muutos tuotantoon. | Sulkeutuu ensimmäisestä klikkauksesta muualle, joten sitä ei voi pitää auki työn ajan. Tiivistelmää ja suurimpia tulosteita ei mahdu näyttämään. |
| **Paneeli** | Sivupaneeli keskustelun oikealla puolella. Se pysyy auki työn ajan. Osat avautuvat erittelyiksi (skillit, AGENTS.md, työkalut, suurimmat tulosteet). Vuorojana näyttää, mitkä vuorot ovat jo tiivistelmässä, mitkä tiivistyvät seuraavaksi ja mitkä säilyvät. Mukana on myös kaavio ja tiivistykset tiivistelmineen. Puhelimessa koko näytön paneeli. | Näkyy samaan aikaan kuin keskustelu ja päivittyy, kun agentti työskentelee. Kaikki tieto on saatavilla, mutta yksityiskohdat ovat avattavien rivien takana. | Vie työpöydällä 360 px keskustelulta. Tarvitsee sovelluskehykseen uuden paikan sivupaneelille. |
| **Kartta** | Keskustelu muuttuu luetteloksi vuoroista. Jokaisella rivillä on palkki, josta näkyy, mitä vuoro toi kontekstiin. Ryhmät ovat Aina mukana, Aiemmin tiivistetty, **Tiivistyy seuraavaksi** ja **Säilyy sellaisenaan**. Rivin painallus veisi vuoroon keskustelussa. | Konkreettisin vastaus kysymykseen, mitä seuraava tiivistys vie. Siitä näkee, mikä pyyntö kasvatti kontekstia eniten (tässä testiajot). | Korvaa keskustelun näkymän, eli on uusi tila, josta pitää palata. Koostumuksen erittely (skillit ja työkalut) jää karkeammaksi. |
| **Sivu** | Oma sivu `‹ Status-skripti` -paluulinkillä. Siinä on taulukko osista alaosineen, seuraava tiivistys, tiivistykset koko tiivistelmineen ja tiedostoineen sekä taulukko jokaisesta vuorosta (konteksti, muutos, uusi syöte, välimuistista, tuotos). | Tilaa kaikelle. Sopii jälkikäteen tutkimiseen (”miksi tämä keskustelu tiivistyi kolmesti”) ja olisi linkitettävissä. | Keskustelu ei näy samaan aikaan. Kerran tunnissa avattavaksi raskas. |

Yhteiset säännöt:

- **Kokonaismäärä on Pi:n mittaama, osuudet ovat arvioita.** Pi mittaa vain
  koko kontekstin (viimeisen vastauksen `usage`). Osien koot ovat Pi:n omaa
  arviota merkkimäärästä (merkit / 4, `estimateTokens`), ja palkki
  skaalautuu mitattuun summaan. Tämä sanotaan erittelyssä näkyvästi.
- **Heti tiivistyksen jälkeen** rengas näyttää ”?” kuten nyt. Erittely
  näyttää silti arvion (”? · arvio noin 56 240 tokenia”) raidallisella
  palkilla ja sanoo, että Pi mittaa koon seuraavasta vastauksesta.
- **Jos ikkunaa ei tiedetä**, näkyy tokenimäärä ilman prosenttia. Kaavio
  skaalautuu sisältöön, ja tiivistyksen hetken sijaan erittely sanoo, ettei sitä
  tiedetä.
- **Seuraava tiivistys** lasketaan Pi:n omalla säännöllä
  (`prepareCompaction`). Se tiivistää vuorot edellisen tiivistyksen
  säilyttämästä kohdasta lähtien ja jättää uusimmat noin 20 000 tokenia.
  Tiivistetyt vuorot jäävät sessiotiedostoon ja näkyvät keskustelussa, mutta
  malli ei enää näe niitä sellaisinaan.
- Escape sulkee ja palauttaa fokuksen renkaaseen. Avattaessa fokus siirtyy
  otsikkoon. Värit ovat syntaksikorostuksen sävyjä, koska design systemissä
  ei ole datan väripalettia (tuotannossa siitä tulisi tokeneita).

## Mitä tietoja tarvitaan ja mistä ne tulevat

Kaikki suunnat käyttävät samoja tietoja. Ponnahdus ei näytä tiivistelmän
tekstiä eikä tiedostoja, Kartta ei näytä osien alaerittelyä, ja vain Sivu
näyttää vuorokohtaisen syötteen, välimuistin ja tuotoksen.

| Tieto | Pi tarjoaa natiivisti | Lukeeko host nyt | Mitä host tarvitsisi |
| --- | --- | --- | --- |
| Koko ja ikkuna | Jokaisen vastauksen `usage` sessiotiedostossa, ikkuna mallirekisterissä | **Kyllä** (renkaan toteutus) | – |
| Ohjeet ja järjestelmäkehote osioittain, työkalujen kuvaukset | Pi 1.3 tallentaa sessiotiedostoon `system`-viestit: kehoteosiot nimillä (esim. `skills`, `project_context`, `rules`) ja työkalujen määrittelyt (`toolsAdded`/`toolsRemoved`). Tiivistys tallentaa koko tilannekuvan (`systemMessage`). | **Ei.** Historian lukija ei välitä system-viestejä. | Arvio osioittain Pi:n `estimateTokens`illa samalla Pi-apurilla, joka jo lukee mallit ja asetukset. Ei uutta RPC:tä. |
| Keskustelu, tulosteet, liitteet | Viestit rooleittain (user, assistant + ajattelu, toolResult, kuvat) sessiotiedostossa | Viestit kyllä, kokoja ei | Sama arvio rooleittain. Tuotantoon riittää summa per osa ja suurimmat tulosteet. |
| Aiemmat tiivistykset | `compaction`-merkintä: `tokensBefore`, `summary`, `firstKeptEntryId`, `details.readFiles/modifiedFiles`, `usage` | **Osittain.** Merkki ja syy elävästä virrasta, ei `tokensBefore`a, tiivistelmää eikä tiedostoja. | Merkinnän kentät historian rivissä. **Syy** (raja, ylivuoto, käsin) on vain elävässä `compaction_start`-tapahtumassa, ei sessiotiedostossa. Jälkikäteen sen voi päätellä vain osittain (`tokensBefore` rajan yli tarkoittaa automaattista). |
| Seuraava tiivistys | `prepareCompaction(pathEntries, settings)` on Pi:n puhdas funktio: tiivistettävät viestit, `firstKeptEntryId`, `tokensBefore`. `keepRecentTokens` (oletus 20 000) on Pi:n asetuksissa. | **Ei** | Apuri kutsuu Pi:n omaa funktiota ja lukee `keepRecentTokens`in kuten jo `reserveTokens`in. Toteutus ei saa kopioida Pi:n leikkaussääntöä selaimeen, koska sääntö muuttuu Pi:n mukana. |
| Tokenit vuoroittain | `usage`: `input`, `output`, `cacheRead`, `cacheWrite`, `reasoning`, `cost` | Vain `context_tokens` | Loput `usage`-kentät historian riviin (vain Sivu tarvitsee). Tilauksella `cost` on 0. |

Mikään ei vaadi Pi:n käynnistämistä, joten erittely toimisi myös
arkistoidulle keskustelulle samoin kuin rengas.

**Claude Code.** Claude Coden interaktiivinen `/context`-komento näyttää
natiivisti vastaavan erittelyn: järjestelmäkehote, järjestelmän työkalut,
MCP-työkalut, muistitiedostot, viestit, vapaa tila ja automaattisen
tiivistyksen vara. Sen transkripti kirjaa vastauksiin `message.usage`-tiedon ja
tiivistykset `compact_boundary`-rivinä (laukaisija ja koko ennen). Host ei aja
eikä lue Claude Coden omia sessioita, vaan Claude-mallit kulkevat Pi:n
Claude-sillan kautta, joten yllä olevat Pi:n tiedot kattavat ne. Kierroksella
ei tarkistettu, vastaavatko Pi:n tallentamat kehoteosiot sitä, minkä silta
todella lähettää Claudelle. Se on avoin kysymys toteutukselle. Claude Coden
kentät on kirjattu sen tunnetusta muodosta, eikä niitä testattu tällä
kierroksella.

## Kokeile

Avaa selaimessa tiedosto

```
issues/proto-context-detail/prototypes/context-detail/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Suunnat vaihtuvat alareunan
valitsimesta tai näppäimillä **1–4**. Teema ja **Puhelin 390 px** ovat
sivun yläpalkissa.

1. Paina yläpalkin rengasta (75 %) tai **Avaa erittely**.
2. Valitse **Tilanne**: Keskellä työtä, Lähellä tiivistysrajaa (93 %),
   Alussa ei tiivistyksiä, Juuri tiivistetty (”?”) tai Ikkunan koko ei
   tiedossa.
3. Paneelissa ja Sivulla avaa osa, esimerkiksi Työkalujen tulosteet, josta
   näkyvät suurimmat tulosteet. Paneelissa voit avata myös
   **Näytä tiivistelmä**. Kartassa avaa Tiivistelmä-rivi.
4. Kokeile puhelinleveyttä: Ponnahdus on alalaatikko, ja Paneeli ja Sivu
   peittävät keskustelun.

## Rakentaminen ja tarkistus

Lähde on `design-system/prototypes/rounds/2026-10-26-kontekstin-erittely/`
(kirjaston sovelluskehys, yläpalkki, kenttä). `verify.mjs` rakentaa sivun ja
käy läpi 4 suuntaa × 5 tilannetta × 1440/390 px × vaalea/tumma (80
tapausta). Jokaisessa tapauksessa se avaa erittelyn renkaasta ja tarkistaa:

- fokus siirtyy otsikkoon, Escape sulkee ja fokus palaa renkaaseen
- mikään ei vuoda vaakasuunnassa, eikä erittely mene kehyksen ulkopuolelle
- tekstissä ei ole `undefined`/`NaN`/`null`-arvoja
- osien summa on otsikon luku (tai arvio tiivistyksen jälkeen)
- ensimmäinen avattava rivi avautuu
- valitsin toimii, konsolissa ei ole virheitä, eikä sivu tee verkkopyyntöjä

Kuvat ovat `evidence/`-hakemistossa laitteen skaalauksella 2.

```sh
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-26-kontekstin-erittely/verify.mjs
```
