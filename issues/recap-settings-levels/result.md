# Tulos: tilannekatsauksen asetukset, Tasot

Asetukset › Tilannekatsaus (`/settings/recap`) toteuttaa prototyypin suunnan 3
(Tasot) Jarin 29.10. muutoksin. Asetukset ovat Pi:n `~/.pi/agent/settings.json`:ssa
avaimessa `openHabitat.recap`; daemon kirjoittaa ne Pi:n omalla
SettingsManagerilla ja lukolla, ja laajennus lukee ne jokaisessa katsauksessa.
Sopimus on `contracts/v1/recap-settings.schema.json` (GET/PUT
`/api/v1/pi/recap-settings`), ja `pi-models` sai valinnaisen kentän
`background_models` (mihin Automaattinen nyt osuu kunkin palvelun
keskustelussa).

Asetusrivien vakaat tunnisteet (`data-settings-row`, myöhempää asetushakua
varten): `recap-delay`, `recap-model`, `recap-level`, `recap-messages`,
`recap-history`, `recap-message`, `recap-turns`, `recap-words`, `recap-next`,
`recap-response`.

## Päätökset myöhempää tarkistusta varten

- **Viiveen asteikko: 14 pysähdystä 1–9 min (60, 75, 90, 105, 120, 150, 180,
  210, 240, 300, 360, 420, 480, 540 s).** Jokainen askel on noin viidenneksen
  edellistä pidempi, joten liukusäätimen tasavälinen kulku on lähes
  logaritminen. Vaihtoehdot: puhdas logaritmi (sekunteja kuten 97 s) tai
  tasavälinen 30 s. Valinnan syy: pyöreät arvot ja sama lyhyiden ja pitkien
  viiveiden tarkkuus. Rajat pysyivät prototyypin rajoina (Pi:n 10 min
  pysäytys ylhäällä, selaimen läsnäoloilmoitukset alhaalla). Merkit 1, 2, 3,
  5 ja 9 min.
- **Tila-valinta poistettiin kokonaan (Jarin päätös), ja *Kun pyydän* on
  otsakkeen painike *Tee tilannekatsaus nyt*.** Puhelimessa ja kapeassa
  ikkunassa painike siirtyy otsakkeen ⋯-valikkoon kuten *Uusi otsikko*.
  Vaihtoehto: pitää se aina näkyvissä myös puhelimessa. Valinnan syy:
  puhelimen otsake on kaksirivinen ja harvoin käytetyt toiminnot ovat jo
  valikossa; painike on silti aina saatavilla. Painike tuo myös suljetun tai
  pidätetyn kortin takaisin, eikä tee uutta katsausta, jos nykyinen on jo
  ajan tasalla.
- **Tasojen arvot ovat prototyypin arvot** (Lyhyt 25/10 sanaa, 16 viestiä,
  ~4 000 tokenia, ~500/viesti, 256 vastaus, 2. vuoron jälkeen; Tavallinen =
  nykyinen; Perusteellinen 70/16, 128, ~32 000, ~2 000, 768, 1). Tasot ovat
  selaimen nimiä luvuille: palvelin tallentaa luvut ja tason nimen. Jos
  tallennettu taso ei enää vastaa lukujaan (vanhempi julkaisu, käsin
  muokkaus), selain näyttää Oman.
- **Ensimmäisen katsauksen vuororaja koskee vain automaattista katsausta.**
  Otsakkeen painikkeella pyydetty katsaus tehdään heti. Vaihtoehto: sama raja
  molemmille. Valinnan syy: pyyntö on henkilön oma, eikä sitä pidä hiljaa
  ohittaa. Automaattinen ohitus ei näy virheenä (`too_early` ei päädy kortille).
- **Mallitoive kokeillaan ensin, sitten Automaattinen ja keskustelun oma malli.**
  Toive ohitetaan, jos sille ei ole kirjautumista tai se on Fable/Opus. Daemon
  kieltäytyy tallentamasta Fable- tai Opus-toivetta, joten asetus ei voi näyttää
  mallia, jota ei käytetä. Toive koskee vain tilannekatsausta, ei automaattisia
  otsikoita (kuten prototyypin päätös).
- **Automaattinen-rivin teksti näyttää valitun palvelun välilehden mallin**
  (*Nyt GPT-6 Luna*), ja kentässä näkyy oletusmallin palvelun automaattinen
  valinta. Jos palvelulla ei ole keskiluokan mallia, teksti on *Keskustelun
  oma malli*, koska valinta riippuu silloin keskustelusta.
- **Tokenit tallennetaan tokeneina ja muunnetaan 4 tavuksi/token.** Oletukset
  ovat siksi 64 000 ja 4 000 tavua aiempien 65 536 ja 4 096 sijaan. Ero on
  merkityksetön, ja yksi kerroin pitää näkymän ja laajennuksen samana.
- **Merkkirajat skaalautuvat sanoista:** katsaus 8 merkkiä/sana (40 → 320),
  seuraavaksi 40/3 merkkiä/sana (12 → 160), JSON-alue vähintään 2 048 merkkiä
  tai 4 × vastausraja. Kehote sanoo yli 40 sanan katsauksesta *two to four
  sentences*.
- **Esikatselukortti** näyttää synteettisen tekstin katkaistuna valittuun
  sanamäärään. Se ei kutsu mallia.
- **Tallennus on optimistinen ja viimeisin muutos voittaa**: näkymä päivittyy
  heti, tallennukset menevät jonossa yksi kerrallaan, ja epäonnistunut tallennus
  palauttaa näkymään tallennetun arvon ja sanoo, ettei muutosta tallennettu.
