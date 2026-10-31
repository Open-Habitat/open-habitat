# Sillä aikaa -rivi tilakoneena: opas

Avaa `tilakoneet.html` (yksi offline-sivu, ei verkkoa). Ylhäällä on valitsin
(näppäimet 1–4 tai ←/→): **Nykyinen**, **Työn ajan**, **Saapuminen** ja
**Kierros eteenpäin**. Oikeassa yläkulmassa voit vaihtaa vaalean ja tumman
teeman sekä työpöydän ja puhelimen.

## Miten sivua käytetään

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

## Kokeile näin

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

## Mitä tarkistin

Nykyinen tila on luettu koodista (`NextWaitingDock.tsx`, `nextWaiting.ts`,
`App.tsx`, `BrowserConversation.tsx`, `railNow.ts`). Ajoin lisäksi
tilapäisen selaintestin, jota ei commitoitu. Testi toisti virheen 1. Se myös
kumosi epäilyn, että lukitus kulkisi keskustelusta toiseen: avatussa
keskustelussa riviä ei näkynyt. Lukitus kuitenkin purkautuu vain siksi, että
kenttä ja rivi irrotetaan latauksen ajaksi. Graafissa tämä on merkitty
kohdalla *i*.

Kuvat ovat hakemistossa `kuvat/`, laitteen skaalauksella 2. Suosittelen
Saapumista; perustelut ovat issuen tiedostossa `result.md`.
