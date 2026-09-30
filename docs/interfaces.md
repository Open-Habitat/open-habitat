# Järjestelmän rajapinnat

Selain näyttää käyttäjän työtilat ja Pi-keskustelut sekä välittää hänen
komentonsa omana Linux-käyttäjänään toimivalle daemonille. Rajapinnan pitää
kertoa, mitä natiiveista lähteistä tiedetään, voiko keskustelua ohjata ja
onnistuiko käyttäjän pyytämä työ. Katkennut yhteys ei yksin vastaa yhteenkään
näistä kysymyksistä.

Tämä sivu kuvaa järjestelmän rajapinnat ja niiden sovitun toiminnan.
Toteutetut rajapinnat ja vielä toteutettavat osat kuvataan erikseen.
Viestien muodot ovat
[JSON-skeemoissa](../contracts/v1/AGENTS.md) ja
[esimerkeissä](../contracts/v1/examples/). Vastuurajat perustuvat
[arkkitehtuuriin](architecture.md), [host-päätökseen](adr-0003-host-stack.md)
ja [ensikirjautumisen päätökseen](adr-0004-first-login-user-provisioning.md).

## Nykyiset selainreitit

Alla ovat toteutetut reitit, tarkistettuina revisiosta `b0bac9e`.
Käyttötapausten testitulokset ja live-todennukset löytyvät toteutusissueista.
Reititys löytyy [gatewaysta](../internal/gateway/server.go)
ja [daemonista](../internal/daemon/handoff_linux.go).

| Metodi ja polku | Mitä selain saa tai pyytää |
|---|---|
| `GET /api/v1/snapshot` | työtilojen ja natiivihistorioiden tilannekuva |
| `GET /api/v1/agents/<agent-id>/history` | sivu Pi:n historiaa; `after` ja `limit` ohjaavat sivutusta |
| `GET /api/v1/content/<content-id>` | pitkän sisällön osa; `offset` ja `limit_bytes` ohjaavat lukua |
| `GET /api/v1/conversations` | selainistunnon hallittavissa olevat keskustelut |
| `POST /api/v1/conversations` | uuden Pi-keskustelun käynnistys `workspace_id`:llä |
| `GET /api/v1/conversations/<session-id>/status` | keskustelun tila ja saatavilla olevat välitulokset |
| `POST /api/v1/conversations/<session-id>/send` | viesti ja sen UUID-muotoinen `command_id` |
| `POST /api/v1/conversations/<session-id>/steer` | ohjaava viesti Pi:n steering-jonoon |
| `POST /api/v1/conversations/<session-id>/follow_up` | jatkoviesti Pi:n follow-up-jonoon |
| `POST /api/v1/conversations/<session-id>/clear_queue` | jonojen tyhjennys ja vahvistetusti poistetut tekstit |
| `POST /api/v1/conversations/<session-id>/abort` | Pi:n nykyisen vuoron keskeytyspyyntö, ei prosessin pysäytys |
| `POST /api/v1/conversations/<session-id>/stop` | keskustelun pysäytyspyyntö |
| `POST /api/v1/conversations/<session-id>/continue` | päättyneen selainkeskustelun tietoinen jatkaminen samasta natiivista Pi-istunnosta, tyhjä runko |
| `GET /api/v1/conversations/<session-id>/stream` | väliaikainen, rajallinen tilannekuva-SSE; ei yleinen tapahtumavirta |
| `GET /api/v1/events?after=<cursor>` | rajallinen yhdistetty SSE-toistovirta; toistaiseksi vain `snapshot.invalidated` natiivin Pi-tapahtuman tai ohjaimen elinkaaren muutoksesta |
| `GET /api/v1/onboarding/github/repos` | käyttäjän GitHub-repot, sivutettuina `page`- ja `limit`-parametreilla |
| `POST /api/v1/onboarding/github/clone` | `full_name`-kentän repon kloonaus; lopputulos JSON-vastauksena |
| `GET /api/v1/onboarding/github/checkout` | `full_name`-parametrin paikallisen checkoutin natiivi havainto |
| `GET /api/v1/onboarding/pi/status` | onko Pi:n natiivi kirjautuminen käyttökelpoinen |
| `POST /api/v1/onboarding/pi/attempt` | laitekirjautumisyrityksen aloitus |
| `GET /api/v1/onboarding/pi/attempt` | saman selainistunnon yrityksen tila |
| `DELETE /api/v1/onboarding/pi/attempt` | yrityksen keskeytyspyyntö |

Yksityisen `status`-vastauksen `continuation` on positiivinen havainto: `eligible` tarkoittaa, että selainperäinen omistajamerkintä täsmää, edellinen suora lapsi on korjattu talteen (tai daemonin uudelleenkäynnistyksen jälkeen omistajalukko on vapaa), työtila täsmää ja natiivi historia on kahdesti luettu vakaaksi oikealle id:lle ja cwd:lle. `writer_present` tarkoittaa elävää lasta tai varattua/epävarmaa omistajalukkoa, `read_only_history` puuttuvaa kelvollista selainalkuperää ja `unproven` keskeneräistä tai epäselvää muuta todistetta. Luettava `native_history` yksin ei todista kirjoittajan poistumista. Status vain havainnoi ja vapauttaa lukon heti; saman daemonin samanaikaiset tilakyselyt ja jatkaminen jonottavat enintään kaksi sekuntia erillisellä portilla eivätkä näy toisilleen ulkopuolisena kirjoittajana. Jonon aikakatkaisu näkyy tilassa `unproven` (jatkamisessa 503), ei `writer_present`. `continue` suorittaa saman todistuksen uudelleen ja pitää lukon uuden lapsen käynnistykseen asti. Välissä tapahtunut kilpailu voi palauttaa `writer_conflict`. Vain `eligible` oikeuttaa selaimen tarjoamaan jatkamista; se ei todista aiemman vuoron tai irrotetun työkalun lopputulosta.

Jatkaminen palauttaa `agent_id`, `workspace_id`, `state: idle` ja `prior_outcome: uncertain`: aiemman vuoron tulosta ei päätellä eikä epävarmaa viestiä lähetetä uudelleen. Elävän kirjoittajan lukko palauttaa 409 `writer_conflict`; ilman selaimesta luotua lukon alkuperämerkintää palautuu 409 `read_only_history`; epäselvä historia tai työtila palauttaa 409 `control_uncertain`. Gateway vaatii saman kirjautumisistunnon hallussa olevan keskustelukahvan myös jatkamisessa. Daemonin uudelleenkäynnistyksen jälkeen pelkkä luettava historia ei riitä: Pi:n lapselle periytynyt lukko on saatava uudelleen, natiivi historia täsmäytetään ja vain eksplisiittinen pyyntö käynnistää uuden lapsen. Gatewayn uudelleenkäynnistyksessä katoavaa kahvavuokraa ei palauteta historiasta. Irrotetut työkalut voivat jäädä eloon; siksi aiemman työn lopputulos jää epävarmaksi.

Nykyinen selainohjaus kysyy tilaa toistuvasti. Sen väliaikaisen protokollan
muodot validoidaan [gatewayn ohjausreitissä](../internal/gateway/conversation_linux.go)
ja toteutetaan [daemonin ohjaimessa](../internal/daemon/conversation_linux.go);
ne eivät ole jäljempänä kuvatun yleisen komentoskeeman toteutus.
Gatewayn uudelleenkäynnistys kadottaa selainistuntojen ohjaussidokset.
Daemonin uudelleenkäynnistys kadottaa sen muistissa olevan ohjaustilan.
Pi:n kirjoittama historia säilyy luettavana. Väliaikaisen keskusteluvirran
`Last-Event-ID` ei mahdollista aukon toistoa: jokainen nykyisen elinkaaren
jo käytetty kursori palauttaa `409 cursor_expired`, vieraan daemon-elinkaaren kursori
`409 cursor_instance_mismatch`. Selain hakee silloin uuden tilan ja natiivihistorian;
virta ei väitä välistä jääneiden tapahtumien tulleen toimitetuiksi.

Yleisen SSE:n rakenteiset deltaeventit sekä komento- ja operaatiokyselyt ovat vielä toteutettavaa
[agenttiohjausta](../issues/build-agent-control/item.md). Niiden sovittu
merkitys kuvataan alempana erillään nykyisistä reiteistä.

## Identiteetti ja luottamusrajat

### Selain → gateway

GitHub OAuth -kirjautuminen todentaa vakaan numeerisen GitHub-käyttäjä-ID:n.
Brokerin hyväksymä sidos määrää Linux-käyttäjän ja daemonin. Sähköposti,
näyttönimi tai selaimen lähettämä käyttäjä, polku tai header ei valitse niitä.
Valinnainen Google OIDC käyttää täsmällistä `(issuer, subject)`-paria;
se käynnistyy vain käyttäjän valinnasta eikä konfiguroi GitHubia.

GitHub-virta käyttää selainkohtaista kertakäyttöistä `state`a, PKCE S256:ta
ja täsmällistä konfiguroitua callback-osoitetta. State tarkistetaan ennen
koodin vaihtamista tokeniksi. OAuth-kirjaston valinta jää toteuttajalle.
Sama valtuutus pyytää `repo`, `read:org` ja `gist` -scopet sekä toimittaa
tokenin kerran todennetulle daemonille käyttäjän natiivin `gh`:n asennusta
varten. Normaali web-istunto avataan vasta onnistuneen asennuksen ja
identiteetin tarkistuksen jälkeen.

Web-istunto on palvelinpuoleinen. Sen opaque-tunniste kulkee evästeessä
`__Host-agent-host; Secure; HttpOnly; SameSite=Lax; Path=/` ja vaihtuu
kirjautumisessa. Kirjoittavat pyynnöt vaativat voimassa olevan istunnon,
täsmälleen sallitun `Origin`-headerin ja istuntoon sidotun
`X-Agent-Host-CSRF`-tokenin. Puuttuva Origin torjutaan. JSON-kirjoitusreitti
ei hyväksy lomakedataa, eikä CORS avaa tunnistettuja pyyntöjä muille origineille.

Vanhentuneella istunnolla jo näytetty sisältö saa jäädä luettavaksi, mutta
uudet pyynnöt vaativat kirjautumisen. Identiteetin vaihto tyhjentää edellisen
käyttäjän näkymän ja selainluonnokset. Web-logout mitätöi web-istunnon ja
säilyttää natiivin `gh`-kirjautumisen. Sovitussa SSE-toteutuksessa se sulkee
myös istuntoon sidotut virrat.

### Gateway → daemon

Kuljetus on HTTP/1.1 käyttäjäkohtaisessa systemd:n luomassa Unix-socketissa.
Gateway muodostaa sisäisen pyynnön omasta varmennetusta istunnostaan ja
brokerin sidoksesta. Selaimen identiteetti-, UID-, käyttäjä- ja socket-headereita
ei käytetä sisäisen hopin identiteettinä.

Gateway varmistaa rootin hallitseman kulkureitin sekä socketin omistajan,
ryhmän ja oikeudet: socket kuuluu kohdekäyttäjälle, gatewayn ryhmälle ja on
moodissa 0660. Systemd:n luoman kuuntelijan `SO_PEERCRED` kertoo gatewaylle
PID 1/rootin, joten se ei todista hyväksyvän daemonin UID:tä. Daemonin
hyväksymällä yhteydellä sama mekanismi kertoo oikean clientin UID:n;
daemon hyväksyy vain konfiguroidun gateway-UID:n. Daemon tarkistaa myös oman
root-omisteisen käyttäjäsidoksensa, UID:n, homen ja socket-instanssin.
Väärään kohteeseen päätynyt yhteys torjutaan. Tarkistukset ovat
[udssecure-paketissa](../internal/udssecure/socket_linux.go).

Gateway asettaa `X-Agent-Host-Identity`- ja display-name-headerit varmennetusta
istunnosta. Ne sitovat pyynnön web-istuntoon, eivät anna daemonille oikeutta
vaihtaa Unix-käyttäjää. GitHub-tokenin luovutuksessa gatewayn varmentaman
`expected_numeric_id`:n, daemonin oman sidoksen ja natiivin `gh api user`
-havainnon pitää täsmätä. Paikallinen reitti ei käytä yhteistä bearer-tokenia.

Gateway välittää selainliikenteen, mutta ei lue kotihakemistoja eikä suorita
natiiveja työkaluja. Lokit ja diagnostiikka saavat sisältää reitityksen,
statuskoodin ja turvallisen korrelaatiotunnisteen. Promptit, mallivastaukset,
työkalujen tulosteet, tiedostosisällöt ja credentialit eivät kuulu niihin.

### Natiivi GitHub-kirjautuminen

Daemon syöttää kertakäyttöisesti vastaanotetun tokenin stdinillä oman UID:nsä
`gh auth login --with-token --git-protocol https` -kutsulle ja konfiguroi
Git-helperin `gh auth setup-git` -kutsulla. Se tarkistaa GitHub-ID:n,
autentikoinnin sekä HTTPS-helperin toiminnan. Tokenia ei laiteta selaimeen,
evästeeseen, lokiin, argviin, ympäristöön, gatewayn levylle tai uusintajonoon.
Identiteettiristiriidassa juuri asennettu paikallinen auth poistetaan.

Tallennuspaikka kerrotaan sellaisena kuin se on. Ensisijainen on järjestelmän
credential store; sallittu tiedostovaihtoehto on käyttäjän tavallinen
0600-tiedosto hänen 0700-hakemistossaan. Symlinkki, liian avoimet oikeudet,
tuntematon tallennuspaikka ja `--insecure-storage` torjutaan.

Epäonnistunut tai epävarma asennus ei avaa normaalia web-istuntoa. Uusi
kirjautuminen tarkistaa olemassa olevan authin ennen asennusta; kadonnut
vastaus ei tarkoita, että aiempi asennus peruuntui. Sovittu erillinen
`identity.github.disconnect` vaatii tuoreen autentikoinnin ja vahvistuksen.
Se poistaa vain käyttäjän paikallisen `gh`-authin, tarkistaa poissaolon ja
kertoo osittaisesta tuloksesta. GitHubin OAuth-valtuutuksen peruminen on
erillinen teko; paikallinen logout ei väitä tehneensä sitä.

## Käyttöönoton rajapinnat

GitHub-listaus ja kloonaus ovat käytettävissä ennen Pi-kirjautumista.
Istunto ja brokerin tuore sidos valitsevat käyttäjän; daemon varmistaa peerin,
oman sidoksensa ja oman `gh`:n GitHub-ID:n. Lista tulee natiivista `gh`:sta
ilman omaa rekisteriä. Täysi sivu ilmoittaa `has_more`, joten viimeinen sivu
voi olla tyhjä. [Repo](../contracts/v1/github-repos.schema.json)-,
[kloonaus](../contracts/v1/github-clone.schema.json)- ja
[checkout](../contracts/v1/github-checkout.schema.json)-skeemat rajaavat vastaukset.
Puuttuva tai väärän käyttäjän `gh`-auth antaa `409 github_auth_unavailable`.
Raakaa natiivivirhettä ei välitetä selaimeen.

Pi:n [status](../contracts/v1/pi-status.schema.json) kertoo `usable`, `missing`
tai `unknown`. [Kirjautumisyritys](../contracts/v1/pi-attempt.schema.json)
on sidottu yhteen web-istuntoon, vain muistissa ja nykyisin enintään viiden
minuutin mittainen. Sisäinen istuntosidos on tarkoituskohtainen tiiviste,
ei istunnon bearer-eväste. Toinen istunto ei voi lukea eikä keskeyttää yritystä.
Keskeytys palauttaa `unknown`, sillä se ei todista kirjautumista onnistuneeksi
tai kumotuksi. Web-istunnon poistuminen voi jättää natiivin yrityksen käyntiin
sen aikarajaan asti. Vastauksia ei tallenneta välimuistiin.

Pi-kirjautumisen käyttöliittymä on [sovelluksessa](../web/src/app/PiOnboarding.tsx).
Daemon avaa snapshotin, historian, sisällön ja selainohjauksen vain, kun tuore
Pi-tila on `usable`; muuten vastaus on `428 pi_onboarding_required`.
Tämä ei anna selaimelle terminaalikeskustelun ohjausta.

### GitHub-kloonauksen sovittu vaihevirta

[ADR 0005](adr-0005-clone-progress-stream.md) hyväksyy erillisen
`POST /api/v1/onboarding/github/clone/stream` -reitin. Se ei ole vielä toteutettu.
Kirjoittavan POST-yhteyden SSE-vastaus sisältää vain numeroidut Git-vaiheet
ja yhden lopputilan. Selainyhteyden katkeaminen keskeyttää tämän kirjoituksen.
Sivun uudelleenavaus tarkistaa natiivin Git-tilan ja kirjoittajan päättymisen;
vanhaa virtaa ei jatketa eikä kloonausta uusita automaattisesti.

Tämä on eri sopimus kuin keskustelun jatkuminen selaimen sulkemisen jälkeen.
Kloonivirta ei käytä yleisen SSE:n cursoria tai komentotulosten säilytystä.
ADR määrittää sen hyväksytyt aika- ja levyrajat sekä epävarman lopputuloksen.

## Natiivit lähteet ja historia

| Tieto | Mistä daemon sen saa |
|---|---|
| Työtilat | `~/src`:n välittömät hakemistot, symlinkkejä seuraamatta |
| Työtilan vakaa ID ja näyttönimi | tarvittaessa `.agent-host/workspace.json` |
| Repo, branch ja worktreet | Git, uudelleen tarkistettuna ennen muutosta |
| Taskfleet-omistajuus | täysi run/node-identiteetti, ei branchin nimestä päätelty omistaja |
| Keskustelu ja resume-ID | Pi:n natiivi JSONL-historia |
| Prosessi ja ohjauskyky | daemonin omistama Pi-lapsi, natiivi havainto ja RPC-kanava |
| Piilotus, arkistointi ja generoitu otsikko | pieni käyttäjäkohtainen annotaatio |

Daemon kertoo tiedon mukana, mistä ja milloin se on luettu sekä onnistuiko
lukeminen. Esimerkiksi prosessin tila on `confirmed`, kun sen käynnissäolo
on havaittu, ja `absent`, kun sen poissaolo on vahvistettu. `unknown`
tarkoittaa, ettei tilaa tiedetä, `unavailable` ettei lähdettä voitu lukea ja
`conflicting` että havainnot ovat ristiriidassa.

Pi:n historiatiedostosta voi lukea keskustelun myös sen päätyttyä. Prosessin
käynnissäolo ja selaimen ohjausmahdollisuus selvitetään erikseen. Nykyinen
historianlukija näyttää keskustelut vain luettavina ja prosessin tilan
tuntemattomana; erillinen selainohjain seuraa itse käynnistämiään Pi-prosesseja.

Pi-keskustelun ID on `pi:<sessionId>` natiivista otsakkeesta. Workspace-yhteys
perustuu otsakkeen täsmälliseen `cwd`:hen. Historia sivutetaan natiivilla
entry-avaimella ja lähderevisioon sidotulla jatkolla. Sisältö-ID on käyttäjä-
ja revisiosidottu: lähteen muuttuessa selain hakee historian uudestaan.
Pitkä teksti luetaan paloina UTF-8-tavuoffseteilla, koodipisterajoja rikkomatta.
Host ei tallenna rinnakkaista sisältökopiota.

[Historiaskeema](../contracts/v1/history.schema.json) ja
[yhteiset tyypit](../contracts/v1/common.schema.json) määrittävät sivutuksen
ja tekstipalojen muodot. Pi:n vielä tallentamaton RPC-välitulos voi olla
katkaistu ilman jatko-ID:tä; täydellinen sisältö tulee historiasta vasta
persistoinnin jälkeen. Liian suuri tai lukukelvoton natiivilähde näytetään
saavuttamattomana, ei kokonaiseksi väitettynä katkelmana.

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
| `POST /api/v1/commands` | komennon hyväksyntä, [command-skeema](../contracts/v1/command.schema.json) |
| `GET /api/v1/commands/<client-command-id>` | saatavilla oleva hyväksyntä- ja suoritustulos |
| `GET /api/v1/operations/<operation-id>` | saatavilla oleva päättyneen operaation tulos, [operation-skeema](../contracts/v1/operation.schema.json) |

### Snapshot ja yhdistetty SSE

SSE-yhteys välittää Pi:n vastauksen ja työn etenemisen selaimeen sitä mukaa
kuin Pi työskentelee. Jos selainyhteys katkeaa, Pi jatkaa työtään. Yhteyden
palattua selain hakee katkon aikana syntyneet tapahtumat. Jos niitä ei enää
ole saatavilla, selain hakee uuden tilannekuvan ja keskustelun Pi:n historiasta.

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
Yhteys kestää enintään 20 sekuntia, daemonin kirjoitusaika enintään 24 ja
gatewayn kirjoitusaika 26 sekuntia; gatewaylla on 27 sekunnin socket-deadline
ja enintään 128 kehystä. Liian hidas lukija katkaistaan. Selain ei vielä käytä
tätä reittiä; väliaikainen keskusteluvirta jää käyttöön.

[Snapshot](../contracts/v1/snapshot.schema.json) on daemonin muodostama
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
tasalla. Katkos ei pysäytä Pi:tä. Istunnon päättyminen sulkee virran ja
uudelleenyhdistäminen vaatii kirjautumisen.

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

Kaikki agentilta saapuvat viestit näytetään käyttäjälle. Myös kysymys näytetään,
vähintään tekstinä, vaikka sen dialogityypille ei olisi omaa käyttöliittymää.
`pending_question` kertoo odottavasta kysymyksestä, kun tämä tieto saadaan
Pi:ltä. Viestityypin tai sisältölohkon oman esitystavan puuttuessa sen
sisältö näytetään turvallisena tekstinä; pelkkä ilmoitus tuntemattomasta
lohkosta ei riitä.
Pi:n erillisten kysymysdialogien vastaus- ja perumisohjaus sekä terminaalin
ohjauksen haltuunotto ovat nykyisen toteutustyön ulkopuolella.

Vuoron keskeytys on Pi:n `abort`, ei lupaus koko prosessipuun päättymisestä.
Steering toimitetaan Pi:n mukaisesti tool callien jälkeen. `agent_settled`
on idle-raja. `agent.queue.clear` tyhjentää kokonaiset jonot ja palauttaa vain
poistetut tekstit alkuperäisissä steering/follow-up-ryhmissä, indekseissä ja
järjestyksessä sekä uuden queue-revision. Sama revision näkyy snapshotissa ja
queue-eventissä. Epävarma tai epäonnistunut tyhjennys ei palauta tekstejä editoriin.

Otsikko alkaa tekstistä “Uusi keskustelu” ja voi käyttää ensimmäisen viestin
alkua fallbackina. Daemon generoi otsikon yhdellä Pi-mallikutsulla agenttiloopin
ulkopuolella. Ensimmäinen yritys tehdään ensimmäisen hyväksytyn viestin jälkeen,
yksi automaattinen uudelleengenerointi kolmannen viestin asetuttua; lisäksi käyttäjä
voi pyytää uuden otsikon sen vierestä. Syöte on ensimmäisten neljän ja viimeisten
neljän käyttäjäviestin unioni lähdejärjestyksessä, ilman toistoa. Pending estää
rinnakkaiset kutsut, epäonnistuminen säilyttää aiemman otsikon tai fallbackin
ja keskustelu jatkuu.

[Hyväksytty otsikointivalinta](../issues/plan-v1-implementation/review.md#5-title-adapter)
on `openai-codex/gpt-5.6-luna`, low thinking, 16 KiB syötettä,
120 Unicode-merkin tulos ja 0,02 USD:n raportoitu kustannusraja.
Kertakutsuadapteri on vielä todennettava
[keskustelun käyttöliittymätyössä](../issues/complete-conversation-ui/item.md);
siihen asti kyky on `unknown` / `adapter_not_verified`.

## Työtilan muutokset ja osittainen tulos

Yleisen komentosopimuksen workspace-, GitHub-, Taskfleet- ja arkistotoiminnot
kuuluvat [toteutusissueille](implementation.md). Operaation vaiheet säilyttävät
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

[Annotaatioskeema](../contracts/v1/annotations.schema.json) kattaa työtilan
piilotuksen, keskustelun arkistoinnin ja viimeisimmän onnistuneen generoidun
otsikon alkuperineen. Parent-yhteys tallennetaan vain, jos sitä ei saada
luotettavasti natiivista Taskfleet- tai Pi-tiedosta. Jos tallennettu parent-yhteys on ristiriidassa Taskfleetista luetun
yhteyden kanssa, käytetään Taskfleetin tietoa ja ristiriita näytetään. Esitystiedon vioittuminen ei kadota
historiaa, vaan tuottaa lähdevaroituksen. Vioittunutta tai tuntemattoman
version tiedostoa ei kirjoiteta hiljaa yli, eikä orpoa merkintää poisteta
ilman turvallista siivousta.

## Virheet, sisältö ja toteutuksen rajat

[Virheskeema](../contracts/v1/error.schema.json) antaa turvallisen viestin,
koodin ja lokiin yhdistävän korrelaatiotunnisteen. HTTP-status erottaa
virheellisen pyynnön, autentikoinnin puuttumisen, pääsyn torjunnan,
muuttuneen kohteen ja saavuttamattoman palvelun. `retryable` ei yksin anna
lupaa uusia kirjoitusta; `fresh_snapshot_required` vaatii uuden havainnon.
Tuntematon koodi näytetään geneerisesti säilyttäen status ja korrelaatio.
Osittaiset vaikutukset pysyvät näkyvissä.

Yleisen v1-sopimuksen virhekoodit ja nykyisten snapshot- ja Pi-statusreittien
täsmennykset ovat:

| HTTP | Koodi | Merkitys |
|---:|---|---|
| 400 | `invalid_request`, `schema_version_unsupported` | muotoa ei hyväksytty; mitään ei aloitettu |
| 401 | `authentication_required`, `session_expired` | uudet luvut ja kirjoitukset estetty |
| 403 | `origin_denied`, `csrf_denied`, `identity_mapping_denied`, `identity_mismatch`, `peer_not_authorized`, `cross_user_denied` | luottamusraja torjui pyynnön; gateway ei luovuta vierasta snapshotia |
| 404 | `resource_not_found`, `command_outcome_unknown`, `content_revision_gone` | ei saa tulkita toisen käyttäjän olemassaoloa |
| 409 | `stale_precondition`, `command_id_conflict`, `cursor_expired`, `cursor_instance_mismatch`, `writer_conflict`, `path_replaced`, `manual_worktree_blocks_delete` | nykytila estää turvallisen etenemisen |
| 422 | `capability_unsupported`, `capability_unknown`, `path_unsupported`, `path_escape`, `confirmation_mismatch` | pyyntö on ymmärretty mutta sitä ei voi toteuttaa |
| 502 | `daemon_unavailable` | snapshot- tai Pi-statusreitin daemon-vastaus ei läpäissyt muodon tarkistusta; selaimen vanhat tiedot poistetaan |
| 503 | `daemon_unavailable`, `native_source_unavailable`, `capability_temporarily_unavailable` | tila on tilapäisesti saavuttamaton; vahvistetun saman istunnon sisältö voi jäädä vanhentuneena luettavaksi ilman kirjoituksia |
| 500 | `native_adapter_error`, `operation_partial`, `annotation_corrupt` | tarkka osatulos/fakta säilyy ja näytetään; `annotation_corrupt` koskee vain annotaatiota kirjoittavaa komentoa, ei snapshot/history-lukua |

Snapshotin identiteettiristiriita palauttaa `403 identity_mismatch`.
Historian ja sisällön lukureitit palauttavat nykyisin virheellisestä
daemon-vastauksesta `503 daemon_unavailable`; yllä kuvattu 502-erottelu ei
vielä koske niitä. Reittien tarkistukset ovat
[gatewayn lukureiteissä](../internal/gateway/snapshot_linux.go).

Käyttöönoton ja väliaikaisen selainohjauksen lisäkoodit kuvataan niiden
reiteissä ja validaattoreissa. `annotation_corrupt` koskee annotaation
kirjoittamista; lukeminen säilyttää historian ja näyttää lähdevaroituksen.

Natiivisisältö on epäluotettua tekstiä myös saman käyttäjän prosessilta.
Selain ei suorita raakaa HTML:ää; URL-skeemat rajataan ja teksti escapetaan.
Tuntemattoman validin natiivitapahtuman sisältö näytetään tekstinä. Skeeman
vastainen host-viesti hylätään. Virheiden ja metadatan vapaa teksti
redaktoidaan: home-polut, muiden käyttäjien polut ja URL-credentialit eivät
päädy viesteihin. Kloonivirta käyttää tätä tiukempaa ADR 0005:n kenttäallowlistiä.

Rajat ja puskurit palvelevat konkreettista tarvetta. Niitä säädetään mitatun
käytön perusteella niin, etteivät ne estä normaalia keskustelua tai historian
lukua. Cursorin tai komentotuloksen vanheneminen on sallittua yllä kuvatulla
palautumisella; sopimus ei vaadi tiettyä tapahtumarengasta tai välimuistia.
Skeemat, tyypit ja toteutuksen rajat muuttuvat yhdessä.

[Sopimusskenaarioiden](../contracts/v1/scenarios.json) testit ja niiden
vastuut ovat [toteutuskartassa](../issues/plan-v1-implementation/implementation-briefs.md#contract-scenario-implementation-ownership).
Skenaarion olemassaolo ei todista sen toteutusta; todennettu revisio ja
näytön laajuus löytyvät toteuttavan issuen tuloksista.

## Palveluiden rajoitukset ja diagnostiikka

Gateway toimii ilman pääsyä koteihin, daemon yhden käyttäjän oikeuksilla.
Palveluasetukset ja sammutuksen todentaminen kuuluvat
[asennusissuen vaatimuksiin](../issues/prepare-mvp-operations/service-requirements.md)
ja [systemd-malleihin](../systemd/). Malli ei yksin todista asennuksen suojauksia.
`/healthz` ja `/readyz` palauttavat vain aggregoidun tilan; tarkka readiness
on rajatun admin-socketin takana. [Lokitussivu](logging.md) on edelleen ehdotus.
Operaattorin komentopinta kuvataan [CLI-sopimuksessa](../CONFORMANCE.md#operator-contract).
