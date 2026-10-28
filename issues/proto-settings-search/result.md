# Tulos: haku asetuksissa (kierros 1)

Prototyyppi on `prototypes/settings-search/index.html`, yksi offline-HTML.
Se on käsin kirjoitettu sivu
(`design-system/prototypes/rounds/2026-10-28-asetusten-haku/page.html`).
`build.mjs` lisää siihen tokenit, upotetut fontit ja yhteisen valitsimen
(`lib/picker.*`). Tuotantokomponenttien bundlea ei käytetä, koska se jää
Habitatin näkymissä tyhjäksi. Jarin opas on
`prototypes/settings-search/NOTES.md`. Kuvat ovat `evidence/`-hakemistossa
AVIF-muodossa (laitteen skaalaus 2, muunnos ffmpeg:llä, 36 kuvaa).

`verify.mjs` tarkistaa jokaisessa suunnassa seuraavat haut:

- synonyymi (*tumma* → Teema)
- palvelun sisältö (*gmail* → Google)
- yhdyssana (*malli* → Oletusmalli)
- ääkkösten taitto (*aani* → Sanelu)
- tuleva osio (*recap* → Tilannekatsaus)
- kiintiö (*kiintiö* → Käyttö)
- ei osumia (*lomake*)

Lisäksi se tarkistaa nämä:

- suunnan 1 nuolet, esikatselun ja Enterin
- suunnan 2 säätimen tuloksissa ja osion avaamisen
- suunnan 3 ehdotukset, Enterin, uudelleen avaamisen ja Escin
- Escin kaksi vaihetta (tyhjennys, sitten sulkeminen) sekä X:n ja
  asetusten avaamisen uudelleen
- ylläpitäjän ja henkilön erot sekä puhelimen tulokset ja paluun

Konsolivirheitä ja verkkopyyntöjä ei ollut, ja valitsin läpäisee
`picker-check`in. Labia ei ajettu. Nykytila on luettu koodista.

## Haettava sisältö

Osiot ja rivit on luettu tiedostosta `web/src/components/Account.tsx`
(`sections` ja `adminSections`, rivit 357–376) ja sen renderöimistä
komponenteista:

- `DefaultModelRow.tsx`
- `ClaudeSignIn.tsx`
- `PiCredentials.tsx`
- `GitIdentity.tsx`
- `Devices.tsx` ja `DeviceLink.tsx`
- `SpeechSettings.tsx`
- `CodeHostSettings.tsx`
- `IntegrationsSettings.tsx` (palvelut daemonin `internal/daemon/integrations/`-paketista)
- `components/EditorSettings.tsx`
- `PersonalStorage.tsx`
- `ServerAdministration.tsx`
- `OnboardingSettings.tsx`
- `SiteKeySettings.tsx`

Omia osioita on 9 ja tuleva Tilannekatsaus, ylläpitäjän osioita 7. Rivejä
on noin 40. Tilannekatsaus on omana osionaan Tekoälyn jälkeen, koska Jari
päätti 28.10. oman osion (`proto-recap-settings`). Sen rivit ovat milloin
katsaus tehdään, viive, pituus tokeneina, luettavien viestien määrä ja
malli. Kuvaukset ovat tuotannon tekstejä, jos komponentissa on kiinteä
teksti. Muuten ne ovat lyhyitä synteettisiä kuvauksia. Tiliosoitteet ja
laitteet ovat synteettisiä.

## Akseli: missä osumat näytetään

Kaikissa suunnissa kentän paikka ja haun osumat ovat samat. Myös rivin
merkintä valinnan jälkeen ja Escin kaksi vaihetta ovat samat. Suunnat
eroavat vain siinä, mihin tulokset tulevat ja miten niihin siirrytään.

| # | Suunta | Mitä se päättää | Milloin oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | **Sivupalkissa** | Kirjoittaessa sivupalkin osioluettelo vaihtuu tuloslistaksi, jossa on nimi, polku ja syy. Ensimmäinen tulos avautuu oikealle heti, ja nuolet vaihtavat avattua tulosta. Puhelimessa tulokset korvaavat luettelon, ja osuman sivulla on *← Hakutulokset*. | Kun haku on suunnistusta: henkilö etsii yhtä asetusta ja haluaa nähdä sen omassa osiossaan. Toimii kuten macOS, josta Jari otti mallin. | Sivupalkki on 190 px, joten pitkät nimet ja kuvauskatkelmat rivittyvät. Haulla *avain* 9 tulosta täyttää palkin. Osioluettelo katoaa haun ajaksi. |
| 2 | **Tulossivu** | Sivupalkki pysyy, mutta osioissa näkyy osumamäärä ja muut himmenevät. Oikea puoli on *Hakutulokset*: osuvat rivit oikeine säätimineen osioittain ja jokaisessa *Avaa osio ›*. Osion nimi hakusanana näyttää koko osion. | Kun henkilö haluaa säätää suoraan eikä vain löytää, esimerkiksi *tumma* → vaihda. Antaa myös parhaan yleiskuvan, kun samaa sanaa on monessa osiossa. | Tuotannon rivit ovat syvällä omissa komponenteissaan, ja jokainen lataa omat tietonsa. Rivit pitää saada piirtymään osionsa ulkopuolella, joten toteutus on suunnista suurin (ks. host-tiedot). Rivi irrallaan osionsa johdannosta voi jäädä epäselväksi. |
| 3 | **Pikahaku** | Sivu ei muutu kirjoitettaessa. Kentän alle aukeaa lista ryhmiin *Osiot* ja *Asetukset*. Tyhjällä kentällä listassa on ehdotuksia. Enter tai napautus sulkee listan ja vie riville. Puhelimessa haku vie koko näytön, ja siinä on *Peruuta*. | Kun asetuksia haetaan näppäimistöltä ja nopeasti, kuten komentopaletista. Leveä lista näyttää pitkät polut ja syyt yhdellä rivillä. | Lista peittää osion, jota katsoit, eikä tuloksia ja osiota näe yhtä aikaa. Ehdotukset ovat kiinteitä, koska tuotannossa ei ole hakuhistoriaa. Puhelimessa suunta lähenee suuntaa 1 (lista, napautus, rivi). |
| – | **Nykyinen** | Ei hakua. Asetukset ja X ovat kuten `settings-close-returns` niistä tekee. | – | – |

## Host-tiedot

| Tieto | On nyt? | Missä / mitä puuttuu |
|---|---|---|
| Osioluettelo ja reitit | **On** | `sections` ja `adminSections`, `Account.tsx:357–376`. Polut `internal/uiroutes/settings.json` (gatewayn sallittujen polkujen lista). |
| Hyppy riville ja merkintä | **On** | `settingsHref(section, row)` (`web/src/app/settingsRoute.ts:21`) vie fragmenttiin. `Account.tsx:337–356` etsii `[data-settings-row]`-rivin enintään 5 s (rivit, joiden tiedot tulevat daemonilta, ilmestyvät myöhemmin). Rivi vieritetään keskelle, kohdistetaan ja merkitään `data-landed`. Merkintä on `Settings.css:509`, 2,4 s, ja vähennetyn liikkeen tilassa pysyvä reunaviiva. Fragmentti ei mene palvelimelle, joten gatewayn polkulista ei muutu. Kaikki suunnat käyttävät tätä. |
| Rivitunnisteet | **Osittain** | `SettingsRow`-tyypissä on 7 riviä (`default-model`, `chatgpt`, `claude`, `api-keys`, `github`, `gitea`, `workspaces`). Muilta riveiltä puuttuu `data-settings-row`. Haku tarvitsee tunnisteen jokaiselle haettavalle riville, noin 35 uutta. |
| Hakuindeksi (nimi, polku, synonyymit, kuvaus) | **Ei ole** | Selaimessa ei ole luetteloa asetusriveistä. Rivien nimet ovat JSX:ssä 15 komponentissa. Tarvitaan yksi staattinen taulukko (osio, rivi, ryhmä, nimi, synonyymit, ylläpito), esimerkiksi `web/src/app/settingsIndex.ts`. Testi tarkistaa, että jokaisella taulukon rivillä on vastine sivulla. Tämä ei ole uusi totuuden lähde asetusten arvoista, vain niiden nimistä. Daemonia tai sopimusta ei tarvita. |
| Ylläpitäjä vai henkilö | **On** | `serverInfo()` → `administrator` (`web/src/app/serverAdministration.ts:25`, käyttö `Account.tsx:310–323`). Ylläpitorivit suodatetaan indeksistä samalla tiedolla. Ylläpitosivut tarkistavat oikeuden palvelimella joka tapauksessa. |
| Hakukentän komponentti ja ulkoasu | **On** | `SearchField` (`Primitives.tsx:265`) ilmoittaa tulosmäärän `role="status"`-elementissä ja tarjoaa Tyhjennä-painikkeen. Työtilapalkin suodatin (`Navigation.tsx:888`, `.ah-rail-search` `components.css:240`) on sama kapea kenttä sivupalkin yläreunassa. Prototyyppi käyttää sen mittoja. |
| Esc ja X | **Tulossa** | `settings-close-returns`. Haku lisää ensimmäisen vaiheen: Esc tyhjentää ensin haun ja vasta sitten sulkee. Toteutuksen pitää sopia tästä järjestyksestä. |
| Säätö tulossivulla (suunta 2) | **Ei ole** | Rivit on kirjoitettu osiokomponenttien sisään (`PiCredentials`, `CodeHostSettings`, `IntegrationsSettings`, …), ja ne lataavat tietonsa itse. Tulossivu vaatii joko rivien irrottamisen omiksi komponenteikseen tai kaikkien osioiden piirtämisen samalle sivulle niin, että osumattomat rivit piilotetaan. Kumpikin on laaja muutos. |
| Hakuhistoria ehdotuksiin (suunta 3) | **Ei ole** | Ehdotukset ovat prototyypissä kiinteitä. Oikea historia olisi uusi selaimen tallenne, eikä sille ole tarvetta näytetty. |
| Valtuudet | Ei muutosta | Haku toimii kokonaan selaimessa staattisen taulukon päällä. Gateway, daemon ja provision eivät osallistu. |

## Mitä host-tietoja kukin suunta tarvitsee

| Tieto | On nyt? | 1 | 2 | 3 |
|---|---|---|---|---|
| `settingsHref` + `data-landed` | **On** | käytetään | *Avaa osio* | käytetään |
| `data-settings-row` jokaiselle riville | **Osittain** | tarvitaan | tarvitaan | tarvitaan |
| Staattinen hakuindeksi | **Ei ole** | tarvitaan | tarvitaan | tarvitaan |
| `administrator` | **On** | suodatus | suodatus | suodatus |
| Rivit piirrettävissä osionsa ulkopuolella | **Ei ole** | – | tarvitaan | – |
| Korostus osion riveissä haun aikana | **Ei ole** (pelkkä CSS + indeksi) | tarvitaan | – | tarvitaan |

## Suositus

**Suunta 1, Sivupalkissa.** Jari pyysi macOS:n mallia, ja tämä on se:

- kenttä palkin yläreunassa
- tulokset polkuineen palkissa
- osuma auki vieressä ja korostettuna

Suunta käyttää tuotannon hyppyä ja merkintää sellaisinaan. Sen ainoa uusi
osa on staattinen hakuindeksi ja puuttuvat rivitunnisteet. Nuolilla
liikkuva esikatselu näyttää asetuksen omassa yhteydessään, joten
kuvaukset ja osion johdanto pysyvät mukana. Puhelimessa *← Hakutulokset*
tekee usean osuman läpikäynnin helpoksi.

Suunta 2 on houkutteleva *tumma*-tyyppisiin hakuihin, mutta se on
toteutukseltaan moninkertainen. Se vaatisi asetusrivien irrottamisen
osioistaan, eikä nykyisellä noin 40 rivillä ole tarvetta näyttää monta
osiota kerralla. Suunnan 3 hyödyt (näppäimistö, leveä lista) saadaan
suuntaan 1 näppäimellä `/`, nuolilla ja Enterillä, ilman listaa, joka
peittää asetukset.

Toteutus yhtenä issuena:

1. `web/src/app/settingsIndex.ts`: osio, rivi, ryhmä, nimi, synonyymit ja
   ylläpito. Jokaiselle riville `data-settings-row` ja `SettingsRow`-tyyppiin
   tunnisteet. Testi tarkistaa, että indeksin jokainen rivi löytyy sivulta ja
   jokainen sivun rivi indeksistä.
2. `SearchField` sivupalkin yläreunaan sekä tuloslista ja esikatselu
   `routeRow`-hypyllä. Hakusanan pitää kulkea sivulle, jotta osuvat rivit
   saavat haun ajaksi `data-hit`-merkinnän.
3. Escin kaksi vaihetta yhdessä `settings-close-returns`-työn kanssa.

## Päätökset myöhempää tarkistusta varten

- **Haku kattaa vain asetusten nimet, ei henkilön tietoja.** Vaihtoehto:
  myös tiliosoitteet, laitteet, avainten päätteet ja työtilojen nimet.
  Valinnan syy: ne latautuvat osioittain eri lähteistä (daemon, gateway).
  Niiden haku vaatisi kaikkien osioiden lataamisen haun alussa. Lisäksi
  *gmail* löytyy jo synonyyminä Googlesta.
- **Taivutusta ei käsitellä. Ääkköset taitetaan, neljän kirjaimen sanat
  löytyvät myös yhdyssanan sisältä, ja synonyymit kattavat loput.**
  Vaihtoehto: suomen kielen stemmeri (esimerkiksi *avaimet* → *avain*).
  Valinnan syy: noin 40 rivin taulukossa käsin kirjoitetut synonyymit
  ovat tarkempia ja kevyempiä. *ä = a* auttaa englanninkielisellä
  näppäimistöllä, mutta *tila* löytää silloin myös *tilaus*-rivit. Sitä
  pidettiin hyväksyttävänä.
- **Synonyymit ovat suomeksi ja englanniksi** (*dark mode*, *api key*,
  *logout*). Vaihtoehto: vain suomi. Valinnan syy: tekninen käyttäjä hakee
  usein englanninkielisellä termillä, jota hän on tottunut käyttämään muualla.
- **Omat asetukset ennen palvelimen asetuksia samanarvoisella osumalla.**
  Vaihtoehto: pelkkä osuman laatu. Valinnan syy: ylläpitäjä on myös
  henkilö, ja tavallisesti hän hakee omaa asetustaan.
- **Esc tyhjentää ensin haun ja sulkee asetukset vasta tyhjänä.**
  Vaihtoehto: Esc sulkee aina. Valinnan syy: haun aikana painettu Esc
  tarkoittaa lähes aina haun lopettamista. Kahden vaiheen tapa on tuttu
  macOS:stä ja selainten hakukentistä.
- **Pikanäppäin on `/`, ei ⌘F tai ⌘K.** Vaihtoehto: ⌘K. Valinnan syy:
  ⌘F on selaimen sivuhaku, eikä Habitatissa ole vielä ⌘K-palettia, jonka
  kanssa tämä olisi yhdenmukainen.
- **Tilannekatsaus omana osionaan Tekoälyn jälkeen**, Jarin 28.10.
  päätöksen mukaisesti. Rivien nimet ovat tämän kierroksen arvauksia
  ja tarkentuvat `proto-recap-settings`-riffissä.
- **Takaisin-painike on poistettu, ja X on nurkassa.** Vaihtoehto: kumpikin.
  Valinnan syy: `settings-close-returns` tekee X:stä paluun, joten
  Takaisin-rivi sivupalkin yläreunassa olisi kaksoispainike, ja kenttä
  saa sen paikan.

## Kysymykset Jarille

- Mikä suunnista? Suositus on 1.
- Riittääkö haku asetusten nimiin, vai pitääkö löytyä myös omat tiedot
  (tiliosoite, laitteen nimi, työtila)?
