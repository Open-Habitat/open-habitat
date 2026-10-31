# Vertailu: Orca (Stably AI)

Tutkimusajo `01m68ge1x5z25fnne05jmmv3za`, 31.10.2026. Lähteinä ovat Orcan
GitHub-repo ja sen lähdekoodi (luettu commitista [`b45d71bf`][commit],
31.10.2026), dokumentaatio, joka on samassa repossa (`docs/site/content/docs/`)
ja julkaistuna osoitteessa onorca.dev, sekä yhtiön verkkosivut, Y Combinatorin
yrityssivu ja Hacker News -keskustelut. Merkintä **(lähde)** tarkoittaa, että
asia lukee lähteessä tai koodissa. **(päättely)** on oma tulkintani.

## Tiivistelmä

Jarin mainitsema "Orca" on lähes varmasti Stably AI:n **Orca**
(github.com/stablyai/orca): MIT-lisensoitu ja ilmainen Electron-sovellus,
jossa ajetaan Claude Codea, Codexia, Pi:tä tai mitä tahansa CLI-agenttia
rinnakkain, kukin omassa git-worktreessään. Mukana ovat iOS- ja
Android-sovellus, selainasiakas sekä `orca serve` -palvelin, joka pitää agentit
käynnissä toisella koneella. Tuote on poikkeuksellisen nopeasti kasvanut:
noin 111 000 tähteä seitsemässä kuukaudessa, uusi versio lähes joka päivä
ja 25 hengen YC-yhtiö takana. Rakenteeltaan se on kuitenkin **yhden
käyttäjän** työkalu. Runtime ajaa kaiken yhden käyttöjärjestelmätunnuksen
oikeuksin, ja jokainen pariutettu laite, puhelin tai selain *on* tämä
käyttäjä. Lisäksi agentit käynnistetään oletuksena ilman lupakyselyitä
(`--dangerously-skip-permissions`, `--yolo`). Orca on siis Open Habitatin
lähin kilpailija siinä, mitä käyttäjä näkee, mutta ei siinä, mitä Open
Habitat lupaa: useaa ihmistä samalla palvelimella Unix-tunnuksin
erotettuina, selainta ensisijaisena pääsynä ja natiivien työkalujen omaa
totuutta ilman rinnakkaisia varastoja. Opittavaa on silti paljon, ja se
painottuu ihmisen silmukkaan: diffiin rivikohtaisesti kirjoitetut
kommentit lähetetään agentille yhtenä eränä, puhelimeen tulee
push-ilmoitus, kun agentti odottaa, joutilaat agentit säästetään
lepotilaan natiivin jatkamisen varaan ja muistille asetetaan
käyttäjäkohtaiset rajat. Suositukset ovat lopussa tärkeysjärjestyksessä.

## 1. Mikä "Orca" on kyseessä

Stably AI:n Orca sopii Open Habitatin tilaan selvästi parhaiten: se on
agenttien työympäristö, jolla on palvelin-, selain- ja mobiilipääsy ja joka
tukee nimenomaan Pi:tä ([README][readme], [tuetut agentit][supported])
**(lähde)**. Muut löytämäni ehdokkaat:

- **echoVic/orca-agent**: DeepSeek-kohtainen koodausagentti, noin 500 tähteä
  ([GitHub](https://github.com/echoVic/orca-agent)). Se on harness
  eikä host, joten se on Pi:n eikä Open Habitatin vertailukohta.
- **Orca-Agent-RL**: tutkimusprojekti, jossa vahvistusoppimisella
  koulutetaan orkestrointimallia
  ([GitHub](https://github.com/Danau5tin/Orca-Agent-RL)). Ei tuote.
- **GNOME Orca** on ruudunlukija, ja Homebrew'n `orca` on Plotlyn
  kaaviotyökalu. Molemmat ovat nimitörmäyksiä, jotka Stably mainitsee itse:
  siksi Orcan Linux-komento on `orca-ide` ([Remote Orca Servers][remote]).
- Kirjoitusasuilla "Okra" ja "Ocra" ei löytynyt tähän tilaan kuuluvaa
  tuotetta.

Stablyn Orcan ympärille on jo syntynyt kolmannen osapuolen ekosysteemi,
esimerkiksi `orca-viz`, `orca-dashboard` ja `orca-notify` (GitHub-haku
31.10.) **(lähde)**. Sekin viittaa siihen, että juuri tämä on se Orca, josta
puhutaan.

## 2. Mikä Orca on ja kenelle

Orca kuvaa itseään nimillä "agent development environment" ja "The AI
Orchestrator for 100x builders" ([README][readme]). YC-sivun mukaan se on
tehty insinööreille, jotka ajavat "10–100 koodausagenttia kerralla"
([YC][yc]) **(lähde)**. Käyttäjä tuo oman tilauksensa (Claude Max, ChatGPT,
Z.ai jne.), eikä Orca ole malli eikä välitä mallikutsuja ([Enterprise][ent])
**(lähde)**.

Tuote alkoi Stablyn sisäisenä työkaluna ja avattiin maaliskuussa 2026
otsikolla "Open Source 'Conductor + Ghostty'" ([Show HN][shn]) **(lähde)**.
Stably AI (YC W22) teki aiemmin tekoälypohjaista testausta, ja yhtiöllä on
YC:n mukaan 25 työntekijää San Franciscossa ([YC][yc]) **(lähde)**.

Kohderyhmä on yksittäinen ammattikehittäjä, joka haluaa yhteen ikkunaan
monta rinnakkaista agenttia, terminaalit, diffit, selaimen, GitHub-, Linear-
ja Jira-integraatiot sekä puhelimen kaukosäätimeksi. Tiimeille tarjotaan
"Enterprise"-yhteydenottoa, mutta tiimikäyttö tarkoittaa, että jokainen
ajaa omaa Orcaansa ([Enterprise][ent]) **(lähde + päättely)**.

## 3. Arkkitehtuuri

### Missä agentit ajetaan

Orcalla on neljä ajotapaa ([Ways to run][ways]) **(lähde)**:

1. **Paikallinen työpöytä**: agentit, terminaalit ja upotettu Chromium
   ajetaan samalla koneella kuin käyttöliittymä.
2. **SSH-kohde**: kannettavan Orca ajaa worktreet ja agentit etäkoneella
   SSH:n yli. Runtimen omistaa silti kannettava.
3. **Remote Orca Server**: toisella koneella ajetaan Orca-työpöytää tai
   otsatonta `orca serve` -prosessia. *Palvelin* omistaa projektit,
   worktreet, terminaalit ja agenttiprosessit, ja kannettava, selain ja
   puhelin ovat pelkkiä asiakkaita ([Remote Orca Servers][remote]). Toiminto
   on merkitty betaksi.
4. **Cloud VM**: repoon tallennettu `orca.yaml`-resepti luo jokaiselle
   worktreelle oman hiekkalaatikon käyttäjän omalle pilvitilille (Vercel
   Sandbox, Fly, Modal, Docker). Toiminto on kokeellinen.

Terminaalien PTY:t omistaa Orcan oma taustadaemon, joten agentit jatkavat,
vaikka sovellus suljetaan. Koneen uudelleenkäynnistys tappaa ne
([Session restore][restore], daemonin [AGENTS.md][daemon-agents])
**(lähde)**. Daemon on itse kirjoitettu, ei tmux. Sen ohjeissa on kuvattu
pitkä sarja kilpailutilanteita socket-polun omistajuudessa, mukaan lukien
"seitsemän katselmointikierrosta" ja "kaksikymmentäkolme virhettä" saman
lomittumisen ympärillä ([daemon AGENTS.md][daemon-agents]) **(lähde)**.
Open Habitat välttää tämän työn jättämällä istunnon pitämisen tmuxille ja
Pi:lle **(päättely)**.

Linux-palvelimella jokainen terminaali ajetaan omassa systemd-käyttäjäscopessaan.
Sille voi antaa muistirajan `ORCA_TERMINAL_MEMORY_MAX`, joka asetetaan scopen
`MemoryMax`-arvoksi. Raja vaatii cgroup v2:n ja lingerin, ja oletuksena se on
pois päältä ([Remote Orca Servers][remote]) **(lähde)**.

### Eristys ja valtuudet

Orcan oma lähdekoodi sanoo valtuusmallin suoraan.
[`rpc-method-permission.ts`][perm] määrittelee `workspace`-oikeuden näin:
"Projects, worktrees, terminals, files, git, browser, orchestration and
integrations; equals running commands as this host's user" **(lähde)**.
Kutsujia on kolmea lajia ([`rpc-caller-scope.ts`][scope]): `owner`
(paikallinen työpöytä ja CLI), `mobile` (metodien sallittujen lista) ja
`runtime-paired` (selain tai toinen työpöytä). Pariutettu asiakas saa
vakiona oikeudet `workspace`, `settings-write`, `accounts-admin`,
`skills-admin` ja `host-admin`. Ainoastaan työpöydän ohjaus (`desktop-control`)
vaatii erillisen luvan, ja pariutuksen hallintaa ei anneta koskaan
**(lähde)**.

Pääsy palvelimelle perustuu **pariutuslinkkiin**. Palvelin tulostaa
URL:n, jonka fragmentissa on pariutustunniste ([`createWebClientUrl`][weburl]),
ja jokaiselle asiakkaalle syntyy oma peruttava token. Ohjeen mukaan linkkiä on
käsiteltävä kuin salasanaa, palvelinta ei saa avata julkiseen internetiin ja
yhteyden kuuluu kulkea Tailscalen, WireGuardin, lähiverkon tai SSH-tunnelin
kautta ([Remote Orca Servers][remote]) **(lähde)**. Selainasiakas on
staattinen sivu (`/web-index.html`), jonka runtime itse tarjoilee
([`static-web-client-handler.ts`][static]) **(lähde)**. Erillistä
identiteetintarjoajaa, palvelimen käyttäjätiliä tai ylläpitäjän hyväksyntää ei
ole. Linkin haltija on sama kuin tunnuksen omistaja **(päättely koodista ja
ohjeesta)**.

Puhelin yhdistetään joko suoraan (lähiverkko tai Tailscale) tai Stablyn
ylläpitämän **Orca Relayn** kautta. Relay yhdistää puhelimen ja työpöydän
lähtevät WebSocket-yhteydet ja välittää kehykset niiden välillä. Push-yhdyskäytävä
pitää hallussaan APNs-avaimen. Relay vaatii kirjautumisen Orca-tiliin
(`login.onorca.dev`) ([Mobile][mobile], [cloud/README][cloud]) **(lähde)**.
Koodissa on X25519-avaimiin perustuva päästä päähän -salaus
(`mobile-e2ee-*`). En tarkistanut, kattaako se kaiken relayn kautta
kulkevan liikenteen (**päättely**: nimistä ja README:stä päätellen kattaa).
Huomionarvoista on, että telemetriasivu sanoo "Orca has no account system"
([Telemetry][telemetry]), vaikka relay vaatii tilin. Tili on siis olemassa,
mutta vain relayta varten **(lähde + päättely)**.

**Agenttien luvat.** Orca käynnistää jokaisen tuetun agentin oletuksena
täysillä valtuuksilla: Claude saa `--dangerously-skip-permissions`, Codex
`--dangerously-bypass-approvals-and-sandbox` ja useimmat muut `--yolo`
([Agents & sessions][sessions]). Perusteena on, että "the worktree itself is
the sandbox". Tuettujen agenttien sivu korjaa tämän itse: worktree on
"an isolated checkout, not a security sandbox", ja asetuksista voi valita
**Manual**-tilan ([Supported agents][supported]) **(lähde)**. Työpöydällä
tämä tarkoittaa, että agentti toimii kehittäjän omin tunnuksin ja pääsee
kaikkiin hänen avaimiinsa **(päättely)**.

### Yksi vai monta käyttäjää

Orca on yhden käyttäjän ohjelma. "Monikäyttöisyys" tarkoittaa siinä
**monta asiakasta saman käyttäjän runtimeen**: sivupalkissa on
"Hide other-client workspaces" -suodatin, ja "Shared Server Access"
-listassa näkyvät pariutetut laitteet ([Remote Orca Servers][remote],
[Worktrees][worktrees]) **(lähde)**. Haku repon issueista ("multi-user",
"linux user isolation") ei löytänyt suunnitelmaa ihmisten erottamisesta
toisistaan. Palvelimen jakaminen kollegan kanssa tarkoittaisi
tunnusten ja kirjautumisten jakamista **(päättely)**.

### Istunnot, worktreet ja rinnakkaiset agentit

- **Worktree on perusyksikkö.** Jokainen tehtävä saa oman `git worktree`
  -hakemiston ja haaran. Elinkaari on luo, työskentele, katselmoi
  (diff, Annotate AI Diff, attribuutio), commitoi, pushaa, avaa PR ja
  poista ([Worktrees][worktrees]) **(lähde)**. Myös tavalliset kansiot
  kelpaavat työtiloiksi (Orcan [AGENTS.md][orca-agents]: "Folder
  Workspaces").
- **Agentti-istunto** on yksi CLI-agentti yhdessä terminaalissa. Tila
  (työskentelee, odottaa sinua, valmis, estynyt, joutilas) päätellään
  terminaalin OSC-otsikosta ja agenttihookeista. Pi:lle Orca asentaa oman
  laajennuksen, joka lähettää tilatapahtumat Orcan hook-palvelimelle
  ([`src/main/pi/`][pi-ext]) **(lähde)**. Valinnainen kanban-näkymä "Agent
  Dashboard" jakaa agentit sarakkeisiin Needs You, Working, Done ja Idle
  ([Agents & sessions][sessions]).
- **Historia.** Orca lukee agenttien omia istuntotiedostoja: Codexin
  `~/.codex/sessions`, Clauden `~/.claude` ja Pi:n session-tiedoston, jonka
  se jatkaa komennolla `pi --session <tiedosto>` ([Session history][history])
  **(lähde)**. Tämä on sama periaate kuin Open Habitatissa. Sen *päälle*
  Orca kuitenkin pitää omia varastojaan: SQLite-pohjaisen
  `agent-session-journal`-tietokannan (`journal_rows`, `journal_sessions`,
  `agent_session_records` …) strukturoitua chattia varten
  ([`journal-database-schema.ts`][journal]), oman terminaalien
  scrollback-tallenteen ja oman istuntorekisterin **(lähde)**.
- **Chat UI.** Claude, Codex, Grok, OpenCode, OMP ja Antigravity voivat
  avautua "strukturoituna chattina" ACP:n (Agent Client Protocol) kautta
  ([Chat UI][chat], `src/main/acp/acp-dialects/`). Pi:lle ei ole
  ACP-murretta, joten Pi näkyy Orcassa terminaalina, jolla on tila ja
  hookit ([Supported agents][supported]) **(lähde + päättely)**.
- **Lepotila (kokeellinen).** Valmis ja koskematon agentti, jonka tab ei
  ole näkyvissä, pysäytetään oletuksena 30 minuutin jälkeen. Kun käyttäjä
  palaa sen tabiin, agentti jatkaa natiivilla resume-komennolla. Ehtoja on
  monta: ei mobiilikäyttäjää, ei kesken olevaa orkestrointia, ei eläviä
  aliagentteja ([Hibernation][hibernation]) **(lähde)**.
- **Orkestrointi (kokeellinen).** CLI:n `orca orchestration` sisältää
  käsitteet Run, Task, Dispatch, worker, inbox ja "decision gate". Kyse on
  Orcan sisäänrakennetusta DAG- ja supervisio-kerroksesta
  ([Orchestration][orch]) **(lähde)**. Lisäksi on ajastetut automaatiot
  (`orca automations`, cron tai RRULE) ([Automations][auto]) **(lähde)**.

### Ihminen silmukassa ja hyväksynnät

- Ilmoitukset, kun agentti valmistuu, kello ja "mark unread" kuin
  Gmailissa ([Notifications][notif]). Puhelimeen tulee push-ilmoitus APNs:n
  ja FCM:n kautta ([Mobile][mobile]) **(lähde)**.
- Agentin kysymykset (Clauden `AskUserQuestion` ja vastaavat) näkyvät
  Chat UI:ssa vastattavina kortteina ([Chat UI][chat]) **(lähde)**.
- **Annotate AI Diff**: käyttäjä kommentoi diffin rivejä, ja kommentit
  lähetetään agentille yhtenä viestinä. Kommentit pysyvät rivissä kiinni
  korjauksen jälkeenkin, jolloin korjauksen voi tarkistaa, ja ne voi
  merkitä ratkaistuiksi. Perusteluna mainitaan, että yksi kommentti kerrallaan
  saa agentin "heilumaan" ([Annotate AI Diff][annotate]) **(lähde)**.
- **Worktree checkpoint**: agentti päivittää worktreen yksirivistä
  tilakommenttia (`orca worktree set --comment …`), jotta ihminen näkee
  vaiheen ilman chattia ([Checkpoints][checkpoint]) **(lähde)**.
- Varsinaisia hyväksyntäportteja ei ole, koska oletuksena luvat
  ohitetaan. Katselmointi tapahtuu jälkikäteen diffissä ja PR:ssä
  ([Enterprise][ent]: "Every agent change lands in a worktree and a pull
  request") **(lähde + päättely)**.

### Ulottuvuus: työpöytä, selain ja puhelin

- **Työpöytä**: macOS, Windows ja Linux (Electron) ([README][readme]).
- **Puhelin**: iOS-sovellus App Storessa ja Androidille APK, molemmat
  betaa. Sovellus on tarkoituksella "kaukosäädin, ei editori": tilat,
  scrollback, Chat UI, lyhyet vastaukset, sanelu, kuvaliitteet, Quick
  Commands, source control (stage ja commit) sekä tilinvaihto
  ([Mobile][mobile]) **(lähde)**.
- **Selain**: pariutettu selainasiakas Remote Orca Serveriin. Osa
  työpöydän toiminnoista puuttuu siitä (esimerkiksi kansion lataus ja
  terminaalien lopetus) ([SSH][ssh], [Terminal][terminal]) **(lähde)**.
  Selain on Orcassa kolmas asiakas, Open Habitatissa ainoa
  **(päättely)**.

### Natiivit työkalut vai oma alusta

Orca ottaa agentit natiiveina: se käynnistää CLI:n terminaaliin, käyttää
agentin omia kirjautumisia, lukee natiivia historiaa, jättää
`CLAUDE.md`/`AGENTS.md`-tiedostot rauhaan ja käyttää `gh`:ta GitHub-tilan
lukemiseen ([Hooks & memory][hooks], [Show HN][shn]) **(lähde)**. Kaiken
tämän ympärille se rakentaa kuitenkin laajan oman alustan: PTY-daemonin,
chat-journalin, istuntorekisterin, orkestrointikerroksen, automaatiot,
plugin-järjestelmän ja katalogin, upotetun selaimen, Computer Use -toiminnon,
Monaco-editorin, relayn ja push-palvelun. Lähdekoodia on noin 2,6 miljoonaa
riviä TypeScriptiä (`src`, `mobile` ja `cloud` yhteensä; mittasin
`wc -l`:llä, testit pois lukien) **(lähde: oma mittaus)**. Orca on siis
"natiivit agentit, oma kaikki muu", kun Open Habitat on "natiivit agentit
ja natiivit istunnot" **(päättely)**.

## 4. Hinnoittelu ja lisenssi

- Lisenssi on **MIT** (repon `LICENSE`, ja GitHub raportoi `MIT`). Myös
  relay- ja push-palvelun lähdekoodi on samalla lisenssillä, mutta
  tuotannon Terraform ja operointi ovat yksityisessä
  `stablyai/orca-cloud`-repossa ([cloud/README][cloud]) **(lähde)**.
- Sovellus on **ilmainen** ("Free and open source for macOS, Windows, and
  Linux"). Hinnastosivua ei ole: `onorca.dev/pricing` palauttaa 404:n.
  Maksullinen polku on Enterprise-yhteydenotto (käyttöönoton ohjaus,
  organisaation oletukset, "AICPA SOC 2 Readiness") ([Enterprise][ent])
  **(lähde)**.
- Telemetriaa lähetetään oletuksena PostHog Cloudiin (US). Sisältöä ei
  lähetetä, ja telemetrian voi kytkeä pois (`DO_NOT_TRACK=1`)
  ([Telemetry][telemetry]) **(lähde)**.
- Ansaintamalli on avoin kysymys. Todennäköisimmin se on enterprise ja
  ehkä myöhemmin hosted relay- tai pilvipalvelut **(päättely)**.

## 5. Kypsyys ja vetovoima

Mittaukset GitHub API:sta 31.10.2026 **(lähde)**:

| Mittari | Arvo |
|---|---|
| Repo luotu | 17.3.2026 |
| Tähdet / forkit | 111 324 / 7 041 |
| Commitit | noin 18 300 |
| Yhdistetyt PR:t | noin 17 200 |
| Avoimet issuet / PR:t | noin 4 200 / 3 600 |
| Julkaisut | v1.4.245 (30.10.), käytännössä päivittäin. Android-sovellus 0.0.61 |
| Latausmerkki README:ssä | "107m downloads". Uusimman julkaisun assetit noin 660 000 vuorokaudessa |

Latausluvut ovat paisuneet, koska auto-updater hakee uuden version joka
päivä. Ne kertovat silti, että aktiivisia asennuksia on todennäköisesti
satoja tuhansia **(päättely)**. Pääkehittäjät ovat Stablyn perustajat ja
työntekijät (nwparker yksin noin 7 000 committia), ja tuottavuus viittaa
siihen, että koodia kirjoittavat suurelta osin agentit **(päättely)**.

Riippumattomat äänet (HN) ovat enimmäkseen myönteisiä: "First tool that
actually works well on Linux" ([Show HN][shn]), "Orca has fully replaced
[herdr]", ja yksi käyttäjä ajaa Orcaa kotiproxmoxin LXC-kontissa ja seuraa
työtä Macilta ([HN 49926533][hn1]), sekä "a lot more mature" kuin itse
tehty vastine ([HN 49174195][hn2]). Kritiikki koskee Electronia ja
resurssien kulutusta ([HN 49174195][hn2], [HN 50303731][hn3]) **(lähde)**.
Kypsyys on epätasaista. Ydin (worktreet, terminaalit, työpöytä) on vakaa
ja laajasti käytetty. Remote Orca Server, mobiili, Chat UI, lepotila,
orkestrointi ja Cloud VM ovat betaa tai kokeellisia **(lähde: ohjeiden
merkinnät)**.

Samassa tilassa mainitaan usein myös **Conductor**, **cmux**, **herdr**,
**Paseo**, **Terminay** ja **Offrun** ([Show HN][shn], [HN 49943943][hn4]).
Ne ovat ehdokkaita issuelle `benchmark-candidates`.

## 6. Rinnakkain Open Habitatin kanssa

Open Habitatin sarake perustuu tiedostoihin `docs/product.md` ja juuren
`AGENTS.md`.

| | Orca | Open Habitat |
|---|---|---|
| Ensisijainen pääsy | Electron-työpöytä. Puhelin ja selain asiakkaina | Selain (työpöytä ja puhelin). SSH ja tmux rinnalla |
| Missä agentit ajetaan | Omalla koneella, SSH-kohteessa, Orca-palvelimella tai per-worktree-VM:ssä | Yhdellä Linux-palvelimella, ihmisen omana Unix-käyttäjänä |
| Käyttäjiä | Yksi per runtime. Monta asiakasta = sama käyttäjä | Monta ihmistä, kukin omalla Unix-tunnuksellaan |
| Tunnistus | Pariutuslinkki ja laitetoken yksityisessä verkossa. Relaylle Orca-tili | GitHub-kirjautuminen gatewayssa, ylläpitäjä päättää pääsystä, broker luo tilin |
| Valtuusraja | Isäntäkäyttäjä. Pariutettu asiakas saa myös `accounts-admin`- ja `host-admin`-oikeudet | Unix-käyttäjä. Daemon ei luota selaimen tai gatewayn identiteettiväitteisiin |
| Agentit | 35+ CLI-agenttia | Pi |
| Agentin luvat | Oletuksena YOLO, Manual valittavissa | Pi:n oma malli. Raja on Unix-tunnus |
| Istunnon pito | Oma PTY-daemon ja oma scrollback-tallenne | Pi:n prosessi daemonin omistamana. Natiivi historia, tmux |
| Historia | Natiivit transkriptit + oma SQLite-journal ja istuntorekisteri | Pi:n natiivi historia, ei rinnakkaista varastoa |
| Worktreet | Perusyksikkö. Luonti, diff ja PR sovelluksessa | Worktree-agentti; yhdistäminen ja hylkäys pyydetään agentilta |
| Rinnakkaiset agentit | Monta worktreetä, Agent Dashboard, oma orkestrointi | Workerit omina riveinään. Taskfleet on erillinen työkalu |
| Huomio | Desktop- ja push-ilmoitukset, unread, Needs You | "Sinun vuorosi" ja "Käynnissä", välilehden luku. Ei vielä OS-ilmoituksia |
| Katselmointi | Diff-katselin, rivikommentit erässä agentille, attribuutio | `edit`-diffit keskustelussa, Gitin tila yläpalkissa |
| Kieli | Englanti (README käännetty 8 kielelle) | Suomi |
| Lisenssi ja hinta | MIT, ilmainen, enterprise-myynti | Repossa ei vielä lisenssitiedostoa. Itse ylläpidetty palvelin |
| Kypsyys | 7 kk, 111k tähteä, päivittäiset julkaisut | Esijulkaisu, testipalvelin |

## 7. Suositukset

### Mitä Open Habitat voisi oppia tai ottaa käyttöön (tärkeysjärjestyksessä)

1. **Rivikohtaiset diff-kommentit yhtenä eränä agentille.** Worktree-agentin
   haaran diffiin voisi kirjoittaa kommentteja riveihin. "Lähetä Pi:lle"
   kokoaisi ne yhdeksi viestiksi, jossa on tiedosto- ja riviviittaukset.
   *Miksi:* tuotteen ydin on seurata ja ohjata agentin työtä, ja juuri
   katselmointi on se kohta, jossa puhelimella tai selaimella on nyt
   kömpelöintä antaa täsmällistä palautetta. Orcan perustelu, että erä
   tuottaa yhden johdonmukaisen korjauskierroksen, sopii Pi:n
   ohjausmalliin (Ohjaa/Lähetä) sellaisenaan. Kommentit voivat olla
   selaimen luonnos, kuten viestiluonnoskin, ja lähetetty versio jää Pi:n
   historiaan. Uutta varastoa ei tarvita **(päättely)**.
2. **Push-ilmoitus puhelimeen, kun keskustelu siirtyy "Sinun vuorosi"
   -listaan.** Orcan mobiilisovelluksen keskeinen arvo on "queue three
   agents, walk away" ([Notifications][notif]). Open Habitatissa tila on
   jo olemassa, mutta se näkyy vain avoimessa välilehdessä. *Miksi:*
   selaimen sulkeminen jättää agentin töihin, mutta käyttäjä ei saa
   tietää, milloin pitäisi palata. `docs/product.md` rajaa selain- ja
   käyttöjärjestelmäilmoitukset toistaiseksi ulos, joten tämä on Jarin
   tuotepäätös. Web Push vaatii palvelimelle VAPID-avaimen ja
   käyttäjäkohtaiset tilaukset, ja niiden sijoittaminen gatewayn ja
   daemonin välille on arkkitehtuurikysymys **(päättely)**.
3. **Käyttäjäkohtaiset muistirajat systemd:n avulla.** Orca asettaa
   jokaiselle terminaalille oman systemd-käyttäjäscopen ja tarjoaa
   valinnaisen `MemoryMax`-rajan ([Remote Orca Servers][remote]). *Miksi:*
   Open Habitatissa monta ihmistä jakaa saman palvelimen, joten yhden
   käyttäjän karannut build tai agentti voi viedä muistin muilta. Tämä on
   ihmisten erottamista samalla tavalla kuin tiedosto-oikeudet. Raja
   kuuluu luonnollisesti `user-<uid>.slice`-tasolle asennuksen (Fleetrepon)
   konfiguraatiossa, ja daemon voi lisäksi ajaa Pi:n ja sen lapset omassa
   scopessaan, jotta katkaisu osuu oikeaan prosessiin. Tämä sopii
   periaatteeseen "Unix-käyttäjät ovat turvaraja" **(päättely)**.
4. **Joutilaiden Pi-prosessien lepotila natiivin jatkamisen varaan.** Orca
   pysäyttää valmiin, koskemattoman agentin ja käynnistää sen uudelleen
   `pi --session <tiedosto>` -komennolla, kun käyttäjä palaa
   ([Hibernation][hibernation]). *Miksi:* monen käyttäjän palvelimella
   kymmenet valmiit mutta elävät Pi-prosessit vievät muistia turhaan.
   Jatkaminen perustuu kokonaan Pi:n omaan istuntotiedostoon, eli
   periaatteiden mukaiseen natiiviin totuuteen. Orcan ehtolista (ei kesken
   olevaa workeria, ei näppäilyjä, ei avointa kysymystä) on valmis
   tarkistuslista. Open Habitat erottaa jo nyt agentin pysäytyksen
   arkistoinnista ja jatkaa päättyneitä keskusteluja, joten pohja on olemassa
   **(päättely)**.
5. **Pi:n natiivit promptipohjat ja skillit `/`-valikkona viestikenttään.**
   Orcan mobiilissa on "Quick Commands" ja agenttikohtainen
   slash-luettelo ([Mobile][mobile], [Chat UI][chat]). *Miksi:* puhelimella
   pitkän ohjeen kirjoittaminen on hidasta. Pi:llä on jo omat
   promptipohjansa ja skillinsä käyttäjän kotihakemistossa, joten Open
   Habitat voi listata ne ilman omaa tallennettujen komentojen varastoa.
   Orca rakensi oman synkronoidun listan, ja sitä ei pidä kopioida
   **(päättely)**.
6. **Agentin oma yksirivinen tilaviesti Käynnissä-riville.** Orcan
   "worktree checkpoint" ([Checkpoints][checkpoint]) näyttää, missä
   vaiheessa työ on, ilman että keskustelua tarvitsee avata. *Miksi:*
   Käynnissä-rivi kertoo nyt, *mitä* keskustelu odottaa, mutta ei sitä,
   *missä* työ on. Lähde on valittava natiivista: esimerkiksi Pi:n oma
   tilarivi (jos Pi:n laajennusrajapinta tarjoaa sellaisen) tai
   Open Habitatin jo olemassa oleva tiivistelmä. Orcan tapaa tallentaa
   kommentti omaan worktree-tietueeseensa ei pidä kopioida
   **(päättely; Pi-rajapinnan tuki tarkistamatta)**.
7. **Puhelimen syöttöapu: sanelu ja kuvaliite vastaukseen.** Orca tarjoaa
   mikrofonin ja valokuvan suoraan vastauskenttään ([Mobile][mobile]).
   *Miksi:* puhelinkäyttö on Open Habitatin kantava kulku, ja selaimessa
   molemmat saa alustan omilla ominaisuuksilla (näppäimistön sanelu,
   `<input type="file" accept="image/*">`). Kuvien välitys riippuu siitä,
   mitä Pi:n RPC tukee **(päättely)**.

### Missä Open Habitat on jo parempi

- **Oikea monikäyttäjäisyys.** Orcassa palvelimen jakaminen tarkoittaa
  tunnuksen jakamista. Pariutettu asiakas voi lisätä ja vaihtaa
  agenttitilejä ja hallita isäntää ([`rpc-caller-scope.ts`][scope]). Open
  Habitatissa jokaisella ihmisellä on oma Unix-tunnus, omat tunnistetiedot
  ja oma daemon, ja kolme valtuutta (gateway, daemon, broker) ovat erillään.
- **Selain on ensisijainen ja tunnistettu.** Orcan selainasiakas on beta, joka
  toimii pariutuslinkillä yksityisessä verkossa, eikä sitä saa avata
  internetiin. Open Habitatissa on kirjautuminen GitHubilla, ylläpitäjän
  pääsypäätös ja pitkäikäinen istunto julkisen osoitteen takana.
- **Ei rinnakkaisia varastoja.** Orca pitää oman PTY-daemonin,
  scrollback-tallenteen, chat-journalin ja istuntorekisterin, ja daemonin
  ohjeistus kertoo, kuinka paljon pelkkä socketin omistajuus on maksanut.
  Open Habitat nojaa Pi:n historiaan, tmuxiin ja tiedostojärjestelmään,
  jotka toimivat yhtä lailla SSH:n kautta.
- **Ei kolmatta osapuolta reitillä.** Orcan mobiilin helppo polku kulkee
  Stablyn relayn ja Orca-tilin kautta. Open Habitatin palvelin on
  suoraan oma.
- **Varovaiset oletukset.** Orca käynnistää agentit oletuksena YOLO-tilassa
  kehittäjän omilla tunnuksilla. Open Habitatissa agentin vaikutus rajautuu
  ihmisen omaan Unix-tiliin palvelimella, ei kenenkään kannettavaan.
- **Keskittyminen.** Yksi harness (Pi), suomenkielinen käyttöliittymä ja
  puhelin samana selaintuotteena. Orcan noin 2,6 miljoonan rivin pinta-ala
  on hinta, jota Open Habitatin ei tarvitse maksaa.

### Mitä ei kannata kopioida

- **Oma PTY-daemon ja scrollback-tallenne.** tmux ja Pi:n prosessi tekevät
  saman natiivisti, ja oma toteutus on juuri se "toinen totuus", jota
  periaatteet kieltävät.
- **Oma chat-journal tai istuntorekisteri natiivin historian päälle.**
  Open Habitat esittää Pi:n historian sellaisenaan. Orcan journal on
  olemassa siksi, että se tukee kymmeniä agentteja ACP:n yli. Meillä sitä
  tarvetta ei ole.
- **Sisäänrakennettu orkestrointi- ja automaatiokerros** (Run, Task,
  Dispatch, inbox, decision gate, cron). Open Habitat näyttää natiivit
  workerit. Ajastukseen riittävät systemd-käyttäjätimerit, jos tarve tulee
  joskus vastaan.
- **Pariutuslinkki valtuutena ja "jokainen asiakas on omistaja".** Tämä
  sopii yhden ihmisen tailnetiin, ei palvelimelle, jolla on monta ihmistä.
- **Hostattu relay ja tili.** Toisi Stablyn kaltaisen palveluriippuvuuden
  ja kolmannen osapuolen reitille. Open Habitatin palvelin on jo
  saavutettavissa suoraan.
- **YOLO-oletus ja ajatus "worktree on hiekkalaatikko".** Orcan oma
  dokumentaatio myöntää, ettei worktree ole turvaraja.
- **Agenttien kirjo, upotettu selain, Computer Use, Design Mode, plugin-katalogi.**
  Ne ovat työpöytä-IDE:n ominaisuuksia, ja `docs/product.md` rajaa muut
  harnessit ja laajemmat editorinäkymät erikseen päätettäviksi.

## Lähteet

- Orcan README: <https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/README.md>
- Orcan AGENTS.md: <https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/AGENTS.md>
- Ways to run Orca: <https://www.onorca.dev/docs/ways-to-run>
- Remote Orca Servers: <https://www.onorca.dev/docs/remote-servers>
- Mobile companion: <https://www.onorca.dev/docs/mobile>
- Chat UI: <https://www.onorca.dev/docs/agents/native-chat>
- Agents & sessions: <https://www.onorca.dev/docs/model/agents-sessions>
- Supported agents: <https://www.onorca.dev/docs/agents/supported>
- Agent session history: <https://www.onorca.dev/docs/agents/session-history>
- Session restore: <https://www.onorca.dev/docs/model/session-restore>
- Agent hibernation: <https://www.onorca.dev/docs/agents/hibernation>
- Worktrees: <https://www.onorca.dev/docs/model/worktrees>
- Orchestration: <https://www.onorca.dev/docs/cli/orchestration>
- Scheduled automations: <https://www.onorca.dev/docs/cli/automations>
- Worktree checkpoints: <https://www.onorca.dev/docs/cli/worktree-checkpoints>
- Annotate AI Diff: <https://www.onorca.dev/docs/review/annotate-ai-diff>
- Notifications & Inbox: <https://www.onorca.dev/docs/notifications>
- Agent hooks & memory: <https://www.onorca.dev/docs/agents/hooks-memory>
- Privacy & Telemetry: <https://www.onorca.dev/docs/telemetry>
- SSH worktrees: <https://www.onorca.dev/docs/ssh>
- Terminal: <https://www.onorca.dev/docs/terminal>
- Orca Enterprise: <https://www.onorca.dev/enterprise>
- Y Combinator, Stably AI (Orca): <https://www.ycombinator.com/companies/stably-ai-orca>
- Orca Relay README: <https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/cloud/README.md>
- `rpc-method-permission.ts`: <https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/runtime/rpc/rpc-method-permission.ts>
- `rpc-caller-scope.ts`: <https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/runtime/rpc/rpc-caller-scope.ts>
- `runtime-rpc-pairing-types.ts`: <https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/runtime/runtime-rpc/runtime-rpc-pairing-types.ts>
- `static-web-client-handler.ts`: <https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/runtime/rpc/static-web-client-handler.ts>
- Terminaalidaemonin AGENTS.md: <https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/daemon/AGENTS.md>
- `journal-database-schema.ts`: <https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/native-chat/agent-session-journal/journal-database-schema.ts>
- Pi-tilalaajennus: <https://github.com/stablyai/orca/tree/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/pi>
- Show HN: Open Source 'Conductor + Ghostty' (27.3.2026): <https://news.ycombinator.com/item?id=47549197>
- HN-kommentti 1.10.2026: <https://news.ycombinator.com/item?id=49926533>
- HN-kommentti 4.8.2026: <https://news.ycombinator.com/item?id=49174195>
- HN-kommentti 30.10.2026: <https://news.ycombinator.com/item?id=50303731>
- HN-kommentti 3.10.2026: <https://news.ycombinator.com/item?id=49943943>

[commit]: https://github.com/stablyai/orca/tree/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940
[readme]: https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/README.md
[orca-agents]: https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/AGENTS.md
[ways]: https://www.onorca.dev/docs/ways-to-run
[remote]: https://www.onorca.dev/docs/remote-servers
[mobile]: https://www.onorca.dev/docs/mobile
[chat]: https://www.onorca.dev/docs/agents/native-chat
[sessions]: https://www.onorca.dev/docs/model/agents-sessions
[supported]: https://www.onorca.dev/docs/agents/supported
[history]: https://www.onorca.dev/docs/agents/session-history
[restore]: https://www.onorca.dev/docs/model/session-restore
[hibernation]: https://www.onorca.dev/docs/agents/hibernation
[worktrees]: https://www.onorca.dev/docs/model/worktrees
[orch]: https://www.onorca.dev/docs/cli/orchestration
[auto]: https://www.onorca.dev/docs/cli/automations
[checkpoint]: https://www.onorca.dev/docs/cli/worktree-checkpoints
[annotate]: https://www.onorca.dev/docs/review/annotate-ai-diff
[notif]: https://www.onorca.dev/docs/notifications
[hooks]: https://www.onorca.dev/docs/agents/hooks-memory
[telemetry]: https://www.onorca.dev/docs/telemetry
[ssh]: https://www.onorca.dev/docs/ssh
[terminal]: https://www.onorca.dev/docs/terminal
[ent]: https://www.onorca.dev/enterprise
[yc]: https://www.ycombinator.com/companies/stably-ai-orca
[cloud]: https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/cloud/README.md
[perm]: https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/runtime/rpc/rpc-method-permission.ts
[scope]: https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/runtime/rpc/rpc-caller-scope.ts
[weburl]: https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/runtime/runtime-rpc/runtime-rpc-pairing-types.ts
[static]: https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/runtime/rpc/static-web-client-handler.ts
[daemon-agents]: https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/daemon/AGENTS.md
[journal]: https://github.com/stablyai/orca/blob/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/native-chat/agent-session-journal/journal-database-schema.ts
[pi-ext]: https://github.com/stablyai/orca/tree/b45d71bf8dc5f2623d991bc659c64ef9ce9ec940/src/main/pi
[shn]: https://news.ycombinator.com/item?id=47549197
[hn1]: https://news.ycombinator.com/item?id=49926533
[hn2]: https://news.ycombinator.com/item?id=49174195
[hn3]: https://news.ycombinator.com/item?id=50303731
[hn4]: https://news.ycombinator.com/item?id=49943943
