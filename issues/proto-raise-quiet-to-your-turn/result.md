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

# Kierros 2: nostopainike muiden painikkeiden joukossa

Kierros: `design-system/prototypes/rounds/2026-11-06-nosta-painike/`
(NOTES.md kertoo suunnat ja vuorovaikutukset). Jarin päätös 6.11.: nosto
painikkeena muiden joukossa. Akseli: minkä painikkeiden joukossa nosto on ja
miltä se näyttää. Oletusnäkymä on nyt auki oleva Hiljaisten keskustelu
*Contosoin tapaaminen*, joten painike näkyy heti.

- **Nyt**: Hiljaisista ei voi nostaa. Sinun vuoroosi tulee vain agentin valmis vuoro, ja avaaminen kuittaa sen.
- **A Yläpalkissa**: ↑-kuvake yläpalkin painikkeiden joukossa Koosteen ja Arkistoi-painikkeen vieressä. Nostettuna se on oranssi ja laskee painettaessa.
- **B Kentän luona**: tekstipainike *Palaan tähän* kentän alarivillä mallin vieressä. Nostettuna siinä lukee *Sinun vuorossasi* ja ✕ laskee.
- **C Rivillä**: ↑ sivupalkin rivillä kynän ja arkiston rinnalla, joten nostaa voi avaamatta. Nostetulla rivillä samassa kohdassa on ↓.

Nosto itse on kaikissa sama, kierroksen 1 suosituksen mukainen: nuoli
pallon paikalla, viimeksi nostettu kärjessä (myös *Sillä aikaa*), avaaminen
ei kuittaa, ja nosto päättyy vastaamalla tai samalla painikkeella. Työssä
olevaa tai jo vastauksena odottavaa ei voi nostaa.

## Mitä kukin päättää

| | Missä | Nostaa avaamatta | Näkyykö nosto avoimessa keskustelussa | Puhelin |
|---|---|---|---|---|
| A | Yläpalkin kuvakkeet | Ei | Oranssi painettu kuvake | Jää ensimmäiselle riville ⋯:n viereen |
| B | Kentän alarivi, tekstinä | Ei | Sanoin: *Sinun vuorossasi ✕* | Mallin nimi lyhenee; ei näy agentin työskennellessä |
| C | Sivupalkin rivin painikkeet | Kyllä | Ei, vain sivupalkissa | Aina näkyvissä laatikossa kynän ja arkiston kanssa |

## Suositus

**A.** Ongelma syntyy, kun Jari käy keskustelussa ja lähtee kiireellä
vastaamatta. Silloin keskustelu on auki, ja nosto on yhden painalluksen
päässä samassa paikassa kuin keskustelun muut toiminnot. Painettu oranssi
kuvake kertoo avoimessa keskustelussa, että nosto on voimassa, ja samasta
kohdasta sen saa pois. B on lähimpänä vastaamisen hetkeä ja sanoo noston
selvimmin, mutta se kilpailee kentän alarivin tilasta puhelimessa ja katoaa,
kun agentti työskentelee. C:n vahvuus on nostaminen avaamatta vanhan
keskustelun kohdalla; se sopii A:n lisäksi toiseksi reitiksi (kysymys 2),
mutta yksin se jättää avoimen keskustelun ilman merkkiä nostosta.

## Mitä toteutus tarvitsee hostilta

Kierroksen 1 hostiosuus pätee sellaisenaan: nosto on henkilön oman daemonin
pitämä merkki (keskustelun `agent_id` → noston aika), snapshotin agentti
saa kentän ja muutos lähtee tapahtumana, jotta kaikki laitteet päivittyvät;
daemon poistaa merkin hyväksyessään henkilön viestin ja arkistoitaessa, ja
laskeminen on oma poistokutsu. Painikkeen paikka ei muuta tätä. Lisäksi:

- **Estetty nosto.** A:n painike tarvitsee syyn, kun nosto ei käy:
  `railNow`in tiedossa jo olevat *työssä* (`metadata.attention`/aktiviteetti)
  ja *odottaa jo vastauksena* riittävät; uutta host-kenttää ei tarvita.
- **Komponenttipaikat.** A: `AgentHeader`iin oma paikka, joka jää
  puhelimessa ensimmäiselle riville (kierros käyttää `terminal`-paikkaa).
  B: `Composer`in alariville paikka mallin viereen. C: `AgentNavItem`in
  painikeryhmään kolmas painike (kierros vie sen portaalilla tuotannon
  `.ah-nav-archive`-ryhmään).

## Kysymykset Jarille

1. **Missä nosto on**: yläpalkissa (`r2-a-ylapalkissa-0-oletus`), kentän
   luona (`r2-b-kentan-luona-0-oletus`) vai sivupalkin rivillä
   (`r2-c-rivilla-0-oletus`)?
2. **Rivin ↑ lisäksi** (`r2-c-rivilla-5-avaamatta`), jotta vanhan
   keskustelun voi nostaa avaamatta, vai riittääkö yksi paikka?
3. **Kuvake vai sana**: riittääkö nostetusta oranssi kuvake
   (`r2-a-ylapalkissa-3-avattu-pysyy`), vai pitääkö sen sanoa *Sinun
   vuorossasi* (`r2-b-kentan-luona-3-avattu-pysyy`)?

## Todisteet

`evidence/r2-*`: jokaisesta suunnasta oletusnäkymä (0, puhelimessa myös
`0-sivupalkki`), nostettu (1, puhelimessa myös `1-sivupalkki`), *Sillä
aikaa* -rivi nostettu kärjessä (2), *Avaa seuraava* -jälkeen nosto pysyy
(3), laskettu samalla painikkeella (4) sekä C:ssä nosto avaamatta ja A:ssa
ja B:ssä vastattu (5). Kuvat ovat 1440 ja 390, vaalea ja tumma,
kertoimella 2. `check.mjs`: 268 tarkistuspistettä, konsoli puhdas. Kyse on
synteettisestä komponenttilabrasta; sitä ei ole ajettu hostia vasten.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-nosta-painike/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/nosta-painike/offline.html \
  --title "Nosta Hiljaisista – kierros 2: painike" \
  --idempotency-key "$(uuidgen)" --json
```

# Kierros 3: nosto kentän luona

Kierros: `design-system/prototypes/rounds/2026-11-06-nosta-kentan-luona/`
(NOTES.md kertoo suunnat ja vuorovaikutukset). Jarin päätös 6.11.: nosto
sekä sivupalkin rivillä että kentän luona; kentän luona olevaa riffataan
nykyistä kentän riviä vasten. Akseli: missä kohdassa kentän riviä nosto on.
Sivupalkin rivin ⤒ on kaikissa suunnissa sama.

Lähtötieto, joka muutti kierroksen 2 kuvaa: olemassa olevan keskustelun
kentässä **ei ole mallisirua** (se on vain tyhjässä keskustelussa; muuten
malli on yläpalkissa). Tuotannon rivi on Liitä, Komennot, Tiedosto |
(työssä Ohjaa, Stop, erotin) | Sanele, Lähetä ↑. Koska Lähetä on jo ↑,
nosto piirtää ⤒:n. Nimi *Palaan tähän* jäi pois, koska kelaus käyttää
nimeä *Palaa tähän*; painikkeessa lukee **Nosta**, nostettuna **Sinun
vuorossasi ✕**.

- **Nyt**: Hiljaisista ei voi nostaa. Kentän rivillä ovat Liitä, Komennot ja Tiedosto, oikealla Sanele ja Lähetä.
- **A Apuihin**: Nosta on vasemmalla Tiedoston jälkeen, samannäköisenä kuin muut apupainikkeet; agentin työskennellessä se jää paikalleen himmeänä.
- **B Lähetykseen**: kun kenttä on tyhjä, Lähetä-pallon paikalla on nosto ⤒; kun kirjoitat, se on taas Lähetä. Rivi ei kasva yhtään.
- **C Keskelle**: Nosta on oikealla ennen Sanele-painiketta, siinä missä työn aikana ovat Ohjaa ja Stop; työn alkaessa ne tulevat sen tilalle.

## Mitä kukin päättää

| | Paikka levossa | Agentin työskennellessä | Kun kentässä on tekstiä | Puhelin |
|---|---|---|---|---|
| A | Neljäs apupainike vasemmalla | Jää himmeänä, syy vihjeessä | Näkyy | Pelkkä ⤒ muiden kuvakkeiden rivissä |
| B | Lähetä-pallon paikalla | Ei näy; pallo on Lähetä/Ohjaa | Ei näy; pallo on Lähetä | Ei vie tilaa |
| C | Keskipaikka ennen erotinta | Ohjaa ja Stop tulevat tilalle | Näkyy | Pilleri nimen kanssa kuten Ohjaa |

## Suositus

**C.** Nykyisen rivin periaate on, että Sanele ja Lähetä eivät liiku ja
keskipaikka on keskustelun tilan painikkeille, jotka syntyvät työn alkaessa.
Nosto on juuri sellainen tilan painike, ja se on käytettävissä vain silloin,
kun agentti ei työskentele, eli täsmälleen silloin, kun keskipaikka on
tyhjä. Rivi ei siksi koskaan kasva eikä mikään käytettävä painike katoa.
Nostettuna oranssi *Sinun vuorossasi ✕* on Lähetä-painikkeen vieressä, siis
siinä, mihin katse menee päättäessä vastaako nyt. Puhelimessa pilleri saa
nimensä samoin kuin Ohjaa. A on selvä mutta vie vasemmalta paikan, joka
työn aikana on himmeä ja turha, ja puhelimessa pelkkä ⤒ on lähellä Lähetä
↑:ta. B on tilaa säästävin, mutta se muuttaa tutun Lähetä-pallon
merkityksen, ja nosto katoaa näkyvistä heti, kun kenttään kirjoittaa.

## Mitä toteutus tarvitsee hostilta

Kierrosten 1 ja 2 hostiosuus pätee sellaisenaan: nosto on henkilön oman
daemonin pitämä merkki (keskustelun `agent_id` → noston aika), snapshotin
agentti saa kentän ja muutos lähtee tapahtumana; daemon poistaa merkin
hyväksyessään henkilön viestin ja arkistoitaessa, ja laskeminen on oma
poistokutsu. Kentän painike tarvitsee vain tiedot, jotka näkymällä jo on:
työskenteleekö agentti (`run_active`/aktiviteetti) ja odottaako keskustelu
jo vastauksena. Uutta host-kenttää ei tarvita.

Komponenttipaikat: `Composer` tarvitsee paikan rivillään (C:ssä
keskipaikka, jonka `rowChip`/`rowStop` jo käyttävät, ja erotin sen perään;
A:ssa apupainikkeiden perään; B:ssä Lähetä-painikkeen vaihtoehto tyhjälle
kentälle). `AgentNavItem` tarvitsee kolmannen painikkeen kynän ja arkiston
rinnalle (kierros vie sen portaalilla `.ah-nav-archive`-ryhmään).

## Kysymykset Jarille

1. **Missä kohdassa riviä**: apupainikkeiden perässä
   (`r3-a-apuihin-0-oletus-1440-light`), Lähetä-pallon paikalla
   (`r3-b-lahetykseen-0-oletus-1440-light`) vai keskellä ennen Saneletta
   (`r3-c-keskelle-0-oletus-1440-light`)?
2. **Puhelimessa nimi vai kuvake**: pilleri *Nosta*
   (`r3-c-keskelle-0-oletus-390-light`) vai pelkkä ⤒ muiden kuvakkeiden
   joukossa (`r3-a-apuihin-0-oletus-390-light`)?
3. **Saako Lähetä-pallo muuttua**: onko tyhjän kentän pallo nostona
   hyvä (`r3-b-lahetykseen-1-nostettu-390-light`), vai pitääkö Lähetän
   aina näyttää Lähetältä?

## Todisteet

`evidence/r3-*`: jokaisesta suunnasta oletusnäkymä (0, puhelimessa myös
`0-sivupalkki`), nostettu (1, puhelimessa myös `1-sivupalkki`), luonnos
kentässä (2), rivi agentin työskennellessä (3, myös Nyt), *Sillä aikaa*
-rivi nostettu kärjessä (4), avattu sieltä, nosto pysyy (5), laskettu
kentän painikkeella (6), toinen nostettu sivupalkista avaamatta (7) ja
vastattu nostettuun (8). Kuvat ovat 1440 ja 390, vaalea ja tumma,
kertoimella 2. `check.mjs`: 424 tarkistuspistettä, konsoli puhdas. Kyse
on synteettisestä komponenttilabrasta; sitä ei ole ajettu hostia vasten.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-nosta-kentan-luona/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/nosta-kentan-luona/offline.html \
  --title "Nosta Hiljaisista – kierros 3: kentän luona" \
  --idempotency-key "$(uuidgen)" --json
```
