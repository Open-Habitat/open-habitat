# Vertailu: HumanLayer

Lähteet luettu 31.10.2026. Lähdekoodi: `github.com/humanlayer/humanlayer`, main-haara
commit `316e74e` (28.10.2026). Merkintä **Päättely:** erottaa omat johtopäätökseni siitä,
mitä lähteet sanovat.

## Tiivistelmä

HumanLayer on kehitystiimeille tehty maksullinen pilvipalvelu ja työpöytäsovellus, jolla
ohjataan koodausagentteja (Claude Code, Codex, OpenCode, Pi) "tehtävinä". Tehtävä kokoaa
yhteen agentti-istunnot, worktreet sekä tutkimus-, suunnitelma- ja toteutusdokumentit.
Tiimi voi kommentoida dokumentteja, ja kommentit palaavat agentille. Agentit ajetaan
käyttäjän omilla koneilla: jokaisella hostilla on daemon, joka ajaa käynnistäneen
käyttäjän oikeuksilla. Kaikki tila (istunnot, tapahtumat, hyväksynnät, dokumentit,
käyttöoikeudet) synkronoidaan HumanLayerin Postgresiin, ja selain-, työpöytä- ja
mobiilinäkymät lukevat sitä. Tuote on siis Open Habitatin peilikuva. Ihmisten välinen raja
on pilven organisaatio- ja tehtäväoikeudet, ei Unix-tunnus. Natiivien työkalujen historia
kopioidaan pilveen, ja Codexin osalta se korvataan kokonaan omalla agentilla.
Koko pino julkaistiin Apache 2.0 -lisenssillä vasta 22.10.2026. Itse ajaminen on vielä
keskeneräistä, ja vaatii mm. WorkOS-, Slack- ja Linear-avaimet. Open Habitat voisi
lainata kolme asiaa: dokumenttien ja diffin kommentoinnin agentille palautteeksi,
istunnon kumulatiivisen diffin ja worktreen valmistelureseptin. Näistä jokainen onnistuu
ilman uutta tietovarastoa. Tiimin yhteistä promptaamista, hyväksyntöjen viemistä pilveen
ja omaa agenttiajoa ei kannata kopioida.

## Mikä HumanLayer on ja kenelle

**Nimen valinta.** HumanLayer on sekä yhtiön että tuotteen nimi, ja tuote on vaihtunut
kahdesti:

1. **HumanLayer SDK** (2024). Python/TS-kirjasto, jonka `@require_approval`- ja
   `human_as_tool`-funktiot pysäyttivät agentin riskialttiin työkalukutsun ihmisen
   hyväksyttäväksi Slackissa tai sähköpostissa. Yhtiö oli YC F24 ja sai Launch HN:ssä
   354 pistettä ([Launch HN 11/2024](https://news.ycombinator.com/item?id=42247368)).
   SDK:t poistettiin repon PR:ssä #646; dokumentaatio jäi `legacy-final`-tagiin
   ([humanlayer.md, legacy-final](https://github.com/humanlayer/humanlayer/blob/legacy-final/humanlayer.md)).
2. **CodeLayer** (2025). "Avoimen lähdekoodin IDE agenttien orkestrointiin, rakennettu
   Claude Coden päälle". Siinä oli paikallinen Go-daemon `hld` (Unix-socket/REST,
   SQLite) ja Tauri-käyttöliittymä
   ([README 9/2025](https://github.com/humanlayer/humanlayer/blob/69f67a69/README.md),
   [hld/README](https://github.com/humanlayer/humanlayer/blob/legacy-final/hld/README.md)).
   Kesäkuussa 2026 julkinen repo merkittiin vanhentuneeksi ("the code here is pretty
   much all deprecated").
3. **HumanLayer, koodinimeltään Riptide** (nykyinen). Monorepon `AGENTS.md` sanoo
   suoraan: "RIPTIDE is the codename for the new version of codelayer"
   ([AGENTS.md](https://github.com/humanlayer/humanlayer/blob/main/AGENTS.md)).

Vertaan nykyiseen tuotteeseen (3). Juuri se on ajossa, se kilpailee samasta
käyttötapauksesta ja sen lähdekoodi on nyt luettavissa. SDK:n ihmishyväksyntäajatus elää
tuotteessa hyväksyntärivinä (ks. alla).

**Kenelle.** Sivusto puhuu "software factory" -tiimeille ja yrityksille, joilla on
"million-LOC enterprise codebases". Hinnoittelu on käyttäjäkohtainen, ja Enterprise-taso
tarjoaa SSO:n, auditlokit ja on-prem-asennuksen ([humanlayer.dev](https://www.humanlayer.dev/)).
Tuotteen ydin on rakenteinen työtapa. QRSPI/RPI jakaa työn vaiheisiin (Questions,
Research, Design, Structure, Plan, Implement), ja jokaisessa vaiheessa ihminen tarkistaa
dokumentin ennen koodia ([workflow-phases](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/explanation/workflow-phases.md)).
Agentti saa ehdottaa, mutta päätös on käyttäjän ("The agent can propose a choice, but
the user owns the decision").

## Arkkitehtuuri

### Missä agentit ajetaan

Koneella ajetaan daemon, joka käynnistää agentti-istunnot: joko työpöytäsovelluksen
mukana (macOS) tai `humanlayer daemon launch` -komennolla millä tahansa hostilla
(Linux, Windows, VM, kontti). API välittää työn daemonille, ja daemon lähettää
tapahtumat API:n kautta kaikille käyttöliittymille
([remote-daemons](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/explanation/remote-daemons.md)).
Pilvi ei aja agentteja. "Cloud daemons" tarkoittaa käyttäjän omaa etähostia.
Daemon tarvitsee lähtevän HTTPS-yhteyden osoitteisiin `riptide-api.humanlayer.com`
ja `sync.humanlayer.com`. Ilman niitä se ei toimi.

Pinossa on noin 20 sovellusta: Bun/TypeScript-daemon (Effect, Claude Agent SDK),
oRPC/Hono-API, Postgres, Electric SQL -synkronointi ja sen auth-proxy, Electron- ja
Tauri-sovellukset, React-verkkosovellus, admin-verkkosovellus sekä AWS Lambda -työt
(migraatiot, päivityspalvelin, vanhentuneiden daemonien siivous)
([README](https://github.com/humanlayer/humanlayer/blob/main/README.md)).

### Miten agentit liitetään

- **Claude Code**: daemon ajaa sen Claude Agent SDK:n `query()`-kutsulla, ja
  `canUseTool`-kutsu muuttaa jokaisen luvanvaraisen työkalukutsun hyväksyntäpyynnöksi
  (`apps/riptide-daemon/src/effects/services/claude-sessions/prepare-claude-session.ts`).
  Clauden natiivi historia jää hostin `~/.claude/`-hakemistoon, ja HumanLayer tallentaa
  lisäksi tapahtumat omaan tauluunsa (`packages/db/src/tables/conversation-events.ts`).
- **Codex**: kyse ei ole natiivista Codex CLI:stä vaan HumanLayerin omasta agentista
  ("CodeLayer"), joka käyttää Codex-tilauksen OAuthia OpenAI Responses -rajapintaan
  (`agents/codelayer/execute-codelayer.ts`: `createCodelayerAgent`,
  `agentlayer-provider-openai-codex`). Docs sanoo sen suoraan: "Codex conversations are
  stored by HumanLayer and need no local files". Tila on taulussa
  `codelayer-agent-state` ([remote-daemons](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/explanation/remote-daemons.md)).
- **Pi ja OpenCode**: laajennus, joka *peilaa* terminaalissa ajettavan istunnon pilveen
  ([humanlayer-pi README](https://github.com/humanlayer/humanlayer-pi)). Peilaus alkaa
  ensimmäisestä promptista. Sitä vanhempi historia jää paikalliseksi, verkkoviesti ja
  Stop-nappi välittyvät Pi:lle, ja hosti lähettää 15 sekunnin välein sydämenlyönnin.
  README: "The host offers no launches: the web app can't start a pi session."
  Laajennus on alfa-asteella.

### Eristys ja valtuudet

Lähteen mukaan: "The daemon gives coding agents the file and network access of the
user that runs it. Use an account with only the access that the sessions need."
Muuta hiekkalaatikkoa ei ole. Isäntätunnus on tiedostossa `$HOME/.humanlayer/riptide/host_id`
ja kirjautuminen hakemistossa `~/.humanlayer/riptide/`
([remote-daemons](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/explanation/remote-daemons.md)).

Ihmisten väliset oikeudet ovat pilven tauluissa: organisaatiot, tiimit, projektit, sekä
tehtäväkohtaiset ACL:t `task-user-acl` ja `task-organization-acl`
(`packages/db/src/tables/`). Istunnolla on neljä tasoa: `no_access`, `view`, `prompt` ja
`owner`. *Multiplayer prompting* antaa organisaation asetuksen ja aikarajatun luvan
nojalla myös muille kuin istunnon omistajalle `prompt`-tason. Silloin he voivat lähettää
viestejä ja hyväksyä työkalukutsuja istuntoon, joka ajaa omistajan hostilla
(`apps/riptide-api/src/lib/session-multiplayer-prompting-auth.ts`,
`apps/riptide-api/src/orpc/api/approvals/resolve.effect.ts`; ks. myös
[release notes 0.183.0](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/release-notes.md)).

**Päättely:** Käytännössä toinen ihminen voi ohjata komentoja, jotka ajetaan
toisen Unix-tunnuksella, tämän avaimilla ja tiedostoilla, ja raja on pilvipalvelun
SQL-tarkistus. Tämä on suunniteltu ominaisuus. Open Habitatissa se olisi
tuotevirhe.

### Ihminen silmukassa ja hyväksynnät

Hyväksyntä on rivi `approvals`-taulussa (`pending` → `approved`/`denied`, `approved_by_user_id`,
valinnaiset "lisää sääntö" -ehdotukset). Rivi synkronoituu daemonille Electricin kautta.
Hyväksytty sääntö (esim. "salli `npm test*`") hyväksyy samat komennot jatkossa
automaattisesti (`apps/riptide-daemon/src/agents/claudecode/approvals.ts`). Jos daemon on
vastaamatta noin kaksi minuuttia käynnissä olevan tai hyväksyntää odottavan istunnon
aikana, istunto merkitään epäonnistuneeksi. Istuntoon voi silti lähettää uuden viestin,
kun hosti palaa ([remote-daemons](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/explanation/remote-daemons.md)).

Toinen silmukka on dokumenttitasolla. Agentin tehtäväkansioon kirjoittamat tiedostot
(`.humanlayer/tasks/<slug>/`, md/txt/json, enintään 10 Mt) synkronoidaan pilveen.
Ihmiset kommentoivat niitä selaimessa, ja agentti lukee kommentit työkaluilla, kuten
`get_artifact_comments`, `reply_to_artifact_comment` ja `get_diff_comments`
([tasks](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/explanation/tasks.md),
[humanlayer-pi README](https://github.com/humanlayer/humanlayer-pi)). Synkronointi
seuraa vain agentin tiedostotyökaluja: "A file does not upload only because another
program placed it in the directory."

### Istunnot, worktreet ja rinnakkaiset agentit

Tehtävä on istuntoa suurempi yksikkö. Siinä on useita istuntoja (vaihe kerrallaan),
yhteiset tiedostot, kommentit ja diffi. Tehtävää luotaessa luodaan worktree jokaiseen
konfiguroituun repoon. `.humanlayer/workspace.json` (jaettu) ja `workspace.local.json`
(oma) määrittävät polkupohjan, haaran nimen, lähtöhaaran (`origin/main`), kopioitavat
tiedostot (`copyGlobs`, esim. `.env`) ja asennuskomennon. Worktreen luontiajan voi
valita: nyt, myöhemmin tai ei koskaan
([workspace-model](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/explanation/workspace-model.md)).
Tehtävän diffi on työpuu verrattuna ensimmäisen promptin HEAD-committiin. Pi-laajennus
rakentaa sen uudelleen 1,5 sekuntia jokaisen kirjoituksen jälkeen
([humanlayer-pi README](https://github.com/humanlayer/humanlayer-pi)). Rinnakkaisuus
tarkoittaa monta istuntoa samalla daemonilla tai monella hostilla.

### Selain, työpöytä ja mobiili

macOS-sovellus (Electron, myös Tauri-versio), verkkosovellus `app.humanlayer.com` ja
sama verkkosovellus puhelimessa. Selainversiosta puuttuu vielä työtilojen hallinta,
upotettu terminaali ja polkujen automaattinen täydennys
([remote-daemons](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/explanation/remote-daemons.md)).
Linear-, Jira-, GitHub- ja Slack-integraatiot luovat tehtäviä ja lähettävät
ilmoituksia ([docs index](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/index.md)).
Näppäimistöohjaus ja komentopaletti ovat keskeinen myyntiväite ("Superhuman for
Claude Code").

### Natiivit työkalut vai oma alusta

Tuote on oma alusta, jonka sisällä voi ajaa natiiveja agentteja. Totuus istunnosta,
tehtävästä, kommenteista ja oikeuksista on HumanLayerin Postgresissa. Claude-istunnon
natiivi historia säilyy hostilla, mutta Codexin ei. Pi- ja OpenCode-istunnot ovat
natiiveja, ja pilvessä on niistä kopio.

## Hinnoittelu ja lisenssi

Sivuston mukaan ([humanlayer.dev, Pricing](https://www.humanlayer.dev/)):

- **Starter**: ilmainen, enintään 3 jäsentä ja 200 istuntoa kuukaudessa.
- **Pro**: 100 $ / käyttäjä / kk. Rajattomasti tehtäviä ja istuntoja, monirepo-worktreet,
  etädaemonit.
- **Enterprise**: hinta sopimuksen mukaan. SSO/SAML, auditlokit, on-prem/VPC, ZDR ja DPA.
- Mallikulut käyttäjä maksaa itse (BYOK: oma Claude- tai Codex-tilaus tai API-avain).
  SOC 2 Type II.

Lisenssi on **Apache 2.0** 22.10.2026 alkaen. Silloin koko pilvipalvelun koodi julkaistiin
yhtenä committina ("Replaces the earlier open-source HumanLayer code, which stays on the
`legacy` branch") ([commit d8197bab](https://github.com/humanlayer/humanlayer/commit/d8197bab),
[blogi: Open sourcing HumanLayer](https://www.hlyr.dev/blog/open-sourcing-humanlayer)).
Blogin mukaan itse ajaminen on vielä kesken: "a lot of third party API keys that could
be made optional, but are not yet (i.e. processes will refuse to start without them)".
README: "Guides for running it yourself are in progress". Sivuston UKK väittää
31.10. yhä "Is HumanLayer open source? Not yet", mikä on ristiriidassa repon kanssa.

## Kypsyys ja jalansija

- Perustettu 2023, Dexter Horthy, YC F24. YC-sivun mukaan 2 työntekijää
  ([YC](https://www.ycombinator.com/companies/humanlayer)). **Päättely:** luku voi olla
  vanhentunut. Blogin allekirjoittajina ovat Dex ja Kyle.
- Julkaisutahti on tiivis: verkkosovelluksen release notes etenee lähes päivittäin
  (0.155 → 0.183 elo–lokakuussa 2026), CLI-paketti `@humanlayer/cli` on versiossa
  0.31.222, ja sitä ladattiin 9 054 kertaa 30.9.–29.10.2026
  ([npm](https://www.npmjs.com/package/@humanlayer/cli)).
- GitHub: 12 726 tähteä ja 29 kontribuuttoria (GitHub API 31.10.). **Päättely:** tähdet
  ovat pääosin SDK- ja CodeLayer-ajalta, koska nykyinen koodi on ollut julkinen yhdeksän
  päivää. Avaamisilmoitus sai HN:ssä 31 pistettä
  ([HN](https://news.ycombinator.com/item?id=50215925)).
- Yhtiön suurin vaikutus on ollut ajattelu: [12-factor-agents](https://github.com/humanlayer/12-factor-agents)
  (26,9k tähteä, HN 475 pistettä), "context engineering" ja RPI-työtapa, sekä
  [Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
  (HN 748 pistettä). Osa HN-keskustelusta pitää ohjetiedostojen virittelyä
  turhana tai lyhytikäisenä ("most of this advice will probably age like milk").
- Asiakaslainaukset ovat startup-perustajilta, kuten Casco (YC X25) ja Revlo.

## Rinnakkain Open Habitatin kanssa

| | HumanLayer | Open Habitat |
|---|---|---|
| Kohderyhmä | Kehitystiimit ja yritykset, maksullinen SaaS | Yksi palvelin, sen ihmiset ja heidän agenttinsa |
| Missä agentit ajetaan | Käyttäjän koneilla ja etähosteilla daemonin alla | Yhdellä Linux-palvelimella käyttäjän omana daemonina |
| Ihmisten välinen raja | Pilven org/tiimi/tehtävä-ACL:t; toinen voi promptata ja hyväksyä istunnossa, joka ajaa omistajan tunnuksella | Linux-tunnus, tiedosto-oikeudet ja käyttäjäkohtaiset socketit |
| Totuus historiasta | Postgres-pilvi (tapahtumat, hyväksynnät, dokumentit); Codexin historia vain siellä | Pi:n natiivi istuntohistoria, ei rinnakkaista varastoa |
| Riippuvuus palveluntarjoajasta | Daemon ei toimi ilman HumanLayerin API:a ja synkronointia; itse ajettava pino on keskeneräinen ja vaatii ulkoisia avaimia | Yksi Go-binääri ja selainpaketti; ylläpitäjä omistaa kaiken |
| Agentit | Claude Code (SDK), oma Codex-agentti, Pi ja OpenCode peilattuina | Pi natiivina |
| Terminaalissa aloitettu istunto | Pi: peilataan ensimmäisestä promptista alkaen, ohjattavissa verkosta | Luettavissa selaimessa; ohjaus vain selaimen käynnistämiin |
| Istunnon aloitus selaimesta | Kyllä (Claude, Codex); Pi:lle ei | Kyllä (Pi) |
| Ihminen silmukassa | Työkalukutsujen hyväksyntä ja säännöt; dokumenttien ja diffin kommentit agentille; vaiheistettu työtapa | Pi-kysymykset (teksti, valinta, vahvistus), Ohjaa/Lähetä-jonot, Keskeytä |
| Worktreet | Tehtäväkohtaiset, monirepo, `copyGlobs` ja asennuskomento | `git worktree` omalle haaralle, yhdistäminen agentilta, siivous |
| Rinnakkaiset agentit | Monta istuntoa per tehtävä ja host | Workerit omina riveinään (Taskfleet), Sinun vuorosi / Käynnissä |
| Pääte | Electron/Tauri macOS, verkko, puhelin verkossa | Selain työpöydällä ja puhelimessa, suomeksi |
| Lisenssi | Apache 2.0 (22.10.2026 alkaen) | — |

## Mitä Open Habitat voisi oppia (tärkein ensin)

1. **Kommentti tiedostoon tai diffiin agentille palautteeksi.** HumanLayerin keskeinen
   havainto on, että agentin aikaansaannoksia tarkistetaan hitaammin kuin niitä
   syntyy, ja ihmisen ohjaus on tehokkainta suunnitelmavaiheessa
   ([workflow-phases](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/explanation/workflow-phases.md)).
   Open Habitatin tavoite on, että käyttäjä keskustelee agentin kanssa ja seuraa sen
   työtä. Tarkka palaute ("tämä kappale väärin", "tämä rivi pois") vaatii nyt
   kopioimista ja selittämistä. **Päättely:** natiivi tapa olisi antaa käyttäjän
   valita rivejä tiedostosta tai diffistä ja kirjoittaa niihin huomautus. Selain
   koostaa huomautuksista yhden Ohjaa- tai Lähetä-viestin, jossa ovat polku,
   rivit ja teksti. Tieto kulkee Pi:n omaan historiaan, eikä erillistä
   kommenttivarastoa tarvita. HumanLayerin vaatima kommenttitaulu ja agentin
   kommenttityökalut olisivat juuri sellainen toinen totuus, jota emme rakenna.
2. **Istunnon kumulatiivinen diffi.** HumanLayer näyttää tehtävän diffin työpuuta
   vasten aloitushetken HEAD-committiin ([humanlayer-pi README](https://github.com/humanlayer/humanlayer-pi)).
   Open Habitat näyttää yksittäisen `edit`-kutsun diffinä ja yläpalkissa Gitin tilan.
   Kokonaiskuva "mitä tämä keskustelu on muuttanut" puuttuu, vaikka juuri sitä
   puhelimesta palaava käyttäjä kysyy. **Päättely:** se lasketaan Gitistä
   pyydettäessä. Aloituscommitin voi lukea Pi:n historiasta tai worktreen
   haarautumiskohdasta. Mitään ei tallenneta. Worktree-agentille vertailukohta on
   luonteva (`merge-base` lähtöhaaraan).
3. **Worktreen valmistelu: tiedostojen kopiointi ja asennuskomento.** HumanLayerin
   `copyGlobs` ja asennuskomento ([workspace-model](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/explanation/workspace-model.md))
   ratkaisevat todellisen ongelman. Uusi worktree on ilman `.env`-tiedostoa ja
   `node_modules`-hakemistoa käyttökelvoton, ja agentti kuluttaa ensimmäiset minuutit
   ympäristön korjaamiseen. Open Habitatilla on jo työtilan oma asetustiedosto
   (`.open-habitat.yaml`), joten resepti mahtuisi sinne. Se tallentuu työtilaan, ei
   palvelimelle. Ensin kannattaa tarkistaa, kattaako Taskfleetin oma worktree-valmistelu
   jo tämän. Jos kattaa, Open Habitatin pitää vain näyttää se.
4. **Salaisuuksien pitäminen poissa agentin ympäristöstä.** Pi-laajennus lukee
   `HUMANLAYER_PAT`-tunnuksen latautuessaan ja poistaa sen Pi:n ympäristöstä, jotta
   malli ja työkalut eivät näe sitä ([humanlayer-pi README](https://github.com/humanlayer/humanlayer-pi)).
   **Päättely:** Open Habitatin daemonissa sama periaate kannattaa varmistaa testillä:
   Pi:lle periytyvässä ympäristössä ei ole gatewayn, daemonin tai provisionin omia
   tunnuksia tai socket-polkuja, joita agentin ei tarvitse tietää. En tarkistanut
   nykyistä tilaa, joten tämä on tarkistettava kohta eikä todettu puute.
5. **Dokumentaation jako lukijan tavoitteen mukaan.** HumanLayerin käyttäjädokumentit
   on jaettu Diátaxis-mallin mukaan: tutoriaalit, ohjeet, selitykset ja viite. Jokaisella
   sivulla on yksi tavoite, ja verkon puuttuvat ominaisuudet sanotaan suoraan
   ([docs index](https://github.com/humanlayer/humanlayer/blob/main/apps/docs/index.md)).
   **Päättely:** Kun `docs/operations.md` kasvaa, sama jako (asennus ensimmäistä kertaa /
   yksittäinen ylläpitotehtävä / miksi näin) palvelisi ylläpitäjää. Prioriteetti on
   matala.

## Mitä Open Habitat tekee jo paremmin

- **Ihmisten välinen raja on käyttöjärjestelmässä.** HumanLayerissa toinen
  organisaation jäsen voi oikeuksien salliessa ohjata ja hyväksyä komentoja, jotka
  ajetaan toisen ihmisen tunnuksella. Raja on pilven SQL-tarkistus. Open Habitatissa
  vierasta kotihakemistoa ei voi edes nähdä.
- **Natiivi historia on ainoa historia.** HumanLayer pitää Claude-istunnoista kopion
  pilvessä, Codexin historiaa ei ole ollenkaan pilven ulkopuolella, ja Pi-peilauksessa
  sitomista edeltävä historia jää pilvestä pois. Open Habitatissa sama keskustelu näkyy
  selaimessa ja Pi:n terminaalissa, eikä kumpikaan voi jäädä jälkeen.
- **Ei riippuvuutta palveluntarjoajasta.** HumanLayerin daemon ei toimi ilman
  `riptide-api.humanlayer.com`-yhteyttä, ja itse ajettava versio vaatii Postgresin,
  Electricin ja usean kolmannen osapuolen avaimen. Open Habitat on yksi binääri yhdellä
  palvelimella.
- **Pi-istunnon aloitus ja jatkaminen selaimesta.** HumanLayerin Pi-tuki on alfa-asteen
  peilaus, eikä verkkosovellus voi käynnistää Pi-istuntoa.
- **Epävarmojen tilojen rehellisyys.** Open Habitat erottaa toisistaan katkenneen
  yhteyden, pysähtyneen agentin, kuittaamattoman lähetyksen ja tuntemattoman tilan,
  eikä lähetä epävarmaa viestiä uudelleen. HumanLayer merkitsee istunnon
  epäonnistuneeksi, kun daemon on ollut kaksi minuuttia vastaamatta.
  **Päättely:** tämä on yksinkertaisempi mutta harhaanjohtava, kun agentti on oikeasti
  yhä käynnissä.
- **Suomenkielinen käyttöliittymä, joka toimii puhelimessa ensisijaisena päätteenä.**

## Mitä ei kannata kopioida

- **Tiimin yhteistä promptausta ja toisen hyväksyntöjä.** Se rikkoisi suoraan
  periaatteen, että Unix-tunnus on raja. Toisen ihmisen viesti ajettaisiin minun
  avaimillani. Jos yhteistyötä joskus tarvitaan, oikea muoto on jaettu repo ja kummankin
  oma agentti omalla tunnuksellaan.
- **Työkalukutsujen hyväksyntäkerrosta ja sääntövarastoa.** Pi:llä ei ole Clauden
  kaltaista lupajärjestelmää. Open Habitatiin rakennettu hyväksyntä olisi oma auktoriteetti
  ja oma tila natiivin rinnalla. Pi-kysymykset (vahvistus) ja Keskeytä kattavat tarpeen
  natiivisti. Jos Pi saa myöhemmin oman lupamallin, sen esittäminen on eri asia.
- **Pilveen synkronoitua tapahtuma- ja dokumenttivarastoa** (Postgres + Electric).
  Se on juuri se rinnakkainen totuus, jota periaatteemme kieltävät, ja se toisi
  HumanLayerin ongelmat mukanaan: "file does not upload only because another program
  placed it in the directory".
- **Omaa agenttiajoa natiivin CLI:n tilalle** (HumanLayerin Codex). Se irrottaa käyttäjän
  natiivista historiasta ja asetuksista ja tekee tuotteesta agentin ylläpitäjän.
- **Tehtäviä istuntojen yläpuolisena rekisterinä ja valmiiksi upotettuja RPI-taitoja.**
  Tehtävä- ja vaihemalli kuuluu käyttäjän omiin taitoihin ja issue-työkaluihin (Jarin
  issuectl ja Taskfleet), ei hostiin. Tuotteeseen kovakoodattu työtapa on
  HumanLayerin liiketoiminnan ydin, ei meidän.
- **Organisaatioita, tiimejä, laskutusta ja Electron-sovellusta.** Näille ei ole tarvetta
  yhden palvelimen tuotteessa, joka toimii selaimessa.
