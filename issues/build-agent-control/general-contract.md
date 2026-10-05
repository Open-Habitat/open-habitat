# Yleinen komento- ja operaatiosopimus (sovittu, toteuttamaton)

Siirretty `docs/interfaces.md`-sivulta 2026-10-03, kun dokumentaatio kirjoitettiin kuvaamaan vain nykyistä toteutusta. Tämä on suunnitelma: yleinen `/api/v1/commands`- ja `/api/v1/operations`-pinta, komennon hyväksynnän ja suorituksen erottelu, työtilan muutosten osittaiset tulokset sekä annotaatiot. Skeemat ovat `contracts/v1/`-hakemistossa (`command`, `operation`, `annotations`).

## Versioitu HTTP-pinta

V1-JSON käyttää `Content-Type: application/json` ja `schema_version: 1`.
Tuntematon pääversio hylätään. Skeeman vastaiset kentät, tunnisteet ja rajat
hylätään korjailematta syötettä. Valinnaisia kenttiä voidaan lisätä v1:een
merkitystä rikkomatta; kentän poisto, uudelleennimeäminen tai tyypin,
nullabilityn tai järjestystakuun muutos kuuluu uuteen versioon. Tiukkojen
validaattorien ja generoitujen tyyppien pitää vastata käytössä olevaa skeemaa.
Pyynnöt ja vastaukset eivät kuljeta Unix-käyttäjänimeä tai absoluuttista home-polkua.

Seuraavat yleiset reitit ovat sovittu, vielä toteuttamaton pinta:

| Metodi ja polku | Merkitys |
|---|---|
| `POST /api/v1/commands` | komennon hyväksyntä, [command-skeema](../../contracts/v1/command.schema.json) |
| `GET /api/v1/commands/<client-command-id>` | saatavilla oleva hyväksyntä- ja suoritustulos |
| `GET /api/v1/operations/<operation-id>` | saatavilla oleva päättyneen operaation tulos, [operation-skeema](../../contracts/v1/operation.schema.json) |

### Snapshot ja yhdistetty SSE

SSE-yhteys välittää Pi:n vastauksen ja työn etenemisen selaimeen sitä mukaa
kuin Pi työskentelee. Jos selainyhteys katkeaa, Pi jatkaa työtään. Yhteyden
palattua selain hakee katkon aikana syntyneet tapahtumat. Jos niitä ei enää
ole saatavilla, selain hakee uuden tilannekuvan ja keskustelun Pi:n historiasta.

Toteutettu yksityinen ohjainreitti käyttää toistaiseksi
`POST /api/v1/conversations/{id}/send`-pyynnön `command_id`-tunnusta ja
`GET /api/v1/conversations/{id}/receipt?command_id=<uuid>`-hakua varsinaisen
`/api/v1/commands`-sopimuksen sijaan. Vastaanottokuittaus on
`pending | accepted | rejected | uncertain`; `accepted` edellyttää Pi:n
korreloitua RPC-vastausta, ei valmistunutta vuoroa. Myös status sisältää
viimeisen komennon `send_receipt`-arvon, jos komento oli lähetys. Kuittaukset ja
`command.changed`-eventit ovat vain daemonin muistin mittaisia: uudelleenkäynnistyksen
jälkeen puuttuvaa kuittausta ei tulkita hylkäykseksi eikä viestiä lähetetä
automaattisesti uudelleen. Gateway reitittää haun kirjautuneen Unix-käyttäjän daemonille.

Pi:n `agent_settled` on vuoron päättymishavainto, ei `message_end`.
Statuskenttä `turn_settled` ja `turn.settled`-eventti sisältävät daemonin
havaintoajan ja viimeksi tällä vuorolla julkaistun, tarkistetusta JSONL:stä
luetun assistant-avaimen (`native_key`). Jos avainta ei voi todentaa,
`state: unknown` ja tyhjä avain ilmoittavat rajan, eikä UI saa näyttää
vahvistettua valmistumista. `state: settled` ei lupaa onnistunutta lopputulosta.
`pending_question` ja `question.requested`
välittävät Pi:n extension UI -pyynnön rajatun ID:n, metodin (tuntematon on
`unknown`), otsikon/viestin ja valinnat *tekstinä*, ei HTML:nä.
Pi:n ilmoitukset ja tilapäivitykset eivät korvaa odottavaa kysymystä;
ne kulkevat `unknown.native`-eventtinä rajattuna tekstinä.
Erillinen `POST /api/v1/conversations/{id}/question` ottaa vastaan odottavan
`request_id`:n ja `action: answer | cancel`. `input`- ja `select`-vastauksen
`value` on teksti, `confirm`-vastauksen totuusarvo; perumisessa arvo puuttuu.
Tuntemattoman tyypin saa perua mutta ei vastata. Daemon kuluttaa ID:n ennen
Pi:n RPC-kirjoitusta ja palauttaa myös onnistuneesta HTTP-pyynnöstä `uncertain`:
Pi ei anna korreloitua kuittausta. 409 kertoo vanhentuneesta tai jo käytetystä
pyynnöstä. Selain merkitsee yrityksen ennen lähetystä eikä toista sitä, vaikka
vastaus katoaisi tai sivu ladattaisiin uudelleen. Tilapäivitys voi näyttää
seuraavan jonossa olleen kysymyksen, ei todistaa edellisen toimitusta.
Tavallinen viesti ei ratkaise `extension_ui_response`-pyyntöä.
Selain saa esittää tekstin vain tekstisolmuna, ei HTML:nä.

Viestin lähetys ja etenemisen seuraaminen ovat eri asioita. Jos lähetyksen
kuittaus katoaa, selain selvittää viestin tilanteen palvelimelta. Jos tilanne
jää epäselväksi, käyttäjä näkee sen epävarmana. Automaattinen uudelleenlähetys
voisi teettää saman työn kahdesti, joten päätös uudesta yrityksestä jää käyttäjälle.

Toteutettu välivaihe käyttää muistissa 128 tapahtuman / 1 MiB:n toistoikkunaa
käyttäjän daemonissa. Pi:n nopeat välitulokset yhdistyvät enintään noin 250 ms:n
mittaiseen trailing-ilmoitukseen; jokainen viimeinenkin muutos saa ilmoituksen.
Muutos ilmoitetaan `snapshot.invalidated`-eventillä:
selain hakee sen jälkeen uuden snapshotin ja tarvittaessa natiivihistorian.
Daemonin omistaman Pi:n hyväksytty `queue_update` julkaistaan lisäksi
`queue.changed`-eventtinä samassa järjestyksessä kuin RPC-kehys vastaanotetaan.
Se on hetkellinen jonohavainto, ei kuittaus yksittäisen komennon hyväksynnästä.
Yleinen snapshot lukee yhä vain natiivihistoriaa eikä sen queue-revision vastaa
tämän ohjaimen jonoa: uusi snapshot syrjäyttää jonoeventin, eikä vielä
toteuta kesken vuoron jatkamisen takuuta. Pi:n `agent_settled`-havainnon jälkeen
JSONL:stä luetut `history.entry`-merkinnät syntyvät tästä reitistä;
delta- ja workspace-eventit eivät vielä synny. Snapshotin watermark otetaan ennen natiivilukua, joten
sen aikana syntyneen muutoksen invalidointi voidaan myös toistaa. Nykyisen
kuvan ja streamin päällekkäisyys ei todista atomista näkymää samaan kellonhetkeen.
Yhteys kestää enintään 10 minuuttia, sykettä lähetetään 20 sekunnin välein, daemonin kirjoitusaika enintään 11 minuuttia ja
gateway katkaisee yli 10 sekuntia jumittuneen kirjoituksen. Gateway ei rajoita
terveen virran kehysten tai kokonaisrungon määrää; daemon päättää virran
eliniän. Selain käyttää tätä ainoana työntökanavana.

[Snapshot](../../contracts/v1/snapshot.schema.json) on daemonin muodostama
tilannekuva. Sen `event_cursor` kertoo, mihin asti tapahtumat ovat mukana
kuvassa. Selain näyttää kuvan ja alkaa vastaanottaa sitä seuraavia tapahtumia.
Näin myös tilannekuvan haun aikana syntyvät muutokset tulevat selaimeen.

Cursor on `ev1:<server-instance-uuid>:<sequence>`. Daemonin `server_instance_id`
erottaa virran eri elinkaaret; `snapshot_id` tunnistaa yksittäisen kuvan. SSE:n `id` vastaa bodyn cursoria, `event` sen
kind-arvoa ja `data` sisältää yhden minifioidun JSON-objektin. Tapahtumalla on
oma `event_id`. Uudelleenyhdistämisessä `Last-Event-ID` ohittaa URL:n alkuperäisen
`after`-arvon. Jo sovellettu sequence on duplikaatti; seuraava on täsmälleen
`last+1`. Aukko tai saman sequencen ristiriitainen event-ID tekee näkymästä
vanhentuneen ja vaatii uuden snapshotin.

Snapshotin `oldest_replay_cursor` kertoo saatavilla olevan toiston rajan.
Liian vanha cursor saa `409 cursor_expired`, toisen elinkaaren cursor
`409 cursor_instance_mismatch`; nämä vastataan ennen SSE-headereita.
Hidas yhteys voidaan katkaista. Selain palautuu cursorista tai uudella
snapshotilla, ja kirjoitukset ovat estettyinä, kunnes näkymä on taas ajan
tasalla. Katkos ei pysäytä Pi:tä. Istunnon päättyminen estää uuden virran,
mutta ei keskeytä jo avattua virtaa: se sulkeutuu viimeistään kymmenen minuutin
eliniän päättyessä. Uudelleenyhdistäminen vaatii kirjautumisen.

`history.entry` käyttää Pi:n pysyvää `native_key`:tä; vielä tallentamattomilla
RPC-deltaeventeillä on daemonin event-ID. Snapshotin `activity` ja `live_tail`
mahdollistavat paluun myös kesken vuoron. Täsmällinen sovitussääntö: snapshotin `live_tail` sisältää saman agentin
väliaikaiset event-kehykset tapahtuma-ID:ineen. Selain näyttää ne kerran ja
jatkaa vain snapshotin `event_cursor`-arvon jälkeisestä sequencestä. RPC ei
anna pysyvää avainta, joten sisältöä ei yhdistetä tekstiä vertaamalla:
Pi:n JSONL:stä luettu `history.entry` (erityisesti `assistant`) korvaa
**koko saman agentin väliaikaisen vuorotailin** natiivihistoriasta luetuilla
merkinnöillä. Selain deduplikoi pysyvät merkinnät `native_key`:llä; se ei
lisää niiden tekstiä deltan perään. Jos natiivi merkintä puuttuu vielä,
väliaikainen tail säilyy seuraavaan merkintään asti. Cursor-aukko, 409 tai
`snapshot.invalidated` vaatii uuden snapshotin ja natiivihistorian ennen
kirjoituksia; epävarmaa komentoa ei lähetetä uudestaan.

Daemonin controller-tilan `activity`, `live_tail` ja cursor kopioidaan saman
journal-lukon alla. Tekstideltoja yhdistetään enintään 50 ms ja 4096 tavuun;
työkalun aloitus tai lopetus pakottaa aiemman tekstin ensin ulos. Sisällöttömiä natiiveja työkalun välipäivityksiä ei julkaista, jotta ne eivät syrjäytä muiden agenttien toistoa. Muisti- ja toistorajat
voivat katkaista väliaikaisen tailin; `ring_truncated` vaatii historian uudelleenluvun.
Natiivin tiedostojärjestelmän havainnot tehdään ennen controllerin lukittua
leikkausta, eivätkä ulkopuoliset Pi-/terminaalikirjoitukset kuulu samaan
atomiseen hetkeen. Tällainen muutos havaitaan vain uudella natiivihistorian
luvulla tai `snapshot.invalidated`-tapahtumalla; etenkin daemonin ulkopuolisen
kirjoittajan muuttumista juuri snapshot-luvun jälkeen ei voida todistaa
pelkällä cursorilla. Selain hakee historian myös aukossa ja palatessaan
kesken vuoron. Gateway ei muodosta omaa snapshotia tai tapahtumia:
saavuttamaton daemon on 503, puuttuva autentikointi 401.

### Komennon hyväksyntä ei ole sen suoritus

Komennolla on `client_command_id`, kohde, argumentit ja ennakkoehto.
Olemassa oleva kohde valitaan workspace- tai agentti-ID:llä. Uuden työtilan
luonti ja kloonaus käyttävät käyttäjäkohdetta, koska työtilaa ei vielä ole.
Snapshot-ID, cursor ja kohteen `observation_token` sitovat pyynnön havaittuun
tilaan. Käyttäjäkohteen token sitoo myös avatun `~/src`-juuren identiteetin.
Cursorin pitää kuulua nykyiseen elinkaareen ja toistoikkunaan. Muun
keskustelun tapahtuma ei yksin vanhenna kohteen tokenia.

Daemon tarkistaa identiteetin, kyvyn, kohteen ja ennakkoehdon ennen hyväksyntää.
`accepted` kertoo vastaanotosta, `rejected` ettei suoritusta aloitettu ja
`uncertain` ettei kumpaakaan voida todistaa. Suorituksen tila elää erikseen:
hyväksytty komento voi yhä olla kesken, epäonnistunut tai osittain toteutunut.
Uusi hyväksyntä palauttaa 202; säilytetty duplikaatti tai hyväksyntävaiheen
toimialahylkäys palauttaa 200 command resultin. Protokolla-, autentikointi-,
Origin- ja CSRF-virheet käyttävät 4xx-virhevastausta eikä niitä säilytetä
komentotuloksina.

Sama todennettu web-identiteetti ja komento-ID tarkoittavat samaa yritystä
koko daemonissa. Rakenteellisesti sama request palauttaa säilytetyn tuloksen;
JSON-avainten järjestys ja whitespace eivät merkitse, mutta taulukoiden järjestys,
merkkijonot ja ennakkoehdot merkitsevät. Sama ID eri sisällöllä antaa
`command_id_conflict`. Säilytysajan ylärajan kertoo `expires_at`.
Snapshotissa ovat keskeneräiset tulokset; päättyneet haetaan kyselyllä.

Komentotulosten `epoch` vaihtuu daemonin käynnistyessä. Puuttuva tai vanhentunut
tulos on `command_outcome_unknown` tai `operation_outcome_unknown`, ei todiste
siitä, ettei mitään tapahtunut. Selain hakee tuoreen tilanteen eikä lähetä
epävarmaa komentoa automaattisesti uudestaan. Tietoinen uusi yritys saa uuden
ID:n, ja käyttäjälle kerrotaan mahdollisesta kaksoisvaikutuksesta.
Vanhentunut snapshot, cursor tai muuttunut kohde tuottaa
`409 stale_precondition` ja `fresh_snapshot_required`.

### Ohjauskyvyt ja otsikointi

Kyky tarjotaan vain `supported`-tilassa. Muut tilat ovat `unsupported`,
`unknown` ja `temporarily_unavailable`, aina syyn kanssa. Skeeman kentän
olemassaolo ei lupaa toimivaa adapteria.

Sovittu selainohjaus kattaa daemonin omistaman Pi:n käynnistyksen, viestit,
steering- ja follow-up-jonot, jonojen tyhjennyksen, vuoron keskeytyksen ja
prosessin pysäytyksen. Päättynyt selainkeskustelu jatkuu samalla natiivilla
ID:llä, kun aiempi työ tiedetään päättyneeksi. Yhdellä keskustelulla on yksi
kirjoittaja. Samaa keskustelua ei ohjata samanaikaisesti selaimesta,
SSH/tmuxista tai toisesta itsenäisestä clientista. Terminaalihistoria säilyy
vain luettavana.

Agentilta saapuva käyttäjälle tarkoitettu sisältö näytetään. Myös kysymys näytetään,
vähintään tekstinä, vaikka sen dialogityypille ei olisi omaa käyttöliittymää.
`pending_question` kertoo odottavasta kysymyksestä, kun tämä tieto saadaan
Pi:ltä. Viestityypin tai sisältölohkon oman esitystavan puuttuessa käyttäjälle
tarkoitettu sisältö säilyy luettavana turvallisena tekstinä. Salatut payloadit
ja tekninen metadata eivät kuulu keskusteluviesteihin; salatun thinking-lohkon
pois jättämisestä ei tarvita varoitusta. Aidosti tuntematon sisältö esitetään
hillitysti, ja sen tarkemmat tiedot voi avata tarvittaessa. Sama tulkinta koskee
historiaa ja reaaliaikaista keskustelua. Tämä on sovittu tavoite;
[lohkojen käsittelyn toteutus](../../issues/raw-thinking-history-blocks/item.md)
korjaa nykyisen raakaa JSONia näyttävän varamenettelyn.
Terminaalin ohjauksen haltuunotto on nykyisen toteutustyön ulkopuolella.

Vuoron keskeytys on Pi:n `abort`, ei lupaus koko prosessipuun päättymisestä.
Steering toimitetaan Pi:n mukaisesti tool callien jälkeen. `agent_settled`
on idle-raja. `agent.queue.clear` tyhjentää kokonaiset jonot ja palauttaa vain
poistetut tekstit alkuperäisissä steering/follow-up-ryhmissä, indekseissä ja
järjestyksessä sekä uuden queue-revision. Sama revision näkyy snapshotissa ja
queue-eventissä. Epävarma tai epäonnistunut tyhjennys ei palauta tekstejä editoriin.

Otsikointi täydentää Pi:n natiivin istuntonimen käytön selaimeen: sama nimi
näkyy keskustelussa, navigaatiossa ja Pi:n terminaalin istuntolistassa.
[Otsikointityö](../generate-conversation-titles/item.md) määrittää yhdessä
luetun tavoitteen, automaattisen nimeämisen ajoituksen, olemassa olevan nimen
suojauksen ja käyttäjän pyytämän uudelleengeneroinnin. Se korvaa tämän
sopimuksen aiemmat otsikkokohtaiset malli-, syöte-, kustannus- ja
tallennusvalinnat. Pi:n nimen tallennustuki ei yksin todista automaattista
generointikykyä; puuttuva kyky ja oikea Pi-yhteys todennetaan siinä työssä.

## Työtilan muutokset ja osittainen tulos

Yleisen komentosopimuksen workspace-, GitHub-, Taskfleet- ja arkistotoiminnot
kuuluvat [toteutusissueille](item.md). Operaation vaiheet säilyttävät
omat tuloksensa: onnistunut hakemiston tai GitHub-repon luonti ei peruunnu
siksi, että Git init, push tai agentin käynnistys epäonnistuu. `partial` tarkoittaa
toteutuneita vaikutuksia ja keskeneräistä tavoitetta. `created` ja operation-
efektit yhdistävät onnistuneen luonnin uuteen workspace- tai agentti-ID:hen.
Snapshotin `presence` ja changed-eventit kertovat myös vahvistetusta poistosta.

Katkennut selainyhteys ei peru yleistä host-operaatiota. Sen tulos sovitetaan
operation-ID:llä ja tuoreilla natiivihavainnoilla. Tämä ei koske ADR 0005:n
erillistä kloonivirtaa. Uusi yritys saa uuden komento-ID:n ja tuoreen
observation-tokenin; turvallisesta vaiheesta jatkaminen vaatii todisteen
aiemmista vaikutuksista.

Selain käyttää workspace-ID:tä, ei käyttöjärjestelmäpolkua. Uusi nimi on yksi
hakemistonimi. Daemon avaa kohteen uudelleen avatun `~/src`-hakemiston kautta,
seuraamatta symlinkkejä tai ylittämättä mount-rajoja. Vaihtunut kohde,
omistajuus, oikeudet, lukukelvoton kohde tai tuntematon vaikutus estävät
tuhoavan operaation. Poiston vahvistus
on täsmälleen snapshotin workspace-nimi, ilman trimmausta; observation-token
sitoo sen samaan tiedostojärjestelmäkohteeseen. Preflight selvittää prosessit,
Taskfleet-omistajuuden ja myös lähdejuuren ulkopuoliset linked worktreet.
Hallittu prosessi pysäytetään omistajansa kautta ja historian asettuminen
varmistetaan. Taskfleet purkaa omat worktreensä. Manuaalinen tai tuntematon
linked worktree estää päätyötilan poiston.
Valmistuminen vaatii natiivin havainnon kohteen poissaolosta.

Taskfleet luo ja purkaa omat worktreensä täyden run/node-identiteetin avulla.
Host välittää sen tukemat source branch-, title- ja task-arvot; Taskfleet
määrää lopullisen branchin. Todentamaton adapteri pysyy `unknown`-tilassa.
GitHub-repon luonti vaatii tuoreeseen tokeniin sidotun `owner/repository`-
vahvistuksen täsmälleen ilman trimmausta tai kirjainkoon muutosta.

Arkistointi on esitystilan muutos vain idle- tai varmasti päättyneelle
keskustelulle. Aktiivinen kirjoittaja antaa `writer_conflict`; pysäytys ja
arkistointi ovat erilliset teot. Historia pysyy paikallaan ja jatkaminen
käyttää samaa resume-ID:tä.

### Minimaaliset annotaatiot

Työtila on olemassa ilman asetustiedostoa. Tarvittaessa luotu
`.agent-host/workspace.json` sisältää vain vakaan ID:n ja valinnaisen
näyttönimen sekä skeemaversion. Piilotus tarvitsee vakaan ID:n ensin.
Käyttäjän esitystila on
`${XDG_STATE_HOME:-~/.local/state}/native-agent-host/state-v1.json`,
0600-tiedostossa 0700-hakemiston alla, atomisesti korvattuna.

[Annotaatioskeema](../../contracts/v1/annotations.schema.json) kattaa työtilan
piilotuksen ja keskustelun arkistoinnin. Skeeman aiempi generoitu otsikko
alkuperineen ei enää ole toteutustavoite: otsikointityö käyttää Pi:n
natiivin istunnon nimeä ja sovittaa sopimukset siihen. Parent-yhteys tallennetaan vain, jos sitä ei saada
luotettavasti natiivista Taskfleet- tai Pi-tiedosta. Jos tallennettu parent-yhteys on ristiriidassa Taskfleetista luetun
yhteyden kanssa, käytetään Taskfleetin tietoa ja ristiriita näytetään. Esitystiedon vioittuminen ei kadota
historiaa, vaan tuottaa lähdevaroituksen. Vioittunutta tai tuntemattoman
version tiedostoa ei kirjoiteta hiljaa yli, eikä orpoa merkintää poisteta
ilman turvallista siivousta.

