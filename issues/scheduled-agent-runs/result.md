# Result: scheduled agent runs

## Kierros 1

Konsepti: [design.md](design.md). Prototyyppi:
`design-system/prototypes/rounds/2026-11-28-ajastetut-ajot-1/` (rakennus ja
tarkistus sen `NOTES.md`:ssä; `dist/` ei ole versionhallinnassa).

**Akseli: missä ajastukset listataan ja missä niitä hoidetaan.**

- **A · Paikka**: sivupalkin yläosassa on oma paikka *Ajastukset*
  Tuotokset-paikan vieressä. Sen sivulla on kaikki ajastukset ja valitun
  ajastuksen tiedot rinnakkain (puhelimessa ensin lista). Paikassa näkyy
  luku vain, kun jokin vaatii huomiota (epäonnistunut ajo). Työtilan sivulla
  on sama lista rajattuna siihen työtilaan.
- **B · Työtila**: paikkaa ei ole. Ajastukset ja niiden tiedot ovat vain
  työtilan sivulla. Epäonnistuneesta ajosta kertoo vain Sinun vuorosi -rivi.

Suositus on A: ajastus toimii puolestasi silloin, kun kukaan ei katso, joten
tarvitaan yksi näkymä kaikesta, mitä ajetaan.

Muu on molemmissa samaa ja tulee suoraan konseptista:

- Jokainen ajo on uusi keskustelu. Ensin tulee Open Habitatin rivi ("aloitti
  ajastetun ajon … ma 30.11. klo 6.00", *Avaa ajastus*) ja sitten ohje.
  Keskustelun nimi on ajastuksen nimi ja päivä. Ajon aikana keskustelu on
  Käynnissä-osiossa. Valmis ajo nousee Sinun vuorosi -osioon, tai valinnan
  mukaan se jää Hiljaisiin, paitsi jos agentti kysyy jotain tai ajo
  epäonnistuu.
- Ajastuksen sivulla ovat *Aja nyt*, *Keskeytä* tai *Jatka* sekä ⋯-valikossa
  *Muokkaa…* ja *Poista…*. Sivu kertoo myös työtilan, mallin, toistuvuuden
  sanoin, aikavyöhykkeen, seuraavan ajon, minne valmis ajo menee ja sen,
  oliko ajastus agentin ehdotus. Ohje näkyy kokonaan, ja ajohistoriassa on
  rivi kustakin ajosta: Valmis, Kysyi sinulta, Epäonnistui, Ohitettu tai
  Myöhässä, ja linkki ajon keskusteluun.
- Jos palvelin oli alhaalla, väliin jääneistä ajoista tehdään yksi
  myöhästynyt ajo, ja muut kirjataan ohitetuiksi. Kun kiintiö on täynnä, ajo
  epäonnistuu eikä sitä yritetä uudelleen. Kolmannen peräkkäisen
  epäonnistumisen jälkeen ajastus keskeytyy itsestään.
- Agentti ei luo ajastusta itse. Se näyttää keskustelussa ehdotuskortin, jossa
  ovat *Luo ajastus*, *Muokkaa…* ja *Ei*. Siksi Vaarallisiin toimintoihin ei
  tarvita kytkintä.

Näkymä olettaa hostilta: ajastusten listan tilatietoineen, kunkin ajon tilan
ja keskustelun tunnisteen, ohitettujen ajojen syyn, ajon keskustelun
merkinnän ajastukseksi (sivupalkin riville ja Open Habitatin riville) sekä
seuraavan ajon ajan laskettuna aikavyöhykkeessä.

Kierroksen omana ohituksena `PLACE_ICONS` saa `schedules`-avaimen. Jos A
valitaan, toteutus lisää `RailPlaceId`:hen paikan ja sivupalkin ajoriville
kellomerkin. Tässä kierroksessa ajon tunnistaa riviltä vain nimestä ja
päivästä.

Päätettäväksi myöhemmin, kun suunta on valittu: missä ajastus on tallessa
(suositus `design.md`:ssä: yksi systemd-käyttäjäajastin kutakin ajastusta
kohden, ja ajastimet ovat koko kirjanpito) ja ylläpitäjän rajat.

Kysymykset Jarille:

1. A vai B: oma *Ajastukset*-paikka sivupalkissa vai vain työtilan sivu?
2. Riittääkö, että agentti voi vain ehdottaa ajastusta kortilla? Vai
   halutaanko myös suora luonti Vaarallisten toimintojen kytkimen takana?
3. Onko uusi keskustelu jokaisella ajolla oikea oletus? Vaihtoehto on yksi
   pysyvä keskustelu, joka herätetään joka kerta.
