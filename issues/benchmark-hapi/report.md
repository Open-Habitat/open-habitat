# Vertailu: HAPI (tiann/hapi)

Tutkimusajo `01m68hqy9mdf2f0wbfcvtgm51a`, 31.10.2026. Lähteinä ovat HAPIn
GitHub-repo ja sen lähdekoodi (luettu commitista [`f8e55fb9`][commit],
30.10.2026), repon dokumentaatio (`docs/guide/`, `docs/api/`), GitHubin API
(repon tiedot, julkaisut, issuet) ja Hacker Newsin Algolia-haku. Merkintä
**(lähde)** tarkoittaa, että asia lukee lähteessä tai koodissa. **(päättely)** on
oma tulkintani.

En päässyt lukemaan HAPIn verkkosivua hapi.run: se on JavaScript-sovellus, jonka
sisältö ei näy ilman selainta. Siksi natiivisovellusten hintaa en tiedä.
Yleistä verkkohakua (DuckDuckGo) en käyttänyt, koska se oli palauttanut
aiemmalle ajolle haastesivun. GitHubin API:n tunnistamaton kiintiö (60 kyselyä tunnissa) loppui ajon
lopussa, joten viimeiset tarkistukset (onko viite issue vai PR) tein
GitHubin uudelleenohjauksista. Ajoin HAPIa itse en; kaikki toimintaa koskevat
väitteet perustuvat koodiin, dokumentaatioon ja issueihin.

## Tiivistelmä

HAPI on AGPL-lisensoitu, yhden hengen ylläpitämä mutta vilkas (5 339 tähteä,
noin 1 700 committia kymmenessä kuukaudessa) työkalu, jolla omalla koneella
ajettavia agentteja (Claude Code, Codex, Pi ja kahdeksan muuta) ohjataan
puhelimen selaimesta, PWA:sta, Telegramista tai maksullisista
natiivisovelluksista. Rakenne on **CLI-kääre + yksi hub + SQLite**: kääre
käynnistää agentin ja peilaa sen viestit hubille, joka tallentaa ne omaan
tietokantaansa ja jakaa ne selaimelle REST:n ja SSE:n kautta. Kaikki kolme
kysymystä saavat selvän vastauksen. (1) **Web Push** on HAPIssa pieni ja
toimiva: noin 220 riviä hubissa ja 40 service workerissa, VAPID-avain
asetustiedostossa, tilaukset tietokannassa. Siinä on kuitenkin karkeuksia,
jotka Open Habitatin `push-when-your-turn`-työn kannattaa välttää: näkyvyys
on koko nimiavaruuden laajuinen, ilmoituksella ei ole TTL:ää, ilmoitusta ei
poisteta, kun asia hoidetaan muualla, ja klikkaus avaa aina uuden ikkunan.
(2) **Istunnon siirto terminaalin ja selaimen välillä** on Claudella
prosessin vaihto: selaimesta tuleva viesti tappaa terminaalin agentin ja
käynnistää sen uudelleen SDK-tilassa samalla istuntotunnisteella. Aidosti
jaettu elävä istunto on vain Codexilla, ja vain koska Codexin oma app-server
tukee monta asiakasta. **Pi:llä HAPIssa ei ole terminaalikäyttöä lainkaan**,
vaan se ajetaan `pi --mode rpc` -tilassa kuten Open Habitatissa. (3) **Oma
SQLite-varasto** maksaa paljon ja näkyvästi: 29 skeemaversiota, pakkaus ja
katkaisu, offline-tiivistysskripti, istuntojen siivousskripti, issueita
kahden gigatavun tietokannoista, jotka jumittavat hubin tai kaatavat koko
koneen, ja tapaus, jossa hubin historia on ehjä mutta agentti on unohtanut
kaiken, koska hubin ja natiivin istunnon tunnisteet erkanivat. Pi:n natiivit
istunnot HAPI joutuu *tuomaan* omaan kantaansa, ja tuonnilla on tila
"diverged". Tämä on vahvin ulkoinen todiste siitä, että Open Habitatin
periaate "ei toista historiaa" säästää todellista työtä.

## 1. Mikä HAPI on ja kenelle

HAPI kuvaa itsensä näin: "Run official Claude Code / Codex / … / Pi / DeepSeek
Harness sessions and control them remotely through native iOS / Android apps,
Web / PWA, or Telegram Mini App" ([README][readme]) **(lähde)**. Nimi on
kiinalainen translitteraatio sanasta Happy, ja HAPI on syntynyt
paikallisena vaihtoehtona Happylle: Happy pitää salatun historian
keskitetyllä palvelimella, HAPIssa "each user runs their own hub"
([Why HAPI][why]) **(lähde)**.

Kohderyhmä on yksittäinen kehittäjä, joka ajaa agenttia omalla koneellaan ja
haluaa jatkaa tai hyväksyä työkalukutsuja puhelimesta ("AFK Without Stopping —
Approve AI requests from your phone with one tap", [README][readme])
**(lähde)**. Pieni tiimi voi jakaa yhden hubin nimiavaruuksilla, mutta
dokumentti sanoo itse, ettei se ole tavallinen polku ([Namespace][ns])
**(lähde)**. HN:ssä HAPI mainitaan käyttäjien kommenteissa kevyenä kääreenä,
jolla "I can easily tap into a session on my PC from my phone"
([HN 46493425][hn1], [HN 48630219][hn2]); oma Show HN keräsi 7 pistettä
([HN 46571992][hn3]) **(lähde)**.

## 2. Arkkitehtuuri

### Missä prosessit ajetaan

Komponentteja on neljä ([How it works][how], [Installation][install])
**(lähde)**:

- **CLI-kääre** (`hapi <agent>`) käynnistää agentin, rekisteröi istunnon
  hubille Socket.IO:lla ja välittää viestit ja lupapyynnöt.
- **Runner** (`hapi runner start`) on käyttäjän taustapalvelu, joka
  käynnistää uusia kääreitä, kun istunto aloitetaan selaimesta. Ohje neuvoo
  ajamaan sen ja hubin systemd-käyttäjäpalveluina lingerin kanssa
  ([Deployment][deploy]).
- **Hub** on yksi Bun-prosessi: HTTP-rajapinta, Socket.IO kääreille, SSE
  selaimille, SQLite, Telegram-botti ja ilmoituskanavat.
- **Asiakkaat**: React-PWA (myös Telegram Mini App) ja maksulliset
  iOS- ja Android-sovellukset.

Hub voi olla eri koneella kuin runner ja agentit. Etäyhteys kulkee joko
HAPIn ylläpitämän tunwg-relayn (WireGuard + TLS) tai käyttäjän oman
Cloudflare Tunnelin, Tailscalen tai HTTPS-palvelimen kautta ([How it
works][how]) **(lähde)**.

### Eristys ja valtuudet

Hubiin kirjaudutaan yhdellä jaetulla salaisuudella `CLI_API_TOKEN` (tai
Telegram-sidonnalla), josta hub antaa neljän tunnin JWT:n
([`auth.ts`][auth]) **(lähde)**. Nimiavaruus on tokenin pääte
`base:alice`; kaikilla nimiavaruuksilla on sama perustoken ([Namespace][ns])
**(lähde)**. Nimiavaruus erottaa siis näkymät, ei ihmisiä: kuka tahansa
perustokenin tietävä voi kirjoittaa minkä tahansa päätteen **(päättely
koodista ja ohjeesta)**. Kaikki agentit ja hub ajetaan sen käyttäjän
oikeuksin, joka ne käynnisti. Pi:lle HAPI ei tarjoa lupakyselyitä lainkaan
("none (always auto-approve)", [Supported agents][agents]) **(lähde)**.

### Yksi vai monta käyttäjää

Yksi käyttäjä per hub. HAPIn oma vertailutaulukko asettaa "Multi-user on
shared server" Happyn ominaisuudeksi ja HAPIn vastaukseksi "Any number (each
runs own hub)" ([Why HAPI][why]) **(lähde)**. Käyttöjärjestelmätason
erottelua ihmisten välillä ei ole eikä sitä suunnitella (en löytänyt
issueista) **(päättely)**.

### Istunnot ja siirto terminaalin ja selaimen välillä

HAPIssa on kolme eri mallia, ja ne riippuvat harnessista ([Supported
agents][agents], [Codex shared sessions][codex]) **(lähde)**:

1. **Paikallinen/etätila ja vaihto (Claude, Cursor, vanha Codex).**
   Terminaalissa ajetaan natiivia TUI:ta. Kun selaimesta tulee viesti,
   kääreen jono herättää `doSwitch`-käsittelijän, joka keskeyttää
   paikallisen prosessin ja palauttaa `'switch'`; silmukka käynnistää agentin
   uudelleen etätilassa (Claudella Agent SDK) samalla istuntotunnisteella
   ([`BaseLocalLauncher.ts`][local], [`loop.ts`][loop]) **(lähde)**.
   Terminaaliin palataan painamalla kahdesti välilyöntiä ([How it
   works][how]) **(lähde)**. Kyse ei siis ole jaetusta elävästä istunnosta
   vaan vuorottelusta, jossa agentin prosessi vaihtuu ja jatkuu natiivista
   transkriptista **(päättely)**.
2. **Jaettu app-server (Codex 0.154.0+).** Codexin TUI ja HAPIn asiakkaat
   ovat saman `codex app-server` -prosessin asiakkaita: "No local/remote
   ownership switch. Both can send messages, approve tools and answer
   `request_user_input`" ([Codex shared sessions][codex]) **(lähde)**.
   Dokumentti on huolellinen omistajuudesta: terminaalista aloitetun
   istunnon elinkaaren omistaa alkuperäinen terminaali, ja sen sulkeminen
   tekee istunnosta passiivisen; lisäterminaalit (`hapi resume <id>`)
   vain liittyvät eivätkä koskaan ota omistajuutta; selaimesta jatkettu
   istunto käynnistyy runnerin kautta; ja kaksi rinnakkaista elävää
   moottoria samalle säikeelle torjutaan. Kun terminaali ja selain
   vastaavat samaan kysymykseen, voittajan ratkaisee Codex: "A submitted
   Web answer is only a candidate" **(lähde)**. Varmistamattomia
   lähetyksiä ei toisteta automaattisesti, ja keskeneräisten operaatioiden
   kirjanpito on "durable per-session queue ledger" **(lähde)**.
3. **Vain etätila (Pi, Antigravity, DeepSeek Harness).** Pi ajetaan
   `pi --mode rpc` -tilassa JSON-riveinä stdion yli
   ([`piTransport.ts`][pitransport]), eikä terminaalissa ole Pi:n TUI:ta:
   "Pi and Antigravity resume with input still controlled from HAPI rather
   than the terminal" ([Supported agents][agents]) **(lähde)**.

Pi:n kohdalla HAPI on siis samassa tilanteessa kuin Open Habitat: Pi:llä ei
ole jaettua palvelinta, joten terminaalin ja selaimen yhtäaikainen
kirjoittaminen ei ole mahdollista ilman Pi:n omaa tukea **(päättely)**.
Terminaalissa aloitetut Pi-keskustelut HAPI näyttää tuomalla ne natiivista
istuntotiedostosta omaan tietokantaansa (`piSessions.ts`, tilat
`importing`, `complete`, `failed`, `diverged`). Tuonti hylätään, jos HAPIn
Pi-istunto on samalla käynnissä: "The HAPI Pi session is active; stop it
before importing native history changes" ([`piSessions.ts`][pisessions])
**(lähde)**.

### Miten selain saa natiivin tilan

Ei suoraan natiivista. Kääre muuntaa agentin tapahtumat HAPIn
viestimuotoon ja lähettää ne hubille, joka tallentaa ne `messages`-tauluun ja
välittää SSE:llä. SSE:n uudelleenyhdistys toistaa puuttuvat tapahtumat
prosessin muistissa olevasta 256 tapahtuman / 2 MiB puskurista; hubin
uudelleenkäynnistyksen jälkeen asiakas saa `resume=gap` ja hakee tilan REST:llä
([`events.ts`][events], [issue #1941][i1941]) **(lähde)**. Selaimen historia
on siis hubin kopio, ei agentin oma **(päättely)**.

## 3. Push-ilmoitukset PWA:lle (yksityiskohtaisesti)

Tämä on se osa, josta Open Habitatin `push-when-your-turn`-työ voi oppia
eniten. Kuvaus perustuu koodiin **(lähde)**, arviot ovat **(päättely)**.

**Putki.** `NotificationHub` tilaa synkronointimoottorin tapahtumat ja
päättää, milloin ilmoitetaan ([`notificationHub.ts`][nhub]):

- *Lupapyyntö*: kun istunnon `agentState.requests` saa uuden tunnisteen,
  ilmoitus lähtee 500 ms viiveellä (debounce), jotta peräkkäiset pyynnöt
  yhdistyvät.
- *Valmis*: kun agentti lähettää `ready`-tapahtuman, enintään kerran viidessä
  sekunnissa per istunto.
- *Tehtävä valmis tai epäonnistui* sekä *istunto päättyi* omina tyyppeinään.

Kanavia on monta (Web Push, natiivi FCM/APNs relayn kautta, Telegram,
ServerChan, WeCom-ehdotuksia), ja ne käydään läpi järjestyksessä. Jos
natiivi push hyväksyttiin jollekin nimiavaruuden laitteelle, Web Push
ohitetaan samassa lähetyksessä ([PWA][pwa], [`pushNotificationChannel.ts`][pchan]).

**Näkyvyys.** Selain raportoi `document.visibilityState`-arvon hubille
(`POST /visibility`, [`useVisibilityReporter.ts`][visrep]). Jos nimiavaruudella
on *yksikin* näkyvä yhteys, hub lähettää ilmoituksen SSE-toastina sille eikä
Web Pushia lainkaan; vasta kun toastia ei saatu perille, pushataan
([`pushNotificationChannel.ts`][pchan], [`visibilityTracker.ts`][vis]).
Seuraus: työpöydällä auki oleva välilehti estää puhelimen ilmoituksen, vaikka
ihminen on poissa koneelta. Sama ehto koskee ServerChanin "background only"
-tilaa, ja ohje sanoo sen suoraan: "This is namespace-wide and does not
select a particular device" ([Notifications][notif]) **(lähde)**.

**Avaimet ja tilaukset.** VAPID-avainpari luodaan ensimmäisellä
käynnistyksellä ja tallennetaan hubin `settings.json`-tiedostoon
([`vapidKeys.ts`][vapid]). Tilaus (`endpoint`, `p256dh`, `auth`) tallennetaan
tauluun `push_subscriptions`, avaimena nimiavaruus ja endpoint
([`pushSubscriptions.ts`][psubs]). Rajapinta on kolme reittiä: julkinen avain,
tilaus ja tilauksen poisto ([`push.ts`][proute]). Selain muistaa, millä
julkisella avaimella tilaus tehtiin (`localStorage`), ja jos hubin avain
vaihtuu, se peruu vanhan tilauksen, poistaa sen hubilta ja tilaa uudelleen;
kommentin mukaan muuten push-palvelu hylkää lähetykset
(`VapidPkHashMismatch`) ([`usePushNotifications.ts`][usepush]) **(lähde)**.

**Lähetys.** `web-push`-kirjasto salaa ja lähettää; HTTP 410 poistaa
tilauksen, muut virheet vain kirjataan lokiin ([`pushService.ts`][psvc]).
Hyötykuorma on otsikko, teksti, `tag` (esim. `ready-<istunto>`) ja
`data.url`. Teksti sisältää istunnon nimen ja lupapyynnössä työkalun nimen,
ei viestin sisältöä.

**Service worker.** `push`-käsittelijä näyttää ilmoituksen; `tag` korvaa
saman istunnon edellisen ilmoituksen. `notificationclick` sulkee ilmoituksen ja
kutsuu aina `clients.openWindow(url)` ([`sw.ts`][sw]) **(lähde)**. Avoin PR
#1616 korjaa juuri tämän: klikkaus avasi uuden HAPI-ikkunan sen sijaan, että
olisi kohdistanut jo auki olevaan ([PR #1616][i1616]) **(lähde)**.

**Lupakysely.** Sovellus pyytää ilmoituslupaa automaattisesti heti
kirjautumisen jälkeen ("a permission popup appears automatically", [PWA][pwa];
[`App.tsx`][app]) **(lähde)**. Safari ja Chrome vaativat tai suosivat
käyttäjän elettä lupakyselylle, ja iOS:llä Web Push toimii vain kotinäyttöön
lisätyssä sivustossa **(päättely; selainten tunnettu käytäntö, ei tarkistettu
HAPIn issueista)**.

**Mitä puuttuu (päättely koodista):**

- Lähetyksessä ei aseteta `TTL`:ää, `Urgency`:ä eikä `Topic`:ia, joten
  `web-push`-kirjaston oletus-TTL pätee: "Default TTL is four weeks"
  ([web-push-lib.js][wplib], **lähde**). Sammuksissa ollut
  puhelin voi saada vanhan "Ready for input" -ilmoituksen kauan sen jälkeen,
  kun asia on hoidettu.
- Ilmoitusta ei peruta, kun lupapyyntö hyväksytään tai vastaus luetaan
  toisella laitteella. `tag` korvaa vain saman istunnon seuraavan ilmoituksen.
- Vain 410 poistaa tilauksen; 404 (jota osa push-palveluista käyttää
  vanhentuneelle tilaukselle) jää kantaan ja epäonnistuu joka kerta.
- Hub muistaa ilmoitustilan (debounce, cooldown, tunnetut pyynnöt) vain
  prosessin muistissa. Hubin uudelleenkäynnistyksen aikana syntyneet
  valmis-ilmoitukset menetetään; tämän toteaa myös avoin ehdotus
  [#1941][i1941] **(lähde)**.
- Ilmoitusasetuksia (mitkä tapahtumat, millä laitteella) ei ole; avoin PR
  [#1360][i1360] ehdottaa niitä **(lähde)**.

**Natiivisovellusten push** kulkee HAPIn ylläpitämän relayn kautta, koska
APNs- ja FCM-lähetysoikeudet kuuluvat sovelluksen julkaisijalle. Hub salaa
sisällön laitekohtaisella AES-256-GCM-avaimella, ja relay näkee vain
metatiedot ([relay README][relay]) **(lähde)**. Web Pushissa tätä ei
tarvita, koska selaimen push-palvelu hyväksyy kenen tahansa VAPID-avaimen
**(päättely)**.

## 4. Mitä oma SQLite-varasto maksaa

Hubin kanta (`~/.hapi/hapi.db`) on HAPIn ainoa historia selaimelle. Hinnan
näkee koodista ja issueista **(lähde)**:

- **Skeema muuttuu jatkuvasti.** `SCHEMA_VERSION = 29` noin kymmenessä
  kuukaudessa, ja migraatiokoodia on 59 `migrateFromV…`-viittausta; repossa
  on yli 15 migraatiotestiä ([`store/index.ts`][store]).
- **Koko on ongelma.** Agentin työkalutulosteet katkaistaan 64 KiB:iin (48 KiB
  alusta, 12 KiB lopusta), ja yli 256 merkin sisältö pakataan zstd:llä
  ([`contentCodec.ts`][codec]). Olemassa olevaa kantaa varten on erillinen
  offline-tiivistysskripti, jonka ohjeessa hub pysäytetään ja tiedostot
  vaihdetaan käsin ([`compact-db.ts`][compact]), sekä istuntojen
  siivousskripti ([`cleanup-sessions.ts`][cleanup]). Asetuksiin on lisätty
  tietokannan levynkäytön näyttö ([#1224][i1224]).
- **Kasvu kaataa palvelun.** Kahden ja puolen gigatavun kannassa (521
  istuntoa, 480 000 viestiä) hub pyöritti `sessions`-taulua läpi useita
  kertoja sekunnissa ja jonotti kaikki pyynnöt; ainoa korjaus oli vanhojen
  istuntojen poisto ([#1689][i1689]). 1,6 Gt:n koneella tokenkulutuksen
  näkymän avaaminen 1,9 Gt:n kannalla varasi noin 4,8 Gt muistia ja kaatoi
  koko koneen niin, ettei SSH:kaan vastannut ([#1887][i1887]).
- **Kaksi totuutta erkanee.** Hubin istunto muistaa Clauden
  istuntotunnisteen ja pyytää jatkamaan sitä, mutta Claude aloittikin uuden
  transkriptin; kääre kirjoitti uuden tunnisteen päälle, ja seuraavalla
  kerralla agentti jatkoi tyhjästä. "The operator sees 'the same chat' in
  the web UI; the Claude process has amnesia" — 649 viestiä hubissa, ei
  kontekstia agentilla ([#1933][i1933]).
- **Natiivi historia pitää tuoda.** Pi:n terminaali-istunnot tuodaan kantaan,
  ja tuonti voi päätyä tilaan `diverged`, kun natiivi tiedosto ja kopio eivät
  enää täsmää ([`piSessions.ts`][pisessions]). Pi:n historiaoperaatioille on
  oma aikakatkaisu, joka pidetään hubin 120 sekunnin rajan alla
  ([`conversationHistory.ts`][pihist]).
- **Kirjattu jono.** Koska viestit odottavat hubissa ennen toimitusta,
  `messages`-taulussa on toimitustila, ajastus ja neljä osittaista indeksiä
  jonon tiloille ([`store/index.ts`][store]). Katkaisu koskee vain agentin
  viestejä, koska käyttäjän viestit toimitetaan kannasta agentille sellaisinaan
  ([`contentCodec.ts`][codec]).

**Päättely.** Oma kanta antaa HAPIlle sen, mitä natiivi historia ei anna
kymmenelle eri harnessille: yhtenäisen viestimuodon, jonon, haun ja
tilastot. Hinta on, että jokainen agentti tarvitsee muuntimen, jokainen
muutos migraation ja jokainen kasvava asennus siivouksen, ja silti kopio voi
erota natiivista niin, että käyttäjä näkee eheän keskustelun, jota agentti ei
enää muista. Open Habitatin yhden harnessin ja natiivin historian malli välttää
nämä kaikki.

## 5. Kypsyys ja lisenssi

Mittaukset GitHub API:sta 31.10.2026 **(lähde)**:

| Mittari | Arvo |
|---|---|
| Repo luotu | 24.12.2025 |
| Tähdet / forkit | 5 339 / 637 |
| Commitit | noin 1 700 |
| Avoimet issuet + PR:t | 362 |
| Uusin julkaisu | v0.33.3 (29.10.), kolme julkaisua samana päivänä |
| Pääkehittäjä | tiann 833 committia, seuraavat 160, 159, 119 |
| Lähdekoodi | noin 220 000 riviä TypeScriptiä ilman testejä (hub 38k, CLI 84k, web 91k; oma mittaus `wc -l`) |
| Lisenssi | AGPL-3.0; PWA ilmainen, natiivisovellukset maksullisia |

Kehitys on nopeaa ja issuet ovat poikkeuksellisen perusteellisia (juurisyy,
mittaukset, toistettava resepti), ja moni PR kertoo tekoälyn käytöstä
("AI assistance: OpenAI Codex was used…", [#1616][i1616]) **(lähde)**.
Versio on yhä 0.x **(lähde)**. Telemetriaa tai analytiikkaa ei ole
([Privacy][privacy]) **(lähde)**.

## 6. Rinnakkain Open Habitatin kanssa

Open Habitatin sarake perustuu tiedostoihin `docs/product.md` ja juuren
`AGENTS.md` sekä issueen `push-when-your-turn`.

| | HAPI | Open Habitat |
|---|---|---|
| Ensisijainen pääsy | Terminaali, puhelin kaukosäätimenä (PWA, Telegram, natiivisovellukset) | Selain (työpöytä ja puhelin). SSH ja tmux rinnalla |
| Missä agentit ajetaan | Kääreen tai runnerin käynnistäjän koneella | Yhdellä Linux-palvelimella, ihmisen omana Unix-käyttäjänä |
| Käyttäjiä | Yksi per hub. Nimiavaruudet jaetulla tokenilla | Monta ihmistä, kukin omalla Unix-tunnuksellaan |
| Tunnistus | Jaettu `CLI_API_TOKEN` tai Telegram, 4 h JWT | GitHub-kirjautuminen, ylläpitäjän pääsypäätös, 90 päivän istunto |
| Valtuusraja | Hubin ja agentin käynnistäjä | Unix-käyttäjä. Daemon ei luota selaimen tai gatewayn väitteisiin |
| Agentit | 10 harnessia | Pi |
| Pi:n integraatio | `pi --mode rpc`, ei terminaalia, aina auto-approve | Pi:n RPC daemonin omistamana |
| Terminaali ↔ selain | Claude: prosessin vaihto. Codex: jaettu app-server. Pi: vain etä | Terminaalin keskustelu selaimessa vain luettava; selaimen kirjoittajilla yhteinen lukko |
| Historia | Hubin SQLite-kopio + natiivi transkripti | Pi:n natiivi historia, ei rinnakkaista varastoa |
| Push | Web Push (VAPID hubissa), natiivi relay, Telegram, ServerChan | Suunnitteilla: Web Push, avaimet ja tilaukset käyttäjän omissa tiedostoissa, daemon lähettää |
| Kieli | Englanti | Suomi |
| Kypsyys | 10 kk, 5,3k tähteä, 0.x, päivittäiset julkaisut | Esijulkaisu, testipalvelin |

## 7. Suositukset

### Mitä Open Habitat voisi oppia (tärkeysjärjestyksessä)

Kohdat 1–5 koskevat suoraan käynnissä olevaa `push-when-your-turn`-työtä.

1. **Näkyvyys laitekohtaisesti, ei käyttäjäkohtaisesti.** HAPI jättää
   puhelimen ilmoittamatta, jos *mikä tahansa* saman käyttäjän välilehti on
   näkyvissä, ja sen oma ohje myöntää rajoituksen. *Miksi:* Open Habitatin
   käyttötapa on juuri se, että työpöydän välilehti jää auki ja ihminen lähtee
   puhelimen kanssa. Toimiva sääntö olisi esimerkiksi: lähetä, ellei jokin
   välilehti ole näkyvissä *ja* siinä ole ollut käyttäjän toimintaa
   (näppäily, osoitin, fokus) viime minuutteina. Daemonin olemassa oleva
   läsnäolo pitää tarkistaa tätä vasten: `visibilityState === 'visible'`
   yksin on liian heikko näyttö **(päättely)**.
2. **Lyhyt TTL ja `Urgency`.** HAPI lähettää kirjaston oletuksella (neljä
   viikkoa). *Miksi:* "Sinun vuorosi" -ilmoitus on hyödytön tunnin päästä,
   ja vanhentunut ilmoitus puhelimen herätessä heikentää luottamusta koko
   ominaisuuteen. Esimerkiksi TTL tunnista muutamaan ja `Urgency: normal`
   tai `high` kysymyksille **(päättely)**.
3. **Ilmoitus pois, kun vuoro on ohi.** HAPI ei peru näytettyjä
   ilmoituksia. *Miksi:* kun ihminen vastaa työpöydällä, puhelimeen jäänyt
   "odottaa sinua" on väärä. Kaksi kevyttä keinoa: `tag` keskustelun
   tunnisteesta (uusi korvaa vanhan, kuten HAPIssa), ja service worker
   sulkee saman tagin ilmoitukset (`registration.getNotifications({tag})`),
   kun sovellus avautuu keskusteluun tai kun daemon lähettää hiljaisen
   "peruttu"-viestin. Jälkimmäinen on selaimissa rajattu, koska
   `userVisibleOnly` vaatii yleensä näkyvän ilmoituksen jokaisesta pushista,
   joten varmin keino on sulkea ilmoitukset sovelluksen avautuessa
   **(päättely; selainten käytännöt tarkistettava toteutuksessa)**.
4. **Klikkaus kohdistaa avoimeen ikkunaan.** HAPIn `openWindow` aina -toteutus
   avasi uusia ikkunoita, ja korjaus (#1616) on yhä avoin PR. *Miksi:*
   `clients.matchAll({type: 'window'})` ja `focus()` + navigointi ovat muutama
   rivi, ja ilman niitä PWA:sta tulee ikkunoiden pino. Kun service worker
   rajataan pelkkään pushiin, kuten issue linjaa, tämä on sen ainoa muu tehtävä
   **(lähde + päättely)**.
5. **Avainten vaihto ja kuolleet tilaukset.** HAPI tallentaa selaimeen julkisen
   avaimen, jolla tilaus tehtiin, ja tilaa uudelleen, kun avain vaihtuu.
   *Miksi:* Open Habitatissa avain kuuluu käyttäjälle ja voi kadota tai
   vaihtua (tiedosto poistettu, käyttäjä luotu uudelleen); ilman tätä
   ilmoitukset lakkaavat hiljaa. Lisäksi sekä 404 että 410 kannattaa tulkita
   tilauksen päättymiseksi, toisin kuin HAPIssa **(lähde + päättely)**.
6. **Lupakysely vasta käyttäjän eleestä.** HAPI kysyy lupaa heti
   kirjautumisen jälkeen. *Miksi:* issuen kokeellinen kortti ("turn on →
   permission asked") on jo oikea ratkaisu, ja iOS vaatii eleen joka
   tapauksessa. Tämä vahvistaa nykyisen linjauksen **(päättely)**.
7. **Vastausten arbitraatio natiivilla, ei selaimella.** HAPIn Codex-dokumentti
   on hyvä malli sille, miten kahden kirjoittajan istunto kuvataan
   rehellisesti: selaimen vastaus on "vain ehdokas", natiivi päättää, ja
   epävarmaa lähetystä ei toisteta. *Miksi:* jos Pi joskus saa jaetun
   istunnon (esim. pi-durable), Open Habitatin pitää kertoa käyttäjälle
   samat asiat. Nykyinen tuotekuvaus ("vastauksen vastaanotto palvelimella
   ei vahvista, että Pi käsitteli sen") on jo samaa henkeä **(päättely)**.
8. **Elinkaaren omistajuus kirjoitetaan auki.** HAPIn sääntö "lisäterminaali
   vain liittyy, ei koskaan omista" ja "elinkaari seuraa alkuperäistä
   käynnistäjää, ei asiakkaiden määrää" on selkeä. *Miksi:* Open Habitatissa
   sama kysymys tulee vastaan heti, jos terminaalin ja selaimen
   yhtäaikainen Pi-käyttö tulee mahdolliseksi; Open Habitatissa daemon on
   luonteva omistaja, koska se on aina päällä **(päättely)**.

### Missä Open Habitat on jo parempi

- **Oikea monikäyttäjäisyys.** HAPIn nimiavaruudet jakavat yhden
  salaisuuden ja yhden käyttöjärjestelmätunnuksen. Open Habitatissa ihmiset
  ovat eri Unix-käyttäjiä, ja push-suunnitelmakin pitää avaimet ja tilaukset
  kunkin omissa tiedostoissa, kun HAPIssa ne ovat yhdessä kannassa.
- **Ei toista historiaa.** HAPIn issueista näkee, mitä kopio maksaa:
  migraatiot, pakkaus, siivous, gigatavujen kannat, jotka jumittavat palvelun,
  ja erkaantuminen natiivista ([#1933][i1933], [#1689][i1689],
  [#1887][i1887]). Open Habitat lukee Pi:n historian suoraan, joten
  terminaalissa aloitettu keskustelu näkyy selaimessa ilman tuontia ja ilman
  tilaa "diverged".
- **Pi on ensisijainen.** HAPIssa Pi on yksi kymmenestä, ilman terminaalia ja
  ilman lupakyselyitä. Open Habitat rakentaa Pi:n omien käsitteiden
  (Ohjaa/Lähetä, kysymykset, otsikko istuntonimenä, tiivistelmä historiassa)
  varaan.
- **Selain ensisijaisena ja tunnistettuna.** GitHub-kirjautuminen,
  ylläpitäjän pääsypäätös ja pitkä istunto ovat tuotteen osa. HAPIssa
  julkinen pääsy on käyttäjän oma tunneli tai HAPIn relay ja jaettu token.
- **Ei kolmatta osapuolta reitillä.** HAPIn helppo polku on sen oma relay
  (verkko) ja oma push-relay (natiivit). Open Habitatin Web Push käyttää vain
  selaimen omaa push-palvelua, joka on väistämätön.

### Mitä ei kannata kopioida

- **Hubin oma viestikanta ja tuonti natiivista.** Juuri se toinen totuus,
  jonka periaatteet kieltävät, ja HAPIn issuet näyttävät, miksi.
- **Prosessin vaihto paikallisen ja etätilan välillä.** Agentin tappaminen ja
  uudelleenkäynnistys selaimen viestistä on kääreen keino jakaa terminaali;
  Open Habitatissa daemon omistaa Pi:n jo valmiiksi, eikä Pi:n
  RPC-tilassa ole terminaalia vaihdettavaksi.
- **Monta ilmoituskanavaa** (Telegram, ServerChan, WeCom, natiivi relay).
  Standardi Web Push riittää selaintuotteelle, ja jokainen lisäkanava on uusi
  salaisuus ja uusi ulkoinen palvelu.
- **Jaettu token ja nimiavaruus monen ihmisen erotteluna.**
- **Automaattinen lupakysely** ja **uusi ikkuna joka klikkauksesta**
  (yllä).
- **Pi aina ilman lupakyselyitä.** HAPI kirjaa sen Pi:n ominaisuudeksi; Open
  Habitatin raja on Unix-tunnus, mutta Pi:n omat kysymykset näytetään ja niihin
  vastataan selaimessa.

### Huomioita `push-when-your-turn`-työlle

Issuen suunnitelma (avaimet ja tilaukset käyttäjän omissa 0600-tiedostoissa,
daemon lähettää, minimaalinen sisältö, service worker vain pushia varten,
kokeellinen kortti) on HAPIn mallia tiukempi ja oikeampi Open Habitatin
periaatteille. HAPIsta opittavat tarkennukset, tärkein ensin:
laitekohtainen läsnäolo eikä käyttäjäkohtainen (suositus 1); lyhyt TTL
(2); ilmoitusten sulkeminen, kun vuoro on ohi tai keskustelu avataan (3);
klikkaus kohdistaa avoimeen ikkunaan (4); avaimen vaihdon havaitseminen
selaimessa ja 404/410 tilauksen päättymisenä (5). Lisäksi kannattaa
huomata, että HAPIn debounce- ja cooldown-tila on vain muistissa, ja sen
vuoksi hubin uudelleenkäynnistys hukkaa ilmoituksia ([#1941][i1941]). Open
Habitatissa "Sinun vuorosi" johdetaan natiivista tilasta, joten daemonin
uudelleenkäynnistyksen jälkeen voidaan laskea, mitkä keskustelut ovat
käyttäjän vuorolla, ja päättää ilmoituksesta ilman omaa ilmoitusvarastoa
**(päättely)**.

## Lähteet

- HAPI README: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/README.md>
- How it Works: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/how-it-works.md>
- Why HAPI: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/why-hapi.md>
- Supported agents: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/agents.md>
- Codex shared sessions: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/codex-shared-sessions.md>
- PWA: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/pwa.md>
- Notifications: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/notifications.md>
- Namespace: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/namespace.md>
- Installation: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/installation.md>
- Deployment: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/deployment.md>
- Privacy Policy: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/privacy.md>
- Push relay README: <https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/relay/README.md>
- Lähdekoodi: ks. viitteet alla (kaikki commitista `f8e55fb9`)
- Issuet ja PR:t: [#1224][i1224], [#1360][i1360], [#1616][i1616], [#1689][i1689], [#1887][i1887], [#1933][i1933], [#1941][i1941]
- Show HN: HAPI – Vibe Coding Anytime, Anywhere (11.1.2026): <https://news.ycombinator.com/item?id=46571992>
- HN-kommentti 4.1.2026: <https://news.ycombinator.com/item?id=46493425>
- HN-kommentti 22.6.2026: <https://news.ycombinator.com/item?id=48630219>

[commit]: https://github.com/tiann/hapi/tree/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8
[readme]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/README.md
[how]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/how-it-works.md
[why]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/why-hapi.md
[agents]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/agents.md
[codex]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/codex-shared-sessions.md
[pwa]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/pwa.md
[notif]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/notifications.md
[ns]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/namespace.md
[install]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/installation.md
[deploy]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/guide/deployment.md
[privacy]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/docs/privacy.md
[relay]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/relay/README.md
[auth]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/web/routes/auth.ts
[events]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/web/routes/events.ts
[proute]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/web/routes/push.ts
[pisessions]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/web/routes/piSessions.ts
[nhub]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/notifications/notificationHub.ts
[pchan]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/push/pushNotificationChannel.ts
[psvc]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/push/pushService.ts
[vis]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/visibility/visibilityTracker.ts
[vapid]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/config/vapidKeys.ts
[psubs]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/store/pushSubscriptions.ts
[store]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/store/index.ts
[codec]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/src/store/contentCodec.ts
[compact]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/scripts/compact-db.ts
[cleanup]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/hub/scripts/cleanup-sessions.ts
[sw]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/web/src/sw.ts
[usepush]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/web/src/hooks/usePushNotifications.ts
[visrep]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/web/src/hooks/useVisibilityReporter.ts
[app]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/web/src/App.tsx
[local]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/cli/src/modules/common/launcher/BaseLocalLauncher.ts
[loop]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/cli/src/claude/loop.ts
[pitransport]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/cli/src/pi/piTransport.ts
[pihist]: https://github.com/tiann/hapi/blob/f8e55fb930cde45dd4ef5cc5dd1fac0a047f38b8/cli/src/pi/conversationHistory.ts
[wplib]: https://github.com/web-push-libs/web-push/blob/master/src/web-push-lib.js
[i1224]: https://github.com/tiann/hapi/issues/1224
[i1360]: https://github.com/tiann/hapi/pull/1360
[i1616]: https://github.com/tiann/hapi/pull/1616
[i1689]: https://github.com/tiann/hapi/issues/1689
[i1887]: https://github.com/tiann/hapi/issues/1887
[i1933]: https://github.com/tiann/hapi/issues/1933
[i1941]: https://github.com/tiann/hapi/issues/1941
[hn1]: https://news.ycombinator.com/item?id=46493425
[hn2]: https://news.ycombinator.com/item?id=48630219
[hn3]: https://news.ycombinator.com/item?id=46571992
