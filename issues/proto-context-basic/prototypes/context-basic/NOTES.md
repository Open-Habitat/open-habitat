# Kontekstin käyttö · perustila · Kierros 1

Keskustelun malli täyttää kontekstiaan vuoro vuorolta. Tässä vertaillaan
**aina näkyvää perustilaa**: missä muodossa ja missä kohtaa näkyy, kuinka
paljon mallin kontekstista on käytössä, ja miten se käyttäytyy rajan lähellä
ja tiivistyksen jälkeen. Tarkempi erittely (mistä konteksti koostuu,
tiivistysten historia) on seuraava kierros. Tässä näkyy vain, mistä se
avautuisi. Kaikki nimet ja luvut ovat keksittyjä, mutta ikkunat ovat
Pi:n omat: `gpt-5.5` 272 000 ja `claude-opus-5-5` 1 000 000 tokenia.

## Neljä suuntaa

| Suunta | Muoto ja paikka | Vahvuus | Hinta |
| --- | --- | --- | --- |
| **Rengas** | Pieni rengas ja prosentti yläpalkissa mallisirun vieressä. Renkaassa on merkki kohdassa, jossa Pi tiivistää. Puhelimessa näkyy pelkkä rengas, kunnes käyttö ylittää 70 %. | Yhdellä silmäyksellä, myös puhelimessa. Oma painike vie tarkempaan tilaan eikä sekoitu mallisirun omaan ponnahdukseen. | Yksi elementti lisää jo täyteen yläpalkkiin. Rengas on tarkka vain karkeasti. |
| **Sirussa** | Luku mallisirun sisällä (`gpt-5.5 · high · 34 %`), ja siru täyttyy taustaltaan vasemmalta oikealle. | Ei uutta elementtiä. Ikkunan koko riippuu mallista, joten luku asuu mallin vieressä. | Siru avaa nyt mallin tiedot. Konteksti ja malli joutuvat samaan ponnahdukseen. Täyttö on hienovarainen ja jää helposti huomaamatta. |
| **Kentässä** | Ohut täyttöviiva kirjoituskentän yläreunassa ja kentän alla `92k / 272k`, kuten Pi:n päätteessä. | Näkyy siinä, missä päätät kirjoittaa lisää. Tarkat tokenit. | Viiva on ohut, ja kentän ympärillä on jo paljon (liitteet, komennot, Ohjaa/Työn jälkeen). Tuotannon kenttä on tämän kirjaston kenttää rikkaampi. |
| **Sanoin** | Pelkkä vaimea teksti kentän alla: `Konteksti 34 %`. Rajan lähellä siitä tulee lause: ”Pi tiivistää vanhemman historian noin 94 %:ssa”. | Selittää, mitä tapahtuu, eikä vain näytä lukua. Rauhallinen silloin, kun mitään ei ole tekeillä. | Vie rivin aina. Pitkä lause lyhenee puhelimessa. Tekstiä ei hahmota yhtä nopeasti kuin kuviota. |

Kaikki suunnat noudattavat samoja sääntöjä, jotta vertailtavana on vain muoto ja paikka:

- **Rajat ovat Pi:n omat.** Yli 70 % on huomioväri (aksentti) ja yli 90 % virheväri, kuten Pi:n päätteen alarivillä. Pi tiivistää automaattisesti, kun ikkunasta on jäljellä alle 16 384 tokenia (oletusvara). 272k-ikkunassa se on noin 94 % ja 1M-ikkunassa noin 98 %. Varoitusväritokenia design systemissä ei ole, joten huomioväri on aksentti.
- **Tiivistyksen aikana** ilmaisin kertoo, että Pi tiivistää. Rengas pyörii, siru ”hengittää” ja viiva liukuu. Vähennetyssä liikkeessä animaatiot ovat pois.
- **Heti tiivistyksen jälkeen luku on tuntematon** (”?”, katkoviiva). Pi:n oma laskenta antaa siinä kohdassa tyhjän, koska edellinen luku on ajalta ennen tiivistystä. Uusi luku tulee Pi:n seuraavasta vastauksesta. Ilmaisin ei arvaa.
- **Ennen ensimmäistä vastausta** ilmaisinta ei näy, koska luettavaa ei vielä ole.
- **Jos mallin ikkunan kokoa ei tiedetä**, näkyy vain tokenimäärä ilman prosenttia.
- Ilmaisin on painike, joka avaa **tarkemman tilan paikan** (ponnahdus: luvut, malli, ikkuna, tiivistysraja ja katkoviivainen ”tähän avautuu tarkempi tila”). Escape palauttaa fokuksen ilmaisimeen.
- Ruudunlukija kuulee saman lauseen kuin työkaluvihje. Ilmoitus tulee vain, kun raja lähestyy, tiivistys alkaa tai päättyy.

## Mitä tietoja suunnat tarvitsevat ja onko ne jo olemassa

Kaikki suunnat tarvitsevat saman perustiedon. Ne eroavat vain siinä, käyttävätkö ne tiivistysrajaa (merkki tai lause).

| Tieto | Rengas | Sirussa | Kentässä | Sanoin | Natiivisti | Lukeeko host nyt |
| --- | --- | --- | --- | --- | --- | --- |
| Käytetyt tokenit ja osuus, tuntematon tiivistyksen jälkeen | ✓ | ✓ | ✓ | ✓ | Pi laskee itse: `getContextUsage()` ja RPC:n `get_session_stats` → `contextUsage {tokens, contextWindow, percent}`, joka on `null` tiivistyksen jälkeen. Pohjana on jokaisen assistenttiviestin `usage` sessiotiedostossa. | **Ei.** `get_session_stats` ei ole daemonin sallittujen RPC-komentojen listassa, eikä historian tai elävän virran lukija välitä `usage`a selaimelle. |
| Mallin ikkunan koko | ✓ | ✓ | ✓ | ✓ | Pi:n mallirekisterin `contextWindow` (myös `get_state`n `model`-oliossa). | **Ei.** Daemon kutsuu `get_state`a, mutta ei välitä ikkunaa, eikä mallilista sisällä sitä. |
| Tiivistys käynnissä / päättyi | ✓ | ✓ | ✓ | ✓ | `compaction_start` ja `compaction_end` (syy: raja, ylivuoto tai käsin) sekä `result.tokensBefore`. | **Osittain.** Merkki ja syy välittyvät jo (`pi.marker`), mutta `tokensBefore` ei. |
| Tiivistysraja (merkki tai lause) | ✓ | – | ✓ | ✓ | `autoCompactionEnabled` tulee `get_state`sta. Vara (`compaction.reserveTokens`, oletus 16 384) on Pi:n asetuksissa, ei RPC:ssä. | **Ei.** Merkin voi myös jättää pois, ja luku toimii ilman sitä. |

Claude-mallit ajetaan hostissa Pi:n kautta, joten sama Pi:n `usage` kattaa ne.
Claude Coden oma transkripti kirjaa vastaavan `message.usage`-tiedon
(`input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`,
`output_tokens`), mutta ei ikkunan kokoa. Host ei lue Claude Coden
transkriptejä. Avoin kysymys toteutukselle on keskustelu, jossa Pi ei ole
käynnissä (arkistoitu tai suljettu). Silloin luku pitää lukea sessiotiedostosta
(viimeinen `usage` tiivistyksen jälkeen ja mallin ikkuna rekisteristä), tai
ilmaisin jätetään näyttämättä.

## Kokeile

Avaa selaimessa tiedosto

```
issues/proto-context-basic/prototypes/context-basic/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Suunnat vaihtuvat alareunan
valitsimesta tai näppäimillä **1–4**. Teema ja **Puhelin 390 px** ovat
sivun yläpalkissa.

1. Valitse **Tilanne**: Alussa, Keskellä, Lähellä rajaa, Rajalla, Tiivistää,
   Juuri tiivistetty, Tiivistyksen jälkeen, 1M-ikkuna (ja sen raja), Ikkunan
   koko ei tiedossa, Automaattinen tiivistys pois tai Ei vielä vastausta.
2. **Toista kasvu ja tiivistys** ajaa saman tarinan noin kymmenessä
   sekunnissa: 69 % → 94 % → tiivistää → ? → 12 %.
3. Paina ilmaisinta. Ponnahdus näyttää, mistä tarkempi tila avautuisi.
   Escape tai klikkaus muualle sulkee sen.
4. Kokeile puhelinleveyttä ja tummaa teemaa. Renkaan prosentti piiloutuu
   puhelimessa 70 %:n alapuolella, ja Sanoin-suunnan pitkä lause lyhenee.

## Rakentaminen ja tarkistus

Lähde on `design-system/prototypes/rounds/2026-10-25-kontekstin-mittari/`
(kirjaston sovelluskehys, yläpalkki ja kenttä). `verify.mjs` rakentaa tämän
sivun ja käy läpi neljä suuntaa × 12 tilannetta × 1440/390 px × vaalea/tumma.
Se tarkistaa, ettei mikään vuoda vaakasuunnassa, että ponnahdus avautuu ja
fokus palaa, että toisto etenee tiivistykseen ja takaisin, että vähennetty
liike pysäyttää animaatiot, ettei konsolissa ole virheitä eikä sivu tee
verkkopyyntöjä. Tarkistus kirjoittaa kuvat `evidence/`-hakemistoon.

```sh
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-25-kontekstin-mittari/verify.mjs
```
