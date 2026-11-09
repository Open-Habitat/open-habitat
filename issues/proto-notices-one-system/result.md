# Ilmoitukset yhdeksi järjestelmäksi

## Kierros 1: inventaario, ehdotus ja kolme suuntaa

Kierros: `design-system/prototypes/rounds/2026-11-09-ilmoitukset/`.
`NOTES.md` kertoo rakennuksen ja tarkistuksen. Kuvat ovat hakemistossa
`evidence/` (`r1-<suunta>-<tapaus>-<leveys>-<teema>`).

## 1. Inventaario

Inventaario on koottu koodista ja katalogeista (`web/src/text/*`, fi ja en
rinnakkain samassa tiedostossa). Ensin luetellaan keskustelunäkymä, sitten
koko sovellus luokittain. Ulkoasun nimet:

- *Varoitus* on yhteinen `WarningBanner`.
- *Laatikko* on `InlineNotice` (`ah-notice`): `--ah-s5`-täyte, lihavoitu otsikko ja eri sävyt kuin varoituksessa.
- *Paljas rivi* on `<p role="alert|status">` ilman omaa ulkoasua.
- *Harmaa rivi* on `ah-composer-notice` tai vastaava pieni teksti.

### Keskustelu ja viestikenttä

| Tilanne | Missä | Ulkoasu | Kesto | Sulku | Vakavuus | Koodi |
| --- | --- | --- | --- | --- | --- | --- |
| Ei tiedossa, saiko agentti viestin | kentän yllä | varoitus, neutraali, *Tarkista keskustelun tila* | kunnes historia näyttää viestin tai se todetaan toimittamattomaksi | ei | neutraali | `BrowserConversation` `send-uncertain` |
| sama viesti | aikajanalla | katkoviivakupla, tilasana *Toimitus epävarma* / *Odottaa agenttia* ja *?*-merkki | sama | ei | varoitus | `WaitingMessage` |
| sama, elävä lähetys | aikajanalla | katkoviivalaatikko *? Ei tiedossa, vastaanottiko agentti viestin…* ja *Kopioi teksti* | sama | ei | varoitus | `SendObservation` |
| Viesti torjuttu, koska kenttä ei voi lähettää (esim. *Odota vahvistettua joutotilaa; epävarmaa viestiä ei lähetetä uudelleen.*) | kentän alla | harmaa rivi *Viestiä ei lähetetty: …* | **6 s** | ei | – | `Composer` `notice` |
| Pidätetty viesti palautettu kenttään | kentän yllä | paljas rivi (`ah-held-notice`, ei tyyliä) | **6 s** | ei | – | `heldMessages`, `BrowserConversation` |
| Host torjui lähetyksen (tila muuttui, vain luku, jono) | kentän yllä | laatikko, varoitussävy, **koko lause lihavoituna otsikkona** | seuraavaan lähetykseen | ei | varoitus | `ConversationActions` `send-receipt` |
| Muu lähetysvirhe | kentän yllä | laatikko, punainen | seuraavaan lähetykseen | ei | virhe | `conversation-problem` |
| Miksi kenttä ei lähetä nyt | kentän alla | harmaa rivi (`ah-composer-reason`) | niin kauan kuin syy on | ei | – | `Composer` |
| Viesti odottaa agenttia | kentän alla | rivi kellokuvakkeella | kunnes lähtee | ei | – | `ah-composer-waiting` |
| Pysäytys käynnissä / epävarma / torjuttu | kentän alla | harmaa rivi, pyörijä | tilan ajan | ei | – | `Composer` |
| Liite torjuttu (koko, tyhjä, määrä, kiintiö, levy) ja tallennus katkesi | kentän yllä | **paljas punainen rivi** ja ×; katkos näkyy selaimen englanniksi *Failed to fetch* | kunnes liitteet muuttuvat tai × | × | virhe | `Composer` `attachment-refusal` |
| Liitteet yli viestin rajan | kentän yllä | varoitus, punainen, × | kunnes muuttuu tai × | × | virhe | `Composer` `attachment-overflow` |
| Historiaa ei saada | kentän yllä **ja** aikajanan alussa | varoitus, punainen + laatikko *Historiaa ei saada* tai *Historia on vanhentunut* | kunnes luku onnistuu | ei | virhe | `history-unavailable`, `ConversationTimeline` |
| Tila vanhentunut, tapahtumayhteys katkesi, tapahtumia jäi väliin, historian loppu katkesi | aikajanan lopussa | laatikko, varoitussävy | tilan ajan | ei | varoitus | `BrowserConversation` |
| AI-kirjautuminen vanhentunut | kentän yllä **ja** kellossa | varoitus, punainen + kello *Claude poikki* | kunnes kirjaudutaan | ei | virhe | `AISignIn` |
| Malli ei käytettävissä | kentän yllä | varoitus, punainen | tilan ajan | ei | virhe | `model-unavailable` |
| Keskustelu raskas, GitHub-yhteys, palvelimen kapasiteetti | kentän yllä | varoitus | tilan ajan | ei | eri | `ConversationWeight`, `GitHubConnectionNotice`, `CapacityRefusal` |
| Otsikkoa ei voitu luoda | kentän yllä | laatikko, punainen | seuraavaan yritykseen | ei | virhe | `title-error` |
| Kysymyksen toimitus vanhentunut/epävarma | aikajanan lopussa | rivi, joka **alkaa merkillä *?*** | tilan ajan | ei | – | `ah-native-question` |
| Worker odottaa sinua | taustatyön rivillä ja sivupalkissa | keltainen rengas ja *?* | tilan ajan | ei | – | `BackgroundStrip`, `Navigation` |
| Pyyntö workerille ei lähtenyt | taustatyön rivin alla | harmaa rivi | **6 s** | ei | – | `BackgroundStrip` `ah-bg-notice` |
| Prosessien määrä ei tiedossa | taustatyön sirussa | *?* luvun paikalla | tilan ajan | ei | – | `BackgroundStrip` |
| Agentin tila, laajennuksen ilmoitus | aikajanalla | laatikko, info / oma `AgentNotice` | pysyvä | ei | info | `UnpresentedEvents`, `AgentNotice` |
| Tallennustila täynnä | kellossa; keskustelu **piilottaa** omat tilarivinsä | kellon punainen merkki | tilan ajan | ei | virhe | `StoragePressure`, `statusItems` |

### Muualla sovelluksessa

| Tilanne | Missä | Ulkoasu | Kesto | Sulku |
| --- | --- | --- | --- | --- |
| Yhteys, kirjautuminen (gateway), uusi versio, vain luku | sivun yläreuna | oma `ConnectionBanner` (`ah-connection`, oma sävytys) | tilan ajan | ei |
| Arkistointi tehty / epäonnistui | keskustelulistassa | oma `ArchiveNotice` | **ajastettu** | × |
| Terminaalin tapahtumat (ikkuna suljettu, kopioitu) | ruudun alalaita | `ToastRegion` | **4 s** | ei |
| Selitystilan kuittaus | ruudun alalaita | oma toast | **3,2 s** | ei |
| Tilannekatsauksen virhe | kentän yllä | `RecapCard`in `ah-inline-error` | kunnes uusi pyyntö | × |
| Asetusten lomakevirheet | lomakkeen kohdalla | noin 30 paljasta `role="alert"`-riviä, kymmenkunta eri luokkaa (`ig-result bad`, `s-row`, `si-bad`, `ah-clone-problem` …) | seuraavaan yritykseen | ei |
| Arkisto, katalogi, uloskirjautuminen epävarma | sivuilla | laatikko (`App.tsx`, 13 kohtaa) | tilan ajan | ei |
| *Kopioitu* ja *Tallennettu* -kuittaukset | painikkeen kohdalla | painikkeen teksti | 1,2–6 s | ei |

### Pahimmat

- Yksi epävarma lähetys tuottaa neljä asiaa, jotka puhuvat ristiin: katkoviivakuplan *? Toimitus epävarma*, neutraalin varoituksen *Ei tiedossa, saiko agentti viestin* (joka väitti tekstin olevan kentässä, vaikka kenttä oli tyhjä), uuden viestin harmaan rivin kentän alla, joka katoaa kuudessa sekunnissa, ja *?*-sirun (Jarin kuvat `issues/large-send-stuck-uncertain/evidence/jari-2-dashed-bubble.avif` ja `jari-3-ping-refused.avif`; prototyypissä `r1-d0-nyt-kaikki-1440-light`, `r1-d0-nyt-epavarma-ping-1440-light`).
- Historiaa ei saada näkyy kahdesti eri sanoin ja eri ulkoasulla: punainen varoitus kentän yllä ja laatikko *Historia on vanhentunut* aikajanan alussa (`r1-d0-nyt-historia-1440-light`).
- Hostin torjunta on laatikko, jonka otsikko on kahden virkkeen lihavoitu kappale (`r1-d0-nyt-torjuttu-1440-light`).
- Liitteen torjunta ja katkennut tallennus ovat paljaita punaisia rivejä. Katkos näkyy englanniksi *Failed to fetch* (`r1-d0-nyt-tallennus-1440-light`).
- Täysi tallennustila näkyy vain kellossa, ja liitteen torjunta sanoo *Tarkista koko ja vapaa tila* (`r1-d0-nyt-tila-1440-light`).
- Kolme virheilmoitusta katoaa ajastimella (6 s), vaikka tilanne on yhä voimassa.

## 2. Ehdotus: yksi järjestelmä

**Lajit.** Lajeja on neljä, ja ne ovat yhteisen varoituksen neljä sävyä. Uutta ulkoasua ei tule.

- **Este** (`danger`): jokin, minkä teit, ei mennyt läpi, tai jokin, mihin luotat, on rikki, kunnes toimit. Esimerkkejä ovat torjuttu lähetys, liite ja kirjautuminen.
- **Tieto** (`neutral`): epävarma tai ei sinun korjattavissasi. Esimerkkejä ovat epävarma lähetys, historia, jota ei saada, ja worker, joka odottaa.
- **Käynnissä** (`progress`): host yrittää itse, eikä mitään pyydetä.
- **Korjautui** (`success`): vika poistui juuri.

Laatikko, `ConnectionBanner`, paljas rivi, harmaat hetken rivit ja
katkoviivalaatikko `SendObservation` korvataan varoituksella. Toast jää vain
kuittauksille (*Kopioitu*).

**Paikat.**

- **Koko tili tai palvelin** (yhteys, kirjautuminen, tila täynnä): aina kellossa. Kun asia estää työn juuri tässä näkymässä, se näkyy myös näkymässä. Missä kohtaa, riippuu suunnasta.
- **Tämä keskustelu** (viestin toimitus, historia, malli, worker): tätä suunnat vertailevat.
- **Tämä luonnos** (liite, torjuttu lähetys): heti kentän yllä.

Merkki asiassa itsessään jää: kuplan tilasana ja rivin rengas. Se on kuitenkin
yksi sana, ei toinen selitys. Katkoviiva jää vain viestille, joka odottaa,
että agentti käynnistyy.

**Kesto ja sulku.**

- Tila (epävarma lähetys, historia, kirjautuminen, tila täynnä) näkyy niin kauan kuin se on totta, eikä sitä voi sulkea. Toiminto korjaa tai tarkistaa, ja tarkistuksen tulos kerrotaan saman ilmoituksen tekstissä.
- Tapahtuma (torjuttu lähetys, liite) näkyy seuraavaan yritykseen asti tai kunnes se suljetaan ×:llä.
- Virhe ei katoa ajastimella. Itsestään poistuvat vain *Korjautui* ja kuittaukset.

**Yhdistäminen.**

- Yksi ilmoitus asiaa kohden: viesti, liitteet, kirjautuminen, tila, worker. Uusi tieto samasta asiasta lisätään olemassa olevaan ilmoitukseen.
- Seuraus yhdistyy syyhyn. Kun *ping* torjutaan, koska edellinen viesti on epävarma, siitä tulee lause epävarman viestin ilmoitukseen eikä omaa riviä kentän alle. Historia, jota ei saada, ja epävarma viesti ovat yksi ilmoitus; tuotannossa tämä on jo osittain niin.
- Vakavampi laji voittaa, ja vakavin on ensimmäisenä.
- Kentän alla ei toisteta syytä, jonka yllä oleva ilmoitus jo kertoo.
- Ilmoitus ei väitä mitään, mitä selain ei tiedä (esimerkiksi *teksti on kentässä*, kun kenttä on tyhjä).

## 3. Kierros: nykytila ja kolme suuntaa

Akseli: missä keskustelun ilmoitukset ovat. Lajit, sanat ja yhdistäminen
ovat kaikissa suunnissa samat. *Tapaus*-valinta käy läpi oikeat tapaukset
(lähetys epävarma, lähetys torjuttu, liite torjuttu, tallennus katkesi,
tallennustila täynnä, kirjautuminen vanhentunut, historiaa ei saada, worker
odottaa). Oletus on *Kaikki kerralla*.

0. **Nyt**: jokainen tilanne omalla tavallaan: punainen varoitus, paljas punainen rivi, harmaa rivi joka katoaa, laatikko aikajanalla, katkoviivakupla (`r1-d0-nyt-kaikki-1440-light`).
1. **A Kentän yllä**: kaikki tämän keskustelun ilmoitukset yhdessä pinossa viestikentän yllä, vakavin ensin, kaksi näkyvissä; koko tilin asiat palkkina ylhäällä (`r1-d1-kentan-ylla-kaikki-1440-light`).
2. **B Asian luona**: sama varoitus sen vieressä, mitä se koskee: viestin alla, liiterivillä, workerien rivillä; koko tilin asiat palkkina ylhäällä (`r1-d2-asian-luona-kaikki-1440-light`).
3. **C Yksi rivi**: viestikentän yllä yksi rivi, vakavin ensin ja montako muuta; Näytä avaa kaikki. Koko tilin asiat ovat kellossa (`r1-d3-yksi-rivi-kaikki-1440-light`).

Torjuttu *ping*: `r1-d0-nyt-epavarma-ping-1440-light` (harmaa rivi, joka
katoaa) ja suunnissa `r1-d1/d2/d3-…-epavarma-ping-1440-light` (lause samassa
ilmoituksessa).

### Liitteen torjunta tämän järjestelmän tapauksena

Kierroksen `proto-attachment-refusal` suunnat vastaavat tämän kierroksen
paikkoja. *Varoitus* on A:n ja B:n liiteilmoitus. *Rivi* on C:n yksirivinen
muoto. *Siru* ei sovi järjestelmään, koska siinä neuvo on painalluksen
takana eikä yhteisessä varoituksessa. Liitteen tekstit ovat sen kierroksen
Varoitus-suunnan tekstit. Jos tästä valitaan A tai B, liitteen torjunnan
vastaus on Varoitus. Puhelimen ×-painikkeen ja yksirivisen ilmoituksen
ohitus on sama kirjastoehdotus kuin siinä kierroksessa.

### Host-tiedot

Ei uutta hostin tietoa eikä rajapintaa. Yhdistäminen ja paikat ovat
selaimen esitystä nykyisestä tilasta: `sendUncertain`, `historyError`,
`auth_error`, tallennustilan luku, spinoffit ja liitteiden virhekoodit.

### Päätökset myöhempään katselmointiin

- **Ei keltaista varoituslajia.** Vaihtoehto: viides, keltainen laji. Valitsin neljä, koska yhteisessä varoituksessa (Jari 28.10.) on nämä neljä sävyä eikä tokeneissa ole keltaista varoitusväriä; viides väri olisi uusi päätös designiin.
- **Historia, jota ei saada, on Tieto eikä Este.** Vaihtoehto on punainen, kuten nyt. Valitsin Tiedon, koska mitään ei ole kadonnut eikä käyttäjä voi korjata asiaa itse; punainen kertoisi, että hänen pitää toimia.
- **Worker, joka odottaa, on Tieto-ilmoitus.** Vaihtoehto on pelkkä merkki taustatyön rivillä, kuten nyt. Valitsin ilmoituksen, koska issue nimeää tapauksen ja pelkkä rengas jää huomaamatta.
- **Kello pysyy kaikissa suunnissa koko tilin asioille.** Melkein täysi tila näkyy vain kellossa, koska se ei estä mitään vielä.
- **Asetusten lomakevirheet jäävät tämän kierroksen ulkopuolelle.** Ne ovat lomakkeen kenttävirheitä, eivät keskustelun ilmoituksia. Niiden yhtenäistäminen samaan varoitukseen on erillinen työ.
- **Prototyyppi on vain suomeksi.** Englanninkieliset tekstit kirjoitetaan katalogiin toteutuksessa.

### Suositus

**A Kentän yllä.** Se on ainoa suunta, jossa kaikki tämän keskustelun asiat
löytyvät aina samasta paikasta, ja paikka on se, jota katsot kirjoittaessasi.
B on selkeä yhden ilmoituksen tapauksissa. Kun ilmoituksia on monta, ne
hajoavat aikajanalle, rivin alle ja kentän yllä olevaan pinoon, ja viestin
alla oleva ilmoitus vierii näkyvistä. C piilottaa esteen syyn Näytä-painikkeen
taakse, mikä on vastoin sääntöä, että estetyn toiminnon syy näkyy. A:n
hinta on tila: kahden ilmoituksen pino vie kentän yltä puhelimessa ison
osan, minkä vuoksi näkyvissä on enintään kaksi.

### Kysymykset Jarille

1. Mikä suunta: A Kentän yllä (`r1-d1-kentan-ylla-kaikki-1440-light`), B Asian luona (`r1-d2-asian-luona-kaikki-1440-light`) vai C Yksi rivi (`r1-d3-yksi-rivi-kaikki-1440-light`)?
2. Kelpaavatko neljä lajia (Este, Tieto, Käynnissä, Korjautui)? Saako historia, jota ei saada, olla harmaa Tieto eikä punainen (`r1-d1-kentan-ylla-historia-1440-light`)?
3. Saako vanhentunut kirjautuminen olla kellon lisäksi sivun levyinen palkki ylhäällä (`r1-d1-kentan-ylla-kirjautuminen-1440-light`), vai riittääkö kello ja ilmoitus kentän yllä?
4. Onko worker, joka odottaa sinua, ilmoituksen arvoinen (`r1-d1-kentan-ylla-worker-1440-light`), vai riittääkö rengas taustatyön rivillä?
5. Onko kaksi näkyvää ilmoitusta ja *Näytä 1 muu ilmoitus* oikea raja (`r1-d1-kentan-ylla-kaikki-auki-1440-light`)?
