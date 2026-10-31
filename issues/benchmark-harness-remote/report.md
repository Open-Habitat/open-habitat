# Vertailu: harnessien omat etäkäyttömallit

Tutkimusajo `01m68hqz1bnc1t8s1aget0wzqe`, 31.10.2026. Kohteet ovat Claude Code
Remote Control, OpenCode (`web`, `serve`, `attach` ja uusi taustapalvelu),
Codexin jaettu app-server sekä Pi:n oma suunta (`pi-durable`, poistettu
`pi-server` ja RPC-tila). Lähteinä ovat harnessien viralliset dokumentit,
GitHub-repojen lähdekoodi ja issuet GitHub API:n kautta (Pi commitista
[`9b7a44c4`][pi-commit], Codex [`67f0994b`][codex-commit], OpenCode
[`45920000`][oc-commit], HAPI [`f8e55fb9`][hapi-commit]), HAPIn dokumentaatio
sekä Hacker News -keskustelut Algolian API:n kautta. Mitään työkaluista ei ajettu.
Merkintä **(lähde)** tarkoittaa, että asia lukee lähteessä tai koodissa, ja
**(päättely)** on oma tulkintani.

## Tiivistelmä

Kaikki kolme harnessia ratkaisevat kysymyksen "sama elävä istunto terminaalissa
ja selaimessa" samalla tavalla: **yksi prosessi omistaa istunnon ja on sen ainoa
kirjoittaja, ja terminaali, selain ja puhelin ovat sen asiakkaita.** Erot ovat
siinä, missä omistaja asuu ja miten asiakas pääsee sen luo. Claude Coden
omistaja on terminaalin `claude`-prosessi, ja asiakkaat tulevat Anthropicin
palvelimien kautta, jotka tallentavat myös transkriptin. OpenCoden TUI on aina
oman palvelimensa asiakas, ja 2.x-sarjassa oletuksena käyttäjäkohtaisen
taustapalvelun asiakas. Codexin TUI liittyy käyttäjän app-server-daemoniin
Unix-socketin kautta, ja `codex --remote` liittää sen etäpalvelimeen. Yksikään
malleista ei ole monen käyttäjän malli: valtuutena on tili, salasana tai token,
ja kaikki asiakkaat ovat sama käyttöjärjestelmätunnus. Open Habitatille
olennaisin löydös koskee Pi:tä. Pi:n tekijät rakensivat heinä–lokakuussa juuri
tämän mallin (`pi-server`: Unix-socket, monta liitettyä esitystä, istunnon
kirjoittajan omistajuus) ja **poistivat sen julkaisemattomana 12.10.2026**
versiossa 1.2.0. Kokeellinen `pi-durable` on kirjasto, jota `pi`-komento ei
käytä, ja sen ylläpitäjä torjui kahden prosessin kirjoittamisen samaan
tallennukseen: se "violates the single writer invariant". Pi-istuntotiedostolla
ei ole lainkaan kirjoittajalukkoa, ja sitä pyytänyt issue suljettiin
automaattisesti. Suositus on siksi pyytää Pi:ltä kahta asiaa tässä
järjestyksessä: ensin natiivi kirjoittajalukko istuntotiedostolle, joka sulkisi
Open Habitatin nykyisen aukon "ehdotonta poissulkemista ei luvata", ja sitten
attach-sopimus, jolla terminaalin `pi` voi liittyä daemonin omistamaan elävään
istuntoon. Open Habitatin ei pidä rakentaa tätä kerrosta itse Pi:n ohi.

## 1. Mitä verrataan ja kenelle

- **Claude Code Remote Control** liittää paikallisen Claude Code -istunnon
  claude.ai/code-sivuun ja Clauden mobiilisovellukseen. "The web and mobile
  interfaces are a window into that local session, so your computer has to stay
  on and the `claude` process has to keep running" ([Remote Control][rc])
  **(lähde)**. Ominaisuus on tarkoitettu yksittäiselle tilaajalle, joka jatkaa
  työtä puhelimelta. Se vaatii Pro-, Max-, Ultra-, Team- tai
  Enterprise-tilauksen, eikä se toimi API-avaimilla **(lähde)**.
- **OpenCode** on MIT-lisensoitu harness, jonka TUI on aina oman palvelimensa
  asiakas: "When you run opencode it starts a TUI and a server. Where the TUI is
  the client that talks to the server" ([Server][oc-server]) **(lähde)**.
  `opencode web` lisää selainkäyttöliittymän, ja `opencode attach <url>` liittää
  terminaalin samaan palvelimeen "sharing the same sessions and state"
  ([Web][oc-web]) **(lähde)**.
- **Codex app-server** on JSON-RPC-rajapinta, jonka varaan Codexin omat
  asiakkaat (VS Code, työpöytä, mobiili) on rakennettu. TUI voi liittyä
  toisella koneella ajettavaan app-serveriin (`codex --remote`)
  ([App Server][codex-as]) **(lähde)**. HAPI käyttää samaa app-serveriä niin,
  että terminaali ja selain ovat yhtä aikaa saman Codex-istunnon asiakkaita
  ([HAPI: Codex shared sessions][hapi-codex]) **(lähde)**.
- **Pi** (`@earendil-works/pi-coding-agent`) tarjoaa interaktiivisen, print-,
  JSON- ja RPC-tilan. Open Habitat käyttää RPC-tilaa: daemon käynnistää
  `pi --mode rpc` -lapsiprosessin ja puhuu sille stdinin ja stdoutin kautta
  (`internal/daemon/pi_rpc_linux.go`) **(lähde)**. Erillinen `pi-durable` on
  kokeellinen kirjasto kestäville keskusteluille ([pi-durable README][durable])
  **(lähde)**.

## 2. Arkkitehtuuri

### Claude Code Remote Control

**Missä prosessit ajetaan.** Kaikki suoritus, tiedostot ja MCP-palvelimet ovat
käyttäjän koneella. Etäkäytön voi käynnistää kolmella tavalla ([Remote
Control][rc]) **(lähde)**:

- `claude --remote-control` avaa tavallisen interaktiivisen istunnon, jota voi
  ohjata myös selaimesta. "you can type messages locally while the session is
  also available remotely."
- `/remote-control` kytkee jo käynnissä olevan istunnon etäkäyttöön ja tuo
  keskusteluhistorian mukanaan.
- `claude remote-control` on **palvelintila**. Prosessi odottaa yhteyksiä ja
  luo istuntoja pyynnöstä. `--spawn same-dir` jakaa työhakemiston kaikkien
  istuntojen kesken ("they can conflict if editing the same files"),
  `--spawn worktree` antaa jokaiselle istunnolle oman git-worktreen, ja
  `--spawn session` palvelee täsmälleen yhtä istuntoa. Rinnakkaisia istuntoja on
  oletuksena enintään 32 (`--capacity`).

Interaktiivisella prosessilla on yksi etäistunto kerrallaan. Jos prosessi
suljetaan, istunto menee offline-tilaan, ja ohje neuvoo: "If you run `claude`
from a terminal on a remote machine, start it inside `tmux` or `screen`"
**(lähde)**.

**Miten selain tavoittaa elävän tilan.** Paikallinen prosessi tekee vain
lähteviä HTTPS-pyyntöjä: se rekisteröityy Anthropicin API:in ja "polls for
work". Kun toinen laite liittyy, palvelin välittää viestit selaimen ja
paikallisen istunnon välillä striimaavalla yhteydellä. Etäkäytön aikana
"the session transcript, including your messages, Claude's responses, and tool
activity, is stored on Anthropic servers" ([Connection and security][rc])
**(lähde)**. Jaettu tila on siis kopio, jonka relay pitää. Natiivi totuus
pysyy silti paikallisessa prosessissa, ja relay synkronoi sen laitteille
**(päättely)**.

**Yhteinen istunto.** Keskustelu ja aliagenttien eteneminen "stay in sync
across all connected devices, so you can send messages from your terminal,
browser, and phone interchangeably" **(lähde)**. Koska kirjoittaja on yksi
prosessi, terminaalin ja selaimen viestit asettuvat saman prosessin jonoon
eikä erillistä lukkoa tarvita **(päättely)**. Rajat on dokumentoitu
tarkasti: `/resume` vaihtaa keskustelun, jota laite seuraa, mutta laite ei saa
vaihdetun keskustelun aiempaa historiaa. `/clear` tyhjentää myös laitteiden
näkymän. Lupakyselyt ja `AskUserQuestion` pysyvät auki, kunnes niihin
vastataan, mutta muut laitteelle välitetyt dialogit suljetaan viiden minuutin
jälkeen oletusvalinnalla (`dialogExpiry`) **(lähde)**.

**Valtuus ja eristys.** Pääsy perustuu claude.ai-tiliin. Lisäksi on
"Trusted Devices": kun asetus on päällä, etäistunnon ohjaus vaatii
laitekohtaisen tunnistautumisen (Face ID, Touch ID tai turva-avain), ja
laitteen voi perua ([Remote Control][rc]) **(lähde)**. Etäkäyttö ei ole
saatavilla, jos organisaatiolla on Zero Data Retention tai HIPAA-asetukset,
eikä silloin, kun `ANTHROPIC_BASE_URL` osoittaa muualle kuin Anthropicin API:in
**(lähde)**.

**Ilmoitukset.** Mobiilin push-ilmoitukset voi pyytää kahdesta syystä:
"Push when Claude decides" ja "Push when actions required". Claude Code ei
lähetä ilmoitusta, kun käyttäjä kirjoittaa terminaaliin tai terminaali on
fokusoituna. `CLAUDE_CLIENT_PRESENCE_FILE` laajentaa tämän: niin kauan kuin
merkkitiedosto on olemassa, ilmoituksia ei lähetetä ([Remote Control][rc])
**(lähde)**.

### OpenCode: palvelin ja liitettävät asiakkaat

**1.x-malli (dokumentoitu).** Jokainen `opencode`-käynnistys luo TUI:n ja
HTTP-palvelimen satunnaiseen porttiin. `opencode serve` on otsaton palvelin
(oletuksena `127.0.0.1:4096`), `opencode web` sama selainkäyttöliittymän kera,
ja `opencode attach http://…` liittää terminaalin olemassa olevaan palvelimeen
([Server][oc-server], [Web][oc-web], [CLI][oc-cli]) **(lähde)**. Palvelin
julkaisee OpenAPI 3.1 -kuvauksen, ja tapahtumat tulevat SSE-virtana
(`GET /event`). Mukana on istuntojen, viestien, abortin,
lupavastausten ja diffien REST-rajapinta sekä `/tui/*`-reitit, joilla ulkoinen
ohjelma voi ohjata TUI:ta (esimerkiksi täyttää kehotteen) **(lähde)**. Pääsyn
suojaa HTTP Basic -salasana `OPENCODE_SERVER_PASSWORD`. Ilman sitä
"the server will be unsecured" ([Web][oc-web]) **(lähde)**.

**2.x-malli (lähdekoodi).** 2.x-sarjan uusimmat julkaisut v2.2.0–v2.2.5
ilmestyivät GitHubissa 27.–30.10.2026, ja npm-paketin `opencode-ai` `latest` on
edelleen 1.19.5 **(lähde)**. 2.x:n `packages/cli`-paketissa oletuskomento ei
enää käynnistä omaa moottoria. Se käynnistää tai ottaa käyttöön käyttäjän
taustapalvelun ("background service starting") ja liittää TUI:n siihen.
`--server <url>` liittää toiseen palvelimeen, ja `--standalone` ajaa oman
moottorin (`commands/handlers/default.ts`, `services/server-connection.ts`)
**(lähde)**. Palvelu
löytyy rekisteröintitiedostosta `XDG_STATE_HOME`-hakemiston alta. Sillä on yksi
yksityinen salasanatiedosto, "so discovered clients can reconnect without
exposing a password flag or environment variable" **(lähde)**. Selainta varten
on viiden minuutin pariutuskoodit (`pairing.ts`) ja 30 päivän istuntotokenit,
jotka allekirjoitetaan salasanasta johdetulla avaimella ("rotating the password
revokes every session", `auth.ts`) **(lähde)**. Valinnainen etäkäyttö kulkee
OpenTunnel-tunnelin kautta salaisessa aliverkkotunnuksessa, ja se vaatii
käyttäjän hyväksynnän palvelun avaamiselle internetiin (`remote-tunnel.ts`,
`service-config.ts`) **(lähde)**. Julkaistu dokumentaatio ei kuvaa tätä
palvelutilaa (`opencode.ai/docs/service/` palauttaa 404:n) **(lähde)**.

**Istunnon pito ja historia.** Istunnot ja viestit ovat OpenCoden omassa
SQLite-tietokannassa (Drizzle, `packages/core/src/database/`) **(lähde)**.
Terminaalit omistaa erillinen `opencode-pty`-daemon. Sillä on täsmälleen yksi
omistajayhteys, ja omistajan katoaminen pysäyttää daemonin, ellei omistaja ole
ensin valmistellut kertakäyttöistä siirtolippua (`prepare_handoff`, voimassa
120 sekuntia). Muut asiakkaat ovat havainnoijia
([process-daemon README][oc-pty]) **(lähde)**.

**Valtuus.** Salasanan tai pariutetun tokenin haltija saa koko palvelun,
mukaan lukien `PUT /auth/:id` -tunnistetietojen asettamisen ([Server][oc-server])
**(lähde)**. Kaikki asiakkaat ovat sama käyttöjärjestelmätunnus **(päättely)**.

### Codex: jaettu app-server

**Rajapinta ja kuljetukset.** `codex app-server` puhuu JSON-RPC 2.0:aa
kolmella kuljetuksella: stdio (oletus), WebSocket (`--listen ws://IP:PORT`,
"experimental and unsupported") ja Unix-socket (`--listen unix://`), jossa
kulkee WebSocket tavallisella HTTP Upgrade -kättelyllä ([App Server][codex-as])
**(lähde)**. "Non-loopback WebSocket listeners currently allow unauthenticated
connections by default during rollout". Todennukseksi on kaksi vaihtoehtoa:
kykytoken tiedostosta tai allekirjoitettu bearer-token, ja se tarkistetaan
ennen `initialize`-kutsua **(lähde)**. HTTP-terveystarkistus hylkää pyynnöt,
joissa on `Origin`-otsake **(lähde)**.

**Terminaali asiakkaana.** `codex --remote ws://…|wss://…|unix://PATH` liittää
TUI:n app-serveriin ([App Server][codex-as]) **(lähde)**. Kokeellinen
`codex-app-server-daemon` pitää yhtä app-serveriä jokaista `CODEX_HOME`:a
kohden pidfilen ja Unix-ohjaussocketin varassa. Jos daemon on käynnissä, TUI
liittyy siihen automaattisesti ("implicit daemon attachment"). Jos liittyminen
epäonnistuu, TUI käynnistää sisäisen palvelimen ([daemon README][codex-daemon])
**(lähde)**. Daemon on tarkoitettu "Codex instances launched over SSH" ja
mobiilin ja työpöydän etäohjaukselle (`enable-remote-control`). README varoittaa,
että jaetut asiakkaat käyttävät daemonin käynnistysympäristöä eikä
"per-client environment isolation" toteudu **(lähde)**.

**Ketjujen elinkaari.** Ketju ladataan muistiin, ja yhteydet tilaavat sen
tapahtumat. Kun viimeinen tilaaja lähtee, palvelin pitää ketjua ladattuna,
"until it has no subscribers and no thread activity for 30 minutes", ja
purkaa sen sitten (`thread/unsubscribe`, `thread/closed`) ([App
Server][codex-as]) **(lähde)**. Saman `CODEX_HOME`:n prosessien välillä
kirjoittajan omistajuuden hoitaa `WriterLockCoordinator`, joka "Acquires
exclusive writer ownership, returning `WouldBlock` for an active writer"
([`writer_lock.rs`][codex-wl]) **(lähde)**.

**Mobiili.** Codexin mobiilikäyttö kulkee ChatGPT-sovelluksen kautta: isäntänä
on ChatGPT:n työpöytäsovellus macOS:llä tai Windowsilla, ja puhelin pariutetaan
siihen QR-koodilla. SSH-kohde liitetään työpöytäsovellukseen, ei suoraan
puhelimeen ([Codex on mobile][codex-mobile], [Remote connections][codex-rc])
**(lähde)**.

**HAPIn kuvaama jaettu istunto.** HAPI on toistaiseksi selkein kuvaus siitä,
mitä jaettu app-server tarkoittaa käytännössä ([HAPI][hapi-codex]) **(lähde)**:

- "No local/remote ownership switch. Both can send messages, approve tools and
  answer `request_user_input`."
- Elinkaari seuraa omistajaa, ei asiakkaiden määrää. Terminaalista käynnistetyn
  suorituksen elinkaaren omistaa terminaali, ja `/exit` pysäyttää app-serverin.
  Lisäterminaali (`hapi resume <id>`) "only detaches; it never takes lifetime
  ownership". Lifetime follows "its original terminal or Runner-spawned
  wrapper, **not frontend count**."
- Vastauksen ratkaisee Codex: "A submitted Web answer is only a candidate."
  Kun Codex lähettää `serverRequest/resolved`, kysymys suljetaan neutraalilla
  tilalla "Resolved in Codex". HAPI ei päättele, kuka vastasi.
- Viestit menevät Codexin natiiviin jonoon, "There is no competing HAPI queue
  drainer". Steer kohdistuu havaittuun vuoroon, ja vanhentunut vuorotunnus
  hylätään.
- Kylmä jatkaminen "rejects another live owner". Elävä orpo tai prosessi,
  jonka sukupolvea ei voida varmistaa, estää jatkamisen, ja "never just delete
  its ownership record".
- Rinnakkaisissa istunnoissa ei ole kelausta (rewind), koska natiivi muutos ja
  hubin transkriptin katkaisu "needs a commit barrier across every sender".
  Tilalle tarjotaan haarautus.

### Pi: RPC, poistettu pi-server ja pi-durable

**Tänään julkaistu Pi.** Uusin julkaisu on 1.4.0 (21.10.2026), ja Open
Habitat on kiinnittänyt version 1.3.0 **(lähde)**. Liittymiä on neljä:
interaktiivinen TUI, print, JSON ja RPC. "All interfaces use the same agent and
session mechanisms" ([How Pi Works][pi-how]) **(lähde)**. RPC on yhden asiakkaan
putki: komennot tulevat stdinistä, ja vastaukset ja tapahtumat menevät stdoutiin.
Stdinin sulkeminen päättää prosessin ([RPC][pi-rpc]) **(lähde)**. Pysyvä
istunto on JSONL-puu ([Session format][pi-session]) **(lähde)**. Mikään liittymä
ei tarjoa toiselle prosessille tapaa liittyä elävään istuntoon **(päättely
dokumentaatiosta ja lähdepuusta)**.

**Kirjoittajalukkoa ei ole.** Issue [#8848][pi-8848] (30.8.2026) toteaa, että
`SessionManager` lisää istuntotiedostoon ilman lukkoa, että kaksi `pi`-prosessia
voi kirjoittaa samaan tiedostoon ja että kumpikin pitää omaa muistissa olevaa
tilaansa. Issuen esimerkki on juuri Open Habitatin tilanne: RPC-kääre avaa
saman tiedoston, jossa interaktiivinen `pi` on jo auki. Issue viittaa Codexin
`WriterLockCoordinator`iin mallina **(lähde)**. Botti sulki issuen
automaattisesti, koska kaikki uusien osallistujien issuet suljetaan ja
ylläpitäjät avaavat arvokkaat uudelleen. Tätä ei ole avattu. 9.10. toinen
osallistuja tarjoutui tekemään PR:n, joka "reserves each persisted session for
one writable runtime before loading" ja vaatii varmistetun omistajan kuoleman
ennen haltuunottoa. Vastausta ei ole tullut **(lähde)**. Open Habitat paikkaa
tätä omalla neuvoa-antavalla lukollaan, joka "is NOT a census of terminal Pi"
(`internal/daemon/pi_ownership_linux.go`), ja prosessilaskennalla ennen
jatkamista (`continuation_linux.go`: "Terminal Pi writers do not take it")
**(lähde)**.

**Rakennettu ja poistettu pi-server.** Pi:n ylläpitäjä yhdisti 31.7.2026 PR:n
[#7409][pi-7409] "add remote session client coordination": `PiClient`, "shared/exclusive
session leases", `RemoteSession` ja palvelimen idempotentti irrottautuminen
**(lähde)**. `packages/server` kuvasi itseään näin: "Experimental local server that routes
clients to application-hosted durable Sessions". Siinä oli Unix-socket
(`/run/user/1000/pi`), "A Session may have multiple presentation attachments",
ja "Server shutdown closes every routed Session handle, releasing its worker and
Session writer ownership". Vertaistodennus jätettiin sovelluksen päätettäväksi
([pi-server README, v1.1.0][pi-server]) **(lähde)**. Mario Zechner poisti
12.10.2026 commitilla [`7472cda0`][pi-remove] koko pinon: "remove the
experimental server stack and the client, protocol, and server packages".
1.2.0:n muutoslokin mukaan "none of it was part of the published package"
([CHANGELOG][pi-changelog]) **(lähde)**. Poiston syytä ei kerrota commitissa
eikä muutoslokissa. En löytänyt korvaavaa suunnitelmaa **(lähde: haku
issueista ja PR:istä)**.

**Ylläpitäjien kanta.** Armin Ronacher kirjoitti issueen [#5700][pi-5700]
kesäkuussa: "my suspicion is that what we might need to get to is to a) enable
pi to spawn new sessions and to b) enable one pi instance to attach to other
sessions and swap between them". Samassa viestissä hän kuitenkin sanoo:
"I don't expect us to work on this" **(lähde)**. Issue [#8248][pi-8248] pyysi
"a supported native TUI/client contract that can attach to one of several
already-running sessions" ja kertoi, että ilman sitä laajennus joutuu
rakentamaan TUI:n uudelleen, "it remains a second orchestration layer and
repeatedly drifts from Pi behavior". Issue suljettiin automaattisesti
**(lähde)**. Myös [#10269][pi-10269] (etäistunnot) suljettiin automaattisesti
**(lähde)**.

**pi-durable.** "Experimental. The API changes without notice between releases"
([README][durable]) **(lähde)**. Se on kirjasto (Harness, Conversation,
Commit, Task), jonka tallennus on SQLite, JSONL, IndexedDB tai Cloudflaren
Durable Object. Mallissa on neljä käyttöliittymän kannalta tärkeää piirrettä
**(lähde)**:

- **Yksi kirjoittaja.** "One process owns a storage at a time; there is no
  cross-process locking." Näyttävä prosessi avaa saman tallennuksen
  `readOnly: true` -tilassa, jolloin kaikki kirjoitukset hylätään. Kun
  ehdotettiin, että generointi ajettaisiin erillisessä prosessissa
  (esimerkiksi tmux-ruudussa), Mario Zechner vastasi: "putting generation into a
  separate process with concurrent db writes can not work, as it violates the
  single writer invariant of pi durable" ([#10659][pi-10659]).
- **Committoitu tila on käyttöliittymän tila.** `watch()` antaa näkymän
  liittymishetken arvon ja sen jälkeen jokaisen commitin operaatiot, "for
  example to a remote client that applies them". Näkymä on ikkuna (oletuksena
  50–100 uusinta merkintää), ja `ConversationTranscript` täyttää aukot
  uudelleenyhdistämisen jälkeen.
- **Idempotentti lähetys.** "A retried submission with the same `requestId`
  returns the existing submission instead of submitting twice."
- **Steer ja follow-up** ovat keskustelun jonon (`pi.inbox`) natiiveja
  käsitteitä samaan tapaan kuin Pi:n RPC:ssä.

`pi-coding-agent` ei riipu `pi-durable`sta (1.4.0:n `package.json`)
**(lähde)**. Durable-tallennus on siis eri asia kuin istuntotiedostot, joita
`pi` ja Open Habitat lukevat **(päättely)**.

## 3. Yhteinen kuvio ja sen muunnelmat

| | Claude Code RC | OpenCode | Codex app-server | Pi tänään |
|---|---|---|---|---|
| Kuka omistaa elävän istunnon | Terminaalin `claude` tai `claude remote-control` -palvelin | 1.x: TUI:n oma palvelin. 2.x: käyttäjän taustapalvelu | App-server: TUI:n sisäinen, daemon tai etäpalvelin | Se `pi`-prosessi, joka istunnon avasi |
| Terminaali | Omistaja, kirjoittaa suoraan | Aina asiakas (HTTP + SSE) | Asiakas (`--remote`, daemonin socket) | Omistaja, ei asiakasliittymää |
| Selain | claude.ai/code Anthropicin relayn kautta | `opencode web` tai pariutettu selain | Codexin omat sovellukset. HAPI app-serverin kautta | Ei natiivia. Open Habitat RPC:n kautta |
| Saman istunnon kaksi kirjoittajaa | Mahdotonta: yksi prosessi | Mahdotonta palvelimen sisällä | `WriterLockCoordinator` palauttaa `WouldBlock` | Mahdollista ja suojaamatonta (#8848) |
| Elinkaari | Prosessi. Palvelintila palauttaa kaatuneet istunnot | Palvelu tai palvelin | Omistaja, 30 min armonaika viimeisen tilaajan jälkeen | Prosessi |
| Valtuus | claude.ai-tili, valinnaisesti luotetut laitteet | Salasana, pariutuskoodi, token | Paikallinen socket. Etänä kykytoken tai allekirjoitettu bearer | Prosessin käynnistäjä |
| Monta ihmistä | Ei | Ei | Ei ("per-client environment isolation is not provided") | Ei |
| Kolmas osapuoli reitillä | Anthropic, myös transkripti | Valinnainen OpenTunnel | ChatGPT-mobiilissa OpenAI | Ei |

**(lähde edellisistä kohdista + päättely taulukon tiivistyksessä)**

Kuvion ydin on, että terminaali muuttuu yhdeksi asiakkaaksi. Codex ja OpenCode
2.x ovat siirtyneet siihen, että `codex` tai `opencode` ilman lisävalitsimia
liittyy käyttäjän taustapalveluun eikä käynnistä omaa moottoria. Kahden
kirjoittajan ongelma katoaa, koska kirjoittaja on aina palvelu. Claude Code
pitää terminaalin omistajana ja siirtää tilan laitteille relayn kautta
**(päättely)**. Pi on ainoa, jossa terminaali on edelleen ainoa omistaja eikä
asiakkaalle ole rajapintaa. Pi:n ainoa yritys muuttaa tätä poistettiin
**(lähde + päättely)**.

## 4. Kypsyys ja lisenssi

Mittaukset GitHub API:sta 31.10.2026 **(lähde)**:

| | Lisenssi | Tähdet | Uusin julkaisu | Etäkäytön tila |
|---|---|---|---|---|
| Claude Code | Suljettu ("© Anthropic PBC. All rights reserved", repon `LICENSE.md`) | 154 006 (repo sisältää vain issuet ja pluginit) | – | Julkaistu helmikuussa 2026. Palvelintila ja monta muuta ominaisuutta versioista v2.1.2xx alkaen |
| OpenCode | MIT | 223 409 | v2.2.5 (30.10.), npm `latest` 1.19.5 | `web`/`attach` dokumentoitu. 2.x-palvelu ja tunneli dokumentoimatta |
| Codex | Apache-2.0 | 132 269 | rust-v0.166.0 (29.10.) | App-server ja WebSocket "experimental and unsupported", daemon "experimental" |
| Pi | MIT | 119 075 | v1.4.0 (21.10.) | Ei etäkäyttöä. pi-server poistettu 12.10. pi-durable "Experimental" |
| HAPI | AGPL-3.0 | 5 339 | v0.33.3 (29.10.) | Codexin jaetut istunnot 0.154:stä alkaen |

Claude Code Remote Controlin julkistus keräsi HN:ssä 544 pistettä
([HN 47148454][hn-rc]). Kommenteista kaksi linjaa on yleisiä. Ensimmäinen on
"We've re-invented GNU screen in the most inefficient way imaginable", ja moni
kertoo käyttävänsä tmuxia, moshia ja Tailscalea. Toinen on käytännön
kritiikki: "You can't interrupt Claude (you press stop and he keeps going!)" ja
"The UI disconnects intermittently" **(lähde)**. Myöhempi tarina "Anyone else
having a terrible experience with Claude Code's remote control?" (huhtikuu)
viittaa samaan **(lähde)**. Dokumentaation pitkä rajoitusluettelo (403-uusinnat,
10 minuutin katkos palvelintilassa, 30 minuutin presence-heartbeat) kertoo,
että relayn varaan rakennettu yhteinen istunto on vaatinut paljon hiomista
**(päättely)**.

## 5. Rinnakkain Open Habitatin kanssa

Open Habitatin sarake perustuu tiedostoihin `docs/product.md` ja juuren
`AGENTS.md` sekä daemonin koodiin.

| | Harnessien malli | Open Habitat |
|---|---|---|
| Elävän istunnon omistaja | Harnessin oma prosessi tai palvelu | Käyttäjän daemonin `pi --mode rpc` -lapsi, joka jatkaa selaimen sulkemisen jälkeen |
| Terminaalissa aloitettu keskustelu selaimessa | Ohjattava (Claude, OpenCode attach, Codex/HAPI) | Vain luettava |
| Selaimessa aloitettu keskustelu terminaalissa | Ohjattava (`opencode attach`, `codex --remote`, `hapi resume`) | Natiivi historia luettavissa ja jatkettavissa, kun selaimen Pi on päättynyt. Elävään ei voi liittyä |
| Kahden kirjoittajan esto | Yksi prosessi (Claude, OpenCode) tai harnessin lukko (Codex) | Oma neuvoa-antava lukko selaimen lapsille ja prosessilaskenta. Ehdotonta poissulkemista ei luvata |
| Ihmisten erotus | Ei ole | Unix-tunnus, oma daemon, gateway ja broker erillään |
| Selaimen tunnistus | Tili ja relay, salasana tai token | GitHub-kirjautuminen, ylläpitäjän pääsypäätös |
| Jaetun tilan kopio | Claude: transkripti Anthropicilla. HAPI: oma SQLite. OpenCode: oma SQLite | Ei kopiota: Pi:n natiivi historia |
| Epävarma lähetys | HAPI: "never automatically replayed". pi-durable: `requestId` | Tarkistetaan uudelleenyhteyden jälkeen, ei automaattista uudelleenlähetystä |

## 6. Suositukset

### Mitä Open Habitat voisi oppia tai ottaa käyttöön (tärkeysjärjestyksessä)

1. **Pyydä Pi:ltä natiivi kirjoittajalukko istuntotiedostolle.** Lukon pitäisi
   kieltäytyä avaamasta tiedostoa toiselle kirjoittavalle prosessille ja
   kertoa syy ("already in use"), samaan tapaan kuin Codexin `WouldBlock`.
   *Miksi:* tämä on pienin muutos, joka sulkee Open Habitatin tunnetun aukon
   "eri kirjoittajien ehdotonta poissulkemista ei luvata". Lukon pitäisi
   kuulua harnessille, koska vain Pi tietää, milloin terminaalin `pi` avaa
   tiedoston. Open Habitatin oma lukko ja prosessilaskenta ovat täsmälleen
   sitä natiivin rinnalle rakennettua koneistoa, jota periaatteet välttävät,
   ja natiivi lukko tekisi niistä suurimman osan tarpeettomiksi. Pyyntö on
   valmiiksi muotoiltu issuessa #8848, ja sille on tarjolla PR. Puuttuu vain
   ylläpitäjän hyväksyntä **(päättely)**.
2. **Pyydä Pi:ltä attach-sopimus: elävällä istunnolla yksi omistaja ja monta
   asiakasta.** Pi-prosessi kuuntelisi käyttäjän yksityistä Unix-socketia
   (esimerkiksi `$XDG_RUNTIME_DIR` alla) samalla RPC-protokollalla kuin
   stdin ja stdout. `pi attach <istunto>` avaisi natiivin TUI:n asiakkaana.
   *Miksi:* tämä on Codexin ja OpenCode 2.x:n malli, ja se ratkaisee kysymyksen
   3 Open Habitatin periaatteiden mukaisesti. Open Habitatin daemon omistaa jo
   Pi-lapsen, joten selaimessa aloitettu keskustelu olisi terminaalista
   jatkettavissa elävänä, ja istunnon tila pysyisi Pi:ssä. Pi:n oma kokeilu
   (`pi-server`, "multiple presentation attachments", Unix-socket) osoittaa,
   että ylläpitäjät pitävät mallia mahdollisena, ja Ronacherin kommentti
   #5700:ssa nimeää saman tarpeen. Pyynnön kannattaa olla kapea: pelkkä
   paikallinen socket, joka käyttää olemassa olevaa RPC:tä, eikä uusi
   palvelinpino, jonka Pi juuri poisti **(päättely)**.
3. **Elinkaari seuraa omistajaa, ei asiakkaiden määrää, ja joutilas istunto
   puretaan armonajan jälkeen.** Codex pitää ketjun ladattuna 30 minuuttia
   viimeisen tilaajan lähdön jälkeen, ja HAPI kirjoittaa saman säännön auki.
   *Miksi:* Open Habitatissa daemon omistaa Pi:n, eikä selaimen sulkeminen saa
   pysäyttää sitä. Monen käyttäjän palvelimella joutilaat prosessit kuitenkin
   vievät muistia. Codexin sääntö (ei tilaajia *eikä* aktiivisuutta tietyn ajan)
   on yksinkertainen ehto Orca-vertailun lepotilasuositukselle, ja jatkaminen
   tapahtuu Pi:n omasta istuntotiedostosta **(päättely)**.
4. **Monen asiakkaan vastaukset: harness ratkaisee, käyttöliittymä näyttää
   neutraalin tuloksen.** HAPIn "A submitted Web answer is only a candidate" ja
   "Resolved in Codex" ovat oikea malli, jos Pi:n kysymykseen voi joskus vastata
   sekä terminaalista että selaimesta. *Miksi:* `docs/product.md` sanoo jo, ettei
   vastaanotto vahvista käsittelyä. Kun asiakkaita on monta, tarvitaan lisäksi
   tila "vastattu toisaalla", jotta selain ei keksi voittajaa. Tämä on hyvä
   kirjata Pi-pyyntöön: attach-sopimuksen pitää lähettää kaikille asiakkaille
   tieto siitä, että kysymys on ratkaistu **(päättely)**.
5. **Idempotentti lähetys natiivilla pyyntötunnisteella.** pi-durablen
   `requestId` palauttaa saman lähetyksen, jos pyyntö toistetaan. *Miksi:* Open
   Habitat tarkistaa nyt lähetyksen tuloksen uudelleenyhteyden jälkeen eikä
   lähetä uudelleen. Jos Pi:n RPC:n `prompt` hyväksyisi pyyntötunnisteen ja
   tunnistaisi sen kaksoiskappaleet, epävarmasta lähetyksestä voisi toipua
   ilman Open Habitatin omaa kuittauskirjanpitoa. Tämä on pienempi ja
   erillinen pyyntö Pi:lle **(päättely; Pi:n RPC:n nykyinen tuki tarkistamatta)**.
6. **Push-ilmoitusten vaimennus, kun ihminen on paikalla.** Claude Code jättää
   ilmoituksen lähettämättä, kun terminaali on fokusoituna, ja
   `CLAUDE_CLIENT_PRESENCE_FILE` laajentaa saman koko koneeseen. *Miksi:* jos
   Jari päättää ottaa Web Pushin käyttöön (HAPI- ja Orca-vertailujen suositus),
   ilmoitus ei saa tulla puhelimeen, kun sama keskustelu on auki ja näkyvissä
   selaimessa. Selaimen näkyvyystieto riittää tähän ilman palvelinpuolen
   tilavarastoa **(päättely)**.

### Mitä Pi:ltä kannattaa pyytää ja miten

**(päättely)** Järjestys on 1) kirjoittajalukko, 2) idempotentti
pyyntötunniste RPC:n `prompt`iin ja 3) paikallinen attach-socket samalla
RPC-protokollalla, jolloin ratkaistujen kysymysten tieto lähtee kaikille
asiakkaille. Pi:n prosessissa uusien osallistujien issuet suljetaan
automaattisesti, ja ylläpitäjä avaa ne tai antaa `lgtmi`/`lgtm`-luvan. Pyyntö
kannattaa siksi tehdä yhtenä hyvin rajattuna issuena, joka viittaa
issueihin #8848 ja #5700 ja kertoo konkreettisen käyttötapauksen: daemon omistaa
RPC-lapsen, ja ihminen avaa saman istunnon terminaalissa. Pi:n linja on ollut
pitää ydin pienenä ja poistaa kokeiluja, joten ensimmäinen pyyntö (lukko) on
todennäköisin hyväksyä. Attach-sopimuksesta voi tulla vastaukseksi "tee se
laajennuksena". Silloin Open Habitatin kannattaa pysyä nykyisessä rajauksessa
(terminaalin keskustelu on selaimessa vain luettava) eikä rakentaa liitosta
itse. Issuen tekeminen Pi:n repoon on julkinen teko, joten se jää Jarin
päätettäväksi.

### Missä Open Habitat on jo parempi

- **Ihmiset erotetaan.** Kaikissa kolmessa harnessissa jaettu palvelu on yksi
  käyttöjärjestelmätunnus, ja valtuus on tili, salasana tai token. Codexin
  README sanoo suoraan, ettei asiakaskohtaista eristystä ole. Open Habitatin
  Unix-tunnus, käyttäjäkohtainen daemon ja kolmen valtuuden erottelu ovat
  ainoa malli, jolla monen ihmisen palvelin on mahdollinen.
- **Transkriptistä ei ole kopiota kolmannella osapuolella.** Claude Coden
  etäkäyttö tallentaa transkriptin Anthropicin palvelimille, ja HAPI ja
  OpenCode pitävät omaa SQLite-varastoaan. Open Habitat näyttää Pi:n natiivin
  historian sellaisenaan.
- **Selaimen tunnistus on oikea kirjautuminen.** OpenCoden ja Codexin
  etäpääsyä ei ole tarkoitettu suoraan internetiin ilman lisäsuojaa (Codex:
  "allow unauthenticated connections by default during rollout"; OpenCode:
  ilman salasanaa "unsecured"). Open Habitatissa on GitHub-kirjautuminen,
  ylläpitäjän pääsypäätös ja pitkäikäinen istunto julkisen osoitteen takana.
- **Epävarma tulos kerrotaan rehellisesti.** Open Habitatin säännöt
  lähetyksestä, kysymyksistä ja keskeytyksestä (`docs/product.md`) ovat samaa
  tasoa kuin HAPIn huolellisin kuvaus, ja ne ovat tiukempia kuin Claude Coden
  käytäntö sulkea välitetty dialogi viiden minuutin jälkeen oletusvalinnalla.
- **Daemon omistaa Pi:n jo nyt.** Selaimen keskustelu ei riipu terminaalista
  eikä tmuxista, kun taas Claude Coden ohje neuvoo käynnistämään etäkoneen
  `claude`-prosessin tmuxissa.

### Mitä ei kannata kopioida

- **Oma attach- tai relaykerros Pi:n ympärille.** #8248:n kirjoittaja kertoo
  kokemuksesta, että tällainen kerros "remains a second orchestration layer
  and repeatedly drifts from Pi behavior". Se olisi Open Habitatissa juuri se
  toinen totuus, jonka periaatteet kieltävät. Jos Pi ei tarjoa attachia,
  nykyinen rajaus (vain luettava) on oikea.
- **pi-durablen käyttöönotto nyt.** Kirjasto on kokeellinen, `pi` ei käytä
  sitä, ja sen tallennus on eri kuin istuntotiedostot. Siirtyminen veisi
  keskustelut pois paikasta, jossa terminaalin `pi` ne näkee. Sen mallista
  kannattaa lainata ajatuksia (yksi kirjoittaja, näyttäjä vain luku -tilassa,
  `requestId`) Pi-pyyntöihin, ei koodia.
- **Kaksi Pi-kirjoittajaa samaan istuntoon.** Pi:n ylläpitäjän sanoin
  samanaikaiset kirjoitukset "can not work". Open Habitatin nykyinen
  varovaisuus on oikein.
- **Valmistajan relay ja transkriptin tallennus sen palvelimille.** Tämä
  lisäisi kolmannen osapuolen reitille ja toisen kopion historiasta.
- **App-serverin tai palvelun avaaminen tunnelilla tai WebSocketilla
  internetiin.** Open Habitatin gateway on jo todennettu sisäänkäynti, eikä
  käyttäjän daemonin socketin pidä näkyä verkkoon.
- **Salasana tai token koko palvelun valtuutena.** OpenCoden pariutettu token
  saa myös tunnistetietojen asettamisen. Open Habitatissa daemon ei luota
  selaimen eikä gatewayn identiteettiväitteisiin.

## Mitä en tavoittanut

- Claude Coden lähdekoodi on suljettu, joten Remote Controlin rakenne perustuu
  pelkästään dokumentaatioon.
- OpenCode 2.x:n palvelutilalle ja tunnelille ei ole julkaistua dokumentaatiota
  (`opencode.ai/docs/service/` ja `/docs/remote/` palauttavat 404:n). Kuvaus
  perustuu `dev`-haaran lähdekoodiin ja v1.19.5-tagiin. En selvittänyt, mikä
  npm-paketti jakaa 2.x-binäärin, enkä tarkistanut jokaista 2.x:n lähdeviitettä
  julkaisutagia vasten.
- Codexin etäohjauksen dokumentaatiota osoitteessa
  `developers.openai.com/codex/remote-control` ei ole (404). Mobiilin kuvaus on
  sivuilta "Codex on mobile" ja "Remote connections".
- En löytänyt syytä pi-serverin poistolle commitista, muutoslokista, PR:stä
  enkä issueista.
- En käyttänyt yleistä verkkohakua (DuckDuckGo palautti aiemmalle ajolle
  haastesivun). Haut tehtiin GitHub API:lla ja HN Algolialla.

## Lähteet

- Claude Code Remote Control: <https://code.claude.com/docs/en/remote-control>
- Claude Code -repon LICENSE.md: <https://github.com/anthropics/claude-code/blob/main/LICENSE.md>
- OpenCode Web: <https://opencode.ai/docs/web/>
- OpenCode Server: <https://opencode.ai/docs/server/>
- OpenCode CLI: <https://opencode.ai/docs/cli/>
- OpenCode `packages/process-daemon/README.md`: <https://github.com/anomalyco/opencode/blob/45920000858f1097977f02b1be2d0f7639e063c5/packages/process-daemon/README.md>
- OpenCode `packages/server/src/auth.ts`: <https://github.com/anomalyco/opencode/blob/45920000858f1097977f02b1be2d0f7639e063c5/packages/server/src/auth.ts>
- OpenCode `packages/server/src/pairing.ts`: <https://github.com/anomalyco/opencode/blob/45920000858f1097977f02b1be2d0f7639e063c5/packages/server/src/pairing.ts>
- OpenCode `packages/cli/src/services/remote-tunnel.ts`: <https://github.com/anomalyco/opencode/blob/45920000858f1097977f02b1be2d0f7639e063c5/packages/cli/src/services/remote-tunnel.ts>
- OpenCode `packages/cli/src/services/service-config.ts`: <https://github.com/anomalyco/opencode/blob/45920000858f1097977f02b1be2d0f7639e063c5/packages/cli/src/services/service-config.ts>
- OpenCode `packages/cli/src/commands/handlers/default.ts`: <https://github.com/anomalyco/opencode/blob/45920000858f1097977f02b1be2d0f7639e063c5/packages/cli/src/commands/handlers/default.ts>
- OpenCode `packages/cli/src/services/server-connection.ts`: <https://github.com/anomalyco/opencode/blob/45920000858f1097977f02b1be2d0f7639e063c5/packages/cli/src/services/server-connection.ts>
- OpenCode v1.19.5 `packages/cli/src/services/daemon.ts` (salasanatiedosto ja rekisteröinti): <https://github.com/anomalyco/opencode/blob/v1.19.5/packages/cli/src/services/daemon.ts>
- Codex App Server: <https://developers.openai.com/codex/app-server>
- Codex `app-server-daemon` README: <https://github.com/openai/codex/blob/67f0994b532b8740f14b5b738af7b7b2a915b1d6/codex-rs/app-server-daemon/README.md>
- Codex `writer_lock.rs`: <https://github.com/openai/codex/blob/67f0994b532b8740f14b5b738af7b7b2a915b1d6/codex-rs/rollout/src/writer_lock.rs>
- Codex on mobile: <https://developers.openai.com/codex/remote>
- Remote connections: <https://learn.chatgpt.com/docs/remote-connections>
- HAPI, Codex shared sessions: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/codex-shared-sessions.md>
- Pi, How Pi Works: <https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/docs/how-pi-works.md>
- Pi, RPC Mode: <https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/docs/rpc.md>
- Pi, Session File Format: <https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/docs/session-format.md>
- Pi coding-agent CHANGELOG: <https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/CHANGELOG.md>
- pi-durable README: <https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/durable/README.md>
- pi-server README (v1.1.0): <https://github.com/earendil-works/pi/blob/abe508e1b8/packages/server/README.md>
- Pi commit 7472cda0 (pi-serverin poisto): <https://github.com/earendil-works/pi/commit/7472cda0d6>
- Pi PR #7409: <https://github.com/earendil-works/pi/pull/7409>
- Pi issue #5700: <https://github.com/earendil-works/pi/issues/5700>
- Pi issue #8248: <https://github.com/earendil-works/pi/issues/8248>
- Pi issue #8848: <https://github.com/earendil-works/pi/issues/8848>
- Pi issue #10269: <https://github.com/earendil-works/pi/issues/10269>
- Pi issue #10659: <https://github.com/earendil-works/pi/issues/10659>
- HN: Claude Code Remote Control (25.2.2026): <https://news.ycombinator.com/item?id=47148454>
- HN: Anyone else having a terrible experience with Claude Code's remote control? (5.4.2026): <https://news.ycombinator.com/item?id=47645915>
- Open Habitat: `docs/product.md`, `internal/daemon/pi_rpc_linux.go`, `internal/daemon/pi_ownership_linux.go`, `internal/daemon/continuation_linux.go`

[pi-commit]: https://github.com/earendil-works/pi/tree/9b7a44c48d736125e63c4ba3f49a5a0377431111
[codex-commit]: https://github.com/openai/codex/tree/67f0994b532b8740f14b5b738af7b7b2a915b1d6
[oc-commit]: https://github.com/anomalyco/opencode/tree/45920000858f1097977f02b1be2d0f7639e063c5
[hapi-commit]: https://github.com/tiann/hapi/tree/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8
[rc]: https://code.claude.com/docs/en/remote-control
[oc-web]: https://opencode.ai/docs/web/
[oc-server]: https://opencode.ai/docs/server/
[oc-cli]: https://opencode.ai/docs/cli/
[oc-pty]: https://github.com/anomalyco/opencode/blob/45920000858f1097977f02b1be2d0f7639e063c5/packages/process-daemon/README.md
[codex-as]: https://developers.openai.com/codex/app-server
[codex-daemon]: https://github.com/openai/codex/blob/67f0994b532b8740f14b5b738af7b7b2a915b1d6/codex-rs/app-server-daemon/README.md
[codex-wl]: https://github.com/openai/codex/blob/67f0994b532b8740f14b5b738af7b7b2a915b1d6/codex-rs/rollout/src/writer_lock.rs
[codex-mobile]: https://developers.openai.com/codex/remote
[codex-rc]: https://learn.chatgpt.com/docs/remote-connections
[hapi-codex]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/codex-shared-sessions.md
[pi-how]: https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/docs/how-pi-works.md
[pi-rpc]: https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/docs/rpc.md
[pi-session]: https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/docs/session-format.md
[pi-changelog]: https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/coding-agent/CHANGELOG.md
[durable]: https://github.com/earendil-works/pi/blob/9b7a44c48d736125e63c4ba3f49a5a0377431111/packages/durable/README.md
[pi-server]: https://github.com/earendil-works/pi/blob/abe508e1b8/packages/server/README.md
[pi-remove]: https://github.com/earendil-works/pi/commit/7472cda0d6
[pi-7409]: https://github.com/earendil-works/pi/pull/7409
[pi-5700]: https://github.com/earendil-works/pi/issues/5700
[pi-8248]: https://github.com/earendil-works/pi/issues/8248
[pi-8848]: https://github.com/earendil-works/pi/issues/8848
[pi-10269]: https://github.com/earendil-works/pi/issues/10269
[pi-10659]: https://github.com/earendil-works/pi/issues/10659
[hn-rc]: https://news.ycombinator.com/item?id=47148454
