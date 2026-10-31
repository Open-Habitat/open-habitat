# Vertailu: Coder (Coder Agents, aiemmin Tasks ja AgentAPI)

Tutkimusajo `01m68hqzqa508xd8tdv4r3hjpk`, 31.10.2026. Syvyys on kevyt:
kysymys on, miksi monen käyttäjän yritysalusta luopui natiivien
CLI-agenttien käärimisestä, ja koskeeko syy Open Habitatia. Lähteinä ovat
Coderin repo ja sen dokumentaatio, joka on samassa repossa (`docs/`, luettu
commitista [`a2e2a917`][commit], 30.10.2026), vanhat Tasks-sivut tagista
`v2.33.0`, AgentAPI:n repo ja issuet, registry-repon PR #861, Coderin
blogi sekä GitHub API ja HN Algolia. Merkintä **(lähde)** tarkoittaa, että
asia lukee lähteessä tai koodissa. **(päättely)** on oma tulkintani.

## Tiivistelmä

Coder on AGPL-lisensoitu, itse ylläpidettävä alusta, jossa jokainen
kehittäjä saa Terraformilla määritellyn työtilan, yleensä kontin tai
virtuaalikoneen. Vuosina 2025–2026 Coder ajoi natiiveja CLI-agentteja
(Claude Code, Codex, Aider …) työtilan sisällä AgentAPI:n kautta. AgentAPI
on terminaaliemulaattori, joka syöttää näppäilyjä agentin TUI:hin ja
raapii vastaukset ruudulta. Tämä tuote, Coder Tasks, poistettiin vuoden
2026 aikana, ja AgentAPI arkistoitiin syyskuussa. Tilalle tuli
**Coder Agents**: Coderin oma Go-kielinen agenttisilmukka, joka ajetaan
ohjaustasolla. Keskustelut ovat Postgresissa, LLM-avaimet ohjaustasolla,
ja työtila on pelkkä laskentaympäristö, jota agentti käyttää samaa
tunnelia pitkin kuin IDE. Coder kertoo syyt itse: AgentAPI ei noussut
standardiksi, ja CLI-agenttien kääriminen hankaloitti niiden kokemuksen
toistamista verkkosovelluksessa. Toinen syy on yrityshallinta: ei avaimia
työtiloissa, tiukat verkkorajat, keskitetty valvonta ja auditointi.
AgentAPI:n issuet näyttävät hinnan arjessa: Claude Coden päivitys rikkoi
ruudunkaappauksen yön aikana, ja yksi Unicode-merkki kirjautumisruudussa
jumitti viestien lähetyksen. **Johtopäätös Open Habitatille:** tekninen syy
ei koske meitä, koska daemon puhuu Pi:lle sen rakenteisella RPC:llä eikä
raavi terminaalia. Yrityshallinnan syy taas palvelee päinvastaista
tavoitetta kuin meidän: Coder suojaa organisaation avaimia kehittäjältä,
Open Habitat suojaa ihmisiä toisiltaan. Natiiveista agenteista Coder ei
myöskään luopunut kokonaan. Ne palaavat lokakuussa 2026 kokeellisina
ACP-aliagentteina, siis rakenteisen protokollan kautta. Opittavaa on
lähinnä kestävyydessä: agentin työ voisi selvitä myös daemonin
uudelleenkäynnistyksestä. Lisäksi daemonin rajapinta kelpaisi
automaatioiden käyttöön, ja keskeytys sekä jonon muokkaus voisivat näkyä
omina tiloinaan.

## 1. Mikä Coder on ja kenelle

Coder kuvaa Coder Agentsin chat-käyttöliittymäksi ja rajapinnaksi, jolla
kehitystyötä delegoidaan agenteille Coder-asennuksessa. Agentti valitsee
pohjan (templaten), luo työtilan ja tekee työn ([Coder Agents][agents])
**(lähde)**. Kohderyhmiksi nimetään säännellyt alat (rahoitus, terveys,
julkishallinto), alustatiimit, jotka eivät halua hallita
"per-workspace agent installations, API key distribution, or third-party
agent licensing", sekä organisaatiot, joilla Coder on jo käytössä
([Coder Agents][agents]) **(lähde)**. Ostaja on alustatiimi tai
tietoturva, ei yksittäinen kehittäjä **(päättely)**.

Coder tarjoaa nyt neljä tapaa ajaa agentteja ([AI coder index][aiindex])
**(lähde)**:

1. **Coder Agents**: oma agentti, silmukka ohjaustasolla.
2. **Agent Relay**: pilvessä toimivan agentin (Cursor Cloud Agents, Claude
   Code) työkalukutsut ajetaan Coder-työtilassa. Early access.
3. **Agentit IDE:ssä**: editorin oma agentti työtilassa.
4. **Agentit työtilapohjissa**: Claude Code tai Codex asennetaan
   registry-moduulilla, ja kehittäjä käyttää sitä itse terminaalissa.

## 2. Mitä tapahtui: AgentAPI ja Tasks

### AgentAPI: terminaalin raapija

AgentAPI (huhtikuu 2025, MIT, 1 495 tähteä) muutti Claude Coden, Codexin,
Aiderin, Goosen ja muiden TUI:n HTTP-rajapinnaksi. README:n mukaan se
"runs an in-memory terminal emulator", muuntaa API-kutsut näppäilyiksi ja
jäsentää vastaukset ruudulta. Viestit erotellaan ottamalla ruudusta kuva
ennen näppäilyjä ja pitämällä uutta tekstiä agentin vastauksena. Kaiutettu
syöte ja syöttölaatikko poistetaan etsimällä rivejä, joissa on merkkejä
kuten `>` tai `------` ([AgentAPI README][agentapi]) **(lähde)**. README
ennusti itse, mitä TUI:n muutos tekee: "some extra TUI elements may become
visible". Pitkän aikavälin visiossa se toivoi agenteille oikeita SDK:ita
ja lupasi silloin luopua itsestään ([AgentAPI README][agentapi])
**(lähde)**.

Issuet näyttävät, mitä raapiminen maksoi:

- Coderin oma insinööri, elokuu 2025: "spawning a virtual terminal,
  sending keystrokes over a PTY, and scraping the output … occasionally
  can result in rendering issues or garbled output". Ehdotus oli siirtyä
  Claude Code SDK:hon ([#48][aa48]) **(lähde)**.
- Maaliskuu 2026: "Claude Code 2.1.83 breaks terminal capture". Käyttäjät
  kiinnittivät Claude Coden vanhaan versioon ja kytkivät sen
  automaattipäivityksen pois ([#207][aa207]) **(lähde)**.
- "failed to wait for screen to stabilize". Coderin analyysin mukaan
  Claude Coden v2.1.87 vaihtoi kirjautumisruudun viivamerkin `─` merkiksi
  `╌`, jolloin viestilaatikon tunnistus epäonnistui ja lähetys jäi
  odottamaan ikuisesti ([#123][aa123]) **(lähde)**.
- Muita: vastauksen ensimmäinen rivi katkeaa ([#126][aa126]), vanha ja uusi
  viesti samalla tunnisteella ([#205][aa205]), Tasks-näkymä leikkaa
  AgentAPI:n ikkunan ([coder#19505][c19505]) **(lähde)**.

### Tasks: agentti työtilan sisällä

Coder Tasks ajoi agentin ja AgentAPI:n jokaisen tehtävän omassa
työtilassa. Pohjaan tarvittiin `coder_ai_task`-resurssi, agenttimoduuli ja
LLM-avain muuttujana, esimerkiksi `claude_api_key = var.anthropic_api_key`
([Tasks, v2.33][tasks]) **(lähde)**. Jokaisella agentilla oli oma
moduulinsa ja omat muuttujansa ([Tasks core principles, v2.33][taskscore])
**(lähde)**. Tauko ja jatko pysäyttivät ja käynnistivät työtilan, ja
agentin piti jatkaa natiivista istunnostaan. Yhteensopivuustaulukossa
11 agentista vain Claude Code ja Codex jatkoivat täysin. Muilla tuki oli
osittainen, suunniteltu tai puuttui, ja jokaiselle oli oma seurantaissue,
oma istuntopolku ja omat erikoisuudet: Goosen SQLite-WAL-tiedostot, Amp
tarvitsee Sourcegraphin palvelimen ja Aiderin historia rakennetaan
Markdownista uudelleen häviöllisesti ([Agent compatibility, v2.33][compat])
**(lähde)**.

### Aikajana **(lähde: GitHub API, PR:t, blogi)**

| Päivä | Tapahtuma |
|---|---|
| 7.4.2025 | AgentAPI-repo luodaan. Show HN 17.4. ([HN][hnaa]) |
| 2025 | Coder Tasks julkaistaan AgentAPI:n varaan |
| 27.2.2026 | "feat: add experimental agents support" (`chats`-taulu, [PR #22290][pr22290]) |
| 22.–24.4.2026 | Registryn `claude-code`-moduulista poistetaan AgentAPI, Tasks-raportointi, Boundary ja käynnistys ([registry#861][reg861]) |
| 2.6.2026 | v2.34: Tasks merkitään vanhentuneeksi ([migraatio-opas][migr]) |
| 11.8.2026 | Tasks piilotetaan oletuksena: "Coder Tasks is being withdrawn from the product" ([#28008][pr28008]) |
| 31.8.2026 | Tasks API poistetaan, −10 792 riviä ([#28789][pr28789]) |
| 4.9.2026 | Agent Relay julkistetaan ([blogi][relayblog]) |
| 9.9.2026 | Coder Agents GA ([blogi][gablog]) |
| 13.9.2026 | AgentAPI merkitään "deprecated and no longer maintained" ja arkistoidaan |
| 29.10.2026 | ACP-aliagentit dokumentoidaan, kokeellisina ([ACP subagents][acp]) |

### Coderin oma selitys

Agent Relayn julkistuksessa Coder sanoo suoraan:

> "Our early work on self-hosted agent infrastructure used AgentAPI, an
> approach similar to today's Agent Client protocol, to run agent CLIs
> inside Coder workspaces behind a common user interface. It worked, but it
> surfaced two problems: AgentAPI never gained traction as a standard, and
> wrapping CLI-based agents introduced friction when recreating their
> experience in a web app." ([Agent Relay -blogi][relayblog]) **(lähde)**

Samassa kirjoituksessa todetaan, että "the agent landscape is fragmenting,
not converging", eli yhden agentin varaan ei kannata rakentaa
([Agent Relay -blogi][relayblog]) **(lähde)**. Coder Agentsin
dokumentaatio perustelee arkkitehtuurin tietoturvalla: kun agentti toimii
työtilassa, se tarvitsee LLM-avaimet, ulospäin avoimen verkon ja usein
laajat oikeudet. Säännellyssä ympäristössä tällaista pintaa on vaikea
lukita ([Coder Agents][agents]) **(lähde)**. Migraatio-oppaan taulukko
näyttää muutoksen tuotteen kannalta: tila oli ennen "AgentAPI state file"
työtilassa, nyt se on tietokannassa. Päivitykset tulivat ennen pollaamalla,
nyt WebSocketilla. Aliagentteja ei ennen ollut, nyt ne on rakennettu
sisään ([migraatio-opas][migr]) **(lähde)**.

**Päättely: syitä on neljä, ja ne painavat eri verran.**

1. *Raapimisen hauraus.* Tämä on todistetuin syy. Jokainen TUI-päivitys
   voi rikkoa sen, ja agentit päivittyvät itsestään.
2. *N agenttia × moduuli × jatkamistuki.* Jokainen agentti vaati oman
   moduulin, avainmuuttujat, istuntopolut ja jatkamislogiikan, eikä
   AgentAPI:sta tullut yhteistä rajapintaa, joka olisi siirtänyt työn
   agenttien tekijöille. ACP (Zedin Agent Client Protocol) täytti sittemmin
   saman paikan.
3. *Yrityshallinta.* Avaimet, verkkorajat, keskitetyt system promptit ja
   auditointi. Tämä on myyntiargumentti, jolla Coder Agentsia myydään.
4. *Liiketoiminta.* Oma agentti tekee Coderista agenttituotteen eikä vain
   infrastruktuuria. Agent Time laskutetaan käytön mukaan, ja ilmaisella
   lisenssillä aktiivisia agentteja voi olla rinnakkain enintään viisi
   ([Licensing & usage][lic]). Tätä Coder ei sano syyksi, mutta malli
   sopii siihen.

**Mistä Coder ei luopunut.** Registry asentaa yhä Claude Coden ja muut
CLI:t työtilaan, mutta moduuli vain asentaa ja konfiguroi: "Starting
Claude is left to the caller" ([claude-code-moduuli][ccmod]). Kehittäjä
käyttää natiivia agenttia itse terminaalissa tai IDE:ssä, mikä vastaa Open
Habitatin SSH- ja tmux-polkua. Agent Relay ajaa Claude Coden pilvi-istuntojen
työkalut Coder-työtilassa. ACP-aliagentit (`acp_spawn_agent` …) antavat
Coder Agentsin delegoida osatehtäviä työtilaan asennetulle Claude Codelle
tai Codexille ACP-adapterin kautta, harnessin omilla tunnuksilla
([ACP subagents][acp]) **(lähde)**. Coder luopui siis *TUI:n
raapimisesta* ja *agentista avainten haltijana työtilassa*, ei natiiveista
agenteista sinänsä **(päättely)**.

## 3. Arkkitehtuuri

### Missä prosessit ajetaan

Coder Agentsissa on kolme osaa ([Architecture][arch]) **(lähde)**:

- **Ohjaustaso** (`coderd`) ajaa agenttisilmukan. Kehote tallennetaan
  tietokantaan ja chat merkitään tilaan `running`. Ohjaustason chat worker
  ottaa chatin, striimaa keskustelun LLM:lle ja suorittaa työkalukutsut,
  kunnes malli lopettaa. Lopuksi tila on `waiting`. Silmukka on samassa
  binäärissä kuin dashboard ja API.
- **LLM-palveluntarjoaja** ei koskaan puhu työtilan kanssa.
- **Työtila** on tavallinen laskentaympäristö, jolla on "zero AI
  awareness": ei avaimia, ei agenttiprosesseja. Työkalut `read_file`,
  `write_file`, `edit_files`, `execute` ja `process_*` kulkevat työtilan
  daemonin HTTP-rajapintaan samaa Tailnet-tunnelia kuin web-terminaali ja
  `coder ssh`. Työtilan daemon ottaa yhteyden ulospäin ohjaustasoon, joten
  sisääntulevia portteja ei tarvita.

Koodissa tämä on `coderd/x/chatd`: noin 57 000 riviä Go-koodia ja
117 000 riviä testejä (oma `wc -l`-mittaus). Paketin
[`ARCHITECTURE.md`][chatdarch] kuvaa tilakoneen, jossa on 19
suoritustilaa, workerin omistajuuden (`worker_id`, `heartbeat_at`),
versiokentät vanhentuneen työn hylkäämiseen ja WebSocket-striimin, joka
yhdistää tietokannan viestit omistavan replikan striimiin. Tietokannassa on
18 `chat*`-taulua, esimerkiksi `chat_messages`, `chat_queued_messages`,
`chat_project_memories`, `chat_usage_limit_config` ja `chat_debug_steps`
([`dump.sql`][dump]) **(lähde)**.

### Eristys ja valtuudet

- **Ihmiset erotetaan työtiloina.** Jokaisella on omat konttinsa tai
  VM:nsä. Agentti voi käyttää vain chatin omistajan työtiloja ja vain niitä
  pohjia, joihin käyttäjällä on oikeus. "There is no privilege escalation."
  ([Architecture][arch]) **(lähde)**
- **Ohjaustaso on kaikkien yhteinen ja kaikkivaltias.** Kaikkien
  käyttäjien keskustelut ovat samassa tietokannassa, ja "An administrator
  can inspect any chat for audit or debugging" ([Architecture][arch])
  **(lähde)**. LLM-avaimet ovat ohjaustasolla. BYOK-tilassa käyttäjän oma
  API-avain tallennetaan sinne ([Models][models]) **(lähde)**.
  Dokumentaatio puhuu vain API-avaimista, ei tilauskirjautumisista
  **(lähde; ChatGPT- tai Claude-tilauksen tukea en löytänyt)**.
- **Keskitetty valvonta.** Ylläpitäjä päättää mallit, system promptin ja
  työkalut, eikä kehittäjä voi ohittaa niitä ([Architecture][arch])
  **(lähde)**.
- **Agentin oma identiteetti työtilassa on valinnainen.** "Network
  isolation" -ohje ajaa agentin työkalut omassa podissaan
  ei-root-käyttäjänä ja omalla kotihakemistollaan. Projektitiedostot
  jaetaan kehittäjän podin kanssa, ja verkkopolitiikka sallii vain Coderin.
  Ohjeen mukaan "Sandboxing in Coder is at an early stage"
  ([Agent isolation][isol]) **(lähde)**.
- **ACP-aliagenttien lupakyselyt hyväksytään automaattisesti**: "Coder
  automatically approves tool permission requests received through the
  adapter" ([ACP subagents][acp]) **(lähde)**.

### Istunnot ja selain

Selain on ensisijainen käyttöliittymä REST- ja WebSocket-rajapinnan
rinnalla. Rajapinnassa on viestijono (`queued`), jonon kärjen muokkaus
(`paused`), keskeytys (`interrupting`), asiakkaan suorittamat työkalut
(`requires_action`) ja uudelleenyhdistäminen `after_id`-kursorilla
([migraatio-opas][migr]) **(lähde)**. Lisäksi on plan mode, jossa agentti
kirjoittaa vain suunnitelmatiedostoon `.coder/plans/`, sekä aliagentit,
kompaktointi, liitteet, projektit ja muistit ([Coder Agents][agents])
**(lähde)**. Arkistoidut keskustelut poistetaan oletuksena 30 päivän
kuluttua ([Chat retention][retention]) **(lähde)**.

Terminaalista Coder Agentsin keskusteluun ei pääse: keskustelu on
Coderin tietokannassa eikä minkään natiivin työkalun muodossa. Keskustelua
jatketaan Coderin selaimessa tai rajapinnan kautta, ja työtilaan voi avata
IDE:n tai SSH:n katsomaan tiedostoja **(päättely dokumentaatiosta)**.

## 4. Kypsyys ja lisenssi

| Mittari (GitHub API 31.10.2026) | Arvo |
|---|---|
| `coder/coder` luotu | 22.12.2021 |
| Tähdet / forkit | 17 238 / 1 640 |
| Avoimet issuet ja PR:t | 1 150 |
| Julkaisutahti | kuukausittain (v2.36 4.8., v2.37 1.9., v2.38 6.10.) |
| `coder/agentapi` | 1 495 tähteä, arkistoitu, MIT |

- **Lisenssi**: ydin on AGPL-3.0. Hakemisto `enterprise/` on erillisellä
  lähdekoodi saatavilla -lisenssillä (`LICENSE.enterprise`), ja osa
  `chatd`:stä on siellä ([repo][commit]) **(lähde)**.
- **Coder Agents** on GA 9.9.2026, mutta koodi on yhä `coderd/x/`-polussa,
  ja osa toiminnoista (ACP, virtuaalityöpöytä, eristys) on kokeellisia
  **(lähde)**. Betan aikana "nearly 70% of Coder Agents workloads were
  invoked through the API" ([GA-blogi][gablog]) **(lähde)**.
- **Hinnoittelu**: Community- ja Premium-lisensseillä aktiivisia agentteja
  voi olla viisi rinnakkain. AI Premium myy Agent Time -tunteja, ja
  käyttö raportoidaan tunneittain Coderin palvelimelle
  (`tallyman-prod.coder.com`) ([Licensing & usage][lic]) **(lähde)**.
- **Riippumattomat äänet** jäivät ohuiksi. AgentAPI:n Show HN keräsi 163
  pistettä ja 15 kommenttia ([HN][hnaa]). Coder Agentsista ja Tasksin
  poistosta en löytänyt HN-keskustelua (Algolia-haut "Coder Agents",
  "coder tasks", "agentapi").

## 5. Rinnakkain Open Habitatin kanssa

Open Habitatin sarake perustuu tiedostoihin `docs/product.md` ja juuren
`AGENTS.md`, ja Pi:n RPC-käynnistyksen osalta tiedostoon
`internal/daemon/pi_rpc_linux.go` (`--mode rpc`).

| | Coder Agents | Open Habitat |
|---|---|---|
| Agentti | Coderin oma Go-silmukka. Natiivit harnessit vain ACP-aliagentteina (kokeellinen) | Pi, natiivi harness |
| Yhteys agenttiin | Ei tarvita, koska silmukka on oma. Aiemmin TUI:n raapiminen | Pi:n rakenteinen RPC (`--mode rpc`) |
| Missä silmukka ajetaan | Jaetulla ohjaustasolla | Ihmisen omana Unix-käyttäjänä hänen daemoninsa alla |
| Missä työkalut ajetaan | Käyttäjän työtilassa (kontti tai VM) Tailnetin yli | Samassa Unix-tilissä, paikallisesti |
| Ihmisten erottelu | Työtila per käyttäjä ja RBAC. Ohjaustaso näkee kaiken | Unix-tunnus, tiedosto-oikeudet ja käyttäjäkohtaiset socketit |
| Historia | Postgres, ylläpitäjä voi lukea, poisto 30 päivän kuluttua | Pi:n natiivi istuntotiedosto käyttäjän kotihakemistossa |
| Terminaalista jatkaminen | Ei | Kyllä, sama Pi-istunto. Selaimessa vain luettava, jos aloitettu terminaalissa |
| LLM-tunnukset | Organisaation avaimet ohjaustasolla tai BYOK-API-avain | Käyttäjän oma tilaus Pi:n kautta hänen omalla tilillään |
| Ylläpitäjän valvonta | Mallit, system prompt ja työkalut lukittu keskitetysti | Ei keskitettyä promptia. Ylläpitäjä päättää vain pääsystä |
| Kesto | Tila tietokannassa, workerin omistajuus ja heartbeat, uudelleenyritys | Pi jatkaa selaimen sulkemisen jälkeen. Daemonin sammuminen voi katkaista työn |
| Automaatio | REST ja WebSocket, GitHub Action. 70 % betakuormasta API:n kautta | Selain. Taskfleet erillisenä työkaluna |
| Asennus | Postgres, Terraform-pohjat, provisionerit, usein Kubernetes | Yksi Go-binääri ja selainpaketti yhdellä Linux-palvelimella |
| Lisenssi | AGPL-3.0 + enterprise-lisenssi, käyttöpohjainen agenttiaika | Repossa ei vielä lisenssitiedostoa |

## 6. Koskeeko Coderin syy Open Habitatia?

- **Raapimisen hauraus: ei koske.** Open Habitat käynnistää Pi:n
  RPC-tilassa ja saa rakenteiset tapahtumat **(lähde: koodi)**. Pi:stä on
  kiinnitetty versio, ja testi `test-real-pi-controller.sh` ajaa oikeaa
  Pi:tä (TESTING.md) **(lähde)**. Lievempi muoto koskee kuitenkin meitäkin:
  olemme riippuvaisia Pi:n RPC-protokollasta ja istuntotiedoston
  muodosta. Coderin issue #207, jossa automaattipäivitys rikkoi
  integraation yön aikana, kertoo, miksi kiinnitys on tärkeä
  **(päättely)**.
- **N agenttia: ei koske nyt.** Open Habitat tukee vain Pi:tä, ja
  `docs/product.md` rajaa muut harnessit erikseen päätettäviksi. Coderin
  yhteensopivuustaulukko näyttää, mitä tulisi vastaan, jos niitä
  lisättäisiin: jatkaminen, istuntopolut ja tunnistautuminen pitäisi tehdä
  harness kerrallaan. Coder itse palasi natiiveihin harnesseihin ACP:n
  kautta **(päättely)**.
- **Yrityshallinta: päinvastainen tavoite.** Coderin uhkamalli on, että
  kehittäjä tai saastunut prosessi vie organisaation avaimet, joten
  agentti siirretään pois kehittäjän ulottuvilta ja tila keskitetään.
  Open Habitatin uhkamalli on, että ihminen pääsee toisen ihmisen
  tunnuksiin, joten agentti *on* ihminen omalla tilillään ja omilla
  tunnuksillaan, ja keskitettyä varastoa ei ole. Coderin ratkaisu
  tekisi Open Habitatiin juuri sen kaikkivaltiaan komponentin, jonka
  arkkitehtuuri kieltää **(päättely)**.
- **Verkkosovelluksen kokemus: koskee osittain.** Coder sanoo, että
  CLI-agentin kokemuksen toistaminen verkossa oli hankalaa. Open
  Habitatissa sama kitka näkyy rajauksina: terminaalissa aloitettu
  keskustelu on selaimessa vain luettava, eikä eri kirjoittajien
  poissulkemista luvata. RPC poistaa raapimisen, mutta natiivin työkalun
  rajat jäävät. Coder ratkaisi asian omistamalla silmukan ja luopumalla
  terminaalista. Open Habitat on valinnut toisin, ja tämä on sen hinta
  **(päättely)**.

## 7. Suositukset

### Mitä Open Habitat voisi oppia (tärkeysjärjestyksessä)

1. **Pi:n työ voisi selvitä daemonin uudelleenkäynnistyksestä.** Coder
   panosti GA:ta varten "improved agent durability" -ominaisuuteen ([GA-blogi][gablog]), ja
   sen chatd on rakennettu niin, että replikan kaatuminen ei hävitä
   vuoroa: omistajuus ja heartbeat ovat tietokannassa
   ([`ARCHITECTURE.md`][chatdarch]). *Miksi:* `docs/product.md` lupaa, että
   selaimen sulkeminen jättää agentin töihin, mutta myöntää, että daemonin
   sammuminen voi katkaista työn. Päivitys, jonka testipalvelin saa
   usein, on juuri tällainen sammuminen. Natiivi vastine Coderin
   tietokannalle on ajaa Pi omassa systemd-käyttäjäscopessaan
   (`systemd-run --user --scope` tai vastaava), jotta prosessi ei kuole
   daemonin mukana. Daemon liittyisi siihen uudelleen ja lukisi
   välissä syntyneen historian Pi:n istuntotiedostosta. Ratkaistavaksi
   jää, miten RPC:n stdin/stdout-putki säilyy, joten tämä on
   suunnittelukysymys eikä pieni muutos **(päättely)**.
2. **Daemonin rajapinta käyttäjän omien automaatioiden käyttöön.**
   Coder Agentsin betakuormasta lähes 70 % tuli API:n kautta
   ([GA-blogi][gablog]), ja Tasksin GitHub Action korvattiin heti uudella
   ([migraatio-opas][migr]). *Miksi:* Open Habitatin daemon toimii jo
   käyttäjän omana prosessina käyttäjäkohtaisessa socketissa, joten
   käyttäjän cron-ajo tai skripti voisi aloittaa keskustelun ja nähdä sen
   selaimen Käynnissä-listassa ilman uutta valtuutta. Raja säilyy, koska
   socketin oikeudet ovat Unix-käyttäjän. Kyse on siitä, julkaistaanko
   `contracts/v1/` myös CLI-käyttöön, ja se kuuluu AI-first CLI -kaanonin
   piiriin **(päättely)**.
3. **Siirtymätilat näkyviin: "Keskeytetään…" ja muokattava jonon kärki.**
   Coderin tilakoneessa `interrupting` erottaa pyynnön vahvistetusta
   pysähdyksestä. Jonossa olevaa viestiä voi muokata, jolloin chat
   pysähtyy (`paused`), kunnes muokkaus on valmis ([migraatio-opas][migr])
   **(lähde)**. *Miksi:* `docs/product.md` vaatii jo, että keskeytyksen
   tulos näytetään sen mukaan, mitä tiedetään. Oma välitila tekee tästä
   näkyvää. Jonoviestin muokkaus on tällä hetkellä rajattu sovitun
   toiminnan ulkopuolelle. Coderin malli, jossa muokattava viesti
   pysäyttää jonon, on yksi turvallinen tapa toteuttaa se, jos Pi:n jono
   sen sallii **(päättely; Pi:n jonorajapinta tarkistamatta)**.
4. **Jos muita harnesseja joskus tulee, ne tulevat ACP:n tai harnessin oman
   RPC:n kautta, eivät terminaalista.** *Miksi:* tämä on vertailun
   kalleimmin maksettu oppitunti. Coder rakensi universaalin
   TUI-adapterin, ylläpiti sitä puolitoista vuotta ja poisti sen. Samasta
   syystä terminaalissa aloitetun Pi-istunnon elävä näkymä selaimessa
   kannattaa rakentaa Pi:n oman rajapinnan tai laajennuksen varaan eikä
   `tmux capture-pane`n **(päättely)**.

### Missä Open Habitat on jo parempi

- **Ei kaikkivaltiasta keskuskomponenttia.** Coderin ohjaustaso pitää
  kaikkien keskustelut, avaimet ja promptit, ja ylläpitäjä voi lukea minkä
  tahansa chatin. Open Habitatissa keskustelu on ihmisen omassa
  kotihakemistossa, ja daemon ei luota gatewayn identiteettiväitteisiin.
- **Natiivi historia ja terminaalin pariteetti.** Coder Agentsin
  keskustelut ovat vain Coderin tietokannassa, ja ne poistetaan 30 päivän
  kuluttua arkistoinnista. Open Habitatin keskustelu on Pi:n istunto,
  jonka voi avata SSH:n ja tmuxin kautta.
- **Käyttäjän oma tilaus.** Coder Agents vaatii organisaation tai
  käyttäjän API-avaimen ohjaustasolle. Open Habitatissa Pi käyttää
  ihmisen ChatGPT-tilausta hänen omalla tilillään.
- **Rakenteinen yhteys alusta asti.** Coderin piti poistaa koko
  raapimiskerros. Open Habitat aloitti Pi:n RPC:stä ja kiinnitetystä
  versiosta.
- **Keveys.** Yksi palvelin ja yksi binääri verrattuna Postgresiin,
  Terraform-pohjiin, provisionereihin ja usein Kubernetesiin. Ei
  käyttölaskutusta, agenttikattoa eikä raportointia toimittajalle.

### Mitä ei kannata kopioida

- **Oma agenttisilmukka keskitetyssä palvelussa.** Se on Coderin
  ydinvalinta, ja se rikkoo molempia Open Habitatin periaatteita: toinen
  totuus Pi:n historian rinnalle ja palvelu, joka toimii kaikkien
  puolesta.
- **Keskustelut tietokantaan, ylläpitäjän luettaviksi ja säilytysajalla
  poistettaviksi.** Natiivi historia on käyttäjän omaa.
- **Keskitetty system prompt ja työkalujen lukitus ylläpitäjältä.** Se
  sopii organisaatiolle, joka valvoo työntekijöitään, ei palvelimelle,
  jolla ihmiset tekevät omaa työtään omilla tunnuksillaan.
- **Agentin automaattinen työtilan luonti pohjasta.** Open Habitatin
  työtila on käyttäjän `~/src`-hakemisto. Agentin ei kuulu varata
  laskentaresursseja.
- **ACP-lupakyselyjen automaattinen hyväksyntä.** Samaa YOLO-oletusta
  Orca-vertailu varoitti kopioimasta.
- **TUI:n raapiminen missään muodossa** (ks. suositus 4).
- **Agentin erillinen identiteetti työtilassa** ([Agent isolation][isol]).
  Ajatus on kiinnostava: agentti saisi projektitiedostot mutta ei
  ihmisen kotihakemistoa eikä avaimia. Open Habitatissa se rikkoisi
  lupauksen, että agentti toimii kuten SSH:n kautta ja käyttää ihmisen
  natiiveja kirjautumisia. Jos tarve tulee, se on Jarin
  arkkitehtuuripäätös, eikä Coderkaan pidä toteutustaan vielä
  valmiina **(päättely)**.

## Mitä en saanut selville

- Coderin verkkosivuilta latasin vain blogin etusivun ja kaksi
  kirjoitusta. Dokumentaation luin repon Markdownista, joka on sama
  lähde kuin coder.com/docs. Yleistä verkkohakua en käyttänyt.
- Tasksin julkaisupäivää ja käyttömääriä en tarkistanut. Coderin
  sisäisiä perusteluja Tasksin poistolle (esim. PR #28008:n
  ulkopuoliset keskustelut tai asiakaspalaute) ei ole julkisesti
  saatavilla. Poisto-PR:t kertovat *mitä*, eivät *miksi*.
- Riippumattomia käyttäjäkokemuksia Coder Agentsista en löytänyt
  HN:stä.

## Lähteet

- Coder-repo, luettu commit: <https://github.com/coder/coder/tree/a2e2a9171722aed4865c5725fe67066235bf8cc0>
- Coder Agents: <https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/index.md> (julkaistuna <https://coder.com/docs/ai-coder/agents>)
- Coder Agents, Architecture: <https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/architecture.md>
- Migrate from the Tasks API to the Chats API: <https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/tasks-to-chats-migration.md>
- Licensing & usage: <https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/licensing-usage.md>
- Models (BYOK): <https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/models.md>
- ACP subagents: <https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/acp-subagents.md>
- Network isolation: <https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/platform-controls/agent-isolation.md>
- Conversation data retention: <https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/platform-controls/chat-retention.md>
- Run AI coding agents in Coder: <https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/index.md>
- chatd ARCHITECTURE.md: <https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/coderd/x/chatd/ARCHITECTURE.md>
- Tietokantaskeema: <https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/coderd/database/dump.sql>
- Coder Tasks (v2.33.0): <https://github.com/coder/coder/blob/v2.33.0/docs/ai-coder/tasks.md>
- Understanding Coder Tasks (v2.33.0): <https://github.com/coder/coder/blob/v2.33.0/docs/ai-coder/tasks-core-principles.md>
- Agent compatibility (v2.33.0): <https://github.com/coder/coder/blob/v2.33.0/docs/ai-coder/agent-compatibility.md>
- PR #22290, experimental agents: <https://github.com/coder/coder/pull/22290>
- PR #28008, Tasks piiloon: <https://github.com/coder/coder/pull/28008>
- PR #28789, Tasks API poistetaan: <https://github.com/coder/coder/pull/28789>
- Issue #19505: <https://github.com/coder/coder/issues/19505>
- AgentAPI README: <https://github.com/coder/agentapi/blob/main/README.md>
- AgentAPI #48: <https://github.com/coder/agentapi/issues/48>
- AgentAPI #123: <https://github.com/coder/agentapi/issues/123>
- AgentAPI #126: <https://github.com/coder/agentapi/issues/126>
- AgentAPI #205: <https://github.com/coder/agentapi/issues/205>
- AgentAPI #207: <https://github.com/coder/agentapi/issues/207>
- Registry, claude-code-moduuli: <https://github.com/coder/registry/blob/main/registry/coder/modules/claude-code/README.md>
- Registry PR #861: <https://github.com/coder/registry/pull/861>
- Blogi, Introducing Agent Relay (4.9.2026): <https://coder.com/blog/introducing-agent-relay-cloud-hosted-agents-self-hosted-execution>
- Blogi, Coder Agents is GA (9.9.2026): <https://coder.com/blog/coder-agents-ga>
- Show HN: AgentAPI (17.4.2025): <https://news.ycombinator.com/item?id=43719447>

[commit]: https://github.com/coder/coder/tree/a2e2a9171722aed4865c5725fe67066235bf8cc0
[agents]: https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/index.md
[arch]: https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/architecture.md
[migr]: https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/tasks-to-chats-migration.md
[lic]: https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/licensing-usage.md
[models]: https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/models.md
[acp]: https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/acp-subagents.md
[isol]: https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/platform-controls/agent-isolation.md
[retention]: https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/agents/platform-controls/chat-retention.md
[aiindex]: https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/docs/ai-coder/index.md
[chatdarch]: https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/coderd/x/chatd/ARCHITECTURE.md
[dump]: https://github.com/coder/coder/blob/a2e2a9171722aed4865c5725fe67066235bf8cc0/coderd/database/dump.sql
[tasks]: https://github.com/coder/coder/blob/v2.33.0/docs/ai-coder/tasks.md
[taskscore]: https://github.com/coder/coder/blob/v2.33.0/docs/ai-coder/tasks-core-principles.md
[compat]: https://github.com/coder/coder/blob/v2.33.0/docs/ai-coder/agent-compatibility.md
[pr22290]: https://github.com/coder/coder/pull/22290
[pr28008]: https://github.com/coder/coder/pull/28008
[pr28789]: https://github.com/coder/coder/pull/28789
[c19505]: https://github.com/coder/coder/issues/19505
[agentapi]: https://github.com/coder/agentapi/blob/main/README.md
[aa48]: https://github.com/coder/agentapi/issues/48
[aa123]: https://github.com/coder/agentapi/issues/123
[aa126]: https://github.com/coder/agentapi/issues/126
[aa205]: https://github.com/coder/agentapi/issues/205
[aa207]: https://github.com/coder/agentapi/issues/207
[ccmod]: https://github.com/coder/registry/blob/main/registry/coder/modules/claude-code/README.md
[reg861]: https://github.com/coder/registry/pull/861
[relayblog]: https://coder.com/blog/introducing-agent-relay-cloud-hosted-agents-self-hosted-execution
[gablog]: https://coder.com/blog/coder-agents-ga
[hnaa]: https://news.ycombinator.com/item?id=43719447
