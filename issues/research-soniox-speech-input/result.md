# Puhesyöte viestikenttään Sonioxilla: selvitys ja suositus

Selvitetty 2026-10-26. Pohjana `internal/AGENTS.md`:n valtuussäännöt (mallien
avaimet, sivuston AI-avain, integraatioiden sovellustunnukset), gatewayn
otsakkeet (`internal/gateway/server.go`, `views_linux.go`), editorin
kertakäyttöinen hand-off (`internal/gateway/editor_linux.go`) ja Sonioxin
oma dokumentaatio (`soniox.com/docs`, luettu `.mdx`-lähteinä samana päivänä).

## Lyhyesti

Soniox sopii tähän hyvin: sen dokumentoitu ja suositeltu selainmalli on
juuri se, mitä issue ehdottaa. Palvelin luo pitkäikäisellä avaimella
lyhytikäisen, kertakäyttöisen avaimen, jolla selain avaa WebSocketin suoraan
Sonioxille. Pysyvä avain ei koskaan päädy selaimelle. Reaaliaikainen
tunnistus maksaa noin 0,12 $/tunti, suomi on tuettu, ja välitulokset tulevat
token kerrallaan.

**Suositus:** ensimmäinen versio käyttää *henkilön omaa* Soniox-avainta, joka
on tallennettu hänen kotihakemistoonsa. Hänen daemoninsa luo jokaista
sanelua varten kertakäyttöisen väliaikaisen avaimen (60 s,
istuntokatto), ja selain striimaa suoraan Sonioxin EU- tai US-päätteeseen.
Gateway vain välittää pyynnön kuten nyt, eikä se saa uutta valtuutta.
Provision ei osallistu. Malli vaatii kuitenkin yhden Jarin päätöksen:
väliaikainen avain on palveluntarjoajan bearer-tunniste, joka kulkee
sopimuksen yli selaimelle, ja nykyinen sääntö kieltää tämän (kohta P1).
Sivuston yhteinen avain on erillinen myöhempi päätös (P3), koska kaikki
sen toteutustavat siirtävät valtuutta tai jakavat ylläpitäjän avaimen.

## Mitä kokeiltiin ja mikä on dokumentaatiota

Kokeiltu (ilman Soniox-tiliä, joten vain rajapinnan reunat):

- `POST https://api.soniox.com/v1/auth/temporary-api-key` ja
  `api.eu.soniox.com` vastaavat ilman avainta ja väärällä avaimella `401
  unauthenticated` (JSON, `error_type`). Päätepiste on olemassa molemmilla
  alueilla.
- Samojen osoitteiden CORS-esikysely palauttaa `access-control-allow-origin:
  *` ja sallii `Authorization`-otsakkeen. Selain *voisi* siis kutsua avaimen
  luontia suoraan. Tämä on syy pitää pysyvä avain poissa selaimesta, ei
  ominaisuus, jota käyttäisimme.
- `wss://stt-rt.soniox.com/transcribe-websocket` ja `stt-rt.eu.soniox.com`:
  Node 22:n selainyhteensopivalla `WebSocket`-luokalla protocols-listassa
  `["soniox-api-key", "snx_temp_invalid"]`. Kättely onnistuu (palvelin
  valitsee protokollan `soniox-api-key`), sen jälkeen tulee virhekehys
  `error_code 401`, `"Invalid or expired temporary API key"`, ja yhteys
  suljetaan koodilla 1000. Tämä vastaa dokumentaatiota: virhe tulee kehyksenä
  eikä kättelyn epäonnistumisena, joten selain näkee syyn.
- `npm view @soniox/client`: versio 2.4.0 (julkaistu 2026-10-12), MIT, ei
  ajonaikaisia riippuvuuksia. Paketin koodista näkyy, että mikrofoni
  kaapataan `MediaRecorder`illa selaimen oletusformaatissa ja avain annetaan
  protocols-listassa.
- Gatewayn nykyiset otsakkeet koodista: sovelluksen pääoriginilla on CSP:stä
  vain `frame-ancestors 'none'` eikä `Permissions-Policy`ä, joten
  `connect-src` ja mikrofoni eivät ole nyt estettyjä. Näkymäoriginilla
  (`views_linux.go`) on `microphone=()` ja `connect-src 'none'`, ja niiden
  kuuluukin pysyä sellaisina.

Vain dokumentaatiosta (ei kokeiltu, koska oikeaa avainta ei käytetty):
suomen laatu, välitulosten käytös oikealla puheella, väliaikaisen avaimen
rajoitteiden toteutuminen, hinnat, säilytyskäytännöt ja iOS Safarin
ääniformaatin kelpaaminen.

## Löydökset kysymyksittäin

### 1. Reaaliaikainen rajapinta

- Pääte `wss://stt-rt.soniox.com/transcribe-websocket` (alueittain
  `stt-rt.eu.`, `.jp.` ja `.in.`). Yksi stream per yhteys.
- Avain annetaan yhteyden avauksessa: palvelimelta `Authorization: Bearer`,
  selaimelta protocols-listan pari `soniox-api-key`, `<avain>`. Vanha
  `api_key`-kenttä aloitusviestissä lakkaa toimimasta 15.1.2027, joten
  toteutus käyttää uutta tapaa.
- Aloitusviesti on JSON: `model: "stt-rt-v5"`, `audio_format: "auto"` (webm,
  ogg, aac, mp3, wav, flac ym.) tai raaka PCM näytetaajuuksineen, sekä
  `language_hints`, `language_hints_strict`, `context` (termit, aihe),
  endpoint-tunnistus, diarisointi ja käännös.
- Ääni lähetetään binäärikehyksinä. Lopetus on tyhjä *tekstikehys*, jonka
  jälkeen palvelin palauttaa loput tokenit ja `finished`-vastauksen ja
  sulkee yhteyden. Vaihtoehtoisesti `{"type":"finalize"}` viimeistelee
  siihen asti tulleen äänen ja palauttaa `<fin>`-merkin, mikä sopii
  pidä-pohjassa-käyttöön.
- Ennen aloitusta tai tauolla tarvitaan keepalive vähintään 40 sekunnin
  välein, muuten yhteys suljetaan koodilla 1001.
- Rajat (oletus, organisaatiokohtainen): 10 samanaikaista streamia, 100
  pyyntöä minuutissa ja 300 minuuttia per stream. Konsolista voi pyytää
  lisää (paitsi kestoa). Yhteysraja on streamirajan monikerta.
- Virallinen selain-SDK `@soniox/client` hoitaa mikrofonin, yhteyden,
  uudelleenyhdistämisen ja avaimen haun (`config`-callback hakee tuoreen
  väliaikaisen avaimen ennen jokaista sessiota). Protokolla on niin pieni,
  että sen voi myös toteuttaa itse muutamalla sadalla rivillä. SDK on
  kuitenkin MIT-lisensoitu ja riippuvuudeton, joten se on järkevä
  lähtökohta ja säästää uudelleenyhdistämisen ja oikeuksien käsittelyn.

### 2. Suomen tuki ja laatu

- Suomi (`fi`) on tuettujen kielten listalla. Sama malli tunnistaa ja
  kääntää kaikilla kielillä ja vaihtaa kieltä kesken lauseen, mikä sopii
  suomen ja englannin sekakieleen (koodi- ja tuotenimet). Vihjeeksi
  `language_hints: ["fi", "en"]`.
- Laatu: Sonioxin omilla vertailusivuilla on ollut suomen sanavirheosuus
  10,6 % ja kilpailijoilla 15–20 % (YouTube-äänestä koottu
  monikielivertailu). Hakutulos näytti luvun, mutta sivu ei enää tarjonnut
  sitä luettavaksi, ja sivujen omat luvut olivat keskenään ristiriitaiset.
  Riippumatonta suomen mittausta ei löytynyt. Julkinen benchmark-sivu
  (Pipecat, semanttinen WER 1,3 %) on vain englantia.
- `context.terms` voi parantaa nimien ja termien tunnistusta, mutta silloin
  esimerkiksi työtilojen nimet lähtisivät Sonioxille. Se on myöhempi
  valinta, ei ensimmäisen version asia.
- Laatu kannattaa todeta itse. Proto- tai toteutuskierroksella Jari sanelee
  tyypillisen viestin oikealla avaimella; tilin voi tehdä Sonioxin
  konsolissa.

### 3. Välitulokset

Jokainen vastaus sisältää tokeneita, joilla on `is_final`. Ei-lopulliset
tulevat heti ja voivat muuttua tai kadota, lopulliset tulevat kerran
eivätkä muutu. Viestikentässä tämä tarkoittaa kahta osaa: vahvistettu teksti
kirjoitetaan kenttään, ja perään näytetään himmeänä vaihtuva arvaus, joka
korvataan jokaisella vastauksella. Endpoint-tunnistusta (`<end>`) ei
saneluun tarvita, koska lopetus on käyttäjän toiminto (painike irti tai
toinen painallus), jota seuraa finalize tai tyhjä kehys.

### 4. Hinnoittelu

- Reaaliaikainen tunnistus maksaa noin 0,12 $ tunnilta (tokenihinnat: ääni 2,00 $
  ja tekstitulos 4,00 $ miljoonaa tokenia kohden; tunti ääntä on noin 30 000
  syötetokenia). 30 sekunnin sanelu maksaa noin 0,001 $. Diarisointi, kielen
  tunnistus ja käännös sisältyvät hintaan.
- Hinta riippuu *istunnon* kestosta, ei pelkästä puheesta. Avoimeksi unohtunut
  mikrofoni maksaa, joten aikakatto on sekä kustannus- että
  yksityisyysasia (kohta 6).
- Maksaja on aina sen tilin omistaja, jonka avaimella väliaikainen avain
  luotiin. Tämä ratkaisee, kenen avainta käytetään.

### 5. Tietosuoja ja datan säilytys

- Sonioxin mukaan reaaliaikaisesta äänestä ja tekstistä ei säilytetä mitään
  (säilytys koskee vain erikseen pyydettyä async-tallennusta, joka
  poistetaan 30 päivässä), eikä niitä käytetä mallien opettamiseen. Lokeihin
  ei kirjata ääntä eikä tekstiä, vaan käyttömetatietoja (malli, kesto,
  tokenit, valinnainen `client_reference_id`).
- Sertifioinnit: SOC 2 Type 2, ISO/IEC 27001:2022, GDPR, HIPAA (asiakirjat
  konsolin kautta).
- Datan sijainti valitaan *projektikohtaisesti*: EU-projektin avaimet
  toimivat EU-päätteissä (`api.eu.soniox.com`, `stt-rt.eu.soniox.com`),
  ja ääni ja teksti pysyvät alueella. EU-alue pitää pyytää konsolista.
  Avain ja pääte kuuluvat yhteen, joten avaimen tallennuksen yhteydessä
  tallennetaan myös alue. Väärän parin virhe näkyy virhekehyksenä.
- Ääni kulkee suoraan selaimesta Sonioxille. Jos se kulkisi isännän kautta,
  se olisi daemonin muistissa, mutta mitään ei tallennettaisi kummassakaan
  mallissa.

### 6. Avaimen hallinta

**Kenen avain.** Tuotteen vakiintunut kaava on: henkilön oma tunniste
hänen kotihakemistossaan, ja tasan yksi poikkeus, sivuston AI-avain, joka
kopioidaan kerran henkilön omaksi. Soniox istuu samaan kaavaan, mutta
erolla: Sonioxilla ei ole natiivia työkalua eikä omaa avaintiedostoa,
ainoastaan SDK:iden ympäristömuuttuja `SONIOX_API_KEY`. Henkilön oma avain
tarvitsee siksi tuotteen nimeämän paikan kotihakemistossa, samaan tapaan
kuin integraatioluettelo nimeää työkalujen tiedostot. Esimerkki on
`~/.config/soniox/` 0600-tiedostona, jossa on avain ja alue. Pi:n
`auth.json` ei sovi, koska se on Pi:n oma mallien avainten tiedosto. Kun
avain on henkilön kotihakemistossa, hänen agenttinsa voivat käyttää sitä
myös itse (esimerkiksi äänitiedoston litterointiin), ja tämä on natiivin
mallin mukaista.

**Väliaikainen avain.** `POST /v1/auth/temporary-api-key` (rungossa
`usage_type: "transcribe_websocket"`, `expires_in_seconds` 1–3600,
`single_use`, `max_session_duration_seconds` 1–18000 ja
`client_reference_id`) palauttaa `snx_temp_…`-avaimen ja
`expires_at`-ajan. Vanhentuminen koskee vain *uuden* streamin avaamista,
ei käynnissä olevaa. Siksi rajoitteet ovat:

- `single_use: true`, jolloin siepattu avain ei avaa toista maksullista
  streamia;
- `expires_in_seconds: 60`, eli avain luodaan vasta, kun käyttäjä painaa
  mikrofonia;
- `max_session_duration_seconds`, esimerkiksi 600, joka on yhden sanelun
  katto ja suojaa unohtuneelta mikrofonilta. Selain lopettaa sitä ennen
  omalla ajastimellaan.

Avaimen luova pitkäikäinen avain tarvitsee vain oikeudet *Temporary API
keys* ja *Speech-to-text, real-time*. Konsolissa avaimen oikeudet voi
rajata, ja ohjeen pitää kehottaa siihen.

**Suoraan Sonioxille vai isännän kautta.** Molemmat ovat Sonioxin
dokumentoimia malleja (direct stream ja proxy stream):

| | Suora striimi, daemon luo väliaikaisen avaimen | Ääni daemonin kautta |
|---|---|---|
| Pysyvä avain selaimelle | ei | ei |
| Selaimelle tulee | kertakäyttöinen 60 s avain | ei mitään avainta |
| Viive | pienin (Sonioxin suositus) | yksi välihyppy lisää gatewayn ja daemonin kautta |
| Uusi koodi | yksi daemonin reitti (avaimen luonti) ja selainkoodi | WebSocket-relay gatewayhin (terminaalin kaavalla), daemonin Soniox-asiakas, kehysten välitys ja virheiden käännös |
| Isännän kuormitus | ei äänidataa | jokainen sanelu pitää kaksi WebSocketia auki isännällä |
| Kolmannen osapuolen origin selaimessa | kyllä, `stt-rt(.eu).soniox.com` | ei |
| Nykyinen sääntö "Tokens … never cross the contract" | vaatii poikkeuksen (P1) | pysyy ennallaan |
| SDK käytettävissä | kyllä | ei (oma protokolla daemonille) |

Väliaikaisen avaimen riski on rajattu: kertakäyttöinen, minuutin elinikä,
istuntokatto, ja se kelpaa vain reaaliaikaiseen tunnistukseen ja vain sen
henkilön omalla laskulla, joka sen pyysi. Avain on selaimen muistissa sen
saman session aikana, joka jo voi ajaa henkilön komentotulkkia. Editorin
hand-off on läheinen ennakkotapaus, sillä gateway antaa jo nyt selaimelle
minuutin kertakäyttöisen tokenin. Se on kuitenkin tuotteen oma tunniste
eikä palveluntarjoajan laskutettava tunniste, joten sääntöpoikkeus on
silti tehtävä tietoisesti.

## Vaihtoehdot

**A. Oma avain, suora striimi (suositus).** Henkilö tallentaa
asetuksissa Soniox-avaimen ja alueen. Tallennus kulkee nykyisellä
mallien avainten kaavalla: gateway välittää jäsentämättä, daemon kirjoittaa
kotihakemistoon ja vastaa vain läsnäolon ja nelimerkkisen loppuosan.
Mikrofonia painettaessa selain kutsuu daemonin reittiä (esimerkiksi
`POST /api/speech/session`), ja daemon luo henkilön avaimella väliaikaisen
avaimen ja palauttaa avaimen, vanhenemisajan ja aluekohtaisen WebSocket-osoitteen.
Selain striimaa suoraan. Ei uutta isäntätason tallennetta, ei valtuuden
siirtoa, ja koodia on vähiten. Hinta on sääntöpoikkeus P1.

**B. Oma avain, ääni daemonin kautta.** Sama avaimen säilytys. Gateway
välittää WebSocketin daemonille terminaalin tapaan (Origin- ja
CSRF-tarkistus, yhteysraja sessiota kohden, suljetaan session päättyessä),
ja daemon avaa Soniox-yhteyden `Authorization`-otsakkeella. Säännöt
pysyvät ennallaan, mutta tuotteeseen tulee pysyvä reaaliaikainen
äänirelay, jota pitää ylläpitää ja testata kahden prosessirajan yli. Tämä
kannattaa vain, jos Jari ei hyväksy P1:tä.

**C. Sivuston avain gatewayllä, gateway luo väliaikaiset avaimet.**
Ylläpitäjä antaa yhden Soniox-avaimen, ja kaikki voivat sanella ilman omaa
tiliä. Tämä on helpoin käyttäjälle, mutta se rikkoo kaksi kirjattua sääntöä
yhtä aikaa. Sivuston AI-avain on "the gateway's only persistent provider
credential", ja "the gateway never proxies use, issues per-person tokens".
Gateway saisi uuden verkkoyhteyden palveluntarjoajaan ja
henkilökohtaisten tunnisteiden myöntövallan. Kaikkien käyttö jakaisi
saman 10 streamin rajan ja yhden laskun. Valtuuden siirto on Jarin päätös
(P3).

**D. Sivuston avain kopioidaan koteihin sivuston AI-avaimen tapaan.**
Gateway säilyttää avaimen, ja se annetaan kerran uuden henkilön
daemonille, joka kirjoittaa sen hänen Soniox-tiedostoonsa vain, jos siellä
ei ole omaa. Tämän jälkeen toiminta on täsmälleen A. Kaava on jo
hyväksytty AI-avaimelle (myös myöhemmin liittyneet ja avaimen vaihto
daemonin kautta). Seuraus on sama kuin AI-avaimella: jokainen henkilö ja
hänen agenttinsa voi lukea ylläpitäjän Soniox-avaimen ja käyttää sitä
mihin tahansa sen oikeuksien sallimaan, myös rajattomasti väliaikaisten
avainten luontiin. Kopiota ei voi perua kuin vaihtamalla avain konsolissa.
Rajaus vain kahteen oikeuteen pienentää vahinkoa mutta ei laskua.

Selaimen oma Web Speech API ei ole todellinen vaihtoehto. Se puuttuu
Firefoxista, Chrome lähettää äänen Googlelle tuotteen hallitsematta, eikä
siinä ole aluevalintaa. Siksi sitä ei käsitellä tässä tarkemmin.

## Valtuusrajat: Jarin päätökset

- **P1. Saako lyhytikäinen palveluntarjoajan tunniste ylittää sopimuksen
  selaimelle?** `internal/AGENTS.md`: "Tokens, native error text and
  credential-bearing remote URLs never cross the contract." Vaihtoehto A
  tarvitsee rajatun poikkeuksen: daemonin luoma Sonioxin väliaikainen
  avain, `single_use`, enintään 60 s, istuntokatto ja vain
  `transcribe_websocket`. Sitä ei lokiteta eikä tallenneta, ja se näkyy vain
  pyytäneelle sessiolle. Jos Jari hyväksyy, sääntöön kirjataan poikkeus. Jos
  ei, valitaan B.
- **P2. Henkilön Soniox-avaimen paikka kotihakemistossa.** Natiivia
  säilöä ei ole, joten tuote nimeää tiedoston (ehdotus
  `~/.config/soniox/`, 0600, avain ja alue), ja daemon on sen ainoa
  tuotepuolen kirjoittaja. Tämä ei siirrä valtuutta, mutta se on uusi
  tuotteen nimeämä paikka kotihakemistossa, joten se on hyvä kirjata.
- **P3. Sivuston Soniox-avain, nyt tai myöhemmin, ja millä mallilla.**
  C antaa gatewaylle uuden pysyvän palveluntarjoajan tunnisteen ja
  oikeuden myöntää henkilökohtaisia tunnisteita, eli valtuus siirtyy
  gatewaylle. D toistaa AI-avaimen hyväksytyn kaavan ilman uutta
  gateway-valtuutta, mutta jakaa ylläpitäjän avaimen jokaiselle. Suositus
  on jättää tämä pois ensimmäisestä versiosta ja ottaa D, jos sille tulee
  tarve. D:ssä gatewayn toinen pysyvä palveluntarjoajan tunniste on
  edelleen muutos sääntöön "only persistent provider credential", vaikka
  käyttö pysyy daemonilla.
- **P4. `client_reference_id`.** Omalla avaimella sitä ei tarvita. Jos
  sivuston avain tulee (C tai D), Unix-käyttäjänimi tai sen johdannainen
  näkyisi ylläpitäjälle Sonioxin käyttölokissa henkilökohtaisena
  käyttötietona. Tämä on yksityisyysvalinta, joka tehdään P3:n yhteydessä.

Provision ei ole osallisena missään vaihtoehdossa. Broker ei tarvitse
verkkoa, tiedostoa eikä uutta operaatiota, eikä mikään malli kirjoita root-
omisteisia tiedostoja. Integraatioiden sovellustunnusten kaava
(root kirjoittaa ja daemonit lukevat) ei sovi Soniox-avaimelle. OAuth-
työpöytäsovelluksen asiakassalaisuus on käytännössä julkinen, mutta Soniox-
avain on suoraan laskutettava tunniste. Jos jokainen daemon voisi lukea sen,
se olisi D:n jakamisongelma ilman D:n "kerran ja oman päälle ei koskaan"
-sääntöjä.

## Muut toteutuksen havainnot

- **CSP ja oikeudet.** Pääoriginilla ei nyt ole `connect-src`- eikä
  `Permissions-Policy`-rajausta, joten A toimii ilman otsakemuutoksia. Jos
  pääoriginin CSP:tä joskus kiristetään, `wss://stt-rt.soniox.com` ja
  `wss://stt-rt.eu.soniox.com` (ja muut käyttöön otettavat alueet) on
  sallittava. Näkymäoriginin `microphone=()` pysyy. Mikrofoni vaatii
  suojatun kontekstin, ja gateway on TLS:n takana, joten tämä on kunnossa.
- **Puhelin.** SDK:n `MediaRecorder` käyttää selaimen oletusformaattia. iOS
  Safari tuottaa `audio/mp4`:ää, jota Sonioxin auto-listalla ei ole (siellä
  on `aac`, `webm` ja `ogg`). Tämä on testattava oikealla laitteella. Jos mp4
  ei kelpaa, vaihtoehto on raaka PCM AudioWorkletilla
  (`pcm_s16le`, 16 kHz). SDK:ssa on oma äänilähteen rajapinta tätä varten.
- **Rajat.** Omalla avaimella 10 samanaikaisen streamin oletusraja on henkilön
  oma. Daemonin reitille kannattaa silti pieni oma raja (esimerkiksi yksi
  avoin sanelu per sessio), jotta selainvirhe ei kuluta henkilön rahaa.
- **Virheet selaimelle** kiinteinä koodeina, kuten muuallakin: ei avainta,
  avain hylätty, raja täynnä, Soniox ei vastaa, mikrofoni estetty ja
  sanelu katkaistu aikakattoon.
- **Ei avainta -tila** ohjaa asetuksiin. Tämä on proto-speech-input-kierroksen
  aihe yhdessä painikkeen, välitulosten ja lopetuksen kanssa.

## Suositus

Toteutetaan **A**: henkilön oma Soniox-avain ja alue hänen
kotihakemistossaan (P2), daemonin luoma kertakäyttöinen 60 sekunnin
väliaikainen avain istuntokatolla ja suora striimi `@soniox/client`-SDK:lla.
Ehtona on, että Jari hyväksyy P1:n rajatun poikkeuksen. Sivuston yhteinen
avain (P3) jätetään erilliseksi päätökseksi, ja jos sitä tarvitaan, malli D
on AI-avaimen kaavan toisto ilman uutta gateway-valtuutta käytön osalta.
Ennen toteutusta tarkistetaan oikealla avaimella suomen sanelun laatu ja iOS
Safarin ääniformaatti.

proto-speech-input voi lähteä tästä: mikrofonipainike tai pidä-pohjassa,
vahvistettu teksti kenttään ja himmeä välitulos perään, lopetus, aikakatto,
ei avainta -tila asetuslinkillä, ja virhetilat yllä luetelluista koodeista.
Mukaan työpöytä ja puhelin.

## Lähteet

Sonioxin dokumentaatio (luettu 2026-10-26):

- [Temporary API keys](https://soniox.com/docs/guides/temporary-api-keys),
  [Create temporary API key](https://soniox.com/docs/api-reference/auth/create_temporary_api_key),
  [API key permissions](https://soniox.com/docs/guides/api-key-permissions)
- [Direct stream](https://soniox.com/docs/guides/direct-stream),
  [Proxy stream](https://soniox.com/docs/guides/proxy-stream),
  [WebSocket authentication](https://soniox.com/docs/guides/websocket-authentication)
- [WebSocket API](https://soniox.com/docs/api-reference/stt/websocket-api),
  [Real-time transcription](https://soniox.com/docs/stt/rt/real-time-transcription),
  [Manual finalization](https://soniox.com/docs/stt/rt/manual-finalization),
  [Limits & quotas](https://soniox.com/docs/stt/rt/limits-and-quotas),
  [Concurrency limits](https://soniox.com/docs/guides/concurrency-limits)
- [Supported languages](https://soniox.com/docs/stt/concepts/supported-languages),
  [Models](https://soniox.com/docs/stt/models)
- [Security and privacy](https://soniox.com/docs/security-and-privacy),
  [Data residency](https://soniox.com/docs/data-residency)
- [Web SDK](https://soniox.com/docs/sdk/web-SDK),
  [Web SDK real-time transcription](https://soniox.com/docs/sdk/web-SDK/stt/realtime-transcription),
  [npm @soniox/client](https://www.npmjs.com/package/@soniox/client)
- [Pricing](https://soniox.com/pricing), [Benchmarks](https://soniox.com/benchmarks),
  [Soniox vs Speechmatics, Finnish](https://soniox.com/compare/soniox-vs-speechmatics/finnish)
  (suomen luku hakutuloksen mukaan; vain toimittajan oma mittaus)
