# Tulos: pysähtyneen agentin herätys, kierros 1

Prototyyppi: `prototypes/wake/index.html`, rakennettuna kierroksesta
`design-system/prototypes/rounds/2026-10-27-agentin-heratys/`. Opas on
`prototypes/wake/NOTES.md` ja kuvat ovat `prototypes/wake/evidence/`-hakemistossa
laitteen skaalauksella 2. `verify.mjs` käy läpi työpöydän ja puhelimen sekä
vaalean ja tumman teeman kaikissa kolmessa suunnassa ja klikkaa jokaisen
laukaisimen. Konsolissa ei ole virheitä, eikä sivu tee verkkopyyntöjä.

## Akseli: mikä herättää

Sisältö on kaikissa suunnissa sama: Birchn yön tapaus synteettisenä. Kuusi
spinoffia käynnistettiin, vuoro päättyi virittämättä odotusta, ja tyhjäkäynnin
pysäytys pysäytti Pi:n klo 20.20. Neljä workeria päättyi yöllä, ja yksi on
yhä käynnissä. Ihminen avaa keskustelun klo 7.21.

| # | Suunta | Mikä herättää | Milloin se on oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | Kirjoittaessa | Ensimmäinen kirjoitettu merkki käynnistää Pi:n ilman vuoroa. Lähetetty viesti tuo kiinnikuromisen. Tila on yhtenä rivinä kentän yllä. | Kierros saa jatkua vasta, kun ihminen sanoo jotain. Hostiin tarvitaan vähiten uutta. | Kierros ei jatku ilman viestiä, joten tuntemattomaan ”jatka”-viestiin tottuu. |
| 2 | Painike | Langan lopun kortti ja **Herätä ja jatka**. Agentti aloittaa vuoron ilman viestiä. | Ihminen haluaa kierroksen jatkuvan yhdellä tarkoituksellisella painalluksella ja näkee ensin, mitä tapahtui. | Kortti vie tilaa langan lopussa, ja painallus on aina tehtävä. |
| 3 | Avatessa | Avaaminen herättää itse kuuden sekunnin kuluttua, jos omia töitä on päättynyt levon aikana. **Älä herätä** peruu. | Herkin ihmislähtöinen laukaisin: kierros jatkuu heti, kun ihminen palaa. | Pelkkä vilkaisu puhelimella, välilehden palautus tai toinen laite käynnistää työn ja kuluttaa tokeneita. Lähtölaskenta toistuu joka kerta. |

Kaikissa suunnissa ovat lisäksi mukana:

- **Lepotila näkyy.** Sivupalkissa on kuu ja levon aikana päättyneiden töiden
  määrä, ja yläpalkissa lukee ”Lepää”.
- **Kiinnikuromisen sisältö näkyy ennen herätystä:** milloin ja miksi Pi
  pysähtyi, mitkä työt päättyivät sillä välin ja mikä on yhä käynnissä.
- **Herätyksen jälkeen** nykyisen ”Agentti käynnistettiin uudelleen”
  -merkinnän paikalla on merkintä, joka kertoo syyn. Tätä
  `pi-stop-cause-overnight` suositteli kohdassa 4.
- **Herätä, kun valmistuu** on kierroksen löytämä lisälaukaisin: kytkin yhä
  käynnissä olevan workerin rivillä. Agentti herää kerran, kun juuri se työ
  päättyy. Ihminen kytkee sen itse, ja se koskee yhtä työtä, joten se ei
  herätä vanhoja keskusteluja automaattisesti. Silti se on ainoa laukaisin,
  joka olisi jatkanut Birchn yökierrosta.

## Host-tiedot, joita suunnat olettavat

| Tieto tai toiminto | Tarvitsee | Onko olemassa |
|---|---|---|
| Onko keskustelun Pi käynnissä | kaikki | **On**: snapshotin `process` (`daemon_managed_live` / `not_observed`) ja `capabilities.agent_resume`. |
| Milloin ja miksi Pi pysähtyi (tyhjäkäynti, daemonin uudelleenkäynnistys, kaatuminen vai ihmisen Stop) | kaikki (lauseeseen ”10 min jouten, mikään ei katkennut”), suunta 3 ja kytkin (ihmisen Stop estää herätyksen) | **Ei ole.** Tieto on vain daemonin journalissa (`conversation_idle_stop`). Daemon tarvitsee sen keskustelun tilaan: aika ja syy. |
| Levon aikana päättyneet omat ajot, joita agentille ei vielä ole kerrottu | kaikki (lista ja sivupalkin luku) | **Osittain.** `spinoffs.schema.json` antaa keskustelun omat ajot tiloineen. Rajauksen ”ei vielä kerrottu” laskee vain Pi:n laajennus (`readSpinoffs` ja `reported`-joukko tiedostossa `process-extension.mjs`), ja vasta Pi:n käynnistyessä. Daemonin pitää laskea sama selaimelle Pi:n ollessa pysähdyksissä, samalla `run_id:state`-avaimella. |
| Pi:n käynnistys ilman vuoroa | 1 (esilämmitys kirjoitettaessa) | **On**: `POST /api/v1/conversations/<id>/continue`. Kiinnikuromisviesti lähtee seuraavan vuoron mukana (`before_agent_start`). Esilämmitetty mutta käyttämätön Pi pysähtyy tyhjäkäyntinä 10 minuutissa, ja se on oikein. |
| Herätysvuoro ilman ihmisen viestiä | 2, 3 ja kytkin | **Ei ole.** Daemon käynnistäisi Pi:n ja aloittaisi vuoron, jonka kehotteena on kiinnikuromisviesti. Nyt viesti on ei-laukaiseva konteksti, ja ADR 0020:n mukaan uudelleenkäynnistyksen jälkeen vuoron aloittaa vain ihmisen lähetys. Tämä on arkkitehtuurimuutos, joka vaatii Jarin päätöksen. |
| Herätys kerran per valmistuminen (kaksi laitetta, välilehdet, toistuva avaus) | 2, 3 ja kytkin | **Osittain.** Avain `run_id:state` on jo olemassa. Herätysoperaatiolta puuttuu idempotenssi: sama herätysaikomus ei saa aloittaa kahta vuoroa. |
| Syyn kertova merkintä | kaikki | **Osittain.** Uudelleenkäynnistysmerkintä on olemassa (`restart_linux.go`, `RestartNoticeMarker`). Syykenttä puuttuu: viesti, painike, avaus tai kytkin. |
| Ajon tilan seuraaminen ja herätys, kun kytketty ajo päättyy | kytkin | **Ei ole.** Daemonin pitää seurata kytkettyä ajoa myös silloin, kun Pi ei ole käynnissä. Kytkentä tallennettaisiin natiivin istunnon custom-merkintänä eikä uuteen tietovarastoon, jotta se säilyy daemonin uudelleenkäynnistyksen yli. |
| Elävien Pi:den raja | kaikki herätykset | **On**: neljän elävän raja ja `makeRoom` pysäyttävät jouten olevan. Jos yksikään ei ole jouten, vastaus on `429 capacity_exceeded`. Herätys kieltäytyy silloin ja kertoo syyn eikä pysäytä kiireistä keskustelua. |

## Suositus

**Suunta 2 (Painike), ja siihen suunnan 1 esilämmitys kirjoitettaessa ja
kytkin Herätä, kun valmistuu.**

- Jari halusi ihmisen käynnistämiä laukaisimia. Painallus on niistä
  yksiselitteisin: se tapahtuu vasta, kun ihminen on nähnyt, mitä yöllä
  tapahtui, ja haluaa jatkaa. Kortin lista on sama tieto, jonka agentti saa,
  joten ihminen ja agentti aloittavat samasta kohdasta.
- Avaaminen (3) on herkin laukaisin, mutta avaus ei kerro aikomuksesta. Usein
  keskustelu avataan puhelimella vain tilan katsomiseksi, välilehti palautuu
  tai sama keskustelu on auki kahdella laitteella. Lähtölaskenta estää
  yllätyksen, mutta muuttuu toistuvaksi kehotukseksi, joka on peruttava.
- Esilämmitys kirjoitettaessa (1) poistaa käynnistysviiveen viestiltä ja
  käyttää olemassa olevaa `continue`-reittiä. Se sopii minkä tahansa suunnan
  rinnalle eikä tarvitse uutta päätöstä.
- Kytkin kattaa Birchn yön tapauksen ilman, että vanhat keskustelut heräävät
  automaattisesti. Sen voi toteuttaa painikkeen jälkeen samalla
  herätysoperaatiolla.

Toteutusjärjestys, jos tämä valitaan: (a) host-tiedot pysähtymisen ajasta,
syystä ja kertomattomista valmistumisista snapshotiin, (b) idempotentti
herätysoperaatio (ADR 0020:n muutos Jarin päätöksellä), (c) kortti,
sivupalkin merkki ja syyn kertova merkintä, (d) kytkin.

## Kysymykset Jarille

1. Mikä suunta: kirjoittaminen, painike vai avaaminen? Suositus on
   painike, ja siihen esilämmitys ja kytkin.
2. Saako agentti aloittaa vuoron ilman ihmisen viestiä, kun ihminen painaa
   Herätä-painiketta tai on kytkenyt työn päälle? Tämä muuttaa ADR 0020:ta.
3. Kuuluuko **Herätä, kun valmistuu** -kytkin mukaan nyt vai myöhemmin?
4. Kuu ja luku sivupalkissa, ”Lepää” yläpalkissa: sopivatko sanat ja
   merkki?

## Huomiot kierroksesta

- Kirjaston tilannekatsaus (`recap`) on tällä kierroksella pois päältä,
  koska se esittää eri asiaa (keskustelun tilan) ja olisi peittänyt
  kiinnikuromisen. Toteutuksessa on päätettävä, näkyvätkö ne yhtä aikaa.
- Kierros ei muuttanut kirjastoa. Lepotilan merkki, kortti ja syyn kertova
  merkintä ovat kierroksen omia tyylejä (`round.css`).
