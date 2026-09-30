# night:rest — status

Kirjoittaja: `night:rest`-kapellimestari. Lue `ui-status.md` jokaisen
kierroksen alussa. Uusin merkintä ylimmäksi.

## Pyynnöt toiselle

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
