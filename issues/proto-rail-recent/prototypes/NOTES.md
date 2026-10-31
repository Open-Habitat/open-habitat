# Raide ja viimeisimmät keskustelut: opas

Avaa `raide.html`. Se on yksi offline-sivu, joka ei käytä verkkoa. Ylhäällä on
valitsin (näppäimet 1–5 tai ←/→):

- **Pilot.17** näyttää, mitä näit 31.10.
- **Nykyinen** on main tänään.
- **1 · Vuorokausi**, **2 · Viisi viimeisintä** ja **3 · Omat käynnit** ovat
  suunnat.

Oikeasta yläkulmasta vaihdat vaalean ja tumman teeman, työpöydän ja puhelimen
sekä työtilojen kuvakkeet päälle tai pois.

## Miten sivua käytetään

- Vasemmalla on yhden keskustelun tilakone. Korostettu laatikko on
  **kohdekeskustelun** tila. Katkoviivainen laatikko ei näy raiteessa, ja
  paksu viiva on viimeisin siirtymä. Punainen katkoviiva on aukko nykyisessä
  koodissa, oranssi katkoviiva suunnan hinta ja vihreä pisteviiva
  siirtymä, jossa rivi pysyy paikallaan. Merkit viittaavat graafin alla
  olevaan listaan.
- Oikealla valitset kohteen ja tapahtumat: agentti aloittaa, valmistuu tai
  kysyy, Pi lepää 10 minuutin jälkeen, arkistointi, daemonin uudelleenkäynnistys
  (päivitys), ajan kuluminen (+10 min, +1 t, +1 vrk, +3 pv) ja sivun
  uudelleenlataus. Kun aikaa kuluu, joutilaat Pi:t pysähtyvät itsestään kuten
  tuotannossa.
- Raiteen rivit avautuvat klikkaamalla (puhelimessa ☰). Työtilan nimi avaa
  työtilan sivun, josta näet kaikki sen keskustelut. Nykyisessä mainissa sinne
  joutuu menemään tunnin takaisen keskustelun takia. Avoimessa keskustelussa
  toimivat Lähetä ja Pysäytä.
- **Jarin tilanne 31.10.** toistaa sen, mitä näit. Pilot.17-päivitys
  käynnistää daemonin uudelleen klo 12.21 kesken deutschpadin vuoron. Muut
  keskustelut ovat valmiita, ja kello siirtyy aikaan 19.18. Paina tätä
  jokaisessa viidessä näkymässä ja vertaa raiteita.

## Kokeile näin

1. **Pilot.17** → *Jarin tilanne 31.10.*: raiteessa on vain
   `Hiljaiset · yli tunnin › d deutschpad 1`. Avaa taite. Graafissa
   keskeytynyt on Hiljaisissa (aukko 3).
2. **Nykyinen** → *Jarin tilanne 31.10.*: raide on kokonaan tyhjä. Mainissa
   valmis keskustelu lähtee raiteesta heti, ja päivityksen katkaisema vuoro
   katoaa. *Alusta tarina* → *Agentti valmistuu*: avoin keskustelu lähtee
   raiteesta, vaikka olet siinä (aukko 1). *Lataa sivu uudelleen*: Julkaisun
   muistiinpanojen lukematon vastaus katoaa (aukko 2).
3. **1 · Vuorokausi** → *Jarin tilanne*: Käynnissä-listassa on ◆ Verbien
   taivutus (keskeytyi), ja Viimeisimmissä on päivän keskustelut. Kokeile
   sitten *+3 pv*: osio tyhjenee.
4. **2 · Viisi viimeisintä** → *+3 pv*: osio pysyy samana. Valitse kohteeksi
   muutama vanha keskustelu, paina *Agentti aloittaa* ja *Agentti valmistuu*
   ja katso, kuka putoaa pois.
5. **3 · Omat käynnit** → vaihda *Puhelin*: puhelimella osiossa on vain se,
   minkä avasit puhelimella. Valitse kohteeksi *Varmuuskopion tarkistus*
   (ajettu terminaalissa), *Agentti aloittaa* → *Agentti valmistuu*: se ei
   tule osioon, koska et ole avannut sitä tässä selaimessa.

Kaikissa kolmessa suunnassa Pi:n lepo ja päivitys eivät siirrä riviä
(vihreä silmukka). Keskeytynyt näkyy Käynnissä-listassa, ja Hiljaiset · yli
tunnin poistuu. Suunnat eroavat vain siinä, mikä tekee keskustelusta
viimeaikaisen.

Suosittelen suuntaa **2 · Viisi viimeisintä**. Perustelut ja hostin tiedot
ovat issuen `result.md`:ssä. Kuvat ovat hakemistossa `kuvat/` laitteen
skaalauksella 2.

Sivu rakennetaan komennolla `python3 build.py`, joka upottaa tokenit ja
fontit tiedostosta `page.src.html`.
