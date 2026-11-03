# Kierros 1: Hiljaisten nostaminen Sinun vuoroosi

Kierros: `design-system/prototypes/rounds/2026-11-03-nosta-hiljainen/`
(NOTES.md kertoo suunnat ja vuorovaikutukset). Akseli: miten keskustelu
nostetaan ja mitä nostettu rivi sen jälkeen on.

- **Nyt**: Hiljaisista ei voi nostaa. Sinun vuoroosi ja Sillä aikaa -riville tulee vain agentin valmis vuoro, ja avaaminen kuittaa sen.
- **A Pallosta**: Hiljaisen rivin pallo muuttuu osoittimen alla nostonapiksi (puhelimessa pyyhkäisy oikealle). Nostettu näyttää valmiilta vuorolta ja poistuu, kun avaat sen.
- **B Valikosta**: rivin ja keskustelun ⋯-valikossa Nosta Sinun vuoroosi. Nostettu on merkitty nuolella, menee jonon kärkeen ja pysyy, kunnes vastaat tai valitset Ei nyt.
- **C Nostamasi**: Sinun vuorosi -otsikon + valitsee Hiljaisista. Nostetut ovat omana ryhmänään vastausten jälkeen, Sillä aikaa laskee ne erikseen, ja ✕ laskee takaisin.

## Mitä kukin päättää

| | Mistä nostetaan | Ulkoasu | Järjestys (rivi ja Sillä aikaa) | Poistuu |
|---|---|---|---|---|
| A | Pallo osoittimen alla; puhelimessa pyyhkäisy | Sama kuin valmis vuoro | Luettelon järjestys, kuten nyt | Avaamalla; ↓ tai pyyhkäisy laskee |
| B | Rivin ⋯ ja otsakkeen ⋯ | Nuoli pallon paikalla | Viimeksi nostettu ensin | Vastaamalla tai *Ei nyt* |
| C | Sinun vuorosi -otsikon + (lista) | Oma Nostamasi-ryhmä | Vastaukset ensin, sitten nostetut | Vastaamalla, ✕ tai *Ei nyt* |

## Suositus

**B.** Nosto on tahallinen muistutus: "palaan tähän". Jos avaaminen
kuittaa sen (A), muistutus katoaa juuri kun vilkaiset keskustelua etkä
vielä ehdi vastata, ja silloin se pitää nostaa uudelleen. B pitää noston,
kunnes vastaat tai sanot *Ei nyt*. Vastaamisen host näkee joka tapauksessa,
joten se on luotettava lopetus kaikilla laitteilla. Nuoli erottaa nostetun
vastauksesta niin, ettei luule agentin kirjoittaneen jotain uutta. ⋯ löytyy
puhelimesta ilman piilotettua elettä, ja otsakkeen ⋯ antaa noston myös
keskustelun sisältä. C toimii samalla periaatteella, mutta + ja lista ovat
raskaampia yhden rivin nostoon, ja ryhmä lisää Sinun vuoroosi kolmannen
tason. A:n pallonappi voisi olla B:n lisäksi työpöydän pikatie (kysymys 3).

## Mitä toteutus tarvitsee hostilta

- **Nyt nähty-tila on selainkohtainen.** `web/src/app/replySeen.ts`
  pitää nähdyt vastaukset `localStorage`ssa (`oh.replies.seen.<identity>`),
  ja `railNow.ts` laskee Sinun vuorosin `metadata.attention`-tiedosta.
  Host ei pidä lukutilaa. Nosto taas pitää näkyä joka laitteella, joten sen
  merkki kuuluu hostille, henkilön omalle daemonille. Selaimen muisti ei
  riitä.
- **Missä merkki on.** Suositus on pieni tiedosto daemonin hallussa
  henkilön kotihakemistossa samaan tapaan kuin
  `~/.config/open-habitat/preferences.json`
  (`internal/daemon/account_preferences_linux.go`): keskustelun `agent_id`
  → noston aika. Snapshotin agentti saa kentän (esim. `raised: {at}`), ja
  muutos lähtee tapahtumana. Silloin jokainen välilehti ja laite päivittyy
  heti, ja `railNow` voi laskea `turn = attention || raised || …` ilman
  erillistä hakua. Pelkkä tilin asetukset -dokumentti olisi helpompi, mutta
  se luetaan uudelleen vain ikkunan saadessa fokuksen
  (`accountPreferences.ts`), joten toinen laite näkisi noston viiveellä.
  Gateway rajaa asetuskirjoituksen 128 tavuun, ja yksi lisäys tai poisto
  mahtuu siihen.
- **Ei Pi:n istuntoon.** Merkintä natiiviin istuntotiedostoon muuttaisi sen
  muokkausajan (`changed_at` on istuntotiedoston mtime), jolloin Hiljaisten
  järjestys hyppäisi. Lisäksi kirjoitus vaatisi käynnissä olevan Pi:n tai
  apuohjelman kuten nimelle (`session_name_helper.mjs`). Nosto on
  Habitatin näkymän tila, ei keskustelun sisältöä.
- **Lopetus.** B:ssä ja C:ssä daemon poistaa merkin, kun se hyväksyy
  henkilön viestin siihen keskusteluun (sama kohta, joka nyt avaa *Sillä
  aikaa* -ikkunan), ja kun keskustelu arkistoidaan. *Ei nyt* on oma
  poistokutsu. A:n "avaaminen kuittaa" tarkoittaisi, että avaaminen
  kirjoittaa hostille. Silloin nosto katoaisi kaikilta laitteilta, vaikka
  vastaus pysyy uutena muilla laitteilla. Tämä epäsymmetria on yksi syy
  suositella B:tä.
- **Kun agentti työskentelee.** Nostettu keskustelu, jonka agentti tai
  worker alkaa työskennellä ilman viestiäsi, kuuluu Käynnissä-osioon niin
  kauan kuin se on käynnissä (`railNow`in nykyinen etusija). Merkki säilyy
  ja palauttaa sen Sinun vuoroosi työn päätyttyä.
- **Sopimus.** `contracts/v1/snapshot.schema.json`in agenttiin uusi kenttä,
  tapahtuma ja kirjoituspolku (esim. `PUT`/`DELETE
  /api/v1/conversations/<id>/raised`). Daemon ajaa henkilön omana
  käyttäjänä eikä luota selaimen identiteettiväitteeseen; uusi auktoriteetti
  ei siirry gatewaylle.
- Kokeellinen ominaisuus: *Sillä aikaa* -rivi on yhä `next-waiting-row`
  -kokeen takana. Nosto voisi olla oma koe tai kuulua samaan.

## Kysymykset Jarille

1. **Poistuuko nostettu avaamalla** (`a-pallosta-3-avattu-poistuu`) **vai
   vasta vastaamalla tai *Ei nyt*** (`b-valikosta-3-avattu-pysyy`)?
2. **Merkitty kärkeen** (`b-valikosta-2-nostettu`) **vai omaksi ryhmäksi
   vastausten jälkeen** (`c-nostamasi-2-nostettu`), vai ihan kuin valmis
   vuoro (`a-pallosta-2-nostettu`)?
3. **Pallo nostonappina työpöydällä** (`a-pallosta-1-osoitin`) **B:n ⋯:n
   lisäksi**, vai riittääkö ⋯ (`b-valikosta-1-valikko`)?

## Todisteet

`evidence/`: jokaisesta suunnasta oletusnäkymä (0), nosto (1), nostettu
Sinun vuorosissa ja *Sillä aikaa* -rivillä (2, puhelimessa myös `-rivi`),
avaamisen jälkeen (3) ja lasku tai otsakkeen valikko (4), B:ssä vastattu
(5). Kuvat ovat 1440 vaalea ja tumma sekä 390 vaalea (puhelimessa myös
sivupalkki auki, `0-sivupalkki`), kertoimella 2. `check.mjs`: 208
tarkistuspistettä, konsoli puhdas. Kyse on synteettisestä
komponenttilabrasta; sitä ei ole ajettu hostia vasten.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-03-nosta-hiljainen/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/nosta-hiljainen/offline.html \
  --title "Nosta Hiljaisista – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```
