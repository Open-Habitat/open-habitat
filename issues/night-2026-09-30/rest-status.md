# night:rest — status

Kirjoittaja: `night:rest`-kapellimestari. Lue `ui-status.md` jokaisen
kierroksen alussa. Uusin merkintä ylimmäksi.

## Pyynnöt toiselle

- **UI (01:10): rest on lopettanut yön, joten UI kirjoittaa aamulla
  TODO.md:n "Continue here" -lohkon ja lähettää `notify-jari`-viestin.**
  Rest-osuus lohkoon on alla olevassa loppuraportissa.
- **UI (01:10): 23:20-pyyntö on laskeutunut.** Fake-Pi tuottaa viivästetyt
  deltat ja korreloidun `bash`-työkalukutsun oikean controllerin kautta.
  Ota käyttöön kutsulla `GET /fixture/scenario?value=pi-deltas` ennen tuoretta
  promptia ja palauta `value=ready` sen jälkeen. Ohje on
  `build-agent-control/result.md`:n viimeisessä "Browser request" -kohdassa,
  esimerkkinä `test/browser-host/deltas.mjs`. Gate vihreä `d448965`:ssä.
- **UI (22:15): 18:55-pyyntö on laskeutunut.** Mukana ovat vuoron
  asettumismerkki ja aikaleima, lähetyskohtainen kuittaus
  (`pending | accepted | rejected | uncertain`) sekä saapuva kysymys
  validoituna turvallisena tekstinä. Gate vihreä `73b9c7b`:ssä, run
  `01m3t3jyvsa3e9w2p5w24jbgf0`. Kentät ovat `build-agent-control/result.md`:n
  viimeisessä "Browser request for night:ui" -kohdassa. Kysymys on vain
  näytettäväksi: tavallinen viesti ei vastaa Pi:n extension-dialogiin (ks.
  Jarille alla).
- **UI (21:35): `/api/v1/events` on palvelinpuolella valmis.** Mukana ovat
  deltat, atominen `live_tail` ja `history.entry`, gate vihreä `3ba75e3`:ssa.
  Kulutussäännöt ovat `issues/build-agent-control/result.md`:n viimeisessä
  kohdassa "Browser request for night:ui":
  1. Näytä ensin snapshotin `live_tail`, avaa sitten `?after=<event_cursor>`.
     Sovella vain seuraavaa sequencea. Aukko, 409 tai invalidointi → uusi
     snapshot.
  2. `assistant.delta` / `content_index`, `tool.started` / `tool.finished`
     / `tool_call_id`.
  3. Assistantin `history.entry` korvaa koko väliaikaisen vuorohännän.
  4. `ring_truncated` → HTTP-varapolku.
- **UI (21:35): 18:55-pyyntö työn alla.** Run `01m3t3jyvsa3e9w2p5w24jbgf0`
  tuottaa vuoron asettumismerkin ja aikaleiman, lähetyksen kuittauksen ja
  saapuvan kysymyksen turvallisena tekstinä.
- **UI (21:35): 21:20-pyyntö (etunimi ja sähköposti) jää Jarille.**
  `decide-account-display` jättää luotettavan tietolähteen valinnan auki.
  Pidä "Oma tili".
- **UI (20:10): jatkettavuushavainto on laskeutunut, UI:n 19:40-esto on
  purettu.** Statuksessa (`GET /api/v1/conversations/{id}/status` ja
  väliaikaisen virran resnapshot) on kenttä `continuation`, jonka arvot ovat
  `eligible`, `writer_present`, `read_only_history` ja `unproven`. Näytä
  Jatka vain, kun arvo on `"eligible"`. Päättelyä `state: uncertain`-tilasta
  tai luettavasta historiasta ei tarvita. Jatkaminen on yksi bodyton `POST
  .../continue` nykyisellä CSRF:llä, ja reitti tarkistaa kaiken uudelleen
  (`writer_conflict`, `read_only_history`, `control_uncertain`, 503).
  Epäselvän vastauksen jälkeen luetaan status uudelleen eikä lähetetä
  mitään automaattisesti. Gate vihreä `ed1328e`:ssä, run
  `01m3sxhr34qgbkyqc4vycx2qa3`. UI:n 18:55-pyyntö (asettumisen aikaleima,
  vastaanottokuittaus) ei vielä sisältynyt tähän.
- **UI (uusi 18:45): jatka-painike päättyneeseen selainkeskusteluun.**
  Palvelinreitti on laskeutunut. Tarkka sopimus on
  `issues/build-agent-control/result.md`:n kohdassa "Browser request for
  night:ui": ilman bodya lähetettävä `POST
  /api/v1/conversations/{id}/continue` CSRF:n kanssa. Näytettävät tilat ovat
  `writer_conflict`, `read_only_history`, `control_uncertain` ja
  `prior_outcome:"uncertain"`; mitään ei lähetetä automaattisesti uudelleen.
  Sovita tämä `fit-conversation-v2`een tai omaksi issuekseen.
- **UI: `fit-onboarding-v2` ei voi edetä tänä yönä.** Sen esto
  `show-large-clone-progress` odottaa Jarin arkkitehtuuripäätöstä
  kloonauksen levykiintiön valtuudesta (ADR 0005 vaatii 20 GiB:n
  yrityskohtaisen kovan rajan, jota mapped-UID-daemon ei voi asettaa).
  Aiemman ajon `01m3p7y1w4nsh2wdjjj72341j1` säilötty työpuu pitää kaistaa
  `github-clone-progress` ja tokenit `internal/daemon/github_clone_linux.go`,
  `web/src/app/GitHubOnboarding.tsx`. `rest` ei tee sitä yöllä.
- **UI: agenttiohjauksen selainosa tulossa.** `build-agent-control`in
  daemon/gateway/sopimus-viipale on käynnissä. Jos se tarvitsee
  selainmuutoksen (jatka päättynyttä keskustelua, replay), pyyntö tulee
  tähän ja `issues/build-agent-control/result.md`:hen otsikolla
  "Browser request for night:ui". Generoidut `web/src/contracts/` voivat
  muuttua sen mukana; älä muokkaa niitä käsin.

## Kierrokset

### Loppuraportti 2026-10-01 01:15 UTC — rest lopetti, frontier tyhjä

**Yhteenveto.** `night:rest` ajoi yhdeksän kierrosta ja yksitoista omaa
ajoa. Kaikki laskeutuivat (`landed: true`), kukin täydellä puhtaalla
gatella ja riippumattomalla tai kohdennetulla katselmoinnilla. Kaksi ajoa
estyi ensin, ja niiden työ harvestoitiin uusintaan. Mitään ei ole käynnissä.
Jäljellä olevat rest-päät odottavat Jaria. Testijulkaisua **ei tehty**, ks.
päätökset.

**Laskeutui**
- `build-agent-control`, palvelinpuoli kokonaan:
  - päättyneen selainkeskustelun jatkaminen ja `continuation`-havainto;
  - `/api/v1/events`: snapshot, `live_tail`, deltat, työkalut,
    `history.entry`, `queue.changed` ja aukoton toisto;
  - vuoron asettuminen, lähetyskuittaukset ja kysymys turvallisena tekstinä;
  - fake-Pi:n deltaskenaario labiin.

  Issue on yhä `in-progress`: oikean Pi:n selainmatka puuttuu.
- `prove-jit-guest-isolation`: oikea broker-SIGKILL `account`-vaiheessa
  kertakäyttöisessä vieraassa. Uudelleenkäynnistetty broker kieltäytyy
  pending-vartijassa, ja B:n kirjautuminen evätään. Issue on auki
  uudelleenkäynnistyssmoken takia.
- Rethink-läpikäynti 19 issuelle (`rethink-project-docs`-taulukko).

**Testattavaa (synteettinen):** jatkaminen, live-virta ja kuittaukset labissa,
kun UI:n johdotus on laskeutunut. Fixture-skenaario on `pi-deltas`.

**Päätökset Jarille**
1. **Testijulkaisu.** Fleetrepon `RELEASE-UPGRADE.md`:n fresh-six pilot.12 →
   seuraaja -operaattori on merkitty "NOT approved or exercised live", ja
   Jarin on hyväksyttävä se ja sen käänteinen ennen ensimmäistä live-ajoa.
   Siksi julkaisua ei asennettu, eikä arkistoa rakennettu turhaan
   vanhentumaan. Suositus: Jari hyväksyy operaattorin, minkä jälkeen
   seuraava kierros leikkaa pilot.14:n nykyisestä mainista ja asentaa sen.
2. **`show-large-clone-progress`**: kuka saa asettaa kloonauskohtaisen
   20 GiB:n kiintiön (ADR 0005)? Säilötty `blocker.md` haarassa
   `wt/jjj72341j1-bounded-clone-progress` sisältää suosituksen
   (project quota + kapea etuoikeutettu operaatio). Estää myös UI:n
   `fit-onboarding-v2`n.
3. **Pi:n extension-dialogi** voi jättää lähetyksen kuittaamatta, eikä
   tavallinen viesti vastaa siihen. Lisätäänkö vähintään peruutus, vai
   keskeytetäänkö tällainen vuoro?
4. **`manage-agent-worktrees`**: rethinkissä havaittu ristiriita. Onko
   worktree-agentti vain luettava Taskfleet-terminaaliagentti vai daemonin
   hallitsema kirjoittava Pi?
5. **`plan-second-user-admission`**: testipalvelimen `oauth.access`-asetus ja
   vapaaehtoinen toisen käyttäjän koe.
6. **Tilin etunimi ja sähköposti** (UI:n pyyntö): luotettava tietolähde on
   valitsematta (`decide-account-display`).

**Keskusteltavaa**
- Pending-journaali sulkee myös terveen käyttäjän selainistunnot
  (globaali fail-closed). Se on tarkoituksellista, mutta yksi keskeytynyt
  tilinluonti estää kaikkien selainkäytön, kunnes asia on selvitetty.
- Workerit (pi-harness, `capable`) laskeutuivat usein pienemmän viipaleen
  kuin briefi pyysi. Tiukka yhden tuotoksen briefi auttoi.

**Säilötyt orvot (laskeutuneet, poisto Jarin päätös `taskfleet run
discard`illa):** `wt/tyd429hmz8-agent-control-resume` (run
`01m3snj56qfh0t14tyd429hmz8`) ja `wt/2wc9r2dt81-jit-broker-crash` (run
`01m3t5zsczrk74q32wc9r2dt81`). Kummankin sisältö on harvestoitu mainiin.
Vanha `wt/jjj72341j1-bounded-clone-progress` ei ole tämän yön ajo.

**Spin-offit:** ei uusia issueita. Agenttiohjauksen jäljellä oleva työ on
`build-agent-control`issa.

### Kierros 9 — valmis 2026-10-01 01:10 UTC

Broker-kaatumiskokeen uusinta laskeutui (run `01m3te2fwt5a1c144310zjgy4v`,
gate vihreä `4dcd292`:ssa). Syy oli overlayn väärin instrumentoitu
vartija, ei tuotevirhe. Fake-Pi-deltat laskeutuivat (run
`01m3te2f3gns60f09kxys03h1v`).

### Kierros 8 — estyi 2026-10-01 00:30 UTC; kierros 9 käynnissä

Broker-kaatumiskoe (run `01m3t5zsczrk74q32wc9r2dt81`) estyi. Oikea SIGKILL
`account`-vaiheessa saatiin aikaan, ja B:n kirjautuminen evättiin. Katselmointi
kuitenkin osoitti, ettei alkuperäinen läpimeno todistanut pending-vartijan
aiheuttaneen kieltäytymistä: uudelleenkäynnistetty broker pysähtyy jo
config/socket-tarkistukseen. Työpuussa on 13 säilöttyä committia.

Havainto Jarille: pending-journaali sulkee myös terveen A:n selainistunnon
(401). Se on tarkoituksellista globaalia fail-closed-käytöstä, ei
sisarkäyttäjän riippumatonta saatavuutta.

**Kierros 9 (rinnakkain):**
- `01m3te2fwt5a1c144310zjgy4v`: broker-kokeen uusinta harvestilla, aikaraja
  90 min. Selvitetään, onko kyse tuotevirheestä (kaatunut broker ei
  käynnisty uudelleen) vai fixture-ajautumasta.
- `01m3te2f3gns60f09kxys03h1v`: UI:n 23:20-pyyntö. Fake-Pi tuottaa
  korreloidut `tool_call_id`t ja viivästetyt deltat oikean controllerin
  kautta.

**Julkaisu:** testijulkaisu tehdään, kun UI:n kaista on laskeutunut, viimeistään
noin klo 03:00 UTC.

### Kierros 7 — valmis 2026-09-30 22:15 UTC; kierros 8 käynnissä

Vuoron asettuminen, lähetyskuittaukset ja kysymykset turvallisena tekstinä
laskeutuivat (ks. pyynnöt). `build-agent-control`in palvelinpuoli on nyt
kokonaan tehty. Jäljellä ovat selaimen johdotus (UI), oikean Pi:n
selainmatka (Jari/live) ja alla oleva dialogipäätös.

**Jarille:** Pi:n vastausta odottava extension-dialogi voi pitää lähetyksen
kuittaamatta, eikä tavallinen selainviesti ratkaise sitä. Aiempi rajaus
jätti dialogin vastaus- ja peruutusohjaimet pois. Päätettävä on, lisätäänkö
vähintään peruutus vai hyväksytäänkö jumittuva vuoro keskeytettäväksi.

**Kierros 8:** `prove-jit-guest-isolation`in rajattu broker-kaatumiskoe
paikallisessa rootless-QEMU-vieraassa. Aldera ei muuteta, eikä testipalvelinta
käynnistetä uudelleen. Uudelleenkäynnistyssmoke jää Jarille.

### Kierros 6 — valmis 2026-09-30 21:30 UTC

Palvelinpuolen tapahtumavirta on valmis (run `01m3t1a2fq14zkjjk6jk6pnq2f`).
Katselmointi korjasi kolme löydöstä. Pinned-Pi-fixture näki oikean
RPC-deltan snapshotissa kesken vuoroa, jatkoi cursorista ja tavoitti
JSONL-avaimellisen entryn. Natiivia tool-call-virtaa, Chromium-renderöintiä
ja oikeaa provideria se ei kattanut. Kierros 7 käynnissä (ks. pyynnöt).

### Kierros 5 — valmis 2026-09-30 20:50 UTC

`/api/v1/events` julkaisee nyt `history.entry`-tapahtumat Pi:n natiivin
JSONL:n `native_key`llä, ja myös toisto toimii niille (run
`01m3sz1qj3xacasjmxcqz4x41w`; gate vihreä, erillis-UID:n Pi-fixture läpi).
Deltat ja atominen `live_tail` puuttuvat vielä, ja ne tulevat kierroksella 6.
UI:lle: `history.entry` on jo käytettävissä, mutta pidä status- ja
historiahaku varapolkuna.

### Kierros 4 — valmis 2026-09-30 20:10 UTC

Jatkettavuushavainto laskeutui (ks. pyynnöt). Status ja continue käyttävät
samaa tarkistusfunktiota. Katselmointi korjasi kaksi löydöstä; Go race -testit,
erillis-UID:n pinned-Pi-fixture ja täysi gate menivät läpi.

### Kierros 3 — valmis 2026-09-30 19:50 UTC; kierros 4 käynnissä

**Laskeutui** (run `01m3svy0w0qr4ttyfxp1yq30wb`, gate vihreä `0985610`:ssa,
katselmointi korjasi yhden gatewayn validointiregression). `/api/v1/events`
lähettää nyt myös `queue.changed`-havainnot. Se ei ole komentokuittaus. Deltat,
`history.entry` ja snapshotin `live_tail` puuttuvat edelleen.

**UI:n 19:40-pyyntö otettu, kierros 4:** run `01m3sxhr34qgbkyqc4vycx2qa3`
lisää statukseen positiivisen jatkettavuushavainnon (esim.
`continuation: eligible | writer_present | read_only_history | unproven`).
Havainnolla ja continue-reitillä on yhteinen tarkistusfunktio. Tarkka kenttä
kirjataan tähän, kun ajo laskeutuu. UI:n 18:55-pyyntö (vuoron asettumisen
aikaleima, lähetyksen vastaanottokuittaus) on samassa ajossa valinnaisena.

### Kierros 2 — valmis 2026-09-30 19:20 UTC

**Laskeutui** (`build-agent-control`, run `01m3sszrzjyp781twe94y7g5g4`, gate
vihreä `7371131`:ssä, riippumaton katselmointi korjauksineen). Uusi
`GET /api/v1/events?after=` antaa snapshotin watermarkin ja rajatun,
toistettavan SSE-virran. `ev1`-cursorit, `Last-Event-ID`, `409
cursor_expired` ja `409 cursor_instance_mismatch` toimivat. Virta on toistaiseksi
**vain invalidointi**: se lähettää `snapshot.invalidated`-tapahtuman, jonka
jälkeen selain hakee tilan uudelleen. Rakenteiset history-, jono- ja
workspace-tapahtumat sekä snapshotin `live_tail` puuttuvat vielä. UI:lle:
voit ottaa virran käyttöön invalidointisignaalina, mutta säilytä status- ja
historiahaku varapolkuna.

**Seuraava kierros:** rakenteiset tapahtumat ja `live_tail`.

### Kierros 1 — valmis 2026-09-30 18:45 UTC

**Yhteenveto.** Kaikki kolme omaa ajoa ovat laskeutuneet, eikä mitään ole
käynnissä. Deployta ei tehty: testijulkaisu tehdään vasta, kun myös UI:n yön
työ on laskeutunut.

**Laskeutui**
- Päättyneen selainkeskustelun jatkaminen, palvelinpuoli
  (`build-agent-control`, run `01m3spz5wm8rr136atrn7kex10`, commitit
  `2875d44`…`fb3730d`). `POST /api/v1/conversations/{id}/continue` toimii vain
  hostin luomalle keskustelulle. Ennen jatkamista tarkistetaan owner-lukko,
  lapsiprosessin reappaus ja asettunut natiivihistoria. Terminaalihistoria jää
  vain luettavaksi, eikä epävarmaa lähetystä toisteta. Lisäksi väliaikainen
  virta hylkää käytetyt cursorit (409). Täysi puhdas gate ja erillis-UID:n
  pinned-Pi-fixture (end → continue → send, restart, terminaalihistorian
  hylkäys) menivät läpi, samoin riippumaton katselmointi korjauksineen.
  Issue on yhä `in-progress`: yleinen `/api/v1/events`-replay ja oikean Pi:n
  selainmatka puuttuvat.
- Rethink-läpikäynti 19 issuelle (fan-out `01m3snkgxx4jnmzm0enbzyw40v`).
  Taulukko on `rethink-project-docs`issa (korjatut main-hashit `2189181`).
  Yksi ristiriita jätettiin Jarille: `manage-agent-worktrees`.
- Ensimmäinen agenttiohjausyritys `01m3snj56qfh0t14tyd429hmz8` luovutti
  jatkamisen kesken. Sen commitit harvestoitiin, ja ajon säilötty haara
  `wt/tyd429hmz8-agent-control-resume` on nyt orpo. Poisto on erillinen
  `taskfleet run discard` -päätös.

**Testattavaa (synteettinen):** jatkamisreitti fixture-tasolla. Selaimessa ei
vielä ole jatka-painiketta (UI-pyyntö yllä).

**Jarille**
- `show-large-clone-progress`: kiintiövaltuuspäätös (ks. pyynnöt).
- `plan-second-user-admission`: testipalvelimen `oauth.access`-asetus ja
  vapaaehtoinen toisen käyttäjän koe.
- `manage-agent-worktrees`: onko worktree-agentti vain luettava
  Taskfleet-terminaaliagentti vai daemonin hallitsema kirjoittava Pi?

**Seuraava kierros:** `/api/v1/events`-snapshot ja replay-rengas
(`build-agent-control`in jäljellä oleva palvelinosa).
