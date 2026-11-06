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
