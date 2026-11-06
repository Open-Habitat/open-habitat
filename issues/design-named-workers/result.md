# Nimetyt tukiworkerit: käyttötapaukset, vaihtoehdot ja suositus

Selvitys 6.11.2026 (Taskfleet 0.18.0, Birch). Tämä on suositus
arkkitehtuuripäätöstä varten, ei toteutus. Käyttöliittymä prototypoidaan
erikseen (`proto-named-workers`).

## Tiivistelmä

Suosittelen, että **Taskfleet omistaa nimetyn workerin**. Worker tekee
kierroksen, jättää kierrosraportin ja lopettaa prosessinsa. Worktree, haara
ja natiivi istunto (Pi:n istuntotiedosto tai Clauden session-id) jäävät
odottamaan. Seuraava viesti käynnistää saman istunnon uudelleen samassa
worktreessä, jolloin worker jatkaa samasta kontekstista ilman kaiken
uudelleenlukemista. Tämä toimii sekä Claudella että Pi:llä, eikä odottava
worker vie muistia. Lisäksi Taskfleetiin tarvitaan välilaskeutuminen: kierroksen työ
yhdistetään mainiin, mutta worker jää eloon. Pi ei tarvitse muutoksia.
Habitat näyttää nimetyt workerit ja välittää henkilön oman viestin
Taskfleetille, mutta ei orkestroi mitään itse.

Kolme havaintoa ohjasi suositusta:

1. **Suurin osa tarvittavasta on jo olemassa, mutta vain Pi:lle.**
   Kokeilin tämän päivän Taskfleetillä Pi-workeria, joka raportoi
   kierroksen `node.awaiting_input`-tapahtumalla ja jäi odottamaan. Se otti
   `run message` -viestillä kaksi lisäkierrosta ja yhdisti lopuksi
   molemmat commitit (alla). Prototyyppikierrokset, jotka ovat käyttötapauksista
   tärkein, ajetaan kuitenkin Clauden kautta, eikä `run message` toimi Claudelle.
2. **Hyöty on jatkuvuus, ei nopeus tai kiintiö.** M365-kierros 2 käytti
   4,6 min ja noin 117 000 tokenia lukemiseen ennen ensimmäistä kirjoitusta
   (koko kierros 17,8 min). Kierroksen 1 konteksti oli lopussa 238 000
   tokenia. Jos kierros 2 olisi jatkanut siitä, se olisi aloittanut
   suuremmasta kontekstista kuin mitä tuore worker luki. Säästö on siis
   noin neljännes kierroksen seinäkellosta. Todellinen arvo on se, mitä
   tiedostoihin ei kirjoitettu: hylätyt polut, vian tutkinnan välivaiheet,
   katselmoijan omat löydökset.
3. **Workerin konteksti on välimuisti, ei tietolähde.** Juuren AGENTS.md:n
   "Code is the record" pätee: kierroksen tulos menee joka kerta
   `result.md`:hen ja committeihin, ikään kuin seuraava kierros alkaisi tyhjästä.
   Muuten nimetystä workerista tulee toinen paikka, jossa totuus työstä
   ajautuu erilleen.

## Mitä mitattiin ja kokeiltiin

**Kierrosten uudelleenluku.** Clauden transkriptit M365-asetusvirran kierroksilta
(`~/.claude/projects/*proto-m365-setup*`):

| Kierros | Kesto | Lukuja ennen 1. kirjoitusta | Aika 1. kirjoitukseen | Konteksti 1. kirjoituksessa | Konteksti lopussa |
|---|---|---|---|---|---|
| 1 (`proto-m365-setup`) | 17,4 min | 26 | 6,2 min | 142 k | 238 k |
| 2 (`proto-m365-setup-r2`) | 17,8 min | 15 | 4,6 min | 117 k | 207 k |
| 3 (käynnissä nyt) | – | 13 ensimmäisen 2 min aikana | – | – | – |

Kierroksen 3 briefi (`~/.local/state/oh-conductor/brief-r59-proto-m365-r3.md`)
toistaa kierrosten 1–2 sijainnit, päätökset ja säännöt. Jatkuvalle
workerille riittäisi "Jari valitsi A1:n; riffaa näin, ja nämä kaksi muutosta
kaikkiin".

**Toimiiko jo nyt?** Kertakäyttöisessä repossa (`/var/tmp/oh-named-exp.*`,
`capable-openai`, ajo `01m6r1y9w9njbq8rn6gzqvg68n`):

- Worker teki kierroksen 1, commitoi, kirjoitti `node.awaiting_input`
  -tapahtuman ("Round 1 ready") ja jäi hiljaa odottamaan. Ajo pysyi
  `pending`-tilassa eikä mennyt `attention_required`-tilaan.
- `run wait` palasi `condition-met`, `awaiting_input: true`.
- `run message` palautti `delivery: accepted`. Worker teki kierroksen 2 ja
  raportoi uudelleen 10 sekunnissa.
- Pääagentti joutui itse kuittaamaan jokaisen raportin
  (`node.input_resolved` ja `event_seq`). Muuten seuraava raportti olisi
  liittynyt samaan avoimeen kysymykseen.
- Viesti "Finish now" sai workerin ajamaan `run merge`. Tulos oli `done`, `landed: true`
  ja kaksi committia mainissa.
- **Ongelma:** `run wait` herätti pääagentin vasta kolmen minuutin päästä
  raportista, vaikka itse kierros kesti alle 30 s. Syy on Taskfleetin
  `GRACE_SECS = 180` (`crates/taskfleet/src/run/awaiting_input.rs`):
  `awaiting_input` on tarkoitettu ihmisen päätöspyynnöksi, jolle annetaan
  aikaa ennen kuin pääagentti herätetään. Odottaja voi ohittaa viiveen
  `TASKFLEET_AWAITING_INPUT_GRACE_SECS=0`:lla. Myös Habitat näyttää tilan
  tekstillä "Odottaa vastausta päätteessä" (`web/src/text/spinoffState.ts`),
  mikä on kierrosraportille väärä.

**Muisti.** Tyhjänä odottava Pi vie noin 180–220 MB ja Claude Code noin
270–300 MB, supervisor noin 10 MB. Birchlla (31 GB) tämä ei ole ongelma. Alderlla
(14 GB, noin kolme raskasta workeria) muutama odottava Claude-prosessi on jo
tuntuva. Lisäksi Claude Coden muistipaineen siivooja pysäyttää prosesseja
äänettömästi (AGENTS-WORKFLOW.md), ja odottava prosessi on silloin
ensimmäinen uhri.

**Taskfleetin nykytila** (help-tekstit ja lähdekoodi `~/src/taskfleet`):
`run message` vaatii Taskfleetin käynnistämän Pi-workerin, jolla on
mukana tuleva laajennus (`message-extension.ts`, `pi.sendUserMessage(...,
{deliverAs: "steer"})`). Se kieltäytyy, jos ajo on päättynyt tai workerin
poistuminen on kirjattu. Claude-workereilta puuttuu sisääntulokanava, ja
Taskfleet kieltää `--resume`- ja `--session-id`-liput Claude-profiilin argv:ssä,
koska se omistaa istunnon itse. `run merge` on ainoa onnistumisen totuus, ja se
päättää ajon aina. Välilaskeutumista ei ole. Idle-unmerged-turvaverkko on
poistettu, joten odottava autonominen worker ei kaadu itsestään.

## Käyttötapaukset

Kapellimestarin historiasta viimeisen kahden viikon ajalta (`git log`,
`taskfleet run list --repo .`, briefit `~/.local/state/oh-conductor/`). 398
ajoa: 159 Claude ja 239 Pi. Commiteissa 83 prototyyppikierrosta.

| Käyttötapaus | Esimerkki historiasta | Mitä jatkuvuus antaa | Arvio |
|---|---|---|---|
| Prototyyppikierrokset 1→2→3 | `proto-m365-setup` → `-r2` (10 min Jarin vastauksen jälkeen) → `-r3`; `phone-header` r1–r3; `explain-mode` r1–r6 | Workerilla on omat suunnat, hylätyt ideat ja kuvakaappausskriptit tallessa; briefi kutistuu yhteen kappaleeseen | Hyvä, **kun Jari vastaa saman päivän aikana**. Jos väliä on päiviä tai konteksti on yli noin 200 k, tuore worker on parempi |
| Vika-analyysi, joka johtaa korjaukseen | `analysis-working-missed` → korjaus; `load-race-sweep` (79 tapausta, yhdeksän ryhmää) → `race-*`-korjaukset; `gate-load-flakes` → `-2` | Analyysin välivaiheet (mitkä hypoteesit kaatuivat, mitkä lokit luettiin) ovat korjaajalla valmiina | Hyvä, kun korjaus on yksi ja samaa kokoluokkaa. Jos korjauksia on monta rinnakkain (race-ryhmät), käytetään kertaworkereita ja analyysi tiedostona |
| Korjaus ja perään sen tarkistus | `sharepoint-site-id` → `sharepoint-skipped-sites-recover` | Korjaaja jatkaa omasta haarastaan, eikä toisen tarvitse lukea koko integraatiota | Hyvä |
| Katselmoija, joka tarkistaa korjauksen | `/llm-review`-kierrokset workereissa | Katselmoija muistaa omat löydöksensä ja tarkistaa vain, korjautuivatko ne | Hyvä, ja halpa: katselmoija ei commitoi, joten välilaskeutumista ei tarvita |
| Tutkija, jolta kysytään jatkokysymyksiä | `research-locked-account` → `research-locked-account finish`; `research-org-admission` → prototyyppi | Jatkokysymykseen vastataan minuuteissa eikä lähteitä haeta uudelleen | Hyvä. Tutkija on yleensä Pi/GPT, joten tämä toimii jo nyt |
| Julkaisun valvonta | `r38-release-step1` → `r38-release`; pilot.19:n asennus | Pitkä odotus vaiheiden välillä | **Ei nimetty worker.** Julkaisu ja asennus ovat ohjelmia (`release-cut.py`, Fleetrepon `upgrade-as-program`), jotka herättävät kutsujan `--callback`:lla. Agenttia tarvitaan vain pysähtymisessä |

**Milloin kertaworker on parempi:**

- Tehtävät ovat toisistaan riippumattomia tai rinnakkaisia (fan-out, eri
  näkymien prototyypit, race-ryhmät).
- Seuraava vaihe tarvitsee eri profiilin tai mallin: tutkimus GPT:llä →
  prototyyppi Claudella, analyysi Pi:llä → iso daemon-muutos `prototype-opus`:lla.
  Nimetty worker on sidottu profiiliinsa.
- Kierrosten väli on päiviä. Välimuisti on silloin kylmä, tiedostot ovat
  muuttuneet ja vanhan kontekstin oletukset vanhentuneet.
- Konteksti on jo täynnä. Jatko alkaisi tiivistyksellä, joka on huonompi
  kuin hyvä `result.md`.
- Iso toteutus, jonka briefi on koko keskustelu. Siinä jatkuvuudesta ei ole
  hyötyä, vaan worker laskeutuu kerran ja on valmis.
- Tuloksen pitää olla itsenäinen tiedostoissa joka tapauksessa (päätöksiä,
  jotka Jari lukee myöhemmin).

## Mitä on ja mitä puuttuu

| Tarve | Nyt | Puuttuu |
|---|---|---|
| Worker raportoi ja jää odottamaan | Pi + `node.awaiting_input` toimii (kokeiltu). Claude: idle-ilmoitukset jätetään huomiotta | Oma kierrosraportti-tapahtuma, jossa on yhteenveto eikä päätöskysymyksiä (`awaiting_input`:ssa on enintään 8 kohtaa, aihe ≤ 512 merkkiä, 180 s viive) |
| Pääagentin herätys | `run wait` laskeutuu `awaiting_input`:iin 180 s:n viiveellä. Habitatin keskustelu herätetään, kun sen `run wait` olisi palannut (`internal/daemon/wake_linux.go`) | Kierrosraportti, joka laskeuttaa `run wait`:n heti. Habitatin herätyksen on tunnettava se |
| Viestin toimitus | `run message` Pi:lle (kuitattu vastaanotto, ei lukukuittausta) | Claude-workerit. Viesti workerille, jonka prosessi on jo poistunut |
| Kuittaus | Pääagentti kirjoittaa `node.input_resolved`:n käsin | `run message` sulkee avoimen kierrosraportin itse |
| Nimi | `--title`, täysi run-id | Lyhyt nimi, joka ratkeaa vain saman repon elävien ajojen joukosta ja kieltäytyy, jos nimi on epäselvä |
| Konteksti ja sen koko | Natiivi istunto säilyy prosessin ajan | Kierroksen lopun tiivistyssääntö ja raja, jonka jälkeen worker lopetetaan ja tilalle tulee tuore |
| Worktree ja merge joka kierroksen jälkeen | `run merge` päättää ajon aina | Välilaskeutuminen: rebase ja yhdistäminen lähdehaaraan, worktree ja haara jäävät |
| Muisti ja Claude-kiintiö | Odottava prosessi vie 0,2–0,3 GB | Prosessi lopetetaan kierrosten väliksi ja käynnistetään uudelleen samasta istunnosta |
| Lopetus ja siivous | `run merge` / `run cancel`; interaktiiviset ajot jäävät auki loputtomiin | Elinaika: hiljainen worker vanhenee, ja Taskfleet pyytää lopetusta. Työ säilyy, eikä mitään yhdistetä automaattisesti |
| Näkyvyys Habitatissa | Workerit-paneeli näyttää ajot, awaiting-inputin ja Pi-transkriptin tilan (`spinoffs_linux.go`, `spinoff_activity_linux.go`) | Tila "odottaa seuraavaa viestiä", kierrosraportit pääkeskustelussa ja henkilön oma viesti workerille |

## Vaihtoehdot

### A. Taskfleet: kierrosajo, prosessi elää kierroksen ajan, istunto säilyy

Taskfleet saa nimetyn ajon (esim. `run create --resident --name proto-m365`):

- Worker päättää kierroksen komennolla (esim. `taskfleet node round-report
  --summary-file …`). Komento kirjaa tapahtuman `node.round_reported` ja
  antaa workerille luvan lopettaa prosessinsa. Supervisor tulkitsee
  poistumisen raportin jälkeen kierroksen lopuksi, ei kaatumiseksi tai
  `attention_required`-tilaksi.
- `run wait` laskeutuu kierrosraporttiin heti ilman viivettä.
  `run show` näyttää raportin.
- `run message <nimi|id>` toimii kahdella tavalla. Jos worker on elossa
  (Pi), viesti menee nykyisellä adapterilla. Jos worker on kierroksen
  rajalla poistunut, Taskfleet käynnistää uuden yrityksen samaan
  worktreehen samasta natiivista istunnosta (Pi `--session <tiedosto>`,
  Claude `--resume <session-id>`) ja antaa viestin sen ensimmäiseksi
  syötteeksi. Taskfleet kirjaa jo nyt yritykset ja istunnot, ja siksi se
  kieltää samat liput profiilin argv:ssä, joten resume kuuluu luontevasti
  sille. Viesti sulkee avoimen kierrosraportin.
- `run land <id>` (välilaskeutuminen) tekee rebasen lähdehaaran kärkeen ja
  yhdistää haaran nykyisellä merge-backendillä, mutta jättää worktreen,
  haaran ja istunnon. Komento sallitaan vain, kun workerin prosessi ei ole
  käynnissä. Silloin kukaan ei kirjoita worktreehen rebasen aikana. Konflikti
  palaa workerille seuraavan kierroksen viestinä.
- Elinaika: konfiguroitava odotusraja (esim. 24 h viimeisestä raportista),
  jonka jälkeen ajo menee `attention_required`-tilaan ja työ säilyy. Jos
  laskeutumatonta työtä ei ole, ajo voidaan perua siististi.

Vahvuudet: toimii Claudelle ja Pi:lle, kapellimestarille sekä Claude Codessa
Alderlla että Habitatissa. Odottava worker vie vain worktreen ja 10 MB:n
supervisorin. Daemonin uudelleenkäynnistys, Birchn päivitys tai muistipaineen siivooja
ei tapa odottavaa workeria, koska prosessia ei ole. Merge- ja purkuvaltuus
pysyvät yhdessä paikassa.

Heikkoudet: muutos on kokonaan Taskfleetin repossa ja koskee supervisorin
tulkintaa poistumisesta, mikä on sen herkin osa. Clauden `--resume` toimii
vain samassa hakemistossa. Se riittää, koska worktree säilyy, mutta
istunnon siirto toiseen hakemistoon ei toimi. Jokainen kierros maksaa
käynnistyksen ja ensimmäisen pyynnön koko kontekstilla. Jos väliä on yli
tunnin, välimuisti on kylmä ja ensimmäinen pyyntö laskutetaan koko
kontekstista. Se on samaa kokoluokkaa kuin tuoreen workerin uudelleenluku.

### B. Pi: laajennus, joka pitää ali-istuntoja pääagentin sisällä

Pääagentin Pi-laajennus luo nimettyjä ali-istuntoja (Pi:n SDK tai RPC-lapset)
ja välittää viestejä niiden välillä.

Vahvuudet: nopea, ei worktreeta eikä mergeä, viestit kulkevat prosessin
sisällä.

Heikkoudet: toimii vain Pi:llä. Ali-istunnot kuolevat pääagentin mukana
(Habitatissa daemonin uudelleenkäynnistys tai Birchn päivitys), eikä niillä ole
worktree-eristystä, joten rinnakkaiset kirjoittajat jakavat yhden checkoutin.
Tämä toistaisi sitä, mitä Taskfleet jo tekee. Rikkoo periaatetta "ei
rinnakkaista agenttialustaa".

### C. Habitat: tukiworker on Habitatin keskustelu omassa worktreessään

Tarvittava on jo lähes olemassa: `open-habitat agent conversation create
--worktree <nimi>` luo keskustelun omaan worktreehensa ("browser worktree
conversation, not a Taskfleet run"). `agent message create --conversation
pi:…` lähettää sille viestin, ja sama komento toimii paluukanavana
pääkeskustelulle, kuten Fleetrepon asennusohjelman `--callback`.
Henkilö näkee workerin sivupalkissa ja voi kirjoittaa sille itse. Pi:n
istunto jatkuu seuraavasta viestistä, vaikka daemon olisi käynnistynyt
välillä.

Vahvuudet: Jarin toivoma käyttökokemus on tässä natiivina. Ei
uutta Taskfleet-koodia.

Heikkoudet: toimii vain Pi:llä (Clauden mallit Pi:n kautta toimivat) ja vain
Habitatista ajettavalle kapellimestarille. Taskfleetin valvontaa ei ole, eli
`run wait`, kuolleen prosessin tunnistus ja merge puuttuvat. Kierroksen työn
laskeutuminen vaatisi daemonille merge-valtuuden, ja se on uusi valtuus väärässä
paikassa. Daemon on käyttäjän oma prosessi, joka lukee natiivia tilaa. Siitä ei
pidä tulla orkestroijaa. Muunnelma, jossa Habitat isännöi Pi:tä
Taskfleetin luomassa caller-owned-ajossa (`run create --agent-owner caller`,
`run session reserve/bind`), pitäisi merge-valtuuden Taskfleetillä. Taskfleetin
oman help-tekstin mukaan käynnistysportti ja kirjoittajan lease eivät kuitenkaan
ole vielä integroituna. Seurataan sitä pitkän aikavälin lähentymisenä, ei nyt.

### Vertailu

| | A Taskfleet | B Pi | C Habitat |
|---|---|---|---|
| Claude-workerit (prototyypit) | kyllä | ei | vain Pi:n kautta |
| Worktree ja merge joka kierroksella | `run land` | ei eristystä | tarvitsisi uuden valtuuden daemonille |
| Kontekstin kasvu | natiivi; tiivistys kierroksen lopussa | sama | sama |
| Muisti odottaessa | ~10 MB | pääagentin sisällä | ei prosessia |
| Claude-kiintiö | sama kuin tuoreella workerilla; säästö on aikaa | – | – |
| Pääagentin herätys | `run wait` ja Habitatin nykyinen herätys | prosessin sisäinen | viesti pääkeskusteluun |
| Selviää daemonin tai Birchn uudelleenkäynnistyksestä | kyllä | ei | kyllä |
| Lopetus ja siivous | elinaika ja säilytetty työ, Taskfleetin purku | pääagentin mukana | worktreen siivous käsin |
| Unix-käyttäjä ja valtuudet | ennallaan | ennallaan | daemon saisi merge-valtuuden |

## Suositus

**A ja Habitat näyttäjänä**, kolmessa vaiheessa:

1. **Heti, ilman koodimuutoksia, vain Pi-workereille** (tutkimus, analyysi →
   korjaus, katselmoija): yllä kokeiltu sopimus. Worker raportoi
   `node.awaiting_input`:lla ja odottaa. Pääagentti odottaa
   `TASKFLEET_AWAITING_INPUT_GRACE_SECS=0 taskfleet run wait …`, kuittaa
   `node.input_resolved`:lla ja lähettää `run message`. Prototyyppikierros
   voi käyttää tätä Pi-workerina Clauden mallilla, jonka AGENTS-WORKFLOW
   jo sallii. Työ yhdistetään vasta lopuksi. Rajoitus: Habitat näyttää
   tilan väärällä tekstillä, ja kierroksen työ ei näy mainissa ennen
   loppua.
2. **Taskfleet** (issue Taskfleetin repoon, kun Jari hyväksyy suunnan):
   kierrosraportti ilman viivettä, `run message` kierroksen rajalla
   poistuneelle workerille resumella (Claude ja Pi), `run land`, `--name`
   ja elinaika.
3. **Habitat** (prototyypin `proto-named-workers` jälkeen): Workerit-paneeli
   näyttää tilat "tekee kierrosta" / "odottaa viestiä" / "lopetettu",
   kierrosraportti näkyy pääkeskustelussa, ja henkilö voi kirjoittaa
   workerille itse. Daemon välittää viestin kiinteällä argv:llä
   `taskfleet run message` käyttäjänä itsenään. Gateway ja provision eivät
   muutu.

**Unix-käyttäjäraja ja valtuudet:** kaikki tapahtuu yhden Linux-käyttäjän
sisällä. Taskfleetin tila ja viestisocket (0600) ovat käyttäjän omassa
tilahakemistossa. Habitatin daemon lukee ja välittää vain kartoitetun
käyttäjän omia ajoja, eikä se luota selaimen väitteeseen siitä, kenen ajo on.
Merge, laskeutuminen ja purku kuuluvat Taskfleetille. Viestin tekstiä ei
kirjata Taskfleetin lokiin. Worker ei erota henkilön viestiä pääagentin
viestistä. Taskfleet kirjaa vain lähettäjän uid:n, joka on sama, joten
Habitatin pitää näyttää, kumpi lähetti.

## Ohjeluonnos agentille

Taitona tai `stint-start`-taidon osana. Englanniksi, kuten muutkin ohjeet.
Kirjoitettu vaiheen 2 komennoilla. Vaiheessa 1 `round-report` on
`node.awaiting_input`-tapahtuma, ja pääagentti kuittaa sen itse.

```markdown
## Named support workers

A named worker is a worktree run that works in rounds: it finishes a round,
reports, and waits for your next message instead of ending. Its value is
continuity, what it tried and rejected and why, not speed or quota; a fresh
worker re-reads the files in a few minutes for about the same cost.

Create one when you expect a follow-up within the same day that depends on
what the worker learned rather than on what it wrote down: prototype rounds
while Jari is answering, a bug analysis whose fix comes next, a reviewer who
will check the fix against its own findings, a researcher you will ask
follow-up questions. Name it after its job (`proto-m365`, `review-sharepoint`).

Do not create one for independent or parallel units, for a next step that
needs a different profile or model, for work whose next round is days away,
for a large implementation that lands once, or to supervise releases (those
are programs that call back).

The worker's context is a cache, not a record. Every round still ends with
the result in the issue's `result.md` and in commits, written as if the next
round started fresh. A brief for a named worker says so, and says how a
round ends: commit, `taskfleet node round-report`, stop.

Message it with `taskfleet run message <name>` when its round report is in
and you have the next instruction: Jari's decision, the fix to verify, the
follow-up question. Say what changed since its last round (decisions recorded
on main, other landings). Land a round with `taskfleet run land` before the
next message when other work or Jari needs to see it on main.

Stop it when the line of work is done, when the next step needs another
profile, when its context is near full (ask it for a final `result.md`, then
continue with a fresh worker), or when it would wait overnight. Stopping is
the ordinary `run merge` from the worker, or `run cancel` with nothing to
land. An expired named worker keeps its work; harvest or discard it like any
preserved branch.
```

Briefin lisäys nimetylle workerille:

```markdown
You are a named support worker (`<name>`). Work in rounds. End each round by
writing the round's result into the issue's `result.md`, committing, and
running `taskfleet node round-report --summary-file <file>` with what you did,
what you recommend and what you need next; then stop. Your next message
continues this session in this worktree. Do not run `taskfleet run merge`
until a message tells you to finish.
```

## Avoimet kysymykset Jarille

1. **Hyväksytkö suunnan A?** Taskfleet omistaa nimetyn workerin
   (kierrosraportti, jatko samasta istunnosta uutena prosessina,
   välilaskeutuminen), ja Habitat vain näyttää ja välittää. Vaihtoehto on
   C: Habitatin keskustelu worktreessä, joka on lähempänä valmista mutta
   toimii vain Pi:llä ja vaatisi daemonille merge-valtuuden.
2. **Laskeutuuko kierroksen työ mainiin joka kierroksen jälkeen?** Suositus
   on kyllä, `run land`. Päätöksesi kirjataan issueen mainissa,
   ja seuraava kierros sekä muut workerit näkevät sen. Vaihtoehto on
   yhdistää vasta lopuksi.
3. **Kuinka kauan hiljainen worker saa odottaa?** Suositus on 24 h
   viimeisestä kierroksesta. Sen jälkeen ajo pysähtyy säilytetyksi työksi,
   eikä mitään yhdistetä automaattisesti.
4. **Saako henkilö kirjoittaa workerille suoraan Habitatista?** Suositus on
   kyllä. Viesti näkyy myös pääagentille, joka saa tietää, että suunta
   muuttui.
5. **Otetaanko vaihe 1 käyttöön heti?** Se tarkoittaa Pi-workereita
   tutkimukseen, analyysiin ja korjaukseen sekä katselmointiin, ja
   kokeiltavaksi yksi prototyyppisarja Pi-workerina Clauden mallilla ennen
   Taskfleet-muutosta.
