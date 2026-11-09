# Kierros 1: keskustelujen arkisto alusta

Kierros: `design-system/prototypes/rounds/2026-11-08-keskustelujen-arkisto/`
(`NOTES.md` kertoo tarinan, rakennuksen ja tarkistuksen). Akseli on se,
missä arkisto on ja miten sieltä löytää keskustelun.

- **Nyt**: tuotanto tänään. Työtilan sivun Arkisto: alleviivatut otsikot ja Palauta näkyviin -painikkeet, avustajien tilalohkot välissä, ei päiviä eikä järjestystä.
- **1 Lista**: arkisto pysyy työtilan sivulla, mutta päivän mukaan ryhmiteltynä ja suodatettavana; rivillä otsikko, päivä, mitä jäi jälkeen ja hiljainen palautus.
- **2 Oma näkymä**: työtilan sivulla on yksi rivi, joka vie arkiston omalle sivulle; haku otsikoista ja yhteenvedoista, valitun esikatselu yhteenvetoineen ja avustajineen.
- **3 Sivupalkki**: arkisto on sivupalkissa työtilan alla kuten käynnissä olevat; valittu keskustelu aukeaa pääpalstaan luettavaksi, ja palautus on sen alalaidassa.

Kuvat: `evidence/r1-<suunta>-0-oletus-{1440,390}-{light,dark}.avif`, puhelimen
sivupalkki `r1-3-sivupalkki-0-oletus-sivupalkki-*`, ja vuorovaikutukset
(`1-suodatus`, `2-luku`, `3-palautettu`, `1-esikatselu`, `2-haku`,
`4-tyotila`). Jarin kuva on `evidence/jari-archive-2026-11-08.avif`.

## Miksi tuotannon osio on sekava

- Järjestys on snapshotin järjestys. Päivää ei näytetä, vaikka snapshotissa
  on jokaiselle keskustelulle `started_at` ja `changed_at`.
- Jokaisella rivillä on täysikokoinen *Palauta näkyviin* (`size="row"`), joka
  on otsikkoa painavampi, ja Jarin kuvassa painikkeet menevät osin
  päällekkäin.
- Avustajat (`ArchivedHelpers`) piirretään keskustelurivin sisään kolmen
  rivin lohkona ja *Avaa haara* -painikkeena. Siksi ne näyttävät omilta
  arkiston kohteiltaan keskustelujen välissä.

## Mitä kaikki suunnat tekevät samoin

- Uusin arkistoitu ensin, ja jokaisella rivillä on päivä.
- Avustaja tai worker näkyy rivillä merkkinä ja kahtena sanana (*avustaja
  testaaja*, *työ yhdistetty*, *työ haarassa*). Tarkka tila ja *Avaa haara*
  näkyvät vasta luettaessa tai esikatselussa.
- Otsikko avaa keskustelun luettavaksi. Tuotanto estää jo arkistoidun
  keskustelun viestit (*Palauta keskustelu arkistosta ennen viestin
  lähettämistä*), joten lukutila ei ole uusi. Kentän paikalla lukee,
  milloin keskustelu arkistoitiin, sen avustajat näkyvät ja on *Palauta*.
- Palautus on hiljainen ikoni tai painike. Palautettu siirtyy
  Käynnissä-listaan, ja ilmoitus kertoo, että avustajat palasivat
  käynnistämättä.
- Siivous: yksikään suunta ei poista keskustelua (katso kysymys 3).

## Host-tiedot

Olemassa:

- Snapshotin `agents[]`: `title`, `archive`, `started_at`, `changed_at`
  (Pi-istuntotiedoston muutosaika), `history` (luettavuus), `worktree_id`
  ja `parent`.
- `GET /api/v1/agents/<id>/recap`: `latest_message` (128 merkkiä),
  `latest_message_at`, ja jos yhteenveto on tehty, `recap.recap`,
  `recap.next` ja `generated_at`. Kortit ja esikatselu (2) näyttävät
  yhteenvedon. Jos sitä ei ole, ne näyttävät viimeisimmän viestin.
- `GET /api/v1/agents/<id>/spinoffs`: avustajat (`resident`) ja workerit
  tiloineen (`merged`, `unmerged`, `failed` …). Tuotanto lukee tämän jo
  jokaiselle arkistoidulle keskustelulle, kun arkisto on auki.
- Daemonin merkintätiedostossa on `archived_at`, mutta snapshot ei vie sitä
  selaimelle.

Puuttuu:

- **Haku keskustelujen sisällöstä.** Hostilla ei ole hakua Pi-historiaan.
  Suunnat hakevat otsikoista (1, 3) tai otsikoista ja olemassa olevista
  yhteenvedoista (2) selaimessa. Koko historian haku olisi uusi
  daemon-rajapinta (kysymys 2).
- **Keskustelun poisto.** Yksittäisen keskustelun poistoa ei ole; roskakori
  koskee työtiloja.

## Decisions for later review

- **Järjestys ja päivä arkistointihetkestä: snapshot vie `archived_at`:n.**
  Vaihtoehto: `changed_at` (on jo olemassa). Valitsin arkistointihetken,
  koska ihminen muistaa, milloin laittoi keskustelun pois. Tieto on jo
  daemonin merkinnässä, joten muutos on yksi valinnainen kenttä
  sopimukseen. Esikatselu (2) näyttää myös aloituksen ja viimeisimmän
  viestin.
- **Rivin jäljet luetaan olemassa olevasta keskustelukohtaisesta
  spinoffs-luvusta, kuten nyt.** Vaihtoehto: yksi työtilakohtainen
  Taskfleet-luku, josta jäljet liitetään keskusteluihin vanhemman tunnuksen
  perusteella (worktree-listan kierroksen ehdotus). Kierros ei riipu
  valinnasta. Kolmentoista rivin listassa keskustelukohtaiset luvut ovat
  kuitenkin raskaita, joten toteutus kannattaa tehdä samalla
  työtilakohtaisella luvulla kuin worktree-lista.
- **Haku 2:ssa kattaa otsikot ja jo tehdyt yhteenvedot, ei koko
  historiaa.** Vaihtoehdot: pelkkä otsikko; uusi daemonin hakurajapinta
  Pi-historiaan. Yhteenvedot ovat jo olemassa. Koko historian haku olisi
  uusi tallennettu tai laskettu indeksi (kysymys 2).
- **Lukutila on tuotannon keskustelunäkymä arkistoidussa tilassa.** Kentän
  paikalla on palautusrivi avustajineen. Erillistä lukunäkymää ei tule.
- **Avustajarivit ovat tuotannon `HelperArchiveRows` sellaisenaan.**
  Workerit saavat saman muotoisen rivin.
- Toteutuksen uusille ohjaimille (suodatin, rivin palautus, esikatselu,
  rajaus, sivupalkin arkisto) tarvitaan Explain-kortit molemmilla kielillä.

## Kysymykset Jarille

1. Mikä suunta: **1 Lista** (työtilan sivulla), **2 Oma näkymä** (oma
   sivu, haku ja esikatselu) vai **3 Sivupalkki**?
2. Riittääkö haku otsikoista ja yhteenvedoista, vai haluatko haun koko
   keskustelun tekstistä? Se olisi uusi daemonin toiminto.
3. Tarvitaanko arkistossa keskustelun pysyvä poisto, vai riittääkö
   arkisto? Natiivi Pi-historia jää joka tapauksessa koneelle.
4. Järjestetäänkö arkistointihetken (suositus) vai viimeisimmän viestin
   mukaan?

**Suositus:** 1 Lista ja haku otsikoista. Arkisto pysyy siellä, missä sitä
nyt etsit, ja korjaa valituksen kohdat suoraan: päivät, järjestys, ei
päällekkäisiä painikkeita eikä tilalohkoja välissä. 13 keskustelua mahtuu
yhdelle sivulle. 2 sopii, jos arkisto kasvaa satoihin; sen voi lisätä
myöhemmin listan päälle. 3 ahtaa sivupalkkia, joka on jo täynnä
työtiloja. Poistoa en tekisi nyt. Järjestys arkistointihetken mukaan.

## Jarin päätös (9.11.2026)

Suosituksen mukaan: **1 Lista** työtilan sivulla, haku otsikoista,
järjestys arkistointihetken mukaan, ei pysyvää poistoa. Prototyyppi on
toteutuksen määrittely (`conversation-archive-list`).
