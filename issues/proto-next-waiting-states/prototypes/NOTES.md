# Sillä aikaa -rivi tilakoneena: opas

Kierroksia on kaksi. **Kierros 2** (`tilakoneet-2.html`) perustuu sinun
31.10. antamaasi laukaisimeen: rivi tulee, kun lähetät agentille viestin.
Ohje kierrokselle 2 on alempana. Kierros 1 on ensimmäinen ehdotus, ja se on
jätetty vertailuun.

## Kierros 1

Avaa `tilakoneet.html` (yksi offline-sivu, ei verkkoa). Ylhäällä on valitsin
(näppäimet 1–4 tai ←/→): **Nykyinen**, **Työn ajan**, **Saapuminen** ja
**Kierros eteenpäin**. Oikeassa yläkulmassa voit vaihtaa vaalean ja tumman
teeman sekä työpöydän ja puhelimen.

### Miten sivua käytetään

- Vasemmalla on tilakone. Korostettu laatikko on tila, jossa olet nyt, ja
  paksu viiva on siirtymä, jonka viimeisin tapahtuma teki. Punainen
  katkoviiva on nykyisen koodin virhe ja oranssi katkoviiva suunnan hinta.
  Numerot ja kirjaimet viittaavat graafin alla olevaan listaan, ja listan
  rivi korostuu, kun kuljet sen siirtymän läpi.
- Oikealla ovat tapahtumat: tämän keskustelun agentti aloittaa, valmistuu
  tai kysyy, sinä lähetät viestin, toinen keskustelu alkaa odottaa tai
  lakkaa odottamasta, arkistointi ja sivun uudelleenlataus. Raiteen
  keskustelut avautuvat klikkaamalla (puhelimessa ☰). Rivin painikkeet,
  Alt+↓ ja Esc toimivat kuten tuotannossa.
- Tarina alkaa aina samasta kohdasta: olet keskustelussa *Rivin tilakone*,
  jonka agentti on valmis ja vastaus luettu. Sinua odottaa kaksi
  (*Julkaisun muistiinpanot*, uusi vastaus, ja *Birch-päivitys*, joka
  kysyy), ja kaksi muuta työskentelee. *Alusta tarina* palaa tähän.

### Kokeile näin

1. **Nykyinen**: Lähetä viesti → rivi tulee. Agentti valmistuu → rivi jää
   (virhe 1, kuvasi tilanne). Käy läpi → Seuraava → Seuraava → kierros vie
   takaisin lähtöön (virhe 2). Kun avaat askeleen, ✓ tulee jo lukemisesta
   (virhe 3). Kierroksen aikana avaa raiteesta *Kuvakaappaukset AVIFiksi*:
   palkki tulee mukaan (virhe 4).
2. **Työn ajan**: sama alku. Rivi katoaa heti, kun agentti valmistuu tai
   kysyy. *Avaa seuraava* vie Julkaisun muistiinpanoihin, eikä siellä näy
   mitään ennen kuin vastaat (hinta A).
3. **Saapuminen**: *Avaa seuraava* → perillä näkyy hiljainen
   "Seuraavaksi · Birch-päivitys · Seuraava". Vastaat → agentti työskentelee
   → tavallinen rivi. Seuraava viimeiseen → "Muita ei odota sinua." Ei
   paluuta, ei lopetettavaa kierrosta.
4. **Kierros eteenpäin**: Käy läpi → palkki ilman lähtöä ja ↑:ta. ✓ tulee
   vasta, kun lähetät askeleessa. Viimeisessä nappi on *Valmis*, ja jäät
   siihen keskusteluun.

### Mitä tarkistin

Nykyinen tila on luettu koodista (`NextWaitingDock.tsx`, `nextWaiting.ts`,
`App.tsx`, `BrowserConversation.tsx`, `railNow.ts`). Ajoin lisäksi
tilapäisen selaintestin, jota ei commitoitu. Testi toisti virheen 1. Se myös
kumosi epäilyn, että lukitus kulkisi keskustelusta toiseen: avatussa
keskustelussa riviä ei näkynyt. Lukitus kuitenkin purkautuu vain siksi, että
kenttä ja rivi irrotetaan latauksen ajaksi. Graafissa tämä on merkitty
kohdalla *i*.

Kierroksen 1 suositus oli Saapuminen. Kuvat ovat hakemistossa `kuvat/`,
laitteen skaalauksella 2 (kierroksen 2 kuvat alkavat `r2-`).

## Kierros 2: rivi tulee lähetyksestä

Avaa `tilakoneet-2.html`. Valitsimessa ovat **Nykyinen**, **Vuoron
loppuun**, **Paikka pysyy** ja **Lähtöön asti**. Sivu toimii kuten
kierroksessa 1. Tapahtumiin on lisätty *Lähetys epäonnistuu*.

Kaikissa kolmessa suunnassa rivi tulee, kun lähetät viestin tähän
keskusteluun ja host ottaa sen vastaan. Näkyessään rivi päivittyy: kun
joku alkaa odottaa tai lakkaa odottamasta, määrä ja nimet vaihtuvat.
Agentti, joka aloittaa ilman sinun lähetystäsi, ei tuo riviä. *Avaa
seuraava* vie ensimmäiseen odottavaan, eikä rivi seuraa mukana: siellä se
tulee, kun lähetät. Suunnat eroavat yhdellä akselilla: mikä sulkee
lähetyksen avaaman ikkunan ja miltä muutos näyttää.

1. **Vuoron loppuun**: rivi katoaa, kun agentti valmistuu tai kysyy, lähetys
   epäonnistuu tai lähdet. Kun kukaan muu ei odota, rivi katoaa, ja se palaa,
   jos joku alkaa odottaa.
2. **Paikka pysyy**: sama ikkuna, mutta rivi pitää paikkansa. Kun kukaan ei
   odota, rivillä lukee hiljaa "Kukaan muu ei odota sinua". Vuoron lopussa
   rivi sanoo hetken "Vastaus valmis tässä" tai "Agentti kysyy sinulta" ja
   häviää neljän sekunnin päästä.
3. **Lähtöön asti**: ikkuna sulkeutuu vasta, kun lähdet tai lataat sivun.
   Vuoron loppu muuttaa sisältöä: "Täällä valmis · N odottaa yhä" tai
   "Kysyy täällä · N odottaa myös".

Kokeile ainakin näin: Lähetä viesti → Toinen lakkaa odottamasta kahdesti
(kukaan ei odota) → Toinen alkaa odottaa → Agentti valmistuu. Kokeile myös
Agentti aloittaa ilman lähetystä.

Suosittelen Vuoron loppuun -suuntaa; perustelut ovat issuen `result.md`:ssä.
