# Miten agentti ja sen workerit odottavat toisiaan

## Lyhyesti

Keskustelun ja sen workereiden välinen suhde on jo natiivisti olemassa:
Taskfleet kirjaa jokaiseen ajoon `created_by_session`-kentän, jonka daemon
antaa Pi:lle ympäristömuuttujana (`TASKFLEET_CREATOR_SESSION=pi:<id>`,
`pi_rpc_linux.go`). Uutta rekisteriä ei tarvita. Puuttuu se, että kukaan ei
huomaa tilannetta "keskustelulla on omia eläviä workereita, eikä mikään
odotus herätä sitä niiden valmistuessa". Nyt herätys syntyy vain siitä, että
agentti itse virittää `taskfleet run wait` -prosessin pi-processesilla, ja se
on viritettävä uudelleen jokaisen herätyksen jälkeen (`--any` ja
`--check-in` palaavat kesken). 26.10. yhden vuoron unohdus riitti, ja kierros
pysähtyi.

Vertasin kolmea linjaa: (A) agentti odottaa edelleen itse, mutta Pi:n
sisällä oleva companion-laajennus huomaa vuoron lopussa puuttuvan odotuksen
ja pyytää agenttia joko virittämään sen tai kertomaan, miksi ei viritä; (B)
companion odottaa agentin puolesta; (C) daemon seuraa keskustelun ajoja ja
herättää elävän Pi:n itse. **Suosittelen A:ta.** Se korjaa juuri sen
virheen, joka havaittiin, eikä siirrä valtaa minnekään. Odotus pysyy
tavallisena, näkyvänä ja pysäytettävänä prosessina, ja agentti saa edelleen
päättää, ettei odota. Päivitysten ja daemonin uudelleenkäynnistysten osalta
A nojaa nykyiseen kiinnikuromisviestiin (ADR 0021). Sen tunnistuksessa
löytyi vika, jonka kirjasin issueksi `companion-wait-grammar-drift`. Lisäksi
A nojaa ihmisen käynnistämiin herätteisiin (`proto-wake-stopped-agent`). C on
järkevä myöhempi askel vain, jos A:n muistutus osoittautuu käytössä
riittämättömäksi, ja se on arkkitehtuuripäätös, koska daemon alkaisi
aloittaa mallivuoroja omasta aloitteestaan.

## Lähteet ja mitä kokeilin

Luin ensin koodin ja aiemmat päätökset: `internal/daemon/pi_activity_linux.go`
(tyhjäkäynnin pysäytys ja kiireisyyden määritelmä),
`internal/daemon/process-extension.mjs` (companion-laajennus ja
kiinnikuromisviesti), `internal/daemon/processes_linux.go` (`taskfleetWait`),
`internal/daemon/spinoffs_linux.go` (`belongsSpinoff`), issueiden
`pi-stop-cause-overnight`, `proto-background-waits`,
`taskfleet-wait-grammar-misses-real-waits`, `spinoff-catch-up-on-resume`,
`stop-idle-pi`, `idle-pi-holds-slots`, `upgrade-keeps-agent-processes`,
`proto-wake-stopped-agent` ja `idle-reaper-considers-background` tulokset,
historiasta ADR 0017, 0020 ja 0021 (`scripts/from-history.sh`) sekä
Fleetrepon ADR 0011 (pi-processesin käyttöönotto).

Ensisijaiset ulkoiset lähteet olivat asennettujen työkalujen omat ohjeet
Birchlla: Taskfleet 0.17.1 (`taskfleet run wait --help`, `run create --help`,
`event tail --help`, `config show`), Pi 1.3.0:n `docs/extensions.md` ja
`dist/core/extensions/types.d.ts` sekä `@aliou/pi-processes` 0.10.9:n
lähdekoodi.

**Kokeilemalla todettu:**

- Companionin `waitRuns` hylkää oikeat odotusmuodot. Ajoin toimitetun
  moduulin nodella: `taskfleet run wait <id> --output json` tunnistetaan,
  mutta `cd … && taskfleet run wait <id> --check-in 45m …`, `--terminal`
  ja `--check-in` eivät. Go-puolen korjaus ei siis päässyt companioniin.
  Tästä on issue `companion-wait-grammar-drift`.
- `taskfleet run list --output json` vie 71 ajon tilahakemistolla noin
  30 ms ja 10 Mt. Vuoron lopussa tehtävä tarkistus ei siis hidasta
  vuoroa tuntuvasti.
- pi-processesin tapahtumaväylällä ei ole käynnistyskomentoa. Löytyvät vain
  `request:*`, `command:kill|clear|pin`, `logs:*` sekä ilmoitustapahtumat.
  Laajennus ei siis voi käynnistää pi-processes-prosessia työkalukutsun
  ulkopuolella, kuten ADR 0021 sanoo.
- Taskfleetin `config show` ei tunne oletus-notifyta, ja ajon manifestissa
  on `notify_cmd: null`, ellei luoja anna `--notify`-valintaa.

**Vain dokumentaatiosta (ei kokeiltu oikealla mallivuorolla):**

- Pi:n `agent_before_settle`-tapahtumassa laajennus voi lisätä merkintöjä
  (`custom_message`) ja pyytää yhden jatkopyynnön (`continue: true`).
  `agent_settled` on pelkkä ilmoitus. `pi.sendMessage(…, { triggerTurn:
  true })` aloittaa vuoron tyhjäkäynnillä olevassa Pi:ssä. pi-processes
  herättää agentin juuri tällä (`notification-sender.ts`:
  `triggerTurn: true, deliverAs: "steer"`).
- Taskfleetin `run create --notify <cmd>`: supervisor ajaa komennon, kun ajo
  saavuttaa terminaalitilan, ennen purkua. Komento saa ympäristöön
  `TASKFLEET_RUN_ID`, `TASKFLEET_STATUS` ja muut. Ilmoitus tulee vähintään
  kerran, eli kaksoiskutsu on mahdollinen. Huomiotiloista (attention,
  awaiting input) ei ilmoiteta.
- `run wait`: oletuksena palaa myös huomiotilaan; `--terminal` vain
  terminaalitilaan; `--check-in` palaa välitilanteella koodilla 4;
  oletusaikakatkaisu on 6 h (koodi 2).

En mitannut tyhjäkäynnillä olevan selain-Pi:n muistinkulutusta, koska
yhtään ei ollut käynnissä.

## Kysymys kerrallaan

### 1. Kuka omistaa keskustelun ja sen ajojen suhteen?

Taskfleet. Ajon `created_by_session` (`harness: pi`, `session_id`) on
natiivi tietue, jonka daemon jo lukee (`belongsSpinoff`) ja jonka companion
lukee kiinnikuromista varten (`readSpinoffs`). Suhde toimii
repositoriorajojen yli (`worker-chip-misses-cross-repo-run`). Kumpikaan ei
tallenna mitään omaa. Daemonin roolina on vain antaa Pi:lle istuntotunnus
ympäristössä. Suhteen puolesta mikään vaihtoehto ei siis tarvitse uutta
tallennetta, ja "keskustelun omat elävät ajot" voidaan aina johtaa
uudelleen Taskfleetistä.

Odottaminen on eri asia kuin suhde. Nyt odottamisen omistaa agentti
pi-processes-prosessin kautta, ja se elää vain niin kauan kuin Pi.
Vaihtoehdot eroavat juuri siinä, kuka odotuksen omistaa.

### 2. Miten valmistuminen voi tavoittaa agentin?

| Mekanismi | Mitä on jo | Mihin se ei riitä |
|---|---|---|
| Agentin oma `run wait` pi-processesilla | Toimii ja on näkyvä (työpaneelin pisteet ◉/○). pi-processes herättää vuoron, kun prosessi päättyy. | Agentin on muistettava, myös jokaisen `--any`- ja `--check-in`-paluun jälkeen. Kuolee Pi:n mukana. |
| Pi-laajennuksen tapahtumat (`agent_before_settle`, `sendMessage triggerTurn`) | API on olemassa. Companion käyttää jo `before_agent_start`-tapahtumaa kiinnikuromiseen. | Laajennus ei voi käynnistää pi-processes-prosessia. Oma odottaja olisi toinen odotusmekanismi pi-processesin rinnalla. |
| Daemonin havainto Taskfleetin tietueista | Daemon lukee ajot jo työpaneelia varten pyynnöstä. | Ei seuraa ajoja jatkuvasti. Ei saa kirjoittaa keskusteluun (ADR 0017), eikä se nykyään aloita vuoroja. |
| Taskfleetin `--notify` | Supervisor on käyttäjän oma yksikkö ja selviää daemonin uudelleenkäynnistyksestä. | Annetaan ajokohtaisesti, joten agentin on muistettava sekin. Vain terminaalitilat. Komento tarvitsisi reitin daemoniin (agenttikuuntelijan reitit ovat oletuksena kiinni). Kaksoiskutsu on mahdollinen. |

Huomio `--notify`-valinnasta: se näyttää valmiilta ratkaisulta, mutta siinä
on sama heikkous kuin nykyisessä odotuksessa. Sen pitää muistaa se, joka
luo ajon. Siitä tulisi luotettava vasta, jos Taskfleet ilmoittaisi ajon
luojalle ilman valintaa. Sellaista ei ole, ja se olisi Taskfleetin
muutos. Siksi `--notify` ei ole minkään vaihtoehdon pohjana.

### 3. Tyhjäkäynnin pysäytys

Nyt elävä odotusprosessi pitää Pi:n kiireisenä, ja muuten tyhjä Pi
pysäytetään 10 minuutin kuluttua. `pi-stop-cause-overnight` osoitti, ettei
pysäytys ollut syy: elävä mutta tyhjä Pi ei olisi herännyt sekään. Siitä
seuraa sääntö, jota kaikki vaihtoehdot noudattavat: **pysäytyksen ei pidä
päätellä kiireisyyttä omista elävistä ajoista vaan siitä, onko jokin, joka
herättää agentin.** A:ssa ja B:ssä sellainen on odotusprosessi, joka pitää
Pi:n jo nyt hengissä. C:ssä se on daemonin oma seuranta, ja silloin
pysäytyksen olisi pidettävä keskenään olevia omia ajoja kiireisyytenä,
rajattuna esimerkiksi enintään odotuksen 6 tunnin oletusrajaan.
Seuraava issue `idle-reaper-considers-background` riippuu siksi tästä
valinnasta. A:lla pysäytykseen ei tarvita muutosta, koska muistutus saa
odotuksen syntymään.

### 4. Pysäytetyt agentit, uudelleenkäynnistykset ja päivitykset

Daemonin uudelleenkäynnistys (julkaisu, päivitys, kaatuminen) päättää
jokaisen selain-Pi:n ja sen odotukset, koska ne ovat daemonin cgroupissa.
Workerit jatkavat omissa käyttäjäyksiköissään. Seuraavalla viestillä
kiinnikuromisviesti kertoo, mitkä ajot valmistuivat, ja käskee virittämään
katkenneet odotukset uudelleen (ADR 0021). Grammatiikkavian takia tuo
käsky ei nyt synny, kun agentti on käyttänyt muotoja `cd … &&`,
`--check-in` tai `--terminal`. Kapellimestari käyttää juuri niitä.

Mikään kolmesta vaihtoehdosta ei pidä odotusta hengissä päivityksen yli.
Sen tekisi vain `upgrade-keeps-agent-processes`-tutkimuksen vaihtoehto B
(Pi oman pitäjäprosessinsa alla käyttäjän managerissa). Kaikki kolme
toimivat sen kanssa sellaisenaan. Pysäytetyn Pi:n käynnistämisestä Jari
päätti 27.10.: kaikkia vanhoja keskusteluja ei käynnistetä automaattisesti,
vaan herätteet tulevat ihmiseltä (kirjoittaminen, avaaminen, Herätä-painike;
`proto-wake-stopped-agent`). Pidän sitä tämän suunnitelman reunaehtona:
mikään vaihtoehto ei käynnistä pysäytettyä Pi:tä ilman ihmistä.
Upgrade-tutkimus perusteli jo, miksi katkenneen odotuksen automaattinen
jatkaminen on vaarallinen: odotus on voinut jo palata ja agentti on voinut
aloittaa seurauksellisen toimen.

### 5. Mitä ihminen näkee

Työpaneelin pisteet näyttävät jo, odotetaanko workeria (◉) vai ei (○), ja
yläpalkin tila kertoo "Odottaa taustatyötä" (`background-wait-chip-dots`,
`background-wait-state`). Puuttuva odotus näkyy siis jo nyt, mutta vain
ihmiselle, joka sattuu katsomaan. A lisää keskusteluun näkyvän
companion-merkinnän ("N workeria käynnissä ilman odotusta") ja agentin
vastauksen. Kun Pi on pysähtynyt, sivupalkki voisi kaikissa vaihtoehdoissa
kertoa, että omia workereita valmistui pysähdyksen aikana. Se johdetaan
samoista Taskfleet-tietueista ja ruokkii ihmisen herätettä.

### 6. Mitä natiivit työkalut jo tarjoavat

- Taskfleet: suhde (`created_by_session`), odotus (`run wait`, kaikki
  muodot), ilmoituskoukku (`--notify`) ja tapahtumaloki (`event tail
  --follow`). Se ei kuitenkaan herätä luojaa itse.
- Pi: kiinnikuromisessa käytetty `before_agent_start`, vuoron lopun
  `agent_before_settle` (lisää merkinnän ja yhden jatkon) ja
  `sendMessage(triggerTurn)`.
- pi-processes: ainoa taustaprosessien omistaja (Fleetrepon ADR 0011,
  ADR 0021). Herättää vuoron prosessin päättyessä. Ei ota vastaan
  käynnistyskomentoja tapahtumaväylältä.
- Claude Code herättää oman istuntonsa taustakomennon päättyessä samalla
  tavalla (sen omien ohjeiden mukaan; en kokeillut). Ongelma on yleinen
  "luoja odottaa itse" -malli, ei Pi-erityinen.

## Vaihtoehdot

### A. Agentti odottaa, companion vartioi vuoron lopussa

Companion-laajennus kuuntelee `agent_before_settle`-tapahtumaa. Kun vuoro
on päättymässä, se kysyy pi-processesilta elävät prosessit
(`request:list`, kuten nyt) ja Taskfleetiltä keskustelun omat elävät ajot
(`run list`, `belongsSpinoff`-sääntö, sama koodi kuin `readSpinoffs`). Jos
jokin oma elävä ajo jää minkään herättävän odotuksen ulkopuolelle
(`waitRuns` elävien prosessien komennoista, korjattuna), companion lisää
yhden näkyvän merkinnän ja pyytää jatkon. Merkinnässä on ajojen tunnukset,
valmis komento `taskfleet run wait <ids> --any --output json` ja pyyntö
joko käynnistää odotus process-työkalulla tai sanoa, miksi ei. Ajokertojen
rajoitus: sama joukko kattamattomia ajoja muistutetaan vain kerran.
Muistutetut avaimet luetaan haarasta, kuten kiinnikuromisen `reported`.
Jos agentti päättää olla odottamatta, seuraava vuoro samalla joukolla ei
muistuta uudelleen, ja työpaneeli näyttää ○. Kokonaan uusi kattamaton ajo
muistutetaan taas.

- Plussat: korjaa havaitun virheen suoraan. Ei uutta prosessia, odottajaa,
  tallennetta, reittiä tai valtaa. Odotus pysyy pi-processesin
  tavallisena prosessina, joka näkyy ja on pysäytettävissä, eli ADR 0021
  ja Fleetrepon ADR 0011 pätevät ennallaan. Agentti voi edelleen päättää
  olla odottamatta, esimerkiksi tarkoituksellisen fire-and-forget-ajon
  kohdalla. Tyhjäkäynnin pysäytys ja kiireisyyden määritelmä eivät muutu.
  Laajuus on yksi companion-tiedosto ja sen testit.
- Miinukset: vain muistutus, ei tae. Agentti voi jättää sen huomiotta.
  Jokainen muistutus maksaa yhden mallipyynnön. Toimii vain, kun Pi elää.
  Daemonin uudelleenkäynnistyksen jälkeen palautus on yhä seuraavan
  viestin varassa (kiinnikuromisviesti ja ihmisen heräte). Lisää vuoron
  loppuun yhden Taskfleet-luvun, noin 30 ms; aikaraja 1–2 s, ja
  aikakatkaisun jälkeen ei muistuteta.

### B. Companion odottaa agentin puolesta

Companion seuraa itse keskustelun omia eläviä ajoja (pollaa `run list`
-komentoa tai pitää omaa `run wait` -lastaan) ja lähettää valmistumisesta
herättävän viestin (`sendMessage(triggerTurn: true)`). Muunnelma B2:
pi-processes saa ylävirrasta `processes:command:start`-tapahtuman, ja
companion virittää agentille tavallisen odotusprosessin.

- Plussat: agentti ei voi unohtaa. Herätys ei maksa ylimääräistä
  muistutuspyyntöä. B2:ssa odotus olisi edelleen pi-processesin näkyvä
  prosessi.
- Miinukset: B1 on se toinen odottaja, jonka ADR 0021 ja Fleetrepon ADR 0011
  hylkäsivät. Se olisi näkymätön pi-processesin luettelossa, joten
  tyhjäkäynnin pysäytys, `wakes_agent` ja työpaneelin pisteet pitäisi
  opettaa tuntemaan se. Agentti ei enää valitse, mitä odottaa: jokainen
  ajo herättää, ja 20 yksikön fan-out herättää jopa 20 kertaa, ellei
  herätyksiä niputeta. Tarvitaan erillinen opt-out. B2 riippuu
  kiinnitetyn kolmannen osapuolen paketin muutoksesta. Kuolee Pi:n mukana
  kuten A.

### C. Daemon seuraa keskustelun ajoja ja herättää elävän Pi:n

Daemon seuraa Taskfleetin ajoja (inotify `~/.taskfleet/runs/*/manifest.json`
tai pollaus) niin kauan kuin jollakin elävällä keskustelulla on omia
keskeneräisiä ajoja. Kun ajo asettuu ja keskustelun Pi elää tyhjäkäynnillä
ilman ajon kattavaa odotusta, daemon pyytää companionia prosessisillan uudella
operaatiolla (`wake`, mukana vain `run_id`). Companion lukee Taskfleetin
itse eikä luota daemonin väitteeseen, ja Pi kirjoittaa herättävän viestin.
Näin daemon ei kirjoita keskusteluun (ADR 0017 pysyy voimassa).
Pysäytettyä Pi:tä daemon ei käynnistä (Jari 27.10.). Se merkitsee
keskustelun sivupalkkiin, ja ihmisen heräte hoitaa loput. Tyhjäkäynnin
pysäytys käyttäisi samaa faktaa ja pitäisi Pi:n hengissä, kun omia ajoja on
käynnissä.

- Plussat: ei riipu agentin muistista eikä mallipyynnöstä virittämiseen.
  Tila johdetaan aina Taskfleetistä ja haarasta, joten daemonin
  uudelleenkäynnistyksen jälkeen mitään ei tarvitse palauttaa. Sama
  havainto palvelee pysäytystä, sivupalkkia ja herätettä.
- Miinukset: daemon saa uuden aloitteen, sillä se aiheuttaa mallivuoron
  ilman ihmisen lähetystä ja ilman agentin pyyntöä. ADR 0020:n "vain
  lähetys tai erillinen käynnistys" koskee Pi:n käynnistämistä, mutta
  daemonin aloittama vuoro on uusi asia, joten se on Jarin päätös.
  Kilpatilanne agentin oman odotuksen kanssa (odotus palaa samalla
  hetkellä) aiheuttaa kaksoisvuoron, ellei herätteitä deduplikoida
  avaimella `run_id:state` haarasta. Tarvitaan jatkuva seuranta daemonissa,
  uusi siltaoperaatio ja niputus fan-outeja varten. Kuolee daemonin mukana
  kuten Pi, joten se ei auta päivityksessä yhtään enempää kuin A. Laajuus
  on selvästi suurin.

### Vertailu

| | A: muistutus | B: companion odottaa | C: daemon herättää |
|---|---|---|---|
| Korjaa 26.10. tapauksen | Todennäköisesti (jos agentti noudattaa) | Kyllä | Kyllä |
| Agentti päättää, mitä odotetaan | Kyllä | Ei (tarvitsee opt-outin) | Ei (tarvitsee opt-outin) |
| Uusi odottaja tai tallenne | Ei | Odottaja (B1) | Daemonin seuranta, ei tallennetta |
| Muuttaa aiempaa päätöstä | Ei | ADR 0021, Fleetrepon ADR 0011 (B1) | Daemonin aloittamat vuorot |
| Tyhjäkäynnin pysäytys | Ei muutu | Opetettava tuntemaan odottaja | Muuttuu (omat ajot = kiireinen) |
| Selviää päivityksestä | Ei (kiinnikuromisen varassa) | Ei | Ei |
| Laajuus | Pieni | Keskisuuri | Suuri |

## Auktoriteettijako: gateway, daemon, provision

- **Gateway:** ei kosketa missään vaihtoehdossa. Odotukset, ajot ja herätteet
  ovat saman henkilön UID:n sisäisiä asioita.
- **Provision (broker):** ei kosketa. Mitään ei tarvita rootina, eikä
  käyttäjäyksiköitä luoda.
- **Daemon:** A ei muuta daemonia (paitsi grammatiikkakorjaus, joka on
  companionissa). B ei muuta valtaa, mutta pysäytyksen ja siltaoperaation
  pitäisi tuntea companionin odottaja. **C antaa daemonille uuden vallan:**
  se saa aiheuttaa mallivuoron keskustelussa omasta aloitteestaan. Vuoro
  ajetaan saman henkilön Pi:ssä henkilön UID:nä, eikä mikään rajan yli
  siirry, mutta se muuttaa tuotteen periaatetta "vuoro alkaa ihmisestä tai
  agentin omasta pyynnöstä". Se on arkkitehtuuripäätös Jarille.
- **Taskfleet:** pysyy ajojen omistajana kaikissa vaihtoehdoissa. Daemon ja
  companion lukevat sen tietueita vain lukien, eikä mikään vaihtoehto
  luo, yhdistä tai kirjoita ajoja (`internal/AGENTS.md`).

## Suositus

**A, ja lisäksi kolme pientä asiaa.**

1. Companion vartioi vuoron loppua kuten yllä: kerran kutakin kattamattomien
   ajojen joukkoa kohti, näkyvällä merkinnällä, joka tarjoaa valmiin
   komennon ja antaa agentin kieltäytyä. Vuoron lopussa luetaan
   Taskfleetiä enintään 1–2 sekuntia, ja virhe tai aikakatkaisu ei
   muistuta.
2. Korjataan `companion-wait-grammar-drift`, jotta kiinnikuromisviesti ja
   vartija tunnistavat samat odotusmuodot kuin daemon. Mieluiten molemmat
   lukevat yhteistä esimerkkitaulukkoa testeissä.
3. Tyhjäkäynnin pysäytys pysyy ennallaan (`idle-reaper-considers-background`
   voidaan sulkea tai rajata tämän valinnan mukaan): odotus pitää Pi:n
   hengissä, ja Pi, joka on päättänyt olla odottamatta, saa pysähtyä.
   Pysäytetyn Pi:n palautus kuuluu ihmisen herätteelle
   (`proto-wake-stopped-agent`) ja kiinnikuromisviestille. Sivupalkki
   voi kertoa pysähdyksen aikana valmistuneista omista workereista.

Perustelu: puuttui havainto puuttuvasta odotuksesta. Odotusmekanismi
itsessään toimi kuusi kertaa peräkkäin samana iltana. A lisää puuttuvan
havainnon siihen kohtaan, jossa virhe syntyi, eli vuoron loppuun, ja
jättää vastuun sille, joka työn delegoi. Vaihtoehdot B ja C vievät
agentilta valinnan, mitä odottaa, ja kumoavat aiemman päätöksen (B1) tai
antavat daemonille uuden aloitteen (C). Päivityksen yli kumpikaan ei auta
enempää kuin A, koska ne kuolevat samalla tavalla. Jos käytössä näkyy, että
agentit jättävät muistutuksen huomiotta, C:n elävän Pi:n herätys voidaan
lisätä myöhemmin A:n päälle ilman, että A:ta puretaan. Silloin C:n
deduplikointiavain on jo olemassa, koska A:n muistutusmerkinnät kirjaavat
saman `run_id`-joukon.

## Päätökset myöhempää tarkistusta varten

- **`--notify` ei ole minkään vaihtoehdon pohjana.** Valitsin näin, koska
  luojan on muistettava se ajokohtaisesti eikä se kata huomiotiloja.
  Vaihtoehto olisi ollut ehdottaa Taskfleetiin "ilmoita luojalle" -oletusta.
  Se on Taskfleetin muutos, ja sen arvo riippuu C:stä.
- **Mikään vaihtoehto ei käynnistä pysäytettyä Pi:tä.** Luin Jarin
  27.10. päätöksen (`proto-wake-stopped-agent`) niin, että se koskee myös
  workereiden valmistumista, ei vain vanhoja keskusteluja.
- **Muistutus kerran joukkoa kohti, ei kerran vuoroa kohti.** Kerran
  vuoroa kohti muistuttaisi jokaisen vuoron lopussa agenttia, joka on jo
  perustellusti päättänyt olla odottamatta. Vaihtoehto oli enimmäismäärä
  aikaikkunaa kohti.
- **Muistutuksen komento käyttää `--any`-muotoa.** Kapellimestari haluaa
  reagoida ensimmäiseen valmistuneeseen. `--all` vähentäisi
  uudelleenvirityksiä, mutta viivästyttäisi reagointia. Agentti voi valita
  toisin.
- **Löydetty vika kirjattiin intake-issueksi `companion-wait-grammar-drift`
  eikä korjattu tässä,** koska tehtävä kielsi tuotantokoodin muuttamisen.
