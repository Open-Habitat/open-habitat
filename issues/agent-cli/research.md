# Agentin Open Habitat CLI: mitä sen pitäisi osata?

Ideointipohja Jarille, 20.10.2026. Ei toteutuspäätös.
Lähdepuu: `4be7a622b25dba3ca840606c70de8323234b24c8`.

**Suositus:** aloitetaan agentin tilannekuvasta ja viesteistä ihmiselle, ei koko
käyttöliittymän kauko-ohjaimesta. Tavallinen tiedostotyö, Git ja Taskfleet pysyvät
omilla työkaluillaan. Inventaario alla näyttää myös laajemman mahdollisen pinnan.

Kaksi olennaista löydöstä:

- **Oma daemon-socket ei vielä hyväksy oman käyttäjän CLI:tä.** Nykyinen listener
  hyväksyy vain gatewayn UID:n. CLI tarvitsee erikseen päätetyn paikallisen
  kutsujan reitin; pelkkä HTTP-kääre ei riitä. [1]
- **Kaikki selainominaisuudet eivät ole daemonissa.** Kirjautuminen, laitteet,
  palvelimen tiedot, ylläpito ja tämänhetkinen kiintiöluku kuuluvat gatewaylle
  tai brokerille. Niitä ei voi luvata saman daemon-API:n kautta sellaisenaan. [2]

## 1. Mitä ihminen voi tehdä nyt?

`oh` tarkoittaa taulukoissa ehdotettua etuliitettä `open-habitat agent`, ei uutta
binääriä eikä olemassa olevaa komentoa. Kaikki CLI-muodot ovat ehdotuksia.
`W` = työtila-ID, `C` = keskustelu-ID, `E` = listauksesta saatu entry/token.
**Kyllä** = järkevä CLI-toiminto, **natiivi** = käytä ensisijaisesti nykyistä
työkalua, **selain** = ei suoraa agenttitoimintoa; CLI voi myöhemmin pyytää ihmistä.

Sopimus-sarake nimeää nykyisen reitin ja/tai operaation. Yhteiset etuliitteet:
`API` = `/api/v1`, `K` = `API/conversations/{id}`, `T` = `API/workspaces`.
Reitin perässä oleva sana on requestin `action`, ellei metodia ole mainittu.
`command.schema.json` sisältää myös laajemman komentoluettelon: esimerkiksi
`workspace.git.integrate` ja `workspace.taskfleet_worktree.create` **eivät ole
nykyisiä UI-painikkeita**. Pelkkää enum-arvoa ei ole laskettu toiminnoksi. [3]

### Työtilat ja GitHub-tuonti [3–5]

| Ihmisen teko | Nykyinen sopimus/operaatio | CLI ja ehdotettu muoto | Riski |
|---|---|---|---|
| Listaa, suodata, avaa työtila; näytä polku ja keskustelut | `GET API/snapshot` | Kyllä: `oh workspace list`, `show W` | Oman käyttäjän projektien nimet ja polut |
| Luo hakemisto, halutessaan Gitillä | `POST T`, `create`, `git` | Kyllä: `oh workspace create --name N --git` | Levytila; uusi repo |
| Vaihda näyttönimi | `POST T`, `settings` | Kyllä: `oh workspace update W --display-name N` | Ei hakemiston uudelleennimeäminen |
| Piilota / palauta näkyviin | `POST T`, `visibility` | Kyllä: `oh workspace update W --hidden true|false` | Muuttaa kaikkien omien selainvälilehtien näkymää, ei poista |
| Selaa/hakee GitHub-repoja; tarkista repo ja paikallinen checkout | `GET API/onboarding/github/{repos,repository,checkout}` | Kyllä: `oh repository list`, `show OWNER/REPO` | Yksityisten repojen nimet; ei tunnuksia |
| Kloonaa koko historia tai kevyesti (blobless); seuraa etenemistä | `POST API/onboarding/github/clones`, `start`; GET + `/events` | Kyllä, myös `gh`/`git`: `oh clone create --repository R --mode M`; `oh clone show J` | Verkko, levytila; historia-asetus vaikuttaa tulokseen |
| Keskeytä / käynnistä kloonaus uudelleen | Sama, `cancel` / `restart` | Kyllä: `oh clone cancel J`, `restart J` | Cancel poistaa luomansa hakemiston, restart poistaa tunnistetun jäänteen; poisto voi jäädä osittaiseksi |
| Kuittaa valmis kloonaustyö; poista keskeytyneen tuonnin jäänne | Sama, `dismiss` / `remove` | Kyllä: `oh clone delete J --record-only`; `oh clone delete --interrupted OWNER/REPO` ensin pyyntönä ihmiselle | Työn kuittaus eri asia kuin tiedostojen poisto |

### Keskustelut ja agentin ohjaus [6]

| Ihmisen teko | Nykyinen sopimus/operaatio | CLI ja ehdotettu muoto | Riski |
|---|---|---|---|
| Listaa keskustelut ja tila; päivitä yhteys | Snapshot, `GET API/conversations`, `GET K/status`, SSE `API/events` | Kyllä: `oh conversation list --workspace W`, `show C` | Toisten **omien** keskustelujen sisältö; lukeminen ei käynnistä Pi:tä |
| Lue historiaa, vanhempia viestejä ja isoja työkalutuloksia | `GET API/agents/{id}/history`; `/entries/{key}/blocks/{index}` | Kyllä: `oh history list --conversation C --output history.jsonl` | Sisältö ja mahdolliset käyttäjän tekstiin kopioimat salaisuudet |
| Luo keskustelu, valitse ensimmäinen malli/ajattelutaso | `POST API/conversations`, `pi-conversation-create` / `pi-startup-choice` | Kyllä: `oh conversation create --workspace W --model M --thinking high` | Pi-prosessi, kustannus, kapasiteetti |
| Lähetä viesti; tarkista alkuperäisen lähetyksen kuittaus | `POST K/send`, `GET K/receipt?command_id=…` | Kyllä: `oh message create --conversation C --body-file -`; `oh receipt show ID --conversation C` | Käynnistää työtä; voi tehdä mitä tahansa UID sallii |
| Ohjaa käynnissä olevaa vuoroa / jonota seuraava viesti | `POST K/steer`, `/follow_up` | Kyllä: `oh message create --conversation C --delivery steer|follow-up --body-file -` | Muuttaa toisen omankin keskustelun tehtävää |
| Tyhjennä Pi-jono tai peru ennen Pi:n käynnistymistä pidetyt viestit | `POST K/clear_queue`, `/cancel_held` | Kyllä: `oh queue delete --conversation C --scope native|held` | Hävittää lähetysaikeen; palauta vain kuitatut tekstit |
| Jatka kelvollista natiivia keskustelua; tarkista jatkamisen ehdot | `GET K/eligibility`, `POST K/continue` | Kyllä: `oh conversation resume C` | Yksi kirjoittaja; ei käynnissä olevan pääte-Pi:n kaappausta |
| Keskeytä vuoro / pysäytä Pi | `POST K/abort`, `/stop` | Kyllä: `oh turn interrupt --conversation C`; `oh conversation stop C` | Keskeneräiset työkalut; pysähtymiskuittaus ei todista kaikkien vaikutusten loppumista |
| Vastaa Pi:n kysymykseen, valitse vaihtoehto, peru kysymys | `POST K/question`; `pending_question` tilassa | Selain ihmiskysymyksille; mahdollinen `oh question show --conversation C` | Agentti ei saa vastata omaan hyväksyntäpyyntöönsä |
| Arkistoi / palauta keskustelu | `POST T`, `conversation_archive`, `archived` | Kyllä: `oh conversation update C --archived true|false` | Ei vapauta levytilaa; näkymämuutos |
| Sulje tyhjä keskustelu | `POST K/close` | Kyllä: `oh conversation delete C --empty-only` | Vain todistetusti tyhjä; ei yleinen historian poisto |
| Generoi otsikko uudelleen, myös natiiville historialle | `POST K/regenerate_title`, `/history_title` | Kyllä: `oh title generate --conversation C` | Mallikutsu ja otsikkomuutos; ei vapaa käsin nimeäminen |
| Lue / generoi yhteenveto | `GET API/agents/{id}/recap`, `POST K/recap` | Kyllä: `oh recap show --conversation C`, `generate --conversation C` | Mallikutsu; yhteenveto ei korvaa historiaa |
| Kirjoita `/`-komento tai liitä skill/prompt; selaa `@`-tiedostoja ja esikatselua | `GET K/commands`, `T/commands`, `T/files`, `T/file_preview`; lähetys `/send` | Natiivi ensin; tarvittaessa `oh command list --conversation C`, `oh file list --workspace W` | Prompt/skill/tiedosto on aineistoa, ei uusi valtuutus |
| Suorita `!` / `!!`-komento, keskeytä se | `POST K/bash`, `/abort_bash`; `composer` | Natiivi shell ensin; erityistarpeessa `oh bash exec --conversation C --command-file - --exclude-from-context` | Mielivaltainen UID:n shell; `!!` jättää kontekstin ulkopuolelle |
| Katso prosessit ja niiden tulosteet, pysäytä/force, tyhjennä valmistuneet | `GET K/processes`, `/{process}/output`; POST `/{process}/stop`, `/clear-finished` | Kyllä tarvittaessa: `oh process list`, `show P`, `stop P --force`, `delete --finished` (aina `--conversation C`) | Väärä prosessi voi pysähtyä: owner-generation + process-token säilytettävä |

Kopiointi, haku/suodatus, vierityspaikka, korttien avaaminen, ajattelutekstin
näyttäminen, luonnos ja näkymän vaihtaminen ovat paikallista esitystä. Niille ei
tarvita palvelinoperaatiota tai CLI-vastinetta. Uuden mallin valinta jo käytetyn
keskustelun sijaan voi luoda uuden keskustelun; globaali oletus on eri asia. [6]

### Worktree-agentit ja spinoffit [7]

| Ihmisen teko | Nykyinen sopimus/operaatio | CLI ja ehdotettu muoto | Riski |
|---|---|---|---|
| Aloita rinnakkainen worktree-keskustelu | `POST API/conversations`, `new_worktree` | Kyllä: `oh conversation create --workspace W --worktree N` | Uusi checkout/haara ja Pi; ei Taskfleet-spinoff |
| Tarkastele oman työtilan tai kaikkien worktree-listaa | `POST T`, `worktree_list` | Kyllä: `oh worktree list [--workspace W]` | Gitin tila voi olla vajaa/epävarma |
| Poista worktree; tallenna muutokset commitiksi ja poista; pakota; siivoa puuttuva Git-merkintä | `POST T`, `worktree_remove`, disposal `remove|commit|force|prune` | Kyllä: `oh worktree delete E --workspace W --disposal D`; force ihmisen kautta | Tiedostojen menetys; commit muuttaa historiaa; aktiiviset ajot suojattava |
| Siivoa listatut yhdistetyt worktreet | `POST T`, `worktree_clean_merged`, listing-token | Kyllä: `oh worktree delete --merged --listing-token TOKEN` | Useita checkoutteja ja mahdollisia haaroja; ei sokeaa bulk-poistoa |
| Näytä spinoffit, tila ja tuloste; avaa niiden historia | `GET API/agents/{id}/spinoffs[?run=…]`; SSE:n spinoff-tapahtumat; snapshot/history | Kyllä lukuna: `oh spinoff list --conversation C`; hallinta natiivilla `taskfleet` | Sisältöä muista omista työtiloista; havainnointi ei ole omistajuus |
| Yhdistä worktree / käynnistä tai yhdistä Taskfleet-spinoff | **Ei UI-ohjainta** | Natiivi `git` / `taskfleet`, ei uutta daemon-ajuria | Taskfleet omistaa oman elinkaarensa |

### Git-paneeli [4, 8]

| Ihmisen teko | Nykyinen sopimus/operaatio | CLI ja ehdotettu muoto | Riski |
|---|---|---|---|
| Lue paikallinen tila, muutokset, ahead/behind, vertailuhaara ja commitit | `GET T/git`, snapshotin `git_summary` | Kyllä, myös natiivi Git: `oh git show --workspace W` | Tiedostonimet; havainto voi vanhentua |
| Hae etätiedot | `POST T/git/fetch` | Natiivi `git fetch`; tarvittaessa `oh git fetch --workspace W` | Verkko ja ref-muutos; ei merge/push |
| Luo GitHub-repo tai liitä sopiva tyhjä repo originiksi ja työnnä koodi | `GET/POST T/github/publish`, vaihe + observation-token + vahvistus | Natiivi `gh`/Git; CLI:ssä mieluummin ihmisen hyväksyntäpyyntö | Julkaisu, public/private, ulkoinen kirjoitus; paikalliset muutokset eivät automaattisesti ole commitissa |

Hakemiston Git-alustus on työtilan luonnin valinta ja backendin `git_init`;
erillistä yleistä commit/push/merge-paneelia ei pidä luvata. [4, 8]

### Roskakori ja tallennustila [9]

| Ihmisen teko | Nykyinen sopimus/operaatio | CLI ja ehdotettu muoto | Riski |
|---|---|---|---|
| Tarkista työtilan poistoehdot, siirrä roskiin / poista puhdas työnnetty klooni | `POST T`, `delete_check`, `delete` | Kyllä tarkistus: `oh workspace show W --deletion`; poisto `oh workspace delete W` ihmisen hyväksynnällä | Kaikki työtilan keskustelut/checkoutit; puhtaan kloonin poisto on pysyvä |
| Listaa ja tarkista roskakori | `POST T`, `trash_list`, `trash_inspect` | Kyllä: `oh trash list`, `show E` | Myös nimeämättömiä hakemistoja; täydellisyys ilmoitettava |
| Palauta roskista | `POST T`, `trash_restore` | Kyllä: `oh trash restore E` | Kohdekonflikti; ei päällekirjoitusta |
| Poista pysyvästi yksi / tyhjennä nähty roskakori | `POST T`, `trash_delete`, `trash_empty` | Selain; CLI luo hyväksyntäpyynnön, ei pelkkää `--yes`-ohitusta | Peruuttamaton, paljon dataa; nimen/listing-tokenin tarkistus |
| Näytä oma käyttö ja raja | `GET API/account/storage` (`account-storage`) | Kyllä: `oh environment show` | **Nykyisin gateway → broker**, ei daemon-luku; roskakori kuluttaa kiintiötä |

### Integraatiot, asetukset, mallit ja tunnistautuminen [10–12]

| Ihmisen teko | Nykyinen sopimus/operaatio | CLI ja ehdotettu muoto | Riski |
|---|---|---|---|
| Näytä palvelut, yhdistetyt tilit, synkronointi ja kirjautumisen tila | `GET API/integrations`, `/integrations/login` | Kyllä: `oh integration list`, `oh environment show` | Osoitteet/polut ovat yksityisiä; ei token-arvoja |
| Yhdistä OAuth-tili, avaa koodi/linkki, palauta redirect, valitse synkattavat kansiot, peru | `POST/PUT/DELETE API/integrations/login` | Selain; myöhemmin `oh request create --kind integration-connect` | Antaa pääsyn henkilödataan; kaksisuuntainen sync |
| Lisää IMAP/app-password-tili, vaihda salasana, poista yhteys | `POST/DELETE API/integrations/accounts` | Selain; sama pyyntömalli, ei salaisuuksia CLI-argumentteihin | Tunnukset, käyttöoikeuksien muutos; natiivi tallennus |
| Tarkista Pi-kirjautuminen; aloita/peru OpenAI-device-login; Claude-linkki/koodin palautus/peru | `GET API/onboarding/pi/status`, `GET/POST/DELETE …/attempt`; `GET/POST/PUT/DELETE API/pi/claude-login` | Selain; CLI vain tilan luku / pyyntö | Tilaus, identiteetti ja kertakoodit |
| Näytä OpenAI-avaimen olemassaolo/loppuosa; tallenna/poista avain | `GET/PUT API/pi/credentials`, `DELETE …/credentials/openai` | Läsnäolotieto kyllä: `oh provider list`; muutokset selaimessa | Pi:n `auth.json`; ei raakoja avaimia ulos |
| Listaa mallit, vaihda oletusmalli ja ajattelutaso | `GET/PUT API/pi/models` | Kyllä: `oh model list`, `oh model update --default M --thinking high` | Koskee tulevia keskusteluja, kustannuksia; ei muuta käynnissä olevaa työtä |
| Näytä/vaihda Gitin globaali nimi ja sähköposti | `GET/PUT API/account/git-identity` | Kyllä tai natiivi `git config`: `oh git-identity show`, `update --name N --email E` | Kaikkien omien repojen tulevien commitien tekijätiedot |
| Täydennä puuttuva profiilin nimi/email | `POST /auth/profile`, `account-profile-update` | Selain; ei agentin ylläpitämää profiilia | Gatewayn istunto-/profiilitietoa, ei Unix-identiteetin vaihto |
| Kirjaudu GitHubilla, yhdistä uudelleen, katkaise GitHub-yhteys, kirjaudu ulos | `/auth/github/start`, `/auth/logout`; `POST API/account/github/disconnect` | Selain | Pääsy omaan tiliin, natiiviin `gh`:hon ja istuntoihin |
| Näytä laitteet/istunnot, luo/peru QR-linkki, hyväksy se toisella laitteella, päätä istunto | `/auth/sessions`, `/auth/sessions/end`, `/auth/link` + `/cancel`, `/describe`, `/redeem` | Selain, ei agentille kirjautumislinkkien minttausta | Antaa uuden selainistunnon; **gatewayn valta** |
| Näytä palvelimen nimi/versio; päivitä selain uudelle versiolle / lykkää päivitystä | `GET API/server`; reload/lykkäys paikallisia | Kyllä version tiedoksi: `oh environment show`; reload selaimessa | Palvelimen versio ≠ selainpaketin versio; gateway-tieto |

### Editori, pääte ja liitteet [13]

| Ihmisen teko | Nykyinen sopimus/operaatio | CLI ja ehdotettu muoto | Riski |
|---|---|---|---|
| Avaa editori, tiedosto/rivi/linkki; muokkaa ja tallenna; vaihda rinnakkaisnäkymää | `GET API/editor`, `POST API/editor/open`; erillisen originin code-server-relay | Natiivit tiedostotyökalut; myöhemmin `oh request create --kind editor-open` | Ei editorin kertalippua agentille; sisältö voi ajaa extension/webview-koodia |
| Listaa/avaa tmux-shell, luo uusi, kirjoita/resizaa, irrota, sulje pysyvästi | `GET T/terminals`, WS `T/terminal`, `POST T/terminals/close`; `terminal` | Natiivi shell/tmux; tarvittaessa `oh terminal list`, `delete E` | Mielivaltainen shell, sulkeminen tappaa työn; selaimen irrotus ei sulje tmuxia |
| Katso Taskfleet-pääte | Sama WS, Taskfleet-token | Natiivi Taskfleet / read-only-tuloste | Ei kirjoitusta tai tmux-clientin attachia Taskfleet-serveriin |
| Lisää liite valitsimella, pudota tai liitä kuva; poista lähettämätön valinta | `POST API/attachments` raakatavuina; valinta paikallinen | Kyllä: `oh attachment create --file PATH` vain jos hostiin rekisteröinti tarpeen | 20 MiB/tiedosto, 1 GiB hakemistobudjetti + kiintiö; valinnan poisto ei lupaa levytiedoston poistoa |
| Lähetä liite, näytä kuva, lataa alkuperäinen | `K/send` + natiivit liiteviitteet; `GET API/attachments/{id}` | Natiivi tiedoston luku; tarvittaessa `oh message create --conversation C --attachment ID --body-file -` | Kuvat mallille; muut polkuina; ei repositorioon ilman pyyntöä |

### Vain ylläpitäjälle [2, 14]

| Ihmisen teko | Nykyinen sopimus/operaatio | CLI ja ehdotettu muoto | Riski |
|---|---|---|---|
| Lue käyttäjät/roolit, nimeä palvelin, myönnä/poista admin-rooli, muuta oletuskiintiötä | `GET/PUT API/server/administration` | **Ei agent-CLI:tä.** Selain; root-operaattorilla erillinen nykyinen `open-habitat admin …` | Muiden käyttäjien tiedot ja koko palvelimen valta |
| Lue käyttäjien kiintiöt, koko levyn tila/ylivaraus, muuta yhden rajaa | `GET/PUT API/server/storage` | **Ei agent-CLI:tä.** Admin-selain | Brokerin root-operaatio; omakaan web-admin ei tee Pi-prosessista adminia |

## 2. Agentille erityisesti hyödylliset uudet kyvyt

Nämä ovat ehdotuksia, eivät nykyisiä uusia API-operaatioita. [15]

| Tarve | Ehdotettu muoto | Mitä ihminen näkee / mikä puuttuu |
|---|---|---|
| Agentti kertoo esteestä tai valmistumisesta | `oh notice create --conversation C --level warning --body-file -` | Keskustelun huomio, josta pääsee lähteeseen; ei väärennetty järjestelmähälytys. Tarvitaan notice-sopimus ja UI-paikka. Ei Telegram-/email-palvelua. |
| Agentti saa ympäristön tilan ennen epäonnistumista | `oh environment show`; `oh notice list --conversation C` | Käyttö/raja, integraation tila, keskeytyminen/uudelleenkäynnistys, havainnon aika ja saatavuus. Pelkkä CLI-luku ei herätä agenttia; automaattinen toimitus tarvitsee hookin. |
| Listaa ihmisen antama paikallinen kansio ja pyydä tiedosto palvelimelle | `oh local-folder list`; `oh local-file list --folder F`; `oh request create --kind local-file --folder F --entry E` | Päätetty selainreitti: Chromium-kansiolupa, avoin välilehti, vain pyydetyt tiedostot nykyiseen liitepolkuun. `oh request show R` kertoo tuloksen tai `browser_unavailable`. Ei mielivaltaista koneen polkua. |
| Pyydä ihmiseltä päätös / vahvistus | `oh request create --kind confirmation --conversation C --body-file -`; `oh request show R` | Keskustelun kysymyskortti; selvä kohde, vaikutus, hyväksy/hylkää. Pi:n kysymyskulku on jo olemassa, mutta yleinen CLI-pyyntö ja suojatun operaation hyväksyntä eivät ole sama asia. |
| Aloita työ toisessa omassa työtilassa | `oh workspace list`, sitten natiivi `taskfleet run create` kohderepossa | Ei uutta ajomoottoria. Ristiin näyttäminen ja emokeskustelun completion-wake kuuluvat avoimeen cross-workspace-työhön. |
| Tiedä oma keskustelu ja emokonteksti | `oh conversation show --current` | Workspace/conversation-ID, native session, cwd, mahdollinen parent/run, malli ja tila; puuttuvaa parentia ei arvata. `--current` tarvitsee launch-kontekstin, ei ”uusin istunto” -heuristiikkaa. |

Notice ei saa vaatia uutta pysyvää ilmoitustietokantaa. Suositus on tallentaa
keskusteluun kuuluva agenttiviesti natiivina Pi-merkintänä ja käyttää olemassa
olevaa tapahtumajakelua; ympäristön tila luetaan sen omistavalta komponentilta.
Tarkka natiivi merkintä- ja kuittausmalli pitää ratkaista ennen toteutusta.
Vanhentunut/poissa oleva havainto ei ole ”kaikki kunnossa”. Levy täynnä -hälytys
pitää pystyä palauttamaan myös silloin, kun uutta historiariviä ei voi kirjoittaa;
se ei voi nojata onnistuneeseen notice-tallennukseen.

## 3. Valta ja turvallisuus: mitä ”oma Unix-käyttäjä” tarkoittaa?

**Ei uutta identiteettivaltaa, mutta uusi sisääntuloreitti.** Suosittelen daemonille
erikseen rajattua paikallisen UID:n palvelupintaa. Se käyttää samoja operaatioita
ja tarkistuksia kuin selain, mutta tunnistaa kutsujan kernelin peer-UID:stä.
Nykyistä gateway-only-tarkistusta ei saa vain vaihtaa muotoon ”gateway tai owner”
kaikilla reiteillä: token-handoff, editoriliput ja gatewayn valta eivät kuulu
paikalliselle agentille. Socketin omistus/ACL ja systemd-kuuntelijan tarkistus
kuuluvat päätökseen. Reittierottelu on arkkitehtuuripäätös Jarille. [1]

| Agentti voi suoraan (suositus) | Ihmisen selainpäätös (suositus) | Ei koskaan tämän CLI:n kautta |
|---|---|---|
| Lukea oman tilan; tehdä sovitut työtila-/keskustelutoimet; käyttää omia natiivityökaluja | Pysyvä poisto ja force-cleanup; tunnusten/yhteyksien muutokset; ulkoinen julkaisu; uuden paikalliskansion lupa | Muiden käyttäjien kodit, agentit, socketit tai käyttäjälistat; root/broker-komennot; raakakredentiaalien vienti; selainistunnon tai editorilipun luominen |

**Selainvahvistus on vahinkoja ehkäisevä työtapa, ei UID:n sisäinen hiekkalaatikko.**
Sama agentti voi shellillä poistaa omia tiedostoja tai lukea natiivien työkalujen
tunnustiedostoja. CLI ei saa helpottaa salaisuuksien paljastamista, mutta ei voi
luvata estävänsä kaikkea saman UID:n koodia. Aidosti agentilta suojattu hyväksyntä
vaatisi erillisen luottamusrajan, ei `--yes`-lippua tai agentin itse tuottamaa
”käyttäjä hyväksyi” -tekstiä. [1, 16]

Prompt-injektio voi tulla reposta, liitteestä, sähköpostista, paikallisen tiedoston
nimestä tai toisen keskustelun tekstistä. Ne ovat dataa, eivät lupia. Tarkka kohde
ja vaikutus näkyviin; kohdetta vaihtava hyväksyntä ei kelpaa. Pyyntö sidotaan
operaatioon ja tuoreeseen havaintoon, sillä välissä työtila, prosessi tai Git-haara
voi muuttua. Agentin kysymys merkitään agentin kysymykseksi; se ei saa esiintyä
palvelimen luotettuna turvallisuusvaroituksena.

Yksi kirjoittaja per keskustelu säilyy. Toisen oman keskustelun ohjaus on
**ristivaikutus**, ei oikeusloukkaus toiseen Unix-käyttäjään; vaadi aina eksplisiittinen
`--conversation C`, älä viimeksi avattua selaintabia. Puuttuva kuittaus, 503 tai
katkennut yhteys eivät oikeuta lähettämään samaa työtä uudella tunnisteella. [6, 16]

## 4. Miten tämä sopii tuotteeseen?

- **Yksi binääri, ohuet komennot:** ehdotettu `open-habitat agent …` erottaa
  henkilökohtaisen pinnan jo olemassa olevasta root-operaattorin CLI:stä.
  Daemon ja selain käyttävät samoja toimintatoteutuksia, skeemoja ja
  havaintotarkistuksia; CLI ei kirjoita omaa workspace-, historia-, tunnus- tai
  Taskfleet-rekisteriä. Git-, `gh`- ja Taskfleet-komentoja ei kopioida. [14, 16]
- **Ei gatewayn ohitusta:** kiintiön nykyinen root-luku ei muutu sallituksi
  daemon-operaatioksi nimeämällä sitä statuskomennoksi. Suositus on selvittää
  natiivin oman UID:n read-only-kiintiöluku ensin; jos se ei asennuksessa onnistu,
  tarvitaan erillinen päätös oman tiedon välityksestä. Ei yleistä broker-yhteyttä
  agentille. Gatewayn versiotiedollekin tarvitaan määritelty lähde. [2]
- **Löydettävyys:** release-owned host context kertoo vain ympäristön faktat ja
  ohjaa saman binäärin `skill print agent --json`-ohjeeseen sekä `--help --json`:iin.
  Skill opettaa työnkulut, ei ylläpidä toista kuvausta API:sta. Nykyinen host context
  lisätään Pi:n elinkaaren ajaksi ilman käyttäjän omien ohjeiden syrjäyttämistä. [17]
- **Pi-extension ei ole CLI:n korvike:** CLI toimii myös muista saman käyttäjän
  prosesseista. Nykyistä host-context-hookia voi myöhemmin täydentää tuoreen
  tilatiedon/notice-herätteen toimituksella. Ensimmäiseen versioon riittää
  kysyttäessä luettava tila; proaktiivinen heräte on erikseen toteutettava ja
  testattava, ei lupaus jonka CLI yksin täyttää.
- **Kanonin mukainen pinta:** `list/show/create/update/delete`, todellisiin
  siirtymiin esim. `resume`, ei TTY-kyselyitä. Kaikkialla `--json`, versioitu
  stdout, rakenteinen stderr-virhe, exit 1 käyttäjän korjattavalle ja 2
  järjestelmävirheelle, `--verbose`-diagnostiikka JSONL:na ilman sisältöä/tunnuksia.
  `--body-file -`, rajatut haut ja tiedostoon vietävä pitkä historia. Muutoksille
  rehellinen `--dry-run` tai `dry_run_unsupported`; tunniste/kuittaus uusintoihin,
  pitkä työ palauttaa ID:n ja `show`-kyselyn tai eksplisiittisen JSONL-virran.
  Käytetty socket ja kohdekontekstin lähde tarkistettavissa config-näkymästä;
  ei käyttäjän valitsinta. Version, doctorin ja skillin nykyistä runkoa käytetään
  uudelleen, mutta nykyinen `CONFORMANCE.md` ei vielä todista agenttipinnan
  vaatimusten täyttymistä. [14, 18]

CLI ei saa kasvaa selainautomaatioksi, credential brokeriksi, uudeksi
agenttialustaksi, ilmoituspalveluksi tai Taskfleetin kilpailijaksi.

## 5. Ensimmäinen pala: viisi komentoa

| Ehdotettu komento | Miksi ensimmäisenä |
|---|---|
| `oh environment show --json` | Agentti saa oman kiintiön/tilan ja integraatioiden saatavuuden; tuntematon merkitään tuntemattomaksi, ei nollaksi. Kiintiölähde ratkaistava. |
| `oh workspace list --json` | Agentti löytää rinnakkaiset repot ilman rekisteriä tai polkujen arvailua. |
| `oh conversation show --current --json` | Tietää missä keskustelussa on ja mihin pyyntö/notice kuuluu. |
| `oh notice create --conversation C --level warning --body-file - --idempotency-key KEY --json` | Saa ad hoc -esteen näkyviin ihmiselle keskustelun yhteyteen. |
| `oh notice list --conversation C --json` | Agentti voi tarkistaa ympäristön ja oman keskustelun ajankohtaiset huomiot; ei vielä automaattista herätettä. |

Tämä on tuotesiivu, ei viiden funktion pikatyö: siihen kuuluvat rajattu paikallinen
sisäänkäynti, natiivin notice-merkinnän valinta, UI-paikka ja sopimustestit.
Ei poistoja, tunnusmuutoksia eikä toisten keskustelujen ohjausta ensimmäiseen palaan.
Seuraavaksi jo päätetty paikallistiedostopyyntö ja sen tilakysely; worktree-ajot
edelleen Taskfleetillä. Koko UI-inventaario ei ole ehdotus toteuttaa kaikkea.

### Jarilta tarvittavat ratkaisut

1. **Hyväksytäänkö rajattu paikallinen UID-reitti**, ilman gatewayn istunto-,
   tunnus- ja admin-valtaa? Suositus: kyllä; tästä ADR ennen toteutusta.
2. **Saako agentti ohjata muita omia keskusteluja ja vaihtaa globaaleja oletuksia?**
   Suositus: myöhemmin vain eksplisiittisellä kohteella; ei ensimmäisessä palassa.
3. **Mihin notice jää ja milloin se lakkaa olemasta ajankohtainen?** Suositus:
   keskustelun yhteyteen, näkyvä alkuperä ja aikaleima; ei globaalia inboxia.
   Halutaanko kuittaus vai riittääkö nykytilaan perustuva poistuminen?
4. **Mitkä teot vaativat selainvahvistuksen?** Suositus: pysyvä/force-poisto,
   tunnusmuutokset ja julkaisu. Tämä rajaa agentin mukavuusrajapintaa, ei sen
   Unix-oikeuksia. Admin-toimet jäävät kokonaan erilleen.
5. **Riittääkö ensimmäisessä palassa kysyttäessä luettava ympäristön tila?**
   Suositus: aloita sillä, lisää proaktiivinen quota/restart-heräte seuraavaksi;
   jos ennen virhettä tuleva varoitus on välttämätön heti, hook kuuluu samaan palaan.

## Lähteet ja rajat

Lähteet ovat tämän revision sopimuksia ja tuotantokoodia, eivät Storybookin
kokeiluja tai enumien lupaamia tulevaisuustoimintoja. HTTP-muodot tarkistettu
UI-kutsupaikoista ja handlerien mounttauksesta; ei live-palvelimen testaus eikä
CLI-toteutuksen vaatimustenmukaisuusauditointi. Ei uusia issueita tai toteutusta.

1. [Transport: TrustedPeer, guardListener.Accept](../../internal/transport/transport_linux.go), [daemonin reittikytkentä](../../internal/daemon/handoff_linux.go), [sopimusskenaariot CT-001/002](../../contracts/v1/scenarios.json).
2. [Gateway-reitit](../../internal/gateway/server.go), [quota: quotaHTTP ja BrokerQuota](../../internal/gateway/quota.go).
3. [Selain/host-sopimukset](../../contracts/v1/), erityisesti `snapshot`, `command`, `operation`, `workspace-change`, `github-clone` ja `pi-conversation-create`.
4. [Työtilan nykyinen UI](../../web/src/app/WorkspacePage.tsx), [luonti](../../web/src/app/NewWorkspacePage.tsx), [muutokset](../../web/src/app/workspaceWrites.ts), [työtilahandler](../../internal/daemon/workspace_manage_linux.go).
5. [GitHub-kutsut](../../web/src/app/github.ts), [clone-job-sopimus](../../contracts/v1/github-clone.schema.json).
6. [Keskustelun kutsut](../../web/src/app/conversations.ts), [toiminnot](../../web/src/app/ConversationActions.tsx), [tuotantonäkymä](../../web/src/app/BrowserConversation.tsx), [prosessit](../../web/src/app/processes.ts), [composerin luvut](../../web/src/app/composerReads.ts), [historian luku](../../web/src/app/HistoryView.tsx).
7. [Worktree-kutsut](../../web/src/app/workspaceWorktrees.ts), [siivousnäkymä](../../web/src/app/WorktreeCleanup.tsx), [spinoffit](../../web/src/app/spinoffs.ts), [worktree-sopimus](../../contracts/v1/workspace-worktrees.schema.json).
8. [Git-tilan UI](../../web/src/app/ConversationGitStatus.tsx), [Git-kutsut](../../web/src/app/workspaceGit.ts), [GitHub-julkaisu](../../web/src/app/WorkspaceGitHub.tsx).
9. [Poisto/Trash-kutsut](../../web/src/app/workspaceTrash.ts), [tallennustilan näkymä](../../web/src/app/PersonalStorage.tsx), [quota-kutsut](../../web/src/app/storageQuota.ts), [poistosopimus](../../contracts/v1/workspace-deletion.schema.json).
10. [Integraatiokutsut](../../web/src/app/integrations.ts), [tilit](../../contracts/v1/integration-account.schema.json), [login-ohjaus](../../contracts/v1/integration-login-control.schema.json).
11. [Pi-onboarding](../../web/src/app/pi.ts), [avaimet](../../web/src/app/PiCredentials.tsx), [Claude-login](../../web/src/app/ClaudeSignIn.tsx), [mallit](../../web/src/app/PiModels.tsx), [Git-identiteetti](../../web/src/app/GitIdentity.tsx).
12. [Laitelinkit ja istunnot](../../web/src/app/deviceLink.ts), [profiili](../../web/src/app/AccountProfileOnboarding.tsx), [palvelintiedot](../../web/src/app/serverAdministration.ts), [sovelluksen toiminnot](../../web/src/app/App.tsx).
13. [Editorikutsut](../../web/src/app/editor.ts), [päätekutsut](../../web/src/app/terminals.ts), [selainpääte](../../web/src/app/BrowserShell.tsx), [liitteet](../../web/src/app/attachments.ts), [liitesopimus](../../contracts/v1/attachments.schema.json).
14. [CONFORMANCE.md](../../CONFORMANCE.md), [ylläpitonäkymä](../../web/src/app/ServerAdministration.tsx), [hallintasopimus](../../contracts/v1/server-administration-change.schema.json), [kiintiömuutos](../../contracts/v1/server-storage-change.schema.json).
15. `issuectl show --json`: @agent-cli (open), @local-files-access (open, Jarin päätös 20.10.), @cross-workspace-agents (open), @quota-full-experience (open), @composer-attachments (done), @agent-host-context (done). Statukset tarkistettu tutkimuksessa; suljetut tulokset löytyvät myöhemmin slugilla historiasta.
16. [Järjestelmän rajat](../../AGENTS.md), [sisäiset auktoriteetit ja natiivi totuus](../../internal/AGENTS.md).
17. [Julkaisun agenttikonteksti](../../internal/daemon/host-context.md), [kontekstin testit](../../internal/daemon/host_context_linux_test.go).
18. Asennettu `ai-first-cli-canon/SKILL.md`, canon v4, §1–24 (`project-canon` 0.9.3); paikallinen normilähde, ei repoon kopioitu toinen kanoni.
