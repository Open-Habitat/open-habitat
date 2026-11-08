# Kierros 1: miten avustajien arkistointi kerrotaan

Kierros: `design-system/prototypes/rounds/2026-11-08-avustajien-arkistointi/`
(`NOTES.md` kertoo tarinan, suunnat ja tarkistuksen). Akseli on se, milloin
ja missä henkilö saa tietää Jarin 8.11. säännön: arkistointi ei yhdistä
mitään, valmiit kierrokset on jo yhdistetty, kesken oleva kierros jää
avustajan haaraan, ja avustajat palaavat keskustelun mukana käynnistämättä.
Tarinassa on kaksi avustajaa: Prototyyppari odottaa, ja sen kolme kierrosta
on yhdistetty. Katselmoijan kierros 2 on kesken haarassa
`wt/katselmoija-saavutettavuus`, ja se valmistuu arkistoinnin aikana.

- **Nyt**: tuotanto tänään. Arkistointi tapahtuu heti, ja yläpalkin ilmoitus kertoo yhdellä pitkällä rivillä avustajat ja keskeneräisen kierroksen; ilmoitus häviää 8 sekunnissa.
- **1 Vahvistus**: arkistointi kysyy ensin ja luettelee avustajat tiloineen ja sen, mikä jää haaraan; sen jälkeen tavallinen lyhyt ilmoitus.
- **2 Ilmoitus**: arkistointi tapahtuu heti; lyhyt ilmoitus pysyy, kunnes suljet sen, kun työtä on haarassa, ja siinä on Avaa haara ja Palauta.
- **3 Arkistossa**: arkisto näyttää avustajat keskustelun alla omina riveinään tiloineen; ilmoitus vie arkistoon, ja palautus kertoo keskustelussa, mitä sillä välin tapahtui.

Kuvat: `evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`. Vaiheet ovat
`0-oletus` (heti arkistointipainalluksen jälkeen), `1-keskustelu` (ennen
arkistointia), `1-avustajat` (Nyt: tuotannon Avustajat-lista),
`2-vahvistus` (1), `2-arkistoitu`, `2-haara` (2), `3-arkisto`,
`4-palautettu` ja `4-avustajat` (palautetun keskustelun sirun lista).

## Mitä suunnat päättävät

- **Nyt** kertoo kaiken kerran, jälkikäteen ja lyhyen aikaa. Pitkä teksti
  ehtii hävitä ennen kuin sen lukee. Arkistossa ei näy mitään avustajista,
  eikä palautus kerro, mitä sillä välin tapahtui.
- **1 Vahvistus** kertoo ennen arkistointia, jolloin henkilö voi vielä
  perua, esimerkiksi pyytääkseen pääagenttia yhdistämään kierroksen ensin.
  Hinta on yksi painallus lisää. Se tulee vain silloin, kun keskustelulla
  on avustajia, joten arkistointi ei toimi aina samalla tavalla.
- **2 Ilmoitus** pitää arkistoinnin yhtenä painalluksena ja
  pitää ilmoituksen näkyvissä vain silloin, kun jotain jää haaraan. Avaa haara
  näyttää, mikä haara ja missä. Palautus kertoo tapahtuneen samalla tavalla.
- **3 Arkistossa** vie tiedon paikkaan, jossa se pysyy: arkiston rivi
  kertoo avustajat ja haaran niin kauan kuin keskustelu on arkistossa.
  Palautettu keskustelu sanoo kerran, missä avustajat ovat.

## Host-tiedot

- Nyt, 1 ja 3 käyttävät vain sitä, mitä daemon jo lukee: keskustelun
  avustajat (`resident`: nimi, kierrostila, kierrokset, yhdistetty
  kierros, `unlanded`) sekä ajon `branch` ja `worktree`. Tuotanto lukee ne
  jo arkistoinnin yhteydessä (`readHelpersArchiveDetail`).
- **1 Vahvistus** lukee avustajat ennen kuin arkistointi lähtee. Tänään
  luku tehdään rinnakkain arkistoinnin kanssa. Kysymys odottaa lukua
  aikarajan verran, ja jos luku ei onnistu, arkistointi kysyy ilman listaa.
- **2 Ilmoituksen** haaraikkunan *12 tiedostoa · 3 committia* on uusi
  tieto: avustajan haaran ero lähdehaaraan. Daemon voi lukea sen gitistä
  käyttäjänä, mutta reittiä ei vielä ole. Ilman sitä ikkunassa on vain
  haara ja työpuu.
- **3 Arkistossa** listaa arkistoidun keskustelun avustajat. Spinoff-luku
  kulkee pääkeskustelun tunnisteella, joten se toimii myös arkistoidulle
  keskustelulle. Arkiston näkymä lukisi sen jokaiselle arkistoidulle
  keskustelulle, jolla on avustajia, vasta kun arkisto avataan.
- **Mitä sillä välin tapahtui** (palautus suunnissa 2 ja 3) ei tarvitse
  uutta tallennetta. Avaamaton raportti on jo selaimen nähdyt-merkintä
  (`helpersSeen`), ja yhdistämätön työ on Taskfleetin `unlanded` tai
  yhdistetyn kierroksen jääminen raportoidusta.

## Suositus

**3 Arkistossa, ja siihen 2 Ilmoituksen Avaa haara.** Sääntö koskee aikaa,
jona keskustelu on arkistossa: avustajat ovat siellä mukana, ja haara odottaa
siellä. Siksi tieto kuuluu arkistoon eikä ohimenevään ilmoitukseen.
Arkistointi pysyy yhtenä painalluksena kuten muillakin keskusteluilla, ja
ilmoitus on lyhyt, koska yksityiskohdat löytyvät arkistosta. Vahvistus
keskeyttäisi joka kerran, vaikka mitään ei menetetä: arkistointi ei yhdistä
eikä poista mitään, ja palautus tuo kaiken takaisin. Nytin ongelma on, että
koko sääntö on 8 sekunnin rivillä.

## Kysymykset Jarille

1. Missä tämä kerrotaan: kysymyksenä ennen arkistointia
   (`r1-1-vahvistus-0-oletus-1440-light`), pysyvänä ilmoituksena
   (`r1-2-ilmoitus-0-oletus-1440-light`) vai arkistossa avustajariveinä
   (`r1-3-arkistossa-0-oletus-1440-light`)?
2. Riittääkö palautetun keskustelun kertomaksi rivi keskustelun lopussa
   (`r1-3-arkistossa-4-palautettu-1440-light`), vai tarvitaanko ilmoitus
   ja Avaa haara (`r1-2-ilmoitus-4-palautettu-1440-light`)?
3. Pitääkö haaran ikkunassa näkyä muutosten määrä
   (`r1-2-ilmoitus-2-haara-1440-light`), mikä on uusi host-tieto, vai
   riittävätkö haaran nimi ja työpuu?

## Decisions for later review

- **Oletusnäkymä on hetki heti arkistointipainalluksen jälkeen**, koska
  ennen sitä kaikki suunnat näyttävät samalta. Vaihtoehto oli aloittaa
  keskustelusta, jolloin erot näkyisivät vasta painalluksen jälkeen.
- **2 Ilmoituksen ilmoitus pysyy vain, kun työtä on haarassa.** Kun
  kaikki on yhdistetty, se häviää kuten nyt. Vaihtoehto oli pitää se
  aina, mutta silloin pysyvä ilmoitus ei enää kertoisi mitään.
- **Palautuksen rivi (3) piirretään keskustelun lopussa yhden kerran**
  ilman uutta tallennetta. Toteutus voi käyttää samaa kertaalleen kertomisen
  mekanismia kuin kierrosraportit (catch-up). Vaihtoehto oli
  ilmoitusrivi, mutta se katoaisi samalla tavalla kuin Nytin ilmoitus.

## Ympäristö ja näyttö

Rakennettu tuotannon komponenteista tämän worktreen puusta (pohja
`6db68460b`). Kuvat on otettu Playwright Chromium 153.0.8010.12:lla
headless-tilassa, 1440 × 900 ja 390 × 844 (kosketus), DPR 2, vaalea ja
tumma. `check.mjs`: 352 tarkistuspistettä, konsoli puhdas. Kaikki on
synteettistä: Taskfleetin nimetyt workerit eivät ole vielä asennettuina
(`named-workers-in-habitat` result.md).

```
node design-system/prototypes/rounds/2026-11-08-avustajien-arkistointi/build.mjs
open-habitat agent view offer --current --source design-system/prototypes/dist/avustajien-arkistointi/offline.html --title "Avustajien arkistointi · kierros 1" --idempotency-key 6e55d8b3-b9f3-4584-8d40-21eaca1a8e6f --json
```
