# Järjestelmän rajapinnat

Tämä sivu määrittelee ensimmäisen version selaimen, gatewayn, käyttäjädaemonin
ja natiivien adapterien välisen havaittavan sopimuksen. Se ei väitä, että
sopimus olisi toteutettu. [ADR 0001](adr-0001-unix-native-agent-host.md) on
hyväksytty perusta. React/TypeScript 7/Biome- ja Go-ratkaisut on hyväksytty
[ADR 0002:n](adr-0002-frontend-stack.md) ja
[ADR 0003:n](adr-0003-host-stack.md) mukaisina. Ensikirjautumisen tilinluonti
noudattaa [ADR 0004:ää](adr-0004-first-login-user-provisioning.md).

Koneelliset JSON Schema 2020-12 -sopimukset ovat
[`contracts/v1/`](../contracts/v1/AGENTS.md)-hakemistossa. Niiden validoidut,
redaktoidut esimerkit ovat [`contracts/v1/examples/`](../contracts/v1/examples/)
ja toteutuksen deterministiset skenaariot
[`contracts/v1/scenarios.json`](../contracts/v1/scenarios.json). Tämä sivu
määrittää merkityksen silloin, kun pelkkä skeema ei voi sitä ilmaista.

**Historian toteutus:** Snapshot sekä historia-/sisältö-GET-polut ovat
luku -tilassa. Pi:n v3 JSONL luetaan käyttäjädaemonissa suoraan mapped
käyttäjän kotihakemistosta. `pi:<sessionId>` perustuu natiiviin otsakkeeseen,
workspace-kytkentä vain otsakkeen täsmälliseen `cwd`-arvoon. Sivu on enintään
200 entryä, inline-teksti enintään 65 536 UTF-8-tavua ja jatko sidottu
lähteen revisioniin. Prosessi jää `unknown`-tilaan ja ohjaus `read_only`-tilaan.
Snapshotin 1 MiB katto voi estää erittäin suuren agenttilistan: se ei oikeuta
hiljaista rajausta. Yhden natiivin JSONL-tiedoston luku on rajattu 32 MiB:iin;
suurempi historia näkyy saavuttamattomana, ei katkaistuna keskusteluna.
Nämä ovat nykyisen toteutuksen rajoja, joita pitää muuttaa, jos ne haittaavat
tavallista käyttöä. Erillinen väliaikainen selainohjaus tukee jo uuden Pi:n
käynnistystä ja viestejä tilakyselyillä; SSE ja päättyneen selainkeskustelun
jatkaminen ovat [agenttiohjauksen](../issues/build-agent-control/item.md) työtä.
Katso [historian toteutusevidenssi](../issues/build-history-view/result.md).

## Rajat ja puskurit

Raja tai puskuri lisätään konkreettiseen tarpeeseen, mahdollisimman yksinkertaisena.
Tarkat luvut eivät ole tuotevaatimuksia. Valitse mielekkäät arvot ja säädä niitä
mittausten ja käyttöhavaintojen perusteella niin, etteivät ne estä normaalia
keskustelua tai historian lukemista. Pelkkä vanha suunnitelma ei perustele
erillistä tapahtumarengasta, säilytysrekisteriä tai välimuistia.

SSE välittää työn etenemisen. Katkoksesta pitää päästä ajantasaiseen näkymään
ilman hiljaisia aukkoja tai automaattista viestin uusintaa. Alla kuvattu cursor-
ja snapshot-sopimus sallii uuden tilannekuvan hakemisen, kun tapahtumia ei enää
ole toistettavissa; se ei vaadi tiettyä muistirakennetta tai säilytysaikaa.
Puuttuva komennon tulos jää tuntemattomaksi. Pi:n natiivihistoria säilyy lähteenä.

Skeeman ja toteutuksen nykyiset koko- ja sivutusrajat pysyvät keskenään samoina.
Niitä muutettaessa päivitetään rajapintakuvaus, skeemat, generoidut tyypit ja
testit yhdessä; tämä periaate ei itsessään muuta nykyisiä HTTP-vastauksia.

## Omistajuus ennen viestimuotoa

Selain ei omista historiaa, prosessia, Unix-käyttäjää eikä komentojen toteutusta.
Gateway todentaa web-identiteetin ja reitittää sen ylläpitäjän määräämälle
käyttäjädaemonille. Daemon lukee ja muuttaa natiiveja lähteitä oman UID:nsä
oikeuksilla. Adapteri kääntää vain todistetut Pi-toiminnot hostin sopimukseen.

| Tieto | Omistava lähde | Hostin tehtävä |
|---|---|---|
| Web-istunto ja `(issuer, subject)`-reititys | gatewayn todennus ja ylläpitäjän mappaus | torju puuttuva/ristiriitainen mappaus; älä välitä Unix-valintaa selaimesta |
| Workspacejen olemassaolo | `~/src`:n välittömät hakemistot | listaa ilman symlinkkien seuraamista; erottele tyhjä, puuttuva, virhe ja tuntematon |
| Workspace-ID ja näyttönimi | valinnainen `.agent-host/workspace.json` | validoi, kirjoita atomisesti vain asetuksen tarpeessa |
| Git-repo, branch ja worktreet | Git | lue aina uudelleen ennen mutaatiota; älä kopioi faktoja annotaatioon |
| Taskfleet-worktreen omistajuus | Taskfleetin täysi run/node-identiteetti | käytä vain Taskfleetin omaa lifecyclea; älä päättele omistajaa branchin lyhenteestä |
| Keskustelu, malli ja resume-ID | Pi:n natiivi JSONL | säilytä `pi:<sessionId>`; älä tee rinnakkaista historiaa |
| Prosessin olemassaolo | daemonin omistama Pi-lapsi ja natiivi tila | ilmoita lähde ja havaintohetki; puuttuva havainto ei todista exit-tilaa |
| Ohjauskelpoisuus | daemonin omistama RPC-kanava | pidä erillään historiasta ja prosessihavainnosta |
| Credentialit | Unix-käyttäjän Pi/Git/SSH/`gh`-ympäristö | GitHub OAuth -callback-token saa olla gatewaylla vain transientisti ja siirtyä kerran todennetulle daemonille; älä persistoi/lokita/näytä sitä selaimelle; Git-portti todentaa HTTPS-helperin ja transportin |
| Piilotus, arkisto, generoitu otsikko ja puuttuva parent-linkki | pieni käyttäjäkohtainen annotaatio | annotaatio on korvattavaa esitystietoa, ei lähdefakta |

Lähdefakta sisältää aina tilan `confirmed`, `absent`, `unknown`, `unavailable`
tai `conflicting`, havaintoajan ja lähteen. `unknown` ei muutu arvaukseksi.
Snapshot voi siis näyttää historian luettavana samalla kun prosessi on
`unknown` ja ohjaus `read_only`.

## Identiteetti ja luottamusrajat

### Selain → gateway

Ensisijainen kirjautumispolku käyttää GitHub OAuth Authorization Code -virtaa kertakäyttöisellä `state`lla ja PKCE S256:lla. Reititysavain on GitHubin varmennettu vakaa numeerinen käyttäjä-ID. Sama yksi authorization pyytää `gh auth login --with-token` -polun vaatimat `repo`, `read:org` ja `gist` -scopet, muodostaa web-istunnon ja toimittaa callback-tokenin kerran todennetun paikallisen hopin kautta mapped daemonille native `gh` HTTPS helperin asennusta varten. Token ei mene cookieen, selaimeen, lokiin, argviin, ympäristöön tai gatewayn levylle. Valinnainen Google OIDC käyttää exact `(issuer, subject)` -avainta web-identiteettiin eikä konfiguroi GitHubia; siihen ei oteta yhteyttä ennen eksplisiittistä valintaa. Sähköposti, login-nimi, näyttönimi, HTTP-header, URL-parametri, body-kenttä tai selaimen lähettämä Unix-käyttäjä ei saa valita daemonia.

Gatewayn web-istunto on opaque, palvelinpuoleinen ja cookie on
`__Host-agent-host; Secure; HttpOnly; SameSite=Lax; Path=/`. Kaikki kirjoittavat
POST-pyynnöt vaativat sekä voimassa olevan istunnon, täsmälleen sallitun
same-origin `Origin`-headerin että istuntoon sidotun CSRF-tokenin
`X-Agent-Host-CSRF`-headerissa. Puuttuva `Origin` ei ole sama kuin hyväksytty
origin. JSON-endpointit eivät ota vastaan form-enkoodattua kirjoitusta. CORS ei
salli credential-pyyntöjä toisesta originista.

Vanhentunut istunto tekee jo renderöidystä sisällöstä stalea: selain saa pitää
sen luettavana, mutta kaikki uudet luku- ja kirjoituspyynnöt vaativat uuden
kirjautumisen. Identiteetin vaihto tyhjentää edellisen identiteetin näkymän ja
`sessionStorage`-luonnokset ennen uuden sisällön näyttämistä. Web-logout säilyttää native `gh` -jatkuvuuden. Erillinen tuoretta autentikointia ja vahvistusta vaativa disconnect poistaa paikallisen `gh`-authin mapped Unix -käyttäjältä, näyttää osittaiset virheet ja kertoo, ettei `gh auth logout` GitHub CLI:n mukaan revokoi OAuth-tokenia GitHubista.

### Gateway → daemon

[ADR 0003:n](adr-0003-host-stack.md) kuljetus on HTTP/1.1 käyttäjäkohtaisessa
systemd-created Unix-socketissa. Socket valitaan brokerin vahvistamasta
identiteetin ja Unix-käyttäjän sidoksesta. Gateway poistaa selaimen identiteetti-, UID-, käyttäjä-
ja socket-headerit eikä lisää niiden perusteella reititystä. Daemon hyväksyy vain
konfiguroidun gateway-UID:n Linuxin `SO_PEERCRED`-tiedosta ja tarkistaa oman
käyttäjänsä, UID:nsä, home-hakemistonsa ja socket-instanssinsa yhteensopivuuden.
Väärä peer, socket tai daemon torjutaan; toiseen käyttäjään ei fallbackata.

Gateway saa nähdä reitityksen, statuskoodin ja redaktoidun audit-korrelaation,
mutta ei käyttäjän promptia, mallivastausta, tool-outputia, tiedoston sisältöä
tai native credential -metadataa. Julkiset health-endpointit ovat aggregaatteja.
Peer credential -tarkistuksen jälkeen gateway asettaa sisäiselle hopille
`X-Agent-Host-Identity: wid_…`- ja redaktoidun display-name-headerin omasta
istunnostaan. Daemon hylkää nämä headerit muulta peeriltä. Näin daemon voi sitoa
snapshotin ja idempotencyavaimen web-identiteettiin luottamatta selaimen kenttään.
GitHub-tokenin kertakäyttöinen handoff kuljettaa lisäksi gatewayn juuri GitHubilta
varmentaman numeerisen `expected_numeric_id`-arvon. Daemonin root-owned käyttäjämappaus
sisältää saman odotetun providerin ja numeerisen ID:n. Daemon hyväksyy asennuksen vain,
jos handoff, oma mappaus ja `gh api user --jq .id` täsmäävät; ristiriidassa se poistaa
juuri asennetun paikallisen authin, raportoi osatuloksen eikä avaa normaalia web-istuntoa.
Socket- ja peer-tarkistukset kuuluvat hyväksyttyyn luottamusrajaan.

### Daemon → natiivit lähteet

Daemonilla on käyttäjän UID:n laaja toimivalta. Tämä ei ole sandbox. Sen pitää
silti käyttää vähimmän yllä kuvatun adapterirajan mukaisia, argv-muotoisia
kutsuja. Pi, GitHub, Git ja Taskfleet eivät anna selaimelle credentialeja.
Renderöity sisältö on epäluotettua tekstiä, vaikka sen tuotti saman käyttäjän
prosessi: raakaa HTML:ää ei suoriteta, URL-skeemat rajataan, ja tool-output,
tiedostonimet sekä diffi escapetaan. Tuntematon validi tapahtuma näytetään
geneerisenä tekstinä; skeematon host-viesti hylätään.

## Versioitu HTTP-pinta

Kaikki JSON-vastaukset käyttävät `Content-Type: application/json` ja sisältävät
`schema_version: 1`. Tuntematon pääversio torjutaan `schema_version_unsupported`-
virheellä. V1:een saa lisätä valinnaisia kenttiä rikkomatta merkitystä; kentän
poisto, uudelleennimeäminen, tyypin/nullabilityn tai järjestystakuun muutos vaatii
uuden version. Pyynnöt ja vastaukset eivät sisällä Unix-käyttäjänimeä tai
absoluuttista home-polkuja.

| Metodi ja polku | Merkitys | Onnistuminen |
|---|---|---|
| `GET /api/v1/snapshot` | käyttäjän atominen tilannekuva ja stream-watermark | `200` [`snapshot.schema.json`](../contracts/v1/snapshot.schema.json) |
| `GET /api/v1/events?after=<cursor>` | yksi yhdistetty SSE-virta; `after` on viimeksi sovellettu cursor | `200 text/event-stream` ja jokaisen `data:`-rivin [`event.schema.json`](../contracts/v1/event.schema.json) |
| `POST /api/v1/commands` | yhden komennon hyväksyntä; body on command request | `200` aiemmin käsitellylle duplikaatille, `202` uudelle hyväksytylle, molemmissa command result |
| `GET /api/v1/commands/<client-command-id>` | retained acceptance/execution -tulos nykyisessä ledger-epochissa | `200` command result tai `404 command_outcome_unknown` |
| `GET /api/v1/agents/<agent-id>/history?after=<native-key>&limit=<1..200>` | sivuta Pi:n natiivia historiaa, ei host-kopiota | `200` [`history.schema.json`](../contracts/v1/history.schema.json) |
| `GET /api/v1/content/<content-id>?offset=<n>&limit_bytes=<1..65536>` | lue pitkän natiivisisällön seuraava pala | `200` content chunk; ID on opaque ja käyttäjä-/revision-sidottu |

Endpointin puuttuva tai väärin enkoodattu tunniste, tuntematon query-parametri,
rajan ylittävä limit, tyhjä pakollinen merkkijono ja tuntematon command kind
hylätään ilman coercionia. Sisältö-ID lakkaa toimimasta, jos lähteen revision
muuttuu; selain hakee historian uudelleen. Host ei tee pitkän outputin
säilytyskopiota. Yksi inline-tekstipala on enintään 65 536 UTF-8-tavua ja päättyy
koodipisterajalle. `offset` ja `next_offset` ovat alkuperäisen UTF-8-sisällön
tavu-offsetteja. Persistoidun sisällön `complete:false`, `content_id` ja
`next_offset` kertovat jatkosta. Live-RPC:n vielä persistymätön välitulos saa olla
`complete:false,truncated:true` ilman jatko-ID:tä; kokonainen sisältö tulee
history-querystä vasta Pi:n persistoinnin jälkeen.

## GitHub-luettelo ennen Pi-kirjautumista

`GET /api/v1/onboarding/github/repos?page=<1..100>&limit=<1..50>` on ainoa pre-Pi-natiivilistaus. Kirjautunut istunto ja brokerin tuore vahvistus valitsevat UID:n ja socketin; selaimelta ei oteta omistajaa, tokenia eikä muita reittivihjeitä. Daemon varmistaa peerin ja sidotun identiteetin, kysyy oman UID:n `gh api --method GET /user` -identiteetin ja sivuttaa `/user/repos`-listaa affiliaatioilla owner, collaborator ja organization_member. Vastauksen [`github-repos.schema.json`](../contracts/v1/github-repos.schema.json) sallii vain nimen, private-tiedon, kuvauksen ja GitHub-osoitteen; `has_more` on tosi täydellä sivulla, joten viimeinen sivu voi olla tyhjä. Listaa ei tallenneta, ja vastauksissa on `no-store`. Puuttuva tai väärän käyttäjän gh-autentikointi antaa `409 github_auth_unavailable`, muu natiivilähteen virhe `503 native_source_unavailable`; raakaa gh-virhettä ei palauteta. Tämä ei avaa työtiloja, Pi-historiaa eikä agentteja ennen Pi-porttia, eikä tee kloonausta.

## GitHub-kloonauksen sovittu vaihevirta

[ADR 0005](adr-0005-clone-progress-stream.md) hyväksyy uuden, nykyistä JSON-kloonivastausta rikkomattoman `POST /api/v1/onboarding/github/clone/stream` -reitin. Se välittää vain numeroidut, skeemavalidoidut Git-vaiheet ja yhden terminaalitilan samaan kirjoittavaan POST-yhteyteen; se ei käytä yleisen snapshot/SSE-virran replayta eikä komentoledgeriä. Selainyhteyden katkeaminen keskeyttää natiivin kirjoituksen. Uusi sivu hakee tilanteen käyttäjädaemonin natiivista Git-/origin-/clean-state-havainnosta eikä jatka vanhaa streamia tai yritä kloonausta automaattisesti. Sopimus, rajat ja epävarmuuden merkitys ovat ADR:ssä. **Tätä uutta reittiä ja sen koneellista skeemaa ei ole vielä toteutettu**; nykyiset `clone`- ja `checkout`-reitit pysyvät ennallaan siihen asti.

## Pi-onboardingin rajattu server-portti

`GET /api/v1/onboarding/pi/status` vaatii web-istunnon ja brokerin joka pyynnöllä vahvistaman mappauksen. Gateway muodostaa uuden pyynnön vain mapped daemonin socketiin; daemon tarkistaa peerin ja `X-Agent-Host-Identity`-sidoksen ennen kuin kysyy Pi:n natiivia OAuth-tilaa. Vastauksen `pi.state` on `usable`, `missing` tai `unknown` (`pi-status.schema.json`); se ei sisällä tokenia, account ID:tä eikä home-polkua. Vastaukset eivät tallennu välimuistiin.

`POST/GET/DELETE /api/v1/onboarding/pi/attempt` aloittaa, lukee ja keskeyttää yhden lyhytikäisen laitekirjautumisyrityksen web-istunnolle. Gateway tarkistaa mappauksen joka pyynnöllä; kirjoitukset vaativat täsmällisen Originin ja istunnon CSRF:n. Gateway lähettää vain istunnon bearer-evästeestä erotellulla etuliitteellä lasketun tiivisteen varmennetun mapped UDS:n kautta, ei evästettä itseään. Daemon säilyttää yrityksen vain muistissa, enintään viisi minuuttia; toinen istunto ei saa lukea tai keskeyttää sitä, eikä uudelleenkäynnistys palauta sitä. Vastaus noudattaa `pi-attempt.schema.json`: vain kiinnitetty vahvistusosoite, Pi:n käyttäjäkoodi sekä rajattu yrityksen ja erikseen tarkistettu Pi:n natiivi tila. Keskeytys palauttaa `unknown`, ei väitä kirjautumista onnistuneeksi tai kumotuksi. Istunnon poistaminen estää yrityksen hallinnan selaimesta, mutta kesken oleva natiivi prosessi voi jatkua viiden minuutin rajaan; tätä ei pidä tulkita uloskirjautumiseksi Pi:stä.

Daemon estää snapshot-, history- ja content-lukemisen ennen natiivilähteiden avaamista, kun tuore Pi-tila ei ole `usable`. `428 pi_onboarding_required` on palautuva estotila; tuntematon tila ei avaa porttia. Gateway palauttaa tästä vain oman vakionmuotoisen virheen eikä luota daemonin vapaaseen virhetekstiin. Muita natiivireittejä ei ole vielä toteutettu: kun niitä lisätään, sama portti on liitettävä ennen niiden natiivilukua tai kirjoitusta. Tässä välivaiheessa start/cancel on tarjolla vain palvelinreittinä; status yksin ei väitä onboardingin valmistuneen. Kiinnitetyn runtimen operaattoriasennus, todellinen Pi-kirjautuminen ja käyttöliittymän integrointi ovat edelleen avoinna. SSH/tmux ja vanhan TUI:n read-only-historia eivät saa kirjoituskykyä portista.

## Snapshot ja yhdistetty SSE

Snapshotin `snapshot_id` tunnistaa yhden atomisen kuvan. `server_instance_id`
tunnistaa daemonin event-ring-inkarnaation. `event_cursor` on watermark muodossa
`ev1:<server-instance-uuid>:<sequence>`. Snapshotin kaikki natiiviluvut kuuluvat
loogisesti tilaan watermarkissa, vaikka niiden havaintoajat eroavat.

Race ratkaistaan näin:

1. daemon varaa watermarkin ja muodostaa snapshotin saman sarjallistetun
   state-generationin alta;
2. selain ottaa snapshotin käyttöön atomisesti;
3. selain avaa streamin `after=<snapshot.event_cursor>`;
4. stream palauttaa ensimmäiseksi seuraavan suuremman sequencen tai odottaa sitä.

Täten snapshotin rakentamisen aikana tapahtunut muutos on joko snapshotissa tai
watermarkia seuraavana eventtinä, ei kummankin ulkopuolella. SSE:n `id:` on sama
kuin bodyn `cursor`, `event:` on bodyn `kind`, ja `data:` on yksi minifioitu JSON-
objekti. Jokaisella eventillä on uniikki `event_id`. Palvelin käyttää reconnectissa
`Last-Event-ID`-headeria ensisijaisesti URL:n alkuperäiseen `after`-arvoon nähden.
Sequence, joka on enintään clientin viimeksi soveltama, on replay-duplikaatti ja
ohitetaan. Seuraava arvo on täsmälleen `last+1`; vain sitä suurempi arvo on aukko.
Sama sequence eri event-ID:llä on ristiriita. Aukko tai ristiriita tekee näkymästä
stale-kirjoituskyvyttömän ja käynnistää resnapshotin; selain ei järjestä aukkoa itse.

Toistettavien tapahtumien säilytys määräytyy toteutuksen tarpeen ja mitatun
käytön mukaan. Cursor voi vanhentua. Snapshot kertoo
`oldest_replay_cursor`in. Toisen instance-ID:n cursor tuottaa
`409 cursor_instance_mismatch`; liian vanha cursor `409 cursor_expired`.
Virhe palautetaan ennen SSE-headerien aloittamista. Molemmat vaativat uuden
snapshotin.

Hitaan SSE-clientin yhteys voidaan katkaista, jos lähetys haittaisi palvelimen
toimintaa. Raja valitaan havaittuun tarpeeseen eikä normaalin käytön tielle.
Katkaisu ei pysäytä Pi:tä. Client jatkaa cursorista, jos tapahtumat ovat vielä
saatavilla, muuten resnapshottaa. Selain
estää kirjoitukset yhteyden ollessa stale, reconnecting tai resnapshot-required.

`history.entry` käyttää Pi:n pysyvää entry-avainta `native_key`-kentässä.
Transienteille RPC-deltaeventeille daemon antaa omat event-ID:t; delta ei väitä
sisältävänsä Pi:n pysyvää entry-avainta ennen persistointia. UI käyttää
natiiviavainta lukukohdan ja ryhmän säilyttämiseen vain, jos avain löytyy myös
korvaavasta snapshotista/historiasta.

Snapshot on aina daemonin omalla instance-ID:llä, cursorilla ja ledger-epochilla
rakentama. Gateway ei rakenna `daemon_unavailable`- tai auth-snapshotia eikä lisää
event-ring-tapahtumia. Daemonin saavuttamattomuus on 503 ja kirjautumisen
vanheneminen 401. Logout tai session invalidointi sulkee kaikki siihen web-
istuntoon sidotut SSE-yhteydet; reconnect saa 401:n ja client merkitsee näkymän
reauthentication-required-tilaan.

## Komennon hyväksyntä ei ole sen suoritus

Command request sisältää UUID-muotoisen `client_command_id`:n, komennon tyypin,
kohteen, argumentit ja preconditionin. Olemassa olevaan resurssiin kohdistuva
komento käyttää workspace-/agentti-ID:tä; `workspace.create` ja
`workspace.github.clone` käyttävät `target.scope:user`-arvoa, koska kohdetta ei
vielä ole. Snapshotin `user_observation_token` sitoo tällaisen komennon todennettuun
web-identiteettiin ja daemonin avaaman `~/src`-descriptorin identiteettiin, joten
myös tyhjän käyttäjätilin ensimmäinen create on mahdollinen mutta vaihtunut tai
korvattu source root tekee preconditionista stalen. Jokaisen workspace- ja
agenttiobjektin `observation_token` sitoo daemonin sisäisesti sen nykyiseen
filesystem-/history-/process-/owner-identiteettiin paljastamatta inodea tai
polkua selaimelle.
Preconditionissa ovat snapshot-ID, event-cursor ja kohteen tämä token. Host tarkistaa
kyvyn, identiteetin, kohteen ja preconditionin ennen hyväksyntää. Event-cursorin
pitää kuulua nykyiseen instanceen ja olla vielä replay-ikkunassa, mutta unrelated
stream-event ei vanhenna komentoa: kohteen token/native revision ratkaisee
stalenessin. Näin steer ja interrupt toimivat assistant-deltan aikana.

`acceptance` tarkoittaa:

- `accepted`: daemon otti juuri tämän body-hashilla sidotun komennon vastuulleen;
- `rejected`: mitään toteutusta ei aloitettu;
- `uncertain`: yhteys-/owner-tilanne ei pysty todistamaan hyväksyntää eikä
  hylkäystä.

`execution` (`not_started`, `running`, `succeeded`, `failed`, `partial` tai
`unknown`) elää erikseen snapshotissa, queryssä ja SSE:ssä. HTTP 202 ei siis
lupaa Pi-vuoron, GitHub-operaation tai poiston onnistumista. Pitkä komento saa
`operation_id`:n ja vaiheistetun tuloksen. Hyvin muodostetun, todennetun komennon
domain-hylkäys palauttaa HTTP 200 command resultin (`acceptance:rejected`) ja
retainoidaan samalla ID:llä; protocol-, auth-, origin- ja CSRF-virheet käyttävät
4xx error-envelopea eikä niitä lisätä ledgeriä. Query palauttaa myös retained
hylkäyksen.

Idempotencyavain on `(todennettu web-identiteetti, client_command_id)` koko
käyttäjädaemonissa, ei vain yhdessä tabissa. Sama ID ja rakenteellisesti sama,
tiukan JSON-parsinnan läpäissyt request palauttaa alkuperäisen tuloksen: objektien
avainjärjestys ja whitespace eivät merkitse, mutta array-järjestys, stringin
koodipisteet ja kaikki precondition-kentät merkitsevät. Sama ID eri bodyllä
torjutaan `command_id_conflict`-virheellä. Komentotulosten säilytyksen pitää
palvella tavallista katkoista palautumista ilman tarpeetonta säilytysrakennetta.
`expires_at` kertoo säilytetyn tuloksen ylärajan. Snapshot kuljettaa vain ei-terminaaliset
ledger-entryt; muut haetaan command querystä. Ledger ei ole historia tai
prosessirekisteri.

Snapshotin `auth` erottaa web-providerin ja vakaan provider-account-ID:n native GitHubin
tilasta. `native_github.state` on `connected`, `disconnected`, `pending`, `partial` tai
`unknown`; `partial` ei anna GitHub-kirjoituskykyä. Workspace-capability voi sisältää
tuoreeseen observation-tokeniin sidotun exact GitHub repository -haasteen. Fresh-authia
ja vahvistusta vaativa `identity.github.disconnect` käyttää `target.scope:user`-kohdetta,
poistaa vain mapped Unix -käyttäjän paikallisen `gh`-authin ja palauttaa successin vasta
kun poissaolo on havaittu. Se ei väitä OAuth-tokenia revokoiduksi. `agent.queue.clear`-
tulos sisältää todella poistetut source-ryhmitellyt arvot ja `queue_revision`-arvon;
saman revision pitää näkyä snapshotin `agent.queue.revision`-kentässä ja
`queue.changed.payload.revision`-kentässä ennen kuin client pitää näkymää ajan tasalla.

Ledgerin `epoch` vaihtuu daemonin käynnistyessä. Daemon-restartin tai evictionin
jälkeen ID:n puuttuminen ei todista, ettei komento mennyt Pi:lle tai levylle.
Siksi epävarmaa komentoa ei lähetetä automaattisesti uudelleen. Client hakee
ensin uuden snapshotin ja command queryn. Jos hyväksyntää ei voida todistaa,
tilaksi jää uncertain. Käyttäjän tietoinen uusi lähetys saa uuden ID:n ja UI:n
pitää näyttää kaksoisvaikutuksen mahdollisuus. Vain ennen lähetystä paikallisesti
epäonnistunut validointi on turvallisesti lähettämättä jäänyt.

Stale snapshot, cursor, observation token tai muuttunut native revision tuottaa
`409 stale_precondition`, `fresh_snapshot_required:true`. Selainkeskustelulla
on yksi daemonin omistama kirjoittaja. Testijärjestelmää käytetään niin, etteivät
SSH/tmux tai itsenäiset clientit ohjaa samaa keskustelua samanaikaisesti.

## Adapterin kyvyt ja agentin tilat

Jokainen snapshot ilmoittaa kyvyn tilalla `supported`, `unsupported`, `unknown`
tai `temporarily_unavailable` ja vakaalla syykoodilla. Kirjoittava kontrolli
näytetään vain `supported`-tilassa. Muut tuottavat `capability_unsupported`,
`capability_unknown` tai `capability_temporarily_unavailable`; selain ei päättele
kykyä napin tai historian olemassaolosta.

Pi 0.85.1 -näytön perusteella adapteri voi merkitä seuraavat tuetuiksi vain
omistamalleen RPC-prosessille:

- `agent.start` ja päättyneen historian `agent.resume` samalla natiivilla ID:llä;
- `agent.message`, `agent.steer`, `agent.follow_up` ja koko jonon
  `agent.queue.clear`;
- nykyisen vuoron `agent.turn.interrupt` (`abort`), ei yleistä prosessipuun killia;
- tunnetun daemon-ownerin `agent.process.stop`.

`clear_queue` tyhjentää kokonaiset steer- ja follow-up-jonot; per-message cancelia
tai mielivaltaista reorderia ei ole. Steering toimitetaan Pi:n mukaisesti tool
callien jälkeen, ei kesken työkalun. Tavallinen chat ei lupaa geneeristä
kysymysskeemaa. `agent_settled` on idle-raja, ei pelkkä `agent_end`.

Terminaalin historia on vain luettava; selain ei siirrä sen ohjausta itselleen
eikä pysäytä terminaalin prosessia. Päättynyttä selainkeskustelua jatketaan sen
omasta natiivihistoriasta, kun aiempi työ tiedetään päättyneeksi.

Pi:n erillisiä kysymysdialogeja, niihin vastaamista tai niiden perumista ei
toteuteta nykyiseen tuotteeseen. Skeemoissa ennestään olevat
`agent.question.respond`, `pending_question` ja `transfer_possible` eivät
velvoita toteuttamaan näitä kykyjä: kysymys- ja haltuunottokyvyt eivät ole
tuettuja, eikä niitä tarjota selaimessa.

### Keskustelun generoitu otsikko

Otsikkoadapterin valittu malli on `openai-codex/gpt-5.6-luna`, low thinking,
enintään 16 KiB syötettä, 120 Unicode-merkin tulos ja 0,02 USD:n kustannuskatto.
Pi:n kertakutsumekanismi pitää todentaa ennen kyvyn tarjoamista käyttäjälle.

Otsikko alkaa arvolla “Uusi keskustelu”. Ensimmäisen viestin jälkeen daemon voi
näyttää itse muodostamansa rajatun alun `first_message_fallback`-lähteenä. Selain
ei generoi eikä omista otsikkoa. Mallikutsun syöte on enintään ensimmäisten neljän ja viimeisten neljän käyttäjäviestin uniikki unioni keskustelujärjestyksessä; alle kahdeksan viestin keskustelussa samaa viestiä ei toisteta.

Hyväksytty toiminta vaatii daemonin omistaman `conversation.title.generate`-
komennon, joka tekee yhden Pi-mallikutsun agenttiloopin ulkopuolella. Tätä
adapteria ei ole vielä todennettu: capability on siihen asti `unknown` syyllä
`adapter_not_verified`, eikä sopimus väitä mallikutsua toimivaksi. Kun adapteri
on todennettu, komento näyttää erikseen pending-, succeeded- ja failed-tilan.
Onnistuminen korvaa atomisesti vain annotaation otsikon. Epäonnistuminen säilyttää
edellisen onnistuneen otsikon tai fallbackin eikä estä keskustelua. Otsikon vieressä oleva saavutettava manuaalinen regenerate lähettää uuden command ID:n vain capabilityn ollessa supported; pending estää rinnakkaisen auto/manual-kutsun ja failure on ei-estävä. Automaattinen ensimmäinen yritys tapahtuu ensimmäisen hyväksytyn viestin jälkeen ja enintään yksi automaattinen uudelleengenerointi kolmannen viestin asetuttua. Selain ei kovakoodaa triggeriä.

## Vaiheistetut host-operaatiot

Workspace-, Git-, GitHub-, Taskfleet- ja arkisto-operaatio palauttaa
vaiheet. Vaiheen tila on `pending`, `running`, `confirmed`, `failed`, `unknown`
tai `skipped`. Aikaisempi confirmed ei muutu failediksi myöhemmän virheen vuoksi.
Operaation lopputila `partial` tarkoittaa toteutuneita vaikutuksia ja keskeneräistä
tavoitetta, ei rollbackia.

Retry käyttää aina uutta client command ID:tä ja tuoreen snapshotin
`observation_token`ia. Host saa jatkaa turvallisesta vaiheesta vain, jos Git,
GitHub, Taskfleet, prosessi ja tiedostolähde vahvistavat aiemman vaikutuksen.
Katkennut yhteys ei peru daemonin operaatiota. Selain sovittaa sen myöhemmin
operation-ID:llä.

- **Create / Git init:** hakemisto voi olla olemassa vaikka myöhempi Git-portti
  tai agent start epäonnistuu.
- **GitHub create:** remote-repo, `origin`, permission/transport ja tavallinen
  `git push` ovat eri vaiheita. Remotea ei väitetä poistetuksi push-virheessä.
- **Clone:** osittainen hakemisto säilyy natiivissa listassa failed/incomplete-
  tilassa.
- **Taskfleet-worktree:** vain Taskfleetin täysi omistajuus sallii create/teardownin.
  Create saa Taskfleetin tukemat `source_branch`, `title` ja `task`-arvot;
  Taskfleet määrää ja raportoi lopullisen branchin. Kyky on `unknown`/
  `adapter_not_verified`, kunnes create/partial-teardown-adapteri on kokeiltu.
  Manuaalinen tai tuntematon worktree on read-only vaikutus.
- **Archive:** vain idle tai varmasti päättynyt keskustelu voidaan arkistoida.
  Aktiivinen writer tuottaa `writer_conflict`-hylkäyksen; käyttäjä tekee erillisen
  stopin ensin. Stop ja annotaation archive ovat eri komentoja/vaiheita; historia
  ei siirry eikä kopioidu. Continue käyttää samaa resume-ID:tä.
- **Delete:** valmistuminen vaatii tuoreen `~/src`-listauksen, joka vahvistaa
  kohteen poissaolon. Residual prosessi, Git-metadata tai ulkopuolinen worktree
  jää näkyväksi partial-efektiksi.

### Polut ja poisto

Selain lähettää workspace-ID:n, ei käyttöjärjestelmäpolkua. Daemon aloittaa
avatusta `~/src`-directory descriptorista, hyväksyy vain välittömän ei-symlinkki-
hakemiston ja säilyttää filesystem identityn revalidointia varten. Create-nimi on
yksi basename: ei tyhjä, `.`, `..`, separator, NUL tai canonical escape.

Jokainen mutaatio avaa kohteen uudelleen descriptor-relatiivisesti eikä seuraa
workspace- tai descendant-symlinkkejä. Toteutus käyttää Linuxin no-follow-
rajoja (esimerkiksi `openat2`-semantiikkaa, jos host-stack valitsee sen) eikä
`realpath` + string-prefix + `rm -rf <browser-string>` -mallia. Replacement,
rename, owner/mode-muutos, mount boundary, lukematon entry tai lähderajan ylitys
torjutaan. Tuntematon mount/prosessi/worktree-vaikutus estää tuhoavan operaation.

Poiston käyttäjän syöttämä `confirmation` on täsmälleen snapshotin
`workspace.name` (Unicode-koodipisteittäin, ilman trimmausta). Serverin
`observation_token` sitoo sen workspace-ID:hen ja lähteen filesystem identityyn;
väärä nimi tai token tuottaa `confirmation_mismatch`/`stale_precondition`.
Preflight listaa managed ja observed prosessit, Taskfleet-runien omistajuudet,
Git-worktreet myös `~/src`:n ulkopuolella, nested mountit ja tuntemattomat.
Managed prosessi pysäytetään omistajan kautta ja history settlement vahvistetaan.
Taskfleet-worktree puretaan Taskfleetin kautta. Jäljellä oleva manuaalinen tai
tuntematon linked worktree estää main-workspacen poiston.

## Minimaaliset annotaatiot

Workspace-asetus on `<workspace>/.agent-host/workspace.json` ja sisältää vain
`schema_version`, vakaan `workspace_id`:n ja valinnaisen `display_name`:n.
Hakemisto on workspace ilman tiedostoa. Runtime, credentialit, Git-faktat,
Pi-historia tai PID eivät kuulu tiedostoon.

Käyttäjän harva esitystila on
`${XDG_STATE_HOME:-~/.local/state}/native-agent-host/state-v1.json`, mode 0600,
ja parent-hakemisto mode 0700. Se kirjoitetaan saman hakemiston temp-tiedostoon,
`fsync`ataan ja nimetään atomisesti. Se sisältää vain:

- workspacekohtaisen `hidden`-arvon ja ajan, avaimena vakaa workspace-ID.
  Piilottaminen on itsessään tarve luoda workspace-asetustiedosto ja ID ensin;
  basenameen sidottua väliaikaista piilotusta ei tallenneta;
- conversationkohtaisen `archived_at`:n;
- viimeisimmän onnistuneen, korvattavan generoidun otsikon, ajan ja
  `generator: pi_one_off`-provenienssin;
- valinnaisen parent-contextin vain, jos native Taskfleet- tai Pi-extension-
  yhteyttä ei voi myöhemmin luotettavasti johtaa. Siinä on lähde, capture-aika ja
  joko parent agent ID tai Taskfleetin täysi run/node-ID.

Native Taskfleet-fakta voittaa annotaation ja ristiriita näytetään. Annotaatio ei
vanhenna Pi-historiaa; orphan entry voidaan siivota vasta erillisellä turvallisella
maintenance-toimella. Puuttuva tai vioittunut tiedosto hukkaa vain piilotuksen,
arkiston, generoidun otsikon ja annotated parentin. Se tuottaa
`source.warning`-eventin tai partial source -faktan, ei tyhjää historiaa.
Tuntemattoman version tai korruptoituneen tiedoston päälle ei kirjoiteta
hiljaisesti.

## Virheet

Kaikki JSON-virheet käyttävät [`error.schema.json`](../contracts/v1/error.schema.json)-
envelopea stderrin sijasta HTTP-bodyna ja sopivaa HTTP-statusta. Viesti on
käyttäjälle turvallinen; `correlation_id` yhdistää redaktoituun lokiin. `retryable`
ei yksin valtuuta uusintaa: `fresh_snapshot_required` vaatii ensin resnapshotin.
Vakaat vähimmäiskoodit ovat:

| HTTP | Koodi | Merkitys |
|---:|---|---|
| 400 | `invalid_request`, `schema_version_unsupported` | muotoa ei hyväksytty; mitään ei aloitettu |
| 401 | `authentication_required`, `session_expired` | uudet luvut ja kirjoitukset estetty |
| 403 | `origin_denied`, `csrf_denied`, `identity_mapping_denied`, `peer_not_authorized`, `cross_user_denied` | luottamusraja torjui pyynnön |
| 404 | `resource_not_found`, `command_outcome_unknown`, `content_revision_gone` | ei saa tulkita toisen käyttäjän olemassaoloa |
| 409 | `stale_precondition`, `command_id_conflict`, `cursor_expired`, `cursor_instance_mismatch`, `writer_conflict`, `path_replaced`, `manual_worktree_blocks_delete` | nykytila estää turvallisen etenemisen |
| 422 | `capability_unsupported`, `capability_unknown`, `path_unsupported`, `path_escape`, `confirmation_mismatch` | pyyntö on ymmärretty mutta sitä ei voi toteuttaa |
| 503 | `daemon_unavailable`, `native_source_unavailable`, `capability_temporarily_unavailable` | tila on tilapäisesti saavuttamaton; kirjoituksia ei arvata |
| 500 | `native_adapter_error`, `operation_partial`, `annotation_corrupt` | tarkka osatulos/fakta säilyy ja näytetään; `annotation_corrupt` koskee vain annotaatiota kirjoittavaa komentoa, ei snapshot/history-lukua |

Tuntematon virhekoodi näytetään geneerisesti, mutta status, correlation-ID ja
`fresh_snapshot_required` säilytetään. Selain ei päättele onnistumista HTTP-yhteyden
katkeamisesta eikä piilota osittaisia vaikutuksia.

## Toteutuksen sopimustestit

[`scenarios.json`](../contracts/v1/scenarios.json) on toteutuksen yhteinen,
tekniikkariippumaton skenaarioluettelo. Se kattaa kaksi käyttäjää ja ristiinpääsyn
torjunnan, snapshot/SSE-racen, replayn, aukot, backpressuren, duplikaatti- ja
epävarmat komennot, browser/daemon-katkokset, terminaalihistorian lukemisen, pitkän ja epäluotetun
sisällön, otsikon epäonnistumisen/uusinnan, path escapet, osittaiset operaatiot,
Taskfleet-omistajuuden sekä annotaatiokorruption.

Toteutus sitoo jokaisen CT-tunnuksen vähintään yhteen ajettavaan integration- tai
browser-testiin. Mock ei läpäise native capability -skenaariota. Kahden käyttäjän
testi käyttää eri synteettisiä UID:itä ja sentinel-dataa. Path- ja poistotestit
käyttävät disposable filesystemiä. GitHub-write vaatii erikseen valtuutetun
disposable-remoten. Testi vertaa lopputulosta aina natiiviin lähteeseen, ei vain
HTTP-vastaukseen.

## Operaatioiden tulokset ja vahvistukset

`GET /api/v1/operations/<operation-id>` palauttaa saatavilla olevan
terminaalisen operaation tuloksen nykyisessä daemon-epochissa. Snapshot
kuljettaa ei-terminaaliset operaatiot. Puuttuva, vanhentunut tai edellisen
epochin tulos on `operation_outcome_unknown`, ei onnistuminen.

Onnistunut `agent.queue.clear` palauttaa todella poistetut tekstit erikseen
steering- ja follow-up-ryhmissä, alkuperäisillä indekseillä ja Pi:n
lähdejärjestyksessä sekä tyhjennyksen jälkeisen queue-revision. UI palauttaa
editoriin vain nämä arvot; stale, failed tai uncertain ei palauta mitään.

GitHub-create-preflight antaa tuoreeseen observation-tokeniin sidotun
`exact_repository`-haasteen ja odotetun `owner/repository`-arvon. Käyttäjän
confirmation vastaa sitä täsmälleen ilman trimmausta tai kirjainkoon muutosta.
GitHub-toiminnon näyttöön kuuluu yksi luvallinen yksityisen testirepositorion
create/push/clone/delete-koe mapped daemon -ympäristöstä; laajaa kahden ihmisen
kirjoituskampanjaa ei tarvita.

Natiivista stderristä tai lähteestä tuleva vapaa teksti redaktoidaan ennen
`message`, `detail` ja `description` -kenttiä: home-polku muuttuu `<HOME>`-muotoon,
muun käyttäjän absoluuttista polkua ei palauteta ja URL-userinfo/credential poistetaan.
Git/gh-kutsut käyttävät argv:ta, lisäävät `--` ennen positionaaleja ja validoivat
owner/repository/workspace/branch-arvot skeeman mukaan.

`workspace.git.init` tuottaa `git_init`-operaation. Command resultin valinnainen
`created` ja operation-efektit sitovat onnistuneen create/startin uuteen
workspace-/agentti-ID:hen. Snapshotin `presence` ja täydet changed-eventit
välittävät myös vahvistetun poiston.

Agentin `activity` ja `live_tail` kuvaavat watermarkissa auki olevaa vuoroa.
Live-tail käyttää samoja event-ID/cursor-envelopeja ja client deduplikoi ne
ennen watermarkia seuraavaa streamia. Käyttäjän pitää voida palautua ajantasaiseen
näkymään myös pitkän vuoron aikana. Tarvittavan tailin koko ja toteutustapa
valitaan havaitusta tarpeesta; vanha tapahtumamäärä ei ole hyväksymisraja.
Nykyisen skeeman `pending_question` jää tyhjäksi, koska kysymysdialogeja ei tueta.

Workspace-renamen vaikutus Pi:n cwd-yhdistykseen, mount/symlink-racet,
daemon-crashin jälkeinen natiivitila ja Taskfleetin osittaiset virheet
todennetaan niitä toteuttavissa issueissa. Tuntematon tila näytetään
tuntemattomana.
