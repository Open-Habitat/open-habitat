# Verkkohaun avain: palvelimen yhteinen avain ja henkilön rivi

## Kierros 3: haku muiden palvelujen joukossa

Kierros: `design-system/prototypes/rounds/2026-11-23-hakuavain-3/`
(`NOTES.md` kertoo sivun rakenteen ja tarkistuksen). Rakennettu tiedosto:
`design-system/prototypes/dist/hakuavain-3/offline.html`. Lähtökohta on
Jarin päätös 23.11.: B eli ylläpitäjällä palvelimen *Integraatiot* ja
henkilöllä *Asetukset › Tiedot agenteille*. Kierroksen 2 hakuavainlohko oli
näillä sivuilla paljon suurempi kuin naapurinsa.

Tällä kertaa näytetään molemmat sivut kokonaan, kuten tuotanto ne piirtää,
ja naapurit ovat realistiset. Ylläpitäjällä Google, Apple, IMAP, CalDAV,
CardDAV ja Dropbox ovat tarjolla, ja Microsoft odottaa sovelluksiaan.
Henkilöllä sähköposti, Dropbox ja Trello on yhdistetty, ja Google ja
Microsoft ovat lisättävinä. *Näkymä*, *Tilanne*, *Teema*, *Liike* ja *Kieli*
ovat samat kuin kierroksella 2, ja samoin tilanteet: ylläpitäjällä kaksi ja
henkilöllä kuusi.

Akseli: **miten haku asettuu muiden palvelujen joukkoon.** Kaikissa
suunnissa haku on samassa kohdassa kuin uusi palvelu olisi: ylläpitäjällä
palvelutaulukon lopussa, henkilöllä yhdistettyjen tilien perässä, tai
lisättävien ruuduissa, jos avainta ei ole.

0. **Nyt**: Integraatiot ja Tiedot agenteille tänään, verkkohausta ei mitään.
1. **A Palvelu kerrallaan** (Jarin ehdotus): Brave ja Staan ovat kumpikin oma
   rivinsä kuten Google ja Dropbox, ja niissä on sama kirjainmerkki ja samat
   sanat (*Tarjolla*, *Ei tarjolla*, *Ei käytössä*). Ylläpitäjä antaa
   avaimen *Aseta avain…* -ikkunassa. Kun avain on annettu, rivillä on
   *Avain*-valikko (*Vaihda avain…*, *Poista avain*) kuten *Tunnukset*
   muilla. Henkilöllä avaimen palvelusta tulee yhdistetty kortti (*Brave ·
   Ylläpitäjän avain …k7q2*, palvelurivinä *Verkkohaku*), ja toinen palvelu
   on lisättävien ruuduissa.
2. **B Yksi Verkkohaku-rivi**: haku on yksi palvelu muiden joukossa
   (maapallomerkki, *Verkkohaku*). Rivi avaa ikkunan, jossa valitaan Brave
   tai Staan ja annetaan avain. Henkilöllä on yksi kortti tai yksi ruutu.
3. **C Tiivis rivi paikallaan**: sama yksi rivi samassa kohdassa kuin B,
   mutta ikkunaa ei ole, vaan lomake avautuu rivin alle kuten kierroksella 2.
   Henkilöllä tiivis kortti on aina yhdistettyjen tilien ensimmäisenä.

**Suositus: A Palvelu kerrallaan.** Sivun muut rivit ovat nimettyjä
palveluita, joilla on merkki, tila ja yksi painike. A on ainoa suunta, jossa
haku näyttää täsmälleen samalta: ylläpitäjä tunnistaa *Aseta avain…*
-ikkunan *Aseta tunnukset…* -ikkunan sisareksi, ja *Avain*-valikko toimii
kuten *Tunnukset*. Henkilöllä Brave on samanlainen yhdistetty palvelu kuin
Dropbox, ja palvelurivi kertoo, mitkä mallit käyttävät sitä. Lisäksi A on
yksinkertaisin alussa. Staan pysyy piilossa, kunnes sen kattavuus on
tarkistettu, joten aluksi näkyy vain yksi Brave-rivi, eikä lomakkeessa ole
valintaa. Kun Staan tulee, se tulee uutena rivinä, kuten mikä tahansa
palvelu.

Muiden suuntien heikkoudet:

- B on siisti, mutta *Verkkohaku* on kyky eikä palvelu, toisin kuin
  naapurinsa. Palvelun valinta jää ikkunan sisälle, joten taulukosta ei näe,
  mitä palvelua käytetään, ellei sitä lue tarkennusriviltä.
- C on pienin muutos kierrokseen 2, mutta tyhjässä tilassa lomake on auki
  taulukon sisällä ja kortissa. Juuri sen uusi asennus näkee ensimmäisenä,
  ja silloin suhteet hajoavat taas.

Kuvia ei ole tallennettu issueen, kuten ei kierroksillakaan 1 ja 2.
`check.mjs` kirjoittaa ne (`r3-<n>-<suunta>-<näkymä>-<tapaus>-<leveys>-<teema>`)
annettuun hakemistoon: kaikki tilanteet kaikissa suunnissa 1440 vaaleana ja
koko sivuna, yksi tilanne kummastakin näkymästä 1440 tummana sekä 390
vaaleana ja tummana (vaalea myös koko sivuna), kulut, avainvalikko ja
englanti. Tarkistus: 382 tarkistusta, konsoli puhdas.

### Mikä kierroksesta 2 säilyy ja mikä muuttuu

Säilyy kaikissa: saneluavaimen logiikka, koehaku tallennettaessa (torjuttua
ei tallenneta), kopiot lukumäärinä ja samoin sanoin, uusi avain korvaa
aiemmat kopiot mutta ei omaa avainta, poisto ei peru kopioita, oma avain
voittaa, eikä henkilölle kerrota yhteisestä avaimesta. Samoin säilyvät
nimetyt poikkeamat: palvelun valinta, tieto siitä, mitkä mallit avainta
käyttävät, ja myöhempi torjunta.

Muotojen pakottamat muutokset:

- **A ja B: lomake ei ole auki, kun avainta ei ole.** Ikkuna aukeaa vain
  painamalla. Tilalla ylläpitäjän rivi sanoo *Ei tarjolla*, ja henkilön
  ruutu sanoo punaisella *DeepSeek-mallit eivät hae verkosta ilman avainta*
  ja *Lisää avain…* on ensisijainen painike. C pitää kierroksen 2
  käytöksen.
- **A: yksi hakupalvelu kerrallaan näkyy kahtena rivinä.** Toisen palvelun
  rivi sanoo *Käytössä on Brave. Avain tähän korvaisi sen.*, ja sen
  ikkunassa lukee, että tallennus korvaa yhteisen Brave-avaimen ja sen
  kopiot samoin kuin avainta vaihdettaessa. Henkilöllä vastaavasti
  *Korvaisi Brave-avaimesi*. Poikkeama 1 eli palvelun valinta siirtyy
  lomakkeesta riville.
- **Kaikki: kopioiden saajat ovat rivin tarkennusrivillä** (*4 sai avaimen,
  1 käyttää omaa avaintaan.*), ja poiston jälkeen siinä lukee *Jo annetut
  kopiot jäivät ennalleen*. A:n ja B:n valikon otsikossa on avain ja
  päiväys, kuten *Tunnukset*-valikossa kerrotaan, kuka tunnukset asetti.
  *Käyttö ja säilytys* on ikkunassa (C:ssä lomakkeen alla).
- **Kaikki: myöhempi torjunta** on henkilön kortissa samalla tavalla kuin
  muiden palvelujen ongelmat: huomautusrivi, palvelurivillä *Ei vastaa* ja
  *Vaihda avain* ensisijaisena.

### Host-tiedot

Ei muutoksia kierrokseen 2. A:n rivit ja ruudut syntyvät samasta luvusta
(`backend`, loppuosa, `set_at`, `given`) ja poikkeaman 2 luettelosta, joka
kertoo, mitkä mallit hakevat itse.

### Päätökset myöhempää arviota varten

- **Haku on palvelujen lopussa**, ei ylimpänä: ylläpitäjällä taulukon
  viimeisenä, henkilöllä yhdistettyjen tilien perässä tai lisättävien
  ruuduissa, kuten uusi palvelu olisi. C:ssä tiivis kortti on yhdistettyjen
  ensimmäisenä, koska se näkyy aina.
- **Henkilön avain näkyy yhdistettynä korttina *Yhdistetyt tilit*
  -otsikon alla** ja ruutuna *Lisää tili* -otsikon alla, vaikka avain ei ole
  tili. Otsikot ovat tuotannon, eikä niitä muuteta tällä kierroksella.
- **Henkilön palvelurivillä lukee *Käytössä*, ei *Toimii***, koska avainta
  ei kokeilla sivua avattaessa. *Toimii* väittäisi enemmän kuin tiedetään.
- **Henkilön *Poista* ei kysy vahvistusta**, kuten saneluavaimessa, vaikka
  naapureiden *Poista…* avaa vahvistuksen. Ero on tahallinen: avaimen poisto
  ei peru mitään palvelussa.
- **Valikon sanat ovat *Avain*, *Vaihda avain…* ja *Poista avain***, kuten
  *Tunnukset*, *Vaihda tunnukset…* ja *Poista tunnukset…*. *Poista avain*
  on ilman kolmea pistettä, koska se ei avaa vahvistusta.
- **Staan näkyy prototyypissä**, jotta A:n kaksi riviä tulevat arvioiduiksi.
  Toteutus piilottaa sen, kunnes kattavuus on tarkistettu, eli A:ssa näkyy
  silloin vain Brave.
- **Kierros ei lisää rivejä asetusten hakuun.** Toteutus lisää A:ssa
  `server-brave`- ja `server-staan`-rivit (kuten `server-google`) ja
  henkilölle `web-search`-rivin.

### Kysymys Jarille

1. Kelpaako A? Jos kelpaa: riittääkö, että toisen palvelun avain korvaa
   käytössä olevan (yksi palvelu kerrallaan, kuten nyt), vai pitäisikö
   molempien avainten saada olla voimassa yhtä aikaa? Jälkimmäinen on
   host-muutos: kaksi avainta, ja hakulaajennus valitsee niistä.

## Kierros 2: hakuavain toimii kuin saneluavain

Kierros: `design-system/prototypes/rounds/2026-11-23-hakuavain-2/`
(`NOTES.md` kertoo sivun rakenteen ja tarkistuksen). Lähtökohta on Jarin
päätös 23.11.: hakuavain on ensi sijassa palvelimen asetus, ja se toimii
kuten Soniox-avain. Kierroksen 1 kolme Tekoäly-suuntaa eivät ole tässä
mukana.

Sivu on tuotannon asetussivu muuttamattomana. Yläpalkin *Näkymä* vaihtaa
ylläpitäjän ja henkilön välillä, ja jokainen suunta avautuu ylläpitäjän
näkymään. *Tilanne* vaihtaa tilannetta:

- ylläpitäjällä: ei yhteistä avainta, tai yhteinen Brave-avain, joka on jo
  annettu liittyneille;
- henkilöllä: ylläpitäjän avain käytössä, oma Brave-avain, oma Staan-avain
  ja ylläpitäjän avain (oma voittaa), ei avainta ja DeepSeek ei hae itse,
  ei avainta ja ChatGPT ja Claude hakevat itse, Brave torjui oman avaimen.

*Teema*, *Liike* ja *Kieli* vaihtavat vaalean ja tumman, vähennetyn liikkeen
sekä suomen ja englannin. Kaikki kulut toimivat painamalla: tallennus
torjutulla ja kelpaavalla avaimella, Brave- ja Staan-valinta, vaihto ja
poisto.

Akseli: **mihin perheeseen hakuavain kuuluu**, eli missä se on
ylläpitäjällä ja henkilöllä. Avaimen rivit ovat kaikissa suunnissa samat,
saneluavaimen rivien kopiot. Sivun yläreunassa on jokaisesta suunnasta yksi
rivi.

0. **Nyt**: saneluavain tänään. Ylläpitäjällä on *Saneluavain*-sivu ja
   henkilöllä *Asetukset › Sanelu*. Verkkohausta ei ole mitään.
1. **A Oma osio** (kuten sanelu): ylläpitäjä saa oman *Hakuavain*-sivun
   *Saneluavaimen* viereen, ja henkilö oman *Verkkohaku*-osion *Sanelun*
   viereen. Saneluavaimen kirjaimellinen kopio.
2. **B Tiedot agenteille** (kuten integraatio): ylläpitäjä antaa avaimen
   palvelimen *Integraatiot*-sivun ylimmässä kortissa (*Verkkohaku*).
   Henkilön rivi on *Asetukset › Tiedot agenteille* -sivulla sivun johdannon
   jälkeen, ennen tilejä.
3. **C Tekoäly** (tekoälyn osana): ylläpitäjän avain on *AI-avain*-sivulla
   yhteisen AI-avaimen ja liittyneiden luettelon alla. Henkilön rivi on
   *Asetukset › Tekoäly* -sivulla API-avainten alla.

**Suositus: B Tiedot agenteille.** Verkkohaku antaa agentille tietoa
samalla tavalla kuin sähköposti tai Drive, ja *Tiedot agenteille* on se
sivu, jolta henkilö etsii agenttiensa tietolähteitä. Ylläpitäjän puolella
on sama pari jo valmiina: palvelimen *Integraatiot* kertoo, mitä on
tarjolla, ja henkilö ottaa sen käyttöön *Tiedot agenteille* -sivulla.
Hakuavain sopii tähän pariin ilman uutta käsitettä. Lisäksi molemmat rivit
näkyvät heti sivulle tultaessa, ja asetusten sivupalkkiin ei tule uutta
kohtaa.

Muiden suuntien heikkoudet:

- A on mekaanisesti uskollisin, mutta se lisää kumpaankin sivupalkkiin
  kohdan, jossa on yksi rivi. Henkilön sivupalkissa on jo 15 kohtaa.
  Saneluavaimella on oma osio, koska sanelu on oma ominaisuutensa
  viestikentässä. Verkkohaku taas on agentin kyky, jota henkilö ei käytä
  suoraan.
- C:ssä ylläpitäjän rivi jää pitkän AI-avain-sivun alle, liittyneiden
  luettelon jälkeen. Sivulle tultaessa se näkyy vain siksi, että prototyyppi
  vierittää sen esiin. Tekoäly-sivulla hakuavain näyttää malliavaimelta,
  vaikka se ei ole sellainen. Siksi kierroksen 1 suunnat eivät kelvanneet.

Kuvia ei ole tallennettu issueen, kuten kierroksellakaan 1, koska puussa ei
ole sen kuvia. `check.mjs` kirjoittaa kuvat
(`r2-<n>-<suunta>-<näkymä>-<tapaus>-<leveys>-<teema>`) annettuun
hakemistoon: kaikki tilanteet kaikissa suunnissa 1440 vaaleana, yksi
tilanne kummastakin näkymästä 1440 tummana ja 390 vaaleana ja tummana,
kulut sekä englanti.

### Miten tämä vastaa saneluavainta

Sama kuin saneluavaimessa, sekä ylläpitäjän että henkilön puolella:

- **Ylläpitäjän rivi** on `SpeechKeyAdministration`: johdanto (*Kaikki,
  joilla ei ole omaa hakuavainta, hakevat verkosta tällä. Käyttö
  laskutetaan sinulta.*), *Yhteinen hakuavain*, palvelu ja loppuosa,
  käyttöönottopäivä, *Vaihda avain* ja *Poista* sekä lomake auki, kun
  avainta ei ole.
- **Tallennus kokeilee avaimen** ylläpitäjän omalla daemonilla ennen kuin
  gateway tallentaa sen, ja torjuttua avainta ei tallenneta. Tallennuksen
  aikana lukee *Kokeillaan avainta ja annetaan sitä jo liittyneille…*.
- **Kopion saaneet** näkyvät samoilla sanoilla ja lukumäärinä: *4 sai
  avaimen, 1 käyttää omaa avaintaan, 1 ei tavoitettu. Tavoittamattomat
  saavat avaimen, kun tallennat sen uudelleen.* Uusi avain korvaa aiemmat
  kopiot (*sai uuden avaimen aiemman tilalle*), mutta ei koskaan henkilön
  omaa avainta.
- **Poisto ei peru kopioita.** Rivillä lukee *Jo annetut kopiot jäivät
  ennalleen*, ja *Käyttö ja säilytys* kertoo, että kopion voi perua vain
  vaihtamalla avaimen hakupalvelun sivulla.
- **Henkilön rivi** on `SpeechSettings`: *Ylläpitäjän avain Brave …k7q2.* /
  *Oma avain Brave …a1b2.* / *Ei avainta…*, *Lisää oma avain* ylläpitäjän
  avaimen päällä, muuten *Vaihda avain*, ja *Poista* ilman vahvistusta.
- **Oma avain voittaa, eikä henkilölle kerrota yhteisestä avaimesta.**
  Tilanteessa *molemmat* rivi näyttää vain oman avaimen. Ylläpitäjä näkee
  henkilön kohdassa *käyttää omaa avaintaan*.
- **Oman avaimen poisto jättää tyhjän.** Ylläpitäjän avain tulee vasta
  ylläpitäjän seuraavalla tallennuksella, aivan kuten sanelussa.

Poikkeamat, joihin on syy:

1. **Hakupalvelu valitaan (Brave tai Staan).** Saneluavaimessa aluetta ei
   kysytä, koska tallennus kokeilee avainta kummallakin alueella. Hakuavainta
   ei voi kokeilla kummassakin palvelussa, koska Braven avain lähtisi silloin
   Staanille ja päinvastoin, eli taholle, jolle sitä ei annettu. Valinta on
   lomakkeen yläosassa ja vaihdettaessa valmiiksi tallennetun avaimen
   palvelu.
2. **Rivi kertoo, mitkä mallit avainta käyttävät** (*DeepSeek-mallit hakevat
   tällä avaimella. ChatGPT hakee itse.*). Lisäksi lomake on kiinni ja
   tilalla on *Lisää avain*, kun kaikki henkilön mallit hakevat itse.
   Saneluavainta tarvitsee jokainen sanelu, mutta hakuavainta vain mallit,
   joilla omaa hakua ei ole. Lomake auki ilman tarvetta näyttäisi
   tehtävältä, jota ei ole.
3. **Myöhempi torjunta näkyy henkilön rivillä** (*Brave torjui avaimen
   viimeksi haettaessa 9.11.…*, *Ei vastaa*, ja *Vaihda avain* on
   ensisijainen). Sanelun torjunnan henkilö näkee itse samalla hetkellä
   sanelun yhteydessä. Haun torjunta osuu agentin vuoroon, usein ilman ketään
   katsomassa, joten muuten siitä ei jäisi jälkeä.
4. **Paikka.** Suositettu B ei ole saneluavaimen tapainen oma osio, vaan
   rivi integraatioiden joukossa kummallakin puolella. Toiminta on silti
   sama.

### Host-tiedot tuotantoa varten

**Mitä on nyt**

- Saneluavaimen ketju on mallina koko matkalta: gatewayn oma
  `0600`-tiedosto, josta luetaan takaisin vain alue, loppuosa ja päiväys;
  `/api/v1/server/speech-key` (luku, `set`, `delete`); tarkistus ylläpitäjän
  omalla daemonilla (`/internal/v1/speech/key-check`); kopio jokaisen
  daemonille (`/internal/v1/speech/site-key`, `GiveSiteKey`: `seeded`,
  `replaced`, `already_current`, `kept`) tilin luovalla kirjautumisella ja
  ylläpitäjän tallennuksessa. Henkilön tiedosto
  `~/.config/soniox/key.json` kertoo itse, onko se kopio (`source:
  own|site`), joten kopioista ei pidetä kirjaa. Poisto ei peru mitään.
- Palvelun oma haku tulee laajennuksesta, jota `web-search-native`
  rakentaa.

**Mitä tuotanto tarvitsisi** (kaikki saneluavaimen kopioina, ellei toisin
sanota)

- **Gateway**: yhteinen hakuavain gateway-UID:n omassa `0600`-tiedostossa
  (`backend`, `api_key`, `set_at`); luettavissa vain `backend`, loppuosa ja
  `set_at`. Reitti `/api/v1/server/search-key` (luku, `set`, `delete`) ja
  uusi skeema `contracts/v1/server-search-key.schema.json`, jossa on samat
  `given`-sanat. Torjuntakoodit `search_key_rejected`,
  `search_unavailable` ja `search_limit_reached`.
- **Tarkistus**: ylläpitäjän oma daemon tekee yhden koehaun valitussa
  palvelussa (`/internal/v1/search/key-check`), koska vain daemon puhuu
  palveluille.
- **Kopio**: `/internal/v1/search/site-key` jokaisen daemonille samoina
  hetkinä kuin saneluavaimessa. Daemon kirjoittaa vain, jos avainta ei ole
  tai siellä on aiempi kopio.
- **Henkilön daemon**: `~/.config/web-search/key.json` (`0600`, `api_key`,
  `backend`, `source`), jonka hakulaajennus lukee natiivisti. Reitti
  `/api/v1/search/key` (luku, tallennus koehaun kanssa, poisto) ja uusi
  skeema `contracts/v1/search.schema.json`.
- **Poikkeama 2**: luvussa on mukana, mitkä henkilön palvelut hakevat itse ja
  mitkä tarvitsevat avaimen. Luettelon antaa laajennus, koska se tietää,
  mille palveluille se lisää haun. Selaimella ei ole omaa taulukkoa.
- **Poikkeama 3**: kun haku saa 401 tai 403, laajennus kirjoittaa
  merkinnän omaan tilatiedostoonsa (esimerkiksi `last_refused_at`), ja
  daemon lukee sen avaimen tilaan. Uusi tallennus poistaa merkinnän.

### Päätökset myöhempää arviota varten

- **Gateway saa kolmannen pysyvän palveluavaimen.** ADR 0030 nimesi
  sivuston AI-avaimen ainoaksi poikkeukseksi, ja saneluavain lisättiin
  Jarin päätöksellä 27.10. Luen Jarin päätöksen 23.11. ("toimii kuten
  Soniox-avain") hyväksynnäksi samalle poikkeukselle. Toteutuksen pitää
  kirjata se ADR 0030:n muutokseksi ja `internal/AGENTS.md`:n sääntöön.
- **Oman avaimen poisto ei tuo ylläpitäjän avainta takaisin**, eikä
  henkilö voi pyytää sitä itse. Kierros 1 ehdotti tätä ja kysyi siitä
  (kysymykset 2 ja 3). Jarin päätös sanoo "kuten Soniox", ja hakuavaimessa
  ei ole tähän sanelusta poikkeavaa syytä. Jos takaisinotto halutaan, se
  kuuluu kummallekin avaimelle omana muutoksenaan.
- **Henkilölle ei kerrota yhteisestä avaimesta, kun hänellä on oma.** Syy on
  sama kuin edellisessä kohdassa. Tilanne *molemmat* näyttää siksi samalta
  kuin *oma*.
- **Kopioiden saajat näytetään lukumäärinä**, kuten saneluavaimessa, eikä
  henkilöittäin kuten AI-avaimessa. Henkilökohtainen luettelo tarvitsisi
  gatewaylle kopiokirjan, jota saneluavaimella ei ole.
- **Poisto ei kysy vahvistusta** kummallakaan puolella, kuten saneluavaimessa.
  Kierros 1 kysyi. Poisto ei peru mitään palvelussa, ja avaimen voi lisätä
  uudelleen.
- **Staan näkyy valinnassa**, jotta valinnan paikka tulee arvioiduksi.
  Jarin päätöksen mukaan toteutus piilottaa sen, kunnes kattavuus on
  tarkistettu suomen- ja englanninkielisillä hauilla.
- **Tiedoston nimi on `~/.config/web-search/key.json`** eikä palvelun mukaan
  nimetty (`~/.config/soniox/` vastaavasti), koska palvelu voi vaihtua avainta
  vaihdettaessa.
- **Kierros ei lisää rivejä asetusten hakuun** (`settingsIndex`). Toteutus
  lisää valitun paikan rivit, B:ssä `web-search` Tiedot agenteille -osioon
  ja `site-search-key` Palvelinintegraatiot-osioon.

### Kysymys Jarille

1. Kelpaako B (ylläpitäjällä Integraatiot, henkilöllä Tiedot agenteille),
   vai haluatko saneluavaimen kirjaimellisen kopion omina osioinaan (A)?

## Kierros 1: nykytila ja kolme suuntaa

Kierros: `design-system/prototypes/rounds/2026-11-10-hakuavain/`
(`NOTES.md` kertoo sivun rakenteen ja tarkistuksen). Sivu on tuotannon
Asetukset › Tekoäly muuttamattomana, ja verkkohaun rivit on koottu
tuotannon palasista sen oikeille paikoille. Yläpalkin *Tilanne* vaihtaa
kuuden tilanteen välillä:

- palvelun oma haku (ChatGPT ja Claude), ei avainta;
- vain DeepSeek-avain, ei hakuavainta;
- oma Brave-avain;
- ylläpitäjän antama avain käytössä;
- oma Staan-avain ja ylläpitäjän avain, jolloin oma voittaa;
- Brave torjui avaimen.

*Teema*, *Liike* ja *Kieli* vaihtavat vaalean ja tumman, vähennetyn
liikkeen sekä suomen ja englannin. Lisääminen, tallennuksessa torjuttu
avain, poistaminen ja ylläpitäjän avaimen ottaminen takaisin toimivat
painamalla.

Akseli: **missä verkkohaku on Tekoäly-sivulla ja minkä nykyisen mallin
mukaan sitä käytetään.** Sivun yläreunassa on jokaisesta suunnasta yksi
rivi, ja jokainen suunta avautuu omalle rivilleen, joten ero näkyy heti.

0. **Nyt**: Asetukset › Tekoäly tänään. Verkkohausta ei ole riviä.
1. **A Oma osio**: API-avainten alle tulee oma *Verkkohaku*-osio, jossa on kaksi riviä. *Palvelun oma haku* kertoo, mitkä kirjautumiset hakevat itse (*Käytössä* / *Ei saatavilla*). *Hakuavain* on saneluavaimen kaltainen rivi, ja avain lisätään sen omassa lomakkeessa.
2. **B Avainten joukossa**: hakuavain on yksi rivi API-avainten kortissa (*Brave …a1b2 · Oma*, *Avaa: Verkkohaku*), ja se lisätään samanlaisessa ikkunassa kuin AI-avain. Jokaisen tilaus- ja avainrivin alla lukee *Verkkohaku: palvelun oma*, *Brave-avaimella* tai *ei hakua*.
3. **C Yksi rivi**: ylimpään korttiin, oletusmallin ja agentin työn alle, tulee yksi *Verkkohaku*-rivi. Siinä on tila ensin (*Kaikki mallisi voivat hakea verkosta* / *DeepSeek-mallit eivät voi hakea verkosta*) ja jokaisen mallin hakutapa sirulla (*ChatGPT · oma haku*, *DeepSeek · Brave …a1b2*). Avain lisätään ja vaihdetaan ikkunassa *Hakuavain…*-painikkeesta.

**Suositus: C Yksi rivi.** Useimmilla on ChatGPT tai Claude, ja heille
rivi sanoo vain, että haku toimii. Tekemistä ei ole, eikä sivulle tule
osiota, jota he eivät tarvitse. Kun haku puuttuu, sama rivi on ylimpänä
punaisena ja nimeää mallit, jotka eivät hae. Sirut vastaavat kysymykseen
"mistä haku tulee" kaikille malleille kerralla.

Muiden suuntien heikkoudet:

- A on selkein mutta raskain. Kaksi riviä ja oma otsikko sivun alalaidassa
  ovat liikaa asialle, jota useimmat eivät koskaan muuta.
- B sopii avaimen hallintaan, koska kaikki avaimet ovat yhdessä
  paikassa. Hakukyky kuitenkin hajoaa jokaisen rivin alle, ja tilaus, jolla
  haku jo toimii, näyttää avainasialta.

Toteutukseen kannattaa ottaa C:n rivi ja C:n ikkuna. Ikkunassa näkyvät
nykyinen avain ja Poista, ja sen alla on avaimen vaihtolomake.

Kuvat ovat `evidence/`-kansiossa
(`r1-<n>-<suunta>-<tapaus>-<leveys>-<teema>`):

- kaikki kuusi tilannetta kaikissa suunnissa 1440 vaaleana;
- `oma` ja `ei-avainta` myös 1440 tummana sekä 390 vaaleana ja tummana;
- 1440 vaaleana kulut `lomake`, `torjuttu-tallennus`, `tallennettu`,
  `poisto`, `poistettu` ja `kopio-poistettu` sekä englanniksi
  `molemmat-en`.

### Sama kaikissa suunnissa

- **Palvelun oma haku on oletus**, eikä se vaadi mitään (Jarin päätös 3).
  ChatGPT- ja Claude-tilaus sekä OpenAI- ja Anthropic-avain hakevat itse.
  Avain koskee vain malleja, joilla omaa hakua ei ole: tässä DeepSeekiä,
  myöhemmin muitakin.
- **Brave on oletus, ja Staan on EU-vaihtoehto** samassa valinnassa
  (merkinnät *oletus* ja *EU*). Kummastakin näkyy yksi lause: Brave on
  oma hakemisto eikä säilytä hakuja, Staanilla on EU:n lainkäyttöalue ja
  palvelimet. Kummastakin kerrotaan myös ilmaiskiintiö ja linkki avaimen
  hakemiseen.
- **Tallennus kokeilee avainta yhdellä haulla.** Torjuttua avainta ei
  tallenneta (*Avainta ei tallennettu: Brave ei hyväksynyt sitä*), kuten
  saneluavaimessakin.
- **Myöhemmin torjuttu avain** näkyy punaisena: *Brave torjui avaimen
  viimeksi haettaessa 9.11.* ja *Ei vastaa*, ja *Vaihda* on ensisijainen.
- **Ylläpitäjän avain** näkyy AI-avaimen tapaan (*Ylläpitäjän antama*,
  *Käyttö laskutetaan palvelimen tililtä*), ja painike on *Vaihda omaan…*.
- **Kun on molemmat avaimet, oma voittaa**, ja rivi sanoo: *Ylläpitäjälläkin
  on Brave-avain. Omasi on käytössä; jos poistat sen, ylläpitäjän avain tulee
  tilalle.*
- **Poistaminen** kysyy aina vahvistuksen ja kertoo seurauksen. Avainta ei
  peruta palvelussa. Ylläpitäjän avain tulee tilalle, tai mallit nimetään,
  jotka eivät enää hae. Ylläpitäjän kopion poisto kertoo, että sen voi
  ottaa takaisin, ja rivillä on silloin *Ota ylläpitäjän avain käyttöön*.

### Ylläpitäjän avaimen asetus: kierros 2

Ylläpitäjän avaimet ovat omilla sivuillaan palvelinosiossa (*AI-avain*,
*Saneluavain*: `SiteKeyAdministration`, `SpeechKeyAdministration`), eivät
Tekoäly-sivulla. Hakuavaimen asetus kuuluu samaan paikkaan, joten se on
eri näkymä ja tulee kierrokselle 2. Lähtökohta on `SpeechKeyAdministration`:
yhteinen avain, tallennus kokeilee sen, jo liittyneet saavat kopion heti ja
uudet ensimmäisellä kirjautumisellaan, ja jokaisen tulos näkyy (*sai
avaimen*, *käyttää omaa avaintaan*, *ei tavoitettu*). Lisäksi valitaan
Brave tai Staan samalla valinnalla kuin tässä kierroksessa.

### Host-tiedot

**Mitä on nyt**

- Selain tietää henkilön kirjautumiset ja avaimet: `pi/credentials`
  kertoo tilauksen ja jokaisen avaimen esiintymisen ja loppuosan, ja
  `pi/claude-login` kertoo Clauden tilan. `pi/models` kertoo mallit
  palveluittain.
- Saneluavain on lähin malli: daemon pitää avainta henkilön kotihakemistossa
  (`~/.config/soniox/key.json`, `source: own|site`). Yhteisen avaimen
  kopio kirjoitetaan vain, jos avainta ei ole tai siellä on aiempi kopio
  (`GiveSiteKey`: `seeded`, `replaced`, `already_current`, `kept`).
  Gateway antaa kopion ensimmäisellä kirjautumisella ja silloin, kun
  ylläpitäjä tallentaa avaimen. Poisto ei peru mitään.
- AI-avaimen kopiosta henkilön näkymä lukee gatewayn oman merkinnän
  (`onboarding/site` → `site_key_copy`). Saneluavaimessa sellaista ei ole,
  vaan tiedosto kertoo itse, onko se kopio.
- Palvelun oma haku tulee laajennuksesta, jota `web-search-native`
  rakentaa. Clauden tilauksen haku edellyttää, että sama issue saa
  pi-claude-bridgen WebSearchin päälle. Prototyyppi olettaa sen jo
  tehdyksi.

**Mitä tuotanto tarvitsisi**

- **Hakuavain henkilön natiivissa asetuksessa.** Daemon kirjoittaa sen
  hakulaajennuksen omaan tiedostoon kotihakemistossa (esimerkiksi
  `~/.pi/agent/web-search.json`, 0600). Tiedostossa on `backend`
  (`brave|staan`) ja `source` (`own|site`) kuten saneluavaimessa. Pi ja
  päätteen työkalut lukevat sen natiivisti.
- **Yksi lukupyyntö näkymälle**, esimerkiksi `GET /api/v1/pi/web-search`.
  Se kertoisi:
  - avaimen tilan: onko avainta, palvelu, loppuosa, lähde ja viimeisin
    torjunta;
  - mitkä henkilön palvelut hakevat itse;
  - onko palvelimella yhteinen avain ja mikä sen palvelu on.

  Kirjoitukset ovat tallennus, joka kokeilee avaimen, poisto ja *ota
  ylläpitäjän avain käyttöön*. Sopimukseen tulee uusi skeema.
- **Mistä torjunta tiedetään.** Tallennuksessa daemon tekee yhden koehaun.
  Myöhemmästä torjunnasta (401 tai 403 haussa) laajennus kirjoittaa
  merkinnän omaan tilatiedostoonsa, ja daemon lukee sen.
- **Kuka hakee itse.** Luettelo kuuluu laajennukselle, sillä se tietää,
  mille palveluille se lisää haun. Daemon lukee sen laajennuksen
  julkaisusta. Selain ei pidä omaa taulukkoa.
- **Yhteisen avaimen olemassaolo henkilölle.** Kun henkilöllä on oma avain,
  "Ylläpitäjälläkin on Brave-avain" vaatii, että gateway kertoo hänelle,
  onko yhteinen avain olemassa ja minkä palvelun. Loppuosaa tai avainta
  ei kerrota. Tätä ei nyt ole saneluavaimessakaan.
- **Ylläpitäjän avain takaisin henkilön pyynnöstä.** *Ota ylläpitäjän avain
  käyttöön* ja oman avaimen poisto, jonka jälkeen ylläpitäjän avain tulee
  tilalle, tarvitsevat uuden tien: henkilö pyytää gatewayltä kopiota
  omalle daemonilleen. Kopio kulkee samaa reittiä kuin ensimmäisellä
  kirjautumisella. Valtuutus ei muutu, sillä henkilö on jo oikeutettu
  kopioon, eikä avain kulje selaimen kautta. Se on kuitenkin uusi
  gatewayn reitti (kysymys 2).

### Päätökset myöhempää arviota varten

- **Palvelun oma haku ensin, avain vain muille malleille.** Kun mallilla on
  oma haku, avainta ei käytetä sen keskusteluissa. Vaihtoehto olisi tarjota
  avainta kaikille malleille ja antaa mallin valita kahdesta työkalusta.
  Valitsin tämän, koska kaksi hakutyökalua samassa keskustelussa
  hämmentää mallia ja laskuttaa kahdesti. Yksityisyydestä ei myöskään
  voiteta mitään, koska palvelu näkee keskustelun joka tapauksessa.
- **Yksi hakuavain kerrallaan**, Brave tai Staan, ei kumpaakin.
  Vaihtoehto: yksi avain kummallekin palvelulle, kuten AI-avaimissa.
  Hakupalvelu on yksi kyky, eikä kahdesta ole henkilölle hyötyä.
- **Staan näkyy valinnassa jo nyt** merkinnällä *EU*. Jarin päätös sanoo
  "kun kattavuus on todettu". Toteutus voi piilottaa sen, kunnes kattavuus
  on tarkistettu suomen- ja englanninkielisillä hauilla. Prototyyppi
  näyttää sen, jotta valinnan paikka tulee arvioiduksi.
- **Tallennus tekee yhden koehaun.** Se maksaa yhden haun (Bravella noin
  0,005 $, ilmaiskiintiön sisällä). Vaihtoehto on tallentaa kokeilematta
  ja nähdä vika vasta ensimmäisessä haussa, jolloin agentti epäonnistuu
  ihmisen tietämättä.
- **Oman avaimen poisto palauttaa ylläpitäjän avaimen itsestään**, mutta
  ylläpitäjän kopion poisto ei. Jälkimmäisessä rivi tarjoaa *Ota
  ylläpitäjän avain käyttöön*. Saneluavaimessa poisto jättää tyhjän, kunnes
  ylläpitäjä tallentaa avaimen uudelleen. Valitsin tämän, koska "oma
  avain voittaa" tarkoittaa, että ylläpitäjän avain on varalla. Kopion
  itse poistanut ei taas halua sitä takaisin kysymättä.
- **Nimi on *Verkkohaku***, ei *Haku*, koska asetuksissa on jo oma haku
  (*Hae asetuksista*).
- **Kierros ei lisää riviä asetusten hakuun** (`settingsIndex`). Toteutus
  lisää sen valitun suunnan rivitunnisteella (`web-search`).
- **Rivi ei näytä käyttömäärää tai kiintiötä.** Brave tai Staan ei anna
  sitä avaimella luettavaksi ilman erillistä rajapintaa. Se jää pois
  ennen kuin sitä tarvitaan.

### Kysymykset Jarille

1. Kelpaako C (yksi tilarivi ylimmässä kortissa), vai haluatko hakukyvyn
   omaksi osiokseen (A) tai avainten joukkoon (B)?
2. Saako henkilö pyytää ylläpitäjän avaimen takaisin itse? Tämä on uusi
   gatewayn reitti, joka antaa kopion henkilön daemonille hänen
   pyynnöstään eikä vain ylläpitäjän tallennuksessa. Toinen vaihtoehto
   on saneluavaimen tapa, jossa poisto jättää tyhjän, kunnes ylläpitäjä
   tallentaa avaimen uudelleen.
3. Saako henkilö tietää, että palvelimella on yhteinen hakuavain (palvelu,
   ei loppuosaa), silloinkin kun hänellä on oma?
4. Näytetäänkö Staan heti, vai vasta kun sen kattavuus on tarkistettu?
