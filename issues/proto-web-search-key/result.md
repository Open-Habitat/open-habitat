# Verkkohaun avain Asetukset › Tekoäly -sivulla

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
