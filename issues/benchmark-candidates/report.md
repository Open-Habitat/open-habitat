# Seuraavat vertailukohteet HumanLayerin ja Orcan jälkeen

Tutkimusajo `01m68gx1zvpvct9nxjdthp3b4v`, 31.10.2026. Lähteinä ovat ehdokkaiden
viralliset sivut ja dokumentaatio, GitHub-repot (README, dokumentit ja koodihaku
GitHubin API:n kautta), npm:n latausluvut sekä Hacker Newsin keskustelut. Tähdet ja
lataukset on luettu 31.10.2026. Merkintä **Päättely:** erottaa omat johtopäätökseni
siitä, mitä lähteet sanovat. Yleinen verkkohaku ei toiminut tästä ympäristöstä, joten
ehdokkaat on löydetty GitHubin ja HN:n hauilla sekä kahden aiemman raportin
mainitsemista nimistä. Siksi pelkästään suljetut kaupalliset tuotteet, joilla ei ole
GitHub- tai HN-jalanjälkeä, ovat voineet jäädä löytymättä.

## Tiivistelmä

HumanLayer ja Orca osoittivat, että lähimmät kilpailijat ratkaisevat saman
käyttäjäkokemuksen (agentit palvelimella, ohjaus selaimesta ja puhelimesta) joko
pilvessä ja omalla tietovarastolla tai yhden käyttäjän runtimena, jossa jokainen
asiakas on tunnuksen omistaja. Kumpikaan ei kertonut, miten muut ovat ratkaisseet
Open Habitatin kaksi erikoisuutta: **monta ihmistä samalla palvelimella
Unix-tunnuksin erotettuina** ja **Pi:n natiivi istunto ainoana totuutena**. Seuraavien
vertailujen kannattaa siksi kysyä juuri niitä. Tärkein löytö on, että Pi:lle on
syntynyt oma selainkäyttöliittymien ekosysteemi, joka on aiemmin vertailtuja
lähempänä: **PI WEB** (jmfederico) on käytännössä yhden käyttäjän Open Habitat, ja
**Pi Web** (agegr) on niistä suosituin. Ne ovat ainoat ehdokkaat, jotka vastaavat
suoraan siihen, mitä Pi-kohtainen selaintuote voi tehdä natiiveilla
istuntotiedostoilla. Monen käyttäjän kysymyksiin vastaavat agenttituotteiden sijaan
kypsät palvelinsovellukset **JupyterHub** ja **Cockpit**, joilla on yli kymmenen
vuoden kokemus kirjautumisesta, käyttäjäkohtaisista prosesseista ja yhteisen
selainoriginin riskeistä. Kolmas kysymys koskee terminaalissa aloitetun istunnon
ohjaamista selaimesta, ja siihen vastaavat harnessien omat etäkäyttömallit
(Claude Code Remote Control, OpenCode web + attach, Codexin jaettu app-server) sekä
HAPI, joka myös ratkaisee push-ilmoitukset selaimen PWA:ssa.

### Järjestetty lyhytlista

| # | Ehdokas | Kysymys, johon vastaa | Syvyys |
|---|---|---|---|
| 1 | **PI WEB** (jmfederico/pi-web) | Mitä Pi:n natiivi istunto kantaa selaintuotteessa, ja miten istuntodaemon erotetaan verkkopalvelusta | Syvä |
| 2 | **Pi Web** (agegr/pi-web) | Mitä Pi:n ominaisuuksia käyttäjät odottavat selaimelta (haarautus, mallit, vienti), ja miten Web Push tehdään | Keskisyvä, samassa ajossa kuin 1 |
| 3 | **JupyterHub** (+ SystemdSpawner, idle-culler, OAuthenticator) | Mihin monen käyttäjän Unix-tunnuksin erotettu selainpalvelin törmää: oikeudet, resurssit, joutilaat prosessit, yhteinen origin | Syvä |
| 4 | **Cockpit** | Miten verkkopalvelu pidetään erillään käyttäjän istunnosta, kun istunnolla on samat oikeudet kuin SSH:lla | Keskisyvä |
| 5 | **HAPI** (tiann/hapi) | Push-ilmoitukset PWA:lle, istunnon siirto terminaalin ja selaimen välillä, ja mitä oma SQLite-varasto maksaa | Keskisyvä |
| 6 | **Harnessien omat etäkäyttömallit**: Claude Code Remote Control, OpenCode web/attach, Codexin jaettu app-server | Miten sama elävä istunto saadaan sekä terminaaliin että selaimeen, ja mitä Pi:ltä kannattaa pyytää | Kevyt–keskisyvä |
| 7 | **Coder** (Coder Agents, aiemmin Tasks/AgentAPI) | Miksi monen käyttäjän yritysalusta luopui natiivien CLI-agenttien käärimisestä | Kevyt |
| 8 | **herdr** | Mihin SSH- ja tmux-polku on menossa, ja miten agentin tila päätellään terminaalista | Kevyt |

## Mitä aiemmat raportit jättivät auki

Molemmat raportit päätyivät samaan: Open Habitatin erot (Unix-tunnus rajana, natiivi
historia ainoana historiana, selain ensisijaisena) ovat vahvuuksia. Opittavaa oli
ihmisen silmukassa (rivikommentit erässä agentille, kumulatiivinen diffi,
push-ilmoitus, lepotila, muistirajat). Näistä seuraa viisi kysymystä, joihin
HumanLayer ja Orca eivät vastanneet ja joiden mukaan ehdokkaat on valittu:

1. **Pi-kohtainen selaintuote.** Kumpikin vertailtu tuki Pi:tä sivutuotteena
   (HumanLayerilla alfa-asteen peilaus, Orcalla terminaali ja tilalaajennus). Miltä
   näyttää tuote, joka on rakennettu nimenomaan Pi:n istuntotiedostojen ja SDK:n
   varaan?
2. **Monen ihmisen palvelin.** Kumpikaan ei erota ihmisiä käyttöjärjestelmän
   tasolla. Kuka sen tekee, ja mitä siitä on opittu?
3. **Terminaalin ja selaimen yhteinen elävä istunto.** Open Habitatissa
   terminaalissa aloitettu keskustelu on selaimessa vain luettava, ja eri
   kirjoittajien ehdotonta poissulkemista ei luvata (`docs/product.md`). Miten muut
   ratkaisevat tämän?
4. **Ilmoitukset ilman natiivisovellusta.** Orcan suositus 2 (push, kun keskustelu
   siirtyy Sinun vuorosi -listaan) vaatii toteutuksen, joka sopii gatewayn ja
   daemonin väliin. Kuka tekee Web Pushin selaimen PWA:lle?
5. **Joutilaat prosessit ja resurssit jaetulla palvelimella.** Orcan suositukset 3
   ja 4 (muistirajat, lepotila). Kuka on hoitanut nämä monen käyttäjän palvelimella
   pitkään?

## Lyhytlista tarkemmin

### 1. PI WEB (jmfederico/pi-web): syvä vertailu

**Mikä se on.** MIT-lisensoitu selainkäyttöliittymä Pi:lle, joka "keeps agent
sessions running in real workspaces on your machine or server"
([README](https://github.com/jmfederico/pi-web)). Se asennetaan käyttäjän omaksi
palveluksi (`pi-web install` käyttää käyttäjäkohtaista palvelunhallintaa, kuten
systemd:n käyttäjäpalveluja) ([FAQ](https://pi-web.dev/faq)). Malli on Machine →
Project → Workspace (esim. git worktree) → Session. Sivusto perustelee tuotteen
samalla ajatuksella kuin Open Habitat: "Your laptop is a window, not the
workstation" ja "A browser disconnect should not stop an agent". Istunnon runtime on
erotettu verkko- ja API-palvelusta, joten selaimen ja verkkopalvelun
uudelleenkäynnistys ei katkaise työtä, mutta hostin tai istuntodaemonin katkos
katkaisee ([Remote-first](https://pi-web.dev/remote-first)). Koodissa on erillinen
`sessiond`, ja istunnot luodaan Pi:n SDK:lla (`createAgentSession`,
`piSessionManagerGateway.ts`), eli istunnot ovat Pi:n omia (GitHubin koodihaku
31.10.). "Fleet" tekee avatusta instanssista yhdyskäytävän muihin PI WEB
-runtimeihin, ja jokainen kone pitää omat tunnuksensa, istuntonsa ja
laajennuksensa ([Fleet](https://pi-web.dev/machines)). Lukuja: 916 tähteä, noin
10 200 npm-latausta 30.9.–29.10., versio 1.202610.9.

**Miksi juuri Open Habitatille.** Tämä on lähin olemassa oleva tuote: Pi,
palvelimella pysyvät istunnot, selain ikkunana, worktreet ja natiivi
istuntomuoto. Ero on se, että tuote rajaa monikäyttäjäisyyden suoraan pois:
"PI WEB assumes trusted users, repositories, paths, and plugins. It is not a sandbox
or a multi-tenant platform", eikä sitä saa avata julkiseen internetiin
([README](https://github.com/jmfederico/pi-web)). Vertailu vastaisi kysymyksiin:

- Mitä Pi-kohtainen selaintuote tarjoaa, mitä Open Habitatissa ei ole
  (tiedostot, terminaali, laajennukset, monen koneen yhdyskäytävä)?
- Miten se hoitaa saman istunnon kirjoittajan selaimen ja terminaalin välillä?
  Lukitseeko se, ja mitä se lupaa?
- SDK-pohjainen istunto samassa daemonissa vai Pi erillisenä prosessina: kumpi
  kestää paremmin päivitykset ja kaatumiset? **Päättely:** Open Habitatin
  daemon ajaa Pi:tä omana prosessinaan. PI WEB:n `sessiond` on hyvä vastinpari
  tämän valinnan punnitsemiseen.
- "Fleet" vastaa suoraan `docs/product.md`:n rajaukseen "usean palvelimen
  navigointi". Vertailu näyttäisi, miltä se näyttää natiivisti toteutettuna.

**Syvyys.** Syvä, samaa rakennetta noudattaen kuin HumanLayer- ja Orca-raportit,
lähdekoodi mukaan lukien. Kannattaa tehdä samassa ajossa kohdan 2 kanssa.

### 2. Pi Web (agegr/pi-web): keskisyvä, samassa ajossa kuin 1

**Mikä se on.** Suosituin Pi:n selainkäyttöliittymä: 7 939 tähteä ja noin 23 400
npm-latausta kuukaudessa, MIT, luotu maaliskuussa 2026. "Pi Web uses the same local
configuration and session files as pi, so you can browse and resume conversations,
run agent turns, configure models and resources, and inspect project files from a
browser." Ominaisuuksina ovat istuntojen selaus, jatkaminen, nimeäminen, vienti ja
poisto projekteittain, kahdenlainen haarautus ("New session" aiemmasta viestistä ja
"Edit from here" saman istunnon sisällä), Git-diffit, worktreen vaihto,
mallien ja kirjautumisten hallinta sekä taidot ja laajennukset. Oletuksena se
kuuntelee vain osoitetta `127.0.0.1`. Etäkäytössä on yksi salasana
(`PI_WEB_PASSWORD`), ja istunto suljetaan oletuksena 10 minuutin joutilaisuuden
jälkeen (`PI_WEB_IDLE_TIMEOUT_MS`) ([README](https://github.com/agegr/pi-web)).
Koodissa on Web Push -tilaus (`lib/push-client.ts`), joka "silently no-ops on
unsupported browsers (e.g. iOS Safari < 16.4 or non-PWA contexts) so the existing
in-page notification path keeps working as a fallback". Pi ajetaan SDK:lla
palvelinprosessissa (`lib/rpc-manager.ts`: `createAgentSession`).

**Miksi juuri Open Habitatille.** Suosio kertoo, mitä Pi:n käyttäjät
odottavat selaimelta. Pi:n natiiveja ominaisuuksia, joita Open Habitat ei vielä
näytä (haarautus, vienti, mallin vaihto, kontekstin käyttö ja kustannus,
kompaktoinnin tiedot), voi verrata suoraan, koska kummankin lähde on sama
istuntotiedosto. Web Push -toteutus on valmis esimerkki Orcan suosituksen 2
selainversiosta. **Päättely:** 10 minuutin joutilaisuusraja on yhden käyttäjän
koneen ratkaisu muistiin. Se on vertailukohta Orcan lepotilalle ja Open Habitatin
omalle valinnalle.

**Syvyys.** Keskisyvä: ominaisuustaulukko Pi:n natiiveista ominaisuuksista ja
Web Pushin toteutus koodista. Kevyesti samaan ajoon kannattaa ottaa
**Pithagoras** (thecodacus/pithagoras, 297 tähteä), joka ajaa Pi:tä Dockerissa ja
tallentaa jokaisen Pi:n tapahtuman omaan lokiinsa, jotta uudelleenyhdistäminen
toistaa väliin jääneen ("Every event pi emits is appended to a log")
([README](https://github.com/thecodacus/pithagoras)). Se on hyvä vastaesimerkki
siitä, mitä Open Habitat ei rakenna, ja siitä, mitä se kustantaa.

### 3. JupyterHub (+ SystemdSpawner, idle-culler, OAuthenticator): syvä

**Mikä se on.** "Multi-user server for Jupyter notebooks", BSD-3, vuodesta 2014
(8 360 tähteä). Hub tunnistaa käyttäjän (PAM, OAuth, esim. GitHub OAuthenticatorin
kautta), käynnistää hänelle oman palvelinprosessin spawnerilla ja reitittää
selaimen sille proxyn kautta ([Concepts](https://jupyterhub.readthedocs.io/en/stable/explanation/concepts.html)).
SystemdSpawner ajaa jokaisen käyttäjän palvelimen systemd-yksikkönä, jolla on
`mem_limit`, `cpu_limit`, `isolate_tmp` ja `isolate_devices`. Se vaatii, että hub
ajetaan rootina, koska "unrestricted access to `systemd-run` is equivalent to root"
([SystemdSpawner](https://github.com/jupyterhub/systemdspawner)).
Joutilaat palvelimet sammutetaan erillisellä palvelulla
([jupyterhub-idle-culler](https://github.com/jupyterhub/jupyterhub-idle-culler)).

**Miksi juuri Open Habitatille.** Tämä on kypsin olemassa oleva toteutus Open
Habitatin perusmallista: selainkirjautuminen, käyttäjälle oma Unix-tunnus ja
oma prosessi, ylläpitäjä päättää pääsystä. Sen dokumentaatio kertoo suoraan
riskin, joka koskee myös Open Habitatia: hub ja käyttäjien palvelimet ovat samassa
domainissa, jolloin "many of the web's cross-site protections are not applied
between single-user servers and the Hub, or between single-user servers and each
other", ja siksi käyttäjä "must never be able to write arbitrary HTML and serve it
to another user on the Hub's domain"
([Security overview](https://jupyterhub.readthedocs.io/en/stable/explanation/websecurity.html)).
Projekti kuvaa itsensä sopivaksi "semi-trusted"-käyttäjille. Vertailu vastaisi:

- Mitä hyökkäyspolkuja yhteinen origin avaa käyttäjien välille, ja kattaako Open
  Habitatin "sisällön HTML ei suoritu" (`docs/product.md`) ne kaikki?
  **Päättely:** tämä on vertailun arvokkain yksittäinen tulos, koska se koskee
  tuotteen turvarajaa.
- Miten muistirajat ja joutilaiden prosessien sammutus hoidetaan monen käyttäjän
  palvelimella (Orcan suositukset 3 ja 4)? JupyterHub on ajanut näitä vuosia
  tuotannossa.
- Missä valtuus on: JupyterHubissa hub (root) käynnistää käyttäjien prosessit,
  Open Habitatissa broker vain luo tilin. Mitä JupyterHub on joutunut tekemään
  rootina, ja mitä siitä seuraa Open Habitatin kolmen valtuuden jaolle?

**Syvyys.** Syvä mutta rajattu: tietoturvamalli, spawnerin valtuudet,
resurssirajat ja joutilaiden sammutus. Notebook-ominaisuudet jätetään pois.

### 4. Cockpit: keskisyvä

**Mikä se on.** Red Hatin ylläpitämä selainkäyttöliittymä Linux-palvelimille
(15 305 tähteä, vuodesta 2013, LGPL). Kirjautuminen kulkee Cockpitin oman PAM-pinon
kautta. `cockpit-ws` ottaa tunnukset vastaan ja käynnistää `cockpit-session`-
apuohjelman, joka avaa käyttäjälle PAM-istunnon ja käynnistää sen sisällä
`cockpit-bridge`-prosessin. Selain puhuu bridgelle WebSocketin yli
([authentication.md](https://github.com/cockpit-project/cockpit/blob/main/doc/authentication.md)).
Ohje sanoo: "When a user is logged into Cockpit, they are logged into a normal
session that has exactly the same privileges as if they logged in via SSH or on
the console"
([Privileges](https://github.com/cockpit-project/cockpit/blob/main/doc/modules/guide/pages/privileges.adoc)).

**Miksi juuri Open Habitatille.** Arkkitehtuuri on lähes sama kuin gatewayn,
brokerin ja käyttäjädaemonin jako: verkkopalvelu ei itse toimi käyttäjänä, vaan
käyttäjän oma prosessi tekee työn tämän tavallisin oikeuksin, samoin kuin SSH:ssa.
Vertailu vastaisi siihen, miten Cockpit varmistaa, ettei `cockpit-ws` voi esiintyä
toisena käyttäjänä, miten se eristää verkkopalvelun prosessit eri käyttäjien
välillä ja miten se korottaa oikeuksia hallitusti (sudo, polkit, "Administrative
access" -kytkin). **Päättely:** Open Habitatissa vastaava kysymys on, kuka saa
puhua käyttäjäkohtaiselle socketille ja millä todisteella. Cockpitin ratkaisu on
kymmenen vuoden ajan auditoitu vastinpari.

**Syvyys.** Keskisyvä ja arkkitehtuuriin keskittyvä: prosessimalli,
`cockpit-ws`:n eristys ja uhkamalli. Käyttöliittymää ei tarvitse vertailla.

### 5. HAPI (tiann/hapi): keskisyvä

**Mikä se on.** AGPL-3.0-lisensoitu "local-first alternative to Happy" (5 339
tähteä, noin 3 000 npm-latausta kuukaudessa). Se ajaa virallisia agentteja, Pi
mukaan lukien, ja tarjoaa niiden ohjauksen selaimen PWA:ssa, Telegramin Mini
Appissa ja maksullisissa natiivisovelluksissa ([README](https://github.com/tiann/hapi)).
Rakenne: CLI käärii agentin, ja yksi hub (yksi binääri ja SQLite) välittää viestit
ja hyväksynnät selaimelle REST:n ja SSE:n kautta
([How it works](https://github.com/tiann/hapi/blob/main/docs/guide/how-it-works.md)).
Hub tarjoaa Web Pushin VAPID-avaimilla (`/api/push/vapid-public-key`,
`/api/push/subscribe`) ja tallentaa viestit omaan tietokantaansa
([hub README](https://github.com/tiann/hapi/blob/main/hub/README.md)). Codexilla
terminaali ja selain jakavat saman app-serverin: "No local/remote ownership switch.
Both can send messages, approve tools and answer `request_user_input`"
([Codex shared sessions](https://github.com/tiann/hapi/blob/main/docs/guide/codex-shared-sessions.md)).
HAPI vertaa itseään Happyyn: Happy on keskitetty ja "Multi-user on shared server",
HAPI on "each user runs own hub" ([Why HAPI](https://github.com/tiann/hapi/blob/main/docs/guide/why-hapi.md)).

**Miksi juuri Open Habitatille.** Kolme asiaa. (1) Push-ilmoitukset selaimen PWA:lle
itse ajetulta palvelimelta ilman kolmatta osapuolta. Tämä on toteutettu muoto
Orcan suositukselle, joka on `docs/product.md`:ssä rajattu toistaiseksi ulos ja
odottaa Jarin päätöstä. (2) Miten istunnon omistajuus terminaalin ja selaimen
välillä on ratkaistu: kuka omistaa elinkaaren ja mitä tapahtuu, kun terminaali
suljetaan. (3) Miten paljon oma SQLite-viestivarasto (katkaisu, pakkaus,
ylläpitoskriptit) maksaa. Se on hyvä vastaesimerkki Open Habitatin natiivihistorialle.

**Syvyys.** Keskisyvä: push-putki, omistajuusmalli ja Pi-tuen laajuus. Happyä ei
tarvitse vertailla erikseen (ks. pudotetut).

### 6. Harnessien omat etäkäyttömallit: kevyt–keskisyvä

**Mitä ne ovat.**

- **Claude Code Remote Control**: paikallinen `claude`-prosessi yhdistetään
  claude.ai/code-sivuun tai Clauden mobiilisovellukseen. "The conversation …
  stay[s] in sync across all connected devices, so you can send messages from your
  terminal, browser, and phone interchangeably", ja kone ja prosessi on pidettävä
  käynnissä ([Remote Control](https://code.claude.com/docs/en/remote-control)).
  Toiminto vaatii claude.ai-tilauksen, eikä se toimi API-avaimilla. HN:ssä
  julkistus keräsi 544 pistettä, ja osa kommenteista pitää sitä tmuxin ja moshin
  uudelleenkeksimisenä ("We've re-invented GNU screen in the most inefficient way
  imaginable") ([HN](https://news.ycombinator.com/item?id=47148454)).
- **OpenCode web ja attach**: OpenCoden TUI on aina asiakas omalle palvelimelleen.
  `opencode web` avaa selainkäyttöliittymän, ja `opencode attach <url>` liittää
  terminaalin samaan palvelimeen, "sharing the same sessions and state"
  ([Web](https://opencode.ai/docs/web/), [Server](https://opencode.ai/docs/server/)).
- **Codexin jaettu app-server** (0.154.0 alkaen), kuvattu HAPIn dokumentissa
  (kohta 5).

**Miksi juuri Open Habitatille.** Nämä kertovat, miten harnessin tekijät itse
ratkaisevat kysymyksen 3: yksi istunto, monta asiakasta. Open Habitat ei voi
rakentaa tätä Pi:n ohi rikkomatta natiivin totuuden periaatetta, joten oikea tie on
natiivi tuki. Pi:ssä on jo kokeellinen `@earendil-works/pi-durable`, jonka
`watch()` antaa käyttöliittymälle keskustelun tilan ja jokaisen commitin ("Everything
a UI needs is committed state") ([pi-durable README](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md)).
**Päättely:** vertailun tulos olisi lyhyt muistio. Se kertoisi, mitä mallia (palvelin
ja liitettävät asiakkaat, jaettu app-server, relay) Open Habitat toivoisi Pi:ltä ja
onko pi-durable menossa siihen suuntaan.

**Syvyys.** Kevyt tai keskisyvä, ja dokumentaation varassa. Tuotevertailua ei
tarvita.

### 7. Coder (Coder Agents, aiemmin Tasks ja AgentAPI): kevyt

**Mikä se on.** Coder on AGPL-lisensoitu yritysalusta (17 238 tähteä), jossa
jokaisella kehittäjällä on oma Terraformilla määritelty työtila. Sen
agenttistrategia on vaihtunut. Aiemmin AgentAPI käärii natiiveja CLI-agentteja
(Claude Code, Codex, Aider …) HTTP-rajapinnaksi. Nyt repo on arkistoitu, ja README
sanoo: "AgentAPI is deprecated and no longer maintained. We recommend using Coder
Agents for Coder's own agent harness" ([AgentAPI](https://github.com/coder/agentapi)).
Coder Agentsissa agenttisilmukka ajetaan ohjaustasolla: kehote tallennetaan
tietokantaan, ohjaustason worker ajaa vuoron ja kutsuu työtilaa samaa reittiä kuin
IDE ja SSH. Viestijono ja kompaktointi ovat tietokannassa, ja API-avaimia ei
ole työtiloissa ([Coder Agents: Architecture](https://coder.com/docs/ai-coder/agents/architecture)).

**Miksi juuri Open Habitatille.** Tämä on vahvin vastakkainen todiste Open
Habitatin "käytä natiivia agenttia" -periaatteelle: monen käyttäjän alusta, joka
kokeili natiivien CLI-agenttien käärimistä ja luopui siitä. Kevyt vertailu
kertoisi miksi (terminaalin raapimisen hauraus, avainten hallinta, keskitetty
valvonta) ja koskeeko syy Open Habitatia, joka käyttää Pi:n RPC:tä terminaalin
raapimisen sijaan. **Päättely:** todennäköisesti syy on yrityksen hallinta
("Centralized enforcement", "No API keys in workspaces") eikä tekninen pakko, mutta
se on tarkistettava.

**Syvyys.** Kevyt: yksi dokumenttipohjainen muistio.

### 8. herdr: kevyt

**Mikä se on.** Apache-2.0-lisensoitu Rust-binääri, "the runtime your coding
agents live on" (46 993 tähteä seitsemässä kuukaudessa, YC F26). Se pitää agenttien
terminaalit taustapalvelimessa, merkitsee jokaisen ruudun tilaksi working, blocked
tai idle, ja agentit voivat ohjata sitä socket-rajapinnan kautta
([README](https://github.com/herdrdev/herdr),
[YC-blogi](https://herdr.dev/blog/herdr-is-joining-y-combinator/)). Sen ympärille
on syntynyt yli 500 laajennusta, esimerkiksi `herdr-reviewr`, joka lähettää
diff-kommentit Claude Codelle, Codexille, OpenCodelle tai Pi:lle (GitHub-haku
31.10.). Julkistukset ovat keränneet HN:ssä 404 ja 351 pistettä.

**Miksi juuri Open Habitatille.** Open Habitat lupaa, että SSH- ja tmux-käyttö
säilyvät selaimen rinnalla. herdr on se, mihin moni tmux-käyttäjä on nyt
siirtymässä agenttityössä. Kevyt vertailu kertoisi, pitääkö herdrin kautta
käynnistettyjen Pi-istuntojen näkyä Open Habitatissa yhtä hyvin kuin tmuxin, ja
miten herdrin tilan päättely vertautuu Open Habitatin hostin tietoon perustuvaan
tilaan.

**Syvyys.** Kevyt.

## Harkitut ja pudotetut

| Ehdokas | Miksi pudotettu |
|---|---|
| **Conductor** (conductor.build) | Muuttunut pilvituotteeksi: "A cloud sandbox for every agent … on isolated microVMs" ja "Conductor is now multiplayer" ([conductor.build](https://www.conductor.build/)). Sama malli kuin HumanLayerissa, joten uutta ei tule. |
| **Paseo** (getpaseo/paseo, 22 567 ★) | Daemon ja työpöytä-, mobiili-, verkko- ja CLI-asiakkaat sekä Pi-tuki ([README](https://github.com/getpaseo/paseo)). Rakenne on Orcan kaltainen yhden käyttäjän runtime, ja Orca-raportti kattaa sen. Yksi mielenkiintoinen yksityiskohta: laajennukset ajetaan daemonissa ja näkyvät kaikissa asiakkaissa. |
| **Happy** (slopus/happy, 24 430 ★) | Keskitetty relay ja salattu tallennus, ja "Natively multiplayer … either of you can steer it" ([README](https://github.com/slopus/happy)). Toisen ihmisen ohjaus omassa istunnossa on sama malli, jonka HumanLayer-raportti torjui. HAPI (kohta 5) kattaa hyödylliset osat ja vertaa itseään Happyyn. |
| **CloudCLI / Claude Code UI** (siteboon/claudecodeui, 14 358 ★) | Selain- ja mobiilikäyttöliittymä Claude Codelle, Codexille ja Cursor CLI:lle, joka lukee olemassa olevat istunnot ([README](https://github.com/siteboon/claudecodeui)). Ei Pi-tukea, ja maksullinen CloudCLI Cloud on suositeltu polku. Pi Web (kohta 2) vastaa samaan kysymykseen Pi:n osalta. |
| **Vibe Kanban** (BloopAI) | README: "Vibe Kanban is sunsetting" ([README](https://github.com/BloopAI/vibe-kanban)). Diffin rivikommentit agentille on jo opittu Orcasta ja HumanLayerista. |
| **Omnara** | Suuntautunut uudelleen "managed agent platform" -tuotteeksi, "A self-hostable alternative to Claude Managed Agents" ([GitHub](https://github.com/omnara-ai/omnara)). Oma agenttiajo, ei natiivien istuntojen ohjain. |
| **cmux, Offrun, Crystal/Nimbalyst, Sculptor** | macOS- tai työpöytäsovelluksia yhdelle kehittäjälle. Rinnakkaiset worktree-agentit on käsitelty Orca-raportissa. Offrun on "for Mac" ([offrun.dev](https://offrun.dev/)), ja cmux on "macOS terminal" ([GitHub](https://github.com/manaflow-ai/cmux)). |
| **code-server** | VS Code selaimessa yhdelle käyttäjälle. Ei agenttimallia, ja `docs/product.md` rajaa laajemmat editorinäkymät pois. |
| **CongaLine, DAAO** | Liian pieniä (17 ja 2 tähteä) ja suunnattu OpenClaw-agenttilaivastoihin tai etäkoneiden ohjaukseen. |
| **pi-durable** | Ei tuote vaan Pi:n kokeellinen kirjasto. Se kuuluu kohdan 6 muistioon seurattavana natiivina komponenttina, ei omaksi vertailukseen. |

## Suositus järjestykseksi

1. **Yksi ajo kohdille 1 ja 2 (Pi:n selainkäyttöliittymät).** Vertailukohteet ovat
   lähimmät ja tuoreimmat, ja tuloksista syntyy suoraan työtä: puuttuvat Pi:n
   natiiviominaisuudet ja Web Pushin toteutusmalli.
2. **JupyterHub** (kohta 3). Se on ainoa, joka voi paljastaa puutteen turvarajassa
   (yhteinen origin, spawnerin valtuudet), joten se kannattaa tehdä ennen kuin
   palvelimelle tulee lisää ihmisiä.
3. **Cockpit ja HAPI** rinnakkain (kohdat 4 ja 5).
4. **Kevyet muistiot** (kohdat 6–8) voi tehdä yhdellä ajolla.

Push-ilmoituksista (kohdat 2 ja 5) ei kannata tehdä toteutusissueta ennen kuin
Jari on päättänyt, avataanko `docs/product.md`:n rajaus "selain- ja
käyttöjärjestelmäilmoitukset". Vertailut antavat päätökselle pohjan.

## Lähteet

- PI WEB, README: <https://github.com/jmfederico/pi-web>
- PI WEB, Remote-first: <https://pi-web.dev/remote-first>
- PI WEB, Fleet: <https://pi-web.dev/machines>
- PI WEB, FAQ: <https://pi-web.dev/faq>
- PI WEB, npm: <https://www.npmjs.com/package/@jmfederico/pi-web>
- Pi Web (agegr), README: <https://github.com/agegr/pi-web>
- Pi Web (agegr), Web Push -asiakas: <https://github.com/agegr/pi-web/blob/main/lib/push-client.ts>
- Pi Web (agegr), npm: <https://www.npmjs.com/package/@agegr/pi-web>
- Pithagoras, README: <https://github.com/thecodacus/pithagoras>
- Pi, repo: <https://github.com/earendil-works/pi>
- pi-durable, README: <https://github.com/earendil-works/pi/blob/main/packages/durable/README.md>
- JupyterHub: <https://github.com/jupyterhub/jupyterhub>
- JupyterHub, Concepts: <https://jupyterhub.readthedocs.io/en/stable/explanation/concepts.html>
- JupyterHub, Security overview: <https://jupyterhub.readthedocs.io/en/stable/explanation/websecurity.html>
- SystemdSpawner: <https://github.com/jupyterhub/systemdspawner>
- jupyterhub-idle-culler: <https://github.com/jupyterhub/jupyterhub-idle-culler>
- OAuthenticator: <https://github.com/jupyterhub/oauthenticator>
- Cockpit: <https://github.com/cockpit-project/cockpit>
- Cockpit, authentication.md: <https://github.com/cockpit-project/cockpit/blob/main/doc/authentication.md>
- Cockpit, Privileges: <https://github.com/cockpit-project/cockpit/blob/main/doc/modules/guide/pages/privileges.adoc>
- HAPI, README: <https://github.com/tiann/hapi>
- HAPI, How it works: <https://github.com/tiann/hapi/blob/main/docs/guide/how-it-works.md>
- HAPI, Why HAPI: <https://github.com/tiann/hapi/blob/main/docs/guide/why-hapi.md>
- HAPI, Codex shared sessions: <https://github.com/tiann/hapi/blob/main/docs/guide/codex-shared-sessions.md>
- HAPI, hub README: <https://github.com/tiann/hapi/blob/main/hub/README.md>
- Happy, README: <https://github.com/slopus/happy>
- Claude Code Remote Control: <https://code.claude.com/docs/en/remote-control>
- HN, Claude Code Remote Control (25.2.2026): <https://news.ycombinator.com/item?id=47148454>
- OpenCode, Web: <https://opencode.ai/docs/web/>
- OpenCode, Server: <https://opencode.ai/docs/server/>
- Coder: <https://github.com/coder/coder>
- Coder Agents, Architecture: <https://coder.com/docs/ai-coder/agents/architecture>
- AgentAPI (arkistoitu): <https://github.com/coder/agentapi>
- herdr, README: <https://github.com/herdrdev/herdr>
- herdr, YC-blogi: <https://herdr.dev/blog/herdr-is-joining-y-combinator/>
- HN, Herdr (2.7.2026): <https://news.ycombinator.com/item?id=48756578>
- HN, Herdr native app (30.10.2026): <https://news.ycombinator.com/item?id=50298436>
- Paseo, README: <https://github.com/getpaseo/paseo>
- CloudCLI, README: <https://github.com/siteboon/claudecodeui>
- Vibe Kanban, README: <https://github.com/BloopAI/vibe-kanban>
- Omnara: <https://github.com/omnara-ai/omnara>
- Conductor: <https://www.conductor.build/>
- Offrun: <https://offrun.dev/>
- cmux: <https://github.com/manaflow-ai/cmux>
