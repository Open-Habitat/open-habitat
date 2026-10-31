# Vertailu: PI WEB (jmfederico) ja Pi Web (agegr)

Tutkimusajo `01m68hqw7xrvwbk3b46wyskqpk`, 31.10.2026. Lähteinä ovat kummankin
GitHub-repo ja lähdekoodi (PI WEB commitista [`ad06af3b`][jm-commit], Pi Web
commitista [`d128bae4`][ag-commit], molemmat luettu 31.10.2026), PI WEB:n
dokumentaatio, joka on samassa repossa (`docs/`) ja julkaistuna osoitteessa
pi-web.dev, Pi Webin README, CONTRIBUTING ja AGENTS.md, kummankin GitHub-issuet
ja PR:t, npm-rekisteri sekä Hacker Newsin Algolia-haku. Open Habitatin puoli on
luettu tiedostoista `docs/product.md`, `docs/operations.md`, juuren ja
`internal/`-hakemiston `AGENTS.md`-tiedostoista sekä koodista. Merkintä
**(lähde)** tarkoittaa, että asia lukee lähteessä tai koodissa, ja
**(päättely)** on oma tulkintani.

## Tiivistelmä

Pi:lle on kaksi samannimistä selainkäyttöliittymää, ja ne vastaavat eri
kysymyksiin. **PI WEB** (jmfederico/pi-web) on lähin olemassa oleva vastine
Open Habitatille *yhdelle ihmiselle*: palvelimella pysyvät Pi-istunnot,
selain ikkunana, worktreet, terminaali ja tiedostot. Sen keskeinen
rakenneratkaisu on erottaa pitkäikäinen istuntodaemon (`pi-web-sessiond`,
joka ajaa Pi:tä SDK:lla omassa prosessissaan) verkko- ja API-palvelusta, jotta
käyttöliittymän päivitys ei katkaise agentin työtä. Monikäyttäjäisyys on
rajattu pois sanatarkasti ("not a sandbox or a multi-tenant platform"), eikä
tuotteessa ole kirjautumista lainkaan. Natiivihistorian päälle se on kasvattanut
useita omia varastoja, ja arkistointi siirtää Pi:n omat istuntotiedostot pois
Pi:n hakemistosta. **Pi Web** (agegr/pi-web) on suosituin (noin 7 900 tähteä)
ja tarkoituksella kevyt: yksi Next.js-palvelin, joka ajaa Pi:n SDK:ta samassa
prosessissa, purkaa joutilaan istunnon muistista kymmenen minuutin jälkeen ja
lähettää Web Push -ilmoituksen, kun ajo valmistuu. Sen laajuussääntö ("jos
asian voi tehdä Pi-laajennuksena, se ei kuulu Pi Webiin") on käytännössä sama
periaate kuin Open Habitatin natiivien komponenttien uudelleenkäyttö.
Open Habitatille tärkein opetus on PI WEB:n prosessijako: Open Habitatin
päivitys katkaisee nyt jokaisen käynnissä olevan selainkeskustelun, koska Pi
on daemonin lapsiprosessi. Toinen on Pi Webin Web Push -toteutus, jonka
korjaushistoria on valmis tarkistuslista iOS:n sudenkuopista. Kolmas on
joutilaiden Pi-prosessien purku sivun uusiman vuokran perusteella. Open
Habitat on jo parempi siinä, mitä kumpikaan ei yritä: ihmiset erotetaan
Unix-tunnuksin, selain tunnistetaan, arkistointi ei koske Pi:n tiedostoihin
ja kahden kirjoittajan tilanne tarkistetaan ennen jatkamista.

## 1. Mitkä kaksi "Pi Webiä"

Nimi on yhteinen, ja HN-kommentoija huomauttaa siitä itse: "there's more than
one with that name" ([HN 49929275][hn1]) **(lähde)**.

- **PI WEB** (isoin kirjaimin), github.com/jmfederico/pi-web, npm
  `@jmfederico/pi-web`, sivusto pi-web.dev.
- **Pi Web**, github.com/agegr/pi-web, npm `@agegr/pi-web`, demo
  agegr.github.io/pi-web.

Ehdokasraportti ehdotti kevyesti samaan ajoon myös **Pithagorasta**
(thecodacus/pithagoras, 297 tähteä, Apache-2.0). Se on Dockerissa ajettava
"hosted web UI", jonka ajot kuuluvat palvelimelle ja jossa "Every event pi
emits is appended to a log, so reconnecting replays exactly what you missed".
Mukana ovat myös kanavat (Telegram, Slack, Discord, Signal), roolit,
hyväksynnät, audit-loki, ajastetut rutiinit, oma muisti ja median generointi
([README][pith]) **(lähde)**. Se on hyvä esimerkki siitä, mitä Open Habitat
ei rakenna: rinnakkainen tapahtumaloki natiivin historian rinnalla ja oma
alusta Pi:n ympärillä. En tutkinut sitä tämän tarkemmin.

## 2. Mitä ne ovat ja kenelle

**PI WEB** on "a web UI for Pi Coding Agent that keeps agent sessions running
in real workspaces on your machine or server" ([README][jm-readme])
**(lähde)**. Sen perustelu on sama kuin Open Habitatin: "Your laptop is a
window, not the workstation" ja "A browser disconnect should not stop an
agent" ([Remote-first][jm-remote]) **(lähde)**. Kohderyhmä on yksittäinen
kehittäjä, jolla on yksi tai useampi aina päällä oleva kone (dev box,
kotipalvelin, pilvi-VM) ja joka valvoo siellä ajettavia agentteja eri
laitteilta. Malli on Machine → Project → Workspace (esim. git worktree) →
Session ([README][jm-readme]) **(lähde)**. Asennus tehdään käyttäjän omiksi
systemd-käyttäjäpalveluiksi (`pi-web install`, `pi-web doctor`), ja
kuunteluosoite on oletuksena `127.0.0.1:8504` **(lähde)**.

**Pi Web** on "Local browser UI for the pi coding agent", joka "uses the same
local configuration and session files as pi, so you can browse and resume
conversations, run agent turns, configure models and resources, and inspect
project files from a browser" ([README][ag-readme]) **(lähde)**. CONTRIBUTING
kuvaa tarkoituksen kahdella lauseella: tehdä selaimessa se, minkä terminaali
tekee huonommin, ja käyttäytyä kuin Pi ([CONTRIBUTING][ag-contrib])
**(lähde)**. Käynnistys on `npx @agegr/pi-web@latest`, ja palvelin kuuntelee
oletuksena osoitetta `127.0.0.1:30141`. Kohderyhmä on Pi:n käyttäjä omalla
koneellaan, ja puhelin tai toinen kone luotetussa lähiverkossa on
toissijainen käyttötapa **(lähde + päättely)**. Käyttöliittymä on englanniksi
ja kiinaksi, ja kehittäjäyhteisö on suurelta osin kiinankielinen
(issueita kirjoitetaan kiinaksi) **(lähde)**.

## 3. Arkkitehtuuri

### 3.1 PI WEB (syvä)

**Missä prosessit ajetaan.** PI WEB koostuu kahdesta prosessista: verkko- ja
API-palvelimesta (`pi-web-server`, Fastify) ja istuntodaemonista
(`pi-web-sessiond`). Verkkopalvelin puhuu daemonille oletuksena Unix-socketin
`~/.pi-web/sessiond.sock` kautta ([`src/sessiond/config.ts`][jm-sdconfig])
**(lähde)**. Pi ajetaan daemonin sisällä Pi:n SDK:lla
(`createAgentSessionRuntime`, `createAgentSessionFromServices`,
[`piSessionService.ts`][jm-pss], noin 6 200 riviä) eikä erillisenä
`pi`-prosessina. Dokumentaatio sanoo tämän suoraan: "PI WEB runs every session
on its bundled Pi SDK", eli Pi:n versio tulee PI WEB:n paketin mukana, ja
`pi`-komentoa PATHissa vain tarkistetaan ([config.md][jm-config]) **(lähde)**.
Repon omat agenttiohjeet kertovat jaon tarkoituksen: "assume the session
runtime owner is long-lived and separate from the autoreloading UI/API
process. Browser disconnects and UI/API restarts should not stop active Pi
sessions" ([AGENTS.md][jm-agents]) **(lähde)**. Lupaus rajataan rehellisesti:
"A host shutdown or session-daemon restart can interrupt active work"
([Remote-first][jm-remote]) **(lähde)**. Myös terminaalit (node-pty) ja
palvelinpuolen pluginit ajetaan daemonissa, joten daemonin uudelleenkäynnistys
katkaisee ne ([Fleet][jm-machines]: "Server plugins run with the target
daemon's user permissions and can stall or crash its sessions and terminals")
**(lähde)**. tmuxia ei käytetä (koodihaku) **(lähde)**.

**Eristys ja valtuudet.** Valtuusraja on käyttöjärjestelmän käyttäjä, jona
palvelut ajetaan: "It can run commands and access files with the server user's
permissions" ([Remote-first][jm-remote]). README: "PI WEB assumes trusted
users, repositories, paths, and plugins. It is not a sandbox or a multi-tenant
platform. … Do not expose PI WEB directly to the public internet."
**(lähde)**. Sisäänrakennettua kirjautumista ei ole. Kun ulkopuolinen
kehittäjä toi salasanakirjautumisen PR:nä, ylläpitäjä epäröi, koska palvelu
toimii HTTP:llä ja salasana kulkisi salaamattomana: "it should be handled at
the proxy level and served via HTTPS; otherwise, it would give a false sense of
security" ([PR #99][jm-99]) **(lähde)**. Avoimena on ehdotus tarkoista Host-
ja Origin-sallituslistoista ([#154][jm-154]) sekä ylläpitäjän oma
kokeellinen "Safe Tunnel" Cloudflaren kautta, jossa "tunnel transport does not
authenticate PI WEB users" ([PR #155][jm-155]) **(lähde)**. Tiedostoselaimen
pääsyä voi rajata (`pathAccess.allowedPaths`), mutta dokumentaatio korostaa:
"This is not a sandbox for the underlying Pi Coding Agent or your OS user"
([config.md][jm-config]) **(lähde)**.

**Yksi vai monta käyttäjää.** Yksi. Jokainen selaimen, puhelimen tai Fleetin
kautta tuleva pyyntö on palvelun käyttäjä **(päättely lähteistä)**.

**Istunnot ja natiivi tila.** Istuntotiedostot ovat Pi:n omia: PI WEB lukee
Pi:n istuntohakemiston (`~/.pi/agent/sessions/…` tai `PI_CODING_AGENT_SESSION_DIR`)
ja avaa istunnon SDK:n `SessionManager.open`-kutsulla
([`piSessionManagerGateway.ts`][jm-gw]) **(lähde)**. Myös worktreet luetaan
Gitistä joka kerta, eikä niitä rekisteröidä: "PI WEB does not register
worktrees. It lists the git worktrees of the selected project on demand"
([FAQ][jm-faq]) **(lähde)**. Natiivin tilan päälle PI WEB pitää kuitenkin
omassa hakemistossaan `~/.pi-web` useita varastoja: projektirekisteri
(`projects.json`), koneet (`machines.json`), lukemattomuus
(`session-unread.json`), kiinnitykset, ilmoitukset, navigointijärjestys ja
arkiston indeksi (`archived-sessions.json`) ([`sessiond.ts`][jm-sessiond],
[config.md][jm-config]) **(lähde)**. Merkittävin poikkeama natiivista on
arkistointi: se kopioi Pi:n istuntotiedoston hakemistoon
`~/.pi-web/archived-sessions/` ja poistaa alkuperäisen
([`sessionArchiveStore.ts`][jm-archive]) **(lähde)**. Arkistoitu keskustelu
katoaa siis Pi:n omasta istuntolistasta myös terminaalissa **(päättely)**.
Tähän liittyy avoin ilmoitus mahdollisesta historian menetyksestä, kun
arkistokohde on jo olemassa ([#379][jm-379]) **(lähde)**.

**Terminaali ja selain samassa istunnossa.** En löytänyt koodista
kirjoittajalukkoa enkä tunnistusta sille, että terminaalissa ajettava `pi`
kirjoittaa samaan istuntotiedostoon (haut: `lock`, `another process`,
`external writer`, `flock`). Ainoa yhden kirjoittajan takuu koskee PI WEB:iä
itseään: yksi daemon per datahakemisto (`sessiond-owner.json`)
([config.md][jm-config]) **(lähde)**. PI WEB ei siis lupaa eikä tarkista
mitään terminaalin ja selaimen väliltä. Selain hakee näkyvän keskustelun
historian 30 sekunnin välein, ja "Activity indicators and chat delivery are
separate" ([FAQ][jm-faq], `SELECTED_SESSION_REFRESH_MS`) **(lähde)**.

**Miten selain tavoittaa natiivin tilan.** Selain → verkkopalvelin (HTTP ja
WebSocket) → Unix-socket → sessiond → SDK-istunto ja Pi:n tiedostot
**(lähde)**. Fleetissä avattu PI WEB toimii yhdyskäytävänä: "the browser keeps
talking to the current PI WEB origin. The gateway contacts the selected remote
PI WEB server", ja tunnukset, istunnot ja pluginit pysyvät kohdekoneella.
Yhdyskäytävä säilyttää valinnaisen bearer-tokenin ja lähettää sen kohteelle
([Fleet][jm-machines]) **(lähde)**.

**Ihminen silmukassa.** Agentit saavat PI WEB:n omia työkaluja: `ask_user`
(lomakekysymykset, jotka tallentuvat keskusteluun) ja
`request_human_intervention`, joka merkitsee istunnon **Needs input**
-tilaan, päättää ajon ja säilyy daemonin uudelleenkäynnistyksen yli. Tila
nousee työtilan, projektin ja koneen tasolle. Lisäksi on `spawn_session`,
seurattavat alaistunnot (`spawn_subsession`, `yield_to_subsessions`,
`manage_subsession`) ja istuntojen välinen `send_session_message`
([config.md][jm-config]) **(lähde)**. Käyttöjärjestelmän tai push-ilmoituksia ei
ole. Web Push on pyydetty ([#193][jm-193]), mutta se on avoinna **(lähde)**.

**Laajuus.** Pluginijärjestelmä selain- ja palvelinpluginein (git,
terminaali, tiedostot, mermaid, teemat, Workspace Tasks, ajastetut tehtävät
betana), Pi-pakettien hallinta, MCP-kirjautumiset, PWA ja teemat. Tuotantokoodia
on noin 116 000 riviä TypeScriptiä ilman testejä (`src` ja `pi-web-plugins`,
oma `wc -l`-mittaus) **(lähde: oma mittaus)**.

### 3.2 Pi Web (keskisyvä)

**Missä prosessit ajetaan.** Yksi Next.js-palvelinprosessi. Selaaminen ei
käynnistä agenttia: istuntolista ja historia luetaan Pi:n tiedostoista SDK:n
`SessionManager`-apureilla. Viestin lähetys luo SDK:n `AgentSession`in samaan
prosessiin (`startRpcSession()`, [`lib/rpc-manager.ts`][ag-rpc]), ja tapahtumat
virtaavat selaimeen SSE:nä ([AGENTS.md][ag-agents]) **(lähde)**. Pi:n paketit
on kiinnitetty tarkkoihin versioihin, koska irrallaan päivittyvät
alipaketit ovat rikkoneet asennuksia ([AGENTS.md][ag-agents]) **(lähde)**.
Palvelimen uudelleenkäynnistys katkaisee siis kaikki ajot **(päättely)**.

**Joutilaat istunnot.** Muistissa oleva istunto suljetaan, kun se on ollut
joutilaana `PI_WEB_IDLE_TIMEOUT_MS` (oletus 10 min). Käynnissä olevaa ajoa ei
suljeta, vaan ajastin alkaa alusta. Sivu, jossa istunto on valittuna, uusii
vuokran (`POST /api/agent/[id]/lease`), joten suljetun välilehden istunto
puretaan yhden aikakatkaisun jälkeen. Pi-laajennus, jolla on irrallista
taustatyötä, voi estää purun rekisteröitymällä versioituun
liveness-rekisteriin. Jos Stop ei saa ajoa pysähtymään, istunto puretaan
pakotetusti oletusajan jälkeen ([README][ag-readme], [`rpc-manager.ts`][ag-rpc])
**(lähde)**. Jatkaminen tapahtuu Pi:n tiedostosta **(lähde)**.

**Terminaali ja selain samassa istunnossa.** Pi Web tunnistaa yhden tapauksen:
jos istuntotiedostossa on merkintä, jota muistissa oleva istunto ei tunne
("another pi process appended"), joutilas kääre puretaan ja tiedosto luetaan
uudelleen (`evictIfDiskAhead`) ([`rpc-manager.ts`][ag-rpc]) **(lähde)**.
Lukitusta tai ajon aikaista suojausta ei ole **(päättely koodista)**.

**Eristys ja valtuudet.** Yksi käyttäjä. Oletuksena kuunnellaan vain
loopbackia. Etäkäyttöön on yksi salasana `PI_WEB_PASSWORD` (API-asiakkaille
Basic Auth käyttäjänimellä `pi`) ja tarkka sallittujen hostien lista
`PI_WEB_ALLOWED_HOSTS`. README varoittaa: "Binding to a non-loopback address
exposes an agent that can execute high-privilege actions" ja "Do not expose Pi
Web over plain HTTP to the internet" ([README][ag-readme]) **(lähde)**.
Tiedostoselain on rajattu valittuihin työhakemistoihin ja tunnettuihin
projektijuuriin **(lähde)**.

**Omat varastot.** Kiinnitykset, arkisto, projektien järjestys ja nimet ovat
tiedostossa `~/.pi/agent/pi-web-session-state.json`, ja push-tilaukset ja
VAPID-avaimet tiedostossa `~/.pi/agent/web-push.json` (tila 600)
([`session-ui-state.ts`][ag-uistate], [`web-push.ts`][ag-push]) **(lähde)**.
Arkistointi on pelkkä merkintä, eikä se siirrä Pi:n tiedostoja **(lähde)**.
Poisto poistaa Pi:n istuntotiedostot **(lähde)**.

**Web Push.** Toteutus on pieni ja kokonainen:

- Palvelin luo VAPID-avainparin ensimmäisellä kerralla ja tallentaa sen ja
  tilaukset tiedostoon atomisesti. Tilaus lisätään tai korvataan
  endpointin perusteella, ja 404- tai 410-vastauksen saanut tilaus poistetaan
  ([`web-push.ts`][ag-push]) **(lähde)**.
- Ilmoitus lähetetään, kun ajo valmistuu. Aliagenttien ilmoitukset on
  vaimennettu (`suppressCompletionNotifications`), ja otsikkona on istunnon
  nimi. `tag` on istuntokohtainen, joten saman istunnon ilmoitukset
  korvaavat toisensa ([`rpc-manager.ts`][ag-rpc]) **(lähde)**.
- Selain tilaa pushin vasta, kun ilmoituslupa on annettu, ja jättää sen
  hiljaa väliin, jos selain ei tue sitä (esim. iOS Safari ennen 16.4:ää tai
  muu kuin PWA). Silloin käytetään sivun sisäistä ilmoitusta
  ([`push-client.ts`][ag-pushclient]) **(lähde)**.

Kiinnostavinta on korjaushistoria. PR [#728][ag-728] löysi tuotannossa kolme
syytä sille, ettei iOS-taustatoimitus toiminut koskaan: (1) Apple hylkää
VAPID-subjectin `mailto:pi-web@localhost` virheellä 403 BadJwtToken, ja
subjectin on oltava kelvollinen `https:`- tai `mailto:`-URL; (2) jos service
worker käsittelee pushin näyttämättä ilmoitusta (esim. koska ikkuna on
näkyvissä), iOS peruu tilauksen eikä kerro siitä palvelimelle, koska
`pushsubscriptionchange` ei laukea ja APNs palauttaa edelleen 201; (3) ilman
`Urgency: high` -otsaketta iOS voi lykätä toimitusta. Lisäksi lupa on
pyydettävä käyttäjän eleestä, joten asetuksiin lisättiin "rekisteröi push"
-painike, joka toimii myös korjauspolkuna hiljaa perutulle tilaukselle
**(lähde)**. Myöhemmin korjattiin väärä "valmis"-ilmoitus, kun
laajennuskomento käsiteltiin ilman mallin ajoa ([#1345][ag-1345]) **(lähde)**.

**Laajuussääntö.** CONTRIBUTING hylkää etukäteen muun muassa muutokset siihen,
mitä Pi itse tekee, ominaisuudet, jotka voisivat olla Pi-laajennuksia
(esimerkkeinä ajastetut viestit, omat komennot ja uudet providerit), Pi Webin
omat asetustiedostot tai laajennusrajapinnan kentät, IDE- ja Git-asiakkaan
ominaisuudet, uudet alijärjestelmät ("schedulers, long-running background
agents, a plugin or UI-slot system") sekä laajemman istuntojen hallinnan. UI-
säännöissä on "Show each fact once, in the place where pi produces it" ja "One
good default beats a setting" ([CONTRIBUTING][ag-contrib]) **(lähde)**.
Tuotantokoodia on silti noin 104 000 riviä (oma mittaus `app`, `components`,
`hooks`, `lib`, `bin` ilman testejä) **(lähde: oma mittaus)**.

**Pi:n natiivit ominaisuudet selaimessa** (README, AGENTS.md:n tiedostokartta)
**(lähde)**:

| Pi:n natiivi ominaisuus | Pi Web | PI WEB | Open Habitat |
|---|---|---|---|
| Istuntojen selaus projekteittain, jatkaminen | Kyllä | Kyllä | Kyllä (työtilat `~/src`:stä) |
| Istunnon nimi | Nimeä, automaattinen nimi | Pi-laajennus nimeää | Pi:n natiivi nimi, oma mallikutsu |
| Haarautus: uusi istunto aiemmasta viestistä | Kyllä ("New session", "Fork") | Fork ja clone (mainitaan alaistuntojen yhteydessä) | Ei |
| Haarautus saman istunnon sisällä (Pi:n puu) | Kyllä ("Edit from here") | Puunavigointi (aktiviteettitilat `navigatingTree`) | Ei |
| Vienti (HTML) | Kyllä | En löytänyt | Ei Pi:n vientiä (agentin näkymät ovat eri asia) |
| Mallin ja ajattelutason vaihto | Kyllä | Kyllä | Kyllä |
| Kontekstin käyttö, kustannus, kompaktointi | Kyllä | Kyllä | Kyllä (kontekstinäkymä) |
| Kirjautumiset ja API-avaimet | Kyllä | Kyllä | OpenAI- ja muut kirjautumiset Pi:n kautta |
| Skillit, Pi-paketit, MCP | Kyllä | Kyllä | Osittain (integraatiot) |
| Laajennusten dialogit | Kyllä | Kyllä | Kysymykset: teksti, valinta, vahvistus |
| Push-ilmoitus | Web Push | Ei | Ei (rajattu ulos) |

Open Habitatin sarake perustuu tiedostoihin `docs/product.md` ja
`contracts/v1/` (esim. `context-detail.schema.json`, `pi-models.schema.json`).
Haarautuksen puuttumisen päättelin siitä, ettei sopimuksissa tai
käyttöliittymätekstissä esiinny forkia **(päättely)**.

## 4. Kypsyys ja lisenssi

Mittaukset GitHub API:sta ja npm-rekisteristä 31.10.2026 **(lähde)**:

| Mittari | PI WEB | Pi Web |
|---|---|---|
| Repo luotu | 7.5.2026 | 22.3.2026 |
| Tähdet / forkit | 916 / 185 | 7 938 / 1 188 |
| Avoimet issuet ja PR:t | 59 | 16 |
| Pääkehittäjä | jmfederico, 1 768 committia (seuraava 7) | agegr, 791 committia (seuraava 15) |
| npm-lataukset 30.9.–29.10. | 10 169 | 23 408 |
| Julkaisuja npm:ssä | 41, uusin 1.202610.9 | 107, uusin 0.13.0 |
| Lisenssi | MIT | MIT |
| Hinta | Ilmainen | Ilmainen |

Molemmat ovat käytännössä yhden ihmisen ylläpitämiä ja nopeasti muuttuvia.
PI WEB:n ohjeissa on paljon kohtia, joissa päivitys vaatii daemonin
käsin tehtävän uudelleenkäynnistyksen ja varoittaa sen katkaisevan työn, ja
gatewayn ja kohdekoneen on päivitettävä yhtä aikaa ("mixed-version plugin
operation is unsupported") ([Fleet][jm-machines]) **(lähde)**. PI WEB:n
issuet ja PR:t kirjoitetaan ja katselmoidaan pitkälti tekoälytyönkulun kautta
(merkintä "Automatically generated by the user's AI workflow"), ja
ylläpitäjä vaatii yhden päätöksen issueta kohden ([#154][jm-154]) **(lähde)**.
Riippumattomia ääniä on vähän. HN:ssä PI WEB:iä käytetään etäorkestrointiin:
käyttäjä ajaa paikallista mallia ja lippulaivamallia rinnakkain, tilaa
alaistunnon ja katselmoi ([HN 49929275][hn1]), ja sitä mainitaan herdrin,
firstmaten ja Orcan rinnalla ([HN 49100596][hn2], [HN 49121360][hn3])
**(lähde)**. Pi Webistä en löytänyt HN-mainintoja hakusanalla "agegr" tai
"pi-web" **(lähde: haku)**.

## 5. Rinnakkain Open Habitatin kanssa

| | PI WEB | Pi Web | Open Habitat |
|---|---|---|---|
| Ensisijainen pääsy | Selain ja PWA yksityisverkon kautta | Selain samalla koneella tai lähiverkossa | Selain (työpöytä ja puhelin) julkisen osoitteen takana, SSH ja tmux rinnalla |
| Käyttäjiä | Yksi, "not … multi-tenant" | Yksi | Monta ihmistä, kukin omalla Unix-tunnuksellaan |
| Tunnistus | Ei ole. Proxy tai VPN | Yksi salasana ja sallitut hostit | GitHub-kirjautuminen gatewayssa, ylläpitäjän pääsypäätös, broker luo tilin |
| Missä Pi ajetaan | SDK pitkäikäisessä `sessiond`-prosessissa | SDK verkkopalvelimen prosessissa | `pi --mode rpc` daemonin lapsena, ihmisen tunnuksella |
| Mikä katkaisee ajon | Daemonin tai koneen uudelleenkäynnistys. Ei UI- tai API-päivitys | Palvelimen uudelleenkäynnistys | Daemonin uudelleenkäynnistys, myös jokainen julkaisupäivitys (`docs/operations.md`) |
| Pi:n versio | PI WEB:n mukana tuleva SDK | Tarkasti kiinnitetty SDK | Kiinnitetty Node/Pi-puu (`pi-runtime.json`) |
| Historia | Pi:n tiedostot + omat varastot `~/.pi-web`:ssä | Pi:n tiedostot + UI-tila ja push-tiedosto `~/.pi/agent`:ssa | Pi:n tiedostot. Esitysmerkinnät työtilan `user-state.json`:ssa |
| Arkistointi | Siirtää Pi:n tiedoston omaan hakemistoonsa | Merkintä | Merkintä, Pi:n historia ennallaan (`archive_linux.go`) |
| Terminaali + selain samassa keskustelussa | Ei tarkistusta | Joutilaan kääreen purku, jos tiedosto on edennyt | Terminaalikeskustelut vain luettavia, selaimen kirjoittajilla lukko, jatkaminen vasta omistajuuden tarkistuksen jälkeen |
| Joutilaat Pi:t | Pysyvät | Puretaan 10 min jälkeen, sivu uusii vuokran | Pysäytetään arkistoitaessa |
| Huomio | Needs input, lukemattomat, ilmoitukset sovelluksessa | Selaimen ilmoitus ja Web Push | Sinun vuorosi ja Käynnissä, välilehden luku |
| Rinnakkaiset agentit | `spawn_session`, alaistunnot, viestit istuntojen välillä | Sisäänrakennettu aliagenttikytkin | Workerit omina riveinään, Taskfleet erillinen työkalu |
| Monta konetta | Fleet: gateway välittää muille PI WEB -instansseille | Ei | Rajattu ulos |
| Laajennettavuus | Selain- ja palvelinpluginit, joita kohdellaan luotettuna koodina | Pi-laajennukset, ei omaa pluginijärjestelmää | Pi:n omat laajennukset ja integraatioluettelo |
| Kieli | Englanti, kielipaketit | Englanti, kiina | Suomi |
| Lisenssi | MIT | MIT | Repossa ei vielä lisenssitiedostoa |

## 6. Suositukset

### Mitä Open Habitat voisi oppia tai ottaa käyttöön (tärkeysjärjestyksessä)

1. **Pi:n elinkaari irti daemonin päivityksistä.** PI WEB:n koko arkkitehtuuri
   rakentuu sen varaan, ettei käyttöliittymän tai API:n päivitys katkaise
   agenttia. Open Habitatissa tilanne on toinen: "Browser Pi conversations are
   daemon children and are cut" päivityksessä (`docs/operations.md`), ja
   daemonin yksikössä on `KillMode=mixed`, joten myös daemonin
   uudelleenkäynnistys tappaa Pi:t **(lähde)**. *Miksi:* tuotteen lupaus on,
   että selaimen sulkeminen jättää agentin työskentelemään. Kun julkaisuja
   tehdään usein ja lähes jokainen ominaisuus muuttaa daemonia, jokainen
   julkaisu katkaisee kaikkien käyttäjien käynnissä olevat työt. Samalla
   päivitys jättää jo nyt käynnissä olevaksi kaiken, mikä on ihmisen
   käyttäjämanagerissa (selaimen shell, editori, Taskfleet-ajot).
   Luonteva suunta on ajaa selaimen Pi samaan tapaan kuin editori: ihmisen
   käyttäjämanagerissa (`systemd-run --user`) niin, että Pi:n stdio-yhteyttä
   pitää pieni ja harvoin muuttuva välittäjä, johon daemon kytkeytyy
   uudelleen käynnistyttyään. Vaihtoehtoisesti daemon voidaan jakaa PI WEB:n
   tapaan harvoin muuttuvaan istunto-osaan ja usein muuttuvaan API-osaan.
   Kumpikin siirtää Pi-prosessin omistajuutta, eli kyse on
   arkkitehtuurimuutoksesta, joka tuodaan Jarille suosituksena ja kirjataan
   ADR:ään. Ennen sitä kannattaa mitata, kuinka usein testipalvelimen
   päivitys on katkaissut käynnissä olevan työn **(päättely)**.
2. **Web Push Pi Webin opein, jos Jari ottaa ilmoitukset tuotteeseen.**
   Orca-vertailun suositus 2 (push, kun keskustelu siirtyy Sinun vuorosi
   -listaan) on yhä `docs/product.md`:ssä rajattu ulos, joten tämä on Jarin
   tuotepäätös. Pi Web antaa toteutukselle valmiin tarkistuslistan, joka on
   opittu tuotannossa: kelvollinen VAPID-subject (`https:`, ei
   `mailto:…@localhost`), service worker näyttää *aina* ilmoituksen, koska iOS
   muuten peruu tilauksen äänettömästi, `Urgency: high`, keskustelukohtainen
   `tag`, rekisteröinti asetuksissa käyttäjän eleellä myös korjauspolkuna,
   kuolleiden tilausten karsinta 404- ja 410-vastauksista, ilmoitus vain
   oikeasta ajosta eikä laajennuskomennosta, ja workerien ilmoitukset
   vaimennettuina ([#728][ag-728], [#1345][ag-1345], [`web-push.ts`][ag-push]).
   PI WEB:ssä sama pyyntö on avoinna ([#193][jm-193]), mikä kertoo, että
   käyttäjät haluavat tätä myös palvelinmallissa. *Miksi:* tuote on puhelimelle
   tehty, mutta tieto siitä, milloin pitää palata, näkyy nyt vain avoimessa
   välilehdessä. Open Habitatissa tilaukset kuuluvat ihmiselle. Kuka pitää
   VAPID-avainta ja kuka lähettää (gateway vai ihmisen daemon), on
   valtuuskysymys, joka päätetään ennen koodia **(päättely)**.
3. **Joutilaiden Pi-prosessien purku sivun uusiman vuokran perusteella.**
   Pi Web purkaa joutilaan istunnon kymmenen minuutin jälkeen, mutta vain
   jos ajoa ei ole käynnissä. Avoin sivu uusii vuokraa, Pi-laajennus voi
   pidättää istunnon liveness-rekisterin kautta, ja jumiin jäänyt Stop
   puretaan pakotetusti ([README][ag-readme], [`rpc-manager.ts`][ag-rpc]).
   *Miksi:* monen ihmisen palvelimella jokainen valmis mutta elävä Pi vie
   muistia muilta. Open Habitat pysäyttää jo nyt joutilaan Pi:n
   arkistoitaessa ja osaa jatkaa päättynyttä keskustelua natiivista
   historiasta, joten pohja on valmiina. Pi Web tuo kaksi ehtoa, joita
   Orcan lepotilasta ei saanut: avoimen sivun vuokran (ei pelkkä aikaraja) ja
   laajennuksen oikeuden pidättää istunto. Jälkimmäinen on tärkeä, koska
   workerit ja taustaprosessit näkyvät Open Habitatissa juuri
   "taustatyötä odottavina" **(päättely)**.
4. **Pi:n natiivi haarautus selaimeen.** Pi Web tarjoaa kaksi tapaa: uusi
   istunto aiemmasta viestistä ja haara saman istunnon puussa ("Edit from
   here"). Kumpikin kirjoittaa vain Pi:n omaa istuntomuotoa
   ([README][ag-readme], `session-fork.ts`) **(lähde)**. *Miksi:* agentin
   ohjaaminen väärältä polulta takaisin on puhelimella nyt raskasta (uusi
   keskustelu ja konteksti alusta). Haarautus ei vaadi uutta varastoa, ja
   tulos näkyy myös terminaalin Pi:ssä. Kyse on silti uudesta
   käyttökulusta, joten se kuuluu Jarin tuotepäätöksiin **(päättely)**.
5. **Kirjataan sääntö "voisiko tämän tehdä Pi-laajennuksena?".** Pi Webin
   CONTRIBUTING hylkää kaiken, minkä voisi tehdä Pi-laajennuksena, ja
   kaikki selainkohtaiset asetustiedostot ([CONTRIBUTING][ag-contrib]).
   PI WEB:ssä sama ajattelu näkyy istuntojen nimeämisessä, joka on
   Pi-laajennus ja toimii siksi myös TUI:ssa ([config.md][jm-config]).
   *Miksi:* Open Habitatin periaate on käyttää natiiveja komponentteja, ja
   tämä testi tekee periaatteesta päätettävän yksittäisen ominaisuuden
   kohdalla. Esimerkiksi agentin "tarvitsen ihmistä" -merkintä (PI WEB:n
   `request_human_intervention`) olisi Pi-laajennuksena näkyvä myös SSH:n
   kautta. Paikka olisi juuren `AGENTS.md`:n natiivien komponenttien kohta
   **(päättely)**.
6. **Agentin oma "tarvitsen ihmistä" -merkintä Sinun vuorosi -listaan.**
   PI WEB:n `request_human_intervention` päättää ajon, merkitsee istunnon
   Needs input -tilaan ja säilyy daemonin uudelleenkäynnistyksen yli. Uusi
   ajo poistaa merkinnän, mutta pelkkä lukeminen ei ([config.md][jm-config])
   **(lähde)**. *Miksi:* Open Habitatin Sinun vuorosi erottaa jo kysymyksen ja
   lukemattoman vastauksen. Tämä lisäisi kolmannen tapauksen: agentti on
   pysähtynyt, koska se tarvitsee ihmisen toimen tuotteen ulkopuolella
   (hyväksyntä, kirjautuminen, maksu). Arvo on pienempi kuin kohdissa 1–4, ja
   toteutus kuuluu kohdan 5 mukaan Pi-laajennukseksi **(päättely)**.

### Missä Open Habitat on jo parempi

- **Ihmisten erottaminen.** Kumpikin vertailtava rajaa monikäyttäjäisyyden
  pois. PI WEB ei tunnista käyttäjää lainkaan, ja Pi Webissä on yksi salasana.
  Open Habitatissa on GitHub-kirjautuminen, ylläpitäjän pääsypäätös ja oma
  Unix-tunnus, oma daemon ja omat tunnistetiedot jokaiselle ihmiselle.
- **Julkinen osoite turvallisesti.** Kumpikin vertailtava kieltää julkisen
  internetin. Open Habitat on rakennettu julkisen osoitteen taakse.
- **Arkistointi ei koske Pi:n historiaan.** PI WEB siirtää Pi:n tiedoston
  pois Pi:n hakemistosta, jolloin keskustelu katoaa terminaalin listasta, ja
  siirto on altis historian menetykselle ([#379][jm-379]). Open Habitatin
  arkisto on esitysmerkintä.
- **Kahden kirjoittajan tilanne.** PI WEB ei tarkista sitä lainkaan, ja Pi
  Web purkaa vain joutilaan kääreen. Open Habitat pitää terminaalikeskustelut
  selaimessa vain luettavina, lukitsee selaimen kirjoittajat ja tarkistaa
  Pi-prosessit ennen jatkamista. Se myös sanoo rehellisesti, mitä ei luvata.
- **Ei luotettua pluginikoodia istuntoprosessissa.** PI WEB:n
  palvelinpluginit voivat kaataa daemonin istunnot ja terminaalit. Open
  Habitatissa laajennukset ovat Pi:n omia, ja ne ajetaan ihmisen tunnuksella.
- **Vähemmän omia varastoja.** PI WEB:llä on yli puoli tusinaa omaa
  JSON-varastoa natiivin tilan rinnalla. Open Habitatissa natiivi historia on
  ainoa historia.

### Mitä ei kannata kopioida

- **Pi:n ajaminen SDK:lla verkkopalvelimen sisällä** (Pi Web). Se sitoo
  agentin elinkaaren käyttöliittymän palvelimeen, eli siihen, mistä kohta 1
  yrittää päästä eroon. Open Habitatin erillinen `pi --mode rpc` -prosessi on
  parempi lähtökohta, koska Pi:tä voi omistaa jokin muu kuin daemon.
- **Arkistointi siirtämällä Pi:n tiedostoja** (PI WEB). Rikkoo natiivin
  totuuden ja SSH-käytön.
- **Fleet bearer-tokenilla.** Yhdyskäytävä, jolla on yksi token
  kohdekoneeseen, tekee jokaisesta gatewayn käyttäjästä kohdekoneen
  käyttäjän. Se ei sovi ihmisten erottamiseen. Usean palvelimen navigointi on
  muutenkin rajattu pois.
- **Agenttien väliset työkalut ja alaistunnot tuotteen sisällä**
  (`spawn_session`, `send_session_message`, ajastetut tehtävät). Open
  Habitat näyttää natiivit workerit, ja Taskfleet on erillinen työkalu. Oma
  orkestrointikerros olisi uusi alijärjestelmä ja toinen totuus.
- **Pluginijärjestelmä, jonka palvelinosat ajetaan istuntoprosessissa.**
- **Yksi jaettu salasana kirjautumisena** (Pi Web) tai **ei kirjautumista**
  (PI WEB). Molemmat ovat yhden ihmisen ratkaisuja.
- **Oma tapahtumaloki uudelleenyhdistämistä varten** (Pithagoras). Open
  Habitat lukee katkon aikana syntyneen historian Pi:ltä.

## 7. Mitä en saanut selville

- En käynnistänyt kumpaakaan tuotetta. Kahden kirjoittajan käytös perustuu
  koodihakuun ja dokumentaatioon, ei kokeeseen.
- Yleistä verkkohakua (DuckDuckGo) en käyttänyt, koska aiempi ajo sai siitä
  haastesivun. Käytin GitHubin API:a (ensin ilman tunnistusta, kunnes
  60 pyynnön raja täyttyi, sitten `gh api`), repojen lähdekoodia, npm:n
  rekisteriä ja latausrajapintaa sekä HN Algoliaa. pi-web.dev ja Pi Webin demo
  vastasivat (HTTP 200). Sivuston teksti on luettu repon `docs/`-hakemistosta,
  josta sivusto julkaistaan.
- En tarkistanut, missä Open Habitat pitää keskustelun "lukematta"-tilan
  (selaimessa vai daemonissa), joten PI WEB:n palvelinpuolen
  `session-unread.json`-mallia ei ole vertailtu.
- PI WEB:n forkin ja kloonin käyttöliittymää en lukenut koodista. Taulukon
  merkintä perustuu dokumentaation mainintaan ("User-created forks and
  clones"). Samoin PI WEB:n viennin puuttuminen perustuu vain siihen, etten
  löytänyt reittiä istuntojen reiteistä.

## Lähteet

- PI WEB, README: <https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/README.md>
- PI WEB, AGENTS.md: <https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/AGENTS.md>
- PI WEB, Remote-first development: <https://pi-web.dev/remote-first>
- PI WEB, Fleet: <https://pi-web.dev/machines>
- PI WEB, FAQ: <https://pi-web.dev/faq>
- PI WEB, configuration reference: <https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/docs/config.md>
- PI WEB, `src/server/sessiond.ts`: <https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/src/server/sessiond.ts>
- PI WEB, `src/sessiond/config.ts`: <https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/src/sessiond/config.ts>
- PI WEB, `piSessionService.ts`: <https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/src/server/sessions/piSessionService.ts>
- PI WEB, `piSessionManagerGateway.ts`: <https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/src/server/sessions/piSessionManagerGateway.ts>
- PI WEB, `sessionArchiveStore.ts`: <https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/src/server/sessions/sessionArchiveStore.ts>
- PI WEB, PR #99 (salasanakirjautuminen): <https://github.com/jmfederico/pi-web/pull/99>
- PI WEB, #154 (Host/Origin ja admission control): <https://github.com/jmfederico/pi-web/issues/154>
- PI WEB, PR #155 (Safe Tunnel): <https://github.com/jmfederico/pi-web/pull/155>
- PI WEB, #193 (Web Push -pyyntö): <https://github.com/jmfederico/pi-web/issues/193>
- PI WEB, #379 (arkistotörmäys): <https://github.com/jmfederico/pi-web/issues/379>
- Pi Web, README: <https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/README.md>
- Pi Web, AGENTS.md: <https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/AGENTS.md>
- Pi Web, CONTRIBUTING: <https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/CONTRIBUTING.md>
- Pi Web, `lib/rpc-manager.ts`: <https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/lib/rpc-manager.ts>
- Pi Web, `lib/web-push.ts`: <https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/lib/web-push.ts>
- Pi Web, `lib/push-client.ts`: <https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/lib/push-client.ts>
- Pi Web, `lib/session-ui-state.ts`: <https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/lib/session-ui-state.ts>
- Pi Web, PR #728 (iOS-taustatoimitus): <https://github.com/agegr/pi-web/pull/728>
- Pi Web, #1345 (väärä valmis-ilmoitus): <https://github.com/agegr/pi-web/issues/1345>
- Pithagoras, README: <https://github.com/thecodacus/pithagoras>
- HN-kommentti 2.10.2026: <https://news.ycombinator.com/item?id=49929275>
- HN-kommentti 29.7.2026: <https://news.ycombinator.com/item?id=49100596>
- HN-kommentti 31.7.2026: <https://news.ycombinator.com/item?id=49121360>
- npm: <https://www.npmjs.com/package/@jmfederico/pi-web>, <https://www.npmjs.com/package/@agegr/pi-web>

[jm-commit]: https://github.com/jmfederico/pi-web/tree/ad06af3bda1f984b163b75009cfe315770ca46be
[ag-commit]: https://github.com/agegr/pi-web/tree/d128bae47cd3abbdfe7135443ac793f547c14e47
[jm-readme]: https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/README.md
[jm-agents]: https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/AGENTS.md
[jm-remote]: https://pi-web.dev/remote-first
[jm-machines]: https://pi-web.dev/machines
[jm-faq]: https://pi-web.dev/faq
[jm-config]: https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/docs/config.md
[jm-sessiond]: https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/src/server/sessiond.ts
[jm-sdconfig]: https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/src/sessiond/config.ts
[jm-pss]: https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/src/server/sessions/piSessionService.ts
[jm-gw]: https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/src/server/sessions/piSessionManagerGateway.ts
[jm-archive]: https://github.com/jmfederico/pi-web/blob/ad06af3bda1f984b163b75009cfe315770ca46be/src/server/sessions/sessionArchiveStore.ts
[jm-99]: https://github.com/jmfederico/pi-web/pull/99
[jm-154]: https://github.com/jmfederico/pi-web/issues/154
[jm-155]: https://github.com/jmfederico/pi-web/pull/155
[jm-193]: https://github.com/jmfederico/pi-web/issues/193
[jm-379]: https://github.com/jmfederico/pi-web/issues/379
[ag-readme]: https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/README.md
[ag-agents]: https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/AGENTS.md
[ag-contrib]: https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/CONTRIBUTING.md
[ag-rpc]: https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/lib/rpc-manager.ts
[ag-push]: https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/lib/web-push.ts
[ag-pushclient]: https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/lib/push-client.ts
[ag-uistate]: https://github.com/agegr/pi-web/blob/d128bae47cd3abbdfe7135443ac793f547c14e47/lib/session-ui-state.ts
[ag-728]: https://github.com/agegr/pi-web/pull/728
[ag-1345]: https://github.com/agegr/pi-web/issues/1345
[pith]: https://github.com/thecodacus/pithagoras
[hn1]: https://news.ycombinator.com/item?id=49929275
[hn2]: https://news.ycombinator.com/item?id=49100596
[hn3]: https://news.ycombinator.com/item?id=49121360
