# Kierros 1: worktree-lista, jonka rivit kertovat mitä ne ovat

Kierros: `design-system/prototypes/rounds/2026-11-08-worktree-lista/`
(`NOTES.md` kertoo tarinan, rakennuksen ja tarkistuksen). Akseli on se,
miten Worktreet-osio järjestää rivit ja mitä se näyttää oletuksena.

- **Nyt**: tuotanto tänään. Gitin hakemistonimet, polut ja haarat; omistettu rivi sanoo "Taskfleet-ajo … omistaa", ja vain jäänteellä on painike.
- **1 Huomio**: näkyvissä vain rivit, jotka tarvitsevat sinua (jäänne, päätöstä odottava worker); itsestään hoituvat ovat yhdellä rivillä alla.
- **2 Keskustelut**: rivit ryhmitelty keskustelunsa alle; ryhmällä on yksi toiminto (avaa, palauta arkistosta), ja itsestään hoituva ryhmä on suljettu.
- **3 Yhteenveto**: muutama lause tilasta toimintoineen ja levyn käyttö palkkina; yksittäiset worktreet vasta Näytä kaikki -valinnan takana.

Kuvat: `evidence/r1-<suunta>-0-oletus-{1440,390}-{light,dark}.avif`,
avattuna `r1-*-1-auki-*` ja poistodialogi `r1-1-huomio-2-poista-*`.

## Mikä Jarin listassa oli

- Kaksi `yhdistetty`-riviä ovat **avustajia** (`testaaja`, `testi-avustaja`)
  arkistoiduista keskusteluista. Taskfleetin resident-ajo pitää työkopion
  kierrosten välillä; arkistointi jättää avustajat odottamaan
  (`named-workers-in-habitat`). Kaikki kierrokset oli yhdistetty, joten
  Taskfleetin joutoaika (`--idle-expiry`, oletus 24 h avoimesta
  kierrosraportista) poistaa työkopiot itsestään ja säilyttää istunnon.
- `testi-interaktiivinen-odottaa` on **interaktiivinen worker**, joka odottaa
  `run merge`- tai `run cancel`-päätöstä. Sen keskustelu on arkistoitu, joten
  se odottaa ikuisesti, ellei keskustelua palauteta.
- `testi-headless-p-ttyy-merge-m-tt` on **jäänne**: ajo päättyi, kukaan ei pidä
  työkopiota, ja 1 commit on vain haarassa. Ainoa rivi, jonka Habitat sai
  poistaa, ja se oli oikein.
- *Siivoa kaikki yhdistetyt* oli pois käytöstä, koska molemmat yhdistetyt
  rivit olivat elävän ajon omistamia, eikä sivu kertonut sitä.

Habitat toimi turvallisesti; vika on kielessä ja reitissä.

## Mitä kaikki suunnat tekevät samoin

- Rivin nimi on avustajan nimi, workerin tehtävä tai päättyneen workerin
  tehtävä; alla keskustelu linkkinä ja sen tila (*käynnissä*/*arkistoitu*).
- Merkki on tuotannon `WorkerMark` (työssä, odottaa sinua, odottaa, ei
  yhdistetty).
- Omistetulle riville sanotaan, mikä sen pitää ja mitä seuraavaksi tapahtuu:
  *vapautuu itsestään tänään klo 23.23* tai *odottaa, että agentti yhdistää
  tai hylkää sen; keskustelu on arkistoitu*.
- Toiminto vie sinne, missä asia hoidetaan: *Palauta keskustelu*
  (arkistoitu) tai *Avaa keskustelu*. Habitat ei pysäytä, yhdistä eikä
  peru ajoa (Jari 6.11.).
- Jäänteellä on *Poista…* tuotannon dialogilla; haara säilyy.
- Gitin hakemisto, haara ja ajon tunnus ovat *Git-tiedot*-valinnan takana
  monospacella, jotta ne voi verrata terminaaliin.
- *Siivoa* laskee vain rivit, joita kukaan ei pidä. Suunnat 1 ja 2 piilottavat
  painikkeen, kun niitä ei ole, ja kertovat sen sijaan, mitkä vapautuvat itsestään.
  Suunta 3 muuttaa sen muotoon *Siivoa jäänteet (n)…*, jolloin mukaan tulevat myös
  yhdistämättömät puhtaat jäänteet, ja niiden haara säilyy.

## Host-tiedot

Daemon ajaa jo `taskfleet run list --repo <työtila>` -komennon jokaiselle listaukselle
(`worktreeRunBlockers`), mutta antaa selaimelle vain ajon tunnuksen. Samassa
vastauksessa on kaikki, mitä suunnat tarvitsevat: `kind`, `lifecycle`
(interaktiivinen), `title`, `resident.name`, `resident.round_state`,
`resident.last_round.reported_at`, `idle_expiry_secs`, `last_landing`,
`created_by_session` ja päättyneiden ajojen tila. Ehdotus: jokaiselle
worktreelle `owner`-olio (`run_id`, `role`: helper/worker/ended,
`title`/`name`, `state`: working/waiting_you/waiting/ended_unmerged,
`conversation_id`, `releases_at`, kun kierros on avoin, työprosessi on
poissa ja kaikki on yhdistetty). Selain liittää `conversation_id`:n omaan
keskustelulistaansa (otsikko, arkistoitu). Uutta komentoa tai kirjoittavaa
rajapintaa ei tule.

## Pitäisikö arkistoidun keskustelun joutilaiden avustajien vapauttaa työkopionsa?

Ne vapauttavat jo: Taskfleetin joutoaika poistaa kokonaan yhdistetyn
kierroksen työkopion 24 tunnin kuluttua avoimesta raportista, säilyttää
istunnon, ja seuraava viesti tekee työkopion uudelleen. Yhdistämätön työ jää
haaraan, ja ajo nostaa huomion (silloin rivi siirtyy *tarvitsee sinua*
-joukkoon). **Suositus:** ei uutta mekanismia eikä Habitatin omaa
vapautusta. Näytä vapautumisaika rivillä (`releases_at`), niin 445 MiB:n
rivi lakkaa näyttämästä jumittuneelta. Lyhyempi joutoaika
avustajareseptissä (esim. 4 h) on halpa säätö, jos 24 h tuntuu pitkältä.
Hinta on se, että saman päivän seuraava kierros rakentaa työkopion
uudelleen (npm ci ym.). Arkistointiin sidottua vapautusta en suosittele:
Taskfleet ei tiedä arkistoinnista, ja Habitatin pitäisi silloin kutsua ajoa
muuttavaa komentoa, mikä rikkoo säännön, ettei Habitat itse tee ajoille mitään.

## Decisions for later review

- **Omistajatieto daemonin olemassa olevasta Taskfleet-luvusta, ei uutta
  komentoa** (vaihtoehdot: selain lukee spinoffs-rajapinnan
  keskustelukohtaisesti ja liittää polun perusteella; pelkkä ajon tunnus
  kuten nyt). Daemon tekee luvun jo ja tuntee polut, joten liitos on yksi
  paikka. Spinoffs-rajapinta on keskustelukohtainen (`belongsSpinoff`),
  eikä se näe muiden keskustelujen ajoja.
- **Interaktiivisen workerin rivi on *tarvitsee sinua*, kun sen keskustelu
  on arkistoitu** (vaihtoehto: aina *odottaa agenttia*). Arkistoidussa
  keskustelussa kukaan ei päätä sitä, joten rivi jäisi muuten ikuisesti.
- **Jäänne nimetään päättyneen ajon tehtävällä**, kun Taskfleet vielä
  tuntee ajon. Muuten se nimetään hakemistonimellä (vieras worktree, käsin tehty).
  Tätä haaraa ei näytetty; se on toteutuksen fallback.
- **Kierros ei näytä käsin tehtyä tai puuttuvaa (`missing`/`locked`)
  worktreetä**; niiden tuotantoteksti voi säilyä sellaisenaan, ja
  kierroksen kysymys koskee Taskfleetin rivejä.
- Toteutuksen uusille ohjaimille (*Git-tiedot*, ryhmän/muiden avaus,
  *Palauta keskustelu*) tarvitaan Explain-kortit molemmilla kielillä.

## Kysymykset Jarille

1. Mikä suunta: **1 Huomio** (vain sinua tarvitsevat, muut yhdellä rivillä),
   **2 Keskustelut** (ryhmät keskustelun alla) vai **3 Yhteenveto** (lauseet ja
   levypalkki, rivit piilossa)?
2. Riittääkö avustajalle *vapautuu itsestään klo …*, vai haluatko lyhyemmän
   joutoajan (esim. 4 h)?
3. Saako *Siivoa* poistaa myös yhdistämättömät jäänteet, kun haara säilyy
   (suunta 3), vai vain yhdistetyt kuten nyt?

**Suositus:** 1 Huomio. Se vastaa suoraan valitukseen: oletuksena näkyy
vain kaksi riviä, joille voi tehdä jotain, ja kummallakin on oikea
painike. Itsestään hoituvat kertovat yhdellä rivillä, miksi ne ovat siellä.
2 toistaa keskustelulistaa ja näyttää enemmän, kuin tarvitset. 3 on
tiivein, mutta piilottaa rivit, joita vertaat terminaaliin. Joutoaika: pidä
24 h ja näytä kellonaika.

## Jarin päätös (8.11.2026)

Suunta **1 Huomio**. Kysymyksiin 2–3 suosituksen mukaan (Jari: "mennään
sillä"): avustajan työpuu vapautuu Taskfleetin 24 h joutoajalla ja lista
näyttää kellonajan; *Siivoa* poistaa vain yhdistetyt kuten nyt. Prototyyppi
on toteutuksen määrittely (`worktree-list-attention`).
