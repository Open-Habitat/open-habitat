# Agentin Open Habitat CLI: mitä sen pitäisi osata?

Ideointipohja Jarille. Inventaario kerättiin 20.10.2026 puusta `4be7a622`;
löydökset ja issue-statukset tarkistettiin uudelleen 21.10.2026 `main`-puusta.
Ei toteutuspäätös.

## Ongelma

Kiintiötestissä 20.10. agentti sai tietää täydestä levystä vasta `dd`:n
virheestä, eikä sillä ollut mitään kanavaa kertoa esteestä ihmiselle.
Yleisemmin: agentilla ei ole tapaa lukea oman ympäristönsä tilaa (kiintiö,
integraatiot, keskustelut, työtilat) eikä tehdä selaimen toimintoja ihmisen
puolesta. Sen ainoa kanava hostiin on julkaisun mukana tuleva host context ja
yksittäiset Pi-työkalut.

## Mitä on päätetty

Jari 20.10.2026 (issue @agent-cli):

- CLI on agentin **kattava** rajapinta kaikkeen järjestelmän tietoon ja
  toimintoihin, omasta aloitteesta tai ihmisen puolesta. Ei minimisiivu;
  ensimmäinen pala on vain kattavan pinnan järjestys.
- Se kuljettaa myös ad hoc -varoitukset ja -ilmoitukset ympäristön, agentin ja
  ihmisen välillä (esimerkiksi kiintiö täynnä).
- Se ajaa ihmisen omana Unix-käyttäjänä omaa daemon-socketia vasten, ilman
  uutta identiteettivaltaa, ja noudattaa AI-first CLI -kanonia.
- Järjestys: tämä inventaario → Jarin rajaus- ja valtapäätökset ADR:ksi →
  toteutusissuet.

## Kaksi löydöstä koodista

1. **Daemonin pääsocket hyväksyy vain gatewayn UID:n** (`TrustedPeer`,
   `guardListener.Accept`). Oman käyttäjän CLI tarvitsee erikseen päätetyn
   sisääntuloreitin. Yksi ennakkotapaus on jo olemassa: local-files-access toi
   jokaisen Pi-prosessin yksityiseen 0700-hakemistoon keskustelukohtaisen
   `local-files.sock`-kuuntelijan, jota Pi:n `local_files`-työkalu käyttää
   (`internal/daemon/local_files_linux.go`). Päätös on siis: laajennetaanko
   tätä keskustelukohtaista sockettia vai avataanko daemoniin yleinen oman
   UID:n reitti, jonka kutsuja tunnistetaan kernelin peer-UID:stä. [1]
2. **Kaikki selainominaisuudet eivät ole daemonissa.** Kirjautuminen, laitteet
   ja istunnot, palvelimen tiedot, ylläpito ja tämänhetkinen kiintiöluku
   kuuluvat gatewaylle tai brokerille. Niitä ei voi luvata saman daemon-API:n
   kautta sellaisenaan; kiintiölle tarvitaan oma päätös lähteestä. [2]

## 1. Inventaario: mitä ihminen voi tehdä nyt

Taulukot kattavat tuotantokäyttöliittymän toiminnot revision `4be7a622`
sopimuksista ja kutsupaikoista. Storybook-kokeilut ja `command.schema.json`:n
enumit, joilla ei ole UI-painiketta (esim. `workspace.git.integrate`), eivät
ole mukana.

Sarake *Agentille* on kirjoittajan ehdotus, ei päätös. Arvot: **CLI** =
järkevä CLI-toiminto (verbi noun-verb-muodossa), **natiivi** = nykyinen
työkalu (`git`, `gh`, `taskfleet`, shell) riittää, **selain** = ihmisen
selainpäätös; CLI voi korkeintaan pyytää sitä. `W` = työtila, `C` =
keskustelu, `E` = listauksesta saatu tunniste. Lippujen tarkka muoto päätetään
toteutuksessa kanonin mukaan.

Sopimus-sarakkeen etuliitteet: `API` = `/api/v1`, `K` = `API/conversations/{id}`,
`T` = `API/workspaces`; reitin perässä oleva sana on requestin `action`. [3]

### Työtilat ja GitHub-tuonti [3–5]

| Ihmisen teko | Nykyinen operaatio | Agentille |
|---|---|---|
| Listaa, suodata, avaa työtila; näytä polku ja keskustelut | `GET API/snapshot` | CLI: `workspace list`, `workspace show W` |
| Luo hakemisto, halutessaan Gitillä | `POST T` `create`, `git` | CLI: `workspace create` |
| Vaihda näyttönimi; piilota / palauta | `POST T` `settings`, `visibility` | CLI: `workspace update W` |
| Selaa GitHub-repoja; tarkista repo ja paikallinen checkout | `GET API/onboarding/github/{repos,repository,checkout}` | CLI: `repository list`, `repository show`; yksityisten repojen nimet, ei tunnuksia |
| Kloonaa (koko historia tai blobless), seuraa, keskeytä, käynnistä uudelleen, kuittaa | `POST API/onboarding/github/clones` `start`/`cancel`/`restart`/`dismiss`/`remove`; `GET …/events` | CLI tai natiivi `gh`/`git`: `clone create/show/cancel/restart/delete`. Keskeytyneen tuonnin jäänteen poisto on tiedostojen poisto, ei kuittaus |

### Keskustelut ja agentin ohjaus [6]

| Ihmisen teko | Nykyinen operaatio | Agentille |
|---|---|---|
| Listaa keskustelut ja tila | Snapshot, `GET API/conversations`, `GET K/status`, SSE `API/events` | CLI: `conversation list`, `conversation show C`; luku ei käynnistä Pi:tä |
| Lue historiaa ja isoja työkalutuloksia | `GET API/agents/{id}/history`, `…/entries/{key}/blocks/{index}` | CLI: `history list --output FILE` (kanoni §13) |
| Luo keskustelu, valitse malli ja ajattelutaso | `POST API/conversations` | CLI: `conversation create`; käynnistää Pi-prosessin |
| Lähetä viesti; tarkista kuittaus | `POST K/send`, `GET K/receipt` | CLI: `message create`, `receipt show`; käynnistää työtä toisessa omassa keskustelussa |
| Ohjaa käynnissä olevaa vuoroa / jonota seuraava | `POST K/steer`, `K/follow_up` | CLI: `message create --delivery steer\|follow-up` |
| Tyhjennä jono tai peru pidetyt viestit | `POST K/clear_queue`, `K/cancel_held` | CLI: `queue delete`; hävittää lähetysaikeen |
| Jatka natiivia keskustelua; tarkista ehdot | `GET K/eligibility`, `POST K/continue` | CLI: `conversation resume C`; yksi kirjoittaja per keskustelu |
| Keskeytä vuoro / pysäytä Pi | `POST K/abort`, `K/stop` | CLI: `turn interrupt`, `conversation stop` |
| Vastaa Pi:n kysymykseen, valitse vaihtoehto, peru | `POST K/question` | Selain. Agentti ei vastaa omaan hyväksyntäpyyntöönsä; `question show` voi olla lukua varten |
| Arkistoi / palauta; sulje tyhjä keskustelu | `POST T` `conversation_archive`; `POST K/close` | CLI: `conversation update`, `conversation delete --empty-only` |
| Generoi otsikko tai yhteenveto; lue yhteenveto | `POST K/regenerate_title`, `K/history_title`, `K/recap`; `GET API/agents/{id}/recap` | CLI: `title generate`, `recap show/generate`; mallikutsu |
| `/`-komennot, skillit, `@`-tiedostot ja esikatselu | `GET K/commands`, `T/commands`, `T/files`, `T/file_preview` | Natiivi ensin; `command list`, `file list` tarvittaessa |
| `!`/`!!`-komento ja sen keskeytys | `POST K/bash`, `K/abort_bash` | Natiivi shell |
| Prosessit: listaa, tuloste, pysäytä, siivoa | `GET K/processes`, `…/output`; `POST …/stop`, `…/clear-finished` | CLI tarvittaessa: `process list/show/stop/delete`; owner-generation ja process-token säilytettävä |

Kopiointi, haku, vierityspaikka, korttien avaaminen, ajattelutekstin näyttö,
luonnos ja näkymän vaihto ovat paikallista esitystä ilman palvelinoperaatiota.

### Worktree-agentit ja spinoffit [7]

| Ihmisen teko | Nykyinen operaatio | Agentille |
|---|---|---|
| Aloita rinnakkainen worktree-keskustelu | `POST API/conversations` `new_worktree` | CLI: `conversation create --worktree`; ei Taskfleet-spinoff |
| Listaa worktreet | `POST T` `worktree_list` | CLI: `worktree list` |
| Poista worktree (remove / commit / force / prune); siivoa yhdistetyt | `POST T` `worktree_remove`, `worktree_clean_merged` + listing-token | CLI: `worktree delete`; force ja bulk-siivous ihmisen kautta, tuore listing-token vaaditaan |
| Näytä spinoffit, tila, tuloste, historia | `GET API/agents/{id}/spinoffs`, SSE, snapshot/history | CLI lukuna: `spinoff list`; hallinta natiivilla `taskfleet` |
| Yhdistä worktree, käynnistä tai yhdistä spinoff | Ei UI-ohjainta | Natiivi `git` / `taskfleet` |

Työ toisessa omassa työtilassa on jo ratkaistu ilman CLI:tä: host context
kertoo rinnakkaiset repot ja `taskfleet run create` kohderepossa, ja selain
näyttää ajon molemmissa paikoissa (@cross-workspace-agents, valmis 20.10.).
CLI:n `workspace list` korvaa polkujen arvailun, ei ajomoottoria.

### Git-paneeli [4, 8]

| Ihmisen teko | Nykyinen operaatio | Agentille |
|---|---|---|
| Lue tila, muutokset, ahead/behind, vertailuhaara, commitit | `GET T/git`, snapshotin `git_summary` | CLI tai natiivi: `git show --workspace W` |
| Hae etätiedot | `POST T/git/fetch` | Natiivi `git fetch` |
| Luo GitHub-repo tai liitä tyhjä repo originiksi ja työnnä | `GET/POST T/github/publish` (vaihe + observation-token + vahvistus) | Natiivi `gh`/`git`; CLI:ssä korkeintaan hyväksyntäpyyntö ihmiselle |

### Roskakori ja tallennustila [9]

| Ihmisen teko | Nykyinen operaatio | Agentille |
|---|---|---|
| Tarkista poistoehdot; siirrä roskiin / poista puhdas työnnetty klooni | `POST T` `delete_check`, `delete` | CLI: tarkistus `workspace show --deletion`; poisto ihmisen hyväksynnällä |
| Listaa ja tarkista roskakori; palauta | `POST T` `trash_list`, `trash_inspect`, `trash_restore` | CLI: `trash list/show/restore`; ei päällekirjoitusta |
| Poista pysyvästi; tyhjennä roskakori | `POST T` `trash_delete`, `trash_empty` | Selain; CLI luo hyväksyntäpyynnön |
| Näytä oma käyttö ja raja | `GET API/account/storage` | CLI: `environment show`; **lähde on gateway → broker**, ei daemon [2] |

### Integraatiot, asetukset, mallit ja tunnistautuminen [10–12]

| Ihmisen teko | Nykyinen operaatio | Agentille |
|---|---|---|
| Näytä palvelut, yhdistetyt tilit, synkronointi, kirjautumisen tila | `GET API/integrations`, `…/login` | CLI: `integration list`; osoitteet ja polut, ei token-arvoja |
| Yhdistä OAuth-tili, valitse kansiot, peru; lisää/poista IMAP-tili, vaihda salasana | `POST/PUT/DELETE API/integrations/login`, `…/accounts` | Selain; myöhemmin pyyntö ihmiselle, ei salaisuuksia argumentteihin |
| Pi-kirjautumiset (OpenAI device, Claude-linkki); OpenAI-avaimen tila ja muutos | `API/onboarding/pi/*`, `API/pi/claude-login`, `API/pi/credentials` | Selain; CLI vain läsnäolotieto `provider list` |
| Listaa mallit, vaihda oletusmalli ja ajattelutaso | `GET/PUT API/pi/models` | CLI: `model list`, `model update`; koskee tulevia keskusteluja |
| Gitin globaali nimi ja sähköposti | `GET/PUT API/account/git-identity` | CLI tai natiivi `git config` |
| Täydennä profiilin nimi/email | `POST /auth/profile` | Selain; gatewayn tietoa |
| GitHub-kirjautuminen, uudelleenyhdistys, katkaisu, uloskirjautuminen | `/auth/github/start`, `/auth/logout`, `API/account/github/disconnect` | Selain |
| Laitteet ja istunnot, QR-linkin luonti ja hyväksyntä, istunnon päättäminen | `/auth/sessions*`, `/auth/link*` | Selain; gatewayn valta, ei agentille |
| Palvelimen nimi ja versio; selaimen päivitys | `GET API/server` | CLI versiotiedoksi `environment show`; gateway-tieto [2] |

### Editori, pääte ja liitteet [13]

| Ihmisen teko | Nykyinen operaatio | Agentille |
|---|---|---|
| Avaa editori tiedostoon/riville; muokkaa, tallenna | `GET API/editor`, `POST API/editor/open`, code-server-relay | Natiivit tiedostotyökalut; editorilippu ei agentille |
| tmux-shellit: listaa, avaa, luo, sulje | `GET T/terminals`, WS `T/terminal`, `POST T/terminals/close` | Natiivi shell/tmux |
| Taskfleet-pääte | Sama WS, Taskfleet-token | Natiivi Taskfleet, lukuna |
| Lisää, lähetä, näytä ja lataa liite | `POST API/attachments`, `K/send`, `GET API/attachments/{id}` | Natiivi tiedoston luku; `attachment create` vain jos hostiin rekisteröinti tarpeen |
| Listaa ihmisen antama paikallinen kansio, hae tiedosto | Pi-työkalu `local_files` keskustelukohtaisen socketin kautta | Jo olemassa Pi:lle (@local-files-access, valmis). CLI:nä sama operaatio muista prosesseista: `local-file list/fetch` |

### Vain ylläpitäjälle [2, 14]

| Ihmisen teko | Nykyinen operaatio | Agentille |
|---|---|---|
| Käyttäjät, roolit, palvelimen nimi, oletuskiintiö; käyttäjien kiintiöt ja levyn tila | `GET/PUT API/server/administration`, `…/storage` | **Ei agent-CLI:tä.** Root-operaattorilla on jo `open-habitat admin …`; web-admin ei tee Pi-prosessista adminia |

## 2. Agentille erityisesti hyödylliset uudet kyvyt

Ehdotuksia, ei nykyisiä operaatioita. [15]

| Tarve | Ehdotus | Mitä puuttuu |
|---|---|---|
| Agentti kertoo esteestä tai valmistumisesta | `notice create --conversation C --level warning` | Notice-sopimus ja UI-paikka keskustelussa. Alkuperä näkyviin: agentin viesti, ei järjestelmähälytys |
| Agentti lukee ympäristön tilan ennen virhettä | `environment show`; `notice list` | Kiintiön lähde (gateway/broker). Pelkkä luku ei herätä agenttia; proaktiivinen heräte on hook, joka toteutetaan erikseen |
| Agentti pyytää ihmiseltä päätöksen | `request create --kind confirmation`; `request show R` | Yleinen pyyntökortti. Pi:n kysymyskulku on olemassa, mutta suojatun operaation hyväksyntä on eri asia |
| Agentti tietää oman keskustelunsa | `conversation show --current` | Launch-konteksti (workspace, conversation, cwd, parent/run), ei "uusin istunto" -heuristiikka |

Notice ei tarvitse uutta pysyvää ilmoitustietokantaa: ehdotus on tallentaa se
natiivina Pi-merkintänä ja jakaa nykyisellä tapahtumavirralla. Täysi levy
-hälytyksen on päästävä perille myös silloin, kun historiariviä ei voi
kirjoittaa, joten se ei voi nojata onnistuneeseen notice-tallennukseen.
Vanhentunut tai puuttuva havainto ei ole "kaikki kunnossa".

## 3. Valta: mitä "oma Unix-käyttäjä" tarkoittaa

Suositus: ei uutta identiteettivaltaa, mutta uusi sisääntuloreitti, joka
käyttää samoja operaatioita ja tarkistuksia kuin selain ja tunnistaa kutsujan
peer-UID:stä. Nykyistä gateway-only-tarkistusta ei voi vain muuttaa muotoon
"gateway tai omistaja" kaikilla reiteillä: token-handoff, editoriliput,
istunnot ja ylläpito jäävät gatewaylle. [1]

| Agentti suoraan | Ihmisen selainpäätös | Ei koskaan tämän CLI:n kautta |
|---|---|---|
| Oman tilan luku; sovitut työtila- ja keskustelutoimet; natiivit työkalut | Pysyvä poisto ja force-siivous; tunnusten ja yhteyksien muutokset; ulkoinen julkaisu; paikalliskansion lupa | Muiden käyttäjien kodit, agentit, socketit tai käyttäjälistat; root/broker-komennot; raakakredentiaalit; selainistunnon tai editorilipun luonti |

Selainvahvistus on vahinkoja ehkäisevä työtapa, ei hiekkalaatikko: sama
agentti voi shellillä poistaa omia tiedostoja tai lukea natiivien työkalujen
tunnustiedostoja. Aidosti agentilta suojattu hyväksyntä vaatisi erillisen
luottamusrajan, ei `--yes`-lippua tai agentin itse tuottamaa "käyttäjä
hyväksyi" -tekstiä. [1, 16]

Prompt-injektio voi tulla reposta, liitteestä, sähköpostista tai toisen
keskustelun tekstistä; ne ovat dataa, eivät lupia. Pyyntö sidotaan tarkkaan
kohteeseen ja tuoreeseen havaintoon. Toisen oman keskustelun ohjaus vaatii
aina eksplisiittisen `--conversation C`. Puuttuva kuittaus tai 503 ei oikeuta
lähettämään samaa työtä uudella tunnisteella. [6, 16]

## 4. Kanoni ja nykyinen CLI-pinta

Ehdotettu pinta on `open-habitat agent …` samassa binäärissä: se erottaa
henkilökohtaisen pinnan root-operaattorin `admin`-komennoista ja jakaa
daemonin ja selaimen toimintototeutukset. CLI ei kirjoita omaa työtila-,
historia-, tunnus- tai Taskfleet-rekisteriä eikä kopioi `git`-, `gh`- tai
`taskfleet`-komentoja. Löydettävyys: host context ohjaa `skill print agent`
-ohjeeseen ja `--help --json`:iin; skill opettaa työnkulut, ei toista
API-kuvausta. [14, 17]

Pinta noudattaa kanonia (`/ai-first-cli-canon`, v4) sellaisenaan; sitä ei
toisteta tässä. Agenttipinnalle painavimmat pykälät: §6–7 noun-verb ja yksi
verbisanasto, §11 dry-run ja idempotenssi, §12 pitkät operaatiot (ID +
`show` tai JSONL-virta), §13 isot tulosteet tiedostoon, §14 porautuva
`--help --json` esimerkkeineen.

`project-canon review --profile cli --run <binary>` ajettiin 21.10.2026
(project-canon 0.9.3) nykyistä binääriä vasten. Agenttipinta perii nämä
aukot, ja ne kannattaa korjata samassa yhteydessä:

| § | Havainto |
|---|---|
| §14 | `--help` on aina JSON ja listaa vain alikomennot; ei `examples[]`, ei `command_path`, ei alikomentokohtaista porautumista lippuineen ja exit-koodeineen |
| §2 | Ohje ei kerro exit-koodeja 0/1/2 |
| §8, §18 | `config path --json` ja `doctor --json` vaativat `--component` ja palauttavat exit 0 virhekääreellä; kanoni odottaa paljaan muodon toimivan ja virheen olevan exit 1 |
| §24 | Kaksi lykkäysviitettä nimeää ratkaisemattoman paikallisen issuen (`issues/enormously-light-fall/result.md:39`, `issues/proc-hidepid/item.md:117`) |

Tarkistimen ilmoittamat §10 ja §15–17 -aukot eivät pidä paikkaansa: `version
--json` ja `skill list --json` sisältävät vaaditut kentät `data`-kääreen alla,
jota anturi ei lue. `CONFORMANCE.md`:n läpäisymerkinnät pysyvät voimassa, mutta
ne koskevat operaattoripintaa; agenttipinta tarkistetaan erikseen samalla
komennolla ja `/cli-canon`-skillillä.

## 5. Ensimmäinen pala järjestyksenä

Kattavan pinnan ensimmäinen pala on agentin tilannekuva ja viesti ihmiselle:

| Komento | Miksi ensimmäisenä |
|---|---|
| `environment show` | Kiintiö, tila ja integraatioiden saatavuus; tuntematon merkitään tuntemattomaksi, ei nollaksi |
| `workspace list` | Rinnakkaiset repot ilman polkujen arvailua |
| `conversation show --current` | Mihin pyyntö tai notice kuuluu |
| `notice create` | Ad hoc -este ihmiselle keskustelun yhteyteen |
| `notice list` | Ympäristön ja oman keskustelun ajankohtaiset huomiot |

Palaan kuuluvat sisääntuloreitti, notice-merkinnän natiivi muoto, UI-paikka ja
sopimustestit. Poistot, tunnusmuutokset ja toisten keskustelujen ohjaus tulevat
myöhemmissä paloissa.

## Jarilta tarvittavat ratkaisut

1. **Sisääntuloreitti:** laajennetaanko keskustelukohtaista `local-files.sock`-
   mallia vai avataanko daemoniin yleinen oman UID:n reitti ilman gatewayn
   istunto-, tunnus- ja admin-valtaa? Suositus: yleinen reitti, koska CLI:n
   pitää toimia myös muista saman käyttäjän prosesseista kuin Pi:stä; ADR
   ennen toteutusta.
2. **Saako agentti ohjata muita omia keskusteluja ja vaihtaa globaaleja
   oletuksia?** Suositus: myöhemmin, vain eksplisiittisellä kohteella.
3. **Mihin notice jää ja milloin se vanhenee?** Suositus: keskustelun
   yhteyteen, alkuperä ja aikaleima näkyvissä, ei globaalia inboxia. Kuittaus
   vai nykytilaan perustuva poistuminen?
4. **Mitkä teot vaativat selainvahvistuksen?** Suositus: pysyvä ja force-poisto,
   tunnusmuutokset, julkaisu. Admin-toimet jäävät kokonaan erilleen.
5. **Riittääkö ensimmäisessä palassa kysyttäessä luettava ympäristön tila?**
   Suositus: kyllä; proaktiivinen quota/restart-heräte seuraavaksi, ellei
   ennen virhettä tuleva varoitus ole välttämätön heti.

## Lähteet

Tämän revision sopimukset ja tuotantokoodi; HTTP-muodot tarkistettu UI:n
kutsupaikoista ja handlerien mounttauksesta.

1. [Transport: TrustedPeer, guardListener.Accept](../../internal/transport/transport_linux.go), [daemonin reittikytkentä](../../internal/daemon/handoff_linux.go), [paikallistiedostojen socket](../../internal/daemon/local_files_linux.go), [sopimusskenaariot CT-001/002](../../contracts/v1/scenarios.json).
2. [Gateway-reitit](../../internal/gateway/server.go), [quota: quotaHTTP ja BrokerQuota](../../internal/gateway/quota.go).
3. [Selain/host-sopimukset](../../contracts/v1/), erityisesti `snapshot`, `command`, `operation`, `workspace-change`, `github-clone` ja `pi-conversation-create`.
4. [Työtilan UI](../../web/src/app/WorkspacePage.tsx), [luonti](../../web/src/app/NewWorkspacePage.tsx), [muutokset](../../web/src/app/workspaceWrites.ts), [työtilahandler](../../internal/daemon/workspace_manage_linux.go).
5. [GitHub-kutsut](../../web/src/app/github.ts), [clone-job-sopimus](../../contracts/v1/github-clone.schema.json).
6. [Keskustelun kutsut](../../web/src/app/conversations.ts), [toiminnot](../../web/src/app/ConversationActions.tsx), [tuotantonäkymä](../../web/src/app/BrowserConversation.tsx), [prosessit](../../web/src/app/processes.ts), [composerin luvut](../../web/src/app/composerReads.ts), [historian luku](../../web/src/app/HistoryView.tsx).
7. [Worktree-kutsut](../../web/src/app/workspaceWorktrees.ts), [siivousnäkymä](../../web/src/app/WorktreeCleanup.tsx), [spinoffit](../../web/src/app/spinoffs.ts), [worktree-sopimus](../../contracts/v1/workspace-worktrees.schema.json).
8. [Git-tilan UI](../../web/src/app/ConversationGitStatus.tsx), [Git-kutsut](../../web/src/app/workspaceGit.ts), [GitHub-julkaisu](../../web/src/app/WorkspaceGitHub.tsx).
9. [Poisto/Trash-kutsut](../../web/src/app/workspaceTrash.ts), [tallennustilan näkymä](../../web/src/app/PersonalStorage.tsx), [quota-kutsut](../../web/src/app/storageQuota.ts), [poistosopimus](../../contracts/v1/workspace-deletion.schema.json).
10. [Integraatiokutsut](../../web/src/app/integrations.ts), [tilit](../../contracts/v1/integration-account.schema.json), [login-ohjaus](../../contracts/v1/integration-login-control.schema.json).
11. [Pi-onboarding](../../web/src/app/pi.ts), [avaimet](../../web/src/app/PiCredentials.tsx), [Claude-login](../../web/src/app/ClaudeSignIn.tsx), [mallit](../../web/src/app/PiModels.tsx), [Git-identiteetti](../../web/src/app/GitIdentity.tsx).
12. [Laitelinkit ja istunnot](../../web/src/app/deviceLink.ts), [profiili](../../web/src/app/AccountProfileOnboarding.tsx), [palvelintiedot](../../web/src/app/serverAdministration.ts), [sovelluksen toiminnot](../../web/src/app/App.tsx).
13. [Editorikutsut](../../web/src/app/editor.ts), [päätekutsut](../../web/src/app/terminals.ts), [selainpääte](../../web/src/app/BrowserShell.tsx), [liitteet](../../web/src/app/attachments.ts), [liitesopimus](../../contracts/v1/attachments.schema.json), [host context: local_files](../../internal/daemon/host-context.md).
14. [CONFORMANCE.md](../../CONFORMANCE.md), [ylläpitonäkymä](../../web/src/app/ServerAdministration.tsx), [hallintasopimus](../../contracts/v1/server-administration-change.schema.json), [kiintiömuutos](../../contracts/v1/server-storage-change.schema.json).
15. Issuet 21.10.2026: @agent-cli (open), @local-files-access (done), @cross-workspace-agents (done), @quota-full-experience (fixed; agenttipuolen ilmoitukset siirretty tähän), @composer-attachments (done), @agent-host-context (done).
16. [Järjestelmän rajat](../../AGENTS.md), [sisäiset auktoriteetit ja natiivi totuus](../../internal/AGENTS.md).
17. [Julkaisun agenttikonteksti](../../internal/daemon/host-context.md), [kontekstin testit](../../internal/daemon/host_context_linux_test.go).
18. `/ai-first-cli-canon` (canon v4, `project-canon` 0.9.3) ja `project-canon review --profile cli --run .cache/canon/open-habitat --json .`, ajettu 21.10.2026 commitista `bdd0de0a`.
